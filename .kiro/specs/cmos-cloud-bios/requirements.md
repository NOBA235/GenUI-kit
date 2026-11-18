# Requirements: Flagship Website #3 — BIOS // NECROMANCER (`packages/templates/src/cmos-cloud-bios`)

## Introduction
BIOS // NECROMANCER resurrects the 1994 Award Modular BIOS v4.51PG Setup Utility and uses it to configure real 2026 cloud infrastructure. Each hardware register maps to a cloud setting. A deterministic simulator prices and benchmarks the result. A compiler emits `docker-compose.yml`, `vercel.json` and `main.tf`. A Web Audio modem can transmit the compiled manifest as audible FSK tones. The interactive layer adds a split-screen BIOS UI, a 3D motherboard digital twin, a landing-page mode, a GenUI catalog, property-based verification and marketplace packaging.

Glossary:
- **Register**: one editable CMOS field, addressed as `group.field` (for example `cpu.multiplier`).
- **Draft / Saved**: registers being edited vs. registers committed with SAVE & EXIT.
- **Topology**: the cloud resources derived from a register set.
- **Telemetry**: simulated cost, P99 latency, max RPS, thermal load and stability for a topology.

---

## Requirement 1: Scoped template isolation
**User story:** As a template buyer, I want the BIOS styling and code isolated so it never leaks into the host app.
1. THE SYSTEM SHALL keep all template source inside `packages/templates/src/cmos-cloud-bios/`.
2. WHEN `/preview/cmos-cloud-bios` renders, THE SYSTEM SHALL scope all fonts, colours and focus styles to `[data-template-theme="cmos-cloud-bios"]`.
3. WHILE the template is previewed, THE SYSTEM SHALL collapse Studio Hub chrome into a top-right jumper pin labelled `[ALT+G] GENUI STUDIO // EXPORT CMOS`.

## Requirement 2: 1994 VGA BIOS visual language
1. THE SYSTEM SHALL restrict BIOS chrome to `#0000AA`, `#FFFF55`, `#FFFFFF`, `#00AAAA`, `#AA0000`, `#000000` and `#AAAAAA` (VGA light grey).
2. THE SYSTEM SHALL draw panels with double-line borders, zero border radius and `VT323` / `Space Mono` / `monospace` type.
3. WHEN a menu item gains focus, THE SYSTEM SHALL invert it instantly with no transition.
4. IF an alarm is shown visually, THEN THE SYSTEM SHALL flash it no more than 3 times per second.

## Requirement 3: Keyboard and mouse operation
1. THE SYSTEM SHALL support Arrow keys, `Enter`, `Esc`, `+`/`-`, `PgUp`/`PgDn`, `F1`, `F5`, `F6`/`F7` and `F10` with Award semantics, and equivalent mouse clicks.
2. WHEN the user presses `Esc`, THE SYSTEM SHALL return to the previous menu level and never trap focus.
3. THE SYSTEM SHALL expose menus with `menu`/`menuitem`, value pickers with `listbox`/`option`, Y/N prompts with `alertdialog`, and announce POST results and alarms through an `aria-live="polite"` region.
4. WHERE `prefers-reduced-motion: reduce` is set, THE SYSTEM SHALL disable cursor blink, CRT flicker and oscilloscope trails.

## Requirement 4: CMOS register schema
1. THE SYSTEM SHALL define every register in a strict Zod schema (`CmosConfigSchema`) grouped into `standard`, `cpu`, `memory`, `storage`, `bus`, `power`, `health` and `workload`.
2. WHEN a register write contains an unknown key, an out-of-range value or an off-step value, THE SYSTEM SHALL reject it, keep the previous draft and report issue paths.
3. IF the Primary Master drive is `none`, THEN THE SYSTEM SHALL reject RAID or vector-storage settings, and WHEN the drive is set to `none` THE SYSTEM SHALL cascade RAID and vector storage to `none`.
4. THE SYSTEM SHALL freeze validated configs so callers cannot mutate them.

