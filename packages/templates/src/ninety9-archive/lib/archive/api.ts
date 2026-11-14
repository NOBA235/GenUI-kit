import { ARCHIVE_ENTRIES } from "../../content/entries.js";
import { CATEGORIES } from "../../content/categories.js";
import { TIMELINE_MILESTONES } from "../../content/timeline-events.js";
import {
  ALLOWED_MONOCHROME_HEXES,
  ArchiveQueryFilterSchema,
  type ArchiveDatasetStats,
  type ArchiveEntry,
  type ArchiveEntryType,
  type ArchiveQueryFilter,
  type ArchiveSortOption,
  type CategoryManifest,
  type CategoryWithEntries,
  type TimelineMilestone,
  type TransmissionPacket,
} from "./types.js";

const CATEGORY_BY_SLUG = new Map<string, CategoryManifest>(
  CATEGORIES.map((category) => [category.slug, category])
);

const ENTRY_BY_SLUG = new Map<string, ArchiveEntry>(
  ARCHIVE_ENTRIES.map((entry) => [entry.slug, entry])
);

/** Deterministic 32-bit mix (Mulberry-style finalizer) for repeatable packet transmission. */
function hashSeed(seed: number): number {
  let state = (Math.trunc(seed) ^ 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x85ebca6b) >>> 0;
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35) >>> 0;
  return (state ^ (state >>> 16)) >>> 0;
}

function getBaudLabelForYear(year: number): string {
  if (year <= 1992) {
    return "9.6 KBPS // V.32 MODEM";
  }
  if (year <= 1995) {
    return "28.8 KBPS // V.34 MODEM";
  }
  if (year <= 1997) {
    return "33.6 KBPS // USR SPORTSTER";
  }
  return "56.0 KBPS // V.90 UPLINK";
}

function scoreEntryForTokens(entry: ArchiveEntry, tokens: readonly string[]): number {
  const titleLower = entry.title.toLowerCase();
  const serialLower = entry.serialNumber.toLowerCase();
  const idLower = entry.id.toLowerCase();
  const subtitleLower = entry.subtitle.toLowerCase();
  const creatorLower = entry.creatorOrPublisher.toLowerCase();
  const tagsLower = entry.tags.join(" ").toLowerCase();
  const typeLower = entry.type.toLowerCase();
  const originLower = entry.origin.toLowerCase();
  const summaryLower = entry.summary.toLowerCase();
  const quoteLower = `${entry.pullQuote.quote} ${entry.pullQuote.attribution}`.toLowerCase();
  const bodyLower = [
    entry.culturalImpact,
    entry.historicalLegacy,
    ...entry.sections.map((section) => `${section.heading} ${section.body}`),
    ...entry.specs.map((spec) => `${spec.label} ${spec.value}`),
    entry.category,
    String(entry.year),
  ]
    .join(" ")
    .toLowerCase();

  let totalScore = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    if (titleLower === token || serialLower === token || idLower === token) {
      tokenScore += 120;
    } else if (titleLower.startsWith(token)) {
      tokenScore += 90;
    } else if (titleLower.includes(token)) {
      tokenScore += 70;
    }

    if (serialLower.includes(token) || idLower.includes(token)) {
      tokenScore += 65;
    }
    if (tagsLower.includes(token)) {
      tokenScore += 45;
    }
    if (creatorLower.includes(token)) {
      tokenScore += 40;
    }
    if (subtitleLower.includes(token) || typeLower.includes(token)) {
      tokenScore += 30;
    }
    if (originLower.includes(token)) {
      tokenScore += 22;
    }
    if (summaryLower.includes(token)) {
      tokenScore += 18;
    }
    if (quoteLower.includes(token)) {
      tokenScore += 12;
    }
    if (bodyLower.includes(token)) {
      tokenScore += 8;
    }

    if (tokenScore === 0) {
      return 0;
    }
    totalScore += tokenScore;
  }

  return totalScore;
}

function compareEntriesBySort(
  a: ArchiveEntry,
  b: ArchiveEntry,
  sort: ArchiveSortOption
): number {
  switch (sort) {
    case "chronological-desc":
      return b.year - a.year || a.serialNumber.localeCompare(b.serialNumber);
    case "title-asc":
      return a.title.localeCompare(b.title) || a.year - b.year;
    case "serial-asc":
      return a.serialNumber.localeCompare(b.serialNumber);
    case "chronological-asc":
    default:
      return a.year - b.year || a.serialNumber.localeCompare(b.serialNumber);
  }
}

export function getAllCategories(): readonly CategoryManifest[] {
  return CATEGORIES;
}

export function getCategoryBySlug(slug: string): CategoryManifest | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

export function getCategoryWithEntries(
  slug: string
): CategoryWithEntries | undefined {
  const category = getCategoryBySlug(slug);
  if (!category) {
    return undefined;
  }
  const entries = ARCHIVE_ENTRIES.filter((entry) => entry.category === category.slug);
  return { category, entries };
}

export function getAllEntries(): readonly ArchiveEntry[] {
  return ARCHIVE_ENTRIES;
}

export function getEntryBySlug(slug: string): ArchiveEntry | undefined {
  return ENTRY_BY_SLUG.get(slug);
}

export function getTimelineMilestones(
  year?: number | "all"
): readonly TimelineMilestone[] {
  if (!year || year === "all") {
    return TIMELINE_MILESTONES;
  }
  return TIMELINE_MILESTONES.filter((milestone) => milestone.year === year);
}

