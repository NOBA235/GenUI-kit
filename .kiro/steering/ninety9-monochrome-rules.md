---
inclusion: fileMatch
fileMatchPattern: "packages/templates/src/ninety9-archive/**"
---

# NINETY9 Archive — 5-Tone Monochrome & Workstation Rules (`ninety9-monochrome-rules.md`)

This conditional steering file applies strictly to Flagship Website #2 (`packages/templates/src/ninety9-archive/**`). It extends—and never overrides—the root monorepo invariants in `.kiro/steering/genui-invariants.md`.

---

## 1. The Strict 5-Tone Monochrome Law (ZERO Exceptions)
1. **Approved Hex Allowlist ONLY:**
   - Every stylesheet rule, inline CSS variable, SVG attribute, border, shadow, and background inside `[data-template-theme="ninety9-archive"]` MUST use ONLY these five exact hex values (plus `transparent` / `none`):
     - Pure White: `#FFFFFF`
     - Pure Black: `#000000`
     - Light Gray: `#D9D9D9`
     - Medium Gray: `#808080`
     - Dark Gray: `#292929`
2. **Forbidden Styling:**
   - NO chromatic accent colors (zero red, cyan, blue, amber, green, or neon glow).
   - NO rounded corners (`border-radius: 0px` strictly across buttons, inputs, cards, badges, and modals).
   - NO soft blurry drop shadows; use brutalist solid `#000000` offset shadows (`2px 2px 0px #000000` / `4px 4px 0px #000000`).

---

## 2. Workstation Aesthetic, Typography & Paper-White CRT System
1. **Isolated Font Stack:**
   - Load `Space Mono` (index codes/metadata), `VT323` (dot-matrix counters/terminal readouts), and `Inter` (editorial long-form prose) strictly inside `[data-template-theme="ninety9-archive"]` without mutating root `src/app/` or global fonts.
2. **Surface Texture & CRT Overlay:**
   - Use pure CSS halftone dot-matrix textures and crisp `1px` / `2px` solid `#000000` structural hairlines.
   - Provide a toggleable Paper-White CRT scanline overlay supporting `"SUBTLE" | "ACTIVE" | "OFF"` persisted to `localStorage`, always rendered with `pointer-events: none` and honoring `prefers-reduced-motion: reduce`.

---

## 3. Single-Server Route & Theme Isolation Rules
1. **No Root Overrides:**
   - Never overwrite root `src/app/` routes, `globals.css`, or root Kiro steering docs.
2. **Sub-Navigation State:**
   - Support internal switching across `Archive`, `Categories`, `Timeline`, `Dossiers`, `About`, and `Random Transmit` using internal query/state routing under `/preview/ninety9-archive`.
3. **Minimal Workstation Corner HUD:**
   - Present the template inside a clean 1997 NeXT / Macintosh desktop publication shell with a subtle monochrome corner indicator (`[ALT+G] GENUI STUDIO // EXPORT ARCHIVE`) so Studio HUD controls stay unobtrusive until summoned.

---

## 4. Historical Editorial & Asset Integrity
1. **Zero Lorem Ipsum:**
   - Every cataloged entry MUST carry verified historical dates (`1990–1999`), multi-section copy (`01 // ...`, `02 // ...`), 4-cell technical specs, pull quotes, Cultural Impact, Enduring Historical Legacy, and Verified Citations.
2. **Monochrome Technical SVGs:**
   - All illustrations under `public/images/ninety9/` MUST be generated deterministically by `scripts/generate-ninety9-assets.ts` and validated against the 5-tone monochrome hex allowlist.
