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
- [ ] 8. 60 FPS network canvas, HUD panels, scenario picker and intervention controls. _Req 9.1_
- [ ] 9. `manifest.json`, `theme.css`, `catalog.ts`, registry, remix presets, `index.ts`. _Req 9.2_
- [ ] 10. Studio Hub bio-tag and marketplace banner. _Req 1.3, 9.4_
- [ ] 11. `fast-check` suite. _Req 9.3_
- [ ] 12. `.zip` export including the Kiro Crew app; full workspace build, typecheck and tests. _Req 9.4_
