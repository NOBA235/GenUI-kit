# Standalone Drop-In Staging Directory (`Mode B`)

Drop any pre-existing Next.js or React project folder into:

```text
standalone-dropin/<project-slug>/
```

Then run:

```bash
pnpm ingest:standalone <project-slug>
```

## What `ingest:standalone` Automates
1. Scans `package.json`, `src/` or `app/` (`pages/`), and `components/` (ignoring `node_modules`, `.next`, `.git`, and `.env` secrets).
2. Auto-generates:
   - `manifest.json` (with framework metadata, tags, routes, and dependencies)
   - `catalog.ts` bridge for `@genui-studio/core` (`SafeGenUIRenderer` & Live Remix Bar)
   - Scoped `theme.css` under `[data-template-theme="<project-slug>"]`
   - `SKILL.md` + Kiro `POWER.md`
3. Packages the clean standalone source tree directly into the Marketplace `.zip` and Shadcn CLI Registry pipeline, and displays the project in the Studio Hub storefront grid.
