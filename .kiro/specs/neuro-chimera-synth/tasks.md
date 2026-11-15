# Implementation Plan: CHIMERA // LAB (`packages/templates/src/neuro-chimera-synth`)

## Core engine: spec, Kiro Crew app, bio-SQL solver, sonification
- [x] 1. Scoped steering `.kiro/steering/chimera-frankenstein-rules.md` (`inclusion: fileMatch`) and this spec.
- [ ] 2. Kiro Crew app bundle `kiro-crew-app/`
  - [ ] `app.json` with agent, skill, dashboard page, paused `0 */6 * * *` cron, lifecycle hooks, permissions, dependencies and setup. _Req 8.1, 8.4_
  - [ ] `agents/chimera-architect.json` (`model: auto`, `tools: ["@kirocrew-core"]`). _Req 8.2_
  - [ ] `skills/bio-query-optimizer/SKILL.md`. _Req 8.3_
  - [ ] Dashboard page source with SDK externals; `backend/hooks.py`. _Req 8.6_
  - [ ] `lib/chimera/crew-manifest.ts` validator. _Req 8.5_
- [ ] 3. `lib/chimera/sql-parser.ts`: tokenizer, parser, printer, limits. _Req 3_
- [ ] 4. `lib/chimera/query-planner.ts`: cost model, plans, EXPLAIN, index advice. _Req 4_
- [ ] 5. `lib/chimera/bio-solver.ts` + `scenarios.ts`: Physarum solver, telemetry, interventions, Optimizer Agent, six scenarios. _Req 5, 6_
- [ ] 6. `lib/chimera/sonifier.ts`: pure mapping and Web Audio engine. _Req 7_
- [ ] 7. Verification: typecheck clean; manifest validates; parser round-trips; all scenarios solve without NaN; interventions lower cost.

## Interactive lab: canvas, catalog, tests, marketplace
- [ ] 8. 60 FPS network canvas, HUD panels, scenario picker and intervention controls. _Req 9.1_
- [ ] 9. `manifest.json`, `theme.css`, `catalog.ts`, registry, remix presets, `index.ts`. _Req 9.2_
- [ ] 10. Studio Hub bio-tag and marketplace banner. _Req 1.3, 9.4_
- [ ] 11. `fast-check` suite. _Req 9.3_
- [ ] 12. `.zip` export including the Kiro Crew app; full workspace build, typecheck and tests. _Req 9.4_
