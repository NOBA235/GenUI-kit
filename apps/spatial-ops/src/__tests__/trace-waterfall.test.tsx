import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSONUIProvider } from "@json-render/react";
import {
  createTelemetryTracker,
  createTimeTravelStateStore,
  SafeGenUIRenderer,
} from "@genui-studio/core";
import { spatialVerifiedCatalog } from "../catalog/spatial-catalog.js";
import { createSpatialRegistry } from "../catalog/spatial-registry.js";
import type { Spec } from "@json-render/core";

describe("TraceWaterfallViewer Component", () => {
  const telemetry = createTelemetryTracker();
  const { safeRegistry } = createSpatialRegistry(telemetry);
  const store = createTimeTravelStateStore({});

  const spec: Spec = {
    root: "trace-viewer-root",
    elements: {
      "trace-viewer-root": {
        type: "TraceWaterfallViewer",
        props: {
          title: "Checkout Request Trace",
          traceId: "tr-998877",
          rootSpanName: "POST /api/v2/checkout",
          totalDurationMs: 1860,
          spans: [
            {
              spanId: "sp-1",
              parentSpanId: null,
              serviceName: "Edge Ingress",
              serviceId: "srv-ingress",
              operation: "POST /api/v2/checkout",
              startOffsetMs: 0,
              durationMs: 1860,
              status: "ERROR",
              statusMessage: "504 Gateway Timeout",
            },
            {
              spanId: "sp-2",
              parentSpanId: "sp-1",
              serviceName: "Postgres Aurora",
              serviceId: "srv-payment-db",
              operation: "pg_pool.acquire",
              startOffsetMs: 20,
              durationMs: 1820,
              status: "ERROR",
              statusMessage: "FATAL: connection pool exhausted (max_connections=100 reached)",
              attributes: {
                "db.system": "postgresql",
                "db.statement": "SELECT * FROM customer_ledgers WHERE account_id = $1",
              },
            },
          ],
          highlightServiceId: "srv-payment-db",
        },
      },
    },
  };

  it("renders trace waterfall with timeline, spans, and attributes via SafeGenUIRenderer", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        JSONUIProvider,
        { registry: safeRegistry, store, children: null },
        React.createElement(SafeGenUIRenderer, {
          spec,
          registry: safeRegistry,
          catalog: spatialVerifiedCatalog,
          telemetryTracker: telemetry,
        })
      )
    );

    expect(markup).toContain("data-testid=\"trace-waterfall-viewer\"");
    expect(markup).toContain("Checkout Request Trace");
    expect(markup).toContain("POST /api/v2/checkout");
    expect(markup).toContain("1,860 ms");
    expect(markup).toContain("Postgres Aurora");
    expect(markup).toContain("pg_pool.acquire");
    expect(markup).toContain("FATAL: connection pool exhausted");
    expect(markup).toContain("db.statement");
    expect(markup).toContain("SELECT * FROM customer_ledgers WHERE account_id = $1");
  });
});
