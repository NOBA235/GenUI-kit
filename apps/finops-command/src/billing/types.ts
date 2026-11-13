import type { WebhookEventRecord } from "../data/ledger-seed.js";

export type PaymentGatewayId =
  | "STRIPE_PRIMARY"
  | "STRIPE_EU_FALLBACK"
  | "ADYEN_BACKUP_MID";

export type GatewayHealthStatus = "NOMINAL" | "DEGRADED" | "OUTAGE";

export interface GatewaySpan {
  spanId: string;
  stepName: string;
  gatewayService: string;
  startOffsetMs: number;
  durationMs: number;
  status: "OK" | "ERROR";
  errorCode?: string;
  detailMessage?: string;
  payload?: Record<string, unknown>;
}

export interface PaymentAttemptTrace {
  traceId: string;
  accountId: string;
  companyName: string;
  invoiceId: string;
  amountCents: number;
  gateway: PaymentGatewayId;
  totalDurationMs: number;
  status: "SUCCEEDED" | "FAILED" | "RECOVERED";
  failureCode?: string;
  timestamp: string;
  spans: GatewaySpan[];
}

export interface GatewayHealthMetrics {
  gatewayId: PaymentGatewayId;
  label: string;
  region: string;
  status: GatewayHealthStatus;
  successRatePct: number;
  p95LatencyMs: number;
  failedAttemptsCount: number;
  activeRoutingWeightPct: number;
}

export interface GatewayChaosConfig {
  faultType: "EU_3DS2_GATEWAY_OUTAGE" | "DISPUTE_SURGE" | "WEBHOOK_DLQ_BACKUP";
  targetGateway: PaymentGatewayId;
  targetRegion: "EMEA" | "NA" | "APAC";
  latencyPenaltyMs: number;
  failureProbability: number;
}

export interface RawStripeWebhookPayload {
  id?: string;
  type:
    | "invoice.payment_failed"
    | "charge.dispute.created"
    | "customer.subscription.updated"
    | "invoice.payment_succeeded";
  data?: {
    object?: {
      id?: string;
      customer?: string;
      customer_name?: string;
      amount_due?: number;
      amount_paid?: number;
      failure_code?: string;
      failure_message?: string;
      attempt_count?: number;
      region?: string;
      gateway?: PaymentGatewayId;
    };
  };
}

export interface GatewayRemediationResult {
  success: boolean;
  action: string;
  targetGateway: PaymentGatewayId;
  replayedWebhooksCount: number;
  recoveredMrrCents: number;
  newSuccessRatePct: number;
  message: string;
  timestamp: string;
}

export interface BillingTelemetrySnapshot {
  tick: number;
  timestamp: string;
  activeGateway: PaymentGatewayId;
  chaosActive: boolean;
  activeFaultType: GatewayChaosConfig["faultType"] | null;
  gateways: GatewayHealthMetrics[];
  recentTraces: PaymentAttemptTrace[];
  recentWebhooks: WebhookEventRecord[];
}
