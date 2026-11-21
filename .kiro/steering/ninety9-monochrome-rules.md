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
2. **Forbidden Styling & Pre-Entry Exception:**
   - All NINETY9 website pages/components inside `.n99-workstation-root` have NO chromatic accent colors (zero red, cyan, blue, amber, green, or neon glow), `border-radius: 0px` strictly across buttons, inputs, cards, badges, and modals, and solid `#000000` offset shadows (`2px 2px 0px #000000` / `4px 4px 0px #000000`).
   - **Pre-Entry Terminal Gate Exception (`CobolBootTerminal.tsx`):** Before authenticating into NINETY9, the gated pre-entry COBOL CRT login terminal renders in dedicated green/red phosphor CRT terminal styling (`#020A04`, `#22FF66`, `#FF4D4D`, plus the shades `#041809`, `#051F0D`, `#14993D`, `#290707`) with a subtle blinking CRT background, hiding the monochrome website until a non-empty operator name unlocks the archive.

---

## 2. Workstation Aesthetic, Typography & Paper-White CRT System
1. **Isolated Font Stack:**
   - Load `Space Mono` (index codes/metadata), `VT323` (dot-matrix counters/terminal readouts), and `Inter` (editorial long-form prose) strictly inside `[data-template-theme="ninety9-archive"]` without changing the host's global fonts. (The font files are loaded once by the host page, Studio Hub's `index.html`; only their use is scoped to the template.)
2. **Surface Texture & CRT Overlay:**
   - Use pure CSS halftone dot-matrix textures and crisp `1px` / `2px` solid `#000000` structural hairlines.
   - Provide a toggleable Paper-White CRT scanline overlay supporting `"SUBTLE" | "ACTIVE" | "OFF"` persisted to `localStorage`, always rendered with `pointer-events: none` and honoring `prefers-reduced-motion: reduce`.

---

## 3. Single-Server Route & Theme Isolation Rules
1. **No Root Overrides:**
   - Never overwrite Studio Hub routes (`apps/studio-hub/src`), the exported Next.js shell (`packages/templates/base-nextjs-shell/`, including `app/globals.css`), or root Kiro steering docs.
2. **Sub-Navigation State:**
   - Support internal switching across the views `home`, `archive`, `timeline`, `categories`, `about`, `dossier`, `random-transmit` and `arcade` using internal query/state routing under `/preview/ninety9-archive`.
3. **Minimal Workstation Corner HUD:**
   - Present the template inside a clean 1997 NeXT / Macintosh desktop publication shell with a subtle monochrome corner indicator (`[ALT+G] WIZFRAME // EXPORT ARCHIVE`) so WizFrame HUD controls stay unobtrusive until summoned.

---

## 4. Historical Editorial & Asset Integrity
1. **Zero Lorem Ipsum:**
   - Every cataloged entry MUST carry verified historical dates (`1990–1999`), multi-section copy (`01 // ...`, `02 // ...`), 4-cell technical specs, pull quotes, Cultural Impact, Enduring Historical Legacy, and Verified Citations.
2. **Monochrome Technical SVGs:**
   - All SVG illustrations under `public/images/ninety9/entries/` and `public/images/ninety9/categories/` MUST be generated deterministically by `scripts/generate-ninety9-assets.ts` and validated against the 5-tone monochrome hex allowlist.
   - The archival photographs in `public/images/ninety9/photos/` (JPG/PNG) are fetched by `scripts/fetch-ninety9-photos.mjs`, not generated.
