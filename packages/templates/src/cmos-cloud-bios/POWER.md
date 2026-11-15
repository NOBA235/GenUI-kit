---
name: "cmos-cloud-bios"
displayName: "BIOS // NECROMANCER — 1994 CMOS Utility & 3D Motherboard Cloud Compiler"
description: "Award BIOS setup utility that compiles real cloud infrastructure (docker-compose.yml, vercel.json, main.tf) from CMOS registers, with a 3D motherboard twin and an FSK modem."
keywords: ["bios", "cmos", "iac", "terraform", "docker-compose", "vercel", "react-three-fiber", "web-audio"]
---

# BIOS // NECROMANCER Kiro Power

## Onboarding
1. Install the template: `npx genui-studio add cmos-cloud-bios`.
2. Read `.kiro/specs/cmos-cloud-bios/design.md` for the register → cloud mapping and the simulator model.
3. Steering for this directory lives in `.kiro/steering/cmos-bios-rules.md`.

## Common tasks
- **Add a register:** extend `CmosConfigSchema`, map it in `deriveCloudTopology`, add a row in `components/bios-menus.ts`, then run the property tests.
- **Change pricing:** edit `PRICING`, `DRIVE_SPECS` and `CACHE_SPECS` in `lib/cmos/engine.ts`.
- **Add an artifact:** add a builder in `lib/cmos/compiler.ts` and include it in `compileCmos`.
- **Verify:** `pnpm --filter @genui-studio/templates exec vitest run src/__tests__/cmos-bios.pbt.test.ts`.

## Guarantees
- The same registers always compile to byte-identical files.
- Invalid streamed register packets load fail-safe BIOS defaults instead of crashing.
- Audio starts only after a user gesture and can be muted.
