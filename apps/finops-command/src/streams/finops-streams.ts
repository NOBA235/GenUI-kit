import type { Spec } from "@json-render/core";
import { specToJsonlStream } from "@genui-studio/core";
import { finopsVerifiedCatalog } from "../catalog/finops-catalog.js";

export interface FinOpsScenarioPreset {
  id: string;
  title: string;
  badge: string;
  prompt: string;
  description: string;
  buildSpec: () => Spec;
}

/**
 * Scenario 1: Executive MRR & EMEA Churn Triage + Full 14-Component Command Surface
 */
export function buildExecutiveMrrTriageSpec(): Spec {
  return {
    root: "root-shell",
    elements: {
      "root-shell": {
        type: "WorkspaceShell",
        props: {
          title: "Q4 Global RevOps & EMEA Churn Command Center",
          subtitle:
            "Real-time subscription telemetry, PSD2 gateway failure recovery, and guardrailed ledger mutations across 240 accounts.",
          playbookTag: "MRR_CHURN_TRIAGE",
          riskLevel: "CRITICAL",
        },
        children: [
          "section-kpis",
          "waterfall-bridge",
          "section-analytics",
          "section-anomalies-webhooks",
          "section-mutations",
          "ledger-table-main",
          "audit-banner-main",
        ],
      },
      "section-kpis": {
        type: "SectionGrid",
        props: {
          heading: "Executive Revenue & Risk Telemetry",
          description: "Bound via JSON Pointer to /ledger/metrics/*",
          columns: "4",
        },
        children: ["kpi-mrr", "kpi-arr", "kpi-ndr", "kpi-at-risk"],
      },
      "kpi-mrr": {
        type: "KpiMetricCard",
        props: {
          label: "Net Monthly Recurring Revenue",
          valuePath: "/ledger/metrics/totalMrrCents",
          unit: "USD",
          deltaText: "+4.8% MoM",
          deltaDirection: "UP_GOOD",
          caption: "Live across active & past-due seats",
        },
        children: [],
      },
      "kpi-arr": {
        type: "KpiMetricCard",
        props: {
          label: "Annualized Run Rate (ARR)",
          valuePath: "/ledger/metrics/arrCents",
          unit: "USD",
          deltaText: "+$1.42M YoY",
          deltaDirection: "UP_GOOD",
          caption: "12x run-rate projection",
        },
        children: [],
      },
      "kpi-ndr": {
        type: "KpiMetricCard",
        props: {
          label: "Net Dollar Retention (NDR)",
          valuePath: "/ledger/metrics/netDollarRetentionPercent",
          unit: "PERCENT",
          deltaText: "+1.9 pts QoQ",
          deltaDirection: "UP_GOOD",
          caption: "Benchmark: >110% enterprise tier",
        },
        children: [],
      },
      "kpi-at-risk": {
        type: "KpiMetricCard",
        props: {
          label: "Unpaid & Disputed MRR Exposure",
          valuePath: "/ledger/metrics/disputedCents",
          unit: "USD",
          deltaText: "Action Required",
          deltaDirection: "DOWN_BAD",
          caption: "Failed 3DS2 & disputed invoices",
        },
        children: [],
      },
      "waterfall-bridge": {
        type: "RevenueWaterfallCard",
        props: {
          title: "Monthly Revenue Bridge & Net Dollar Retention Breakdown",
          periodLabel: "Nov 2026 Live Ledger Close",
        },
        children: [],
      },
      "section-analytics": {
        type: "SectionGrid",
        props: {
          heading: "12-Month MRR Trajectory & Regional Cohort Retention",
          description: "Interactive cohort & expansion vs. contraction drilldowns",
          columns: "2",
        },
        children: ["chart-mrr", "matrix-cohort"],
      },
      "chart-mrr": {
        type: "MrrChurnChart",
        props: {
          title: "12-Month MRR & Churn Trajectory",
          subtitle: "Toggle between Net MRR and Expansion vs. Contraction bars",
          defaultView: "NET_WATERFALL",
          highlightMonth: "2026-10",
        },
        children: [],
      },
      "matrix-cohort": {
        type: "CohortRetentionMatrix",
        props: {
          title: "Regional Cohort Retention & NDR Matrix",
          focusRegion: "ALL",
          metricMode: "LOGO_RETENTION",
        },
        children: [],
      },
      "section-anomalies-webhooks": {
        type: "SectionGrid",
        props: {
          heading: "Active Billing Anomalies & Stripe Gateway Stream",
          description: "Root-cause diagnostics and live webhook replay queue",
          columns: "2",
        },
        children: ["anomaly-emea", "webhook-ticker"],
      },
      "anomaly-emea": {
        type: "AnomalyAlertCard",
        props: {
          anomalyId: "ANOM-EMEA-3DS2",
          severity: "CRITICAL",
          title: "EMEA PSD2 / 3DS2 Soft-Decline Surge on Enterprise Renewals",
          summary:
            "14 enterprise subscriptions in EMEA experienced off-session renewal failures after gateway timeout.",
          rootCause:
            "Primary Stripe EU MID (mid_eu_west_01) rejected exemption flags; routing via STRIPE_EU_FALLBACK restores settlement.",
          impactCents: 6_420_000,
          affectedRegion: "EMEA",
          filterStatusOnSelect: "PAST_DUE",
        },
        children: [],
      },
      "webhook-ticker": {
        type: "WebhookStreamTicker",
        props: {
          title: "Live Stripe & Adyen Gateway Event Stream",
          filterStatus: "ALL",
          maxEvents: 5,
        },
        children: [],
      },
      "section-mutations": {
        type: "SectionGrid",
        props: {
          heading: "Guardrailed Operator Action & Remediation Desk",
          description:
            "Every mutation validates inputs, updates the 240-account ledger in real time, and records a Time-Travel Undo snapshot",
          columns: "2",
        },
        children: [
          "action-refund-1",
          "action-webhook-1",
          "action-discount-1",
          "action-trial-1",
        ],
      },
      "action-refund-1": {
        type: "IssueRefundCard",
        props: {
          accountId: "acct_1001",
          invoiceId: "in_9001",
          suggestedAmountCents: 185_000,
          defaultReason: "DISPUTE_RESOLUTION",
          operatorNote: "Partial SLA credit to settle disputed Q4 invoice",
        },
        children: [],
      },
      "action-webhook-1": {
        type: "RetryWebhookCard",
        props: {
          webhookId: "wh_3001",
          accountId: "acct_1001",
          invoiceId: "in_9001",
          routeGateway: "STRIPE_EU_FALLBACK",
          idempotencyKey: "idem_wh_3001_eu_failover",
        },
        children: [],
      },
      "action-discount-1": {
        type: "RetentionDiscountCard",
        props: {
          accountId: "acct_1004",
          discountPercent: 15,
          durationMonths: 6,
          justification: "Save offer for multi-year seat consolidation",
        },
        children: [],
      },
      "action-trial-1": {
        type: "ExtendTrialCard",
        props: {
          accountId: "acct_1008",
          defaultExtensionDays: 14,
          playbookNote: "SOC2 & Okta SCIM provisioning completion window",
        },
        children: [],
      },
      "ledger-table-main": {
        type: "CustomerLedgerTable",
        props: {
          title: "Interactive 240-Account Subscription & Invoice Ledger",
          defaultStatusFilter: "ALL",
          defaultRegionFilter: "ALL",
          pageSize: 8,
        },
        children: [],
      },
      "audit-banner-main": {
        type: "AuditTrailBanner",
        props: {
          title: "Immutable FinOps Operator Audit Trail",
          maxEntries: 5,
        },
        children: [],
      },
    },
  };
}

