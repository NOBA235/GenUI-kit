---
inclusion: fileMatch
fileMatchPattern: "packages/templates/src/cmos-cloud-bios/**"
---

# BIOS // NECROMANCER Steering (`cmos-bios-rules.md`)

Applies only to Flagship Website #3 (`packages/templates/src/cmos-cloud-bios/**`). It adds to, and never overrides, `genui-invariants.md`, `spatial-3d-rules.md` and `tech.md`.

## 1. Scope & Isolation
1. Keep every template file inside `packages/templates/src/cmos-cloud-bios/`. Do not edit the Studio Hub shell (`apps/studio-hub/src`), the exported Next.js shell (`packages/templates/base-nextjs-shell/`), or other steering files.
2. The template renders at `/preview/cmos-cloud-bios`. All styles stay inside `[data-template-theme="cmos-cloud-bios"]`.
3. Studio Hub chrome collapses to a top-right jumper pin reading `[ALT+G] GENUI STUDIO // EXPORT CMOS`.

## 2. 1994 VGA BIOS Visual Language
1. Palette is fixed to these VGA colours:
   - CMOS Royal Blue `#0000AA` (background)
   - High-Voltage Yellow `#FFFF55` (values, highlights)
   - VGA White `#FFFFFF` (labels)
   - BIOS Cyan `#00AAAA` (help text, frames)
   - Selected/Danger Red `#AA0000` (selection bar, alarms)
   - Shadow Black `#000000` (drop shadows, dialogs)
2. Borders use double-line box drawing (`╔═╗ ║ ╚═╝`) or `border-style: double`. `border-radius` is always `0`.
3. Typography: `VT323`, then `Space Mono`, then `monospace`. The template itself makes no font CDN requests: it uses the fonts the host page already loads (Studio Hub's `index.html` loads VT323 and Space Mono from Google Fonts) or falls back to system monospace.
4. Selection inverts colours instantly. No transitions, easing or blur on BIOS chrome.
5. Alarm visuals never flash more than 3 times per second (WCAG 2.3.1).

## 3. Keyboard-First Accessibility
1. Every BIOS screen is fully operable by keyboard, using Award key bindings:
   - Arrows move between items.
   - `Enter` opens a sub-menu or option list.
   - `Esc` goes back or exits.
   - `PgUp`/`PgDn` and `+`/`-` change values.
   - `F1` help, `F5` BIOS (fail-safe) defaults, `F6` setup defaults, `F7` high-traffic overclock preset, `F10` save & compile.
2. Focus is always visible (yellow-on-red bar plus a 2px outline). Never trap focus. `Esc` always backs out.
3. Use semantic roles: `menu`/`menuitem` for the main menu, `listbox`/`option` for value pickers, `alertdialog` for Y/N confirms. Alarms and POST results are announced through an `aria-live="polite"` region.
4. Respect `prefers-reduced-motion`: no blinking cursor animation, no CRT flicker, no oscilloscope persistence trails.
5. Every audio cue has a visible text equivalent. Audio starts only after a user gesture and has a Mute toggle.

## 4. 3D Motherboard Digital Twin (60 FPS)
1. Repeated PCB parts (capacitors, DIMM chips, VRM chokes, PCI pins, traces) use `THREE.InstancedMesh` with shared geometry and materials.
2. `useFrame` allocates nothing. Mutate module-level scratch `Vector3`/`Color`/`Matrix4` instances only.
3. Dispose every geometry, material and texture on unmount. Pause rendering when `document.hidden`. Handle `webglcontextlost` with a fallback.
4. DPR is capped at `[1, 2]`. Dynamic lights are capped at 3. BIOS menus render as DOM outside the `<Canvas>`.
5. The 3D board reads the same CMOS store as the BIOS UI. It never keeps its own copy of register state.

## 5. Deterministic Infrastructure-as-Code Compilation
1. `lib/cmos/compiler.ts` is pure. It uses no `Date`, `Math.random`, network, filesystem or environment reads. The same `CmosConfig` and options always produce byte-identical `docker-compose.yml`, `vercel.json` and `main.tf`.
2. Every input passes `CmosConfigSchema` (Zod) before compilation. Invalid configs throw `CmosCompileError` with issue paths.
3. Output ordering is fixed: services, resources and keys are emitted in a defined order and never iterate unordered sources.
4. No secrets in generated files. Passwords come from `.env` (`${VAR:?}`), Secrets Manager (`manage_master_user_password`) or required Terraform variables.
5. Escaping rules:
   - YAML strings are JSON-quoted.
   - Container-side `$` in Compose commands and configs is written as `$$`.
   - HCL literal strings escape `"`, `\`, `${` and `%{`.
6. Every artifact header records the CMOS checksum (FNV-1a over canonical JSON) so outputs trace back to the exact register state.
7. Cost figures are estimates from public list prices. Label them as estimates, never as quotes.

## 6. Audio Engine
1. `lib/cmos/audio.ts` uses only the Web Audio API. It no-ops under SSR or when `AudioContext` is missing.
2. FSK payloads are capped at `MAX_FSK_PAYLOAD_BYTES` (2048) so sample buffers stay bounded.
3. Only one modem transmission runs at a time. Stop every oscillator and source on cancel and dispose.
