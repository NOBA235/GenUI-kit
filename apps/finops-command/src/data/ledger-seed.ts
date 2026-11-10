export type SubscriptionTier = "ENTERPRISE" | "SCALE" | "GROWTH";
export type SubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "DISPUTED"
  | "AT_RISK"
  | "TRIALING"
  | "CHURNED";
export type RegionCode = "NA" | "EMEA" | "APAC" | "LATAM";

export interface CustomerAccount {
  id: string;
  companyName: string;
  domain: string;
  planTier: SubscriptionTier;
  region: RegionCode;
  mrrCents: number;
  arrCents: number;
  seats: number;
  status: SubscriptionStatus;
  healthScore: number;
  failedChargesCount: number;
  disputedAmountCents: number;
  trialDaysRemaining: number;
  discountPercent: number;
  lastInvoiceId: string;
  lastInvoiceStatus: "PAID" | "OPEN" | "FAILED" | "DISPUTED";
  csmOwner: string;
  renewalDate: string;
}

export interface MrrHistoryPoint {
  month: string;
  startingMrrCents: number;
  newMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  endingMrrCents: number;
  netRetentionPercent: number;
}

export interface CohortRow {
  cohortId: string;
  label: string;
  region: RegionCode;
  startingAccounts: number;
  m1: number;
  m2: number;
  m3: number;
  m4: number;
  m5: number;
  m6: number;
  ndrPercent: number;
}

export interface WebhookEventRecord {
  id: string;
  eventType:
    | "invoice.payment_failed"
    | "charge.dispute.created"
    | "customer.subscription.updated"
    | "invoice.payment_succeeded";
  accountId: string;
  companyName: string;
  invoiceId: string;
  amountCents: number;
  status: "FAILED" | "PENDING_RETRY" | "DELIVERED";
  failureReason: string;
  attemptCount: number;
  createdAt: string;
}

export interface FinOpsAuditEntry {
  id: string;
  timestamp: string;
  actionType:
    | "ISSUE_PARTIAL_REFUND"
    | "EXTEND_TRIAL"
    | "RETRY_FAILED_WEBHOOK"
    | "APPLY_RETENTION_DISCOUNT";
  accountId: string;
  companyName: string;
  summary: string;
  mrrDeltaCents: number;
  operator: string;
}

export interface FinOpsMetrics {
  totalMrrCents: number;
  arrCents: number;
  netDollarRetentionPercent: number;
  logoChurnPercent: number;
  atRiskMrrCents: number;
  disputedCents: number;
  failedChargesTotal: number;
  activeSubscriptionsCount: number;
  trialingCount: number;
}

export interface FinOpsState {
  ledger: {
    metrics: FinOpsMetrics;
    accounts: CustomerAccount[];
    mrrHistory: MrrHistoryPoint[];
    cohorts: CohortRow[];
    webhooks: WebhookEventRecord[];
    auditLog: FinOpsAuditEntry[];
    selectedAccountId: string;
    filters: {
      searchQuery: string;
      status: string;
      region: string;
      sortField: string;
      sortDirection: "ascending" | "descending";
      page: number;
    };
  };
}

export interface MutableLedgerStoreAdapter {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  update?: (updates: Record<string, unknown>) => void;
}

const COMPANY_PREFIXES = [
  "Aether",
  "Vanguard",
  "Kestrel",
  "Obsidian",
  "Helios",
  "Linearity",
  "Vectra",
  "Chronos",
  "Nexus",
  "Quantis",
  "Stratos",
  "Apex",
  "Cortex",
  "Hyperion",
  "Solstice",
  "Pulse",
  "Vertex",
  "Cobalt",
  "Monolith",
  "Synthetix",
];

const COMPANY_SUFFIXES = [
  "Cloud Systems",
  "AI Labs",
  "Security Corp",
  "Data Fabrics",
  "BioCompute",
  "FinTech",
  "Robotics",
  "Telemetry",
  "Logistics",
  "Analytics",
  "Infrastructure",
  "Networks",
];

