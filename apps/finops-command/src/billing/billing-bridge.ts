import {
  CustomerAccount,
  FinOpsAuditEntry,
  MutableLedgerStoreAdapter,
  recomputeMetricsFromAccounts,
  WebhookEventRecord,
} from "../data/ledger-seed.js";
import { LiveBillingGatewaySimulator } from "./live-billing-gateway.js";
import type {
  BillingTelemetrySnapshot,
  GatewayRemediationResult,
  PaymentGatewayId,
  RawStripeWebhookPayload,
} from "./types.js";

const MAX_STORE_WEBHOOKS = 25;

export class BillingTelemetryBridge {
  public readonly simulator: LiveBillingGatewaySimulator;
  private store: MutableLedgerStoreAdapter | null = null;
  private unsubscribeSimulator: (() => void) | null = null;
  private lastSyncedTraceId: string | null = null;

  constructor(simulator?: LiveBillingGatewaySimulator) {
    this.simulator = simulator ?? new LiveBillingGatewaySimulator();
  }

  public getSnapshot(): BillingTelemetrySnapshot {
    return this.simulator.getSnapshot();
  }

  public subscribe(
    listener: (snapshot: BillingTelemetrySnapshot) => void
  ): () => void {
    return this.simulator.subscribe(listener);
  }

  public attachToStore(
    store: MutableLedgerStoreAdapter,
    options: { startInterval?: boolean; intervalMs?: number } = {}
  ): void {
    this.detach();
    this.store = store;

    // Anchor on the current latest trace so initial attach does not churn the Undo stack.
    const initialSnap = this.simulator.getSnapshot();
    this.lastSyncedTraceId = initialSnap.recentTraces[0]?.traceId ?? null;

    let skipFirstEmission = true;
    this.unsubscribeSimulator = this.simulator.subscribe((snapshot) => {
      if (skipFirstEmission) {
        skipFirstEmission = false;
        return;
      }
      this.syncSnapshotToStore(snapshot);
    });

    if (options.startInterval) {
      this.simulator.startEmitting(options.intervalMs ?? 3800);
    }
  }

  public detach(): void {
    this.simulator.stopEmitting();
    if (this.unsubscribeSimulator) {
      this.unsubscribeSimulator();
      this.unsubscribeSimulator = null;
    }
    this.store = null;
    this.lastSyncedTraceId = null;
  }

  public startLiveStream(intervalMs = 3800): void {
    this.simulator.startEmitting(intervalMs);
  }

  public stopLiveStream(): void {
    this.simulator.stopEmitting();
  }

  public injectEu3dsOutage(): BillingTelemetrySnapshot {
    return this.simulator.injectChaos({
      faultType: "EU_3DS2_GATEWAY_OUTAGE",
      targetGateway: "STRIPE_PRIMARY",
      targetRegion: "EMEA",
      latencyPenaltyMs: 1540,
      failureProbability: 0.92,
    });
  }

  public clearOutage(): BillingTelemetrySnapshot {
    return this.simulator.clearChaos();
  }

  public ingestCustomWebhookJson(
    input: string | RawStripeWebhookPayload
  ): {
    webhook: WebhookEventRecord;
    triggersOutage: boolean;
  } {
    let parsed: RawStripeWebhookPayload;
    if (typeof input === "string") {
      parsed = JSON.parse(input) as RawStripeWebhookPayload;
    } else {
      parsed = input;
    }

    if (!parsed || typeof parsed.type !== "string") {
      throw new Error(
        "Invalid Stripe webhook payload: missing string 'type' field."
      );
    }

    const result = this.simulator.ingestStripeWebhook(parsed);
    return {
      webhook: result.webhook,
      triggersOutage: result.triggersOutage,
    };
  }

  public failoverAndRecover(
    targetGateway: PaymentGatewayId = "STRIPE_EU_FALLBACK",
    accountId = "acct_1001"
  ): GatewayRemediationResult {
    const result = this.simulator.failoverGateway(targetGateway, accountId);
    this.applyGatewayRecoveryToStore(result);
    return result;
  }

  public handleOperatorMutation(
    entry: FinOpsAuditEntry
  ): GatewayRemediationResult | null {
    if (entry.actionType === "RETRY_FAILED_WEBHOOK") {
      const targetGateway: PaymentGatewayId =
        entry.summary.includes("ADYEN")
          ? "ADYEN_BACKUP_MID"
          : "STRIPE_EU_FALLBACK";
      const result = this.simulator.failoverGateway(
        targetGateway,
        entry.accountId
      );
      this.applyGatewayRecoveryToStore(result, false);
      return result;
    }
    return null;
  }

