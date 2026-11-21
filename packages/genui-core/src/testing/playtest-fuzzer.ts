import * as fc from "fast-check";
import type { StateModel } from "@json-render/core";
import { createInteractionRuleEngine } from "../interaction/rule-engine.js";
import type {
  InteractionEvent,
  InteractionRule,
  OutcomeStatus,
} from "../interaction/rule-types.js";

export interface DeadRuleDiagnostic {
  readonly id: string;
  readonly label: string;
  readonly sourceSection?: string;
}

export interface PlaytestFuzzOptions {
  readonly initialState?: StateModel;
  readonly rules: readonly InteractionRule[];
  readonly initialScene?: string;
  /** Number of randomized playtest sessions to simulate (default: 100) */
  readonly numRuns?: number;
  /** Maximum user actions per playtest session (default: 24) */
  readonly maxStepsPerRun?: number;
  /** Deterministic PRNG seed for reproducible reports (default: 42) */
  readonly seed?: number;
  /** Optional outcomes that must be reachable for `passed` to be true */
  readonly requireReachableOutcomes?: readonly OutcomeStatus[];
  /** Extra action vocabulary entries beyond triggers extracted from `rules` */
  readonly extraEvents?: readonly InteractionEvent[];
}

export interface PlaytestFuzzReport {
  readonly passed: boolean;
  readonly totalRuns: number;
  readonly totalEventsDispatched: number;
  readonly unhandledExceptions: number;
  readonly circuitBreakerTrips: number;
  readonly outcomesReached: Readonly<Record<OutcomeStatus, number>>;
  /** Minimal verified action sequence discovered for each reachable outcome */
  readonly shortestTraces: Readonly<
    Record<OutcomeStatus, readonly InteractionEvent[] | null>
  >;
  readonly scenesVisited: readonly string[];
  readonly rulesFiredCounts: Readonly<Record<string, number>>;
  /** Enabled rules that never fired across all fuzzed sessions */
  readonly deadRules: readonly DeadRuleDiagnostic[];
  readonly durationMs: number;
}

/**
 * Extracts every actionable trigger event implied by a declarative ruleset so the
 * fuzzer generates realistic clicks, drag-and-drop gestures, keypresses, zone entries,
 * and timer ticks without hand-written scripts.
 */
export function extractActionVocabulary(
  rules: readonly InteractionRule[],
  extraEvents: readonly InteractionEvent[] = [],
): readonly InteractionEvent[] {
  const seen = new Set<string>();
  const events: InteractionEvent[] = [];

  const pushUnique = (event: InteractionEvent) => {
    const key = JSON.stringify(event);
    if (seen.has(key)) return;
    seen.add(key);
    events.push(event);
  };

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const t = rule.trigger;
    switch (t.type) {
      case "onClick":
        pushUnique({ type: "onClick", elementKey: t.elementKey });
        break;
      case "onHover":
        pushUnique({ type: "onHover", elementKey: t.elementKey });
        break;
      case "onDragStart":
        pushUnique({ type: "onDragStart", elementKey: t.elementKey });
        break;
      case "onDrop":
        pushUnique({
          type: "onDrop",
          sourceElementKey: t.sourceElementKey ?? "draggable-item",
          targetElementKey: t.targetElementKey,
        });
        break;
      case "onKeyPress":
        pushUnique({ type: "onKeyPress", key: t.key });
        break;
      case "onEnterZone":
        pushUnique({
          type: "onEnterZone",
          ...(t.entityKey ? { entityKey: t.entityKey } : {}),
          zoneKey: t.zoneKey,
        });
        break;
      case "onTimerTick":
        pushUnique({
          type: "onTimerTick",
          ...(t.timerId ? { timerId: t.timerId } : {}),
        });
        break;
      case "onEvent":
      case "onStateMatch":
        break;
    }
  }

  for (const extra of extraEvents) {
    pushUnique(extra);
  }

  return events;
}

/**
 * Automated Playtest Fuzzer ("Verify Winnability / Behavioral Contract Auditor"):
 * Uses `fast-check` to generate randomized sequences of user interactions against
 * a declarative ruleset, returning verified `shortestTraces` for reachable outcomes
 * (`win`, `lose`, `complete`), circuit-breaker trips, and `deadRules` that never fired.
 */