const CSM_OWNERS = [
  "Elena Rostova",
  "Marcus Vance",
  "Kenji Takahashi",
  "Soraia Lindqvist",
  "Devon K.",
  "Amara Okafor",
];

const REGIONS: RegionCode[] = ["NA", "EMEA", "APAC", "LATAM"];

/**
 * Deterministic PRNG (Mulberry32) so all 240 accounts are 100% reproducible across test runs and SSR.
 */
function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absDollars = Math.abs(cents) / 100;
  return `${sign}$${absDollars.toLocaleString("en-US", {
    minimumFractionDigits: absDollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function recomputeMetricsFromAccounts(
  accounts: CustomerAccount[]
): FinOpsMetrics {
  let totalMrrCents = 0;
  let atRiskMrrCents = 0;
  let disputedCents = 0;
  let failedChargesTotal = 0;
  let activeSubscriptionsCount = 0;
  let trialingCount = 0;
  let churnedCount = 0;

  for (const acct of accounts) {
    if (acct.status !== "CHURNED") {
      totalMrrCents += acct.mrrCents;
    } else {
      churnedCount++;
    }
    if (
      acct.status === "AT_RISK" ||
      acct.status === "PAST_DUE" ||
      acct.status === "DISPUTED"
    ) {
      atRiskMrrCents += acct.mrrCents;
    }
    disputedCents += acct.disputedAmountCents;
    failedChargesTotal += acct.failedChargesCount;
    if (acct.status === "ACTIVE") activeSubscriptionsCount++;
    if (acct.status === "TRIALING") trialingCount++;
  }

  return {
    totalMrrCents,
    arrCents: totalMrrCents * 12,
    netDollarRetentionPercent: 114.6,
    logoChurnPercent:
      Math.round((churnedCount / Math.max(1, accounts.length)) * 1000) / 10,
    atRiskMrrCents,
    disputedCents,
    failedChargesTotal,
    activeSubscriptionsCount,
    trialingCount,
  };
}

export function createInitialFinOpsState(): FinOpsState {
  const rng = createSeededRng(20261109);
  const accounts: CustomerAccount[] = [];

  for (let i = 1; i <= 240; i++) {
    const id = `acct_${1000 + i}`;
    const prefix = COMPANY_PREFIXES[i % COMPANY_PREFIXES.length]!;
    const suffix =
      COMPANY_SUFFIXES[
        Math.floor(i / COMPANY_PREFIXES.length) % COMPANY_SUFFIXES.length
      ]!;
    const companyName = `${prefix} ${suffix} #${i}`;
    const domain = `${prefix.toLowerCase()}-${i}.io`;
    const region = REGIONS[i % REGIONS.length]!;
    const csmOwner = CSM_OWNERS[i % CSM_OWNERS.length]!;

    let planTier: SubscriptionTier = "GROWTH";
    let baseMrrCents = 85_000 + Math.floor(rng() * 140_000);
    let seats = 15 + Math.floor(rng() * 40);

    if (i <= 45) {
      planTier = "ENTERPRISE";
      baseMrrCents = 1_250_000 + Math.floor(rng() * 2_400_000);
      seats = 120 + Math.floor(rng() * 380);
    } else if (i <= 125) {
      planTier = "SCALE";
      baseMrrCents = 380_000 + Math.floor(rng() * 620_000);
      seats = 45 + Math.floor(rng() * 90);
    }

    // Hero accounts for deterministic playbooks & tests:
    // acct_1001: Disputed / Past-Due Enterprise in EMEA
    // acct_1004: At-Risk Enterprise renewal candidate
    // acct_1008: Trialing Enterprise candidate
    let status: SubscriptionStatus = "ACTIVE";
    let healthScore = 78 + Math.floor(rng() * 21);
    let failedChargesCount = 0;
    let disputedAmountCents = 0;
    let trialDaysRemaining = 0;
    let discountPercent = 0;
    let lastInvoiceStatus: CustomerAccount["lastInvoiceStatus"] = "PAID";

    if (i === 1 || i % 19 === 0) {
      status = "DISPUTED";
      healthScore = 34;
      failedChargesCount = 2;
      disputedAmountCents = i === 1 ? 450_000 : Math.round(baseMrrCents * 0.5);
      lastInvoiceStatus = "DISPUTED";
    } else if (i === 2 || i === 3 || i % 13 === 0) {
      status = "PAST_DUE";
      healthScore = 46;
      failedChargesCount = 3;
      disputedAmountCents = Math.round(baseMrrCents * 0.4);
      lastInvoiceStatus = "FAILED";
    } else if (i === 4 || i % 11 === 0) {
      status = "AT_RISK";
      healthScore = 52;
      failedChargesCount = 1;
      lastInvoiceStatus = "OPEN";
    } else if (i === 8 || i % 17 === 0) {
      status = "TRIALING";
      healthScore = 84;
      trialDaysRemaining = i === 8 ? 5 : 9;
      lastInvoiceStatus = "OPEN";
    } else if (i % 47 === 0) {
      status = "CHURNED";
      healthScore = 12;
      lastInvoiceStatus = "FAILED";
    }

    accounts.push({
      id,
      companyName:
        i === 1
          ? "Aether Cloud Systems (EMEA Flagship)"
          : i === 4
          ? "Vanguard Cloud Systems"
          : i === 8
          ? "Chronos AI Labs"
          : companyName,
      domain,
      planTier,
      region: i === 1 ? "EMEA" : region,
      mrrCents: baseMrrCents,
      arrCents: baseMrrCents * 12,
      seats,
      status,
      healthScore,
      failedChargesCount,
      disputedAmountCents,
      trialDaysRemaining,
      discountPercent,
      lastInvoiceId: `in_${9000 + i}`,
      lastInvoiceStatus,
      csmOwner,
      renewalDate: `2026-12-${String((i % 28) + 1).padStart(2, "0")}`,
    });
  }

  const mrrHistory: MrrHistoryPoint[] = [
    {
      month: "2025-12",
      startingMrrCents: 162_000_000,
      newMrrCents: 9_400_000,
      expansionMrrCents: 6_200_000,
      contractionMrrCents: 2_100_000,
      churnedMrrCents: 3_100_000,
      endingMrrCents: 172_400_000,
      netRetentionPercent: 111.8,
    },
    {
      month: "2026-01",
      startingMrrCents: 172_400_000,
      newMrrCents: 10_100_000,
      expansionMrrCents: 6_800_000,
      contractionMrrCents: 2_300_000,
      churnedMrrCents: 2_900_000,
      endingMrrCents: 184_100_000,
      netRetentionPercent: 112.1,
    },
    {
      month: "2026-02",
      startingMrrCents: 184_100_000,
      newMrrCents: 10_800_000,
      expansionMrrCents: 7_100_000,
      contractionMrrCents: 2_400_000,
      churnedMrrCents: 3_200_000,
      endingMrrCents: 196_400_000,
      netRetentionPercent: 112.5,
    },
    {
      month: "2026-03",
      startingMrrCents: 196_400_000,
      newMrrCents: 11_200_000,
      expansionMrrCents: 7_500_000,
      contractionMrrCents: 2_200_000,
      churnedMrrCents: 3_000_000,
      endingMrrCents: 209_900_000,
      netRetentionPercent: 112.9,
    },
    {
      month: "2026-04",
      startingMrrCents: 209_900_000,
      newMrrCents: 11_900_000,
      expansionMrrCents: 8_100_000,
      contractionMrrCents: 2_600_000,
      churnedMrrCents: 3_400_000,
      endingMrrCents: 223_900_000,
      netRetentionPercent: 113.2,
    },
    {
      month: "2026-05",
      startingMrrCents: 223_900_000,
      newMrrCents: 12_400_000,
      expansionMrrCents: 8_400_000,
      contractionMrrCents: 2_500_000,
      churnedMrrCents: 3_100_000,
      endingMrrCents: 239_100_000,
      netRetentionPercent: 113.5,
    },
    {
      month: "2026-06",
      startingMrrCents: 239_100_000,
      newMrrCents: 13_100_000,
      expansionMrrCents: 8_900_000,
      contractionMrrCents: 2_800_000,
      churnedMrrCents: 3_600_000,
      endingMrrCents: 254_700_000,
      netRetentionPercent: 113.8,
    },
    {
      month: "2026-07",
      startingMrrCents: 254_700_000,
      newMrrCents: 13_600_000,
      expansionMrrCents: 9_200_000,
      contractionMrrCents: 2_900_000,
      churnedMrrCents: 3_500_000,
      endingMrrCents: 271_100_000,
      netRetentionPercent: 114.0,
    },
    {
      month: "2026-08",
      startingMrrCents: 271_100_000,
      newMrrCents: 14_200_000,
      expansionMrrCents: 9_600_000,
      contractionMrrCents: 3_000_000,
      churnedMrrCents: 3_800_000,
      endingMrrCents: 288_100_000,
      netRetentionPercent: 114.2,
    },
    {
      month: "2026-09",
      startingMrrCents: 288_100_000,
      newMrrCents: 14_800_000,
      expansionMrrCents: 10_100_000,
      contractionMrrCents: 3_200_000,
      churnedMrrCents: 4_100_000,
      endingMrrCents: 305_700_000,
      netRetentionPercent: 114.4,
    },
    {
      month: "2026-10",
      startingMrrCents: 305_700_000,
      newMrrCents: 15_400_000,
      expansionMrrCents: 10_800_000,
      contractionMrrCents: 3_500_000,
      churnedMrrCents: 4_900_000,
      endingMrrCents: 323_500_000,
      netRetentionPercent: 114.5,
    },
    {
      month: "2026-11",
      startingMrrCents: 323_500_000,
      newMrrCents: 16_200_000,
      expansionMrrCents: 11_400_000,
      contractionMrrCents: 3_300_000,
      churnedMrrCents: 4_400_000,
      endingMrrCents: 343_400_000,
      netRetentionPercent: 114.6,
    },
  ];

  const cohorts: CohortRow[] = [
    {
      cohortId: "coh-na-ent",
      label: "NA Enterprise (Q1-Q4)",
      region: "NA",
      startingAccounts: 52,
      m1: 99.2,
      m2: 98.4,
      m3: 97.6,
      m4: 96.8,
      m5: 96.1,
      m6: 95.8,
      ndrPercent: 121.4,
    },
    {
      cohortId: "coh-emea-ent",
      label: "EMEA Enterprise (PSD2 Impacted)",
      region: "EMEA",
      startingAccounts: 44,
      m1: 97.5,
      m2: 94.2,
      m3: 90.8,
      m4: 87.4,
      m5: 85.1,
      m6: 83.6,
      ndrPercent: 106.2,
    },
    {
      cohortId: "coh-apac-scale",
      label: "APAC Scale & Growth",
      region: "APAC",
      startingAccounts: 48,
      m1: 98.1,
      m2: 96.4,
      m3: 94.8,
      m4: 93.2,
      m5: 92.0,
      m6: 91.4,
      ndrPercent: 115.8,
    },
    {
      cohortId: "coh-na-scale",
      label: "NA Mid-Market Scale",
      region: "NA",
      startingAccounts: 42,
      m1: 98.6,
      m2: 97.1,
      m3: 95.9,
      m4: 94.6,
      m5: 93.8,
      m6: 93.1,
      ndrPercent: 116.9,
    },
    {
      cohortId: "coh-latam-growth",
      label: "LATAM Cloud Growth",
      region: "LATAM",
      startingAccounts: 30,
      m1: 96.8,
      m2: 94.1,
      m3: 91.5,
      m4: 89.2,
      m5: 87.9,
      m6: 86.5,
      ndrPercent: 109.4,
    },
    {
      cohortId: "coh-emea-scale",
      label: "EMEA Mid-Market Scale",
      region: "EMEA",
      startingAccounts: 24,
      m1: 97.9,
      m2: 95.6,
      m3: 93.4,
      m4: 91.8,
      m5: 90.2,
      m6: 89.1,
      ndrPercent: 112.3,
    },
  ];

  const webhooks: WebhookEventRecord[] = [
    {
      id: "wh_3001",
      eventType: "invoice.payment_failed",
      accountId: "acct_1001",
      companyName: "Aether Cloud Systems (EMEA Flagship)",
      invoiceId: "in_9001",
      amountCents: 450_000,
      status: "FAILED",
      failureReason: "authentication_required: EMEA 3DS2 off-session timeout",
      attemptCount: 3,
      createdAt: "2026-11-09T21:14:02Z",
    },
    {
      id: "wh_3002",
      eventType: "charge.dispute.created",
      accountId: "acct_1019",
      companyName: "Synthetix Cloud Systems #19",
      invoiceId: "in_9019",
      amountCents: 310_000,
      status: "PENDING_RETRY",
      failureReason: "duplicate_processing: secondary EU gateway retry collision",
      attemptCount: 2,
      createdAt: "2026-11-09T21:08:44Z",
    },
    {
      id: "wh_3003",
      eventType: "invoice.payment_failed",
      accountId: "acct_1002",
      companyName: "Kestrel Cloud Systems #2",
      invoiceId: "in_9002",
      amountCents: 520_000,
      status: "FAILED",
      failureReason: "insufficient_funds: corporate treasury ACH sweep pending",
      attemptCount: 2,
      createdAt: "2026-11-09T20:55:19Z",
    },
    {
      id: "wh_3004",
      eventType: "invoice.payment_failed",
      accountId: "acct_1003",
      companyName: "Obsidian Cloud Systems #3",
      invoiceId: "in_9003",
      amountCents: 490_000,
      status: "FAILED",
      failureReason: "do_not_honor: issuer velocity limit exceeded",
      attemptCount: 1,
      createdAt: "2026-11-09T20:41:10Z",
    },
    {
      id: "wh_3005",
      eventType: "customer.subscription.updated",
      accountId: "acct_1004",
      companyName: "Vanguard Cloud Systems",
      invoiceId: "in_9004",
      amountCents: 1_480_000,
      status: "DELIVERED",
      failureReason: "200 OK (42ms)",
      attemptCount: 1,
      createdAt: "2026-11-09T20:30:00Z",
    },
    {
      id: "wh_3006",
      eventType: "invoice.payment_Failed" as WebhookEventRecord["eventType"],
      accountId: "acct_1013",
      companyName: "Hyperion Cloud Systems #13",
      invoiceId: "in_9013",
      amountCents: 275_000,
      status: "FAILED",
      failureReason: "expired_card: primary corporate virtual card rotated",
      attemptCount: 3,
      createdAt: "2026-11-09T20:12:05Z",
    },
    {
      id: "wh_3007",
      eventType: "invoice.payment_succeeded",
      accountId: "acct_1005",
      companyName: "Linearity Cloud Systems #5",
      invoiceId: "in_9005",
      amountCents: 1_890_000,
      status: "DELIVERED",
      failureReason: "200 OK (38ms)",
      attemptCount: 1,
      createdAt: "2026-11-09T19:58:11Z",
    },
    {
      id: "wh_3008",
      eventType: "invoice.payment_failed",
      accountId: "acct_1026",
      companyName: "Vectra AI Labs #26",
      invoiceId: "in_9026",
      amountCents: 195_000,
      status: "PENDING_RETRY",
      failureReason: "authentication_required: SEPA mandate re-verification",
      attemptCount: 1,
      createdAt: "2026-11-09T19:40:22Z",
    },
  ];
  webhooks[5]!.eventType = "invoice.payment_failed";

  const auditLog: FinOpsAuditEntry[] = [
    {
      id: "audit_init_1",
      timestamp: "2026-11-09T21:00:00.000Z",
      actionType: "RETRY_FAILED_WEBHOOK",
      accountId: "acct_1005",
      companyName: "Linearity Cloud Systems #5",
      summary:
        "Initial automated settlement verified for invoice in_9005 via STRIPE_PRIMARY",
      mrrDeltaCents: 0,
      operator: "system@genui-finops.io",
    },
  ];

  const metrics = recomputeMetricsFromAccounts(accounts);

  return {
    ledger: {
      metrics,
      accounts,
      mrrHistory,
      cohorts,
      webhooks,
      auditLog,
      selectedAccountId: "acct_1001",
      filters: {
        searchQuery: "",
        status: "ALL",
        region: "ALL",
        sortField: "mrrCents",
        sortDirection: "descending",
        page: 1,
      },
    },
  };
}

