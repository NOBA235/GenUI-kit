import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_MONOCHROME_HEXES,
  ArchiveEntrySchema,
  CategoryManifestSchema,
  MONOCHROME_PALETTE,
  TimelineMilestoneSchema,
} from "../ninety9-archive/lib/archive/types.js";
import {
  getAllCategories,
  getAllEntries,
  getArchiveStats,
  getAvailableArchiveYears,
  getAvailableEntryTypes,
  getCategoryBySlug,
  getCategoryWithEntries,
  getEntryBySlug,
  getRelatedDossiers,
  getTimelineMilestones,
  queryArchiveEntries,
  transmitRandomPacket,
} from "../ninety9-archive/lib/archive/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.resolve(__dirname, "../../../..");
const PUBLIC_ROOT = path.join(MONOREPO_ROOT, "public");

const PLACEHOLDER_REGEX = /\b(lorem|ipsum|tbd|placeholder|coming soon)\b/i;

const REQUIRED_CORE_SLUGS = [
  "nirvana-nevermind",
  "nas-illmatic",
  "daft-punk-homework",
  "the-matrix",
  "pulp-fiction",
  "jurassic-park",
  "the-x-files",
  "twin-peaks",
  "seinfeld",
  "neon-genesis-evangelion",
  "batman-tas",
  "sony-playstation",
  "nintendo-64",
  "doom-1993",
  "game-boy-pokemon",
  "imac-g3",
  "palmpilot-1000",
  "sony-minidisc",
  "windows-95",
  "supreme-nyc",
  "minimalist-runway",
  "ncsa-mosaic",
  "netscape-navigator",
  "geocities-1994",
  "cybercafe-culture",
  "underground-rave",
  "tamagotchi",
  "beanie-babies",
  "dream-team-1992",
  "last-dance-1998",
  "y2k-bug-1999",
  "lollapalooza-91",
] as const;

