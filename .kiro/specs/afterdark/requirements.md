# Requirements Document: Flagship Website #1 — AFTERDARK (`packages/templates/src/afterdark-horror`)

## 1. Introduction & Experience Vision
**AFTERDARK** is Flagship Website #1 built inside GenUI Studio's Mode A Dual-Mode Template Registry. Rather than presenting a traditional marketing website with a navbar and hero cards, `/preview/afterdark-horror` turns **"THE WEBSITE ITSELF IS THE GAME"**: launching into pure `#000000` monitor-shutdown blackness, progressing through a suspenseful typographic warning and spatial audio sequence, sweeping the camera through towering wrought-iron cemetery gates as they slam shut behind the player, and opening a navigable 3D haunted cemetery wired to `@genui-studio/core` (`verifiedCatalog`, Zustand state synchronization, RFC 6902 live remixing, and PBT verification).

---

## 2. EARS Functional & Non-Functional Requirements

### Requirement 1: Full-Window Immersion Mode & Studio Hub Isolation
**User Story:** As a visitor opening `/preview/afterdark-horror`, I want complete dark immersion without toolbars or cards breaking the illusion, while developers/judges can still summon the Studio HUD or Debug overlay whenever needed.

#### Acceptance Criteria
1. **WHEN** `/preview/afterdark-horror` loads inside `apps/studio-hub`, **THE SYSTEM SHALL** engage **Immersion Mode** automatically, hiding the standard Studio Hub header and collapsing the Studio HUD to a subtle corner indicator reading `"Press [Alt+G] for GenUI Studio / Export | [?debug=true] for Debug"`.
2. **WHEN** the user presses `Alt+G`, releases Pointer Lock via `ESC` after entering 3D exploration, or triggers Light Mode restoration, **THE SYSTEM SHALL** surface the Studio HUD / recovery controls without trapping the user.
3. **WHILE** previewing `afterdark-horror`, **THE SYSTEM SHALL** scope all custom fonts, scrollbars, focus rings, and theme CSS variables inside `[data-template-theme="afterdark-horror"]`.

---

### Requirement 2: Scene 01 Shutdown Sequence & Scene 02 Gate Entry Transition
**User Story:** As a player arriving on the black screen, I want an atmospheric audio-visual intro that culminates cleanly in entering the 3D cemetery.

#### Acceptance Criteria
1. **WHEN** Scene 01 initializes, **THE SYSTEM SHALL** display a `#000000` pitch-black viewport awaiting interaction (or clicking anywhere / pressing `Enter`) to unlock Web Audio synthesis.
2. **WHEN** interaction begins, **THE SYSTEM SHALL** sequentially reveal timed typography using compositor-only `opacity`/`transform` transitions (`prefers-reduced-motion` aware):
   - `"2:17 AM"`
   - `"Why did you come here?"`
   - `"Something is waiting."` (accompanied by a spatialized rear audio cue behind the listener)
   - `"ENTER THE CEMETERY"` interactive trigger.
3. **WHEN** the user activates `"ENTER THE CEMETERY"`, **THE SYSTEM SHALL** transition into Scene 02, swinging open the wrought-iron gate wings with synthesized iron hinge creak, smoothly dollying the first-person camera through the entrance archway onto the central gravel avenue, closing and locking the gate behind the player (`gateLockedBehind = true`), and engaging `"exploration"` phase.

---

### Requirement 3: Procedural Web Audio Soundscape (Zero External Asset 404s)
**User Story:** As a player exploring in darkness, I want continuous horror ambiance and responsive footsteps without network errors or missing audio files.

#### Acceptance Criteria
1. **WHEN** the soundscape initializes on user gesture, **THE SYSTEM SHALL** synthesize layered wind noise, low-frequency sub-bass rumble, creaking dead timber, distant owl/wolf calls, thunder cracks, and surface-aware footsteps (crisp gravel vs paved chapel stone) solely using the Web Audio API.
2. **IF** Web Audio is unsupported or blocked (e.g., SSR, headless Node test environment, or autoplay restriction), **THEN THE SYSTEM SHALL** degrade cleanly with a silent no-op audio engine and zero uncaught exceptions.
3. **WHEN** `afterdark-horror` unmounts or the user toggles mute, **THE SYSTEM SHALL** close/suspend active audio nodes and clear all scheduled timers cleanly.

