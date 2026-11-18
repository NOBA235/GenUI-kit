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
  /**
   * Explicit opt-in required to bind to non-loopback interfaces (e.g. `0.0.0.0`).
   * Can also be set via `SPATIAL_OPS_ALLOW_REMOTE=1`. Defaults to false.
   */
  allowRemote?: boolean;
  /**
   * Optional Bearer token required for mutating endpoints (`POST /v1/*`, `POST /api/reset`,
   * `POST /api/demo/trace`). Can also be set via `SPATIAL_OPS_AUTH_TOKEN`.
   */
  authToken?: string;
  /**
   * Optional allowlist of browser `Origin` headers beyond loopback (`localhost`, `127.0.0.1`, `[::1]`).
   */
  allowedOrigins?: readonly string[];
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

const LOOPBACK_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const normalized = remoteAddress.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

export function resolveCorsOrigin(
  req: IncomingMessage,
  allowedOrigins?: readonly string[]
): string {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim().length > 0) {
    const candidate = originHeader.trim();
    if (
      LOOPBACK_ORIGIN_PATTERN.test(candidate) ||
      (allowedOrigins && allowedOrigins.includes(candidate))
    ) {
      return candidate;
    }
  }
  return "http://localhost:5174";
}

function checkMutatingRequestAccess(
  req: IncomingMessage,
  authToken: string | undefined,
  requireLoopbackWithoutToken: boolean
): { ok: true } | { ok: false; statusCode: number; error: string } {
  if (authToken) {
    const header = String(req.headers.authorization ?? "").trim();
    if (header !== `Bearer ${authToken}`) {
      return {
        ok: false,
        statusCode: 401,
        error:
          "Unauthorized: valid Authorization Bearer token required (SPATIAL_OPS_AUTH_TOKEN).",
      };
    }
    return { ok: true };
  }

  if (
    requireLoopbackWithoutToken &&
    !isLoopbackRemoteAddress(req.socket?.remoteAddress)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error:
        "Forbidden: control endpoints are restricted to loopback connections unless SPATIAL_OPS_AUTH_TOKEN is configured.",
    };
  }

  return { ok: true };
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
  corsOrigin = "http://localhost:5174"
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    Vary: "Origin",
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
        req.resume();
        reject(new PayloadTooLargeError(maxBytes));
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

/**
 * Environment variable that overrides the snapshot path. The MCP server's
 * `getDefaultOtlpSnapshotPath()` (packages/genui-mcp) reads the same variable,
 * so writer and reader always agree.
 */
export const OTLP_SNAPSHOT_ENV_VAR = "SPATIAL_OPS_OTLP_SNAPSHOT";

export function getDefaultOtlpStoragePaths(): {
  dataFile: string;
  snapshotFile: string;
} {
  const dir = path.join(os.homedir(), ".spatial-ops");
  const snapshotOverride = process.env[OTLP_SNAPSHOT_ENV_VAR]?.trim();
  return {
    dataFile: path.join(dir, "otlp-traces.ndjson"),
    snapshotFile: snapshotOverride || path.join(dir, "otlp-snapshot.json"),
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
          kind?: "traces" | "logs" | "metrics";
          receivedAtMs?: number;
          payload?: unknown;
        };
        if (parsed && parsed.payload) {
          const ts =
            typeof parsed.receivedAtMs === "number"
              ? parsed.receivedAtMs
              : Date.now();
          if (parsed.kind === "logs") {
            store.ingestOtlpLogsPayload(parsed.payload, ts);
          } else if (parsed.kind === "metrics") {
            store.ingestOtlpMetricsPayload(parsed.payload, ts);
          } else {
            store.ingestOtlpPayload(parsed.payload, ts);
          }
        }
      } catch {
        // Skip malformed historical line safely
      }
    }
  } catch {
    // Best-effort local persistence hydration
  }
}

async function parseOtlpHttpJsonBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  endpointPath: string,
  maxBodyBytes: number,
  corsOrigin: string
): Promise<unknown | null> {
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("application/x-protobuf")) {
    sendJson(
      res,
      415,
      {
        error:
          "Unsupported Media Type: application/x-protobuf. Configure OTEL_EXPORTER_OTLP_PROTOCOL=http/json to send OTLP JSON payloads to this local receiver.",
      },
      undefined,
      corsOrigin
    );
    return null;
  }

  let rawBuf = await readRequestBuffer(req, maxBodyBytes);
  const encoding = String(req.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding.includes("gzip")) {
    try {
      rawBuf = gunzipSync(rawBuf, { maxOutputLength: maxBodyBytes });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "ERR_BUFFER_TOO_LARGE") {
        throw new PayloadTooLargeError(maxBodyBytes);
      }
      sendJson(
        res,
        400,
        { error: "Invalid gzip-compressed OTLP request body" },
        undefined,
        corsOrigin
      );
      return null;
    }
  }

  const text = rawBuf.toString("utf8").trim();
  if (!text) {
    sendJson(
      res,
      400,
      { error: `Empty OTLP ${endpointPath} request body` },
      undefined,
      corsOrigin
    );
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    sendJson(
      res,
      400,
      {
        error: `Invalid JSON in OTLP ${endpointPath} request body`,
      },
      undefined,
      corsOrigin
    );
    return null;
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
  const allowRemote =
    options.allowRemote ?? process.env.SPATIAL_OPS_ALLOW_REMOTE === "1";
  const authToken =
    (options.authToken ?? process.env.SPATIAL_OPS_AUTH_TOKEN ?? "").trim() ||
    undefined;
  const allowedOrigins = options.allowedOrigins;

  if (!isLoopbackHost(host) && !allowRemote) {
    throw new Error(
      `Refusing to bind SpatialOps OTLP collector to non-loopback host "${host}" without explicit opt-in (pass allowRemote: true, --allow-remote, or SPATIAL_OPS_ALLOW_REMOTE=1).`
    );
  }

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
    const corsOrigin = resolveCorsOrigin(req, allowedOrigins);

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": corsOrigin,
        Vary: "Origin",
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
      sendJson(
        res,
        200,
        {
          ok: true,
          service: "spatial-ops-otlp-collector",
          host,
          port: boundPort,
          demoMode,
          endpoint: `http://localhost:${boundPort}/v1/traces`,
          endpoints: {
            traces: `http://localhost:${boundPort}/v1/traces`,
            logs: `http://localhost:${boundPort}/v1/logs`,
            metrics: `http://localhost:${boundPort}/v1/metrics`,
          },
          ...store.getStats(),
        },
        undefined,
        corsOrigin
      );
      return;
    }

    if (method === "GET" && pathname === "/api/snapshot") {
      sendJson(
        res,
        200,
        store.buildSnapshot(),
        {
          "X-Spatial-Demo-Mode": demoMode ? "1" : "0",
        },
        corsOrigin
      );
      return;
    }

    if (method === "GET" && pathname === "/api/traces") {
      const limit = Number(parsedUrl.searchParams.get("limit") ?? "25");
      sendJson(
        res,
        200,
        {
          traces: store.getRecentTraces(
            Number.isFinite(limit) && limit > 0 ? Math.min(100, limit) : 25
          ),
        },
        undefined,
        corsOrigin
      );
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/traces/")) {
      const traceId = decodeURIComponent(pathname.slice("/api/traces/".length));
      const trace = store.getTrace(traceId);
      if (!trace) {
        sendJson(
          res,
          404,
          { error: `Trace "${traceId}" not found` },
          undefined,
          corsOrigin
        );
        return;
      }
      sendJson(res, 200, { trace }, undefined, corsOrigin);
      return;
    }

    if (method === "GET" && pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": corsOrigin,
        Vary: "Origin",
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

    if (
      method === "POST" &&
      (pathname === "/v1/traces" ||
        pathname === "/v1/logs" ||
        pathname === "/v1/metrics")
    ) {
      const access = checkMutatingRequestAccess(req, authToken, false);
      if (!access.ok) {
        req.resume();
        sendJson(res, access.statusCode, { error: access.error }, undefined, corsOrigin);
        return;
      }
      try {
        const payload = await parseOtlpHttpJsonBody(
          req,
          res,
          pathname,
          maxBodyBytes,
          corsOrigin
        );
        if (payload === null) {
          return;
        }

        const nowMs = Date.now();
        if (pathname === "/v1/logs") {
          const stats = store.ingestOtlpLogsPayload(payload, nowMs);
          if (dataFile && stats.acceptedLogs > 0) {
            persistNdjsonLine(dataFile, {
              kind: "logs",
              receivedAtMs: nowMs,
              payload,
            });
          }
          broadcastSnapshot();
          sendJson(
            res,
            200,
            {
              partialSuccess:
                stats.rejectedLogs > 0
                  ? { rejectedLogRecords: stats.rejectedLogs }
                  : {},
            },
            undefined,
            corsOrigin
          );
          return;
        }

        if (pathname === "/v1/metrics") {
          const stats = store.ingestOtlpMetricsPayload(payload, nowMs);
          if (dataFile && stats.acceptedMetrics > 0) {
            persistNdjsonLine(dataFile, {
              kind: "metrics",
              receivedAtMs: nowMs,
              payload,
            });
          }
          broadcastSnapshot();
          sendJson(
            res,
            200,
            {
              partialSuccess:
                stats.rejectedMetrics > 0
                  ? { rejectedDataPoints: stats.rejectedMetrics }
                  : {},
            },
            undefined,
            corsOrigin
          );
          return;
        }

        const stats = store.ingestOtlpPayload(payload, nowMs);
        if (dataFile && stats.acceptedSpans > 0) {
          persistNdjsonLine(dataFile, {
            kind: "traces",
            receivedAtMs: nowMs,
            payload,
          });
        }
        broadcastSnapshot();

        // Standard OTLP/HTTP ExportTraceServiceResponse JSON
        sendJson(
          res,
          200,
          {
            partialSuccess:
              stats.rejectedSpans > 0
                ? { rejectedSpans: stats.rejectedSpans }
                : {},
          },
          undefined,
          corsOrigin
        );
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendJson(res, 413, { error: err.message }, undefined, corsOrigin);
          return;
        }
        sendJson(
          res,
          500,
          {
            error: err instanceof Error ? err.message : "Collector ingestion error",
          },
          undefined,
          corsOrigin
        );
      }
      return;
    }

    if (method === "POST" && pathname === "/api/demo/trace") {
      const access = checkMutatingRequestAccess(req, authToken, true);
      if (!access.ok) {
        sendJson(res, access.statusCode, { error: access.error }, undefined, corsOrigin);
        return;
      }
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
        sendJson(res, 200, { ok: true, stats, snapshot }, undefined, corsOrigin);
      } catch (err) {
        sendJson(
          res,
          500,
          {
            error: err instanceof Error ? err.message : "Failed to emit sample trace",
          },
          undefined,
          corsOrigin
        );
      }
      return;
    }

    if (method === "POST" && pathname === "/api/reset") {
      const access = checkMutatingRequestAccess(req, authToken, true);
      if (!access.ok) {
        sendJson(res, access.statusCode, { error: access.error }, undefined, corsOrigin);
        return;
      }
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
      sendJson(res, 200, { ok: true, snapshot }, undefined, corsOrigin);
      return;
    }

    sendJson(
      res,
      404,
      { error: `Not found: ${method} ${pathname}` },
      undefined,
      corsOrigin
    );
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