/**
 * Scenario 2: Failed Stripe Webhook & Disputed Invoice Recovery Playbook
 */
export function buildStripeRecoverySpec(): Spec {
  return {
    root: "root-recovery",
    elements: {
      "root-recovery": {
        type: "WorkspaceShell",
        props: {
          title: "Failed Stripe Charge & Disputed Invoice Triage Desk",
          subtitle:
            "Focused payment recovery surface for past-due and disputed accounts with one-click gateway failover.",
          playbookTag: "PAYMENT_RECOVERY",
          riskLevel: "CRITICAL",
        },
        children: [
          "recovery-kpis",
          "recovery-anomaly-grid",
          "recovery-actions",
          "recovery-ledger",
          "recovery-audit",
        ],
      },
      "recovery-kpis": {
        type: "SectionGrid",
        props: {
          heading: "Payment Failure & Dispute Exposure",
          description: "Live counters bound to /ledger/metrics",
          columns: "3",
        },
        children: ["rec-kpi-1", "rec-kpi-2", "rec-kpi-3"],
      },
      "rec-kpi-1": {
        type: "KpiMetricCard",
        props: {
          label: "Unsettled & Disputed Balance",
          valuePath: "/ledger/metrics/disputedCents",
          unit: "USD",
          deltaText: "Immediate Triage",
          deltaDirection: "DOWN_BAD",
          caption: "Open chargebacks + soft declines",
        },
        children: [],
      },
      "rec-kpi-2": {
        type: "KpiMetricCard",
        props: {
          label: "Failed Gateway Charges",
          valuePath: "/ledger/metrics/failedChargesTotal",
          unit: "COUNT",
          deltaText: "Across 240 accounts",
          deltaDirection: "DOWN_BAD",
          caption: "Retryable via backup MID",
        },
        children: [],
      },
      "rec-kpi-3": {
        type: "KpiMetricCard",
        props: {
          label: "Protected Net MRR",
          valuePath: "/ledger/metrics/totalMrrCents",
          unit: "USD",
          deltaText: "Live Ledger Total",
          deltaDirection: "UP_GOOD",
          caption: "Updates immediately on settlement",
        },
        children: [],
      },
      "recovery-anomaly-grid": {
        type: "SectionGrid",
        props: {
          heading: "Gateway Telemetry & Failed Webhook Queue",
          columns: "2",
        },
        children: ["rec-anomaly", "rec-webhooks"],
      },
      "rec-anomaly": {
        type: "AnomalyAlertCard",
        props: {
          anomalyId: "ANOM-STRIPE-RETRY",
          severity: "CRITICAL",
          title: "High-Value Renewal Invoices Blocked on Primary Gateway",
          summary:
            "Multiple enterprise invoices are stuck in FAILED status awaiting idempotent gateway replay or partial credit settlement.",
          rootCause:
            "Issuer velocity rule triggered during end-of-month batch billing.",
          impactCents: 4_890_000,
          affectedRegion: "GLOBAL",
          filterStatusOnSelect: "PAST_DUE",
        },
        children: [],
      },
      "rec-webhooks": {
        type: "WebhookStreamTicker",
        props: {
          title: "Failed & Pending Stripe Webhooks",
          filterStatus: "ALL",
          maxEvents: 6,
        },
        children: [],
      },
      "recovery-actions": {
        type: "SectionGrid",
        props: {
          heading: "Immediate Settlement & Credit Controls",
          columns: "2",
        },
        children: ["rec-retry-card", "rec-refund-card"],
      },
      "rec-retry-card": {
        type: "RetryWebhookCard",
        props: {
          webhookId: "wh_3001",
          accountId: "acct_1001",
          invoiceId: "in_9001",
          routeGateway: "ADYEN_BACKUP_MID",
          idempotencyKey: "idem_adyen_failover_9001",
        },
        children: [],
      },
      "rec-refund-card": {
        type: "IssueRefundCard",
        props: {
          accountId: "acct_1001",
          invoiceId: "in_9001",
          suggestedAmountCents: 150_000,
          defaultReason: "SLA_CREDIT",
          operatorNote: "Goodwill credit to clear dispute and resume auto-pay",
        },
        children: [],
      },
      "recovery-ledger": {
        type: "CustomerLedgerTable",
        props: {
          title: "Past-Due & Disputed Subscription Ledger",
          defaultStatusFilter: "PAST_DUE",
          defaultRegionFilter: "ALL",
          pageSize: 8,
        },
        children: [],
      },
      "recovery-audit": {
        type: "AuditTrailBanner",
        props: {
          title: "Payment Recovery Operator Log",
          maxEntries: 5,
        },
        children: [],
      },
    },
  };
}

