import { ArchiveEntrySchema, type ArchiveEntry } from "../lib/archive/types.js";
import { ENTRIES_PART_1 } from "./entries-part1.js";
import { ENTRIES_PART_2 } from "./entries-part2.js";
import { ENTRIES_PART_3 } from "./entries-part3.js";

const UNVALIDATED_ENTRIES: readonly ArchiveEntry[] = [
  ...ENTRIES_PART_1,
  ...ENTRIES_PART_2,
  ...ENTRIES_PART_3,
];

/**
 * Validated, deterministically ordered repository of 34 curated 1990-1999 dossiers.
 */
export const ARCHIVE_ENTRIES: readonly ArchiveEntry[] = [...UNVALIDATED_ENTRIES]
  .sort((a, b) => a.year - b.year || a.serialNumber.localeCompare(b.serialNumber))
  .map((entry) => ArchiveEntrySchema.parse(entry));
