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
- [x] 5. `lib/chimera/bio-solver.ts` + `scenarios.ts`: Physarum solver, telemetry, interventions, Optimizer Agent, six scenarios. _Req 5, 6_
- [x] 6. `lib/chimera/sonifier.ts`: pure mapping and Web Audio engine. _Req 7_
- [x] 7. Verification:
  - [x] Templates package typecheck clean; existing template suites pass.
  - [x] Bundle validates with `validateCrewBundle`; malformed manifests are rejected with field paths.
  - [x] Dashboard page builds to a 4 KB ESM bundle that imports only `react`, `@kirocrew/app-sdk` and `@kirocrew/app-sdk/ui`; `hooks.py` compiles.
  - [x] Seven sample statements and 2,000 random ASTs round-trip through `printSql` / `parseSql`.
  - [x] All six scenarios settle without NaN, and the optimizer agent raises health in each. Severing every sink fails queries cleanly.
  - [x] The bounded worst case (64 nodes, 32 queries) steps in about 8 ms.
  - [ ] Install and enable the app in a running Kiro Crew gateway (`kirocrew app install` / `enable`). Not run yet: Kiro Crew is not installed in this workspace.

## Interactive lab: canvas, catalog, tests, marketplace
- [x] 8. Lab store, `BioNetworkCanvas` (sever, inject index, dispatch agents, drag), shell with scenario picker and solver timer, SQL deck, Kiro Crew hive with app download, sonification HUD, landing sections. _Req 9.1_
  - [x] `index-surgeon` and `deadlock-hunter` agents with paused crons (`app.json` 1.1.0); genomics scenario and benchmarks.
- [x] 9. `manifest.json`, `theme.css`, `catalog.ts`, registry, three remix presets, `index.ts`. _Req 9.2_
- [x] 10. Studio Hub corner bio-tag `[ALT+G] GENUI STUDIO // EXPORT CHIMERA + KIRO CREW APP`. The marketplace lists the template as the fourth featured flagship through its existing fallback ordering; no marketplace edit was made while that page was being redesigned. _Req 1.3, 9.4_
- [x] 11. `src/__tests__/chimera-lab.pbt.test.ts`: 500 random graphs, index monotonicity, Crew bundle fuzzing and drift, catalog invariants, presets, chaos healing, SSR, export. It found and fixed link flux overshooting 1 by rounding. _Req 9.3_
- [x] 12. `.zip` export includes `kiro-crew-app/` with `backend/*.py`, `SKILL.md` and `POWER.md`. _Req 9.4_
  - [x] Workspace tests: 135/135 across six packages (templates 52). Catalog audit hook: PASS.
  - [x] Typecheck and build pass for every package except `apps/spatial-ops`.
  - [ ] `apps/spatial-ops` typecheck and build fail on an uncommitted stray token in `src/three/SpatialSceneCanvas.tsx` line 104, outside this template. Left for the file's owner.
