import type { Spec } from "@json-render/core";
import type { TemplateSourceFile } from "./types.js";

/**
 * Source text for the runnable Next.js starter exported from the wireframe starter packs
 * (`saas-dashboard-starter`, `product-landing-starter`).
 *
 * The exported `app/page.tsx` imports `verifiedCatalog` + `initialPageSpecs` from
 * `src/template/catalog` and `templateComponents` from `src/template/components`.
 * The showcase packs only ship their own pack files, so without these two modules the
 * exported project does not compile.
 *
 * `SHOWCASE_STARTER_CATALOG_TS` must declare exactly the same components, descriptions,
 * Zod schemas and slots as `showcasePreviewCatalog` in `showcase-adapters.ts`.
 * `apps/studio-hub/src/__tests__/workbench-journey.e2e.test.tsx` imports the exported file
 * and asserts both catalogs produce the same `catalogHash`.
 */
const SHOWCASE_STARTER_CATALOG_TS = `import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

export const verifiedCatalog = createVerifiedCatalog(schema, {
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
`;

const SHOWCASE_STARTER_COMPONENTS_TSX = `import React from "react";
import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog";

const surface: React.CSSProperties = {
  backgroundColor: "var(--tpl-surface)",
  borderRadius: "var(--tpl-radius)",
  borderColor: "color-mix(in srgb, var(--tpl-fg) 12%, transparent)",
};

export const { registry: templateComponents } = defineRegistry(verifiedCatalog.catalog, {
  components: {
    SiteShell: ({ props, children }) => (
      <div
        className="min-h-[640px] w-full p-6 md:p-10 space-y-8"
        style={{ backgroundColor: "var(--tpl-bg)", color: "var(--tpl-fg)", fontFamily: "var(--tpl-font-body)" }}
      >
        <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-mono font-bold rounded-full" style={{ color: "var(--tpl-accent)" }}>
              {props.badge}
            </span>
            <strong className="text-base font-extrabold tracking-tight">{props.brandName}</strong>
          </div>
          <span className="text-xs opacity-75 font-mono">
            {props.tagline} · {props.layoutDensity.toUpperCase()}
          </span>
        </header>
        <div className="space-y-8">{children}</div>
      </div>
    ),
    HeroSection: ({ props }) => (
      <section className="p-6 md:p-8 border space-y-4" style={surface}>
        <div className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: "var(--tpl-accent)" }}>
          {props.eyebrow}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{props.headline}</h1>
        <p className="text-sm md:text-base max-w-2xl opacity-80 leading-relaxed">{props.summary}</p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full"
            style={{ backgroundColor: "var(--tpl-accent)", color: "#ffffff" }}
          >
            {props.primaryCta}
          </button>
          {props.secondaryCta ? (
            <span className="px-4 py-2 text-xs font-mono border rounded-full opacity-85">{props.secondaryCta}</span>
          ) : null}
        </div>
      </section>
    ),
    MetricStrip: ({ props }) => (
      <section className="space-y-3">
        <div className="text-xs font-mono font-bold uppercase tracking-wider opacity-70">{props.heading}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 border" style={surface}>
            <div className="text-xs font-medium opacity-70">{props.primaryLabel}</div>
            <div className="text-2xl font-extrabold mt-1" style={{ color: "var(--tpl-accent)" }}>
              {props.primaryValue}
            </div>
          </div>
          <div className="p-5 border" style={surface}>
            <div className="text-xs font-medium opacity-70">{props.secondaryLabel}</div>
            <div className="text-2xl font-extrabold mt-1">{props.secondaryValue}</div>
          </div>
          <div className="p-5 border" style={surface}>
            <div className="text-xs font-medium opacity-70">Verified Uptime / SLO</div>
            <div className="text-2xl font-extrabold mt-1">{props.uptimePercent}%</div>
          </div>
        </div>
      </section>
    ),
    FeatureGrid: ({ props }) => (
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold tracking-tight">{props.sectionTitle}</h2>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: \`repeat(\${Math.min(Math.max(props.columns, 1), 3)}, minmax(0, 1fr))\` }}
        >
          {props.items.map((item, idx) => (
            <article key={\`\${item.title}-\${idx}\`} className="p-5 border space-y-1.5" style={surface}>
              <h3 className="text-sm font-bold" style={{ color: "var(--tpl-accent)" }}>
                {item.title}
              </h3>
              <p className="text-xs opacity-80 leading-relaxed">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    ),
  },
  actions: {},
});
`;

const COMPONENTS_INDEX_TS = `export { templateComponents } from "./templateComponents";
`;

/**
 * Builds the `catalog.ts`, `components/index.ts` and `components/templateComponents.tsx`
 * source files for a showcase pack, embedding the pack's page Specs as `initialPageSpecs`.
 */
export function buildShowcaseStarterSourceFiles(
  pageSpecs: Readonly<Record<string, Spec>>,
): readonly TemplateSourceFile[] {
  const catalogTs = `${SHOWCASE_STARTER_CATALOG_TS}
export const initialPageSpecs: Record<string, Spec> = ${JSON.stringify(pageSpecs, null, 2)};
`;
  return [
    { path: "catalog.ts", content: catalogTs, kind: "catalog" },
    { path: "components/index.ts", content: COMPONENTS_INDEX_TS, kind: "component" },
    {
      path: "components/templateComponents.tsx",
      content: SHOWCASE_STARTER_COMPONENTS_TSX,
      kind: "component",
    },
  ];
}