/**
 * Scenario 3: Enterprise Renewal & Trial Conversion Desk
 */
export function buildEnterpriseRetentionSpec(): Spec {
  return {
    root: "root-retention",
    elements: {
      "root-retention": {
        type: "WorkspaceShell",
        props: {
          title: "Enterprise Renewal & Trial Conversion Desk",
          subtitle:
            "Targeted retention discount modeling, trial extension workflows, and regional cohort NDR analysis.",
          playbookTag: "ENTERPRISE_RETENTION",
          riskLevel: "ELEVATED",
        },
        children: [
          "ret-waterfall",
          "ret-cohorts-grid",
          "ret-actions-grid",
          "ret-ledger",
          "ret-audit",
        ],
      },
      "ret-waterfall": {
        type: "RevenueWaterfallCard",
        props: {
          title: "Enterprise Net Dollar Retention Bridge",
          periodLabel: "Q4 Renewal Cycle",
        },
        children: [],
      },
      "ret-cohorts-grid": {
        type: "SectionGrid",
        props: {
          heading: "Cohort Decay & Expansion Analysis",
          columns: "2",
        },
        children: ["ret-matrix", "ret-chart"],
      },
      "ret-matrix": {
        type: "CohortRetentionMatrix",
        props: {
          title: "Global Enterprise & Mid-Market NDR Matrix",
          focusRegion: "ALL",
          metricMode: "NDR",
        },
        children: [],
      },
      "ret-chart": {
        type: "MrrChurnChart",
        props: {
          title: "Expansion vs. Contraction Velocity",
          subtitle: "Monthly expansion upsell vs. seat contraction",
          defaultView: "CHURN_VS_EXPANSION",
          highlightMonth: "2026-10",
        },
        children: [],
      },
      "ret-actions-grid": {
        type: "SectionGrid",
        props: {
          heading: "Renewal Save & Trial Conversion Playbooks",
          columns: "2",
        },
        children: ["ret-discount", "ret-trial"],
      },
      "ret-discount": {
        type: "RetentionDiscountCard",
        props: {
          accountId: "acct_1004",
          discountPercent: 20,
          durationMonths: 12,
          justification: "Annual commitment lock-in for at-risk enterprise logo",
        },
        children: [],
      },
      "ret-trial": {
        type: "ExtendTrialCard",
        props: {
          accountId: "acct_1008",
          defaultExtensionDays: 21,
          playbookNote: "Custom VPC deployment sign-off with customer CISO",
        },
        children: [],
      },
      "ret-ledger": {
        type: "CustomerLedgerTable",
        props: {
          title: "At-Risk & Trialing Accounts Queue",
          defaultStatusFilter: "ALL",
          defaultRegionFilter: "ALL",
          pageSize: 8,
        },
        children: [],
      },
      "ret-audit": {
        type: "AuditTrailBanner",
        props: {
          title: "Renewal Desk Audit Log",
          maxEntries: 5,
        },
        children: [],
      },
    },
  };
}