## Requirement 5: Bidirectional cloud-to-CMOS mapping
1. WHEN registers change, THE SYSTEM SHALL derive a topology with these mappings:
   - CPU clock (FSB × multiplier) → vCPU per instance.
   - Vcore → autoscaling ceiling.
   - RAM → function memory.
   - IDE Primary Master → PostgreSQL class.
   - RAID → read replicas.
   - Primary Slave → pgvector.
   - Secondary Master → Redis tier.
   - PCI slots → API gateway, edge middleware and webhook queue.
   - PCI clock → gateway rate limit.
   - Power management → warm pool.
   - Watchdog → function timeout.
   - Budget cap → AWS Budget.
   - Fan RPM → autoscaling target utilization.
   - CPU warning temperature → per-client DDoS limit.
   - Time zone → region.
2. WHEN a cloud patch (region, vCPU, memory, max instances, database class, replicas, vector store, cache tier, timeout, budget) is applied, THE SYSTEM SHALL set the nearest representable registers and report every rounding adjustment.
3. WHEN two PCI devices, or a PCI device and an IDE channel, share an IRQ line, THE SYSTEM SHALL report an IRQ conflict. `auto` slots SHALL take the first free line in PnP order.

## Requirement 6: Deterministic simulator
1. WHEN registers change, THE SYSTEM SHALL compute these metrics as pure functions of the registers:
   - estimated monthly cost with a line-item breakdown
   - P99 latency
   - max RPS and the bottleneck
   - peak utilization and rejected share
   - CPU temperature and power draw
   - cold-start share
   - stability score (0–100)
2. THE SYSTEM SHALL label cost as an estimate from public list prices, not a quote.
3. WHEN the thermal model exceeds the CPU warning temperature, THE SYSTEM SHALL cap capacity at the breaker point (thermal circuit breaker).
4. THE SYSTEM SHALL produce a POST report covering CPU, memory, primary master, RAID, IRQ, thermal, budget and capacity checks, with an Award beep code (`ok`, `irq-conflict`, `undervolt`, `budget`, `thermal`).
5. WHEN a thermal or budget check fails, THE SYSTEM SHALL set `alarmActive`.

## Requirement 7: BIOS state machine and CMOS battery
1. THE SYSTEM SHALL model phases `post → setup → confirm-save | confirm-exit → rebooting → post`.
2. WHILE not in `setup`, THE SYSTEM SHALL reject register writes.
3. WHEN SAVE & EXIT is confirmed, THE SYSTEM SHALL commit the draft and persist it with a checksum. WHEN EXIT WITHOUT SAVING is confirmed, THE SYSTEM SHALL discard the draft.
4. IF persisted CMOS data is missing a version, fails validation, fails its checksum or exceeds 64 KB, THEN THE SYSTEM SHALL load setup defaults and raise `checksumError` ("CMOS checksum error - Defaults loaded").
5. THE SYSTEM SHALL provide `LOAD BIOS DEFAULTS` (fail-safe) and `LOAD SETUP DEFAULTS` (balanced) presets that both pass POST.

## Requirement 8: IaC compiler — docker-compose.yml
1. WHEN compiling, THE SYSTEM SHALL emit a Compose file with:
   - exact CPU and memory limits per service
   - PostgreSQL primary (pgvector image when vector storage is on) and streaming read replicas
   - Redis cache and webhook queue services with health checks
   - a Traefik edge carrying the gateway and per-IP rate limits
   - separate `edge` and internal `backend` networks
2. THE SYSTEM SHALL read every secret from `.env` with `${VAR:?}` and escape container-side `$` as `$$`.

## Requirement 9: IaC compiler — vercel.json
1. WHEN compiling, THE SYSTEM SHALL emit `vercel.json` with `fluid`, `regions`, `functions.<glob>.maxDuration`, security headers (edge slot) and `RateLimit-Policy` headers (gateway/edge slot).
2. Because Fluid compute does not accept `memory` in `vercel.json`, THE SYSTEM SHALL report the required Function CPU size as a deployment note instead.

## Requirement 10: IaC compiler — main.tf
1. WHEN compiling, THE SYSTEM SHALL emit Terraform covering:
   - VPC (when a DB or cache exists)
   - security groups
   - RDS primary with Secrets Manager-managed password, plus read replicas
   - ElastiCache
   - Lambda with reserved and provisioned concurrency
   - HTTP API with stage throttling
   - CloudFront + WAF rate-based rule (edge slot)
   - SQS + DLQ + worker (webhook slot)
   - AWS Budget alerts
   - outputs
