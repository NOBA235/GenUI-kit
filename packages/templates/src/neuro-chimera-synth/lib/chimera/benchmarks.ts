/**
 * Scenario benchmarks for the landing page (`lib/chimera/benchmarks.ts`).
 *
 * Each row runs a scenario through the real solver: a few steps so load builds up, then the
 * deterministic optimizer agent, then a few more steps. Numbers are simulator estimates from
 * the planner's cost model, not measurements of a real database.
 */

import type { NetworkTelemetry } from "./bio-solver.js";
import { CHIMERA_SCENARIOS, createScenarioNetwork } from "./scenarios.js";

export interface BenchmarkSnapshot {
  readonly meanRequestLatencyMs: number;
  readonly worstRequestLatencyMs: number;
  readonly fullScanRate: number;
  readonly costUnitsPerSecond: number;
  readonly health: number;
  readonly timedOutQueries: number;
}

export interface ScenarioBenchmark {
  readonly scenarioId: string;
  readonly title: string;
  readonly before: BenchmarkSnapshot;
  readonly after: BenchmarkSnapshot;
  /** SQL the optimizer agent applied (index DDL and batched rewrites). */
  readonly actions: readonly string[];
}

export const BENCHMARK_WARMUP_STEPS = 8;

function snapshot(t: NetworkTelemetry): BenchmarkSnapshot {
  return {
    meanRequestLatencyMs: t.meanRequestLatencyMs,
    worstRequestLatencyMs: t.worstRequestLatencyMs,
    fullScanRate: t.fullScanRate,
    costUnitsPerSecond: t.costUnitsPerSecond,
    health: t.health,
    timedOutQueries: t.timedOutQueries,
  };
}

export function benchmarkScenario(scenarioId: string): ScenarioBenchmark {
  const network = createScenarioNetwork(scenarioId);
  const before = snapshot(network.step(BENCHMARK_WARMUP_STEPS));
  const report = network.runOptimizerAgent();
  const after = snapshot(network.step(BENCHMARK_WARMUP_STEPS));
  const title = CHIMERA_SCENARIOS.find((s) => s.id === scenarioId)?.title ?? scenarioId;
  return { scenarioId, title, before, after, actions: report.actions.flatMap((a) => (a.sql ? [a.sql] : [])) };
}

let cached: readonly ScenarioBenchmark[] | null = null;

/** Benchmarks for every scenario, computed once per process (deterministic, so safe to cache). */
export function getScenarioBenchmarks(): readonly ScenarioBenchmark[] {
  if (!cached) cached = CHIMERA_SCENARIOS.map((s) => benchmarkScenario(s.id));
  return cached;
}
