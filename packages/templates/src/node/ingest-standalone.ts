import fs from "node:fs";
import path from "node:path";
import { scopeTemplateCss } from "../css-isolation.js";
import { validateTemplateSlug } from "../schema.js";
import type {
  StandaloneProjectMeta,
  TemplateManifest,
  TemplatePageDefinition,
  TemplateThemeConfig,
} from "../types.js";
import {
  isTextSourceFile,
  syncTemplatesRegistry,
  walkCleanFiles,
} from "./sync-registry.js";

export interface IngestStandaloneOptions {
  readonly slug: string;
  readonly repoRoot?: string;
  readonly title?: string;
  readonly tier?: "free" | "pro";
  readonly priceUsd?: number;
  readonly overwrite?: boolean;
  /** Must only be set true once automated verification checks pass (default: false) */
  readonly verified?: boolean;
}

export interface IngestStandaloneResult {
  readonly slug: string;
  readonly sourceDropinDir: string;
  readonly cleanSourceDestDir: string;
  readonly bridgeDir: string;
  readonly manifest: TemplateManifest;
  readonly cleanFileCount: number;
  readonly detectedSections: readonly string[];
  readonly detectedPages: readonly string[];
  readonly warnings: readonly string[];
}

interface PackageJsonShape {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

function detectFramework(
  pkg: PackageJsonShape,
  relPaths: readonly string[],
): StandaloneProjectMeta["framework"] {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.next) {
    const hasAppRouter = relPaths.some(
      (p) =>
        p.startsWith("app/") ||
        p.startsWith("src/app/") ||
        p.endsWith("/app/page.tsx") ||
        p.endsWith("/app/layout.tsx"),
    );
    return hasAppRouter ? "nextjs-app" : "nextjs-pages";
  }
  if (deps.vite) return "react-vite";
  return "react";
}

function inferTagsAndCategory(
  pkg: PackageJsonShape,
  relPaths: readonly string[],
  isVerified = false,
): { category: string; tags: string[] } {
  const deps = Object.keys({
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  }).join(" ");
  const joined = `${pkg.name ?? ""} ${pkg.description ?? ""} ${deps} ${relPaths.join(" ")}`.toLowerCase();

  const tags = new Set<string>(
    isVerified
      ? ["Full-Stack Standalone", "GenUI Verified"]
      : ["Full-Stack Standalone"],
  );
  let category = "Full-Stack Standalone";

  if (
    joined.includes("three") ||
    joined.includes("@react-three") ||
    joined.includes("webgl") ||
    joined.includes("spline")
  ) {
    tags.add("3D / WebGL");
    category = "3D / WebGL";
  }
  if (
    joined.includes("wagmi") ||
    joined.includes("viem") ||
    joined.includes("ethers") ||
    joined.includes("solana") ||
    joined.includes("defi") ||
    joined.includes("web3")
  ) {
    tags.add("Web3 / DeFi");
    if (category === "Full-Stack Standalone") category = "Web3 / DeFi";
  }
  if (
    joined.includes("shopify") ||
    joined.includes("commerce") ||
    joined.includes("checkout") ||
    joined.includes("cart") ||
    joined.includes("storefront")
  ) {
    tags.add("E-Commerce");
    if (category === "Full-Stack Standalone") category = "E-Commerce";
  }
  if (
    joined.includes("stripe") ||
    joined.includes("saas") ||
    joined.includes("dashboard") ||
    joined.includes("prisma") ||
    joined.includes("supabase") ||
    joined.includes("recharts")
  ) {
    tags.add("B2B SaaS");
    if (category === "Full-Stack Standalone") category = "B2B SaaS";
  }

  return { category, tags: Array.from(tags) };
}

function extractExportedComponents(sourceText: string, fileName: string): string[] {
  const found = new Set<string>();
  const exportRegex =
    /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(sourceText)) !== null) {
    if (match[1]) found.add(match[1]);
  }
  if (found.size === 0) {
    const base = path.basename(fileName, path.extname(fileName));
    if (/^[A-Z][A-Za-z0-9_-]+$/.test(base)) {
      found.add(base.replace(/[^a-zA-Z0-9]/g, ""));
    }
  }
  return Array.from(found);
}