export function fuzzPlaytestSpec(
  options: PlaytestFuzzOptions,
): PlaytestFuzzReport {
  const startMs = performance.now();
  const numRuns = Math.max(1, Math.min(1000, options.numRuns ?? 100));
  const maxStepsPerRun = Math.max(1, Math.min(100, options.maxStepsPerRun ?? 24));
  const seed = options.seed ?? 42;

  const vocabulary = extractActionVocabulary(options.rules, options.extraEvents);
  const outcomesReached: Record<OutcomeStatus, number> = {
    playing: 0,
    win: 0,
    lose: 0,
    complete: 0,
  };
  const shortestTraces: Record<OutcomeStatus, readonly InteractionEvent[] | null> = {
    playing: [],
    win: null,
    lose: null,
    complete: null,
  };
  const scenesVisited = new Set<string>([options.initialScene ?? "main"]);
  const rulesFiredCounts: Record<string, number> = {};
  for (const rule of options.rules) {
    rulesFiredCounts[rule.id] = 0;
  }

  let totalEventsDispatched = 0;
  let unhandledExceptions = 0;
  let circuitBreakerTrips = 0;

  if (vocabulary.length === 0) {
    return {
      passed: (options.requireReachableOutcomes ?? []).every(
        (o) => o === "playing",
      ),
      totalRuns: numRuns,
      totalEventsDispatched: 0,
      unhandledExceptions: 0,
      circuitBreakerTrips: 0,
      outcomesReached: { ...outcomesReached, playing: numRuns },
      shortestTraces,
      scenesVisited: [...scenesVisited],
      rulesFiredCounts,
      deadRules: options.rules
        .filter((r) => r.enabled !== false)
        .map((r) => ({
          id: r.id,
          label: r.label,
          ...(r.sourceSection ? { sourceSection: r.sourceSection } : {}),
        })),
      durationMs: Number((performance.now() - startMs).toFixed(2)),
    };
  }

  const eventSeqArb = fc.array(fc.constantFrom(...vocabulary), {
    minLength: 1,
    maxLength: maxStepsPerRun,
  });
  const sequences = fc.sample(eventSeqArb, { numRuns, seed });

  for (const seq of sequences) {
    const engine = createInteractionRuleEngine({
      initialState: options.initialState,
      rules: options.rules,
      initialScene: options.initialScene,
    });
    const taken: InteractionEvent[] = [];

    for (const evt of seq) {
      taken.push(evt);
      totalEventsDispatched += 1;
      try {
        const report = engine.dispatch(evt);
        scenesVisited.add(report.activeScene);
        if (report.circuitBreakerTripped) {
          circuitBreakerTrips += 1;
        }
        for (const fired of report.firedRules) {
          rulesFiredCounts[fired.ruleId] = (rulesFiredCounts[fired.ruleId] ?? 0) + 1;
        }
        if (
          report.outcome === "win" ||
          report.outcome === "lose" ||
          report.outcome === "complete"
        ) {
          const existing = shortestTraces[report.outcome];
          if (!existing || taken.length < existing.length) {
            shortestTraces[report.outcome] = [...taken];
          }
          break;
        }
      } catch {
        unhandledExceptions += 1;
        break;
      }
    }

    const finalOutcome = engine.getOutcome().status;
    outcomesReached[finalOutcome] += 1;
  }

  const deadRules: DeadRuleDiagnostic[] = options.rules
    .filter((r) => r.enabled !== false && (rulesFiredCounts[r.id] ?? 0) === 0)
    .map((r) => ({
      id: r.id,
      label: r.label,
      ...(r.sourceSection ? { sourceSection: r.sourceSection } : {}),
    }));

  const requiredMet = (options.requireReachableOutcomes ?? []).every(
    (status) => outcomesReached[status] > 0,
  );

  return {
    passed: unhandledExceptions === 0 && requiredMet,
    totalRuns: sequences.length,
    totalEventsDispatched,
    unhandledExceptions,
    circuitBreakerTrips,
    outcomesReached,
    shortestTraces,
    scenesVisited: [...scenesVisited],
    rulesFiredCounts,
    deadRules,
    durationMs: Number((performance.now() - startMs).toFixed(2)),
  };
}