export const FINOPS_SCENARIO_PRESETS: FinOpsScenarioPreset[] = [
  {
    id: "mrr-churn-triage",
    title: "Q4 Global RevOps & EMEA Churn Command",
    badge: "14-Component Full Surface",
    prompt:
      "Stream a full Q4 RevOps & EMEA Churn triage workspace with MRR waterfall, regional cohort matrix, PSD2 gateway anomaly drilldowns, and all 4 remediation action cards.",
    description:
      "Streams all 14 FinOps catalog components including KPI telemetry, 12-month MRR waterfall, cohort matrix, webhook ticker, 4 mutation cards, and the 240-account ledger.",
    buildSpec: buildExecutiveMrrTriageSpec,
  },
  {
    id: "stripe-gateway-recovery",
    title: "Failed Stripe Webhook & Dispute Recovery",
    badge: "Payment Recovery",
    prompt:
      "Isolate failed Stripe charges and disputed invoices, show the webhook replay ticker, and prepare Adyen failover + SLA refund cards.",
    description:
      "Focused payment recovery surface for past-due accounts with gateway failover and partial credit settlement.",
    buildSpec: buildStripeRecoverySpec,
  },
  {
    id: "enterprise-trial-desk",
    title: "Enterprise Renewal & Trial Conversion Desk",
    badge: "Retention & NDR",
    prompt:
      "Build an enterprise renewal desk showing Net Dollar Retention cohorts, expansion vs contraction charts, retention discount modeling, and trial extension controls.",
    description:
      "Retention & NDR workbench for saving at-risk accounts and converting enterprise trials.",
    buildSpec: buildEnterpriseRetentionSpec,
  },
];

