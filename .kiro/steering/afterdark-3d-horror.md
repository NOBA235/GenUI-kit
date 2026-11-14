---
inclusion: fileMatch
fileMatchPattern: "packages/templates/src/afterdark-horror/**"
---

# AFTERDARK 3D Horror & Dual-Mode Experience Steering (`afterdark-3d-horror.md`)

This conditional steering file applies strictly to Flagship Website #1 (`packages/templates/src/afterdark-horror/**`). It operates alongside—and never overrides—the root monorepo invariants in `.kiro/steering/genui-invariants.md` and `.kiro/steering/spatial-3d-rules.md`.

---

## 1. Full-Window Pitch-Black Immersion Rules
1. **No Chrome on Entry:**
   - `/preview/afterdark-horror` MUST enter directly in `#000000` full-window Immersion Mode ("THE WEBSITE ITSELF IS THE GAME") with no visible marketing navbar, hero card, or SaaS panels until Light Mode is physically restored in the world or the developer opens the Studio HUD via `[Alt+G]` / Pointer Lock release (`ESC`).
2. **Scoped Theme Isolation:**
   - All custom fonts, scrollbars, focus outlines, and dark/restored light tokens MUST stay strictly inside `[data-template-theme="afterdark-horror"]`.
3. **Never Trap Pointer Lock or Keyboard Focus:**
   - Pressing `ESC` releases Pointer Lock and immediately surfaces minimal non-intrusive Studio recovery controls; pressing `[Alt+G]` toggles the Studio HUD overlay without destroying 3D player state.

---

## 2. Procedural 3D Architecture & Locked 60 FPS WebGL Budget
1. **Zero 2D Fakes:**
   - All cemetery landmarks (wrought-iron gates, stone gate pillars, boundary walls, tombstones, gnarled dead trees, antique lanterns, gothic chapel, mausoleum) MUST be genuine 3D procedural Three.js / `@react-three/fiber` geometry—NEVER flat SVG trees, layered 2D PNGs, or CSS 3D transforms.
2. **Instancing & Disposal:**
   - Repeated geometry (tombstones, iron pickets, dead trees, perimeter fence posts) MUST use `THREE.InstancedMesh` sharing pre-built `BufferGeometry` and `Material` instances.
   - Every imperatively created `BufferGeometry` and `Material` MUST call `.dispose()` on unmount cleanup.
   - `useFrame` callbacks MUST allocate zero new objects (`THREE.Vector3`, `THREE.Matrix4`, `THREE.Euler`, `THREE.Color`); mutate pre-allocated ref/module scratch objects exclusively.
3. **Hardware Quality Presets (`low | medium | high`):**
   - `low`: max `1` dynamic point light, reduced instance counts (`48` tombstones, `20` trees), DPR `[1, 1]`.
   - `medium` (default): max `2` dynamic point lights, balanced instances (`84` tombstones, `36` trees), DPR `[1, 1.5]`.
   - `high`: max `3` dynamic point lights, rich instances (`120` tombstones, `52` trees), DPR `[1, 2]`.
4. **Pause & Fallback:**
   - Pause frame progression when `document.hidden` is true, and catch `webglcontextlost` gracefully without throwing unhandled exceptions.

---

## 3. Deterministic Collision, Playable Darkness & Audio Fallbacks
1. **Zero Tunneling Collision:**
   - All horizontal movement MUST pass through the pure TypeScript `resolvePlayerMovement()` AABB + circle push-out sliding solver before updating `camera.position`. Players must never clip through walls, pillars, trees, tombstones, closed gates, or exit perimeter bounds.
2. **Playable Contrast + Seizure-Safe Lightning:**
   - Pure darkness must still afford environmental navigation via cool moonlight rim-light, distant glowing chapel stained glass, flickering amber path lanterns, and temporary lightning reveals.
   - Lightning reveals MUST obey WCAG 2.3.1 flash-frequency safety (< 3 flashes/sec: minimum 4.5s cooldown between pulses and smooth exponential decay, honoring `prefers-reduced-motion`).
3. **100% Procedural Web Audio Synthesis:**
   - All wind, sub-bass rumble, creaking wood/iron, owl/wolf distant cues, thunder, and gravel/stone footsteps MUST be synthesized via Web Audio API nodes—zero external `.mp3`/`.wav` HTTP requests that could 404 or stall offline demos.
   - All audio calls MUST gracefully no-op in headless/SSR or suspended `AudioContext` environments until user gesture unlocks playback.
