export interface McpFinOpsAccount {
  accountId: string;
  companyName: string;
  region: "NA" | "EMEA" | "APAC" | "LATAM";
  planTier: "ENTERPRISE" | "SCALE" | "GROWTH";
  status: "ACTIVE" | "PAST_DUE" | "DISPUTED" | "AT_RISK" | "TRIALING" | "CHURNED";
  mrrCents: number;
  disputedAmountCents: number;
  failedChargesCount: number;
  healthScore: number;
}

export interface McpFinOpsWebhook {
  webhookId: string;
  eventType:
    | "invoice.payment_failed"
    | "charge.dispute.created"
    | "invoice.payment_succeeded";
  accountId: string;
  companyName: string;
  invoiceId: string;
  gateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
  amountCents: number;
  status: "FAILED" | "PENDING_RETRY" | "DELIVERED";
  failureCode?: string;
  failureReason: string;
  attemptCount: number;
  createdAt: string;
}

export interface McpPaymentTraceSpan {
  spanId: string;
  stepName: string;
  gatewayService: string;
  startOffsetMs: number;
  durationMs: number;
  status: "OK" | "ERROR";
  errorCode?: string;
  detailMessage: string;
}

export interface McpPaymentTrace {
  traceId: string;
  gateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
  totalDurationMs: number;
  hasError: boolean;
  rootCauseHypothesis?: string;
  spans: McpPaymentTraceSpan[];
}

export interface McpFinOpsLedgerSummary {
  activeGateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
  gatewayStatus: "NOMINAL" | "DEGRADED" | "OUTAGE";
  totalMrrCents: number;
  atRiskMrrCents: number;
  disputedCents: number;
  failedChargesTotal: number;
  netDollarRetentionPercent: number;
}

export interface McpFinOpsProvider {
  queryLedger: (filter?: {
    region?: "NA" | "EMEA" | "APAC" | "LATAM";
    status?: string;
    onlyAtRisk?: boolean;
  }) => {
    summary: McpFinOpsLedgerSummary;
    accounts: McpFinOpsAccount[];
  };
  inspectFailedWebhooks: (filter?: {
    webhookId?: string;
    onlyFailed?: boolean;
  }) => {
    activeGateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
    gatewayStatus: "NOMINAL" | "DEGRADED" | "OUTAGE";
    failedCount: number;
    webhooks: McpFinOpsWebhook[];
    latestTrace: McpPaymentTrace;
  };
  executeRemediation: (req: {
    action:
      | "retryFailedWebhook"
      | "failoverPaymentGateway"
      | "issuePartialRefund"
      | "applyRetentionDiscount"
      | "extendTrialPeriod";
    targetAccountId: string;
    parameters?: Record<string, unknown>;
  }) => {
    success: boolean;
    action: string;
    targetAccountId: string;
    targetGateway: "STRIPE_PRIMARY" | "STRIPE_EU_FALLBACK" | "ADYEN_BACKUP_MID";
    recoveredMrrCents: number;
    message: string;
    timestamp: string;
    verificationPassed: boolean;
  };
}

class DefaultMcpFinOpsProvider implements McpFinOpsProvider {
  private outageActive = true;
  private activeGateway:
    | "STRIPE_PRIMARY"
    | "STRIPE_EU_FALLBACK"
    | "ADYEN_BACKUP_MID" = "STRIPE_PRIMARY";

