import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fc from "fast-check";
import JSZip from "jszip";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Renderer, JSONUIProvider } from "@json-render/react";
import { afterEach, describe, expect, it } from "vitest";
import { createGuardrailedStreamCompiler } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import {
  buildChaosPackets,
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog as ninety9Catalog,
} from "../ninety9-archive/catalog.js";
import {
  AboutView,
  ArchiveCatalogView,
  CategoriesView,
  DossierReaderView,
  templateComponents,
} from "../ninety9-archive/components/index.js";
import {
  getAllArchivalPhotos,
  getAllCategories,
  getAllEntries,
  getAvailableArchiveYears,
  getAvailableEntryTypes,
  getCategoryPhoto,
  getEntryPhoto,
  getHighlightPhotos,
  queryArchiveEntries,
  transmitRandomPacket,
} from "../ninety9-archive/lib/archive/api.js";
import { ArchivalPhotoSchema } from "../ninety9-archive/content/photos.js";
import {
  ALLOWED_MONOCHROME_HEXES,
  ArchiveSortOptionSchema,
  CRTModeSchema,
} from "../ninety9-archive/lib/archive/types.js";
import { useNinety9Store } from "../ninety9-archive/store.js";
import { generateTemplateZip } from "../exporter.js";
import { getTemplateBySlug } from "../registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.resolve(__dirname, "../../../..");
const ALLOWED_HEX_SET = new Set<string>(ALLOWED_MONOCHROME_HEXES);

function collectFilesRecursively(dirPath: string, exts: readonly string[]): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFilesRecursively(abs, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(abs);
    }
  }
  return out;
}

function normalizeHex(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.length === 4) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }
  return upper;
}

