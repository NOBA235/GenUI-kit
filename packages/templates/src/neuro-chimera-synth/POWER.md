---
name: "neuro-chimera-synth"
displayName: "CHIMERA // LAB — Bio-Digital SQL Synthesizer & Kiro Crew Agent Hive"
description: "Physarum slime-mould simulation of database query traffic with a deterministic SQL parser and cost planner, before/after EXPLAIN comparison, an installable Kiro Crew app with three database agents, and telemetry sonification."
keywords: ["postgres", "sql", "query-planner", "explain", "indexes", "n+1", "kiro-crew", "physarum", "web-audio"]
---

# CHIMERA // LAB Kiro Power

## Onboarding
1. Install the template: `npx genui-studio add neuro-chimera-synth`.
2. Read `.kiro/specs/neuro-chimera-synth/design.md` for the solver, planner and sonification models.
3. Steering for this directory lives in `.kiro/steering/chimera-frankenstein-rules.md`.
4. To run the agents for real, install `kiro-crew-app/` with `kirocrew app install /absolute/path/to/kiro-crew-app`, trust it, then `kirocrew app enable chimera-lab`.

## Common tasks
- **Add a scenario:** append a `ScenarioSpec` to `CHIMERA_SCENARIOS` in `lib/chimera/scenarios.ts`, then run the property tests.
- **Support more SQL:** extend the parser and printer together, then the planner. Unsupported syntax must keep throwing `SqlParseError`.
- **Change an agent:** edit `kiro-crew-app/agents/*.json`, then run `scripts/embed-crew-app.mjs`.
- **Verify:** `pnpm --filter @genui-studio/templates exec vitest run src/__tests__/chimera-lab.pbt.test.ts`.

## Guarantees
- The solver never produces NaN or infinite values; unreachable queries are reported as failed.
- Adding a recommended index never raises a query's planned cost.
- Corrupted or cyclic streamed packets are healed or quarantined without crashing the page.
- Audio starts only after a user gesture and can be muted.