function detectStandaloneTheme(
  sourceDir: string,
  relPaths: readonly string[],
  slug: string,
): { theme: TemplateThemeConfig; scopedThemeCss: string } {
  const cssCandidates = relPaths.filter(
    (p) =>
      p.endsWith("globals.css") ||
      p.endsWith("styles.css") ||
      p.endsWith("index.css") ||
      p.endsWith("theme.css"),
  );

  let rawCss = "";
  for (const rel of cssCandidates) {
    rawCss += `\n/* Source: ${rel} */\n` + fs.readFileSync(path.join(sourceDir, rel), "utf-8");
  }

  const lowerCss = rawCss.toLowerCase();
  const isLight =
    lowerCss.includes("color-scheme: light") ||
    lowerCss.includes("#ffffff") ||
    lowerCss.includes("#f8fafc");

  const theme: TemplateThemeConfig = isLight
    ? {
        defaultColorScheme: "light",
        accentColor: "#2563eb",
        surfaceBg: "#f8fafc",
        surfaceElevated: "#ffffff",
        textColor: "#0f172a",
        mutedColor: "#475569",
        displayFont: '"Inter", system-ui, sans-serif',
        bodyFont: '"Inter", system-ui, sans-serif',
        borderRadius: "0.75rem",
      }
    : {
        defaultColorScheme: "dark",
        accentColor: "#38bdf8",
        surfaceBg: "#070b14",
        surfaceElevated: "#0f172a",
        textColor: "#f8fafc",
        mutedColor: "#94a3b8",
        displayFont: '"Inter", system-ui, sans-serif',
        bodyFont: '"Inter", system-ui, sans-serif',
        borderRadius: "0.75rem",
      };

  const scopedThemeCss = scopeTemplateCss(rawCss, slug, theme);
  return { theme, scopedThemeCss };
}

