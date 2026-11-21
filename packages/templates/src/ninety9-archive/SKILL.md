---
name: ninety9-archive
description: Paper-white 1997 NeXT/Macintosh monochrome editorial archive indexing 34 1990s artifacts across 12 sectors, toggleable Paper-White CRT scanlines, 99.4 MHz random packet transmitter, and Zod-verified GenUI remixes.
---

# NINETY9 — The Monochrome Archive of the 1990s

## Architecture & Invariants
1. **Strict 5-Tone Palette:** Permit only `#FFFFFF`, `#000000`, `#D9D9D9`, `#808080`, and `#292929` across [theme.css](file:///packages/templates/src/ninety9-archive/theme.css), [catalog.ts](file:///packages/templates/src/ninety9-archive/catalog.ts), React views in `components/`, modular games in `arcade/`, and bespoke technical schematics in `public/images/ninety9/`.
2. **Scoped Styling:** Wrap styles under `[data-template-theme="ninety9-archive"]` and `@scope ([data-template-theme="ninety9-archive"])`, enforcing `border-radius: 0px`.
3. **Catalog & State:** Render all pages via `@genui-studio/core` (`verifiedCatalog` + `GuardrailedStreamCompiler`) backed by `useNinety9Store` (`store.ts`). Never bypass Zod validation or mutate unrelated workspace routes.
4. **Routing & Sub-Views:** Support `/`, `/archive`, `/timeline`, `/categories`, `/about`, and `/arcade` both inside WizFrame (`/preview/ninety9-archive/*`) and standalone Next.js App Router `.zip` exports (`app/*/page.tsx`).