describe("NINETY9 Archive — fast-check Property-Based & Monochrome Invariant Suite", () => {
  afterEach(() => {
    useNinety9Store.getState().resetStoreForTest();
  });

  it("PBT-01: Strict 5-Tone Monochrome Palette Invariant across all SVGs, CSS, Catalog, Manifest & TSX components", () => {
    const svgFiles = collectFilesRecursively(
      path.join(MONOREPO_ROOT, "public", "images", "ninety9"),
      [".svg"]
    );
    expect(svgFiles.length).toBe(46);

    const sourceFiles = [
      path.join(MONOREPO_ROOT, "packages", "templates", "src", "ninety9-archive", "theme.css"),
      path.join(MONOREPO_ROOT, "packages", "templates", "src", "ninety9-archive", "catalog.ts"),
      path.join(MONOREPO_ROOT, "packages", "templates", "src", "ninety9-archive", "manifest.json"),
      ...collectFilesRecursively(
        path.join(MONOREPO_ROOT, "packages", "templates", "src", "ninety9-archive", "components"),
        [".ts", ".tsx"]
      ),
      ...svgFiles,
    ];

    const forbiddenTailwindColorPattern =
      /\b(?:text|bg|border|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:\d{2,3})\b/;

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const rel = path.relative(MONOREPO_ROOT, filePath).replace(/\\/g, "/");

      // Strip only explicit test/sanitizer chaos documentation literals before scanning hexes
      const sanitizedContent =
        rel.endsWith("catalog.ts")
          ? content.slice(0, content.indexOf("export function buildRemixJsonl"))
          : content;

      const hexMatches = sanitizedContent.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      for (const hex of hexMatches) {
        const normalized = normalizeHex(hex);
        expect(
          ALLOWED_HEX_SET.has(normalized),
          `Off-palette hex ${hex} (${normalized}) found in ${rel}`
        ).toBe(true);
      }

      if (rel.endsWith(".tsx") || rel.endsWith(".ts")) {
        expect(
          forbiddenTailwindColorPattern.test(sanitizedContent),
          `Forbidden colored Tailwind utility found in ${rel}`
        ).toBe(false);
      }
    }

    // Property-based hex check over every catalog spec + remix spec prop value
    const allSpecs = Object.values(initialPageSpecs);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allSpecs.length - 1 }),
        (idx) => {
          const spec = allSpecs[idx]!;
          const jsonText = JSON.stringify(spec);
          const hexes = jsonText.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
          for (const h of hexes) {
            expect(ALLOWED_HEX_SET.has(normalizeHex(h))).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("PBT-02: Query, Multi-Facet Filter & Random Transmission Determinism across 500 randomized combinations", () => {
    const categories = getAllCategories();
    const years = getAvailableArchiveYears();
    const types = getAvailableEntryTypes();
    const entries = getAllEntries();
    const sortOptions = ArchiveSortOptionSchema.options;

    const queryVocabulary = [
      "",
      "nirvana",
      "matrix",
      "ARC-06",
      "sony",
      "mosaic",
      "1995",
      "grunge",
      "nintendo",
      "hypertext",
      "nonexistent_zzzz_token",
      ...entries.slice(0, 12).map((e) => e.tags[0]!),
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...queryVocabulary),
        fc.oneof(fc.constant("all" as const), fc.constantFrom(...years)),
        fc.oneof(
          fc.constant("all" as const),
          fc.constantFrom(...categories.map((c) => c.slug))
        ),
        fc.oneof(fc.constant("all" as const), fc.constantFrom(...types)),
        fc.constantFrom(...sortOptions),
        (query, year, category, type, sort) => {
          const filter = { query, year, category, type, sort };
          const runA = queryArchiveEntries(filter);
          const runB = queryArchiveEntries(filter);

          expect(runA.map((e) => e.id)).toEqual(runB.map((e) => e.id));

          for (const item of runA) {
            if (year !== "all") {
              expect(item.year).toBe(year);
            }
            if (category !== "all") {
              expect(item.category).toBe(category);
            }
            if (type !== "all") {
              expect(item.type).toBe(type);
            }
          }
        }
      ),
      { numRuns: 500 }
    );

    // Deterministic seeded random packet transmission + exclusion invariant
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 0, max: entries.length - 1 }),
        (seed, excludeIdx) => {
          const excludeSlug = entries[excludeIdx]!.slug;
          const pktA = transmitRandomPacket({ excludeSlug, seed });
          const pktB = transmitRandomPacket({ excludeSlug, seed });

          expect(pktA.packetId).toBe(pktB.packetId);
          expect(pktA.entry.slug).toBe(pktB.entry.slug);
          expect(pktA.entry.slug).not.toBe(excludeSlug);
          expect(pktA.related.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("PBT-03: Zod Catalog Invariants, Stream Chaos Healing, Fuzz SSR Rendering & Next.js .ZIP Export Parity", async () => {
    // 1. Formal @genui-studio/core catalog invariant suite
    const report = runCatalogInvariantSuite(ninety9Catalog, { numRuns: 15 });
    expect(report.allPassed).toBe(true);

    // 2. Live Remix Presets + Chaos Non-Monochrome / Invalid Year Healing
    const baseHome = initialPageSpecs.home!;
    for (const presetPrompt of [
      "Remix Layout: 1995 Cyber-Hardware Special Issue (Focus: Technology & Gaming)",
      "Remix Layout: 1991 Underground Zine Edition (Focus: Music & Cinema)",
    ]) {
      const compiler = createGuardrailedStreamCompiler({ catalog: ninety9Catalog });
      compiler.push(buildRemixJsonl(presetPrompt, baseHome));
      const finalized = compiler.finalize();
      expect(finalized.issues.length).toBe(0);
      expect(finalized.spec.root).toBe("ninety9-shell");
      const jsonHexes = JSON.stringify(finalized.spec).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      for (const h of jsonHexes) {
        expect(ALLOWED_HEX_SET.has(normalizeHex(h))).toBe(true);
      }
    }

    // Preset 3 + buildChaosPackets: Off-palette #FF00FF / #00FFCC / #39FF14 and Year 2045 / 2077
    // must be healed with explicit provenance diagnostics before DOM mount.
    const chaosCompiler = createGuardrailedStreamCompiler({ catalog: ninety9Catalog });
    const stepPreset3 = chaosCompiler.push(
      buildRemixJsonl("Inject Corrupted Non-Monochrome / Invalid Year Packet", baseHome)
    );
    const finalizedPreset3 = chaosCompiler.finalize();
    expect(Object.keys(stepPreset3.healedDiagnostics).length).toBeGreaterThan(0);

    const healedHero = finalizedPreset3.spec.elements["ninety9-hero"]?.props as Record<string, unknown>;
    const healedTimeline = finalizedPreset3.spec.elements["ninety9-timeline"]?.props as Record<string, unknown>;
    expect(ALLOWED_HEX_SET.has(String(healedHero?.inkHex))).toBe(true);
    expect(ALLOWED_HEX_SET.has(String(healedHero?.surfaceHex))).toBe(true);
    expect(Number(healedTimeline?.initialYear)).toBe(1999);

    const packetCompiler = createGuardrailedStreamCompiler({ catalog: ninety9Catalog });
    packetCompiler.push(buildRemixJsonl("1995 Cyber-Hardware", baseHome));
    const stepPackets = packetCompiler.push(buildChaosPackets(baseHome.root).join("\n") + "\n");
    const finalizedPackets = packetCompiler.finalize();
    expect(stepPackets.healedDiagnostics["chaos-monochrome-timeline"]).toBeDefined();
    expect(stepPackets.healedDiagnostics["chaos-monochrome-hero"]).toBeDefined();
    expect(
      Number(
        (finalizedPackets.spec.elements["chaos-monochrome-timeline"]?.props as Record<string, unknown>)
          ?.initialYear
      )
    ).toBeLessThanOrEqual(1999);

    // 3. Fuzz React SSR Rendering across all page specs & standalone component permutations
    const entries = getAllEntries();
    const categories = getAllCategories();
    for (const [pageId, pageSpec] of Object.entries(initialPageSpecs)) {
      const html = renderToStaticMarkup(
        React.createElement(JSONUIProvider, {
          registry: templateComponents,
          children: React.createElement(Renderer, {
            spec: pageSpec,
            registry: templateComponents,
          }),
        })
      );
      expect(html, `Page spec ${pageId} rendered empty markup`).toContain(
        'data-template-theme="ninety9-archive"'
      );
    }

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...entries.map((e) => e.slug)),
          fc.constant("unknown-fuzzed-slug-999")
        ),
        fc.oneof(
          fc.constant("all" as const),
          fc.constantFrom(...categories.map((c) => c.slug))
        ),
        fc.constantFrom(...CRTModeSchema.options),
        fc.constantFrom(...ArchiveSortOptionSchema.options),
        (slug, cat, crtMode, sort) => {
          useNinety9Store.getState().setCrtMode(crtMode);
          const catalogHtml = renderToStaticMarkup(
            React.createElement(ArchiveCatalogView, {
              heading: "FUZZ CATALOG",
              initialCategory: cat,
              initialYearFilter: "all",
              initialSort: sort,
            })
          );
          const dossierHtml = renderToStaticMarkup(
            React.createElement(DossierReaderView, {
              slug,
              showRelated: true,
              showGallery: true,
            })
          );
          const categoriesHtml = renderToStaticMarkup(
            React.createElement(CategoriesView, {
              heading: "FUZZ SECTORS",
              initialCategory: cat,
            })
          );
          const aboutHtml = renderToStaticMarkup(
            React.createElement(AboutView, { heading: "FUZZ ABOUT" })
          );

          expect(catalogHtml).toContain("ninety9-archive-catalog-view");
          expect(dossierHtml).toContain("TECHNICAL SPECIFICATION SHEET");
          expect(categoriesHtml).toContain("ninety9-categories-view");
          expect(aboutHtml).toContain("STRICT 5-TONE MONOCHROME HEX LAW");
        }
      ),
      { numRuns: 25 }
    );

    // 4. Dual-Mode Registry + Next.js .ZIP Exporter Parity (including routes + SKILL.md + POWER.md + SVGs)
    const entry = getTemplateBySlug("ninety9-archive");
    expect(entry).toBeDefined();
    expect(entry!.manifest.tier).toBe("free");
    expect(entry!.manifest.pages.map((p) => p.route)).toEqual([
      "/",
      "/archive",
      "/timeline",
      "/categories",
      "/about",
    ]);

    const zipBytes = await generateTemplateZip(entry!);
    const zip = await JSZip.loadAsync(zipBytes);
    const zipPaths = Object.keys(zip.files);

    expect(zipPaths).toContain("SKILL.md");
    expect(zipPaths).toContain(".kiro/powers/ninety9-archive/POWER.md");
    expect(zipPaths).toContain("ASSET_MANIFEST.md");
    expect(zipPaths).toContain("app/page.tsx");
    expect(zipPaths).toContain("app/archive/page.tsx");
    expect(zipPaths).toContain("app/timeline/page.tsx");
    expect(zipPaths).toContain("app/categories/page.tsx");
    expect(zipPaths).toContain("app/about/page.tsx");

    const exportedSvgCount = zipPaths.filter(
      (p) => p.startsWith("public/images/ninety9/") && p.endsWith(".svg")
    ).length;
    expect(exportedSvgCount).toBe(46);

    const exportedPhotos = zipPaths.filter(
      (p) =>
        p.startsWith("public/images/ninety9/photos/") &&
        (p.endsWith(".jpg") || p.endsWith(".png"))
    );
    expect(exportedPhotos.length).toBe(52);

    // Confirm binary photo decoding in ZIP preserves real JPEG/PNG headers
    const cobainZipBytes = await zip.file("public/images/ninety9/photos/nirvana-nevermind.jpg")!.async("uint8array");
    expect(cobainZipBytes[0]).toBe(0xff);
    expect(cobainZipBytes[1]).toBe(0xd8);
    const mosaicZipBytes = await zip.file("public/images/ninety9/photos/ncsa-mosaic.png")!.async("uint8array");
    expect(mosaicZipBytes[0]).toBe(0x89);
    expect(mosaicZipBytes[1]).toBe(0x50);
  }, 30_000);

  it("PBT-04: Open-Source 1990s Archival Photo Integrity, Attribution & SSR Plate Rendering", () => {
    const photos = getAllArchivalPhotos();
    expect(photos.length).toBe(52);
    expect(getHighlightPhotos().length).toBe(6);

    for (const entry of getAllEntries()) {
      expect(getEntryPhoto(entry.slug), `Missing entry photo for ${entry.slug}`).toBeDefined();
    }
    for (const category of getAllCategories()) {
      expect(getCategoryPhoto(category.slug), `Missing sector photo for ${category.slug}`).toBeDefined();
    }

    for (const photo of photos) {
      expect(ArchivalPhotoSchema.safeParse(photo).success).toBe(true);
      const diskPath = path.join(MONOREPO_ROOT, "public", photo.src.replace(/^\//, ""));
      expect(fs.existsSync(diskPath), `Photo missing on disk: ${photo.src}`).toBe(true);
      const buf = fs.readFileSync(diskPath);
      expect(buf.length).toBeGreaterThan(3000);
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      expect(isJpg || isPng, `Invalid image header for ${photo.src}`).toBe(true);
    }

    const dossierMarkup = renderToStaticMarkup(
      React.createElement(DossierReaderView, {
        slug: "sony-playstation",
        showRelated: true,
        showGallery: true,
      })
    );
    expect(dossierMarkup).toContain("/images/ninety9/photos/sony-playstation.jpg");
    expect(dossierMarkup).toContain("Public domain");
    expect(dossierMarkup).toContain("OPEN-SOURCE COMMONS RECORD");

    const aboutMarkup = renderToStaticMarkup(
      React.createElement(AboutView, { heading: "ABOUT TEST" })
    );
    expect(aboutMarkup).toContain("HISTORIC 1990S FIGURES");
    expect(aboutMarkup).toContain("52 OPEN-SOURCE PLATES");
    expect(aboutMarkup).toContain("/images/ninety9/photos/highlight-tim-berners-lee.jpg");
  });
});
