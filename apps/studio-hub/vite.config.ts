import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LLM_BASE_URL = "https://api.aitklabs.in/v1";
const DEFAULT_LLM_MODEL = "auto:fast";
const MAX_PROXY_BODY_BYTES = 512 * 1024;

function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1")
    );
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      totalBytes += buf.byteLength;
      if (totalBytes > maxBytes) {
        reject(new Error(`Request body exceeded ${maxBytes} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", (err) => reject(err));
  });
}

function createGenuiArchitectProxyPlugin(env: Record<string, string>): Plugin {
  const apiKey = (env.GENUI_LLM_API_KEY ?? process.env.GENUI_LLM_API_KEY ?? "").trim();
  const baseUrl = (
    env.GENUI_LLM_BASE_URL ??
    process.env.GENUI_LLM_BASE_URL ??
    DEFAULT_LLM_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
  const defaultModel = (
    env.GENUI_LLM_MODEL ??
    process.env.GENUI_LLM_MODEL ??
    DEFAULT_LLM_MODEL
  ).trim();

  const proxyConfigured = apiKey.length > 0 || isLocalhostUrl(baseUrl);

  return {
    name: "genui-architect-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/architect/status", (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        sendJson(res, 200, {
          proxyConfigured,
          baseUrl,
          defaultModel,
        });
      });

      server.middlewares.use("/api/architect/stream", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        if (!proxyConfigured) {
          sendJson(res, 503, {
            code: "LLM_NOT_CONFIGURED",
            error:
              "Server-side LLM proxy is not configured. Set GENUI_LLM_API_KEY in .env.local (e.g. Yantra AI yk_live_...) or configure an endpoint in the workbench.",
          });
          return;
        }

        let rawBody: string;
        try {
          rawBody = await readRequestBody(req, MAX_PROXY_BODY_BYTES);
        } catch (err) {
          sendJson(res, 413, {
            code: "PAYLOAD_TOO_LARGE",
            error: err instanceof Error ? err.message : "Failed to read request body.",
          });
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          const candidate = JSON.parse(rawBody) as unknown;
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            sendJson(res, 400, {
              code: "INVALID_BODY",
              error: "Expected JSON object body.",
            });
            return;
          }
          parsed = candidate as Record<string, unknown>;
        } catch {
          sendJson(res, 400, {
            code: "INVALID_JSON",
            error: "Request body is not valid JSON.",
          });
          return;
        }

        if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
          sendJson(res, 400, {
            code: "MISSING_MESSAGES",
            error: "Request body must include a non-empty messages array.",
          });
          return;
        }

        const requestedModel =
          typeof parsed.model === "string" && parsed.model.trim().length > 0
            ? parsed.model.trim()
            : defaultModel;
        const temperature =
          typeof parsed.temperature === "number" && Number.isFinite(parsed.temperature)
            ? Math.max(0, Math.min(2, parsed.temperature))
            : 0.2;

        const upstreamController = new AbortController();
        const abortUpstream = () => {
          if (!upstreamController.signal.aborted) {
            upstreamController.abort();
          }
        };
        req.on("close", abortUpstream);
        res.on("close", abortUpstream);

        try {
          const upstreamHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          };
          if (apiKey.length > 0) {
            upstreamHeaders.Authorization = `Bearer ${apiKey}`;
          }

          const upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: upstreamHeaders,
            body: JSON.stringify({
              model: requestedModel,
              messages: parsed.messages,
              stream: true,
              temperature,
            }),
            signal: upstreamController.signal,
          });

          if (!upstreamResponse.ok || !upstreamResponse.body) {
            const errText = await upstreamResponse.text().catch(() => "");
            sendJson(res, upstreamResponse.status || 502, {
              code: "UPSTREAM_ERROR",
              error:
                errText.slice(0, 400) ||
                `Upstream LLM returned HTTP ${upstreamResponse.status}.`,
            });
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-transform");
          res.setHeader("Connection", "keep-alive");

          const reader = upstreamResponse.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0 && !res.writableEnded) {
              res.write(Buffer.from(value));
            }
          }
          if (!res.writableEnded) {
            res.end();
          }
        } catch (err) {
          if (!res.headersSent) {
            sendJson(res, upstreamController.signal.aborted ? 499 : 502, {
              code: upstreamController.signal.aborted
                ? "CLIENT_ABORTED"
                : "UPSTREAM_NETWORK_ERROR",
              error:
                err instanceof Error
                  ? err.message
                  : "Upstream LLM request failed.",
            });
          } else if (!res.writableEnded) {
            res.end();
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const localEnv = loadEnv(mode, __dirname, "");
  const mergedEnv = { ...rootEnv, ...localEnv };

  return {
    plugins: [
      react(),
      tailwindcss(),
      createGenuiArchitectProxyPlugin(mergedEnv),
    ],
    publicDir: path.resolve(__dirname, "../../public"),
    resolve: {
      alias: {
        "@genui-studio/templates": path.resolve(
          __dirname,
          "../../packages/templates/src/index.ts",
        ),
      },
    },
    build: {
      target: "esnext",
    },
  };
});