export function getAvailableArchiveYears(): readonly number[] {
  const uniqueYears = new Set(ARCHIVE_ENTRIES.map((entry) => entry.year));
  return [...uniqueYears].sort((a, b) => a - b);
}

export function getAvailableEntryTypes(): readonly ArchiveEntryType[] {
  const uniqueTypes = new Set(ARCHIVE_ENTRIES.map((entry) => entry.type));
  return [...uniqueTypes].sort((a, b) => a.localeCompare(b));
}

export function getArchiveStats(): ArchiveDatasetStats {
  const years = getAvailableArchiveYears();
  return {
    totalEntries: ARCHIVE_ENTRIES.length,
    totalCategories: CATEGORIES.length,
    totalMilestones: TIMELINE_MILESTONES.length,
    yearSpan: [years[0] ?? 1990, years[years.length - 1] ?? 1999],
    coveredYearsCount: years.length,
    paletteHexCount: ALLOWED_MONOCHROME_HEXES.length,
  };
}

export function queryArchiveEntries(
  rawFilter?: ArchiveQueryFilter
): readonly ArchiveEntry[] {
  const filter = ArchiveQueryFilterSchema.parse(rawFilter ?? {});
  const normalizedTag = filter.tag?.trim().toLowerCase() ?? "";
  const normalizedQuery = filter.query?.trim().toLowerCase() ?? "";
  const tokens = normalizedQuery
    ? normalizedQuery.split(/\s+/).filter((token) => token.length > 0)
    : [];

  const filtered = ARCHIVE_ENTRIES.filter((entry) => {
    if (filter.year && filter.year !== "all" && entry.year !== filter.year) {
      return false;
    }
    if (
      filter.category &&
      filter.category !== "all" &&
      entry.category !== filter.category
    ) {
      return false;
    }
    if (filter.type && filter.type !== "all" && entry.type !== filter.type) {
      return false;
    }
    if (
      normalizedTag &&
      !entry.tags.some((tag) => tag.toLowerCase().includes(normalizedTag))
    ) {
      return false;
    }
    return true;
  });

  if (tokens.length > 0) {
    const scored = filtered
      .map((entry) => ({
        entry,
        score: scoreEntryForTokens(entry, tokens),
      }))
      .filter((item) => item.score > 0);

    if (filter.sort) {
      return scored
        .map((item) => item.entry)
        .sort((a, b) => compareEntriesBySort(a, b, filter.sort!));
    }

    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.entry.serialNumber.localeCompare(b.entry.serialNumber)
      )
      .map((item) => item.entry);
  }

  const effectiveSort: ArchiveSortOption = filter.sort ?? "chronological-asc";
  return [...filtered].sort((a, b) => compareEntriesBySort(a, b, effectiveSort));
}

export function getRelatedDossiers(
  slug: string,
  limit = 3
): readonly ArchiveEntry[] {
  if (limit <= 0) {
    return [];
  }

  const target = getEntryBySlug(slug);
  if (!target) {
    return [];
  }

  const selected: ArchiveEntry[] = [];
  const seen = new Set<string>([target.slug]);

  for (const relatedSlug of target.relatedSlugs) {
    const candidate = getEntryBySlug(relatedSlug);
    if (candidate && !seen.has(candidate.slug)) {
      selected.push(candidate);
      seen.add(candidate.slug);
      if (selected.length >= limit) {
        return selected;
      }
    }
  }

  const fallbackCandidates = ARCHIVE_ENTRIES.filter(
    (entry) => !seen.has(entry.slug)
  ).sort((a, b) => {
    const aSameCategory = a.category === target.category ? 0 : 1;
    const bSameCategory = b.category === target.category ? 0 : 1;
    if (aSameCategory !== bSameCategory) {
      return aSameCategory - bSameCategory;
    }
    const aYearDistance = Math.abs(a.year - target.year);
    const bYearDistance = Math.abs(b.year - target.year);
    if (aYearDistance !== bYearDistance) {
      return aYearDistance - bYearDistance;
    }
    return a.serialNumber.localeCompare(b.serialNumber);
  });

  for (const candidate of fallbackCandidates) {
    selected.push(candidate);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function transmitRandomPacket(options?: {
  excludeSlug?: string;
  seed?: number;
}): TransmissionPacket {
  const candidates = options?.excludeSlug
    ? ARCHIVE_ENTRIES.filter((entry) => entry.slug !== options.excludeSlug)
    : ARCHIVE_ENTRIES;
  const pool = candidates.length > 0 ? candidates : ARCHIVE_ENTRIES;

  const index =
    typeof options?.seed === "number" && Number.isFinite(options.seed)
      ? hashSeed(options.seed) % pool.length
      : Math.floor(Math.random() * pool.length);

  const entry = pool[index]!;
  const category = CATEGORY_BY_SLUG.get(entry.category) ?? CATEGORIES[0]!;
  const related = getRelatedDossiers(entry.slug, 3);

  return {
    packetId: `PKT-${entry.year}-${entry.serialNumber}`,
    transmissionHeader: `NINETY9 // TELEMETRY PACKET [${category.label}]`,
    baudLabel: getBaudLabelForYear(entry.year),
    entry,
    category,
    related,
  };
}
