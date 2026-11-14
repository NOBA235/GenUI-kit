import fs from "node:fs";
import path from "node:path";
import { generateStarterThemeCss } from "../css-isolation.js";
import { validateTemplateSlug } from "../schema.js";
import type { TemplateManifest, TemplateThemeConfig } from "../types.js";
import { syncTemplatesRegistry } from "./sync-registry.js";

export interface ScaffoldNativeOptions {
  readonly slug: string;
  readonly repoRoot?: string;
  readonly title?: string;
  readonly description?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly tier?: "free" | "pro";
  readonly priceUsd?: number;
  readonly colorScheme?: "dark" | "light";
  readonly overwrite?: boolean;
}

export interface ScaffoldNativeResult {
  readonly slug: string;
  readonly templateDir: string;
  readonly filesCreated: readonly string[];
  readonly manifest: TemplateManifest;
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Scaffolds a full Mode A internal native website directory at
 * `packages/templates/src/<slug>/` with `manifest.json`, `catalog.ts`,
 * `components/`, `theme.css`, `steering.md`, and `index.ts`.
 */
export function scaffoldNativeTemplate(
  options: ScaffoldNativeOptions,
): ScaffoldNativeResult {
  const slug = validateTemplateSlug(options.slug);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const templateDir = path.join(repoRoot, "packages", "templates", "src", slug);

  if (fs.existsSync(templateDir) && !options.overwrite) {
    throw new Error(
      `Template directory already exists at packages/templates/src/${slug}. Pass --overwrite to replace it.`,
    );
  }

  const title = options.title ?? titleFromSlug(slug);
  const description =
    options.description ??
    `Multi-section Mode A native website template (${title}) powered by @genui-studio/core.`;
  const category = options.category ?? "B2B SaaS";
  const tier = options.tier ?? "pro";
  const priceUsd = options.priceUsd ?? (tier === "pro" ? 59 : 0);
  const colorScheme = options.colorScheme ?? "dark";
  const tags = Array.from(
    new Set([
      ...(options.tags && options.tags.length > 0 ? options.tags : [category]),
      "GenUI Verified",
    ]),
  );

  const theme: TemplateThemeConfig =
    colorScheme === "light"
      ? {
          defaultColorScheme: "light",
          accentColor: "#2563eb",
          surfaceBg: "#f8fafc",
          surfaceElevated: "#ffffff",
          textColor: "#0f172a",
          mutedColor: "#475569",
          displayFont: '"Instrument Serif", "Inter", system-ui, sans-serif',
          bodyFont: '"Inter", system-ui, sans-serif',
          borderRadius: "0.75rem",
        }
      : {
          defaultColorScheme: "dark",
          accentColor: "#22d3ee",
          surfaceBg: "#070b14",
          surfaceElevated: "#111827",
          textColor: "#f8fafc",
          mutedColor: "#94a3b8",
          displayFont: '"Space Grotesk", "Inter", system-ui, sans-serif',
          bodyFont: '"Inter", system-ui, sans-serif',
          borderRadius: "0.75rem",
        };

  const manifest: TemplateManifest = {
    slug,
    id: slug,
    name: slug,
    title,
    description,
    mode: "native",
    version: "1.0.0",
    author: "GenUI Studio <creators@genui.studio>",
    license: tier === "pro" ? "Commercial-Single" : "MIT",
    tier,
    priceUsd,
    category,
    tags,
    verified: true,
    theme,
    pages: [
      {
        id: "home",
        slug: "home",
        title: "Home",
        route: "/",
        description: "Primary landing experience with hero, value grid, and CTA.",
        sections: ["PageShell", "HeroSection", "FeatureGridSection", "CtaBanner"],
      },
      {
        id: "pricing",
        slug: "pricing",
        title: "Pricing",
        route: "/pricing",
        description: "Transparent multi-tier pricing page.",
        sections: ["PageShell", "PricingTierSection", "CtaBanner"],
      },
    ],
    remixPresets: [
      {
        id: "punchy-hero",
        label: "High-Conversion Headline",
        description: "Streams updated hero messaging and CTA emphasis.",
        prompt: "Sharpen hero headline and promote primary CTA",
      },
    ],
    dependencies: {
      "@genui-studio/core": "^1.0.0",
      "@json-render/core": "^0.22.0",
      "@json-render/react": "^0.22.0",
      "lucide-react": "^0.475.0",
      zod: "^4.3.6",
    },
    devDependencies: {
      "fast-check": "^4.10.2",
      vitest: "^3.0.0",
    },
  };

  fs.mkdirSync(path.join(templateDir, "components"), { recursive: true });

  const catalogContent = `import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    PageShell: {
      description: "Top-level page layout shell with navbar and footer.",
      props: z.object({
        brandName: z.string().min(1).max(80),
        navLinks: z.array(z.string().min(1).max(40)),
        footerNote: z.string().min(1).max(160),
      }),
      slots: ["default"],
    },
    HeroSection: {
      description: "Primary hero banner with headline, summary, and CTA.",
      props: z.object({
        eyebrow: z.string().min(1).max(60),
        headline: z.string().min(1).max(140),
        summary: z.string().min(1).max(320),
        ctaLabel: z.string().min(1).max(48),
      }),
      slots: [],
    },
    FeatureGridSection: {
      description: "Multi-column feature showcase section.",
      props: z.object({
        heading: z.string().min(1).max(100),
        columns: z.number().int().min(1).max(4),
        features: z.array(
          z.object({
            title: z.string().min(1).max(80),
            detail: z.string().min(1).max(200),
          }),
        ),
      }),
      slots: [],
    },
    PricingTierSection: {
      description: "Pricing tiers comparison grid.",
      props: z.object({
        heading: z.string().min(1).max(100),
        tiers: z.array(
          z.object({
            name: z.string().min(1).max(40),
            price: z.string().min(1).max(24),
            summary: z.string().min(1).max(160),
          }),
        ),
      }),
      slots: [],
    },
    CtaBanner: {
      description: "Closing call-to-action strip.",
      props: z.object({
        title: z.string().min(1).max(120),
        buttonLabel: z.string().min(1).max(48),
      }),
      slots: [],
    },
  },
  actions: {},
});

export const initialPageSpecs: Record<string, Spec> = {
  home: {
    root: "page-shell",
    elements: {
      "page-shell": {
        type: "PageShell",
        props: {
          brandName: ${JSON.stringify(title)},
          navLinks: ["Overview", "Architecture", "Pricing"],
          footerNote: "Built with GenUI Studio Dual-Mode Template Architecture",
        },
        children: ["hero-1", "features-1", "cta-1"],
      },
      "hero-1": {
        type: "HeroSection",
        props: {
          eyebrow: ${JSON.stringify(category)},
          headline: ${JSON.stringify(`${title} — Production Experience`)},
          summary: ${JSON.stringify(description)},
          ctaLabel: "Get Started",
        },
      },
      "features-1": {
        type: "FeatureGridSection",
        props: {
          heading: "Core Capabilities",
          columns: 3,
          features: [
            {
              title: "Scoped CSS Isolation",
              detail: "Custom fonts, radii, and palette tokens strictly scoped via data-template-theme.",
            },
            {
              title: "Verified Zod Catalog",
              detail: "Every component prop is guardrailed and self-healed by @genui-studio/core.",
            },
            {
              title: "One-Click Next.js Export",
              detail: "Merges cleanly with base-nextjs-shell into a downloadable standalone project.",
            },
          ],
        },
      },
      "cta-1": {
        type: "CtaBanner",
        props: {
          title: "Ready to customize this template?",
          buttonLabel: "Open GenUI Remix Bar",
        },
      },
    },
  },
  pricing: {
    root: "pricing-shell",
    elements: {
      "pricing-shell": {
        type: "PageShell",
        props: {
          brandName: ${JSON.stringify(title)},
          navLinks: ["Overview", "Architecture", "Pricing"],
          footerNote: "Transparent licensing · Full source included",
        },
        children: ["pricing-grid", "pricing-cta"],
      },
      "pricing-grid": {
        type: "PricingTierSection",
        props: {
          heading: "Flexible Licensing Plans",
          tiers: [
            { name: "Starter", price: "$0", summary: "Open-source evaluation & local preview." },
            { name: "Pro Single", price: "$${priceUsd}", summary: "Full commercial Next.js export + AI Skills." },
            { name: "Team", price: "$199", summary: "Unlimited seats, Kiro Powers & CI fuzz gates." },
          ],
        },
      },
      "pricing-cta": {
        type: "CtaBanner",
        props: {
          title: "Export directly via npx genui-studio add",
          buttonLabel: "Export Website",
        },
      },
    },
  },
};

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? initialPageSpecs["home"]!;
  const heroKey = Object.keys(base.elements).find(
    (k) => base.elements[k]?.type === "HeroSection",
  );
  if (!heroKey) return specToJsonlStream(base);
  const nextSpec: Spec = {
    ...base,
    elements: {
      ...base.elements,
      [heroKey]: {
        ...base.elements[heroKey]!,
        props: {
          ...base.elements[heroKey]!.props,
          headline: prompt.trim() || "Live Remixed Headline",
          ctaLabel: "Remixed Live",
        },
      },
    },
  };
  return specToJsonlStream(nextSpec);
}
`;

  const componentsTsx = `import React from "react";
import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog.js";

export const { registry: templateComponents } = defineRegistry(
  verifiedCatalog.catalog,
  {
    components: {
      PageShell: ({ props, children }) => (
        <div className="min-h-[640px] flex flex-col justify-between p-6 md:p-10 gap-10">
          <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-current/15">
            <span className="tpl-heading text-lg font-bold tracking-tight">
              {props.brandName}
            </span>
            <nav className="flex items-center gap-5 text-xs font-medium opacity-80">
              {props.navLinks.map((link, idx) => (
                <span key={\`nav-\${idx}\`}>{link}</span>
              ))}
            </nav>
          </header>
          <main className="space-y-8 flex-1">{children}</main>
          <footer className="pt-6 border-t border-current/10 text-xs opacity-65">
            {props.footerNote}
          </footer>
        </div>
      ),
      HeroSection: ({ props }) => (
        <section className="tpl-card p-6 md:p-10 space-y-4">
          <div
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "var(--tpl-accent)" }}
          >
            {props.eyebrow}
          </div>
          <h1 className="tpl-heading text-3xl md:text-5xl font-bold tracking-tight">
            {props.headline}
          </h1>
          <p className="text-sm md:text-base max-w-2xl opacity-80 leading-relaxed">
            {props.summary}
          </p>
          <button
            type="button"
            className="tpl-cta px-5 py-2.5 text-xs font-semibold cursor-pointer"
          >
            {props.ctaLabel}
          </button>
        </section>
      ),
      FeatureGridSection: ({ props }) => (
        <section className="space-y-4">
          <h2 className="tpl-heading text-xl font-bold">{props.heading}</h2>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: \`repeat(\${Math.min(Math.max(props.columns, 1), 3)}, minmax(0, 1fr))\`,
            }}
          >
            {props.features.map((feat, idx) => (
              <div key={\`feat-\${idx}\`} className="tpl-card p-5 space-y-2">
                <h3 className="font-semibold text-sm" style={{ color: "var(--tpl-accent)" }}>
                  {feat.title}
                </h3>
                <p className="text-xs opacity-80 leading-relaxed">{feat.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ),
      PricingTierSection: ({ props }) => (
        <section className="space-y-4">
          <h2 className="tpl-heading text-xl font-bold">{props.heading}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {props.tiers.map((tier, idx) => (
              <div key={\`tier-\${idx}\`} className="tpl-card p-5 space-y-2">
                <div className="text-xs font-mono uppercase opacity-75">{tier.name}</div>
                <div className="text-2xl font-bold" style={{ color: "var(--tpl-accent)" }}>
                  {tier.price}
                </div>
                <p className="text-xs opacity-80">{tier.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ),
      CtaBanner: ({ props }) => (
        <section className="tpl-card p-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="tpl-heading text-lg font-semibold">{props.title}</h2>
          <button
            type="button"
            className="tpl-cta px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            {props.buttonLabel}
          </button>
        </section>
      ),
    },
    actions: {},
  },
);
`;

  const componentsIndexTs = `export { templateComponents } from "./Sections.js";
`;

  const themeCss = generateStarterThemeCss(slug, theme);

  const steeringMd = `# ${title} — Architectural & Design Steering

- **Mode:** Mode A (Internal Native Website)
- **Theme Isolation:** Strictly scoped to \`[data-template-theme="${slug}"]\`
- **Color Scheme:** \`${colorScheme}\`
- **Catalog Contract:** All sections render exclusively via \`verifiedCatalog\` and \`SafeGenUIRenderer\`.
- **Invariants:** Never bypass Zod catalog props or emit raw HTML/JSX strings.
`;

  const indexTs = `import type { DualModeTemplateEntry } from "../types.js";
import {
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog,
} from "./catalog.js";
import { templateComponents } from "./components/index.js";
import {
  TEMPLATE_KIRO_POWER_MD,
  TEMPLATE_MANIFEST,
  TEMPLATE_SKILL_MD,
  TEMPLATE_SOURCE_FILES,
  TEMPLATE_STEERING_MD,
  TEMPLATE_THEME_CSS,
} from "./bundle.generated.js";

export const templateEntry: DualModeTemplateEntry = {
  manifest: TEMPLATE_MANIFEST,
  catalog: verifiedCatalog,
  registry: templateComponents,
  pageSpecs: initialPageSpecs,
  themeCss: TEMPLATE_THEME_CSS,
  steeringMd: TEMPLATE_STEERING_MD,
  skillMd: TEMPLATE_SKILL_MD,
  kiroPowerMd: TEMPLATE_KIRO_POWER_MD,
  sourceFiles: TEMPLATE_SOURCE_FILES,
  buildRemixJsonl,
};

export default templateEntry;
`;

  const filesToWrite: Array<[string, string]> = [
    ["manifest.json", JSON.stringify(manifest, null, 2) + "\n"],
    ["catalog.ts", catalogContent],
    ["components/Sections.tsx", componentsTsx],
    ["components/index.ts", componentsIndexTs],
    ["theme.css", themeCss],
    ["steering.md", steeringMd],
    ["index.ts", indexTs],
  ];

  const filesCreated: string[] = [];
  for (const [relPath, content] of filesToWrite) {
    const absPath = path.join(templateDir, relPath);
    fs.writeFileSync(absPath, content, "utf-8");
    filesCreated.push(relPath);
  }

  syncTemplatesRegistry(repoRoot);

  return {
    slug,
    templateDir,
    filesCreated,
    manifest,
  };
}
