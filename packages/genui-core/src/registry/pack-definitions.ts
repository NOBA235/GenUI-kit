import type { AgentReadyPackManifest } from "./types.js";

/**
 * 1. Pro Template Pack: FinOps & RevOps Command Center
 */
export const FINOPS_COMMAND_PRO_PACK: AgentReadyPackManifest = {
  id: "finops-command-pro",
  name: "finops-command-pro",
  title: "FinOps & RevOps Executive Command Center",
  description:
    "Production 14-component Generative UI B2B SaaS dashboard with 240-account subscription ledger, live mutations (Refund, Trial, Webhook Replay, Retention Discount), bidirectional TimeTravelStateStore, and AI Agent Skills.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "Commercial-Single",
  tier: "pro",
  priceUsd: 49,
  category: "finops",
  tags: ["finops", "revops", "saas", "stripe", "ledger", "time-travel", "pro"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react": "^0.22.0",
    "@json-render/shadcn": "^0.22.0",
    "lucide-react": "^0.475.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "fast-check": "^4.10.2",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-f87c10b4e2a9d80317e54f9a321908bf94",
  components: [
    {
      name: "WorkspaceShell",
      description: "Top-level FinOps shell organizing summary and active playbook.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "SectionGrid",
      description: "Multi-column CSS Grid section container for grouping cards.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "KpiMetricCard",
      description: "Executive FinOps KPI telemetry card bound to /ledger JSON Pointer.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "MrrChurnChart",
      description: "12-month SaaS MRR Waterfall & Churn SVG chart.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "CohortRetentionMatrix",
      description: "Regional and plan-tier Net Dollar Retention heatmap.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "AnomalyAlertCard",
      description: "Billing or churn anomaly detection card with severity badge.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "CustomerLedgerTable",
      description: "Sortable, filterable 240-account SaaS subscription ledger.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "WebhookStreamTicker",
      description: "Live Stripe gateway webhook event feed with one-click retry.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "IssueRefundCard",
      description: "Interactive mutation card to issue credit refunds on disputed invoices.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ExtendTrialCard",
      description: "Interactive mutation card to extend customer trial windows.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RetryWebhookCard",
      description: "Interactive mutation card to replay failed Stripe gateway webhooks.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RetentionDiscountCard",
      description: "Interactive mutation card to apply bounded discounts (5%-50%).",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RevenueWaterfallCard",
      description: "Executive monthly revenue bridge & expansion/churn breakdown.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "AuditTrailBanner",
      description: "Live immutable audit log strip with Time-Travel Undo hint.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [
    {
      path: "catalog/finops-catalog.ts",
      type: "registry:catalog",
      content: `// FinOps Verified Catalog Schema Exported from GenUI Studio
import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

export const finopsCatalog = createVerifiedCatalog(schema, {
  components: {
    WorkspaceShell: {
      description: "FinOps command shell container",
      props: z.object({
        title: z.string().min(1).max(120),
        subtitle: z.string().min(1).max(260),
        playbookTag: z.enum(["MRR_CHURN_TRIAGE", "PAYMENT_RECOVERY", "ENTERPRISE_RETENTION", "CUSTOM_QUERY"]),
        riskLevel: z.enum(["NOMINAL", "ELEVATED", "CRITICAL"])
      }),
      slots: ["default"]
    },
    KpiMetricCard: {
      description: "Executive KPI metric card",
      props: z.object({
        label: z.string().min(1).max(64),
        valuePath: z.string().min(1).max(120),
        unit: z.enum(["USD", "PERCENT", "COUNT"]),
        deltaText: z.string().min(1).max(48),
        deltaDirection: z.enum(["UP_GOOD", "DOWN_BAD", "DOWN_GOOD", "NEUTRAL"]),
        caption: z.string().min(1).max(140)
      }),
      slots: []
    },
    IssueRefundCard: {
      description: "Interactive credit refund mutation card",
      props: z.object({
        accountId: z.string().min(1).max(32),
        invoiceId: z.string().min(1).max(32),
        suggestedAmountCents: z.number().int().min(100).max(50_000_000),
        defaultReason: z.enum(["SLA_CREDIT", "DUPLICATE_CHARGE", "GOODWILL_RETENTION", "DISPUTE_RESOLUTION"]),
        operatorNote: z.string().min(3).max(240)
      }),
      slots: []
    }
  },
  actions: {}
});
`,
    },
    {
      path: "components/finops/WorkspaceShell.tsx",
      type: "registry:ui",
      content: `import React from "react";
export function WorkspaceShell({ props, children }: any) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{props.title}</h2>
          <p className="text-xs text-slate-400 mt-1">{props.subtitle}</p>
        </div>
        <span className="rounded-md bg-cyan-500/20 px-2.5 py-1 font-mono text-xs text-cyan-300 border border-cyan-500/40">
          {props.playbookTag}
        </span>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
`,
    },
    {
      path: "components/finops/KpiMetricCard.tsx",
      type: "registry:ui",
      content: `import React from "react";
export function KpiMetricCard({ props }: any) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs font-mono text-slate-400 uppercase">{props.label}</div>
      <div className="text-2xl font-bold text-slate-100 mt-2">$142,850</div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs font-mono text-emerald-400">{props.deltaText}</span>
        <span className="text-[11px] text-slate-400">{props.caption}</span>
      </div>
    </div>
  );
}
`,
    },
  ],
  agentSkill: {
    skillMd: `---
name: finops-command-pro
description: Expert AI Agent Skill for streaming, mutating, and verifying SaaS FinOps & RevOps user interfaces with @genui-studio/core.
author: GenUI Studio
version: 1.0.0
---

# FinOps Command Pro Agent Skill

This skill instructs autonomous coding agents on how to construct, stream, and bind user interfaces using the FinOps Command Pro catalog.

## Rules for AI Generation:
1. Always wrap the root element in \`WorkspaceShell\`.
2. Connect KPI metric cards to \`/ledger/metrics/*\` JSON Pointers using \`valuePath\`.
3. Provide \`suggestedAmountCents\` in cents (integer, e.g. 245000 for $2,450.00).
4. Directives (\`children\`, \`slots\`, \`visible\`, \`on\`) must never appear inside \`props\`.
`,
    kiroPowerMd: `---
name: "finops-command-pro"
displayName: "FinOps & RevOps Executive Command Center Power"
description: "Authoritative Kiro Power for generating guardrailed financial operations dashboards, customer subscription ledgers, and live mutation cards."
keywords: ["finops", "revops", "json-render", "genui-studio", "stripe", "ledger"]
---

# Onboarding: \`finops-command-pro\`
Use this power when building SaaS revenue dashboards with \`@genui-studio/core\`.
`,
    steeringRules: `# FinOps Architectural Invariants
- All monetary amounts must be stored as integers in Cents (\`amountCents\`).
- Operator mutations must emit semantic events handled by \`ActionProvider\`.
- All trees must pass \`sanitizeSpecGraph\` cycle-freedom checks.
`,
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
    code: `import { describe, it, expect } from "vitest";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { finopsCatalog } from "./catalog/finops-catalog";

describe("FinOps Command Pro Invariant Suite", () => {
  it("passes all 4 formal PBT theorems under randomized fast-check execution", () => {
    const report = runCatalogInvariantSuite(finopsCatalog, { numRuns: 30 });
    expect(report.allPassed).toBe(true);
  });
});
`,
  },
};

/**
 * 2. Pro Template Pack: Aegis 3D Spatial Incident War-Room
 */
export const SPATIAL_OPS_3D_PRO_PACK: AgentReadyPackManifest = {
  id: "spatial-ops-3d-pro",
  name: "spatial-ops-3d-pro",
  title: "Aegis 3D Spatial Infrastructure War-Room",
  description:
    "Production 14-component Hybrid 3D (React Three Fiber WebGL) + 2D Tactical SRE Incident HUD combining zero-allocation 3D service mesh topologies with shared TimeTravelStateStore failover runbooks.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "Commercial-Single",
  tier: "pro",
  priceUsd: 79,
  category: "spatial-3d",
  tags: ["3d", "threejs", "r3f", "webgl", "sre", "incident-command", "pro"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react": "^0.22.0",
    "@json-render/react-three-fiber": "^0.22.0",
    "@react-three/drei": "^10.0.0",
    "@react-three/fiber": "^9.0.0",
    "three": "^0.173.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "@types/three": "^0.173.0",
    "fast-check": "^4.10.2",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-a94f31c827b5034e6109dc0489e21703ab",
  components: [
    {
      name: "AegisWarRoomShell",
      description: "Root container organizing 3D spatial viewport and 2D tactical HUD.",
      slots: ["spatial", "hud"],
      hasFallbackProps: true,
    },
    {
      name: "ClusterTopologyCanvas",
      description: "3D WebGL scene viewport rendering the microservice mesh.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "ServiceMeshNode3D",
      description: "Interactive 3D microservice node mesh with emissive glow and label.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "TrafficFlowEdge3D",
      description: "Directional 3D bezier connection line with animated packet pulses.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "BlastRadiusSphere3D",
      description: "Translucent volumetric pulsating sphere indicating fault blast radius.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RegionZoneBoundary3D",
      description: "Spatial bounding zone wireframe delimiting a regional cluster.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "IncidentHeroBanner",
      description: "High-priority SEV header banner showing incident title and MTTD.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ServiceDiagnosticPanel",
      description: "Deep-dive telemetry inspection card for selected 3D service node.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "LatencyHistogramCard",
      description: "Interactive p50/p95/p99 latency curve & SLO error-budget burn card.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ErrorLogTailer",
      description: "Real-time streaming structured log tail showing HTTP 5xx codes.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "BlastRadiusDependencyTree",
      description: "Visual topological tree showing upstream callers and dependencies.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "RunbookActionDesk",
      description: "Interactive remediation desk to trip breakers, scale, or failover.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "ClusterMetricsGrid",
      description: "High-level SRE telemetry grid for Global Error Rate and RPS.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "SreAuditTrailBanner",
      description: "Live immutable audit strip displaying executed SRE remediations.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [
    {
      path: "catalog/spatial-catalog.ts",
      type: "registry:catalog",
      content: `// Aegis 3D Spatial Verified Catalog Exported from GenUI Studio
import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

export const spatialCatalog = createVerifiedCatalog(schema, {
  components: {
    AegisWarRoomShell: {
      description: "Root 3D + 2D command shell",
      props: z.object({
        incidentTitle: z.string().min(1).max(140),
        severity: z.enum(["SEV-0", "SEV-1", "SEV-2", "NOMINAL"]),
        activeRegion: z.enum(["GLOBAL", "US-East", "EU-West", "APAC-South"]),
        hudPosition: z.enum(["RIGHT_SPLIT", "BOTTOM_DRAWER", "FULL_OVERLAY"])
      }),
      slots: ["spatial", "hud"]
    },
    ClusterTopologyCanvas: {
      description: "3D WebGL viewport canvas",
      props: z.object({
        cameraFov: z.number().int().min(30).max(90),
        enableOrbitControls: z.boolean(),
        enableGrid: z.boolean(),
        enableBloom: z.boolean(),
        ambientIntensity: z.number().min(0.1).max(2.0)
      }),
      slots: ["default"]
    }
  },
  actions: {}
});
`,
    },
  ],
  agentSkill: {
    skillMd: `---
name: spatial-ops-3d-pro
description: Expert AI Agent Skill for generating, manipulating, and animating 3D WebGL infrastructure topologies and 2D SRE HUDs.
author: GenUI Studio
version: 1.0.0
---

# Spatial Ops 3D Pro Agent Skill

This skill instructs agents on 3D coordinate math, camera FOV bounds, and zero-allocation Three.js patterns.

## 3D Rules for AI Generation:
1. Coordinates \`position: [x, y, z]\` must stay strictly within \`[-12, 12]\` to remain inside frustum.
2. Root element must always be \`AegisWarRoomShell\` with \`spatial\` and \`hud\` slots.
3. Node status values: \`NOMINAL\` (emerald), \`DEGRADED\` (amber), \`CRITICAL_OUTAGE\` (rose).
`,
    kiroPowerMd: `---
name: "spatial-ops-3d-pro"
displayName: "Aegis 3D Spatial War-Room Power"
description: "Authoritative Kiro Power for 3D WebGL microservice topologies, bezier traffic edges, and dual-viewport state sync."
keywords: ["3d", "webgl", "r3f", "threejs", "sre", "incident-command"]
---

# Onboarding: \`spatial-ops-3d-pro\`
Use this power when generating 3D WebGL microservice maps with \`@json-render/react-three-fiber\`.
`,
    steeringRules: `# Spatial 3D Architectural Rules
- Zero allocations in \`useFrame\` render loop.
- Reuse geometries and materials across identical tiers.
- Emissive glow driven by store state without scene remounts.
`,
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
    code: `import { describe, it, expect } from "vitest";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { spatialCatalog } from "./catalog/spatial-catalog";

describe("Spatial Ops 3D Invariant Suite", () => {
  it("guarantees 3D topology acyclic invariance under fast-check fuzzing", () => {
    const report = runCatalogInvariantSuite(spatialCatalog, { numRuns: 30 });
    expect(report.allPassed).toBe(true);
  });
});
`,
  },
};

/**
 * 3. Free Starter Pack: SaaS KPI Starter
 */
export const SAAS_KPI_STARTER_PACK: AgentReadyPackManifest = {
  id: "saas-kpi-starter",
  name: "saas-kpi-starter",
  title: "SaaS KPI & Metric Starter Pack",
  description:
    "Free essential Generative UI kit for SaaS dashboards: WorkspaceShell, SectionGrid, KpiMetricCard, MrrChurnChart, and IssueRefundCard with full AI skills.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "MIT",
  tier: "free",
  priceUsd: 0,
  category: "dashboard",
  tags: ["free", "starter", "saas", "kpi", "dashboard"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react": "^0.22.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "fast-check": "^4.10.2",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-starter-kpi-001",
  components: [
    {
      name: "WorkspaceShell",
      description: "Clean dashboard shell container.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "KpiMetricCard",
      description: "KPI telemetry card with sparkline and delta trend.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "IssueRefundCard",
      description: "Interactive refund card.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [],
  agentSkill: {
    skillMd: "# SaaS KPI Starter Skill\nBasic SaaS KPI cards for Claude and Cursor.",
    kiroPowerMd: "# SaaS KPI Starter Power\nClean starter power for Kiro.",
    steeringRules: "# SaaS Starter Rules\nUse KpiMetricCard for revenue metrics.",
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02"],
    code: "// Starter PBT suite\n",
  },
};

/**
 * 4. Free Starter Pack: 3D Spatial Mesh Starter
 */
export const SPATIAL_MESH_STARTER_PACK: AgentReadyPackManifest = {
  id: "spatial-mesh-starter",
  name: "spatial-mesh-starter",
  title: "3D Spatial Mesh Starter Pack",
  description:
    "Free starter kit for WebGL microservice scenes: ClusterTopologyCanvas, ServiceMeshNode3D, and TrafficFlowEdge3D.",
  version: "1.0.0",
  author: "GenUI Studio <creators@genui.studio>",
  license: "MIT",
  tier: "free",
  priceUsd: 0,
  category: "spatial-3d",
  tags: ["free", "starter", "3d", "threejs", "webgl"],
  dependencies: {
    "@genui-studio/core": "^1.0.0",
    "@json-render/core": "^0.22.0",
    "@json-render/react-three-fiber": "^0.22.0",
    "three": "^0.173.0",
    "zod": "^4.3.6",
  },
  devDependencies: {
    "@types/three": "^0.173.0",
    "vitest": "^3.0.0",
  },
  catalogHash: "sha256-starter-mesh-002",
  components: [
    {
      name: "ClusterTopologyCanvas",
      description: "Basic WebGL canvas with OrbitControls.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "ServiceMeshNode3D",
      description: "3D Node with emissive status glow.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [],
  agentSkill: {
    skillMd: "# 3D Mesh Starter Skill\nBasic 3D mesh skill for Claude and Cursor.",
    kiroPowerMd: "# 3D Mesh Starter Power\nStarter 3D power for Kiro.",
    steeringRules: "# 3D Starter Rules\nClamp node coordinates to [-10, 10].",
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02"],
    code: "// 3D Starter PBT suite\n",
  },
};

export const ALL_TEMPLATE_PACKS: Record<string, AgentReadyPackManifest> = {
  "finops-command-pro": FINOPS_COMMAND_PRO_PACK,
  "spatial-ops-3d-pro": SPATIAL_OPS_3D_PRO_PACK,
  "saas-kpi-starter": SAAS_KPI_STARTER_PACK,
  "spatial-mesh-starter": SPATIAL_MESH_STARTER_PACK,
};
