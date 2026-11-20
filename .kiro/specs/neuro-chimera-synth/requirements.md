# Requirements: Application #4 — CHIMERA // LAB (`packages/templates/src/neuro-chimera-synth`)

## Introduction
CHIMERA // LAB combines four computational layers into one GenUI starter application:
1. **Physarum routing.** A slime-mould (*Physarum polycephalum*) flow-reinforcement solver finds fault-tolerant routes through a service graph.
2. **SQL plan analysis.** A deterministic SQL parser and cost-based planner turn real queries into `Seq Scan` / `Index Scan` / `Hash Join` plans. The plans set the "food quality" of every database node the slime mould can reach.
3. **Sonification.** A Web Audio FM and granular synthesizer turns network entropy, latency and flux into an ambient drone. Full-table scans add Geiger-counter clicks.
4. **Local Optimizer Agents.** Three deterministic in-app optimizer agents (`chimera-architect`, `index-surgeon`, `deadlock-hunter`) propose and apply composite indexes and N+1 batch rewrites inside the local lab sandbox.

Glossary:
- **Node**: a gateway, service, agent, database primary, replica, shard or cache in the routing graph.
- **Link**: an undirected edge with a latency (length) and an adaptive conductivity.
- **Query**: a SQL statement with a source node, candidate sink nodes and a call rate.
- **Sink resistance**: the per-query service latency of a sink, taken from its planned execution cost.
- **Flux**: Physarum flow through a link, summed over all queries.

---

## Requirement 1: Scoped template isolation
**User story:** As a developer, I want the template isolated so it never leaks into the host app.
1. THE SYSTEM SHALL keep all template source inside `packages/templates/src/neuro-chimera-synth/`.
2. WHEN `/preview/neuro-chimera-synth` renders, THE SYSTEM SHALL scope all styles to `[data-template-theme="neuro-chimera-synth"]`.
3. WHILE the template is previewed, THE SYSTEM SHALL collapse Studio Hub chrome into a corner bio-tag labelled `[ALT+G] GENUI STUDIO // EXPORT CHIMERA LAB`.

## Requirement 2: Bioluminescent laboratory palette
1. THE SYSTEM SHALL use `#020A0E`, `#00F5B8`, `#FFB000`, `#FF2A6D` and frosted-quartz panels `rgba(2, 18, 24, 0.78)` with `1px solid rgba(0, 245, 184, 0.25)` borders.
2. THE SYSTEM SHALL pair every colour-coded state with a text label or icon.
3. WHERE `prefers-reduced-motion: reduce` is set, THE SYSTEM SHALL stop glow pulses and particle trails.

## Requirement 3: Deterministic SQL parsing
1. THE SYSTEM SHALL parse this SELECT subset into an AST:
   - `DISTINCT`, column lists, `*` and `table.*`, and aliases
   - `INNER` / `LEFT` joins with `ON`
   - `WHERE` with `AND` / `OR` / `NOT`, comparisons, `IN (...)`, `= ANY(...)`, `BETWEEN`, `LIKE`, `IS [NOT] NULL`
   - function calls including `COUNT(*)`, and the pgvector distance operators `<->`, `<=>`, `<#>`
   - `GROUP BY`, `ORDER BY ... ASC|DESC`, `LIMIT`
   - string, number, `NULL`, boolean literals, and `$n` / `?` parameters
2. IF the input uses unsupported syntax, exceeds 8 KB, exceeds 2,000 tokens or nests deeper than 64 expressions, THEN THE SYSTEM SHALL throw `SqlParseError` with a character offset.
3. THE SYSTEM SHALL print any AST back to canonical SQL. Parsing printed SQL SHALL produce an equal AST.
4. THE SYSTEM SHALL use no `eval`, dynamic code or regex-based SQL rewriting.

## Requirement 4: Cost-based query planner
1. WHEN given a parsed query and table statistics (row count, pages, per-column distinct counts and indexes), THE SYSTEM SHALL produce a plan tree using `Seq Scan`, `Index Scan`, `Nested Loop`, `Hash Join`, `Hash`, `Sort`, `HashAggregate` and `Limit` nodes, each with startup cost, total cost and row estimates.
2. THE SYSTEM SHALL use PostgreSQL's default cost constants (`seq_page_cost 1`, `random_page_cost 4`, `cpu_tuple_cost 0.01`, `cpu_index_tuple_cost 0.005`, `cpu_operator_cost 0.0025`) and PostgreSQL's default selectivities when statistics are missing.
3. THE SYSTEM SHALL choose an index scan only when a predicate constrains the index's leading column, and choose the cheaper of index and sequential access.
4. WHEN a query orders by a pgvector distance operator with a matching HNSW index and a `LIMIT`, THE SYSTEM SHALL plan an approximate-nearest-neighbour index scan. Otherwise THE SYSTEM SHALL plan a sequential scan plus a top-N sort.
5. THE SYSTEM SHALL render the plan as PostgreSQL-style `EXPLAIN` text.
6. THE SYSTEM SHALL flag full-table scans over 10,000 rows, and recommend composite indexes in this order: equality columns, then the range column, then the sort column.

