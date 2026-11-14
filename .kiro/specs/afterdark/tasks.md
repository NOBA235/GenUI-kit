# Implementation Plan: AFTERDARK (`packages/templates/src/afterdark-horror`)

## Milestone 1: Kiro Spec + Phases 1 & 2 (Executed Now)
- [x] Create scoped steering `.kiro/steering/afterdark-3d-horror.md` (`inclusion: fileMatch`) without touching root steering files.
- [x] Author `.kiro/specs/afterdark/` (`requirements.md`, `design.md`, `tasks.md`).
- [x] Add `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `zustand` offline to `@genui-studio/templates` and `@genui-studio/studio-hub`.
- [x] Extend Studio Hub (`PreviewPage.tsx` & `StudioHud.tsx`) with **Immersion Mode**:
  - Auto-engage on `manifest.immersiveExperience === true` (`/preview/afterdark-horror`).
  - Collapse header into corner indicator (`Press [Alt+G] for GenUI Studio / Export | [?debug=true] for Debug`).
  - Support `[Alt+G]` toggle, `ESC` Pointer Lock release detection, and Light Mode restoration HUD reveal without trapping user focus.
- [x] Build `packages/templates/src/afterdark-horror/`:
  - [x] `manifest.json`, `theme.css`, `steering.md`, `types.ts`, `store.ts`.
  - [x] Procedural Web Audio synthesis engine (`audio/soundscape.ts`) with SSR/autoplay-safe fallback.
  - [x] Deterministic 3D AABB & Circle/Sphere sliding collision solver (`engine/collision.ts`).
  - [x] Procedural 3D cemetery/gate/chapel/tree/tombstone `BufferGeometry` & `InstancedMesh` builders (`engine/procedural-geometries.ts`) with hardware `low|medium|high` budgets & explicit disposal.
  - [x] First-person controller (`components/FirstPersonController.tsx`) + 3D Cemetery World (`components/CemeteryWorld.tsx`) + Scene 01/02/Debug Overlays (`components/SceneOverlays.tsx`).
  - [x] Full Zod catalog (`catalog.ts`) registering all 5 Director/World nodes + 4 Restored Editorial sections + `buildRemixJsonl` live atmosphere remixing.
- [x] Verify Milestone 1 with dedicated Vitest tests (`afterdark-horror.test.ts`), `pnpm sync:templates`, `pnpm build`, `pnpm typecheck`, `pnpm test` across all monorepo projects, Kiro audit scripts, and commit/push Milestone 1.

## Milestone 2: 5 Interconnected Zones, [E] 3-Clue Mystery & 5 Supernatural Encounters (Executed Now)
- [x] Phase 3 — 5 Interconnected 3D Cemetery Zones (A–E) with layered vertical collision (`resolvePlayerMovement` vertical `minY/maxY` separation) and floorboard/stair topology (`getWalkableFloorHeight`):
  - [x] Zone A (`gatehouse`): Wrought-iron gates, stone pillars, lanterns, gnarled dead trees.
  - [x] Zone B (`forgotten_graves`): Instanced lancets, obelisks, and Celtic crosses (`createCelticCrossGeometry`) + weathered Clue 01 gravestone monument.
  - [x] Zone C (`dead_garden`): Crumbling stone fountain centerpiece (`createFountainBasinGeometry`), stone benches, weeping statues, thick low-lying fog, and concealed northern pathway to Clue 03 Caretaker's lectern.
  - [x] Zone D (`chapel_steps`): Enterable Abandoned Gothic Chapel with split front doorway, ajar oak doors, stained-glass windows, timber nave floorboards (`surface = "wood"`), pews, Clue 02 altar, and 16-step East sanctuary stairwell descending from `y = 0.3m` to `y = -4.5m`.
  - [x] Zone E (`crypt_entrance`): Subterranean stone-walled T-corridor beneath Chapel (`y = -4.5m`), stone sarcophagi, flickering candles, dormant NW Breaker Switch alcove `[-4.0, -3.2, -50.22]`.
- [x] Phase 4 — Raycasted `[E]` Interaction Engine (`evaluateInteractableFocus`, `FirstPersonController`, `SceneOverlays`) and persistent 3-Clue chain (`localStorage` `afterdark-archive-progress-v2`, zero tacky HUD quest checklists).
- [x] Phase 5 — Stateful Cooldown-Governed `EncounterEntities` + `EncounterManager` (`enc-01` The Watcher with dot-product gaze vanish, `enc-02` The Moving Shadow, `enc-03` The Weeping Woman ember guide trail, `enc-04` The Presence rear ambush whisper, `enc-05` The Final Warning crypt intimidation flicker `< 2.5 Hz`) + `?debug=true` Teleports A–E, Clue 1–3 reveals, and Encounter 1–5 triggers.
- [x] Verify Milestone 2 with `afterdark-horror.test.ts` + `studio-hub.test.tsx`, `pnpm sync:templates`, full workspace build/typecheck/test & Kiro PBT/catalog audits.

## Milestone 3: Physical Light Mode Breaker Switch & Restored Illuminated Website (Final)
- [ ] Physical 3D Zone E Crypt Breaker Switch interaction (`PhysicalLightModeSwitch` `[E]` hold/pull) dissolving exponential darkness into dawn sunlight.
- [ ] Full editorial typography transformation (`lightModeRestored === true`) revealing the complete illuminated `@genui-studio/core` editorial documentary showcase fed by live discovered clues & encounters.
