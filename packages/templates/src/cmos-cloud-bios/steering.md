# BIOS // NECROMANCER (`cmos-cloud-bios`) — Template Steering

- **Mode:** Mode A native website inside WizFrame, previewed at `/preview/cmos-cloud-bios`.
- **Spec:** `.kiro/specs/cmos-cloud-bios/` (`requirements.md`, `design.md`, `tasks.md`).
- **Scoped rules:** `.kiro/steering/cmos-bios-rules.md`.
- **Engine:** `lib/cmos/engine.ts` owns all register state. UI and 3D components read the shared store and never keep their own copy.
- **Compiler:** `lib/cmos/compiler.ts` is pure and deterministic. Every artifact header carries the CMOS checksum.
- **Visuals:** 16-colour VGA palette only (`#0000AA #FFFF55 #FFFFFF #00AAAA #AA0000 #000000`), double-line frames, zero radius, instant selection inversion.
- **Safety:** register writes are Zod validated. Invalid streamed packets load fail-safe BIOS defaults. No raw HTML, `eval` or secrets in generated files.