2. THE SYSTEM SHALL produce byte-identical output for identical inputs and stamp the CMOS checksum into every artifact header.
3. IF the config or options are invalid, THEN THE SYSTEM SHALL throw `CmosCompileError` listing issue paths.

## Requirement 11: PC speaker audio
1. THE SYSTEM SHALL start audio only after `unlock()` runs inside a user gesture, provide a mute toggle, and no-op under SSR.
2. WHEN POST passes, THE SYSTEM SHALL play one short 1000 Hz beep. WHEN POST fails, THE SYSTEM SHALL play the matching Award beep code.
3. WHEN keyboard navigation moves the selection, THE SYSTEM SHALL play a quiet tick, throttled to at most one per 28 ms.
4. WHILE `alarmActive` is true, THE SYSTEM SHALL sound a dual-tone 1000/600 Hz alarm and stop it when the condition clears.

## Requirement 12: Acoustic FSK modem
1. WHEN the user clicks `TRANSMIT CONFIG OVER AUDIO`, THE SYSTEM SHALL encode the compiled cloud manifest as:
   - a 2025 Hz handshake tone
   - 1070/1270 Hz phase-continuous FSK
   - 8-N-1 framing with a length header and CRC-16/CCITT
   - 300 or 600 baud
2. THE SYSTEM SHALL route all audio through one `AnalyserNode` so the UI can draw a live oscilloscope and FFT, including while muted.
3. IF the payload exceeds 2048 bytes, THEN THE SYSTEM SHALL refuse it with a `RangeError`.
4. THE SYSTEM SHALL allow one transmission at a time and support cancel with full node cleanup.

## Requirement 13: POST boot sequence
1. WHEN the template loads, THE SYSTEM SHALL show a skippable POST screen with:
   - an Energy Star emblem
   - a RAM count-up (`65536K OK`)
   - auto-detected Primary and Secondary Master devices
   - the prompt `Press DEL or Click to Enter SETUP // Press SPACE to Skip`

## Requirement 14: Split-screen BIOS + 3D motherboard
1. THE SYSTEM SHALL render the BIOS on the left with these six menus:
   - Standard Cloud CMOS Features
   - Advanced Chipset & Serverless
   - Integrated Peripherals & IRQ
   - Power & FinOps Budget Management
   - PnP / PCIe AI Accelerator Config
   - Acoustic Modem & IaC Compiler
2. THE SYSTEM SHALL render a 60 FPS instanced 3D ATX motherboard on the right that reads the same CMOS store.
3. WHEN a menu or register is focused, THE SYSTEM SHALL move the 3D camera to the matching component. WHEN the CPU temperature rises, THE SYSTEM SHALL tint the heatsink amber to red.

## Requirement 15: Landing-page mode
1. WHEN the user switches `[MODE: HARDWARE LANDING PAGE]`, THE SYSTEM SHALL render a DevTools SaaS landing page that embeds the live 3D board and an interactive BIOS widget.

## Requirement 16: GenUI catalog, remixes, PBT and marketplace
1. THE SYSTEM SHALL register `CmosWorkstationShell`, `PostBootSequence`, `AwardBiosMenuGrid`, `Motherboard3DTwin`, `HardwareTelemetryMonitor`, `IaCCodeCompilerOutput`, `AcousticModemOscilloscope`, `DevToolsHeroSection` and `CmosRegisterPacket` with strict Zod props.
2. THE SYSTEM SHALL offer three remix presets:
   - AI Agent Cluster Overclock
   - Zero-Cost Indie Hacker Undervolt
   - Corrupted Voltage / Negative IRQ packet, which SHALL be rejected and trigger fail-safe recovery without crashing
3. THE SYSTEM SHALL verify with `fast-check`:
   - compile validity over 500 random configs
   - cost and power monotonicity in multiplier and replicas
   - adversarial catalog props
4. THE SYSTEM SHALL register `cmos-cloud-bios` in the Studio Hub marketplace with preview, `npx genui-studio add cmos-cloud-bios` and `.zip` export including `SKILL.md` and `POWER.md`.