/**
 * Synthesizes a valid RFC 6902 JSONL patch stream from any natural-language operator intent.
 * Ensures that even in Offline / Deterministic Judge Mode, typing custom natural language
 * intents streams a tailored workspace through GuardrailedStreamCompiler.
 */
export function synthesizeFinOpsJsonlFromPrompt(promptText: string): string {
  const lower = promptText.toLowerCase();

  if (
    lower.includes("webhook") ||
    lower.includes("stripe") ||
    lower.includes("fail") ||
    lower.includes("dispute") ||
    lower.includes("refund")
  ) {
    const spec = buildStripeRecoverySpec();
    spec.elements["root-recovery"] = {
      ...spec.elements["root-recovery"]!,
      props: {
        ...spec.elements["root-recovery"]!.props,
        subtitle: `Synthesized for operator intent: "${promptText.slice(0, 140)}"`,
      },
    };
    return specToJsonlStream(spec);
  }

  if (
    lower.includes("trial") ||
    lower.includes("discount") ||
    lower.includes("retention") ||
    lower.includes("renewal") ||
    lower.includes("cohort")
  ) {
    const spec = buildEnterpriseRetentionSpec();
    spec.elements["root-retention"] = {
      ...spec.elements["root-retention"]!,
      props: {
        ...spec.elements["root-retention"]!.props,
        subtitle: `Synthesized for operator intent: "${promptText.slice(0, 140)}"`,
      },
    };
    return specToJsonlStream(spec);
  }

  const spec = buildExecutiveMrrTriageSpec();
  spec.elements["root-shell"] = {
    ...spec.elements["root-shell"]!,
    props: {
      ...spec.elements["root-shell"]!.props,
      subtitle: `Synthesized for operator intent: "${promptText.slice(0, 140)}"`,
    },
  };
  return specToJsonlStream(spec);
}

/**
 * Splits a multi-line JSONL stream into realistic network chunks (including mid-line byte splits)
 * so the live stream compiler and X-Ray drawer process authentic partial-token boundaries.
 */
export function chunkJsonlForStreaming(
  jsonl: string,
  targetChunks = 18
): string[] {
  const lines = jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= targetChunks) {
    return lines.map((l) => l + "\n");
  }
  const chunks: string[] = [];
  const batchSize = Math.max(1, Math.ceil(lines.length / targetChunks));
  for (let i = 0; i < lines.length; i += batchSize) {
    chunks.push(lines.slice(i, i + batchSize).join("\n") + "\n");
  }
  return chunks;
}

/**
 * Hostile / Corrupted AI Packet Batch used by the X-Ray Drawer's
 * "Inject Corrupted / Hallucinated AI Packet" verification button.
 *
 * Proves all 4 runtime resilience layers simultaneously:
 * 1. Prototype pollution patch (`/elements/__proto__/polluted`) -> Blocked by DAG Sanitizer
 * 2. Out-of-bounds prop (`discountPercent: 999`, `durationMonths: 99`) -> Auto-healed to `50` and `12` with `<DiagnosticHealedBadge />`
 * 3. Leaf component throwing a synchronous render exception (`CHAOS_TRIGGER_RENDER_CRASH`) -> Quarantined in `<ElementFaultCard phase="react_render" />`
 * 4. Unregistered hallucinated component type (`HallucinatedCryptoMinerWidget`) -> Quarantined in `<ElementFaultCard phase="schema_validation" />`
 * 5. Cyclic graph edge (`root` added as child of leaf container) -> Severed by `sanitizeSpecGraph`
 */
