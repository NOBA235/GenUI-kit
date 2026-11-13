import type { WebhookEventRecord } from "../data/ledger-seed.js";
import type {
  BillingTelemetrySnapshot,
  GatewayChaosConfig,
  GatewayHealthMetrics,
  GatewayRemediationResult,
  GatewaySpan,
  PaymentAttemptTrace,
  PaymentGatewayId,
  RawStripeWebhookPayload,
} from "./types.js";

const MAX_TRACES = 30;
const MAX_WEBHOOKS = 25;

interface SeedTargetAccount {
  accountId: string;
  companyName: string;
  region: "NA" | "EMEA" | "APAC" | "LATAM";
  amountCents: number;
  invoicePrefix: string;
}

const SAMPLE_ACCOUNTS: SeedTargetAccount[] = [
  {
    accountId: "acct_1001",
    companyName: "Aether Cloud Systems (EMEA Flagship)",
    region: "EMEA",
    amountCents: 1_850_000,
    invoicePrefix: "in_eu_9001",
  },
  {
    accountId: "acct_1002",
    companyName: "Vanguard AI Labs #2",
    region: "EMEA",
    amountCents: 1_420_000,
    invoicePrefix: "in_eu_9002",
  },
  {
    accountId: "acct_1004",
    companyName: "Vanguard Cloud Systems",
    region: "NA",
    amountCents: 2_240_000,
    invoicePrefix: "in_na_9004",
  },
  {
    accountId: "acct_1005",
    companyName: "Linearity Cloud Systems #5",
    region: "EMEA",
    amountCents: 1_640_000,
    invoicePrefix: "in_eu_9005",
  },
  {
    accountId: "acct_1009",
    companyName: "Nexus Cloud Systems #9",
    region: "EMEA",
    amountCents: 1_980_000,
    invoicePrefix: "in_eu_9009",
  },
  {
    accountId: "acct_1012",
    companyName: "Apex Security Corp #12",
    region: "APAC",
    amountCents: 980_000,
    invoicePrefix: "in_ap_9012",
  },
];

function createDefaultGateways(): GatewayHealthMetrics[] {
  return [
    {
      gatewayId: "STRIPE_PRIMARY",
      label: "Stripe Primary (US/EU Connect)",
      region: "GLOBAL",
      status: "NOMINAL",
      successRatePct: 99.6,
      p95LatencyMs: 92,
      failedAttemptsCount: 0,
      activeRoutingWeightPct: 80,
    },
    {
      gatewayId: "STRIPE_EU_FALLBACK",
      label: "Stripe EU PSD2 Fallback MID",
      region: "EMEA",
      status: "NOMINAL",
      successRatePct: 99.8,
      p95LatencyMs: 84,
      failedAttemptsCount: 0,
      activeRoutingWeightPct: 15,
    },
    {
      gatewayId: "ADYEN_BACKUP_MID",
      label: "Adyen Enterprise Backup MID",
      region: "GLOBAL",
      status: "NOMINAL",
      successRatePct: 99.7,
      p95LatencyMs: 96,
      failedAttemptsCount: 0,
      activeRoutingWeightPct: 5,
    },
  ];
}

