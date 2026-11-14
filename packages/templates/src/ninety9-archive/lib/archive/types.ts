import { z } from "zod";

/** Strict 5-Tone Monochrome System Palette (ZERO color exceptions permitted) */
export const MONOCHROME_PALETTE = {
  pureWhite: "#FFFFFF",
  pureBlack: "#000000",
  lightGray: "#D9D9D9",
  mediumGray: "#808080",
  darkGray: "#292929",
} as const;

export const ALLOWED_MONOCHROME_HEXES = [
  MONOCHROME_PALETTE.pureWhite,
  MONOCHROME_PALETTE.pureBlack,
  MONOCHROME_PALETTE.lightGray,
  MONOCHROME_PALETTE.mediumGray,
  MONOCHROME_PALETTE.darkGray,
] as const;

export const CRTModeSchema = z.enum(["SUBTLE", "ACTIVE", "OFF"]);
export type CRTMode = z.infer<typeof CRTModeSchema>;

export const ArchiveSubViewSchema = z.enum([
  "archive",
  "categories",
  "timeline",
  "dossier",
  "about",
  "random-transmit",
]);
export type ArchiveSubView = z.infer<typeof ArchiveSubViewSchema>;

export const CategoryNumberSchema = z.enum([
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
export type CategoryNumber = z.infer<typeof CategoryNumberSchema>;

export const CategorySlugSchema = z.enum([
  "music",
  "cinema",
  "television",
  "animation",
  "gaming",
  "hardware",
  "fashion",
  "web-1-0",
  "youth-culture",
  "toys-collectibles",
  "sports",
  "pop-culture",
]);
export type CategorySlug = z.infer<typeof CategorySlugSchema>;

export const ArchiveEntryTypeSchema = z.enum([
  "ALBUM",
  "FESTIVAL",
  "FILM",
  "SERIES",
  "ANIME SERIES",
  "CONSOLE",
  "HANDHELD",
  "PC SOFTWARE",
  "OS RELEASE",
  "PORTABLE AUDIO",
  "PDA HARDWARE",
  "WORKSTATION",
  "FASHION MOVEMENT",
  "STREETWEAR LABEL",
  "WEB BROWSER",
  "WEB PLATFORM",
  "SUBCULTURE",
  "PRINT MEDIA",
  "COLLECTIBLE",
  "VIRTUAL PET",
  "ATHLETIC EVENT",
  "FORMAT STANDARD",
  "GLOBAL INCIDENT",
]);
export type ArchiveEntryType = z.infer<typeof ArchiveEntryTypeSchema>;

export const MotifKindSchema = z.enum([
  "optical-disc",
  "cinema-frame",
  "crt-oscilloscope",
  "cel-grid",
  "controller-pcb",
  "workstation-mac",
  "silicon-chip",
  "browser-window",
  "runway-monolith",
  "rave-speaker",
  "toy-lcd",
  "arena-court",
  "network-topology",
]);
export type MotifKind = z.infer<typeof MotifKindSchema>;

export const TechSpecCellSchema = z.object({
  label: z.string().min(2).max(40),
  value: z.string().min(1).max(110),
});
export type TechSpecCell = z.infer<typeof TechSpecCellSchema>;

export const EditorialSectionSchema = z.object({
  index: z.string().regex(/^0[1-9] \/\/ [A-Z0-9 &/'\-+.]+$/),
  heading: z.string().min(3).max(90),
  body: z.string().min(100),
});
export type EditorialSection = z.infer<typeof EditorialSectionSchema>;

export const CitationRecordSchema = z.object({
  source: z.string().min(3).max(140),
  detail: z.string().min(4).max(200),
  year: z.string().regex(/^(19[89]\d|20[0-2]\d)$/),
});
export type CitationRecord = z.infer<typeof CitationRecordSchema>;

export const PullQuoteSchema = z.object({
  quote: z.string().min(18).max(320),
  attribution: z.string().min(3).max(110),
});
export type PullQuote = z.infer<typeof PullQuoteSchema>;

export const ArchiveEntrySchema = z.object({
  id: z.string().regex(/^N99-(199\d)-\d{3}$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  serialNumber: z.string().regex(/^ARC-\d{2}-\d{3}$/),
  title: z.string().min(2).max(90),
  subtitle: z.string().min(8).max(180),
  year: z.number().int().min(1990).max(1999),
  monthLabel: z.string().min(4).max(24),
  category: CategorySlugSchema,
  categoryCode: CategoryNumberSchema,
  type: ArchiveEntryTypeSchema,
  origin: z.string().min(2).max(80),
  creatorOrPublisher: z.string().min(2).max(110),
  summary: z.string().min(60).max(360),
  specs: z.array(TechSpecCellSchema).length(4),
  sections: z.array(EditorialSectionSchema).min(2).max(4),
  pullQuote: PullQuoteSchema,
  culturalImpact: z.string().min(90),
  historicalLegacy: z.string().min(90),
  citations: z.array(CitationRecordSchema).min(2),
  tags: z.array(z.string().min(2).max(40)).min(2).max(6),
  relatedSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(2).max(4),
  illustrationPath: z
    .string()
    .regex(/^\/images\/ninety9\/entries\/[a-z0-9-]+\.svg$/),
  illustrationMotif: MotifKindSchema,
});
export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;

export const CategoryManifestSchema = z.object({
  code: CategoryNumberSchema,
  slug: CategorySlugSchema,
  label: z.string().regex(/^(0[1-9]|1[0-2]) — [A-Z0-9 &.]+$/),
  shortLabel: z.string().min(2).max(32),
  tagline: z.string().min(12).max(160),
  essay: z.string().min(220),
  decadeShiftNote: z.string().min(70).max(420),
  keyYears: z.array(z.number().int().min(1990).max(1999)).min(1),
  illustrationPath: z
    .string()
    .regex(/^\/images\/ninety9\/categories\/[a-z0-9-]+\.svg$/),
  illustrationMotif: MotifKindSchema,
});
export type CategoryManifest = z.infer<typeof CategoryManifestSchema>;

export const TimelineMilestoneSchema = z.object({
  id: z.string().regex(/^TL-199\d-\d{2}$/),
  year: z.number().int().min(1990).max(1999),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  dateLabel: z.string().min(4).max(28),
  headline: z.string().min(6).max(110),
  category: CategorySlugSchema,
  significance: z.string().min(50).max(360),
  linkedEntrySlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});
export type TimelineMilestone = z.infer<typeof TimelineMilestoneSchema>;

export const ArchiveSortOptionSchema = z.enum([
  "chronological-asc",
  "chronological-desc",
  "title-asc",
  "serial-asc",
]);
export type ArchiveSortOption = z.infer<typeof ArchiveSortOptionSchema>;

export const ArchiveQueryFilterSchema = z.object({
  query: z.string().max(120).optional(),
  year: z
    .union([z.literal("all"), z.number().int().min(1990).max(1999)])
    .optional(),
  category: z.union([z.literal("all"), CategorySlugSchema]).optional(),
  type: z.union([z.literal("all"), ArchiveEntryTypeSchema]).optional(),
  tag: z.string().max(48).optional(),
  sort: ArchiveSortOptionSchema.optional(),
});
export type ArchiveQueryFilter = z.infer<typeof ArchiveQueryFilterSchema>;

export interface TransmissionPacket {
  readonly packetId: string;
  readonly transmissionHeader: string;
  readonly baudLabel: string;
  readonly entry: ArchiveEntry;
  readonly category: CategoryManifest;
  readonly related: readonly ArchiveEntry[];
}

export interface CategoryWithEntries {
  readonly category: CategoryManifest;
  readonly entries: readonly ArchiveEntry[];
}

export interface ArchiveDatasetStats {
  readonly totalEntries: number;
  readonly totalCategories: number;
  readonly totalMilestones: number;
  readonly yearSpan: readonly [number, number];
  readonly coveredYearsCount: number;
  readonly paletteHexCount: number;
}
