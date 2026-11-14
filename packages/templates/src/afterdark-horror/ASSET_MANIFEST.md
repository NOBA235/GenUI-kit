# AFTERDARK 2.0 — Procedural 3D, Audio & Editorial Asset Manifest

Zero external binary fetches (`0` `.glb` / `.mp3` / `.png` HTTP dependencies). Every geometry, plaque surface texture, soundscape voice, and restored editorial layout is deterministically synthesized at runtime inside Three.js, Canvas2D, and Web Audio API.

## 1. Procedural Three.js BufferGeometries (`engine/procedural-geometries.ts`)
- `lancetTombstone`: Merged gothic pointed-arch slab (`120` max instanced instances across Zone B).
- `obeliskTombstone`: Stepped plinth + tapered spire (`InstancedMesh` variant).
- `celticCross`: Chamfered shaft, ring halo, and cross-bar silhouette (`celticCrossCount`: `10`/`18`/`24`).
- `gnarledTree`: Organic twisted multi-fork dead cemetery timber (`52` max instanced instances).
- `fencePicket`: Forged spearhead wrought-iron fence finial (`InstancedMesh` perimeter + swinging double gate).
- `fountainBasin`: Tiered octagonal crumbling stonework centerpiece in Zone C Dead Garden (`(-16, 0, -9)`).
- `apparitionSilhouette`: Multi-segment spectral cloak & veiled head geometry used by `EncounterEntities`.
- `Zone D Gothic Chapel & Zone E Crypt`: Split enterable nave walls, ajar oak doors, 16-step East stairwell (`0.3m -> -4.5m`), sarcophagi, wax candles, and Zone E NW Alcove (`[-4.0, -3.2, -50.22]`) mounting the physical **`LIGHT MODE`** cast-iron breaker cabinet & pivoting lever.

## 2. Procedural Canvas2D Plaque & Surface Textures
- **Breaker Plaque Texture (`createBreakerPlaqueTexture`)**: Synthesized 512x256 brushed bronze plate engraved with `LIGHT MODE · CIRCUIT IV` and riveted corners, explicitly disposed on unmount.

## 3. Procedural Web Audio Synthesis (`audio/soundscape.ts`)
- Continuous wind bed (Pink/White noise buffer + animated BiquadFilter bandpass).
- Subterranean rumble (dual detuned `38 Hz` / `54 Hz` oscillators).
- Surface-aware footsteps (`"gravel"`, `"stone"`, `"wood"` chapel floorboards + random plank creak).
- Directional encounter SFX: Rear Whisper, Gate Creak/Slam, Moving Shadow Rustle, Spatial Weeping (`StereoPannerNode`), Presence Steps, Crypt Intimidation Spike.
- Breaker Cabinet Proximity Hum (`setBreakerHumProximity`: `120 Hz` + `240 Hz` metallic transformer buzz).
- `LIGHT MODE` Sequence: Mechanical Iron Clunk + Transformer Surge (`playBreakerSwitchThrow`) + Dawn Harmonic Reveal (`playDawnRevealChord`).

## 4. Scoped Editorial Styles & GenUI Catalog (`catalog.ts`, `theme.css`)
- Strictly isolated inside `[data-template-theme="afterdark-horror"]` (`#000000` nocturnal obsidian -> `#FAF9F5` restored daylight stone-white).
- 9 Zod-verified catalog blocks wrapped with `@genui-studio/core` `SafeGenUIRenderer` & `fast-check` PBT invariants (`__tests__/afterdark.pbt.test.ts`).
