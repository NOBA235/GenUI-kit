---
name: neuro-chimera-synth
description: Use when building, extending or remixing the CHIMERA // LAB template, a Physarum slime-mould simulation of database query traffic with a deterministic SQL parser and planner, local SQL optimizer agents and telemetry sonification.
---

# CHIMERA // LAB Skill

## What this template is
A live network of services and databases where query traffic flows like a slime mould. Full-table scans and N+1 loops show up as crimson tubes and pulsing nodes. Operators and three deterministic optimizer agents fix them with composite indexes and batched rewrites, and the network re-routes. A landing-page mode presents the same engine as an AI research SaaS.

## Key modules
- `lib/chimera/sql-parser.ts`: `parseSql`, `printSql`, `SqlParseError` (with offsets). Bounded by `MAX_SQL_LENGTH`, `MAX_SQL_TOKENS` and `MAX_EXPR_DEPTH`.
- `lib/chimera/query-planner.ts`: `planQuery`, `explainPlan`, `recommendIndexes`, `withIndex`, `indexDdl`.
- `lib/chimera/bio-solver.ts`: `PhysarumNetwork` with `step`, `severNode`, `reviveNode`, `moveNode`, `injectIndex`, `rewriteNPlusOne`, `setQuerySql`, `applyChemotaxisPulse`, `runOptimizerAgent`.
- `lib/chimera/scenarios.ts`: seven scenarios, from an unindexed checkout spike to a genomics pipeline.
- `lib/chimera/compare.ts`: before/after plan comparison for the SQL deck.
- `lib/chimera/sonifier.ts`: pure `mapTelemetryToSound` and `predictPartials`, plus the Web Audio engine.
- `components/`: `ChimeraLabShell` (root), `BioNetworkCanvas`, `SqlAstExecutionCompare`, `OptimizerAgentConstellation`, `SonificationSpectrumHUD`, `BiotechHeroSection`, `InteractiveBenchmarkBento`, `PricingTiersSection`, `ChemotaxisPacket`.

## Local optimizer agents
| Agent | Lab action | Previewed audit cadence |
| --- | --- | --- |
| `chimera-architect` | Full audit: top indexes plus N+1 batching | `0 */6 * * *` |
| `index-surgeon` | Best index for the target node's dataset | `0 3 * * *` |
| `deadlock-hunter` | Batches N+1 loops, reports timeouts and saturated nodes | `*/30 * * * *` |

## Rules for changes
1. Keep `lib/chimera/` pure and deterministic. Same SQL and statistics give the same plan and EXPLAIN text.
2. Add scenarios to `CHIMERA_SCENARIOS`; the catalog's `scenarioId` enum and the benchmark matrix pick them up.
3. Stay inside the bioluminescent palette and pair every colour with a label or icon.
4. Benchmark and latency figures are simulator estimates. Never present them as measurements.

## Install
```bash
npx genui-studio add neuro-chimera-synth
```
