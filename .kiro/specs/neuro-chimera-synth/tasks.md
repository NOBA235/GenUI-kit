# Implementation Plan: CHIMERA // LAB (`packages/templates/src/neuro-chimera-synth`)

## Core engine: spec, Kiro Crew app, bio-SQL solver, sonification
- [x] 1. Scoped steering `.kiro/steering/chimera-frankenstein-rules.md` (`inclusion: fileMatch`) and this spec.
- [x] 2. Kiro Crew app bundle `kiro-crew-app/`
  - [x] `app.json` with agent, skill, dashboard page, paused `0 */6 * * *` cron, lifecycle hooks, permissions, dependencies and setup. _Req 8.1, 8.4_
  - [x] `agents/chimera-architect.json` (`model: auto`, `tools: ["@kirocrew-core"]`). _Req 8.2_
  - [x] `skills/bio-query-optimizer/SKILL.md`. _Req 8.3_
  - [x] Dashboard page source with SDK externals; `backend/hooks.py`. _Req 8.6_
  - [x] `lib/chimera/crew-manifest.ts` validator. _Req 8.5_
- [x] 3. `lib/chimera/sql-parser.ts`: tokenizer, parser, printer, limits. _Req 3_
- [x] 4. `lib/chimera/query-planner.ts`: cost model, plans, EXPLAIN, index advice. _Req 4_
- [x] 5. `lib/chimera/bio-solver.ts` + `scenarios.ts`: Physarum solver, telemetry, interventions, Optimizer Agent, seven scenarios. _Req 5, 6_
- [x] 6. `lib/chimera/sonifier.ts`: pure mapping and Web Audio engine. _Req 7_
- [x] 7. Verification (re-run 2026-11-17, Node 24.20.0, Python 3.13.15):
  - [x] Templates package typecheck clean; existing template suites pass (`chimera-lab.pbt.test.ts` 10/10; templates 52/52).
  - [x] All seven scenarios settle without NaN, and the optimizer agent raises health in each. Severing every sink fails every query cleanly with finite telemetry. (One-off script over the built `dist/`; Property 1 of the committed suite covers NaN/Infinity under random severing and optimizer runs.)
  - [x] The 22 distinct SQL statements shipped in the scenarios round-trip through `printSql` / `parseSql` (print → parse → print is stable and the ASTs match). One-off script; the committed suite has no parser round-trip property, and the earlier "2,000 random ASTs" run is not reproducible from the repo.
  - [x] At the bounds (64 nodes, 256 links, 32 queries) one solver step measured median 10.6 ms, p95 13.7 ms over 200 steps (one-off benchmark; previously recorded as "about 8 ms").

### Kiro Crew verification, in three separate states
  - [x] **State 1: offline packaging and manifest validation — verified.**
    - `validateCrewBundle` (built `dist/`) accepts the 13 files on disk: `chimera-lab@1.1.0`, 3 agents (`model: auto`, `tools: ["@kirocrew-core"]`), 1 skill, 3 crons all `enabled: false`, `ui.entry: dist/index.mjs`, hooks `backend.hooks:on_startup` / `on_shutdown`.
    - Malformed manifests are rejected with field paths: non-kebab name (`app.json:name`), absolute agent path (`agents.0`), cron with both `every` and `cron_expr` (`crons.0`), hook without `module:callable` (`backend.hooks.on_startup`), cron for an undeclared agent (`crons.0.agent`).
    - `SKILL.md` is UTF-8 without a BOM (first bytes `2D 2D 2D 0A`). Property 3 of `chimera-lab.pbt.test.ts` also checks embedded-vs-disk drift, the download `.zip` contents, mutated manifests and UTF-16 rejection.
  - [x] **State 2: ESM bundle and hook compilation — verified.**
    - In a copy outside the repo, `cd ui && npm install && npm run build` (the `setup.onInstall` command; vite 6.4.6) produced `dist/index.mjs` of 3,980 bytes (1.60 kB gzip). Its only imports are `react`, `@kirocrew/app-sdk` and `@kirocrew/app-sdk/ui`; no dynamic imports.
    - `python -m py_compile backend/hooks.py backend/__init__.py` exits 0. `hooks.py` imports only `os`, `pathlib`, `shutil` and `__future__`.
    - Exercised offline with a stub `ctx`: `on_startup` reports `CHIMERA_PROJECT_DIR` missing, reports nothing once it is set, reports the missing `dist/index.mjs` when the bundle is absent, and tolerates a `ctx` without `health`; `on_shutdown` returns `None`.
  - [ ] **State 3: installation and runtime in a Kiro Crew gateway — unverified.** `kirocrew app install` / `enable`, the dashboard page loading in the Crew host, the hooks running inside the gateway, and the crons are untested: the Kiro Crew CLI and gateway are not installed on this machine (`kirocrew` is not on PATH).

## Interactive lab: canvas, catalog, tests, marketplace
- [x] 8. Lab store, `BioNetworkCanvas` (sever, inject index, dispatch agents, drag), shell with scenario picker and solver timer, SQL deck, Kiro Crew hive with app download, sonification HUD, landing sections. _Req 9.1_
  - [x] `index-surgeon` and `deadlock-hunter` agents with paused crons (`app.json` 1.1.0); genomics scenario and benchmarks.
- [x] 9. `manifest.json`, `theme.css`, `catalog.ts`, registry, three remix presets, `index.ts`. _Req 9.2_
- [x] 10. Studio Hub corner bio-tag `[ALT+G] GENUI STUDIO // EXPORT CHIMERA + KIRO CREW APP`. The template is registered (`registry-entries.generated.ts`) and listed in the marketplace grid, but it is not a featured flagship: `FLAGSHIP_SLUGS` in `MarketplacePage.tsx` lists only `afterdark-horror`, `ninety9-archive` and `cmos-cloud-bios`. No marketplace edit was made while that page was being redesigned. _Req 1.3, 9.4_
- [x] 11. `src/__tests__/chimera-lab.pbt.test.ts`: 500 random graphs, index monotonicity, Crew bundle fuzzing and drift, catalog invariants, presets, chaos healing, SSR, export. It found and fixed link flux overshooting 1 by rounding. _Req 9.3_
- [x] 12. `.zip` export includes `kiro-crew-app/` with `backend/*.py`, `SKILL.md` and `POWER.md`. _Req 9.4_
  - [x] Workspace tests: 143/143 across six packages (templates 52) on 2026-11-17. Catalog audit hook: PASS.
  - [x] Typecheck and build pass for every package, including `apps/spatial-ops` (the stray token at `src/three/SpatialSceneCanvas.tsx` line 104 was fixed; line 104 is now `case "CACHE":`).
