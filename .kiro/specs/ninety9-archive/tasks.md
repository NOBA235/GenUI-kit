# Implementation Plan: NINETY9 Archive (`packages/templates/src/ninety9-archive`)

## Milestone 1: Kiro Spec, Conditional Steering, Zod API, Complete Dataset & Monochrome SVG Generator (Executed Now)
- [x] Create conditional steering `.kiro/steering/ninety9-monochrome-rules.md` (`inclusion: fileMatch` matching `packages/templates/src/ninety9-archive/**`).
- [x] Create Kiro spec suite `.kiro/specs/ninety9-archive/` (`requirements.md` in EARS format, `design.md`, `tasks.md`).
- [x] Build Zod schemas & monochrome palette tokens in `packages/templates/src/ninety9-archive/lib/archive/types.ts`.
- [x] Author complete historically accurate dataset:
  - [x] 12 numbered Categories (`01 — MUSIC` through `12 — POP CULTURE`) in `content/categories.ts`.
  - [x] 34 complete Archive Entries covering every year `1990–1999` (multi-section editorial prose, 4-cell specs, pull quotes, impact, legacy, citations) in `content/entries.ts`.
  - [x] Chronological Timeline Milestones spanning `1990–1999` in `content/timeline-events.ts`.
- [x] Build decoupled search, multi-facet filter, related resolver, and random packet transmitter in `packages/templates/src/ninety9-archive/lib/archive/api.ts`.
- [x] Create & run `scripts/generate-ninety9-assets.ts` generating bespoke 5-tone monochrome technical SVGs for all 34 entries + 12 categories inside `public/images/ninety9/`.
- [x] Add Milestone 1 Vitest verification suite `packages/templates/src/__tests__/ninety9-archive.m1.test.ts` and verify zero TypeScript errors across the monorepo.

## Milestone 2: Monochrome Workstation UI, Scoped CSS, CRT Mode & Studio Hub Sub-Routing
- [x] Build scoped `[data-template-theme="ninety9-archive"]` stylesheet (`theme.css`), `manifest.json`, Paper-White CRT overlay (`SUBTLE` / `ACTIVE` / `OFF`), NeXT/Macintosh navigation chrome, all sub-views (`home`, `archive`, `timeline`, `categories`, `about`, `dossier`, `random-transmit`; `arcade` followed in Milestone 3), and collapsed monochrome corner HUD.

## Milestone 3: `@genui-studio/core` Catalog, Live Monochrome Remixes, PBT Suite & Export
- [x] Wire full Zod `catalog.ts`, `bundle.generated.ts`, Marketplace listing, `fast-check` PBT suite (`ninety9.pbt.test.ts`), and standalone `.zip` bundling.
- [x] Fetch & attribute 52 open-source Wikimedia Commons / Public Domain 1990s photographs (`scripts/fetch-ninety9-photos.mjs`, `content/photos.ts`, `ArchivalMediaPlate.tsx`) with monochrome print treatment, SVG fallback, and binary `.zip` export support.
- [x] Build `[05] ARCADE` (`NINETY9 ARCADE`) interactive workstation module (`arcade/serpent98.ts`, `arcade/breakGrid.ts`, `arcade/packetInvaders.ts`, `arcade/sound.ts`, `components/ArcadeView.tsx`) with pure Web Audio 8-bit SFX, `localStorage` high-score & badge persistence, `/arcade` Next.js `.zip` route parity, `ArcadeCabinetSection` Zod remixing, and `fast-check` PBT verification (`PBT-05`).
- [x] Add 1990s COBOL Boot Login Terminal gate (`CobolBootTerminal.tsx` green/red phosphor CRT terminal + blinking CRT background + cursor, `validateOperatorName` / `lockWorkstation` in `store.ts`, full site lock until login, `PBT-06`) and complete `@container n99-workstation` container-query responsive overhaul across all 6 views, mobile collapsible nav, Studio Hub Tablet (`768px`) & Mobile (`390px`) viewport stages, fluid `clamp()` typography, and touch-safe controls.
