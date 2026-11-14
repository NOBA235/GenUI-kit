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

## Milestone 2: Clue Investigation, Lore Discovery & Supernatural Encounters (Next)
- [ ] Interactive proximity inspection & floating 3D clue monograms on `ClueMonumentNode` landmarks.
- [ ] Supernatural entity silhouette stalking & spatial sanity audio escalations on `SupernaturalEncounterTrigger`.
- [ ] Collectible archive persistence feeding live into `EncounterArchiveGrid` and `InteractiveLoreTimeline`.

## Milestone 3: Underground Crypt Descent, Physical Light Mode Switch & Restored Illuminated Website (Final)
- [ ] Multi-room underground crypt stairway & catacomb collision zone beneath `crypt_entrance`.
- [ ] Physical 3D Chapel Breaker Switch interaction (`PhysicalLightModeSwitch`) dissolving exponential darkness into dawn sunlight.
- [ ] Full editorial typography transformation (`lightModeRestored === true`) revealing the complete illuminated `@genui-studio/core` editorial portfolio website.