function detectPages(
  relPaths: readonly string[],
  detectedSections: readonly string[],
): TemplatePageDefinition[] {
  const pageFiles = relPaths.filter(
    (p) =>
      /^(?:src\/)?app\/(?:.*\/)?page\.(?:tsx|jsx|ts|js)$/.test(p) ||
      /^(?:src\/)?pages\/(?!_app|_document|api\/).*\.(?:tsx|jsx|ts|js)$/.test(p),
  );

  if (pageFiles.length === 0) {
    return [
      {
        id: "home",
        slug: "home",
        title: "Home",
        route: "/",
        description: "Primary standalone application entry route.",
        sections:
          detectedSections.length > 0
            ? detectedSections
            : ["StandaloneShell", "VisualSection"],
      },
    ];
  }

  const pages: TemplatePageDefinition[] = [];
  const seenIds = new Set<string>();

  for (const pf of pageFiles.slice(0, 8)) {
    let route = "/";
    if (pf.includes("app/")) {
      const stripped = pf
        .replace(/^(?:src\/)?app/, "")
        .replace(/\/page\.(?:tsx|jsx|ts|js)$/, "");
      route = stripped === "" ? "/" : stripped;
    } else {
      const stripped = pf
        .replace(/^(?:src\/)?pages/, "")
        .replace(/\.(?:tsx|jsx|ts|js)$/, "")
        .replace(/\/index$/, "");
      route = stripped === "" ? "/" : stripped;
    }
    const id =
      route === "/"
        ? "home"
        : route
            .replace(/^\//, "")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .toLowerCase();

    if (seenIds.has(id)) continue;
    seenIds.add(id);

    pages.push({
      id,
      slug: id,
      title: id === "home" ? "Home" : titleFromSlug(id),
      route,
      description: `Ingested route from ${pf}`,
      sections:
        detectedSections.length > 0
          ? detectedSections
          : ["StandaloneShell", "VisualSection"],
    });
  }

  return pages.length > 0
    ? pages
    : [
        {
          id: "home",
          slug: "home",
          title: "Home",
          route: "/",
          sections: ["StandaloneShell", "VisualSection"],
        },
      ];
}

/**
 * Mode B Ingestion Engine:
 * Scans a drop-in standalone Next.js / React project in `standalone-dropin/<slug>/`,
 * generates `manifest.json`, `catalog.ts` bridge, `SKILL.md`, `POWER.md`, `theme.css`,
 * copies the clean source tree (excluding node_modules, .next, .git, .env), and
 * wires it into the Dual-Mode Registry, `.zip` exporter, and Shadcn CLI pipeline.
 */
export function ingestStandaloneProject(
  options: IngestStandaloneOptions,
): IngestStandaloneResult {
  const slug = validateTemplateSlug(options.slug);
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const sourceDropinDir = path.join(repoRoot, "standalone-dropin", slug);

  if (!fs.existsSync(sourceDropinDir)) {
    throw new Error(
      `Drop-in folder not found at standalone-dropin/${slug}. Drop a standalone Next.js or React project there first.`,
    );
  }

  // 1. Walk clean source tree (node_modules, .next, .git, .env excluded)
  const cleanFiles = walkCleanFiles(sourceDropinDir);
  if (cleanFiles.length === 0) {
    throw new Error(
      `No source files found inside standalone-dropin/${slug}.`,
    );
  }

  const relPaths = cleanFiles.map((f) => f.relativePath);

  // 2. Scan package.json
  const pkgPath = path.join(sourceDropinDir, "package.json");
  const pkg: PackageJsonShape = fs.existsSync(pkgPath)
    ? (JSON.parse(
        fs.readFileSync(pkgPath, "utf-8").replace(/^\uFEFF/, ""),
      ) as PackageJsonShape)
    : {};

  // 3. Scan src/ or app/ and components/ for primary visual sections
  const componentFiles = cleanFiles.filter(
    (f) =>
      (/\.(tsx|jsx)$/.test(f.relativePath) &&
        (f.relativePath.includes("components/") ||
          f.relativePath.includes("sections/") ||
          f.relativePath.startsWith("src/") ||
          f.relativePath.startsWith("app/"))) &&
      !f.relativePath.endsWith("layout.tsx") &&
      !f.relativePath.endsWith("layout.jsx"),
  );

  const detectedSectionSet = new Set<string>();
  const sectionFileHints: Array<{ name: string; filePath: string }> = [];

  for (const cf of componentFiles) {
    if (!isTextSourceFile(cf.absolutePath)) continue;
    const text = fs.readFileSync(cf.absolutePath, "utf-8");
    const exported = extractExportedComponents(text, cf.relativePath);
    for (const compName of exported) {
      if (!detectedSectionSet.has(compName)) {
        detectedSectionSet.add(compName);
        sectionFileHints.push({ name: compName, filePath: cf.relativePath });
      }
    }
  }

  const isVerified = Boolean(options.verified);
  const warnings: string[] = [];
  if (!isVerified) {
    warnings.push(
      `Drop-in "${slug}" ingested with verified=false. Run build/typecheck and catalog validation before marking verified=true.`,
    );
  }

  const detectedSections = Array.from(detectedSectionSet).slice(0, 12);
  const framework = detectFramework(pkg, relPaths);
  const { category, tags } = inferTagsAndCategory(pkg, relPaths, isVerified);
  const { theme, scopedThemeCss } = detectStandaloneTheme(
    sourceDropinDir,
    relPaths,
    slug,
  );
  const pages = detectPages(relPaths, detectedSections);

  const title = options.title ?? titleFromSlug(pkg.name?.replace(/^@[^/]+\//, "") || slug);
  const description =
    pkg.description ||
    `Full-stack standalone ${framework} project ingested from standalone-dropin/${slug} with GenUI catalog bridge.`;

  const tier = options.tier ?? "pro";
  const priceUsd = options.priceUsd ?? (tier === "pro" ? 69 : 0);

  const entryFiles = relPaths.filter(
    (p) =>
      p === "package.json" ||
      p.endsWith("app/page.tsx") ||
      p.endsWith("app/layout.tsx") ||
      p.endsWith("src/App.tsx") ||
      p.endsWith("src/main.tsx"),
  );

  const standaloneMeta: StandaloneProjectMeta = {
    sourceDir: `standalone-dropin/${slug}`,
    framework,
    packageName: pkg.name ?? slug,
    entryFiles,
    detectedPages: pages.map((p) => p.route),
    detectedSections,
    fileCount: cleanFiles.length,
    ingestedAt: new Date().toISOString(),
  };

  const manifest: TemplateManifest = {
    slug,
    id: slug,
    name: slug,
    title,
    description,
    mode: "standalone",
    version: pkg.version ?? "1.0.0",
    author: "GenUI Studio <creators@genui.studio>",
    license: tier === "pro" ? "Commercial-Single" : "MIT",
    tier,
    priceUsd,
    category,
    tags,
    verified: isVerified,
    theme,
    pages,
    remixPresets: [
      {
        id: "highlight-architecture",
        label: "Emphasize Architecture",
        description: "Stream updated summary & CTA copy across ingested sections.",
        prompt: "Update headline to emphasize production standalone architecture",
      },
    ],
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
    standaloneMeta,
  };

  // 4. Copy clean source tree (excluding node_modules, .next, .git, .env) into standalone-sources/<slug>/
  const cleanSourceDestDir = path.join(
    repoRoot,
    "packages",
    "templates",
    "standalone-sources",
    slug,
  );
  if (fs.existsSync(cleanSourceDestDir)) {
    fs.rmSync(cleanSourceDestDir, { recursive: true, force: true });
  }
  for (const f of cleanFiles) {
    const dest = path.join(cleanSourceDestDir, f.relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.absolutePath, dest);
  }

  // 5. Write bridge package in packages/templates/src/standalone/<slug>/
  const bridgeDir = path.join(
    repoRoot,
    "packages",
    "templates",
    "src",
    "standalone",
    slug,
  );
  fs.mkdirSync(path.join(bridgeDir, "components"), { recursive: true });

  const bridgeCatalogTs = `import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    StandaloneShell: {
      description: "Bridge container wrapping the ingested standalone project preview.",
      props: z.object({
        projectTitle: z.string().min(1).max(120),
        framework: z.string().min(1).max(40),
        route: z.string().min(1).max(80),
        summary: z.string().min(1).max(320),
        dependencyCount: z.number().int().min(0).max(500),
        fileCount: z.number().int().min(1).max(10000),
      }),
      slots: ["default"],
    },
    IngestedSectionCard: {
      description: "Visual bridge card representing a primary section from the standalone project.",
      props: z.object({
        sectionName: z.string().min(1).max(80),
        sourceFile: z.string().min(1).max(200),
        headline: z.string().min(1).max(140),
        ctaLabel: z.string().min(1).max(60),
      }),
      slots: [],
    },
  },
  actions: {},
});

const sectionCards = ${JSON.stringify(
    (sectionFileHints.length > 0
      ? sectionFileHints.slice(0, 8)
      : [{ name: "PrimaryPage", filePath: entryFiles[0] ?? "app/page.tsx" }]
    ).map((s) => ({
      name: s.name,
      filePath: s.filePath,
    })),
    null,
    2,
  )};

export const initialPageSpecs: Record<string, Spec> = {
${pages
  .map((page) => {
    const childKeys = (sectionFileHints.length > 0
      ? sectionFileHints.slice(0, 8)
      : [{ name: "PrimaryPage", filePath: entryFiles[0] ?? "app/page.tsx" }]
    ).map((_, idx) => `${page.id}-sec-${idx}`);

    const sectionElements = (sectionFileHints.length > 0
      ? sectionFileHints.slice(0, 8)
      : [{ name: "PrimaryPage", filePath: entryFiles[0] ?? "app/page.tsx" }]
    )
      .map(
        (sec, idx) => `      "${page.id}-sec-${idx}": {
        type: "IngestedSectionCard",
        props: {
          sectionName: ${JSON.stringify(sec.name)},
          sourceFile: ${JSON.stringify(sec.filePath)},
          headline: ${JSON.stringify(`${sec.name} (${page.route})`)},
          ctaLabel: "Inspect Source",
        },
      }`,
      )
      .join(",\n");

    return `  ${JSON.stringify(page.id)}: {
    root: "${page.id}-shell",
    elements: {
      "${page.id}-shell": {
        type: "StandaloneShell",
        props: {
          projectTitle: ${JSON.stringify(title)},
          framework: ${JSON.stringify(framework)},
          route: ${JSON.stringify(page.route)},
          summary: ${JSON.stringify(description)},
          dependencyCount: ${Object.keys(pkg.dependencies ?? {}).length},
          fileCount: ${cleanFiles.length},
        },
        children: ${JSON.stringify(childKeys)},
      },
${sectionElements}
    },
  }`;
  })
  .join(",\n")}
};

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? Object.values(initialPageSpecs)[0]!;
  const firstCardKey = Object.keys(base.elements).find(
    (k) => base.elements[k]?.type === "IngestedSectionCard",
  );
  if (!firstCardKey) return specToJsonlStream(base);
  const nextSpec: Spec = {
    ...base,
    elements: {
      ...base.elements,
      [firstCardKey]: {
        ...base.elements[firstCardKey]!,
        props: {
          ...base.elements[firstCardKey]!.props,
          headline: prompt.trim() || "Remixed Standalone Section",
          ctaLabel: "Remixed Bridge",
        },
      },
    },
  };
  return specToJsonlStream(nextSpec);
}

export { sectionCards };
`;

  const bridgeComponentsTsx = `import React from "react";
import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog.js";

export const { registry: templateComponents } = defineRegistry(
  verifiedCatalog.catalog,
  {
    components: {
      StandaloneShell: ({ props, children }) => (
        <div className="min-h-[640px] p-6 md:p-10 space-y-6">
          <header className="tpl-card p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className="px-2.5 py-1 text-xs font-mono font-bold uppercase"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--tpl-accent) 18%, transparent)",
                  color: "var(--tpl-accent)",
                  borderRadius: "var(--tpl-radius)",
                }}
              >
                Mode B · Standalone {props.framework}
              </span>
              <span className="text-xs font-mono opacity-75">
                Route: {props.route} · {props.fileCount} clean files · {props.dependencyCount} deps
              </span>
            </div>
            <h1 className="tpl-heading text-2xl md:text-4xl font-bold tracking-tight">
              {props.projectTitle}
            </h1>
            <p className="text-sm opacity-80 max-w-3xl leading-relaxed">
              {props.summary}
            </p>
          </header>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
          </section>
        </div>
      ),
      IngestedSectionCard: ({ props }) => (
        <article className="tpl-card p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--tpl-accent)" }}>
              &lt;{props.sectionName} /&gt;
            </span>
            <span className="text-[11px] font-mono opacity-65 truncate max-w-[220px]">
              {props.sourceFile}
            </span>
          </div>
          <h2 className="tpl-heading text-base font-semibold">{props.headline}</h2>
          <span className="inline-block tpl-cta px-3 py-1.5 text-xs font-semibold">
            {props.ctaLabel}
          </span>
        </article>
      ),
    },
    actions: {},
  },
);
`;

  const bridgeComponentsIndex = `export { templateComponents } from "./StandaloneBridge.js";
`;

  const depList = Object.entries(pkg.dependencies ?? {})
    .map(([name, ver]) => `- \`${name}\`: \`${ver}\``)
    .join("\n");
  const fileTreePreview = relPaths
    .slice(0, 40)
    .map((p) => `- \`${p}\``)
    .join("\n");

  const skillMd = `---
name: ${slug}
description: Agent skill for the ingested standalone ${framework} project "${title}".
author: ${manifest.author}
version: ${manifest.version}
---

# ${title} — Standalone Project AI Skill

- **Slug:** \`${slug}\`
- **Mode:** \`standalone\` (${framework})
- **Detected Routes:** ${pages.map((p) => `\`${p.route}\``).join(", ")}
- **Detected Visual Sections:** ${detectedSections.length > 0 ? detectedSections.map((s) => `\`${s}\``).join(", ") : "Standard entry components"}

## Dependencies
${depList || "- None declared"}

## Clean Source Tree (${cleanFiles.length} files, excluding node_modules / .next / .git / .env)
${fileTreePreview}

## GenUI Catalog Bridge
Use \`genui/catalog.ts\` (\`verifiedCatalog\`) when streaming live UI patches into Studio Hub or validating specs via \`@genui-studio/mcp\`.
`;

  const kiroPowerMd = `---
name: "${slug}"
displayName: "${title} (Standalone Power)"
description: "Kiro Power for the ingested standalone ${framework} project ${title}, bridging its primary visual sections into @genui-studio/core."
keywords: ${JSON.stringify([slug, framework, ...tags.map((t) => t.toLowerCase())])}
---

# Kiro Power: \`${slug}\`

## Architecture Summary
- **Source Origin:** \`standalone-dropin/${slug}/\`
- **Framework:** \`${framework}\`
- **Pages:** ${pages.map((p) => p.route).join(", ")}
- **Bridged Catalog Components:** \`StandaloneShell\`, \`IngestedSectionCard\`
- **Detected Project Components:** ${detectedSections.join(", ") || "None"}

## Rules
1. Keep standalone source files in sync via \`pnpm ingest:standalone ${slug}\`.
2. Never re-include \`node_modules\`, \`.next\`, \`.git\`, or \`.env\` in exported archives.
`;

  const steeringMd = `# ${title} — Ingested Standalone Steering

- **Origin:** \`standalone-dropin/${slug}/\`
- **Mode:** Mode B (\`standalone\`)
- **Theme Isolation:** Scoped strictly under \`[data-template-theme="${slug}"]\`
- **Excluded Artifacts:** \`node_modules\`, \`.next\`, \`.git\`, \`.env\`
`;

  const indexTs = `import type { DualModeTemplateEntry } from "../../types.js";
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

  fs.writeFileSync(
    path.join(bridgeDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );
  fs.writeFileSync(path.join(bridgeDir, "catalog.ts"), bridgeCatalogTs, "utf-8");
  fs.writeFileSync(
    path.join(bridgeDir, "components", "StandaloneBridge.tsx"),
    bridgeComponentsTsx,
    "utf-8",
  );
  fs.writeFileSync(
    path.join(bridgeDir, "components", "index.ts"),
    bridgeComponentsIndex,
    "utf-8",
  );
  fs.writeFileSync(path.join(bridgeDir, "theme.css"), scopedThemeCss, "utf-8");
  fs.writeFileSync(path.join(bridgeDir, "steering.md"), steeringMd, "utf-8");
  fs.writeFileSync(path.join(bridgeDir, "SKILL.md"), skillMd, "utf-8");
  fs.writeFileSync(path.join(bridgeDir, "POWER.md"), kiroPowerMd, "utf-8");
  fs.writeFileSync(path.join(bridgeDir, "index.ts"), indexTs, "utf-8");

  syncTemplatesRegistry(repoRoot);

  return {
    slug,
    sourceDropinDir,
    cleanSourceDestDir,
    bridgeDir,
    manifest,
    cleanFileCount: cleanFiles.length,
    detectedSections,
    detectedPages: pages.map((p) => p.route),
    warnings,
  };
}

/**
 * Discovers and ingests every project folder inside `standalone-dropin/`.
 */
export function ingestAllDropins(
  repoRoot = process.cwd(),
): IngestStandaloneResult[] {
  const dropinRoot = path.join(repoRoot, "standalone-dropin");
  if (!fs.existsSync(dropinRoot)) return [];
  const dirs = fs
    .readdirSync(dropinRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));

  return dirs.map((d) =>
    ingestStandaloneProject({
      slug: d.name,
      repoRoot,
      overwrite: true,
    }),
  );
}
