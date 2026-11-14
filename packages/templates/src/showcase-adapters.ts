import React from "react";
import { z } from "zod";
import type { Spec } from "@json-render/core";
import { defineRegistry, type ComponentRegistry } from "@json-render/react";
import { schema } from "@json-render/react/schema";
import {
  ALL_TEMPLATE_PACKS,
  createVerifiedCatalog,
  specToJsonlStream,
  type AgentReadyPackManifest,
} from "@genui-studio/core";
import { generateStarterThemeCss } from "./css-isolation.js";
import type { DualModeTemplateEntry, TemplateThemeConfig } from "./types.js";

/**
 * Self-contained interactive preview catalog used by the 4 baseline Showcase Packs
 * so Studio Hub renders real multi-section previews, live GenUI remixing, X-Ray PBT,
 * and Next.js shell exports prior to building the 4 new flagship websites.
 */
export const showcasePreviewCatalog = createVerifiedCatalog(schema, {
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

const { registry: showcaseBaseRegistry } = defineRegistry(
  showcasePreviewCatalog.catalog,
  {
    components: {
      SiteShell: ({ props, children }) =>
        React.createElement(
          "div",
          {
            className:
              "min-h-[640px] w-full p-6 md:p-10 space-y-8 transition-colors",
            style: {
              backgroundColor: "var(--tpl-bg)",
              color: "var(--tpl-fg)",
              fontFamily: "var(--tpl-font-body)",
            },
          },
          React.createElement(
            "header",
            {
              className:
                "flex flex-wrap items-center justify-between gap-4 pb-5 border-b",
              style: {
                borderColor:
                  "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
              },
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-3" },
              React.createElement(
                "span",
                {
                  className: "px-2.5 py-1 text-xs font-mono font-bold",
                  style: {
                    backgroundColor:
                      "color-mix(in srgb, var(--tpl-accent) 18%, transparent)",
                    color: "var(--tpl-accent)",
                    borderRadius: "var(--tpl-radius)",
                  },
                },
                props.badge,
              ),
              React.createElement(
                "strong",
                {
                  className: "text-base font-bold tracking-tight",
                  style: { fontFamily: "var(--tpl-font-display)" },
                },
                props.brandName,
              ),
            ),
            React.createElement(
              "span",
              { className: "text-xs opacity-75 font-mono" },
              `${props.tagline} · ${props.layoutDensity.toUpperCase()}`,
            ),
          ),
          React.createElement("div", { className: "space-y-8" }, children),
        ),
      HeroSection: ({ props }) =>
        React.createElement(
          "section",
          {
            className: "p-6 md:p-8 border space-y-4",
            style: {
              backgroundColor: "var(--tpl-surface)",
              borderRadius: "var(--tpl-radius)",
              borderColor:
                "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
            },
          },
          React.createElement(
            "div",
            {
              className: "text-xs font-mono uppercase tracking-widest",
              style: { color: "var(--tpl-accent)" },
            },
            props.eyebrow,
          ),
          React.createElement(
            "h1",
            {
              className: "text-3xl md:text-4xl font-bold tracking-tight",
              style: { fontFamily: "var(--tpl-font-display)" },
            },
            props.headline,
          ),
          React.createElement(
            "p",
            { className: "text-sm md:text-base max-w-2xl opacity-80 leading-relaxed" },
            props.summary,
          ),
          React.createElement(
            "div",
            { className: "flex flex-wrap items-center gap-3 pt-2" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "px-4 py-2 text-xs font-semibold cursor-pointer",
                style: {
                  backgroundColor: "var(--tpl-accent)",
                  color: "#06090f",
                  borderRadius: "var(--tpl-radius)",
                },
              },
              props.primaryCta,
            ),
            props.secondaryCta
              ? React.createElement(
                  "span",
                  {
                    className: "px-4 py-2 text-xs font-mono border opacity-85",
                    style: {
                      borderRadius: "var(--tpl-radius)",
                      borderColor:
                        "color-mix(in srgb, var(--tpl-fg) 22%, transparent)",
                    },
                  },
                  props.secondaryCta,
                )
              : null,
          ),
        ),
      MetricStrip: ({ props }) =>
        React.createElement(
          "section",
          { className: "space-y-3" },
          React.createElement(
            "div",
            { className: "text-xs font-mono uppercase tracking-wider opacity-70" },
            props.heading,
          ),
          React.createElement(
            "div",
            { className: "grid grid-cols-1 sm:grid-cols-3 gap-4" },
            React.createElement(
              "div",
              {
                className: "p-4 border",
                style: {
                  backgroundColor: "var(--tpl-surface)",
                  borderRadius: "var(--tpl-radius)",
                  borderColor:
                    "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
                },
              },
              React.createElement("div", { className: "text-xs opacity-70" }, props.primaryLabel),
              React.createElement(
                "div",
                { className: "text-2xl font-bold mt-1", style: { color: "var(--tpl-accent)" } },
                props.primaryValue,
              ),
            ),
            React.createElement(
              "div",
              {
                className: "p-4 border",
                style: {
                  backgroundColor: "var(--tpl-surface)",
                  borderRadius: "var(--tpl-radius)",
                  borderColor:
                    "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
                },
              },
              React.createElement("div", { className: "text-xs opacity-70" }, props.secondaryLabel),
              React.createElement("div", { className: "text-2xl font-bold mt-1" }, props.secondaryValue),
            ),
            React.createElement(
              "div",
              {
                className: "p-4 border",
                style: {
                  backgroundColor: "var(--tpl-surface)",
                  borderRadius: "var(--tpl-radius)",
                  borderColor:
                    "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
                },
              },
              React.createElement("div", { className: "text-xs opacity-70" }, "Verified Uptime / SLO"),
              React.createElement("div", { className: "text-2xl font-bold mt-1" }, `${props.uptimePercent}%`),
            ),
          ),
        ),
      FeatureGrid: ({ props }) =>
        React.createElement(
          "section",
          { className: "space-y-3" },
          React.createElement(
            "h2",
            {
              className: "text-lg font-semibold",
              style: { fontFamily: "var(--tpl-font-display)" },
            },
            props.sectionTitle,
          ),
          React.createElement(
            "div",
            {
              className: "grid gap-4",
              style: {
                gridTemplateColumns: `repeat(${Math.min(Math.max(props.columns, 1), 3)}, minmax(0, 1fr))`,
              },
            },
            ...props.items.map((item, idx) =>
              React.createElement(
                "article",
                {
                  key: `${item.title}-${idx}`,
                  className: "p-4 border space-y-1.5",
                  style: {
                    backgroundColor: "var(--tpl-surface)",
                    borderRadius: "var(--tpl-radius)",
                    borderColor:
                      "color-mix(in srgb, var(--tpl-fg) 14%, transparent)",
                  },
                },
                React.createElement(
                  "h3",
                  { className: "text-sm font-semibold", style: { color: "var(--tpl-accent)" } },
                  item.title,
                ),
                React.createElement("p", { className: "text-xs opacity-80" }, item.detail),
              ),
            ),
          ),
        ),
    },
    actions: {},
  },
);

const PACK_SHOWCASE_CONFIG: Record<
  string,
  {
    category: string;
    tags: readonly string[];
    theme: TemplateThemeConfig;
    metricPrimary: [string, string];
    metricSecondary: [string, string];
  }
> = {
  "spatial-ops-3d-pro": {
    category: "3D / WebGL",
    tags: ["3D / WebGL", "GenUI Verified"],
    theme: {
      defaultColorScheme: "dark",
      accentColor: "#a855f7",
      surfaceBg: "#060812",
      surfaceElevated: "#111629",
      textColor: "#f1f5f9",
      mutedColor: "#94a3b8",
      displayFont: '"Space Grotesk", "Inter", system-ui, sans-serif',
      bodyFont: '"Inter", system-ui, sans-serif',
      borderRadius: "0.5rem",
    },
    metricPrimary: ["16 Nodes", "3D Mesh Topology"],
    metricSecondary: ["60 FPS", "Zero-Alloc WebGL"],
  },
  "spatial-mesh-starter": {
    category: "3D / WebGL",
    tags: ["3D / WebGL", "GenUI Verified"],
    theme: {
      defaultColorScheme: "dark",
      accentColor: "#34d399",
      surfaceBg: "#040d0a",
      surfaceElevated: "#0a1c16",
      textColor: "#ecfdf5",
      mutedColor: "#a7f3d0",
      displayFont: '"JetBrains Mono", monospace',
      bodyFont: '"Inter", system-ui, sans-serif',
      borderRadius: "0.375rem",
    },
    metricPrimary: ["5 Nodes", "Starter WebGL"],
    metricSecondary: ["< 1ms", "Validation Latency"],
  },
};

function buildShowcaseSpec(
  pack: AgentReadyPackManifest,
  cfg: (typeof PACK_SHOWCASE_CONFIG)[string],
): Spec {
  return {
    root: "site-shell",
    elements: {
      "site-shell": {
        type: "SiteShell",
        props: {
          brandName: pack.title,
          tagline: `${pack.components.length} Verified Catalog Components`,
          badge: pack.tier === "pro" ? `PRO · $${pack.priceUsd}` : "FREE · MIT",
          layoutDensity: "spacious",
        },
        children: ["hero-1", "metrics-1", "features-1"],
      },
      "hero-1": {
        type: "HeroSection",
        props: {
          eyebrow: `${cfg.category} · @genui-studio/core`,
          headline: pack.title,
          summary: pack.description,
          primaryCta: `Deploy ${pack.name}`,
          secondaryCta: `Catalog SHA: ${pack.catalogHash.slice(0, 14)}`,
        },
      },
      "metrics-1": {
        type: "MetricStrip",
        props: {
          heading: "Runtime Telemetry & Pack Metrics",
          primaryValue: cfg.metricPrimary[0],
          primaryLabel: cfg.metricPrimary[1],
          secondaryValue: cfg.metricSecondary[0],
          secondaryLabel: cfg.metricSecondary[1],
          uptimePercent: 99.98,
        },
      },
      "features-1": {
        type: "FeatureGrid",
        props: {
          sectionTitle: "Catalog Component Architecture",
          columns: 3,
          items: pack.components.slice(0, 6).map((c) => ({
            title: c.name,
            detail: c.description,
          })),
        },
      },
    },
  };
}

function adaptPackToDualModeEntry(
  pack: AgentReadyPackManifest,
): DualModeTemplateEntry {
  const cfg = PACK_SHOWCASE_CONFIG[pack.id] ?? {
    category: "B2B SaaS",
    tags: ["B2B SaaS", "GenUI Verified"],
    theme: {
      defaultColorScheme: "dark",
      accentColor: "#22d3ee",
      surfaceBg: "#070b14",
      surfaceElevated: "#0f172a",
      textColor: "#f8fafc",
      mutedColor: "#94a3b8",
      displayFont: '"Inter", system-ui, sans-serif',
      bodyFont: '"Inter", system-ui, sans-serif',
      borderRadius: "0.75rem",
    },
    metricPrimary: ["100%", "Compliance"],
    metricSecondary: [`${pack.components.length}`, "Components"],
  };

  const homeSpec = buildShowcaseSpec(pack, cfg);
  const themeCss = generateStarterThemeCss(pack.id, cfg.theme);

  return {
    manifest: {
      slug: pack.id,
      id: pack.id,
      name: pack.name,
      title: pack.title,
      description: pack.description,
      mode: "native",
      version: pack.version,
      author: pack.author,
      license: pack.license,
      tier: pack.tier,
      priceUsd: pack.priceUsd,
      category: cfg.category,
      tags: [...cfg.tags],
      verified: true,
      theme: cfg.theme,
      pages: [
        {
          id: "home",
          slug: "home",
          title: "Overview",
          route: "/",
          description: pack.description,
          sections: ["SiteShell", "HeroSection", "MetricStrip", "FeatureGrid"],
        },
      ],
      remixPresets: [
        {
          id: "editorial-density",
          label: "Editorial Compact Remix",
          description: "Stream RFC 6902 patch switching shell density and headline copy.",
          prompt: "Switch layout density to editorial and sharpen hero headline",
        },
        {
          id: "high-throughput",
          label: "Telemetry Boost Remix",
          description: "Update metric strip & CTA copy via guardrailed JSONL patch.",
          prompt: "Highlight 99.99% SLA uptime and update CTA to Launch Production",
        },
      ],
      dependencies: pack.dependencies,
      devDependencies: pack.devDependencies,
    },
    catalog: showcasePreviewCatalog,
    registry: showcaseBaseRegistry as ComponentRegistry,
    pageSpecs: { home: homeSpec },
    themeCss,
    steeringMd: pack.agentSkill.steeringRules,
    skillMd: pack.agentSkill.skillMd,
    kiroPowerMd: pack.agentSkill.kiroPowerMd,
    sourceFiles: [
      ...pack.files.map((f) => ({
        path: f.path,
        content: f.content,
        kind: (f.type === "registry:catalog" ? "catalog" : "component") as
          | "catalog"
          | "component",
      })),
      { path: "theme.css", content: themeCss, kind: "theme" },
      { path: "steering.md", content: pack.agentSkill.steeringRules, kind: "steering" },
    ],
    buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
      const base = currentSpec ?? homeSpec;
      const lower = prompt.toLowerCase();
      const density = lower.includes("compact")
        ? "compact"
        : lower.includes("editorial")
          ? "editorial"
          : "spacious";
      const nextSpec: Spec = {
        ...base,
        elements: {
          ...base.elements,
          "site-shell": {
            ...(base.elements["site-shell"] ?? {
              type: "SiteShell",
              props: {},
            }),
            props: {
              ...(base.elements["site-shell"]?.props ?? {}),
              layoutDensity: density,
              badge: "LIVE REMIX",
            },
          },
          "hero-1": {
            ...(base.elements["hero-1"] ?? {
              type: "HeroSection",
              props: {},
            }),
            props: {
              ...(base.elements["hero-1"]?.props ?? {}),
              headline:
                prompt.trim().length > 6
                  ? `${pack.title} — ${prompt.trim().slice(0, 56)}`
                  : `${pack.title} (Remixed)`,
              primaryCta: lower.includes("launch")
                ? "Launch Production"
                : "Streamed Remix Active",
            },
          },
        },
      };
      return specToJsonlStream(nextSpec);
    },
    buildChaosPackets(rootKey: string): readonly string[] {
      return [
        JSON.stringify({
          op: "add",
          path: "/elements/chaos-metric",
          value: {
            type: "MetricStrip",
            props: {
              heading: "Injected Chaos Telemetry (999% clamped to 100%)",
              primaryValue: "ATTACK",
              primaryLabel: "__proto__ blocked",
              secondaryValue: "SAFE",
              secondaryLabel: "DAG Intact",
              uptimePercent: 999,
            },
          },
        }),
        JSON.stringify({
          op: "add",
          path: `/elements/${rootKey}/children/-`,
          value: "chaos-metric",
        }),
        JSON.stringify({
          op: "add",
          path: "/elements/chaos-cycle",
          value: {
            type: "HeroSection",
            props: {
              eyebrow: "Cycle Probe",
              headline: "Self-Loop Severed by 3-Color DFS",
              summary: "Attempted cyclic child reference neutralized.",
              primaryCta: "Verified Safe",
              secondaryCta: null,
            },
            children: ["chaos-cycle"],
          },
        }),
        JSON.stringify({
          op: "add",
          path: `/elements/${rootKey}/children/-`,
          value: "chaos-cycle",
        }),
      ];
    },
  };
}

export const SHOWCASE_PACK_TEMPLATES: readonly DualModeTemplateEntry[] =
  Object.values(ALL_TEMPLATE_PACKS).map(adaptPackToDualModeEntry);
