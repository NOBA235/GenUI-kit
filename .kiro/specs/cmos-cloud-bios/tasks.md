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
- [ ] 7. POST boot view: Energy Star emblem, RAM count-up, drive detection, DEL/click/SPACE handling, POST beep. _Req 13_
- [ ] 8. Award BIOS left pane with 6 menus, keyboard and mouse, Y/N dialogs, live telemetry footer. _Req 2, 3, 14_
- [ ] 9. 3D motherboard twin: instanced PCB parts, CPU fan speed tied to clock, heat tint tied to temperature, NVMe LED, PCIe cards, CMOS battery, camera focus per menu. _Req 14_
- [ ] 10. Mode switch: CMOS SETUP vs HARDWARE LANDING PAGE. _Req 15_
- [ ] 11. `manifest.json`, `theme.css`, `catalog.ts` (7 components, strict props), `components/index.ts`, `index.ts`, three remix presets incl. the corrupted-packet fail-safe. _Req 16.1–16.2_
- [ ] 12. Studio Hub jumper pin for this template. _Req 1.3_
- [ ] 13. `__tests__/cmos-bios.pbt.test.ts`: compile validity (500 runs), cost/power monotonicity, catalog fuzzing. _Req 16.3_
- [ ] 14. Marketplace registration, `SKILL.md`, `POWER.md`, sync bundle, export `.zip`. _Req 16.4_
- [ ] 15. Full workspace build, typecheck and tests.