/**
 * Executes a real, deterministic financial mutation against the 240-account SaaS ledger.
 * Uses `store.update(...)` when available so TimeTravelStateStore records a single atomic
 * undo/redo snapshot per action execution.
 */
export function executeFinOpsMutation(
  store: MutableLedgerStoreAdapter,
  actionType:
    | "issuePartialRefund"
    | "extendTrialPeriod"
    | "retryFailedWebhook"
    | "applyRetentionDiscount",
  payload: Record<string, unknown>
): FinOpsAuditEntry {
  const accounts = structuredClone(
    (store.get("/ledger/accounts") as CustomerAccount[] | undefined) ?? []
  );
  const webhooks = structuredClone(
    (store.get("/ledger/webhooks") as WebhookEventRecord[] | undefined) ?? []
  );
  const auditLog = structuredClone(
    (store.get("/ledger/auditLog") as FinOpsAuditEntry[] | undefined) ?? []
  );

  let auditEntry: FinOpsAuditEntry;

  if (actionType === "issuePartialRefund") {
    const accountId = String(payload.accountId ?? "acct_1001");
    const invoiceId = String(payload.invoiceId ?? "in_9001");
    const amountCents = Math.max(
      100,
      Math.min(50_000_000, Math.round(Number(payload.amountCents ?? 185_000)))
    );
    const reason = String(payload.reason ?? "DISPUTE_RESOLUTION");

    const acct =
      accounts.find((a) => a.id === accountId) ?? accounts[0]!;
    acct.disputedAmountCents = Math.max(
      0,
      acct.disputedAmountCents - amountCents
    );
    acct.mrrCents = Math.max(0, acct.mrrCents - Math.round(amountCents * 0.25));
    acct.arrCents = acct.mrrCents * 12;
    if (acct.disputedAmountCents === 0) {
      acct.status = "ACTIVE";
      acct.lastInvoiceStatus = "PAID";
      acct.failedChargesCount = 0;
    }
    acct.healthScore = Math.min(100, acct.healthScore + 22);

    auditEntry = {
      id: `audit_${Date.now()}_${auditLog.length + 1}`,
      timestamp: new Date().toISOString(),
      actionType: "ISSUE_PARTIAL_REFUND",
      accountId: acct.id,
      companyName: acct.companyName,
      summary: `Issued ${formatUsdCents(amountCents)} credit refund on ${invoiceId} (${reason}) — status: ${acct.status}`,
      mrrDeltaCents: -Math.round(amountCents * 0.25),
      operator: "operator@genui-finops.io",
    };
  } else if (actionType === "extendTrialPeriod") {
    const accountId = String(payload.accountId ?? "acct_1008");
    const extensionDays = Math.max(
      3,
      Math.min(60, Math.round(Number(payload.extensionDays ?? 14)))
    );
    const note = String(payload.note ?? "Enterprise onboarding extension");

    const acct =
      accounts.find((a) => a.id === accountId) ?? accounts[0]!;
    acct.trialDaysRemaining += extensionDays;
    acct.status = "TRIALING";
    acct.healthScore = Math.min(100, acct.healthScore + 12);

    auditEntry = {
      id: `audit_${Date.now()}_${auditLog.length + 1}`,
      timestamp: new Date().toISOString(),
      actionType: "EXTEND_TRIAL",
      accountId: acct.id,
      companyName: acct.companyName,
      summary: `Extended trial window for ${acct.companyName} by +${extensionDays} days (now ${acct.trialDaysRemaining}d left) — ${note}`,
      mrrDeltaCents: 0,
      operator: "operator@genui-finops.io",
    };
  } else if (actionType === "retryFailedWebhook") {
    const webhookId = String(payload.webhookId ?? "wh_3001");
    const routeGateway = String(payload.routeGateway ?? "STRIPE_EU_FALLBACK");

    const wh = webhooks.find((w) => w.id === webhookId) ?? webhooks[0]!;
    wh.status = "DELIVERED";
    wh.attemptCount += 1;
    wh.failureReason = `Settled via ${routeGateway} (200 OK)`;

    const acct =
      accounts.find((a) => a.id === wh.accountId) ?? accounts[0]!;
    const recoveredCents = acct.disputedAmountCents || wh.amountCents;
    acct.status = "ACTIVE";
    acct.lastInvoiceStatus = "PAID";
    acct.failedChargesCount = 0;
    acct.disputedAmountCents = 0;
    acct.healthScore = Math.min(100, acct.healthScore + 28);

    auditEntry = {
      id: `audit_${Date.now()}_${auditLog.length + 1}`,
      timestamp: new Date().toISOString(),
      actionType: "RETRY_FAILED_WEBHOOK",
      accountId: acct.id,
      companyName: acct.companyName,
      summary: `Replayed webhook ${wh.id} via ${routeGateway} — settled ${formatUsdCents(recoveredCents)} on ${wh.invoiceId}`,
      mrrDeltaCents: recoveredCents,
      operator: "operator@genui-finops.io",
    };
  } else {
    // applyRetentionDiscount
    const accountId = String(payload.accountId ?? "acct_1004");
    const discountPercent = Math.max(
      5,
      Math.min(50, Number(payload.discountPercent ?? 20))
    );
    const durationMonths = Math.max(
      1,
      Math.min(12, Math.round(Number(payload.durationMonths ?? 6)))
    );
    const justification = String(
      payload.justification ?? "Executive retention save"
    );

    const acct =
      accounts.find((a) => a.id === accountId) ?? accounts[0]!;
    const previousMrr = acct.mrrCents;
    const nextMrr = Math.round(acct.mrrCents * (1 - discountPercent / 100));
    acct.discountPercent = discountPercent;
    acct.mrrCents = nextMrr;
    acct.arrCents = nextMrr * 12;
    acct.status = "ACTIVE";
    acct.healthScore = Math.min(100, acct.healthScore + 24);

    auditEntry = {
      id: `audit_${Date.now()}_${auditLog.length + 1}`,
      timestamp: new Date().toISOString(),
      actionType: "APPLY_RETENTION_DISCOUNT",
      accountId: acct.id,
      companyName: acct.companyName,
      summary: `Applied ${discountPercent}% retention discount (${durationMonths}mo) to ${acct.companyName} — ${justification}`,
      mrrDeltaCents: nextMrr - previousMrr,
      operator: "operator@genui-finops.io",
    };
  }

  auditLog.unshift(auditEntry);
  const nextMetrics = recomputeMetricsFromAccounts(accounts);

  if (typeof store.update === "function") {
    store.update({
      "/ledger/accounts": accounts,
      "/ledger/webhooks": webhooks,
      "/ledger/auditLog": auditLog,
      "/ledger/metrics": nextMetrics,
    });
  } else {
    store.set("/ledger/accounts", accounts);
    store.set("/ledger/webhooks", webhooks);
    store.set("/ledger/auditLog", auditLog);
    store.set("/ledger/metrics", nextMetrics);
  }

  return auditEntry;
}