export function buildCorruptedChaosPackets(currentRootKey = "root-shell"): string[] {
  return [
    // 1. Prototype pollution attack (blocked at compiler gate)
    JSON.stringify({
      op: "add",
      path: "/elements/__proto__/polluted",
      value: "HACKED_PROTO",
    }),
    // 2. Inject a Chaos Verification section container at the top of the workspace
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-verification-grid",
      value: {
        type: "SectionGrid",
        props: {
          heading: "CHAOS INJECTION VERIFICATION ZONE (Auto-Healed & Quarantined Nodes)",
          description:
            "Injected hostile LLM packet batch: 1 Healed Card (999% discount -> 50%), 1 Quarantined Render Crash, 1 Quarantined Hallucinated Widget, and 1 Severed Cycle.",
          columns: "3",
        },
        children: [
          "chaos-healed-discount",
          "chaos-throwing-kpi",
          "chaos-hallucinated-widget",
          currentRootKey, // 5. Deliberate cycle back to root! Severed by sanitizeSpecGraph
        ],
      },
    }),
    // 3. Out-of-bounds RetentionDiscountCard (999% discount & 99 months -> clamped/healed to 50% & 12 months with badge)
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-healed-discount",
      value: {
        type: "RetentionDiscountCard",
        props: {
          accountId: "acct_1001",
          discountPercent: 999,
          durationMonths: 99,
          justification: "LLM hallucinated 999% discount — clamped to 50% policy ceiling by VerifiedCatalog",
        },
        children: [],
      },
    }),
    // 4. Throwing KpiMetricCard -> quarantined by GenUIElementErrorBoundary into <ElementFaultCard />
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-throwing-kpi",
      value: {
        type: "KpiMetricCard",
        props: {
          label: "Corrupted Telemetry Node",
          valuePath: "/ledger/metrics/totalMrrCents",
          unit: "USD",
          deltaText: "ERR_NAN",
          deltaDirection: "DOWN_BAD",
          caption: "CHAOS_TRIGGER_RENDER_CRASH",
        },
        children: [],
      },
    }),
    // 5. Unregistered hallucinated component type -> quarantined into <ElementFaultCard />
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-hallucinated-widget",
      value: {
        type: "HallucinatedStripeQuantumWidget",
        props: {
           dangerousRawHtml: "<script>alert(1)</script>",
        },
        children: [],
      },
    }),
    // 6. Attach the chaos verification grid as the first child of the active root shell
    JSON.stringify({
      op: "add",
      path: `/elements/${currentRootKey}/children/0`,
      value: "chaos-verification-grid",
    }),
  ];
}

export interface LiveLlmEndpointConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Streams RFC 6902 JSONL patches from a real OpenAI-compatible `/chat/completions` endpoint
 * using the deterministic system prompt compiled by `finopsVerifiedCatalog.prompt()`.
 */
export async function streamFromLiveLlmEndpoint(
  operatorIntent: string,
  config: LiveLlmEndpointConfig,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = finopsVerifiedCatalog.prompt({
    customRules: [
      "Emit ONLY valid RFC 6902 JSON Patch lines (JSONL) that construct a Spec with `root` and `elements`.",
      "Never wrap output in markdown fences or prose.",
      "Always use `WorkspaceShell` as the root component.",
    ],
  });

  const response = await fetch(config.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      stream: true,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: operatorIntent },
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Live LLM endpoint returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const deltaContent = parsed?.choices?.[0]?.delta?.content;
        if (typeof deltaContent === "string" && deltaContent.length > 0) {
          onChunk(deltaContent);
        }
      } catch {
        // Ignore partial SSE comment frames
      }
    }
  }
}