describe("NINETY9 Archive — Milestone 1 Dataset, API & Monochrome SVG Assets", () => {
  it("enforces the strict 5-tone monochrome palette constants", () => {
    expect(ALLOWED_MONOCHROME_HEXES).toEqual([
      "#FFFFFF",
      "#000000",
      "#D9D9D9",
      "#808080",
      "#292929",
    ]);
    expect(Object.values(MONOCHROME_PALETTE)).toEqual(ALLOWED_MONOCHROME_HEXES);
  });

  it("validates all 12 numbered archival categories (01 through 12)", () => {
    const categories = getAllCategories();
    expect(categories).toHaveLength(12);

    const codes = categories.map((category) => category.code);
    expect(codes).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ]);

    for (const category of categories) {
      expect(CategoryManifestSchema.safeParse(category).success).toBe(true);
      expect(PLACEHOLDER_REGEX.test(category.essay)).toBe(false);
      expect(PLACEHOLDER_REGEX.test(category.tagline)).toBe(false);

      const joined = getCategoryWithEntries(category.slug);
      expect(joined).toBeDefined();
      expect(joined?.entries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("validates all 34 historically accurate 1990-1999 archive entries with zero placeholders", () => {
    const entries = getAllEntries();
    expect(entries).toHaveLength(34);

    const idSet = new Set<string>();
    const slugSet = new Set<string>();
    const serialSet = new Set<string>();
    const pathSet = new Set<string>();
    const coveredYears = new Set<number>();

    for (const entry of entries) {
      expect(ArchiveEntrySchema.safeParse(entry).success).toBe(true);

      expect(idSet.has(entry.id)).toBe(false);
      expect(slugSet.has(entry.slug)).toBe(false);
      expect(serialSet.has(entry.serialNumber)).toBe(false);
      expect(pathSet.has(entry.illustrationPath)).toBe(false);

      idSet.add(entry.id);
      slugSet.add(entry.slug);
      serialSet.add(entry.serialNumber);
      pathSet.add(entry.illustrationPath);
      coveredYears.add(entry.year);

      expect(getCategoryBySlug(entry.category)).toBeDefined();
      expect(entry.specs).toHaveLength(4);
      expect(entry.sections.length).toBeGreaterThanOrEqual(2);
      expect(entry.citations.length).toBeGreaterThanOrEqual(2);

      const fullCopy = [
        entry.title,
        entry.subtitle,
        entry.summary,
        entry.culturalImpact,
        entry.historicalLegacy,
        entry.pullQuote.quote,
        ...entry.sections.map((section) => `${section.heading} ${section.body}`),
      ].join(" ");
      expect(PLACEHOLDER_REGEX.test(fullCopy)).toBe(false);
    }

    for (let year = 1990; year <= 1999; year++) {
      expect(coveredYears.has(year)).toBe(true);
    }

    for (const requiredSlug of REQUIRED_CORE_SLUGS) {
      expect(slugSet.has(requiredSlug)).toBe(true);
    }

    for (const entry of entries) {
      for (const relatedSlug of entry.relatedSlugs) {
        expect(relatedSlug).not.toBe(entry.slug);
        expect(slugSet.has(relatedSlug)).toBe(true);
      }
    }
  });

  it("validates chronological timeline milestones spanning 1990-1999", () => {
    const milestones = getTimelineMilestones();
    expect(milestones.length).toBeGreaterThanOrEqual(25);

    const years = new Set<number>();
    const ids = new Set<string>();

    for (const milestone of milestones) {
      expect(TimelineMilestoneSchema.safeParse(milestone).success).toBe(true);
      expect(ids.has(milestone.id)).toBe(false);
      ids.add(milestone.id);
      years.add(milestone.year);
      expect(getCategoryBySlug(milestone.category)).toBeDefined();
      if (milestone.linkedEntrySlug) {
        expect(getEntryBySlug(milestone.linkedEntrySlug)).toBeDefined();
      }
    }

    for (let year = 1990; year <= 1999; year++) {
      expect(years.has(year)).toBe(true);
    }
    expect(getTimelineMilestones(1994).every((m) => m.year === 1994)).toBe(true);
  });

  it("executes multi-facet queryArchiveEntries, fuzzy search, sorting, related lookup & deterministic transmit", () => {
    const stats = getArchiveStats();
    expect(stats).toEqual({
      totalEntries: 34,
      totalCategories: 12,
      totalMilestones: getTimelineMilestones().length,
      yearSpan: [1990, 1999],
      coveredYearsCount: 10,
      paletteHexCount: 5,
    });

    expect(getAvailableArchiveYears()).toEqual([
      1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999,
    ]);
    expect(getAvailableEntryTypes().length).toBeGreaterThanOrEqual(10);

    const playstationMatches = queryArchiveEntries({
      query: "sony 1994",
      category: "gaming",
    });
    expect(playstationMatches.map((entry) => entry.slug)).toContain(
      "sony-playstation"
    );

    const matrixMatches = queryArchiveEntries({ query: "bullet-time matrix" });
    expect(matrixMatches[0]?.slug).toBe("the-matrix");

    const descSorted = queryArchiveEntries({ sort: "chronological-desc" });
    expect(descSorted[0]?.year).toBe(1999);
    expect(descSorted[descSorted.length - 1]?.year).toBe(1990);

    const titleSorted = queryArchiveEntries({ sort: "title-asc" });
    for (let i = 1; i < titleSorted.length; i++) {
      expect(
        titleSorted[i - 1]!.title.localeCompare(titleSorted[i]!.title)
      ).toBeLessThanOrEqual(0);
    }

    const webGroup = getCategoryWithEntries("web-1-0");
    expect(webGroup?.entries.map((entry) => entry.slug)).toEqual([
      "ncsa-mosaic",
      "netscape-navigator",
      "geocities-1994",
      "cybercafe-culture",
    ]);

    for (const entry of getAllEntries()) {
      const related = getRelatedDossiers(entry.slug, 3);
      expect(related).toHaveLength(3);
      expect(related.some((r) => r.slug === entry.slug)).toBe(false);
    }

    const packetA = transmitRandomPacket({ seed: 1997 });
    const packetB = transmitRandomPacket({ seed: 1997 });
    expect(packetA.entry.slug).toBe(packetB.entry.slug);
    expect(packetA.packetId).toBe(packetB.packetId);

    for (let seed = 0; seed < 25; seed++) {
      const packet = transmitRandomPacket({
        excludeSlug: "the-matrix",
        seed,
      });
      expect(packet.entry.slug).not.toBe("the-matrix");
    }
  });

  it("verifies all 46 generated technical SVG files exist and strictly honor the 5-tone monochrome palette", () => {
    const allowedHexSet = new Set<string>(
      ALLOWED_MONOCHROME_HEXES.map((hex) => hex.toUpperCase())
    );
    const assetPaths = [
      ...getAllEntries().map((entry) => entry.illustrationPath),
      ...getAllCategories().map((category) => category.illustrationPath),
    ];
    expect(assetPaths).toHaveLength(46);

    for (const relWebPath of assetPaths) {
      const diskPath = path.join(PUBLIC_ROOT, relWebPath.replace(/^\//, ""));
      expect(fs.existsSync(diskPath)).toBe(true);

      const svgText = fs.readFileSync(diskPath, "utf8");
      expect(svgText).toContain("<svg");
      expect(svgText).toContain("</svg>");
      expect(svgText).not.toMatch(/<script\b/i);
      expect(svgText).not.toMatch(/\brgba?\(|\bhsla?\(/i);

      const hexColors = svgText.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexColors.length).toBeGreaterThan(0);
      for (const hex of hexColors) {
        expect(allowedHexSet.has(hex.toUpperCase())).toBe(true);
      }
    }
  });
});