  public queryLedger(filter?: {
    region?: "NA" | "EMEA" | "APAC" | "LATAM";
    status?: string;
    onlyAtRisk?: boolean;
  }) {
    const accounts: McpFinOpsAccount[] = [
      {
        accountId: "acct_1001",
        companyName: "Aether Cloud Systems (EMEA Flagship)",
        region: "EMEA",
        planTier: "ENTERPRISE",
        status: this.outageActive ? "PAST_DUE" : "ACTIVE",
        mrrCents: 3_450_000,
        disputedAmountCents: this.outageActive ? 450_000 : 0,
        failedChargesCount: this.outageActive ? 3 : 0,
        healthScore: this.outageActive ? 34 : 92,
      },
      {
        accountId: "acct_1005",
        companyName: "Linearity Cloud Systems #5",
        region: "EMEA",
        planTier: "ENTERPRISE",
        status: this.outageActive ? "PAST_DUE" : "ACTIVE",
        mrrCents: 1_640_000,
        disputedAmountCents: 0,
        failedChargesCount: this.outageActive ? 2 : 0,
        healthScore: this.outageActive ? 44 : 89,
      },
      {
        accountId: "acct_1004",
        companyName: "Vanguard Cloud Systems",
        region: "NA",
        planTier: "ENTERPRISE",
        status: this.outageActive ? "AT_RISK" : "ACTIVE",
        mrrCents: 2_240_000,
        disputedAmountCents: 0,
        failedChargesCount: 0,
        healthScore: this.outageActive ? 54 : 84,
      },
      {
        accountId: "acct_1012",
        companyName: "Apex Security Corp #12",
        region: "APAC",
        planTier: "SCALE",
        status: "ACTIVE",
        mrrCents: 980_000,
        disputedAmountCents: 0,
        failedChargesCount: 0,
        healthScore: 95,
      },
    ];

    let filtered = accounts;
    if (filter?.region) {
      filtered = filtered.filter((a) => a.region === filter.region);
    }
    if (filter?.status) {
      filtered = filtered.filter((a) => a.status === filter.status);
    }
    if (filter?.onlyAtRisk) {
      filtered = filtered.filter((a) => a.status !== "ACTIVE");
    }

    const totalMrrCents = accounts.reduce((acc, a) => acc + a.mrrCents, 0);
    const atRiskMrrCents = accounts
      .filter(
        (a) =>
          a.status === "PAST_DUE" ||
          a.status === "DISPUTED" ||
          a.status === "AT_RISK",
      )
      .reduce((acc, a) => acc + a.mrrCents, 0);
    const disputedCents = accounts.reduce(
      (acc, a) => acc + a.disputedAmountCents,
      0,
    );
    const failedChargesTotal = accounts.reduce(
      (acc, a) => acc + a.failedChargesCount,
      0,
    );

    const gatewayStatus: McpFinOpsLedgerSummary["gatewayStatus"] = this
      .outageActive
      ? "OUTAGE"
      : "NOMINAL";

    return {
      summary: {
        activeGateway: this.activeGateway,
        gatewayStatus,
        totalMrrCents,
        atRiskMrrCents,
        disputedCents,
        failedChargesTotal,
        netDollarRetentionPercent: this.outageActive ? 111.4 : 114.8,
      },
      accounts: filtered,
    };
  }

