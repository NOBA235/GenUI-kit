import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSONUIProvider } from "@json-render/react";
import {
  createTelemetryTracker,
  createTimeTravelStateStore,
  SafeGenUIRenderer,
} from "@genui-studio/core";
import { finopsVerifiedCatalog } from "../catalog/finops-catalog.js";
import {
  createFinOpsRegistry,
  FinOpsRuntimeContext,
} from "../catalog/finops-registry.js";
import { createInitialFinOpsState } from "../data/ledger-seed.js";

describe("Feature 2: PaymentTraceInspector Verified Catalog Component", () => {
  it("renders distributed payment gateway trace spans, decline codes, and failover button through SafeGenUIRenderer", () => {
    const tracker = createTelemetryTracker();
    const { safeRegistry } = createFinOpsRegistry(tracker);
    const store = createTimeTravelStateStore(
      createInitialFinOpsState() as unknown as Record<string, unknown>
    );

    const spec = {
      root: "trace-root",
      elements: {
        "trace-root": {
          type: "PaymentTraceInspector",
          props: {
            title: "EMEA 3DS2 Gateway Outage Trace — Aether Cloud Systems",
            traceId: "tr_pay_eu_9001",
            accountId: "acct_1001",
            invoiceId: "in_eu_9001",
            gateway: "STRIPE_PRIMARY",
            recommendedGateway: "STRIPE_EU_FALLBACK",
            totalDurationMs: 1689,
            recommendedAction:
              "Fail over to STRIPE_EU_FALLBACK and replay failed webhook wh_3001.",
            spans: [
              {
                spanId: "sp_1",
                stepName: "POST /v1/charges/renewal",
                gatewayService: "edge-webhook-router",
                startOffsetMs: 0,
                durationMs: 12,
                status: "OK",
                detailMessage: "Webhook authenticated",
              },
              {
                spanId: "sp_3",
                stepName: "PSD2 / 3DS2 ACS Auth Challenge",
                gatewayService: "3ds2-acs-directory",
                startOffsetMs: 39,
                durationMs: 1632,
                status: "ERROR",
                errorCode: "three_d_secure_timeout",
                detailMessage: "ACS directory timed out (>1500ms SLA)",
              },
            ],
          },
          children: [],
        },
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(
        FinOpsRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec,
            registry: safeRegistry,
            catalog: finopsVerifiedCatalog,
            telemetryTracker: tracker,
          })
        )
      )
    );

    expect(html).toContain('data-testid="payment-trace-inspector"');
    expect(html).toContain("FAILURE TRACE");
    expect(html).toContain("tr_pay_eu_9001");
    expect(html).toContain("STRIPE_PRIMARY");
    expect(html).toContain("STRIPE_EU_FALLBACK");
    expect(html).toContain("three_d_secure_timeout");
    expect(html).toContain("1632ms");
    expect(html).toContain('data-testid="payment-trace-failover-btn"');
  });

  it("self-heals out-of-bounds and invalid enum props on PaymentTraceInspector and quarantines corrupted structure without crashing", () => {
    const tracker = createTelemetryTracker();
    const { safeRegistry } = createFinOpsRegistry(tracker);
    const store = createTimeTravelStateStore(
      createInitialFinOpsState() as unknown as Record<string, unknown>
    );

    const healableSpec = {
      root: "healable-trace",
      elements: {
        "healable-trace": {
          type: "PaymentTraceInspector",
          props: {
            title: "Healed Trace Test",
            traceId: "tr_heal_1",
            accountId: "acct_1001",
            invoiceId: "in_eu_9001",
            gateway: "UNKNOWN_PROCESSOR",
            recommendedGateway: "STRIPE_EU_FALLBACK",
            totalDurationMs: -999,
            recommendedAction: "Switch to STRIPE_EU_FALLBACK.",
            spans: [
              {
                spanId: "sp_1",
                stepName: "PSD2 / 3DS2 ACS Auth Challenge",
                gatewayService: "3ds2-acs-directory",
                startOffsetMs: 0,
                durationMs: 1620,
                status: "ERROR",
                errorCode: "three_d_secure_timeout",
              },
            ],
          },
          children: [],
        },
      },
    };

    const healedHtml = renderToStaticMarkup(
      React.createElement(
        FinOpsRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: healableSpec,
            registry: safeRegistry,
            catalog: finopsVerifiedCatalog,
            telemetryTracker: tracker,
          })
        )
      )
    );

    expect(healedHtml).toContain("Healed Trace Test");
    expect(healedHtml).toContain("STRIPE_PRIMARY");
    expect(healedHtml).toContain("three_d_secure_timeout");
    expect(tracker.getSnapshot().healedPropsCount).toBeGreaterThanOrEqual(1);

    // Structural corruption (non-array spans) must quarantine safely without throwing
    const brokenSpec = {
      root: "broken-trace",
      elements: {
        "broken-trace": {
          type: "PaymentTraceInspector",
          props: {
            spans: "invalid-not-an-array",
          },
          children: [],
        },
      },
    };

    const quarantinedHtml = renderToStaticMarkup(
      React.createElement(
        FinOpsRuntimeContext.Provider,
        { value: { timeTravelStore: store } },
        React.createElement(
          JSONUIProvider,
          { registry: safeRegistry, store, children: null },
          React.createElement(SafeGenUIRenderer, {
            spec: brokenSpec,
            registry: safeRegistry,
            catalog: finopsVerifiedCatalog,
            telemetryTracker: tracker,
          })
        )
      )
    );

    expect(quarantinedHtml).toContain('data-genui-fault-card="true"');
    expect(quarantinedHtml).toContain("NODE QUARANTINED");
  });
});
