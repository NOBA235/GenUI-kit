---
name: cmos-cloud-bios
description: Use when building, extending or remixing the BIOS // NECROMANCER template, an Award BIOS setup utility that maps hardware registers to cloud infrastructure and compiles docker-compose.yml, vercel.json and main.tf.
---

# BIOS // NECROMANCER Skill

## What this template is
A 1994 Award Modular BIOS setup utility, a 3D motherboard digital twin and a landing-page mode, all driven by one CMOS register store. Register changes recompute a deterministic cloud topology and simulated telemetry, and recompile three infrastructure files.

## Key modules
- `lib/cmos/engine.ts`: `CmosConfigSchema`, presets, `deriveCloudTopology`, `simulateCmos`, `applyCloudPatch`, `cmosReducer`, `createCmosStore`.
- `lib/cmos/compiler.ts`: `compileCmos(config, { projectName, functionsGlob })` returns artifacts, notes and the FSK manifest.
- `lib/cmos/audio.ts`: `getCmosAudio()` for beeps, the alarm and `transmit()`. `encodeFskSamples()` is pure and testable.
- `components/`: `CmosWorkstationShell` (root), `PostBootSequence`, `AwardBiosMenuGrid`, `Motherboard3DTwin`, `HardwareTelemetryMonitor`, `IaCCodeCompilerOutput`, `AcousticModemOscilloscope`, `DevToolsHeroSection`, `CmosRegisterPacket`.

## Register → cloud mapping (summary)
| Register | Cloud setting |
| --- | --- |
| FSB × multiplier | vCPU per instance and concurrency |
| Vcore | Autoscaling ceiling (4 × 2^((mV − 2800)/100)) |
| DRAM | Function memory (RAM × 32) |
| IDE Primary Master / RAID / Primary Slave | PostgreSQL class / read replicas / pgvector |
| IDE Secondary Master | Redis tier |
| PCI slots + bus clock | API gateway throttling, edge CDN + WAF, webhook queue |
| Power management / standby / watchdog | Warm pool / scale-in delay / timeout |
| Budget cap, fan RPM, warning temperature | AWS Budget, target utilization, DDoS limit per IP |
| Time zone | AWS + Vercel region |

## Rules for changes
1. Add new registers to `CmosConfigSchema` first, then map them in `deriveCloudTopology`, then expose them in `components/bios-menus.ts`.
2. Keep the compiler deterministic: no clocks, randomness or environment reads.
3. Stay inside the VGA palette and keep keyboard parity for every mouse action.
4. Costs are estimates from public list prices. Never present them as quotes.

## Install
```bash
npx genui-studio add cmos-cloud-bios
```