  public inspectFailedWebhooks(filter?: {
    webhookId?: string;
    onlyFailed?: boolean;
  }) {
    const webhooks: McpFinOpsWebhook[] = [
      {
        webhookId: "wh_eu_3001",
        eventType: this.outageActive
          ? "invoice.payment_failed"
          : "invoice.payment_succeeded",
        accountId: "acct_1001",
        companyName: "Aether Cloud Systems (EMEA Flagship)",
        invoiceId: "in_eu_9001",
        gateway: this.activeGateway,
        amountCents: 1_850_000,
        status: this.outageActive ? "FAILED" : "DELIVERED",
        failureCode: this.outageActive ? "three_d_secure_timeout" : undefined,
        failureReason: this.outageActive
          ? "3DS2 ACS challenge timed out (1,632ms) on STRIPE_PRIMARY"
          : `Replayed and settled cleanly via ${this.activeGateway}`,
        attemptCount: this.outageActive ? 2 : 3,
        createdAt: "2026-11-13T06:00:00.000Z",
      },
      {
        webhookId: "wh_eu_3002",
        eventType: this.outageActive
          ? "invoice.payment_failed"
          : "invoice.payment_succeeded",
        accountId: "acct_1005",
        companyName: "Linearity Cloud Systems #5",
        invoiceId: "in_eu_9005",
        gateway: this.activeGateway,
        amountCents: 1_640_000,
        status: this.outageActive ? "FAILED" : "DELIVERED",
        failureCode: this.outageActive ? "three_d_secure_timeout" : undefined,
        failureReason: this.outageActive
          ? "EMEA PSD2 Strong Customer Authentication timeout on STRIPE_PRIMARY"
          : `Settled cleanly via ${this.activeGateway}`,
        attemptCount: this.outageActive ? 2 : 3,
        createdAt: "2026-11-13T06:02:00.000Z",
      },
    ];

    let filtered = webhooks;
    if (filter?.webhookId) {
      filtered = filtered.filter((w) => w.webhookId === filter.webhookId);
    }
    if (filter?.onlyFailed) {
      filtered = filtered.filter((w) => w.status !== "DELIVERED");
    }

    const latestTrace: McpPaymentTrace = this.outageActive
      ? {
          traceId: "tr_pay_eu_9001",
          gateway: "STRIPE_PRIMARY",
          totalDurationMs: 1689,
          hasError: true,
          rootCauseHypothesis:
            "EMEA PSD2 3DS2 ACS directory timeout (>1,500ms SLA) on STRIPE_PRIMARY is blocking Enterprise subscription renewals. Failing over to STRIPE_EU_FALLBACK clears the circuit.",
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
              spanId: "sp_2",
              stepName: "Create PaymentIntent",
              gatewayService: "stripe-api (STRIPE_PRIMARY)",
              startOffsetMs: 12,
              durationMs: 27,
              status: "OK",
              detailMessage: "PaymentIntent initialized ($18,500.00)",
            },
            {
              spanId: "sp_3",
              stepName: "PSD2 / 3DS2 ACS Auth Challenge",
              gatewayService: "3ds2-acs-directory",
              startOffsetMs: 39,
              durationMs: 1632,
              status: "ERROR",
              errorCode: "three_d_secure_timeout",
              detailMessage: "Upstream ACS bank challenge timed out at 1,632ms",
            },
          ],
        }
      : {
          traceId: "tr_pay_eu_9001_recovered",
          gateway: this.activeGateway,
          totalDurationMs: 84,
          hasError: false,
          spans: [
            {
              spanId: "sp_1",
              stepName: "POST /v1/charges/renewal",
              gatewayService: "edge-webhook-router",
              startOffsetMs: 0,
              durationMs: 11,
              status: "OK",
              detailMessage: "Webhook replay authenticated",
            },
            {
              spanId: "sp_3",
              stepName: "PSD2 / 3DS2 ACS Auth Challenge",
              gatewayService: "eu-psd2-fallback-acs",
              startOffsetMs: 34,
              durationMs: 49,
              status: "OK",
              detailMessage: `Verified cleanly via ${this.activeGateway}`,
            },
          ],
        };

    const gatewayStatus: McpFinOpsLedgerSummary["gatewayStatus"] = this
      .outageActive
      ? "OUTAGE"
      : "NOMINAL";

    return {
      activeGateway: this.activeGateway,
      gatewayStatus,
      failedCount: webhooks.filter((w) => w.status !== "DELIVERED").length,
      webhooks: filtered,
      latestTrace,
    };
  }

  public executeRemediation(req: {
    action:
      | "retryFailedWebhook"
      | "failoverPaymentGateway"
      | "issuePartialRefund"
      | "applyRetentionDiscount"
      | "extendTrialPeriod";
    targetAccountId: string;
    parameters?: Record<string, unknown>;
  }) {
    const requestedGateway = req.parameters?.routeGateway;
    const targetGateway: McpFinOpsLedgerSummary["activeGateway"] =
      requestedGateway === "ADYEN_BACKUP_MID"
        ? "ADYEN_BACKUP_MID"
        : requestedGateway === "STRIPE_PRIMARY"
          ? "STRIPE_PRIMARY"
          : "STRIPE_EU_FALLBACK";

    this.outageActive = false;
    this.activeGateway = targetGateway;

    return {
      success: true,
      action: req.action,
      targetAccountId: req.targetAccountId,
      targetGateway,
      recoveredMrrCents: 5_090_000,
      message: `Executed FinOps action '${req.action}' for ${req.targetAccountId} via ${targetGateway}. Failed webhooks replayed and settled cleanly.`,
      timestamp: new Date().toISOString(),
      verificationPassed: true,
    };
  }
}

let activeFinOpsProvider: McpFinOpsProvider = new DefaultMcpFinOpsProvider();

export function setMcpFinOpsProvider(provider: McpFinOpsProvider): void {
  activeFinOpsProvider = provider;
}

export function getMcpFinOpsProvider(): McpFinOpsProvider {
  return activeFinOpsProvider;
}

export function handleQueryFinopsLedger(input?: {
  region?: "NA" | "EMEA" | "APAC" | "LATAM";
  status?: string;
  onlyAtRisk?: boolean;
}) {
  return activeFinOpsProvider.queryLedger(input);
}

export function handleInspectFailedWebhooks(input?: {
  webhookId?: string;
  onlyFailed?: boolean;
}) {
  return activeFinOpsProvider.inspectFailedWebhooks(input);
}

export function handleExecuteFinopsRemediation(input: {
  action:
    | "retryFailedWebhook"
    | "failoverPaymentGateway"
    | "issuePartialRefund"
    | "applyRetentionDiscount"
    | "extendTrialPeriod";
  targetAccountId: string;
  parameters?: Record<string, unknown>;
}) {
  return activeFinOpsProvider.executeRemediation(input);
}