---

### Requirement 4: Genuine First-Person Controller & Deterministic Collision Engine
**User Story:** As a player navigating the cemetery in first person, I want responsive desktop mouse/keyboard controls and mobile touch fallbacks, and I must never walk through solid walls or graves.

#### Acceptance Criteria
1. **WHILE** `phase === "exploration"`, **THE SYSTEM SHALL** support `WASD` / Arrow key movement, `SHIFT` sprint, velocity acceleration/damping, head-bob synced to procedural footsteps, and Mouse Pointer Lock pitch/yaw look controls.
2. **WHILE** on touch/coarse-pointer devices (or when touch controls are enabled), **THE SYSTEM SHALL** render a virtual circular thumbstick and swipe-to-look pad fallback with `touch-action: none` strictly scoped to the interactive control surface.
3. **WHEN** the player attempts to move into closed cemetery gates, stone gate pillars, perimeter boundary walls, tombstones, lantern pedestals, or gnarled dead trees, **THE SYSTEM SHALL** resolve collisions via deterministic sliding AABB + circle resolution so the player slides cleanly along obstacles without clipping or leaving perimeter bounds.

---

### Requirement 5: Playable Darkness, Temporary Reveals & 60 FPS Hardware Presets
**User Story:** As an explorer on either integrated laptop graphics or a high-end GPU, I want eerie pitch-dark atmosphere that remains navigable at 60 FPS.

#### Acceptance Criteria
1. **WHILE** exploring the cemetery in darkness, **THE SYSTEM SHALL** illuminate landmarks without making the viewport unplayable using exponential fog, subtle moonlight rim highlights, flickering antique iron lanterns, glowing stained-glass chapel windows in the distance, and periodic seizure-safe lightning flashes (`< 3` flashes/sec, minimum `4.5s` interval).
2. **WHILE** rendering procedural Three.js geometry (wrought-iron gate pickets, tombstones, dead trees, chapel spire, mausoleum), **THE SYSTEM SHALL** share `BufferGeometry`/`Material` instances via `InstancedMesh`, enforce per-preset active dynamic point light caps (`low: 1`, `medium: 2`, `high: 3`), allocate zero new objects inside `useFrame`, and call `.dispose()` on unmount cleanup.

---

### Requirement 6: `@genui-studio/core` Verified Catalog Integration & Debug Overlay
**User Story:** As a developer or judge inspecting the template architecture, I want all horror director nodes and restored editorial sections registered cleanly in a Zod-validated catalog with live `?debug=true` diagnostics.

#### Acceptance Criteria
1. **WHEN** `verifiedCatalog` in `packages/templates/src/afterdark-horror/catalog.ts` is evaluated, **THE SYSTEM SHALL** define strict Zod object schemas and non-empty descriptions for:
   - World & Horror Director Nodes: `DarknessAndWeatherController`, `CemeteryZoneCluster`, `ClueMonumentNode`, `SupernaturalEncounterTrigger`, `PhysicalLightModeSwitch`
   - Restored Editorial Sections: `RestoredEditorialHero`, `EncounterArchiveGrid`, `InteractiveLoreTimeline`, `ExperienceReplayFooter`
2. **WHEN** `?debug=true` is active in the URL or toggled in UI, **THE SYSTEM SHALL** display a live Debug Overlay reporting `FPS`, player `(x, y, z)` coordinates, yaw/pitch, current zone name, collision wireframe visibility toggle, environmental light override toggle, lightning test trigger, quality preset selector, and instant zone teleport buttons.

---

### Requirement 7: Milestone 2 & Milestone 3 Roadmap Boundary (Deferred Beyond M1)
1. **NOTE:** Deep clue reading interactions, dynamic entity stalking/encounter events (Milestone 2), underground crypt descent, physical chapel circuit-breaker lever puzzle, and the full Light Mode transition into the Restored Illuminated Editorial Website (Milestone 3) are registered in the catalog schema cleanly now and scheduled for subsequent milestones after Milestone 1 verification completes.
