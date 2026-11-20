# Implementation Plan: CHIMERA // LAB (`packages/templates/src/neuro-chimera-synth`)

## Core engine: spec, bio-SQL solver, sonification, local optimizer agents
- [x] 1. Scoped steering `.kiro/steering/chimera-frankenstein-rules.md` (`inclusion: fileMatch`) and this spec.
- [x] 2. `lib/chimera/sql-parser.ts`: tokenizer, recursive-descent SELECT parser, canonical SQL printer, and adversarial limits. _Req 3_
- [x] 3. `lib/chimera/query-planner.ts`: PostgreSQL-style cost model, plan trees, EXPLAIN output, and composite/HNSW index recommendations. _Req 4_
- [x] 4. `lib/chimera/bio-solver.ts` + `scenarios.ts`: Physarum Kirchhoff flow solver, telemetry, interventions, deterministic Optimizer Agent, and seven database scenarios. _Req 5, 6_
- [x] 5. `lib/chimera/sonifier.ts`: pure telemetry-to-sound mapping, partial predictor, and Web Audio FM/granular/Geiger synthesizer. _Req 7_
- [x] 6. Local Optimizer Agent Constellation (`components/OptimizerAgentConstellation.tsx`): deterministic profiles for `chimera-architect`, `index-surgeon`, and `deadlock-hunter` with previewed audit schedules (`lib/chimera/cron.ts`), 1-click dispatch, and checkpoint activity log. _Req 8_

## Interactive lab: canvas, catalog, tests, Studio Hub & export
- [x] 7. Lab store, `BioNetworkCanvas` (sever, revive, inject index, dispatch agents, drag), shell with scenario picker and solver timer, SQL compare deck, optimizer agent constellation, sonification HUD, and landing sections. _Req 9.1_
- [x] 8. `manifest.json` (MIT, free), `theme.css`, `catalog.ts`, registry, three remix presets, and `index.ts`. _Req 9.2_
- [x] 9. Studio Hub corner bio-tag `[ALT+G] GENUI STUDIO // EXPORT CHIMERA LAB` and inclusion in the 4-app "Built with Kiro + GenUI" spotlight in `MarketplacePage.tsx`. _Req 1.3, 9.4_
- [x] 10. `src/__tests__/chimera-lab.pbt.test.ts`: 500 random graphs (`fast-check`), 300-run planner index monotonicity, local optimizer schedule checks, adversarial catalog props, presets, chaos healing, SSR in both modes, and Next.js `.zip` export verification (`10/10` passing). _Req 9.3, 9.4_
- [x] 11. Workspace build, typecheck, lint, tests, and Kiro hook audits pass across all 6 workspace packages.
