#!/usr/bin/env node
/**
 * Zero-dependency OpenTelemetry OTLP/HTTP JSON sample emitter for SpatialOps (:4318).
 *
 * Sends standard OTLP payloads to:
 *   - POST /v1/traces  (ExportTraceServiceRequest)
 *   - POST /v1/logs    (ExportLogsServiceRequest)
 *   - POST /v1/metrics (ExportMetricsServiceRequest)
 *
 * Usage:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node apps/spatial-ops/examples/emit-otlp-sample.mjs
 *   node apps/spatial-ops/examples/emit-otlp-sample.mjs --faulty
 */

import crypto from "node:crypto";

const baseUrl = (
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318"
).replace(/\/+$/, "");
const faulty = process.argv.includes("--faulty");

const traceId = crypto.randomBytes(16).toString("hex");
const spanEdge = crypto.randomBytes(8).toString("hex");
const spanGw = crypto.randomBytes(8).toString("hex");
const spanOrders = crypto.randomBytes(8).toString("hex");
const spanDb = crypto.randomBytes(8).toString("hex");

const nowMs = Date.now();
const ns = (offsetMs) =>
  (BigInt(nowMs) * 1_000_000n + BigInt(Math.round(offsetMs * 1_000_000))).toString();

const totalMs = faulty ? 1840 : 62;

const tracesPayload = {
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "edge-proxy" } },
          { key: "service.version", value: { stringValue: "1.4.2" } },
          { key: "cloud.region", value: { stringValue: "us-east-1" } },
        ],
      },
      scopeSpans: [
        {
          scope: { name: "spatial-ops-example", version: "1.0.0" },
          spans: [
            {
              traceId,
              spanId: spanEdge,
              name: "POST /api/orders",
              kind: 2, // SERVER
              startTimeUnixNano: ns(0),
              endTimeUnixNano: ns(totalMs),
              status: faulty
                ? { code: 2, message: "504 Gateway Timeout waiting for orders-service" }
                : { code: 1 },
              attributes: [
                { key: "http.request.method", value: { stringValue: "POST" } },
                { key: "http.response.status_code", value: { intValue: faulty ? 504 : 201 } },
              ],
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "api-gateway" } },
          { key: "service.version", value: { stringValue: "2.9.0" } },
          { key: "cloud.region", value: { stringValue: "us-east-1" } },
        ],
      },
      scopeSpans: [
        {
          spans: [
            {
              traceId,
              spanId: spanGw,
              parentSpanId: spanEdge,
              name: "gateway.route_order",
              kind: 2,
              startTimeUnixNano: ns(3),
              endTimeUnixNano: ns(totalMs - 2),
              status: faulty ? { code: 2, message: "Upstream RPC timeout" } : { code: 1 },
            },
          ],
        },
      ],
    },
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "orders-service" } },
          { key: "service.version", value: { stringValue: "4.1.0" } },
          { key: "cloud.region", value: { stringValue: "us-east-1" } },
        ],
      },
      scopeSpans: [
        {
          spans: [
            {
              traceId,
              spanId: spanOrders,
              parentSpanId: spanGw,
              name: "orders.persistTransaction",
              kind: 2,
              startTimeUnixNano: ns(8),
              endTimeUnixNano: ns(totalMs - 4),
              status: faulty
                ? { code: 2, message: "PostgreSQL pool acquire timeout (1820ms)" }
                : { code: 1 },
            },
            {
              traceId,
              spanId: spanDb,
              parentSpanId: spanOrders,
              name: "INSERT INTO orders",
              kind: 3, // CLIENT -> virtual DATABASE node
              startTimeUnixNano: ns(11),
              endTimeUnixNano: ns(totalMs - 5),
              status: faulty
                ? { code: 2, message: "FATAL: remaining connection slots are reserved" }
                : { code: 1 },
              attributes: [
                { key: "db.system", value: { stringValue: "postgresql" } },
                { key: "db.name", value: { stringValue: "orders_prod" } },
                {
                  key: "db.statement",
                  value: { stringValue: "INSERT INTO orders (id, total_cents) VALUES ($1, $2)" },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const logsPayload = {
  resourceLogs: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "orders-service" } },
          { key: "service.version", value: { stringValue: "4.1.0" } },
          { key: "cloud.region", value: { stringValue: "us-east-1" } },
        ],
      },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: ns(totalMs - 6),
              severityNumber: faulty ? 21 : 9, // FATAL vs INFO
              severityText: faulty ? "FATAL" : "INFO",
              traceId,
              spanId: spanDb,
              body: {
                stringValue: faulty
                  ? "pg-pool exhausted waiting for checkout lock on orders_prod"
                  : "Committed distributed order transaction successfully",
              },
              attributes: [
                { key: "http.response.status_code", value: { intValue: faulty ? 503 : 201 } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const metricsPayload = {
  resourceMetrics: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "orders-service" } },
          { key: "service.version", value: { stringValue: "4.1.0" } },
          { key: "cloud.region", value: { stringValue: "us-east-1" } },
        ],
      },
      scopeMetrics: [
        {
          metrics: [
            {
              name: "system.cpu.utilization",
              unit: "1",
              gauge: {
                dataPoints: [
                  {
                    timeUnixNano: ns(totalMs),
                    asDouble: faulty ? 0.92 : 0.34,
                  },
                ],
              },
            },
            {
              name: "system.memory.utilization",
              unit: "1",
              gauge: {
                dataPoints: [
                  {
                    timeUnixNano: ns(totalMs),
                    asDouble: faulty ? 0.87 : 0.41,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
};

async function postOtlp(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }
  return text;
}

async function main() {
  console.log(`Posting OTLP ${faulty ? "FAULTY" : "HEALTHY"} telemetry to ${baseUrl}...`);
  console.log(`  Trace ID: ${traceId}`);
  console.log("  /v1/traces  ->", await postOtlp("/v1/traces", tracesPayload));
  console.log("  /v1/logs    ->", await postOtlp("/v1/logs", logsPayload));
  console.log("  /v1/metrics ->", await postOtlp("/v1/metrics", metricsPayload));
  console.log("Open http://localhost:5174 to inspect the live 3D topology & waterfall.");
}

main().catch((err) => {
  console.error("Failed to emit OTLP sample:", err);
  process.exit(1);
});
