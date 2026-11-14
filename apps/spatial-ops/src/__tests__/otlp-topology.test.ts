import http from "node:http";
import { gzipSync } from "node:zlib";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGuardrailedStreamCompiler,
  createTelemetryTracker,
  specToJsonlStream,
} from "@genui-studio/core";
import { App } from "../App.js";
import { spatialVerifiedCatalog } from "../catalog/spatial-catalog.js";
import { LiveServiceMeshSimulator } from "../telemetry/live-service-mesh.js";
import {
  buildDynamicOtlpSpec,
  createSampleOtlpRequest,
  nanoDiffMs,
  OtlpTopologyRingStore,
  parseOtlpTracePayload,
} from "../telemetry/otlp-topology.js";
import {
  startOtlpCollectorServer,
  type RunningOtlpCollector,
} from "../../server/otlp-collector.js";

function requestJson(
  url: string,
  method: "GET" | "POST",
  body?: Buffer | string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: text ? JSON.parse(text) : null,
            });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: text });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("Local OTLP Receiver & Dynamic Topology Builder", () => {
  const activeServers: RunningOtlpCollector[] = [];

  afterEach(async () => {
    while (activeServers.length > 0) {
      const srv = activeServers.pop();
      if (srv) await srv.close();
    }
  });

  it("1. LiveServiceMeshSimulator defaults to idle (no background intervals unless explicitly started)", () => {
    const idleSim = new LiveServiceMeshSimulator();
    // Should have zero history emitted automatically on creation
    expect(idleSim.getTraceHistory()).toHaveLength(0);
    idleSim.stopEmitting();
  });

  it("2. Computes nanosecond timestamp differences without IEEE-754 epoch precision loss", () => {
    const startNs = "1731571200000000000";
    const endNs = "1731571200042500000"; // +42.5ms
    expect(nanoDiffMs(startNs, endNs)).toBe(42.5);

    const badOrder = nanoDiffMs(endNs, startNs);
    expect(badOrder).toBe(0);
  });

  it("3. Dynamically derives nodes, tiers, parentSpanId edges, virtual DB/Broker nodes, and compiles verified 3D Spec", () => {
    const store = new OtlpTopologyRingStore({ maxTraces: 50 });

    // Waiting state has zero hardcoded MESH_SERVICES
    const waitingSnap = store.buildSnapshot();
    expect(waitingSnap.mode).toBe("WAITING");
    expect(Object.keys(waitingSnap.services)).toHaveLength(0);
    expect(waitingSnap.summary.severity).toBe("NOMINAL");

    const baseNs = 1731571200000000000n;
    const ns = (ms: number) => (baseNs + BigInt(ms * 1_000_000)).toString();

    // Batch 1: API Gateway sends CLIENT call to billing-api, plus virtual redis & postgresql calls
    store.ingestOtlpPayload(
      {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "edge-api-gateway" } },
                { key: "service.version", value: { stringValue: "2.4.0" } },
                { key: "cloud.region", value: { stringValue: "eu-west-1" } },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: "tr-live-0001",
                    spanId: "sp-gw-root",
                    name: "POST /checkout",
                    kind: "SPAN_KIND_SERVER",
                    startTimeUnixNano: ns(0),
                    endTimeUnixNano: ns(1850),
                    status: { code: 2, message: "504 Downstream Timeout" },
                    attributes: [
                      { key: "http.response.status_code", value: { intValue: "504" } },
                    ],
                  },
                  {
                    traceId: "tr-live-0001",
                    spanId: "sp-gw-to-billing",
                    parentSpanId: "sp-gw-root",
                    name: "HTTP POST billing-api/charge",
                    kind: 3, // CLIENT
                    startTimeUnixNano: ns(5),
                    endTimeUnixNano: ns(1845),
                    attributes: [
                      { key: "peer.service", value: { stringValue: "billing-api" } },
                    ],
                  },
                  {
                    traceId: "tr-live-0001",
                    spanId: "sp-gw-redis",
                    parentSpanId: "sp-gw-root",
                    name: "GET session:42",
                    kind: 3, // CLIENT -> no child SERVER span -> virtual CACHE node!
                    startTimeUnixNano: ns(2),
                    endTimeUnixNano: ns(6),
                    attributes: [{ key: "db.system", value: { stringValue: "redis" } }],
                  },
                ],
              },
            ],
          },
        ],
      },
      1_731_571_200_000
    );

    // Batch 2: Distributed downstream billing-api arrives separately for the SAME traceId
    store.ingestOtlpPayload(
      {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "billing-api" } },
                { key: "service.version", value: { stringValue: "5.1.0" } },
                { key: "cloud.region", value: { stringValue: "eu-west-1" } },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: "tr-live-0001",
                    spanId: "sp-billing-srv",
                    parentSpanId: "sp-gw-to-billing",
                    name: "chargeCard",
                    kind: 2,
                    startTimeUnixNano: ns(10),
                    endTimeUnixNano: ns(1840),
                    status: { code: 2, message: "DB pool exhausted" },
                  },
                  {
                    traceId: "tr-live-0001",
                    spanId: "sp-billing-pg",
                    parentSpanId: "sp-billing-srv",
                    name: "UPDATE ledger",
                    kind: 3,
                    startTimeUnixNano: ns(15),
                    endTimeUnixNano: ns(1835),
                    status: { code: 2, message: "connection timeout" },
                    attributes: [
                      { key: "db.system", value: { stringValue: "postgresql" } },
                      { key: "db.name", value: { stringValue: "payments" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      1_731_571_201_000
    );

    const liveSnap = store.buildSnapshot();
    expect(liveSnap.mode).toBe("LIVE");
    expect(liveSnap.totalIngestedTraces).toBe(1);
    expect(liveSnap.totalIngestedSpans).toBe(5);

    // Discovered 4 topology nodes: edge-api-gateway, billing-api, redis (CACHE), postgresql-payments (DATABASE)
    expect(liveSnap.services["edge-api-gateway"]?.tier).toBe("GATEWAY");
    expect(liveSnap.services["edge-api-gateway"]?.region).toBe("EU-West");
    expect(liveSnap.services["billing-api"]?.version).toBe("5.1.0");
    expect(liveSnap.services["redis"]?.tier).toBe("CACHE");
    expect(liveSnap.services["postgresql-payments"]?.tier).toBe("DATABASE");
    expect(liveSnap.services["postgresql-payments"]?.status).toBe("CRITICAL_OUTAGE");

    // Verify edges inferred cleanly without duplicate gateway->billing virtual edge
    const edgePairs = liveSnap.edges.map((e) => `${e.from}->${e.to}`);
    expect(edgePairs).toContain("edge-api-gateway->billing-api");
    expect(edgePairs).toContain("edge-api-gateway->redis");
    expect(edgePairs).toContain("billing-api->postgresql-payments");

    // Severity & structured error log extracted automatically
    expect(["SEV-0", "SEV-1"]).toContain(liveSnap.summary.severity);
    expect(liveSnap.logs.length).toBeGreaterThan(0);

    // Dynamically synthesized Spec passes @genui-studio/core compiler with zero healed/rejected issues
    const spec = buildDynamicOtlpSpec(liveSnap);
    const tracker = createTelemetryTracker();
    const compiler = createGuardrailedStreamCompiler({
      catalog: spatialVerifiedCatalog,
      telemetryTracker: tracker,
    });
    compiler.push(specToJsonlStream(spec));
    const compiled = compiler.finalize();

    expect(compiled.spec.root).toBe("warroom-shell-otlp");
    expect(Object.keys(compiled.healedDiagnostics)).toHaveLength(0);
    expect(tracker.getSnapshot().rejectedPropsCount).toBe(0);
    expect(tracker.getSnapshot().healedPropsCount).toBe(0);
  });

  it("4. Bounds ring-buffer traces to maxTraces", () => {
    const store = new OtlpTopologyRingStore({ maxTraces: 10 });
    for (let i = 0; i < 15; i += 1) {
      store.ingestOtlpPayload(
        createSampleOtlpRequest({ traceId: `trace-${i}`, nowMs: 1_700_000_000_000 + i * 1000 })
      );
    }
    expect(store.getStats().activeTraceCount).toBe(10);
    expect(store.getTrace("trace-0")).toBeUndefined();
    expect(store.getTrace("trace-14")).toBeDefined();
  });

  it("5. Starts real local OTLP HTTP/JSON receiver on :0, ingests plain & gzipped /v1/traces, and keeps --demo off by default", async () => {
    const collector = await startOtlpCollectorServer({
      port: 0,
      dataFile: false,
      snapshotFile: false,
    });
    activeServers.push(collector);

    expect(collector.demoMode).toBe(false);

    const healthRes = await requestJson(`${collector.url}/health`, "GET");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.demoMode).toBe(false);
    expect(healthRes.body.totalIngestedTraces).toBe(0);

    // Rejects raw protobuf with clear 415 guidance
    const protoRes = await requestJson(
      `${collector.url}/v1/traces`,
      "POST",
      "binary-protobuf-stub",
      { "Content-Type": "application/x-protobuf" }
    );
    expect(protoRes.status).toBe(415);

    // Accepts plain JSON OTLP trace
    const payload1 = createSampleOtlpRequest({ faulty: false, traceId: "http-tr-1" });
    const ingest1 = await requestJson(
      `${collector.url}/v1/traces`,
      "POST",
      JSON.stringify(payload1),
      { "Content-Type": "application/json" }
    );
    expect(ingest1.status).toBe(200);
    expect(ingest1.body).toEqual({ partialSuccess: {} });

    // Accepts gzipped JSON OTLP trace
    const payload2 = createSampleOtlpRequest({ faulty: true, traceId: "http-tr-2" });
    const gzBody = gzipSync(Buffer.from(JSON.stringify(payload2), "utf8"));
    const ingest2 = await requestJson(`${collector.url}/v1/traces`, "POST", gzBody, {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    });
    expect(ingest2.status).toBe(200);

    const snapRes = await requestJson(`${collector.url}/api/snapshot`, "GET");
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.mode).toBe("LIVE");
    expect(snapRes.body.totalIngestedTraces).toBe(2);
    expect(snapRes.body.services["checkout-service"]).toBeDefined();
    expect(snapRes.body.services["postgresql-orders_prod"]?.tier).toBe("DATABASE");

    const traceRes = await requestJson(`${collector.url}/api/traces/http-tr-2`, "GET");
    expect(traceRes.status).toBe(200);
    expect(traceRes.body.trace.hasError).toBe(true);

    // Reset clears traces back to WAITING
    const resetRes = await requestJson(`${collector.url}/api/reset`, "POST");
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.snapshot.mode).toBe("WAITING");
    expect(resetRes.body.snapshot.totalIngestedTraces).toBe(0);
  });

  it("6. Collector --demo flag explicitly seeds initial OTLP traces only when enabled", async () => {
    const demoCollector = await startOtlpCollectorServer({
      port: 0,
      dataFile: false,
      snapshotFile: false,
      demoMode: true,
    });
    activeServers.push(demoCollector);

    const snapRes = await requestJson(`${demoCollector.url}/api/snapshot`, "GET");
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.mode).toBe("LIVE");
    expect(snapRes.body.totalIngestedTraces).toBe(2);
    expect(Object.keys(snapRes.body.services).length).toBeGreaterThanOrEqual(5);
  });

  it("7. parseOtlpTracePayload safely caps and drops malformed entries", () => {
    expect(parseOtlpTracePayload(null)).toEqual([]);
    expect(parseOtlpTracePayload({ resourceSpans: "invalid" })).toEqual([]);
    const parsed = parseOtlpTracePayload({
      resourceSpans: [
        {
          resource: { attributes: [{ key: "__proto__", value: { stringValue: "evil" } }] },
          scopeSpans: [{ spans: [{ traceId: "t1", spanId: "s1", name: "ok" }] }],
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(parsed[0]!.attributes, "__proto__")).toBe(
      false
    );
  });

  it("8. App renders in Live OTLP default standby mode rather than Demo Simulation mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(App, { instantStreamForTest: true })
    );
    expect(html).toContain("OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318");
    expect(html).toContain("Load Sample Demo");
    expect(html).not.toContain("Demo Scenarios (Simulated):");

    const demoHtml = renderToStaticMarkup(
      React.createElement(App, {
        instantStreamForTest: true,
        initialSourceMode: "demo",
      })
    );
    expect(demoHtml).toContain("Demo Scenarios (Simulated):");
    expect(demoHtml).toContain("Switch to Live OTLP :4318");
  });
});
