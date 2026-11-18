# Implementation Plan: BIOS // NECROMANCER (`packages/templates/src/cmos-cloud-bios`)

## Core engine: spec, cloud-to-CMOS state, IaC compiler, audio
- [x] 1. Scoped steering `.kiro/steering/cmos-bios-rules.md` (`inclusion: fileMatch`) and this spec (`requirements.md`, `design.md`, `tasks.md`).
- [x] 2. `lib/cmos/engine.ts`
  - [x] Register tables and strict Zod `CmosConfigSchema` with cross-field refinement. _Req 4_
  - [x] `SETUP_DEFAULTS` / `BIOS_DEFAULTS` (both pass POST), `canonicalJson`, FNV-1a `cmosChecksum`. _Req 7.5_
  - [x] IRQ PnP resolver with IDE channel reservations and conflict counting. _Req 5.3_
  - [x] `deriveCloudTopology` register → cloud mapping. _Req 5.1_
  - [x] `simulateCmos`: cost, P99, max RPS, bottleneck, thermal, power, stability, POST, beep codes, alarms. _Req 6_
  - [x] `applyCloudPatch` inverse mapping with rounding adjustments. _Req 5.2_
  - [x] `cmosReducer` state machine, CMOS battery persistence with checksum validation, `createCmosStore`. _Req 7_
- [x] 3. `lib/cmos/emitters.ts` deterministic YAML/HCL emitters with Compose `$$` and HCL `${`/`%{` escaping.
- [x] 4. `lib/cmos/compiler.ts`: `compileCmos` → `docker-compose.yml`, `vercel.json`, `main.tf`, deployment notes, FSK manifest. _Req 8–10_
- [x] 5. `lib/cmos/audio.ts`: PC speaker, Award beep codes, key ticks, dual-tone alarm, FSK transmitter, shared analyser. _Req 11–12_
- [x] 6. Verification:
  - [x] Typecheck clean for `cmos-cloud-bios`.
  - [x] Four contrasting configs compile byte-identically twice.
  - [x] Compose files parse in PyYAML, `vercel.json` parses, HCL braces balance.
  - [x] FSK manifest round-trips through a Goertzel demodulator (CRC valid) at 300/600 baud.

## Interactive experience: UI, 3D twin, catalog, tests, marketplace
- [x] 7. `PostBootSequence`: Energy Star emblem, RAM count-up, IDE detection from live registers, DEL/Enter/click/SPACE, Award beep code. _Req 13_
- [x] 8. `AwardBiosMenuGrid`: 6 menus (`components/bios-menus.ts`), keyboard (Arrows, Enter, Esc, +/-, PgUp/PgDn, F1, F5, F6, F7, F10, Y/N) and mouse, option listbox, Y/N dialogs, status line, help. _Req 2, 3, 14_
- [x] 9. `Motherboard3DTwin` + `MotherboardScene`: instanced capacitors, chokes, heatsink fins, DIMM chips and traces; fan speed from clock and fan RPM; heatsink tint from temperature; NVMe LED; PCIe cards per slot; CMOS battery; camera follows menu focus and hover; client-only canvas with WebGL and context-loss fallbacks. _Req 14_
- [x] 10. `CmosWorkstationShell`: CMOS SETUP vs HARDWARE LANDING PAGE switch, grid layout via `data-cmos-area`, audio unlock, alarm driver, speaker toggle; `DevToolsHeroSection` for landing mode. _Req 15_
- [x] 11. `manifest.json` (MIT, free), `theme.css`, `catalog.ts` (9 components with strict props), registry, `index.ts`, presets `overclock` / `undervolt`, and the corrupted register packet handled by `CmosRegisterPacket` with fail-safe recovery. _Req 16.1–16.2_
- [x] 12. Studio Hub: `[ALT+G] GENUI STUDIO // EXPORT CMOS` jumper pin in `PreviewPage.tsx`; flagship banner in `MarketplacePage.tsx`. _Req 1.3_
- [x] 13. `__tests__/cmos-bios.pbt.test.ts`: compile validity over 500 random configs (strict YAML-subset reader, JSON parse, HCL balance, no inline secrets), power/price/cost monotonicity, adversarial catalog props (direct and streamed), preset streaming, fail-safe recovery, SSR in both modes, `.zip` export. _Req 16.3_
- [x] 14. Marketplace registration via `pnpm sync:templates`, `SKILL.md`, `POWER.md`, template `steering.md`. _Req 16.4_
- [x] 15. Workspace typecheck, build and tests run. The earlier `apps/spatial-ops` typecheck/build failure from a stray edit outside this template (`SpatialSceneCanvas.tsx` line 104) has been resolved; spatial-ops typecheck and build pass.
