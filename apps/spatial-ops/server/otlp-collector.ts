import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  createSampleOtlpRequest,
  OtlpTopologyRingStore,
  type DynamicTopologySnapshot,
} from "../src/telemetry/otlp-topology.js";

const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MiB OTLP batch cap
const MAX_NDJSON_LINES = 400;

export interface OtlpCollectorOptions {
  host?: string;
  port?: number;
  maxTraces?: number;
  maxBodyBytes?: number;
  /** File path for NDJSON OTLP persistence, or `false` to keep strictly in-memory. */
  dataFile?: string | false;
  /** Optional snapshot JSON path synced for external CLI/MCP consumers. */
  snapshotFile?: string | false;
  /** When true, seeds explicit sample demo traces on startup. Defaults to false. */
  demoMode?: boolean;
}

export interface RunningOtlpCollector {
  server: http.Server;
  host: string;
  port: number;
  url: string;
  demoMode: boolean;
  store: OtlpTopologyRingStore;
  close: () => Promise<void>;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
    ...extraHeaders,
  });
  res.end(payload);
}

function readRequestBuffer(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        reject(new PayloadTooLargeError(maxBytes));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Payload exceeds maximum limit of ${maxBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

export function getDefaultOtlpStoragePaths(): {
  dataFile: string;
  snapshotFile: string;
} {
  const dir = path.join(os.homedir(), ".spatial-ops");
  return {
    dataFile: path.join(dir, "otlp-traces.ndjson"),
    snapshotFile: path.join(dir, "otlp-snapshot.json"),
  };
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hydrateFromNdjson(
  store: OtlpTopologyRingStore,
  dataFile: string
): void {
  if (!fs.existsSync(dataFile)) return;
  try {
    const content = fs.readFileSync(dataFile, "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines.slice(-MAX_NDJSON_LINES)) {
      try {
        const parsed = JSON.parse(line) as {
          receivedAtMs?: number;
          payload?: unknown;
        };
        if (parsed && parsed.payload) {
          store.ingestOtlpPayload(
            parsed.payload,
            typeof parsed.receivedAtMs === "number" ? parsed.receivedAtMs : Date.now()
          );
        }
      } catch {
        // Skip malformed historical line safely
      }
    }
  } catch {
    // Best-effort local persistence hydration
  }
}

function persistNdjsonLine(dataFile: string, entry: unknown): void {
  try {
    ensureParentDir(dataFile);
    fs.appendFileSync(dataFile, `${JSON.stringify(entry)}\n`, "utf8");

    // Compact NDJSON file if it grows past bound
    const raw = fs.readFileSync(dataFile, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length > MAX_NDJSON_LINES * 1.5) {
      const kept = lines.slice(-MAX_NDJSON_LINES).join("\n") + "\n";
      fs.writeFileSync(dataFile, kept, "utf8");
    }
  } catch {
    // Non-fatal persistence error
  }
}

function writeSnapshotAtomically(
  snapshotFile: string,
  snapshot: DynamicTopologySnapshot
): void {
  try {
    ensureParentDir(snapshotFile);
    const tmpPath = `${snapshotFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(snapshot), "utf8");
    fs.renameSync(tmpPath, snapshotFile);
  } catch {
    // Non-fatal snapshot sync error
  }
}

export async function startOtlpCollectorServer(
  options: OtlpCollectorOptions = {}
): Promise<RunningOtlpCollector> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 4318;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const demoMode = options.demoMode ?? false;

  const defaults = getDefaultOtlpStoragePaths();
  const dataFile =
    options.dataFile === false
      ? false
      : options.dataFile ?? defaults.dataFile;
  const snapshotFile =
    options.snapshotFile === false
      ? false
      : options.snapshotFile ?? defaults.snapshotFile;

  const store = new OtlpTopologyRingStore({ maxTraces: options.maxTraces ?? 150 });
  const sseClients = new Set<ServerResponse>();

  if (dataFile) {
    hydrateFromNdjson(store, dataFile);
  }

  const broadcastSnapshot = (): DynamicTopologySnapshot => {
    const snapshot = store.buildSnapshot();
    if (snapshotFile) {
      writeSnapshotAtomically(snapshotFile, snapshot);
    }
    if (sseClients.size > 0) {
      const frame = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
      for (const client of sseClients) {
        if (!client.writableEnded) {
          client.write(frame);
        }
      }
    }
    return snapshot;
  };

  if (demoMode && store.getStats().totalIngestedTraces === 0) {
    const now = Date.now();
    store.ingestOtlpPayload(
      createSampleOtlpRequest({ faulty: false, nowMs: now - 2500 }),
      now - 2500
    );
    store.ingestOtlpPayload(
      createSampleOtlpRequest({ faulty: true, nowMs: now }),
      now
    );
  }

  if (snapshotFile) {
    writeSnapshotAtomically(snapshotFile, store.buildSnapshot());
  }

  const heartbeatInterval = setInterval(() => {
    for (const client of sseClients) {
      if (client.writableEnded) {
        sseClients.delete(client);
      } else {
        client.write(": keepalive\n\n");
      }
    }
  }, 25000);
  heartbeatInterval.unref();

  const server = http.createServer(async (req, res) => {
    const method = (req.method ?? "GET").toUpperCase();
    const parsedUrl = new URL(req.url ?? "/", `http://${host}:${requestedPort}`);
    const pathname = parsedUrl.pathname;

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With, Accept",
        "Access-Control-Max-Age": "600",
      });
      res.end();
      return;
    }

    if (method === "GET" && pathname === "/health") {
      const addr = server.address();
      const boundPort =
        addr && typeof addr === "object" ? addr.port : requestedPort;
      sendJson(res, 200, {
        ok: true,
        service: "spatial-ops-otlp-collector",
        host,
        port: boundPort,
        demoMode,
        endpoint: `http://localhost:${boundPort}/v1/traces`,
        ...store.getStats(),
      });
      return;
    }

    if (method === "GET" && pathname === "/api/snapshot") {
      sendJson(res, 200, store.buildSnapshot(), {
        "X-Spatial-Demo-Mode": demoMode ? "1" : "0",
      });
      return;
    }

    if (method === "GET" && pathname === "/api/traces") {
      const limit = Number(parsedUrl.searchParams.get("limit") ?? "25");
      sendJson(res, 200, {
        traces: store.getRecentTraces(
          Number.isFinite(limit) && limit > 0 ? Math.min(100, limit) : 25
        ),
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/traces/")) {
      const traceId = decodeURIComponent(pathname.slice("/api/traces/".length));
      const trace = store.getTrace(traceId);
      if (!trace) {
        sendJson(res, 404, { error: `Trace "${traceId}" not found` });
        return;
      }
      sendJson(res, 200, { trace });
      return;
    }

    if (method === "GET" && pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(
        `event: snapshot\ndata: ${JSON.stringify(store.buildSnapshot())}\n\n`
      );
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    if (method === "POST" && pathname === "/v1/traces") {
      const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/x-protobuf")) {
        sendJson(res, 415, {
          error:
            "Unsupported Media Type: application/x-protobuf. Configure OTEL_EXPORTER_OTLP_PROTOCOL=http/json to send OTLP JSON spans to this local receiver.",
        });
        return;
      }

      try {
        let rawBuf = await readRequestBuffer(req, maxBodyBytes);
        const encoding = String(req.headers["content-encoding"] ?? "").toLowerCase();
        if (encoding.includes("gzip")) {
          try {
            rawBuf = gunzipSync(rawBuf);
          } catch {
            sendJson(res, 400, { error: "Invalid gzip-compressed OTLP request body" });
            return;
          }
        }

        const text = rawBuf.toString("utf8").trim();
        if (!text) {
          sendJson(res, 400, { error: "Empty OTLP /v1/traces request body" });
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          sendJson(res, 400, { error: "Invalid JSON in OTLP /v1/traces request body" });
          return;
        }

        const nowMs = Date.now();
        const stats = store.ingestOtlpPayload(payload, nowMs);

        if (dataFile && stats.acceptedSpans > 0) {
          persistNdjsonLine(dataFile, { receivedAtMs: nowMs, payload });
        }

        broadcastSnapshot();

        // Standard OTLP/HTTP ExportTraceServiceResponse JSON
        sendJson(res, 200, {
          partialSuccess:
            stats.rejectedSpans > 0
              ? { rejectedSpans: stats.rejectedSpans }
              : {},
        });
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendJson(res, 413, { error: err.message });
          return;
        }
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Collector ingestion error",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/demo/trace") {
      try {
        const buf = await readRequestBuffer(req, 64 * 1024);
        let faulty = false;
        if (buf.length > 0) {
          try {
            const parsed = JSON.parse(buf.toString("utf8")) as { faulty?: boolean };
            faulty = Boolean(parsed?.faulty);
          } catch {
            faulty = parsedUrl.searchParams.get("faulty") === "1";
          }
        } else {
          faulty = parsedUrl.searchParams.get("faulty") === "1";
        }
        const nowMs = Date.now();
        const samplePayload = createSampleOtlpRequest({ faulty, nowMs });
        const stats = store.ingestOtlpPayload(samplePayload, nowMs);
        if (dataFile && stats.acceptedSpans > 0) {
          persistNdjsonLine(dataFile, { receivedAtMs: nowMs, payload: samplePayload });
        }
        const snapshot = broadcastSnapshot();
        sendJson(res, 200, { ok: true, stats, snapshot });
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Failed to emit sample trace",
        });
      }
      return;
    }

    if (method === "POST" && pathname === "/api/reset") {
      store.clear();
      if (dataFile) {
        try {
          ensureParentDir(dataFile);
          fs.writeFileSync(dataFile, "", "utf8");
        } catch {
          // ignore
        }
      }
      const snapshot = broadcastSnapshot();
      sendJson(res, 200, { ok: true, snapshot });
      return;
    }

    sendJson(res, 404, { error: `Not found: ${method} ${pathname}` });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err);
    server.once("error", onError);
    server.listen(requestedPort, host, () => {
      server.removeListener("error", onError);
      resolve();
    });
  });

  const addr = server.address();
  const actualPort = addr && typeof addr === "object" ? addr.port : requestedPort;

  const close = async (): Promise<void> => {
    clearInterval(heartbeatInterval);
    for (const client of sseClients) {
      if (!client.writableEnded) {
        client.end();
      }
    }
    sseClients.clear();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return {
    server,
    host,
    port: actualPort,
    url: `http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}`,
    demoMode,
    store,
    close,
  };
}
