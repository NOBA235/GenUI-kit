import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTimeTravelStateStore,
  TimeTravelStateStore,
} from "@genui-studio/core";
import {
  createInitialFinOpsState,
  CustomerAccount,
  FinOpsMetrics,
  WebhookEventRecord,
} from "../data/ledger-seed.js";
import {
  BillingTelemetryBridge,
  LiveBillingGatewaySimulator,
} from "../billing/index.js";

describe("Feature 1: Live Billing Gateway Simulator & Store Bridge", () => {
  let simulator: LiveBillingGatewaySimulator;
  let bridge: BillingTelemetryBridge;
  let store: TimeTravelStateStore;

  beforeEach(() => {
    simulator = new LiveBillingGatewaySimulator();
    bridge = new BillingTelemetryBridge(simulator);
    store = createTimeTravelStateStore(
      createInitialFinOpsState() as unknown as Record<string, unknown>
    );
    bridge.attachToStore(store, { startInterval: false });
  });

  afterEach(() => {
    bridge.detach();
  });

  it("initializes nominal Stripe/Adyen gateways with low-latency distributed payment traces", () => {
    const snap = bridge.getSnapshot();
    expect(snap.activeGateway).toBe("STRIPE_PRIMARY");
    expect(snap.chaosActive).toBe(false);
    expect(snap.gateways.length).toBe(3);

    const primary = snap.gateways.find((g) => g.gatewayId === "STRIPE_PRIMARY")!;
    expect(primary.status).toBe("NOMINAL");
    expect(primary.successRatePct).toBeGreaterThan(99);
    expect(snap.recentTraces[0]!.spans.length).toBe(4);
    expect(snap.recentTraces[0]!.totalDurationMs).toBeLessThan(200);
  });

  it("injects EU 3DS2 gateway outage chaos and propagates failures into TimeTravelStateStore", () => {
    const initialMetrics = store.get("/ledger/metrics") as FinOpsMetrics;

    const chaosSnap = bridge.injectEu3dsOutage();
    expect(chaosSnap.chaosActive).toBe(true);
    expect(chaosSnap.activeFaultType).toBe("EU_3DS2_GATEWAY_OUTAGE");

    const primary = chaosSnap.gateways.find(
      (g) => g.gatewayId === "STRIPE_PRIMARY"
    )!;
    expect(primary.status).toBe("OUTAGE");
    expect(primary.successRatePct).toBeLessThan(70);
    expect(primary.p95LatencyMs).toBeGreaterThan(1500);

    const latestTrace = chaosSnap.recentTraces[0]!;
    expect(latestTrace.status).toBe("FAILED");
    expect(latestTrace.failureCode).toBe("three_d_secure_timeout");
    expect(latestTrace.spans.some((s) => s.status === "ERROR")).toBe(true);

    const storeWebhooks = store.get("/ledger/webhooks") as WebhookEventRecord[];
    expect(storeWebhooks[0]!.status).toBe("FAILED");

    const updatedMetrics = store.get("/ledger/metrics") as FinOpsMetrics;
    expect(updatedMetrics.failedChargesTotal).toBeGreaterThan(
      initialMetrics.failedChargesTotal
    );
  });

  it("ingests raw Stripe-format JSON webhook payloads and parses gateway decline traces", () => {
    const rawStripeJson = JSON.stringify({
      id: "evt_live_3ds_timeout_99",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_eu_custom_99",
          customer: "acct_1005",
          customer_name: "Linearity Cloud Systems #5",
          amount_due: 1640000,
          failure_code: "three_d_secure_timeout",
          failure_message: "Issuer ACS timeout after 1,680ms on EU PSD2 rail",
          attempt_count: 3,
          region: "EMEA",
        },
      },
    });

    const ingested = bridge.ingestCustomWebhookJson(rawStripeJson);
    expect(ingested.webhook.id).toBe("evt_live_3ds_timeout_99");
    expect(ingested.webhook.status).toBe("FAILED");
    expect(ingested.triggersOutage).toBe(true);

    const storeWebhooks = store.get("/ledger/webhooks") as WebhookEventRecord[];
    expect(storeWebhooks[0]!.id).toBe("evt_live_3ds_timeout_99");

    const acct = (store.get("/ledger/accounts") as CustomerAccount[]).find(
      (a) => a.id === "acct_1005"
    )!;
    expect(acct.status).toBe("PAST_DUE");
    expect(acct.lastInvoiceStatus).toBe("FAILED");
  });

  it("fails over to STRIPE_EU_FALLBACK, replays webhooks, and restores nominal settlement health", () => {
    bridge.injectEu3dsOutage();
    simulator.tick();

    const result = bridge.failoverAndRecover("STRIPE_EU_FALLBACK", "acct_1001");
    expect(result.success).toBe(true);
    expect(result.targetGateway).toBe("STRIPE_EU_FALLBACK");
    expect(result.replayedWebhooksCount).toBeGreaterThanOrEqual(1);
    expect(result.newSuccessRatePct).toBeGreaterThan(99);

    const postSnap = bridge.getSnapshot();
    expect(postSnap.chaosActive).toBe(false);
    expect(postSnap.activeGateway).toBe("STRIPE_EU_FALLBACK");
    expect(postSnap.recentTraces[0]!.status).toBe("RECOVERED");
    expect(postSnap.recentTraces[0]!.totalDurationMs).toBeLessThan(200);

    const storeWebhooks = store.get("/ledger/webhooks") as WebhookEventRecord[];
    expect(storeWebhooks.every((w) => w.status === "DELIVERED")).toBe(true);
  });

  it("handles operator retry mutations via handleOperatorMutation to recover the live gateway", () => {
    bridge.injectEu3dsOutage();
    expect(bridge.getSnapshot().chaosActive).toBe(true);

    const res = bridge.handleOperatorMutation({
      id: "aud_op_1",
      timestamp: new Date().toISOString(),
      actionType: "RETRY_FAILED_WEBHOOK",
      accountId: "acct_1001",
      companyName: "Aether Cloud Systems (EMEA Flagship)",
      summary: "Retried failed invoice webhook via STRIPE_EU_FALLBACK",
      mrrDeltaCents: 1850000,
      operator: "operator@finops",
    });

    expect(res).not.toBeNull();
    expect(res!.targetGateway).toBe("STRIPE_EU_FALLBACK");
    expect(bridge.getSnapshot().chaosActive).toBe(false);
    expect(bridge.getSnapshot().activeGateway).toBe("STRIPE_EU_FALLBACK");
  });
});