export class LiveBillingGatewaySimulator {
  private tickCount = 0;
  private activeGateway: PaymentGatewayId = "STRIPE_PRIMARY";
  private chaosConfig: GatewayChaosConfig | null = null;
  private gateways: GatewayHealthMetrics[] = createDefaultGateways();
  private recentTraces: PaymentAttemptTrace[] = [];
  private recentWebhooks: WebhookEventRecord[] = [];
  private listeners = new Set<(snapshot: BillingTelemetrySnapshot) => void>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.tick();
  }

  public getSnapshot(): BillingTelemetrySnapshot {
    return {
      tick: this.tickCount,
      timestamp: new Date().toISOString(),
      activeGateway: this.activeGateway,
      chaosActive: this.chaosConfig !== null,
      activeFaultType: this.chaosConfig?.faultType ?? null,
      gateways: this.gateways.map((g) => ({ ...g })),
      recentTraces: this.recentTraces.map((t) => ({
        ...t,
        spans: t.spans.map((s) => ({ ...s })),
      })),
      recentWebhooks: this.recentWebhooks.map((w) => ({ ...w })),
    };
  }

  public subscribe(
    listener: (snapshot: BillingTelemetrySnapshot) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public startEmitting(intervalMs = 3800): void {
    if (this.intervalHandle !== null) {
      return;
    }
    const clampedInterval = Math.max(1000, intervalMs);
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, clampedInterval);
  }

  public stopEmitting(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  public injectChaos(
    config: Partial<GatewayChaosConfig> = {}
  ): BillingTelemetrySnapshot {
    this.chaosConfig = {
      faultType: config.faultType ?? "EU_3DS2_GATEWAY_OUTAGE",
      targetGateway: config.targetGateway ?? "STRIPE_PRIMARY",
      targetRegion: config.targetRegion ?? "EMEA",
      latencyPenaltyMs: config.latencyPenaltyMs ?? 1540,
      failureProbability: config.failureProbability ?? 0.92,
    };

    this.activeGateway = this.chaosConfig.targetGateway;

    this.gateways = this.gateways.map((gw) => {
      if (gw.gatewayId === this.chaosConfig!.targetGateway) {
        return {
          ...gw,
          status: "OUTAGE",
          successRatePct: 61.4,
          p95LatencyMs: 1680,
          failedAttemptsCount: gw.failedAttemptsCount + 4,
        };
      }
      return gw;
    });

    // Emit immediate failing EMEA trace & failed invoice webhook for crisp telemetry pickup
    const targetAccount = SAMPLE_ACCOUNTS[0]!;
    this.emitAttemptForAccount(targetAccount, true);
    this.notify();
    return this.getSnapshot();
  }

  public clearChaos(): BillingTelemetrySnapshot {
    this.chaosConfig = null;
    this.gateways = createDefaultGateways().map((gw) => ({
      ...gw,
      activeRoutingWeightPct:
        gw.gatewayId === this.activeGateway
          ? 85
          : gw.gatewayId === "STRIPE_EU_FALLBACK"
            ? 10
            : 5,
    }));
    this.notify();
    return this.getSnapshot();
  }

  public tick(): BillingTelemetrySnapshot {
    this.tickCount += 1;

    const account =
      this.chaosConfig !== null
        ? SAMPLE_ACCOUNTS.filter((a) => a.region === this.chaosConfig!.targetRegion)[
            this.tickCount %
              Math.max(
                1,
                SAMPLE_ACCOUNTS.filter(
                  (a) => a.region === this.chaosConfig!.targetRegion
                ).length
              )
          ] ?? SAMPLE_ACCOUNTS[0]!
        : SAMPLE_ACCOUNTS[this.tickCount % SAMPLE_ACCOUNTS.length]!;

    const isOutageAffected =
      this.chaosConfig !== null &&
      this.activeGateway === this.chaosConfig.targetGateway &&
      account.region === this.chaosConfig.targetRegion;

    this.emitAttemptForAccount(account, isOutageAffected);

    // Smoothly reflect gateway stats
    this.gateways = this.gateways.map((gw) => {
      if (
        this.chaosConfig &&
        gw.gatewayId === this.chaosConfig.targetGateway &&
        this.activeGateway === this.chaosConfig.targetGateway
      ) {
        return {
          ...gw,
          status: "OUTAGE",
          successRatePct: Number((58.5 + (this.tickCount % 5) * 0.8).toFixed(1)),
          p95LatencyMs: 1580 + (this.tickCount % 4) * 45,
          failedAttemptsCount: gw.failedAttemptsCount + (isOutageAffected ? 1 : 0),
        };
      }
      return {
        ...gw,
        status: "NOMINAL",
        successRatePct: Number((99.4 + (this.tickCount % 3) * 0.2).toFixed(1)),
        p95LatencyMs: 82 + (this.tickCount % 4) * 5,
      };
    });

    this.notify();
    return this.getSnapshot();
  }

  public ingestStripeWebhook(payload: RawStripeWebhookPayload): {
    webhook: WebhookEventRecord;
    trace: PaymentAttemptTrace;
    triggersOutage: boolean;
  } {
    const obj = payload.data?.object ?? {};
    const accountId = obj.customer ?? "acct_1001";
    const matchedSeed = SAMPLE_ACCOUNTS.find((a) => a.accountId === accountId);
    const companyName =
      obj.customer_name ?? matchedSeed?.companyName ?? "EMEA Enterprise Account";
    const invoiceId = obj.id ?? `in_ext_${1000 + this.tickCount}`;
    const amountCents =
      obj.amount_due ?? obj.amount_paid ?? matchedSeed?.amountCents ?? 1_450_000;
    const isFailure =
      payload.type === "invoice.payment_failed" ||
      payload.type === "charge.dispute.created";
    const failureCode =
      obj.failure_code ??
      (isFailure ? "three_d_secure_timeout" : undefined);
    const failureReason =
      obj.failure_message ??
      (payload.type === "charge.dispute.created"
        ? "issuer_chargeback_initiated"
        : isFailure
          ? "3DS2 ACS challenge timed out after 1,650ms via STRIPE_PRIMARY"
          : "Settled cleanly");

    const gateway = obj.gateway ?? this.activeGateway;
    const nowIso = new Date().toISOString();

    const webhook: WebhookEventRecord = {
      id: payload.id ?? `wh_ext_${Date.now()}_${this.tickCount}`,
      eventType: payload.type,
      accountId,
      companyName,
      invoiceId,
      amountCents,
      status: isFailure ? "FAILED" : "DELIVERED",
      failureReason,
      attemptCount: obj.attempt_count ?? (isFailure ? 2 : 1),
      createdAt: nowIso,
    };

    const trace = this.buildTrace({
      accountId,
      companyName,
      invoiceId,
      amountCents,
      gateway,
      failed: isFailure,
      failureCode,
      failureReason,
    });

    this.pushTrace(trace);
    this.pushWebhook(webhook);

    let triggersOutage = false;
    if (
      isFailure &&
      (failureCode === "three_d_secure_timeout" ||
        failureCode === "gateway_timeout" ||
        obj.region === "EMEA")
    ) {
      triggersOutage = true;
      if (!this.chaosConfig) {
        this.chaosConfig = {
          faultType: "EU_3DS2_GATEWAY_OUTAGE",
          targetGateway: gateway,
          targetRegion: "EMEA",
          latencyPenaltyMs: 1540,
          failureProbability: 0.9,
        };
      }
      this.gateways = this.gateways.map((gw) =>
        gw.gatewayId === gateway
          ? {
              ...gw,
              status: "OUTAGE",
              successRatePct: 60.2,
              p95LatencyMs: trace.totalDurationMs,
              failedAttemptsCount: gw.failedAttemptsCount + 1,
            }
          : gw
      );
    }

    this.notify();
    return { webhook, trace, triggersOutage };
  }

  public failoverGateway(
    targetGateway: PaymentGatewayId = "STRIPE_EU_FALLBACK",
    accountId = "acct_1001"
  ): GatewayRemediationResult {
    const previousChaos = this.chaosConfig !== null;
    this.activeGateway = targetGateway;
    this.chaosConfig = null;

    let replayedWebhooksCount = 0;
    let recoveredMrrCents = 0;

    this.recentWebhooks = this.recentWebhooks.map((wh) => {
      if (wh.status !== "DELIVERED") {
        replayedWebhooksCount += 1;
        recoveredMrrCents += wh.amountCents;
        return {
          ...wh,
          status: "DELIVERED" as const,
          failureReason: `Replayed & settled via ${targetGateway}`,
          attemptCount: wh.attemptCount + 1,
        };
      }
      return wh;
    });

    this.gateways = this.gateways.map((gw) => {
      if (gw.gatewayId === targetGateway) {
        return {
          ...gw,
          status: "NOMINAL",
          successRatePct: 99.8,
          p95LatencyMs: 84,
          activeRoutingWeightPct: 85,
        };
      }
      if (gw.gatewayId === "STRIPE_PRIMARY") {
        return {
          ...gw,
          status: previousChaos ? "DEGRADED" : "NOMINAL",
          successRatePct: previousChaos ? 94.5 : 99.6,
          p95LatencyMs: previousChaos ? 210 : 92,
          activeRoutingWeightPct: 10,
        };
      }
      return {
        ...gw,
        activeRoutingWeightPct: 5,
      };
    });

    const targetAccount =
      SAMPLE_ACCOUNTS.find((a) => a.accountId === accountId) ??
      SAMPLE_ACCOUNTS[0]!;

    const recoveryTrace = this.buildTrace({
      accountId: targetAccount.accountId,
      companyName: targetAccount.companyName,
      invoiceId: `${targetAccount.invoicePrefix}_replay`,
      amountCents: targetAccount.amountCents,
      gateway: targetGateway,
      failed: false,
      recovered: true,
    });
    this.pushTrace(recoveryTrace);

    const nowIso = new Date().toISOString();
    const settledWebhook: WebhookEventRecord = {
      id: `wh_recover_${Date.now()}`,
      eventType: "invoice.payment_succeeded",
      accountId: targetAccount.accountId,
      companyName: targetAccount.companyName,
      invoiceId: `${targetAccount.invoicePrefix}_replay`,
      amountCents: targetAccount.amountCents,
      status: "DELIVERED",
      failureReason: `Verified 3DS2 fallback settlement on ${targetGateway} (${recoveryTrace.totalDurationMs}ms)`,
      attemptCount: 1,
      createdAt: nowIso,
    };
    this.pushWebhook(settledWebhook);

    this.notify();

    return {
      success: true,
      action: `FAILOVER_TO_${targetGateway}`,
      targetGateway,
      replayedWebhooksCount: Math.max(1, replayedWebhooksCount),
      recoveredMrrCents: Math.max(targetAccount.amountCents, recoveredMrrCents),
      newSuccessRatePct: 99.8,
      message: `Shifted payment traffic to ${targetGateway}; replayed ${Math.max(
        1,
        replayedWebhooksCount
      )} webhook(s) with 99.8% settlement success.`,
      timestamp: nowIso,
    };
  }

  private emitAttemptForAccount(
    account: SeedTargetAccount,
    failed: boolean
  ): void {
    const invoiceId = `${account.invoicePrefix}_t${this.tickCount}`;
    const failureCode = failed
      ? this.chaosConfig?.faultType === "DISPUTE_SURGE"
        ? "fraudulent_dispute_blocked"
        : "three_d_secure_timeout"
      : undefined;
    const failureReason = failed
      ? failureCode === "three_d_secure_timeout"
        ? `3DS2 ACS challenge timed out (1,650ms) on ${this.activeGateway}`
        : `Dispute surge flagged charge on ${this.activeGateway}`
      : `Settled cleanly via ${this.activeGateway}`;

    const trace = this.buildTrace({
      accountId: account.accountId,
      companyName: account.companyName,
      invoiceId,
      amountCents: account.amountCents,
      gateway: this.activeGateway,
      failed,
      failureCode,
      failureReason,
    });
    this.pushTrace(trace);

    const webhook: WebhookEventRecord = {
      id: `wh_live_${this.tickCount}_${account.accountId}`,
      eventType: failed
        ? this.chaosConfig?.faultType === "DISPUTE_SURGE"
          ? "charge.dispute.created"
          : "invoice.payment_failed"
        : "invoice.payment_succeeded",
      accountId: account.accountId,
      companyName: account.companyName,
      invoiceId,
      amountCents: account.amountCents,
      status: failed ? "FAILED" : "DELIVERED",
      failureReason,
      attemptCount: failed ? 2 : 1,
      createdAt: trace.timestamp,
    };
    this.pushWebhook(webhook);
  }

  private buildTrace(input: {
    accountId: string;
    companyName: string;
    invoiceId: string;
    amountCents: number;
    gateway: PaymentGatewayId;
    failed: boolean;
    recovered?: boolean;
    failureCode?: string;
    failureReason?: string;
  }): PaymentAttemptTrace {
    const traceNum = this.tickCount;
    const edgeDur = 11 + (traceNum % 4);
    const intentDur = 24 + (traceNum % 6);
    const authDur = input.failed ? 1560 + (traceNum % 90) : 39 + (traceNum % 9);
    const settleDur = input.failed ? 18 : 16 + (traceNum % 5);
    const totalDurationMs = edgeDur + intentDur + authDur + settleDur;

    const spans: GatewaySpan[] = [
      {
        spanId: `sp_edge_${traceNum}`,
        stepName: "POST /v1/charges/renewal",
        gatewayService: "edge-webhook-router",
        startOffsetMs: 0,
        durationMs: edgeDur,
        status: "OK",
        payload: {
          accountId: input.accountId,
          invoiceId: input.invoiceId,
          gateway: input.gateway,
          amountCents: input.amountCents,
        },
      },
      {
        spanId: `sp_intent_${traceNum}`,
        stepName: "Create PaymentIntent",
        gatewayService: `stripe-api (${input.gateway})`,
        startOffsetMs: edgeDur,
        durationMs: intentDur,
        status: "OK",
        payload: {
          paymentIntent: `pi_${input.invoiceId}`,
          idempotencyKey: `idem_${input.accountId}_${traceNum}`,
        },
      },
      {
        spanId: `sp_3ds2_${traceNum}`,
        stepName: "PSD2 / 3DS2 ACS Auth Challenge",
        gatewayService:
          input.gateway === "STRIPE_EU_FALLBACK"
            ? "eu-psd2-fallback-acs"
            : "3ds2-acs-directory",
        startOffsetMs: edgeDur + intentDur,
        durationMs: authDur,
        status: input.failed ? "ERROR" : "OK",
        errorCode: input.failed ? input.failureCode ?? "three_d_secure_timeout" : undefined,
        detailMessage: input.failed
          ? input.failureReason ?? "ACS upstream timeout exceeded 1,500ms SLA"
          : `SCA token verified cleanly via ${input.gateway}`,
        payload: {
          tdsVersion: "2.2.0",
          challengeFlow: input.failed ? "TIMEOUT_ABORTED" : "FRICTIONLESS_APPROVED",
          latencyMs: authDur,
        },
      },
      {
        spanId: `sp_settle_${traceNum}`,
        stepName: input.failed
          ? "DLQ Enqueue & Retry Schedule"
          : "Double-Entry Ledger Settlement",
        gatewayService: "finops-settlement-worker",
        startOffsetMs: edgeDur + intentDur + authDur,
        durationMs: settleDur,
        status: input.failed ? "ERROR" : "OK",
        errorCode: input.failed ? "gateway_circuit_open" : undefined,
        detailMessage: input.failed
          ? "Payment halted; webhook marked FAILED for failover replay"
          : `Committed ${input.amountCents} cents to ledger`,
        payload: {
          settled: !input.failed,
          recovered: Boolean(input.recovered),
          retryEligible: input.failed,
        },
      },
    ];

    return {
      traceId: `tr_pay_${traceNum}_${input.accountId}`,
      accountId: input.accountId,
      companyName: input.companyName,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      gateway: input.gateway,
      totalDurationMs,
      status: input.failed
        ? "FAILED"
        : input.recovered
          ? "RECOVERED"
          : "SUCCEEDED",
      failureCode: input.failed ? input.failureCode : undefined,
      timestamp: new Date().toISOString(),
      spans,
    };
  }

  private pushTrace(trace: PaymentAttemptTrace): void {
    this.recentTraces = [trace, ...this.recentTraces].slice(0, MAX_TRACES);
  }

  private pushWebhook(webhook: WebhookEventRecord): void {
    this.recentWebhooks = [webhook, ...this.recentWebhooks].slice(0, MAX_WEBHOOKS);
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}
