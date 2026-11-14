import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearRuntimeTemplates,
  exportTemplateToShadcnRegistry,
  generateStarterThemeCss,
  generateTemplateZip,
  getAllTemplates,
  getTemplateBySlug,
  listTemplates,
  MARKETPLACE_FILTER_TAGS,
  mergeTemplateWithNextjsShell,
  registerRuntimeTemplate,
  scopeTemplateCss,
  showcasePreviewCatalog,
  SHOWCASE_PACK_TEMPLATES,
} from "../index.js";
import {
  ingestStandaloneProject,
  scaffoldNativeTemplate,
} from "../node/index.js";

function createTempRepoRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "genui-dual-mode-"));
  fs.mkdirSync(path.join(dir, "packages", "templates", "src"), {
    recursive: true,
  });
  return dir;
}

describe("Dual-Mode Template Architecture & Registry Engine", () => {
  const createdTempDirs: string[] = [];

  afterEach(() => {
    clearRuntimeTemplates();
    while (createdTempDirs.length > 0) {
      const dir = createdTempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("CSS & Theme Variable Isolation Engine", () => {
    it("rewrites :root/html/body selectors and wraps styles in @scope ([data-template-theme])", () => {
      const scoped = scopeTemplateCss(
        `
        :root { --custom-glow: cyan; }
        html, body { margin: 0; font-size: 16px; }
        .hero-title { letter-spacing: -0.02em; }
        </style><script>alert(1)</script>
        .bad { background: url("javascript:alert(1)"); }
        `,
        "aurora-fintech",
        {
          defaultColorScheme: "light",
          accentColor: "#2563eb",
          surfaceBg: "#f8fafc",
          textColor: "#0f172a",
          displayFont: '"Instrument Serif", serif',
          bodyFont: '"Inter", sans-serif',
          borderRadius: "1rem",
        },
      );

      expect(scoped).toContain('[data-template-theme="aurora-fintech"]');
      expect(scoped).toContain("color-scheme: only light;");
      expect(scoped).toContain("@scope ([data-template-theme=\"aurora-fintech\"])");
      expect(scoped).not.toContain(":root");
      expect(scoped).not.toContain("</style");
      expect(scoped).not.toMatch(/javascript\s*:/i);
      expect(scoped).toContain("--tpl-bg: #f8fafc;");
      expect(scoped).toContain("isolation: isolate;");
      expect(scoped).toContain("container-type: inline-size;");
    });

    it("generates starter theme.css strictly scoped to the template slug", () => {
      const css = generateStarterThemeCss("cyber-vault", {
        defaultColorScheme: "dark",
        accentColor: "#22d3ee",
        surfaceBg: "#070b14",
        textColor: "#f8fafc",
        displayFont: '"Space Grotesk", sans-serif',
        bodyFont: '"Inter", sans-serif',
        borderRadius: "0.75rem",
      });

      expect(css).toContain('[data-template-theme="cyber-vault"]');
      expect(css).toContain("color-scheme: only dark;");
      expect(css).not.toContain(":root");
    });
  });

  describe("Mode A: Native Website Scaffolder (scaffoldNativeTemplate)", () => {
    it("scaffolds manifest.json, catalog.ts, components/, theme.css, steering.md, and generated bundles", () => {
      const tempRoot = createTempRepoRoot();
      createdTempDirs.push(tempRoot);

      const res = scaffoldNativeTemplate({
        slug: "obsidian-defi",
        repoRoot: tempRoot,
        title: "Obsidian DeFi Exchange",
        category: "Web3 / DeFi",
        tags: ["Web3 / DeFi", "B2B SaaS"],
        tier: "pro",
        priceUsd: 79,
        colorScheme: "dark",
      });

      expect(res.slug).toBe("obsidian-defi");
      expect(res.manifest.mode).toBe("native");
      expect(fs.existsSync(path.join(res.templateDir, "manifest.json"))).toBe(true);
      expect(fs.existsSync(path.join(res.templateDir, "catalog.ts"))).toBe(true);
      expect(fs.existsSync(path.join(res.templateDir, "theme.css"))).toBe(true);
      expect(fs.existsSync(path.join(res.templateDir, "steering.md"))).toBe(true);
      expect(fs.existsSync(path.join(res.templateDir, "index.ts"))).toBe(true);
      expect(
        fs.existsSync(path.join(res.templateDir, "components", "Sections.tsx")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(res.templateDir, "components", "index.ts")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(res.templateDir, "bundle.generated.ts")),
      ).toBe(true);

      const registryFile = fs.readFileSync(
        path.join(
          tempRoot,
          "packages",
          "templates",
          "src",
          "registry-entries.generated.ts",
        ),
        "utf-8",
      );
      expect(registryFile).toContain("./obsidian-defi/index.js");
    });
  });

  describe("Mode B: Drop-In Standalone Ingestion (ingestStandaloneProject)", () => {
    it("scans drop-in Next.js project, excludes secrets/build dirs, and generates catalog bridge + SKILL/POWER files", async () => {
      const tempRoot = createTempRepoRoot();
      createdTempDirs.push(tempRoot);

      const dropinDir = path.join(tempRoot, "standalone-dropin", "nexus-storefront");
      fs.mkdirSync(path.join(dropinDir, "app", "pricing"), { recursive: true });
      fs.mkdirSync(path.join(dropinDir, "components"), { recursive: true });
      fs.mkdirSync(path.join(dropinDir, "node_modules", "left-pad"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(dropinDir, ".next", "cache"), { recursive: true });
      fs.mkdirSync(path.join(dropinDir, ".git", "objects"), { recursive: true });

      fs.writeFileSync(
        path.join(dropinDir, "package.json"),
        JSON.stringify(
          {
            name: "nexus-ecommerce-pro",
            version: "2.1.0",
            description: "High-converting Stripe commerce storefront",
            dependencies: {
              next: "^15.1.0",
              react: "^19.0.0",
              stripe: "^17.0.0",
              three: "^0.172.0",
            },
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(dropinDir, "app", "page.tsx"),
        "export default function HomePage() { return <main>Home</main>; }\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, "app", "pricing", "page.tsx"),
        "export default function PricingPage() { return <main>Pricing</main>; }\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, "app", "globals.css"),
        ":root { --bg: #050816; } body { color: #f8fafc; }\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, "components", "HeroShowcase.tsx"),
        "export function HeroShowcase() { return <section>Hero</section>; }\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, "components", "CartDrawer.tsx"),
        "export function CartDrawer() { return <aside>Cart</aside>; }\n",
      );

      // Excluded files & artifacts that MUST never leak into clean archives or .zip
      fs.writeFileSync(
        path.join(dropinDir, ".env"),
        "STRIPE_SECRET_KEY=sk_live_MUST_NOT_LEAK\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, ".env.local"),
        "SECRET_TOKEN=must_not_leak\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, "node_modules", "left-pad", "index.js"),
        "module.exports = () => {};\n",
      );
      fs.writeFileSync(
        path.join(dropinDir, ".next", "cache", "build.bin"),
        "cache-artifact",
      );
      fs.writeFileSync(
        path.join(dropinDir, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );

      const result = ingestStandaloneProject({
        slug: "nexus-storefront",
        repoRoot: tempRoot,
        overwrite: true,
      });

      expect(result.slug).toBe("nexus-storefront");
      expect(result.manifest.mode).toBe("standalone");
      expect(result.manifest.standaloneMeta?.framework).toBe("nextjs-app");
      expect(result.detectedSections).toContain("HeroShowcase");
      expect(result.detectedSections).toContain("CartDrawer");
      expect(result.detectedPages.length).toBeGreaterThanOrEqual(2);
      expect(result.manifest.tags).toContain("Full-Stack Standalone");
      expect(result.manifest.tags).toContain("E-Commerce");
      expect(result.manifest.tags).toContain("3D / WebGL");

      // Verify clean source copy excludes node_modules, .next, .git, .env
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, "package.json")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, "app", "page.tsx")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, ".env")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, ".env.local")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, "node_modules")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, ".next")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(result.cleanSourceDestDir, ".git")),
      ).toBe(false);

      // Verify bridge artifacts
      expect(fs.existsSync(path.join(result.bridgeDir, "manifest.json"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(result.bridgeDir, "catalog.ts"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(result.bridgeDir, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(result.bridgeDir, "POWER.md"))).toBe(true);
      expect(fs.existsSync(path.join(result.bridgeDir, "bundle.generated.ts"))).toBe(
        true,
      );

      // Verify generated bundle.generated.ts also does not contain .env secret
      const bundleText = fs.readFileSync(
        path.join(result.bridgeDir, "bundle.generated.ts"),
        "utf-8",
      );
      expect(bundleText).not.toContain("sk_live_MUST_NOT_LEAK");
      expect(bundleText).not.toContain("must_not_leak");

      const registryGenerated = fs.readFileSync(
        path.join(
          tempRoot,
          "packages",
          "templates",
          "src",
          "registry-entries.generated.ts",
        ),
        "utf-8",
      );
      expect(registryGenerated).toContain("./standalone/nexus-storefront/index.js");
    });
  });

  describe("Unified Storefront Filtering, Shell Merge & .ZIP / Shadcn Export", () => {
    it("filters seamlessly across Mode A, Mode B, and all 6 Marketplace tags", () => {
      const base = SHOWCASE_PACK_TEMPLATES[0]!;
      registerRuntimeTemplate({
        ...base,
        manifest: {
          ...base.manifest,
          slug: "quantum-dex-standalone",
          id: "quantum-dex-standalone",
          name: "quantum-dex-standalone",
          title: "Quantum DEX Standalone",
          mode: "standalone",
          category: "Web3 / DeFi",
          tags: ["Web3 / DeFi", "Full-Stack Standalone", "GenUI Verified"],
          verified: true,
        },
      });

      expect(MARKETPLACE_FILTER_TAGS).toEqual([
        "3D / WebGL",
        "B2B SaaS",
        "E-Commerce",
        "Web3 / DeFi",
        "Full-Stack Standalone",
        "GenUI Verified",
      ]);

      const all = getAllTemplates();
      expect(all.some((t) => t.manifest.mode === "native")).toBe(true);
      expect(all.some((t) => t.manifest.mode === "standalone")).toBe(true);

      const standaloneOnly = listTemplates({ mode: "standalone" });
      expect(standaloneOnly.map((t) => t.manifest.slug)).toContain(
        "quantum-dex-standalone",
      );

      const defiTagged = listTemplates({ tag: "Web3 / DeFi" });
      expect(defiTagged.map((t) => t.manifest.slug)).toEqual([
        "quantum-dex-standalone",
      ]);

      const saasBase = SHOWCASE_PACK_TEMPLATES[0]!;
      registerRuntimeTemplate({
        ...saasBase,
        manifest: {
          ...saasBase.manifest,
          slug: "saas-telemetry-kit",
          id: "saas-telemetry-kit",
          name: "saas-telemetry-kit",
          title: "SaaS Telemetry Kit",
          mode: "native",
          category: "B2B SaaS",
          tags: ["B2B SaaS", "GenUI Verified"],
          verified: true,
        },
      });

      const saasTagged = listTemplates({ tag: "B2B SaaS" });
      expect(saasTagged.length).toBeGreaterThan(0);

      expect(getTemplateBySlug("spatial-ops-3d-pro")).toBeDefined();
      expect(getTemplateBySlug("quantum-dex-standalone")).toBeDefined();
    });

    it("merges Mode A templates with base-nextjs-shell into a valid Next.js 15 .zip and enforces Pro Shadcn license gating", async () => {
      const template = getTemplateBySlug("spatial-ops-3d-pro")!;
      expect(template).toBeDefined();

      const mergedFiles = mergeTemplateWithNextjsShell(template, {
        projectName: "spatial-ops-next-export",
      });
      expect(mergedFiles["package.json"]).toContain('"spatial-ops-next-export"');
      expect(mergedFiles["next.config.mjs"]).toContain("@genui-studio/core");
      expect(mergedFiles["app/layout.tsx"]).toContain("RootLayout");
      expect(mergedFiles["app/page.tsx"]).toBeDefined();
      expect(mergedFiles["SKILL.md"]).toBeDefined();
      expect(mergedFiles[".kiro/powers/spatial-ops-3d-pro/POWER.md"]).toBeDefined();

      const zipBytes = await generateTemplateZip(template);
      const parsedZip = await JSZip.loadAsync(zipBytes);
      expect(parsedZip.file("package.json")).not.toBeNull();
      expect(parsedZip.file("app/page.tsx")).not.toBeNull();
      expect(parsedZip.file("app/template-theme.css")).not.toBeNull();

      // Shadcn license gate test on Mode B Pro entry using showcasePreviewCatalog
      const modeBPro = {
        ...template,
        catalog: showcasePreviewCatalog,
        manifest: {
          ...template.manifest,
          slug: "luxury-commerce-standalone",
          id: "luxury-commerce-standalone",
          name: "luxury-commerce-standalone",
          mode: "standalone" as const,
          tier: "pro" as const,
          tags: ["E-Commerce", "Full-Stack Standalone", "GenUI Verified"],
        },
        sourceFiles: [
          {
            path: "package.json",
            content: '{"name":"luxury-commerce-standalone","dependencies":{"next":"^15.1.0"}}',
            kind: "source" as const,
          },
          {
            path: "app/page.tsx",
            content: "export default function Page() { return <main>Shop</main>; }\n",
            kind: "source" as const,
          },
          {
            path: ".env",
            content: "SHOULD_BE_EXCLUDED=true",
            kind: "source" as const,
          },
        ],
      };

      const unauthed = exportTemplateToShadcnRegistry(modeBPro);
      expect(unauthed.success).toBe(false);
      expect(unauthed.requiresLicense).toBe(true);

      const authed = exportTemplateToShadcnRegistry(modeBPro, {
        licenseToken: "kiroween-2026-judge-pass",
      });
      expect(authed.success).toBe(true);
      expect(authed.shadcnItem?.name).toBe("luxury-commerce-standalone");

      const modeBZipBytes = await generateTemplateZip(modeBPro);
      const modeBZip = await JSZip.loadAsync(modeBZipBytes);
      expect(modeBZip.file("app/page.tsx")).not.toBeNull();
      expect(modeBZip.file(".env")).toBeNull();
    });
  });
});
