# Requirements Document: NINETY9 Archive (`packages/templates/src/ninety9-archive`)

## 1. Introduction & Editorial Vision
**NINETY9** is Flagship Website #2 inside GenUI Studio's Mode A Dual-Mode Template Registry: a museum-grade digital archive of 1990–1999 culture styled like a 1997 NeXTstation / Platinum-era Macintosh technical monograph printed on high-contrast paper-white stock. Every pixel obeys a strict 5-tone monochrome palette (`#FFFFFF`, `#000000`, `#D9D9D9`, `#808080`, `#292929`), zero border radii, hard brutalist `#000000` offset shadows, and clean desktop-workstation layout geometry.

---

## 2. EARS Functional & Non-Functional Requirements

### Requirement 1: Strict 5-Tone Monochrome Palette & Scoped Isolation
**User Story:** As a visitor opening `/preview/ninety9-archive`, I want an authentic monochrome editorial workstation aesthetic that never leaks styles into or inherits chromatic colors from GenUI Studio Hub.

#### Acceptance Criteria
1. **WHILE** rendering any `ninety9-archive` surface, stylesheet, or SVG illustration, **THE SYSTEM SHALL** restrict all colors strictly to `#FFFFFF`, `#000000`, `#D9D9D9`, `#808080`, and `#292929`.
2. **WHILE** rendering buttons, cards, badges, inputs, and dialogs inside `[data-template-theme="ninety9-archive"]`, **THE SYSTEM SHALL** enforce `0px` border radius and crisp `1px` or `2px` solid `#000000` rules paired with solid `#000000` offset shadows (`2px 2px 0` / `4px 4px 0`).
3. **WHEN** previewing inside Studio Hub, **THE SYSTEM SHALL** avoid modifying root `src/app/`, `globals.css`, or unrelated packages, and collapse Studio chrome into a monochrome corner indicator (`[ALT+G] GENUI STUDIO // EXPORT ARCHIVE`).

---

### Requirement 2: Curated 1990–1999 Historical Dataset & Zod Schema Enforcement
**User Story:** As an editorial reader or researcher browsing the archive, I want deeply researched, historically accurate dossiers across all 12 cultural verticals and every year from 1990 to 1999 without placeholder text.

#### Acceptance Criteria
1. **WHEN** `CATEGORIES` in `content/categories.ts` is validated against `CategoryManifestSchema`, **THE SYSTEM SHALL** provide all 12 numbered categories (`01 — MUSIC` through `12 — POP CULTURE`), each with a unique tagline, deep historical essay (>= 200 chars), decade shift note, and technical SVG path.
2. **WHEN** `ARCHIVE_ENTRIES` in `content/entries.ts` is validated against `ArchiveEntrySchema`, **THE SYSTEM SHALL** provide at least 33 complete entries covering every single year from `1990` to `1999` inclusive, each containing multi-section editorial copy (`01 // ...`, `02 // ...`), a 4-cell technical specification grid, pull quote with attribution, `culturalImpact`, `historicalLegacy`, >= 2 verified citations, and related dossier slugs.
3. **WHEN** `TIMELINE_MILESTONES` in `content/timeline-events.ts` is validated against `TimelineMilestoneSchema`, **THE SYSTEM SHALL** provide chronological milestones covering every year `1990–1999` cross-linked cleanly to archive dossiers.

---

### Requirement 3: Decoupled In-Memory Query, Fuzzy Search & Random Packet API
**User Story:** As an engineer or UI component querying the archive, I want deterministic, type-safe functions for filtering, searching, resolving related dossiers, and transmitting random archival packets.

#### Acceptance Criteria
1. **WHEN** `queryArchiveEntries(filter)` is invoked with any combination of `query`, `year`, `category`, `type`, `tag`, and `sort`, **THE SYSTEM SHALL** return validated entries matching all active facets sorted deterministically in memory with zero network dependencies.
2. **WHEN** `getRelatedDossiers(slug, limit)` is called for any valid entry slug, **THE SYSTEM SHALL** resolve distinct related `ArchiveEntry` records without returning self-references.
3. **WHEN** `transmitRandomPacket(options)` is called, **THE SYSTEM SHALL** select an entry (excluding `excludeSlug` when specified and reproducible when a numeric `seed` is passed) wrapped in a formatted workstation transmission packet.

---

### Requirement 4: Automated Monochrome SVG Illustration Generator
**User Story:** As a maintainer of NINETY9 Archive, I want a reproducible Node.js generator that renders bespoke monochrome technical SVG illustrations for every entry and category cleanly into `public/images/ninety9/`.

#### Acceptance Criteria
1. **WHEN** `node scripts/generate-ninety9-assets.ts` executes, **THE SYSTEM SHALL** read directly from `CATEGORIES` and `ARCHIVE_ENTRIES` and output valid `.svg` files for every entry (`public/images/ninety9/entries/<slug>.svg`) and category (`public/images/ninety9/categories/<slug>.svg`).
2. **WHEN** each SVG file is written, **THE SYSTEM SHALL** verify every hex color present in the SVG output belongs strictly to the 5-tone monochrome allowlist (`#FFFFFF`, `#000000`, `#D9D9D9`, `#808080`, `#292929`) and embed halftone dot-matrix patterns, schematic geometry matching the item's `illustrationMotif`, and archival serial stamps.

---

### Requirement 5: Paper-White CRT Scanline System & Single-Server Sub-Navigation (Milestone 2 Scope)
1. **NOTE:** Milestone 2 will implement `catalog.ts`, `theme.css`, `manifest.json`, Paper-White CRT scanline mode persistence (`SUBTLE` / `ACTIVE` / `OFF`), single-server sub-navigation (`Archive`, `Categories`, `Timeline`, `Dossiers`, `About`, `Random Transmit`), and brutalist NeXT/Macintosh workstation UI components after Milestone 1 datasets, schemas, APIs, and SVG assets pass full verification.