## Requirement 5: Physarum routing solver
1. THE SYSTEM SHALL model each query as current injected at its source node. Each candidate sink is grounded through a sink resistance equal to its planned service latency.
2. WHEN stepping the solver, THE SYSTEM SHALL solve the Kirchhoff pressure system per query, sum the absolute link flux over queries, and update conductivity with `D' = (D + dt·f(G·|Q|)) / (1 + dt)`, where `f(x) = xᵘ / (1 + xᵘ)` and `G = FLUX_GAIN = 4`.
3. THE SYSTEM SHALL keep conductivity at or above `MIN_CONDUCTIVITY` and exclude dead nodes and their links.
4. IF a query's source has no path to any live candidate sink, THEN THE SYSTEM SHALL mark that query as failed and never produce NaN.
5. THE SYSTEM SHALL raise sink resistance with load (`R / (1 − ρ)`, ρ capped at 0.95) and report saturated sinks.
6. THE SYSTEM SHALL report, per query:
   - flow-weighted latency (link latency plus sink latency)
   - the sink share per candidate
   - the dominant plan
   - per-request latency, including N+1 round trips
7. THE SYSTEM SHALL report network-wide flux, entropy (0–1), mean and worst latency, full-scan call rate, synapse firing (total conductivity change) and a health score.
8. THE SYSTEM SHALL be deterministic: the same scenario and the same sequence of operations give identical results.

## Requirement 6: Scenarios and interventions
1. THE SYSTEM SHALL ship seven scenarios with realistic schemas, statistics and queries:
   - Unindexed E-Commerce Checkout Spike
   - N+1 Social Feed Graph
   - Vector Embedding Shard Imbalance
   - Overnight Autonomous PR Refactor
   - Multi-Tenant Analytics Hot Partition
   - Ride-Hailing Dispatch Region Failover
   - Biotech Genomics Pipeline & Protein Fold Search
2. WHEN the user injects an index, THE SYSTEM SHALL add it to the dataset, re-plan every query on nodes that share that dataset, and return the DDL plus the before and after cost.
3. WHEN the user severs or revives a node, THE SYSTEM SHALL remove or restore it and its links. The network SHALL reroute on later steps.
4. WHEN the user runs the Optimizer Agent, THE SYSTEM SHALL deterministically:
   - apply the recommended indexes with the largest savings
   - rewrite N+1 queries into batched `= ANY($1)` queries through the AST printer
   - return an action log with SQL and cost deltas

## Requirement 7: Sonification
1. THE SYSTEM SHALL map telemetry to sound parameters with a pure function `mapTelemetryToSound()`:
   - Healthy networks give harmonic FM ratios and consonant intervals.
   - Unhealthy networks give inharmonic ratios and detuned partials.
   - Entropy raises FM modulation depth.
   - Flux opens the filter.
   - Synapse firing raises granular density.
   - Full-scan call rate sets the Geiger click rate, capped at `MAX_GEIGER_RATE`.
2. THE SYSTEM SHALL start audio only after `unlock()` from a user gesture, and provide mute, master volume and root frequency controls.
3. THE SYSTEM SHALL schedule grains and Geiger clicks with one look-ahead scheduler, and release all nodes on dispose.
4. THE SYSTEM SHALL no-op under SSR or when `AudioContext` is unavailable.

## Requirement 8: Local optimizer agent constellation
1. THE SYSTEM SHALL provide three deterministic local optimizer agents (`chimera-architect`, `index-surgeon`, `deadlock-hunter`) in `components/OptimizerAgentConstellation.tsx`.
2. Each agent SHALL display its strategy, previewed cron audit schedule (`nextCronRuns`), session change count, and a 1-click dispatch control.
3. All interventions SHALL be sandboxed to the local in-memory `PhysarumNetwork` and recorded with content-hash checkpoints; no external database or repository is ever mutated.

## Requirement 9: Interactive lab
1. THE SYSTEM SHALL render the network on a 60 FPS canvas with particle flux, plus HUD panels for plans, telemetry and the agent log.
2. THE SYSTEM SHALL register the lab components in a GenUI catalog with strict Zod props and remix presets.
3. THE SYSTEM SHALL verify solver bounds, planner index monotonicity, and catalog adversarial resilience with `fast-check` in `src/__tests__/chimera-lab.pbt.test.ts`.
4. THE SYSTEM SHALL list the template in Studio Hub and export it as a standalone MIT Next.js starter `.zip`.
