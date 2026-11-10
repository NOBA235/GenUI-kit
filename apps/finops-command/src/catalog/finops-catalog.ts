import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

/**
 * 14-Component Production FinOps & RevOps Verified Catalog
 * Built on @genui-studio/core + @json-render/react/schema.
 *
 * Every component declares:
 * - Strict Zod prop schemas (min/max bounds, enums, non-empty strings)
 * - Deterministic `fallbackProps` so malformed or out-of-bounds LLM props heal at the prop level
 *   and emit a `<DiagnosticHealedBadge />` without dropping the rest of the component.
 */
export const finopsCatalogDefinitions = {
  components: {
    WorkspaceShell: {
      description:
        "Top-level FinOps command center shell organizing narrative summary, active playbook metadata, and child sections.",
      props: z.object({
        title: z.string().min(1).max(120),
        subtitle: z.string().min(1).max(260),
        playbookTag: z.enum([
          "MRR_CHURN_TRIAGE",
          "PAYMENT_RECOVERY",
          "ENTERPRISE_RETENTION",
          "CUSTOM_QUERY",
          "CHAOS_VERIFICATION",
        ]),
        riskLevel: z.enum(["NOMINAL", "ELEVATED", "CRITICAL"]),
      }),
      slots: ["default"],
      fallbackProps: {
        title: "RevOps / FinOps Command Workspace",
        subtitle: "Guardrailed Generative UI Financial Operations Surface",
        playbookTag: "CUSTOM_QUERY" as const,
        riskLevel: "ELEVATED" as const,
      },
    },

    SectionGrid: {
      description:
        "Responsive multi-column CSS Grid section container for grouping KPI cards, charts, tables, or action cards.",
      props: z.object({
        heading: z.string().min(1).max(100),
        description: z.string().max(220).optional(),
        columns: z.enum(["1", "2", "3", "4"]),
      }),
      slots: ["default"],
      fallbackProps: {
        heading: "Operational Section",
        description: "Live financial telemetry and controls",
        columns: "2" as const,
      },
    },

    KpiMetricCard: {
      description:
        "Executive FinOps KPI telemetry card bound to a JSON Pointer path in the ledger store with delta trend and sparkline.",
      props: z.object({
        label: z.string().min(1).max(64),
        valuePath: z.string().min(1).max(120),
        unit: z.enum(["USD", "PERCENT", "COUNT"]),
        deltaText: z.string().min(1).max(48),
        deltaDirection: z.enum(["UP_GOOD", "DOWN_BAD", "DOWN_GOOD", "NEUTRAL"]),
        caption: z.string().min(1).max(140),
      }),
      slots: [],
      fallbackProps: {
        label: "Net MRR",
        valuePath: "/ledger/metrics/totalMrrCents",
        unit: "USD" as const,
        deltaText: "+4.2% MoM",
        deltaDirection: "UP_GOOD" as const,
        caption: "Live bound to /ledger/metrics/totalMrrCents",
      },
    },

    MrrChurnChart: {
      description:
        "Interactive 12-month SaaS MRR Waterfall, Expansion, Contraction, and Churn SVG visualization with hover breakdown.",
      props: z.object({
        title: z.string().min(1).max(100),
        subtitle: z.string().min(1).max(180),
        defaultView: z.enum(["NET_WATERFALL", "CHURN_VS_EXPANSION", "NET_MRR_TREND"]),
        highlightMonth: z.string().max(20).optional(),
      }),
      slots: [],
      fallbackProps: {
        title: "12-Month MRR & Churn Trajectory",
        subtitle: "New, expansion, contraction, and churned revenue across cohorts",
        defaultView: "NET_WATERFALL" as const,
        highlightMonth: "2026-10",
      },
    },

    CohortRetentionMatrix: {
      description:
        "Regional and plan-tier Net Dollar Retention (NDR) and logo retention heatmap matrix with M0-M6 decay curves.",
      props: z.object({
        title: z.string().min(1).max(100),
        focusRegion: z.enum(["ALL", "NA", "EMEA", "APAC", "LATAM"]),
        metricMode: z.enum(["LOGO_RETENTION", "NDR"]),
      }),
      slots: [],
      fallbackProps: {
        title: "Regional Cohort Retention & NDR Matrix",
        focusRegion: "ALL" as const,
        metricMode: "LOGO_RETENTION" as const,
      },
    },

    AnomalyAlertCard: {
      description:
        "Billing or churn anomaly detection card with severity badge, root-cause drilldown, affected MRR impact, and quick filter trigger.",
      props: z.object({
        anomalyId: z.string().min(1).max(48),
        severity: z.enum(["CRITICAL", "HIGH", "MEDIUM"]),
        title: z.string().min(1).max(120),
        summary: z.string().min(1).max(280),
        rootCause: z.string().min(1).max(280),
        impactCents: z.number().int().min(0).max(500_000_000),
        affectedRegion: z.enum(["NA", "EMEA", "APAC", "LATAM", "GLOBAL"]),
        filterStatusOnSelect: z.enum(["ALL", "PAST_DUE", "AT_RISK", "DISPUTED"]).optional(),
      }),
      slots: [],
      fallbackProps: {
        anomalyId: "ANOM-EMEA-3DS",
        severity: "CRITICAL" as const,
        title: "EMEA PSD2 / 3DS2 Gateway Declines Spike",
        summary: "Unusual surge in soft-declined renewal charges across EU enterprise accounts.",
        rootCause: "Stripe EU gateway rule timeout on recurring off-session SEPA & Visa cards.",
        impactCents: 6_420_000,
        affectedRegion: "EMEA" as const,
        filterStatusOnSelect: "PAST_DUE" as const,
      },
    },

    CustomerLedgerTable: {
      description:
        "WCAG-compliant sortable, filterable, paginated 240-account SaaS subscription & invoice ledger bound to /ledger/accounts and /ledger/filters.",
      props: z.object({
        title: z.string().min(1).max(100),
        defaultStatusFilter: z.enum(["ALL", "ACTIVE", "PAST_DUE", "AT_RISK", "TRIALING", "DISPUTED", "CHURNED"]).optional(),
        defaultRegionFilter: z.enum(["ALL", "NA", "EMEA", "APAC", "LATAM"]).optional(),
        pageSize: z.number().int().min(5).max(25),
      }),
      slots: [],
      fallbackProps: {
        title: "Live Subscription & Invoice Ledger (240 SaaS Accounts)",
        defaultStatusFilter: "ALL" as const,
        defaultRegionFilter: "ALL" as const,
        pageSize: 8,
      },
    },

    WebhookStreamTicker: {
      description:
        "Live Stripe & billing gateway webhook event feed showing delivery status, latency, failure reason, and one-click retry action.",
      props: z.object({
        title: z.string().min(1).max(100),
        filterStatus: z.enum(["ALL", "FAILED", "DELIVERED", "PENDING_RETRY"]),
        maxEvents: z.number().int().min(3).max(20),
      }),
      slots: [],
      fallbackProps: {
        title: "Stripe Gateway Webhook Stream",
        filterStatus: "ALL" as const,
        maxEvents: 6,
      },
    },

    IssueRefundCard: {
      description:
        "Interactive guardrailed mutation card to issue a partial or full credit refund on a disputed or failed invoice with confirmation gate.",
      props: z.object({
        accountId: z.string().min(1).max(32),
        invoiceId: z.string().min(1).max(32),
        suggestedAmountCents: z.number().int().min(100).max(50_000_000),
        defaultReason: z.enum([
          "SLA_CREDIT",
          "DUPLICATE_CHARGE",
          "GOODWILL_RETENTION",
          "DISPUTE_RESOLUTION",
        ]),
        operatorNote: z.string().min(3).max(240),
      }),
      slots: [],
      fallbackProps: {
        accountId: "acct_1001",
        invoiceId: "in_9001",
        suggestedAmountCents: 245_000,
        defaultReason: "DISPUTE_RESOLUTION" as const,
        operatorNote: "Pro-rata SLA credit to settle disputed enterprise renewal charge",
      },
    },

    ExtendTrialCard: {
      description:
        "Interactive guardrailed mutation card to extend an enterprise or growth trial window and log an onboarding playbook.",
      props: z.object({
        accountId: z.string().min(1).max(32),
        defaultExtensionDays: z.number().int().min(3).max(60),
        playbookNote: z.string().min(3).max(240),
      }),
      slots: [],
      fallbackProps: {
        accountId: "acct_1008",
        defaultExtensionDays: 14,
        playbookNote: "SSO & Snowflake connector security review completion extension",
      },
    },

    RetryWebhookCard: {
      description:
        "Interactive guardrailed mutation card to replay a failed Stripe charge/invoice webhook across primary or backup payment gateways.",
      props: z.object({
        webhookId: z.string().min(1).max(32),
        accountId: z.string().min(1).max(32),
        invoiceId: z.string().min(1).max(32),
        routeGateway: z.enum([
          "STRIPE_PRIMARY",
          "STRIPE_EU_FALLBACK",
          "ADYEN_BACKUP_MID",
        ]),
        idempotencyKey: z.string().min(6).max(64),
      }),
      slots: [],
      fallbackProps: {
        webhookId: "wh_3001",
        accountId: "acct_1001",
        invoiceId: "in_9001",
        routeGateway: "STRIPE_EU_FALLBACK" as const,
        idempotencyKey: "idem_retry_wh_3001_v2",
      },
    },

    RetentionDiscountCard: {
      description:
        "Interactive guardrailed mutation card to apply a bounded retention discount (5% to 50%) to an at-risk or past-due subscription.",
      props: z.object({
        accountId: z.string().min(1).max(32),
        discountPercent: z.number().min(5).max(50),
        durationMonths: z.number().int().min(1).max(12),
        justification: z.string().min(3).max(240),
      }),
      slots: [],
      fallbackProps: {
        accountId: "acct_1001",
        discountPercent: 20,
        durationMonths: 6,
        justification: "Executive save offer for Q4 multi-seat renewal retention",
      },
    },

    RevenueWaterfallCard: {
      description:
        "Executive revenue bridge breakdown card displaying Starting MRR, New Logo MRR, Expansion, Contraction, Churn, and Ending Net MRR.",
      props: z.object({
        title: z.string().min(1).max(100),
        periodLabel: z.string().min(1).max(48),
      }),
      slots: [],
      fallbackProps: {
        title: "Monthly Revenue Bridge & Net Dollar Retention Breakdown",
        periodLabel: "Current Billing Cycle (Nov 2026)",
      },
    },

    AuditTrailBanner: {
      description:
        "Live immutable audit log strip showing every executed operator mutation, MRR impact delta, and one-click Time-Travel Undo hint.",
      props: z.object({
        title: z.string().min(1).max(100),
        maxEntries: z.number().int().min(2).max(10),
      }),
      slots: [],
      fallbackProps: {
        title: "Immutable FinOps Operator Audit Trail",
        maxEntries: 5,
      },
    },
  },

  actions: {
    issuePartialRefund: {
      description:
        "Issues a partial or full credit refund against an account's invoice, clears disputed/failed balance, adjusts MRR, and logs an audit entry.",
      params: z.object({
        accountId: z.string().min(1),
        invoiceId: z.string().min(1),
        amountCents: z.number().int().min(100).max(50_000_000),
        reason: z.string().min(3),
      }),
    },
    extendTrialPeriod: {
      description:
        "Extends a subscription's trial window by between 3 and 60 days, elevates health score, and records an audit entry.",
      params: z.object({
        accountId: z.string().min(1),
        extensionDays: z.number().int().min(3).max(60),
        note: z.string().min(3),
      }),
    },
    retryFailedWebhook: {
      description:
        "Re-executes a failed Stripe webhook event across the selected gateway, settles the unpaid invoice, restores account status to ACTIVE, and logs an audit entry.",
      params: z.object({
        webhookId: z.string().min(1),
        routeGateway: z.string().min(1),
        idempotencyKey: z.string().min(4),
      }),
    },
    applyRetentionDiscount: {
      description:
        "Applies a guardrailed percentage discount (5%-50%) to an at-risk subscription, updates account MRR and health score, and logs an audit entry.",
      params: z.object({
        accountId: z.string().min(1),
        discountPercent: z.number().min(5).max(50),
        durationMonths: z.number().int().min(1).max(12),
        justification: z.string().min(3),
      }),
    },
  },
};

export const finopsVerifiedCatalog = createVerifiedCatalog(
  schema,
  finopsCatalogDefinitions
);