  private syncSnapshotToStore(snapshot: BillingTelemetrySnapshot): void {
    if (!this.store) return;

    const latestTrace = snapshot.recentTraces[0];
    const latestWebhook = snapshot.recentWebhooks[0];
    if (!latestTrace || !latestWebhook) return;
    if (latestTrace.traceId === this.lastSyncedTraceId) return;

    this.lastSyncedTraceId = latestTrace.traceId;

    const existingWebhooks =
      (this.store.get("/ledger/webhooks") as
        | WebhookEventRecord[]
        | undefined) ?? [];

    const dedupedWebhooks = [
      latestWebhook,
      ...existingWebhooks.filter((w) => w.id !== latestWebhook.id),
    ].slice(0, MAX_STORE_WEBHOOKS);

    const accounts =
      (this.store.get("/ledger/accounts") as CustomerAccount[] | undefined) ??
      [];
    let accountsChanged = false;

    const updatedAccounts = accounts.map((acct) => {
      if (acct.id !== latestWebhook.accountId) {
        return acct;
      }
      if (latestWebhook.status === "FAILED") {
        accountsChanged = true;
        const isDispute =
          latestWebhook.eventType === "charge.dispute.created";
        return {
          ...acct,
          status: isDispute ? ("DISPUTED" as const) : ("PAST_DUE" as const),
          healthScore: Math.max(20, acct.healthScore - 18),
          failedChargesCount: acct.failedChargesCount + 1,
          disputedAmountCents: isDispute
            ? acct.disputedAmountCents + latestWebhook.amountCents
            : acct.disputedAmountCents,
          lastInvoiceStatus: isDispute
            ? ("DISPUTED" as const)
            : ("FAILED" as const),
        };
      }
      return acct;
    });

    const updates: Record<string, unknown> = {
      "/ledger/webhooks": dedupedWebhooks,
    };
    if (accountsChanged) {
      updates["/ledger/accounts"] = updatedAccounts;
      updates["/ledger/metrics"] =
        recomputeMetricsFromAccounts(updatedAccounts);
    }

    this.commitUpdates(updates);
  }

  private applyGatewayRecoveryToStore(
    result: GatewayRemediationResult,
    appendAudit = true
  ): void {
    if (!this.store) return;

    const webhooks =
      (this.store.get("/ledger/webhooks") as
        | WebhookEventRecord[]
        | undefined) ?? [];
    const accounts =
      (this.store.get("/ledger/accounts") as CustomerAccount[] | undefined) ??
      [];
    const auditLog =
      (this.store.get("/ledger/auditLog") as FinOpsAuditEntry[] | undefined) ??
      [];

    const recoveredAccountIds = new Set<string>();
    const updatedWebhooks = webhooks.map((wh) => {
      if (wh.status !== "DELIVERED") {
        recoveredAccountIds.add(wh.accountId);
        return {
          ...wh,
          status: "DELIVERED" as const,
          failureReason: `Replayed & settled cleanly via ${result.targetGateway}`,
          attemptCount: wh.attemptCount + 1,
        };
      }
      return wh;
    });

    const updatedAccounts = accounts.map((acct) => {
      if (!recoveredAccountIds.has(acct.id) && acct.status !== "PAST_DUE") {
        return acct;
      }
      if (acct.region !== "EMEA" && !recoveredAccountIds.has(acct.id)) {
        return acct;
      }
      return {
        ...acct,
        status: acct.disputedAmountCents > 0 ? acct.status : ("ACTIVE" as const),
        healthScore: Math.min(95, acct.healthScore + 28),
        failedChargesCount: 0,
        lastInvoiceStatus:
          acct.disputedAmountCents > 0 ? acct.lastInvoiceStatus : ("PAID" as const),
      };
    });

    const updates: Record<string, unknown> = {
      "/ledger/webhooks": updatedWebhooks,
      "/ledger/accounts": updatedAccounts,
      "/ledger/metrics": recomputeMetricsFromAccounts(updatedAccounts),
    };

    if (appendAudit) {
      const entry: FinOpsAuditEntry = {
        id: `audit_gw_${Date.now()}`,
        timestamp: result.timestamp,
        actionType: "RETRY_FAILED_WEBHOOK",
        accountId: "acct_1001",
        companyName: "EMEA Gateway Pool",
        summary: result.message,
        mrrDeltaCents: result.recoveredMrrCents,
        operator: "finops-gateway@genui-studio.io",
      };
      updates["/ledger/auditLog"] = [entry, ...auditLog].slice(0, 30);
    }

    this.commitUpdates(updates);
  }

  private commitUpdates(updates: Record<string, unknown>): void {
    if (!this.store) return;
    if (typeof this.store.update === "function") {
      this.store.update(updates);
      return;
    }
    for (const [path, value] of Object.entries(updates)) {
      this.store.set(path, value);
    }
  }
}

export const billingBridge = new BillingTelemetryBridge();
