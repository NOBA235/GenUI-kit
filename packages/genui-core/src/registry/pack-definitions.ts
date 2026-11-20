import type { AgentReadyPackManifest } from "./types.js";

/**
 * 1. Starter Pack: SaaS Dashboard Wireframe Starter (Dark)
 */
export const SAAS_DASHBOARD_STARTER_PACK: AgentReadyPackManifest = {
  id: "saas-dashboard-starter",
  name: "saas-dashboard-starter",
  title: "SaaS Dashboard Wireframe Starter",
  description:
    "Dark-mode SaaS dashboard starter built on @genui-studio/core: SiteShell, HeroSection, MetricStrip, and FeatureGrid with verified Zod prop healing and Next.js export.",
  version: "1.0.0",
  author: "GenUI Studio",
  license: "MIT",
  tier: "free",
  priceUsd: 0,
  category: "dashboard",
  tags: ["free", "starter", "saas", "dashboard", "wireframe"],
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
  catalogHash: "sha256-saas-dashboard-starter-001",
  components: [
    {
      name: "SiteShell",
      description: "Top-level dashboard container organizing navigation badge, density, and sections.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "HeroSection",
      description: "Primary workspace banner with headline, bound summary state, and calls-to-action.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "MetricStrip",
      description: "Horizontal KPI highlight grid displaying bounded numeric telemetry and SLO percentage.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "FeatureGrid",
      description: "Multi-column capability or pricing tier grid with bounded column counts.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [
    {
      path: "catalog/starter-catalog.ts",
      type: "registry:catalog",
      content: `// SaaS Dashboard Verified Catalog Exported from GenUI Studio
import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

export const starterCatalog = createVerifiedCatalog(schema, {
  components: {
    SiteShell: {
      description: "Top-level website container organizing hero, metrics, and sections.",
      props: z.object({
        brandName: z.string().min(1).max(80),
        tagline: z.string().min(1).max(160),
        badge: z.string().min(1).max(48),
        layoutDensity: z.enum(["spacious", "compact", "editorial"]),
      }),
      slots: ["default"],
    },
    HeroSection: {
      description: "Primary hero section with headline, summary, and call-to-action.",
      props: z.object({
        eyebrow: z.string().min(1).max(60),
        headline: z.string().min(1).max(140),
        summary: z.string().min(1).max(320),
        primaryCta: z.string().min(1).max(48),
        secondaryCta: z.string().min(1).max(48).nullable(),
      }),
      slots: [],
    },
    MetricStrip: {
      description: "Horizontal KPI highlight grid displaying bounded numeric telemetry.",
      props: z.object({
        heading: z.string().min(1).max(80),
        primaryValue: z.string().min(1).max(32),
        primaryLabel: z.string().min(1).max(48),
        secondaryValue: z.string().min(1).max(32),
        secondaryLabel: z.string().min(1).max(48),
        uptimePercent: z.number().min(0).max(100),
      }),
      slots: [],
    },
    FeatureGrid: {
      description: "Multi-column capability showcase section.",
      props: z.object({
        sectionTitle: z.string().min(1).max(80),
        columns: z.number().int().min(1).max(4),
        items: z.array(
          z.object({
            title: z.string().min(1).max(60),
            detail: z.string().min(1).max(180),
          }),
        ),
      }),
      slots: [],
    },
  },
  actions: {},
});
`,
    },
  ],
  agentSkill: {
    skillMd: `---
name: saas-dashboard-starter
description: AI Agent Skill for composing dark-mode SaaS dashboard interfaces using the verified SiteShell, HeroSection, MetricStrip, and FeatureGrid catalog.
author: GenUI Studio
version: 1.0.0
---

# SaaS Dashboard Wireframe Starter Skill

Use this skill when compiling wireframes or streaming RFC 6902 JSONL specs for SaaS telemetry dashboards.

## Rules:
1. Root element must be \`SiteShell\` with \`layoutDensity\` in \`["spacious", "compact", "editorial"]\`.
2. Keep \`MetricStrip.uptimePercent\` within \`[0, 100]\`; out-of-range values are clamped and surfaced via \`<DiagnosticHealedBadge />\`.
3. Keep \`FeatureGrid.columns\` between \`1\` and \`4\`.
`,
    kiroPowerMd: `---
name: "saas-dashboard-starter"
displayName: "SaaS Dashboard Wireframe Starter Power"
description: "Kiro Power for generating validated dark-mode SaaS dashboards with @genui-studio/core."
keywords: ["saas", "dashboard", "wireframe", "excalidraw", "json-render", "genui"]
---

# Onboarding: \`saas-dashboard-starter\`
Use this power when authoring or extending SaaS dashboard Specs with \`@genui-studio/core\`.
`,
    steeringRules: `# SaaS Dashboard Starter Rules
- Render all dynamic UI trees through \`<SafeGenUIRenderer>\` with \`createTimeTravelStateStore\`.
- Never inject raw HTML or JSX strings.
- Validate exported specs with \`genui-studio validate\`.
`,
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
    code: `import { describe, it, expect } from "vitest";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { starterCatalog } from "./catalog/starter-catalog";

describe("SaaS Dashboard Starter Invariant Suite", () => {
  it("passes INV-PBT-01 through INV-PBT-04 under fast-check fuzzing", () => {
    const report = runCatalogInvariantSuite(starterCatalog, { numRuns: 30 });
    expect(report.allPassed).toBe(true);
  });
});
`,
  },
};

/**
 * 2. Starter Pack: Product Landing Wireframe Starter (Light)
 */
export const PRODUCT_LANDING_STARTER_PACK: AgentReadyPackManifest = {
  id: "product-landing-starter",
  name: "product-landing-starter",
  title: "Product Landing Wireframe Starter",
  description:
    "Light-mode editorial landing page starter built on @genui-studio/core: turn an Excalidraw wireframe into a validated, interactive React landing page and Next.js export.",
  version: "1.0.0",
  author: "GenUI Studio",
  license: "MIT",
  tier: "free",
  priceUsd: 0,
  category: "dashboard",
  tags: ["free", "starter", "landing", "editorial", "wireframe"],
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
  catalogHash: "sha256-product-landing-starter-002",
  components: [
    {
      name: "SiteShell",
      description: "Light editorial page frame organizing header badge, tagline, and vertical sections.",
      slots: ["default"],
      hasFallbackProps: true,
    },
    {
      name: "HeroSection",
      description: "High-contrast product launch hero with headline, value proposition, and primary CTA.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "MetricStrip",
      description: "Social-proof and reliability KPI strip with bounded percentage telemetry.",
      slots: [],
      hasFallbackProps: true,
    },
    {
      name: "FeatureGrid",
      description: "Structured feature highlights and pricing tier cards.",
      slots: [],
      hasFallbackProps: true,
    },
  ],
  files: [],
  agentSkill: {
    skillMd: "# Product Landing Starter Skill\nCompose clean light-mode product landing pages with SiteShell, HeroSection, MetricStrip, and FeatureGrid.",
    kiroPowerMd: "# Product Landing Starter Power\nKiro Power for wireframe-driven product landing pages on @genui-studio/core.",
    steeringRules: "# Product Landing Starter Rules\nKeep copy concise, validate all specs with catalog.validateFull(), and preserve responsive grid columns (1..4).",
  },
  pbtSuite: {
    theorems: ["INV-PBT-01", "INV-PBT-02", "INV-PBT-03", "INV-PBT-04"],
    code: "// Product Landing Starter PBT suite\n",
  },
};

export const ALL_TEMPLATE_PACKS: Record<string, AgentReadyPackManifest> = {
  "saas-dashboard-starter": SAAS_DASHBOARD_STARTER_PACK,
  "product-landing-starter": PRODUCT_LANDING_STARTER_PACK,
};
