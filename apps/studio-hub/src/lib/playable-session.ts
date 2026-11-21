import {
  createInteractionRuleEngine,
  createWebAudioSynth,
  type FiredRuleTrace,
  type GraphIssue,
  type InteractionEvent,
  type InteractionRule,
  type InteractionRuleEngine,
  type InteractionStepReport,
  type OutcomeStatus,
  type SynthSoundCue,
  type TimeTravelStateStore,
  type WebAudioSynth,
} from "@genui-studio/core";
import {
  fuzzPlaytestSpec,
  type PlaytestFuzzReport,
} from "@genui-studio/core/testing";
import { PLAYABLE_FUZZ_SETTINGS, type PlayableBlueprint } from "./playable-starter.js";

const RECENT_TRACE_LIMIT = 10;

/** Snapshot read by React through `useSyncExternalStore`. Replaced on every change. */
export interface PlayableSessionView {
  readonly version: number;
  /** Changes whenever a new blueprint is loaded (new engine + store). */
  readonly engineId: number;
  readonly outcome: OutcomeStatus;
  readonly outcomeReason: string;
  readonly scene: string;
  readonly historyIndex: number;
  readonly historyLength: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Rules fired by the most recent dispatch (drives the flow-map pulse). */
  readonly lastFired: readonly FiredRuleTrace[];
  /** Increments on every dispatch that fired at least one rule. */
  readonly pulseId: number;
  readonly lastEvent: InteractionEvent | null;
  readonly recentTrace: readonly FiredRuleTrace[];
  readonly firedCounts: Readonly<Record<string, number>>;
  readonly dispatchCount: number;
  readonly circuitBreakerTrips: number;
  readonly muted: boolean;
}

/**
 * Owns the interaction rule engine, its TimeTravelStateStore and the Web Audio synth for
 * one workbench session. All domain state lives in the store; React only reads `getView()`.
 */
export interface PlayableSession {
  getBlueprint(): PlayableBlueprint;
  getStore(): TimeTravelStateStore;
  getEngine(): InteractionRuleEngine;
  getView(): PlayableSessionView;
  subscribe(listener: () => void): () => void;
  dispatch(event: InteractionEvent): InteractionStepReport;
  /** Replace the blueprint (macro, LLM stream, rule edit) and start a fresh engine. */
  load(blueprint: PlayableBlueprint): void;
  /** Replace the rules without resetting state; returns sanitizer issues. */
  setRules(rules: readonly unknown[]): readonly GraphIssue[];
  scrubTo(historyIndex: number): boolean;
  undo(): boolean;
  redo(): boolean;
  reset(): void;
  setMuted(muted: boolean): void;
  /** Release the AudioContext. The session stays usable and recreates it on demand. */
  dispose(): void;
}

export interface PlayableSessionOptions {
  readonly muted?: boolean;
  /** Override for tests; defaults to `createWebAudioSynth()`. */
  readonly createSynth?: () => WebAudioSynth;
}

export function createPlayableSession(
  initial: PlayableBlueprint,
  options: PlayableSessionOptions = {},
): PlayableSession {
  const listeners = new Set<() => void>();
  let muted = Boolean(options.muted);
  let synth: WebAudioSynth | null = null;

  let blueprint = initial;
  let engine: InteractionRuleEngine;
  let unsubscribeStore: () => void = () => {};
  let engineId = 0;
  let version = 0;
  let lastFired: readonly FiredRuleTrace[] = [];
  let lastEvent: InteractionEvent | null = null;
  let pulseId = 0;
  let dispatchCount = 0;
  let view: PlayableSessionView | null = null;

  const playCue = (cue: SynthSoundCue) => {
    if (muted) return;
    if (!synth) synth = (options.createSynth ?? createWebAudioSynth)();
    synth.play(cue);
  };

  const changed = () => {
    version += 1;
    view = null;
    for (const listener of [...listeners]) listener();
  };

  const startEngine = (next: PlayableBlueprint) => {
    unsubscribeStore();
    engine = createInteractionRuleEngine({
      initialState: structuredClone(next.spec.state ?? {}),
      rules: next.rules,
      initialScene: next.initialScene,
      onSynthSound: playCue,
    });
    blueprint = { ...next, rules: engine.getRules() };
    unsubscribeStore = engine.store.subscribe(changed);
    engineId += 1;
    lastFired = [];
    lastEvent = null;
  };

  startEngine(initial);

  const buildView = (): PlayableSessionView => {
    const store = engine.store;
    const outcome = engine.getOutcome();
    const trace = engine.getTraceLog();
    const cursor = store.getCurrentHistoryIndex();
    const firedCounts: Record<string, number> = {};
    for (const entry of trace) {
      if (entry.historyIndex > cursor) continue;
      firedCounts[entry.ruleId] = (firedCounts[entry.ruleId] ?? 0) + 1;
    }
    return {
      version,
      engineId,
      outcome: outcome.status,
      outcomeReason: outcome.reason,
      scene: engine.getActiveScene(),
      historyIndex: cursor,
      historyLength: store.getHistory().length,
      canUndo: store.canUndo(),
      canRedo: store.canRedo(),
      lastFired,
      pulseId,
      lastEvent,
      recentTrace: trace.slice(-RECENT_TRACE_LIMIT),
      firedCounts,
      dispatchCount,
      circuitBreakerTrips: engine.getCircuitBreakerTripCount(),
      muted,
    };
  };

  return {
    getBlueprint: () => blueprint,
    getStore: () => engine.store,
    getEngine: () => engine,

    getView() {
      if (!view) view = buildView();
      return view;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(event) {
      const report = engine.dispatch(event);
      dispatchCount += 1;
      lastEvent = event;
      if (report.firedRules.length > 0) {
        lastFired = report.firedRules;
        pulseId += 1;
      }
      changed();
      return report;
    },

    load(next) {
      startEngine(next);
      changed();
    },

    setRules(rules) {
      const issues = engine.setRules(rules);
      blueprint = { ...blueprint, rules: engine.getRules() };
      changed();
      return issues;
    },

    scrubTo(historyIndex) {
      const ok = engine.scrubToHistoryIndex(historyIndex);
      if (ok) {
        lastFired = [];
        changed();
      }
      return ok;
    },

    undo() {
      const ok = engine.undo();
      if (ok) changed();
      return ok;
    },

    redo() {
      const ok = engine.redo();
      if (ok) changed();
      return ok;
    },

    reset() {
      engine.reset();
      lastFired = [];
      lastEvent = null;
      changed();
    },

    setMuted(next) {
      muted = next;
      synth?.setMuted(next);
      changed();
    },

    dispose() {
      synth?.dispose();
      synth = null;
    },
  };
}

/** "Verify Winnability": fuzzes the blueprint and requires a reachable `win`. */
export function verifyWinnability(blueprint: PlayableBlueprint): PlaytestFuzzReport {
  return fuzzPlaytestSpec({
    initialState: structuredClone(blueprint.spec.state ?? {}),
    rules: blueprint.rules as readonly InteractionRule[],
    initialScene: blueprint.initialScene,
    numRuns: PLAYABLE_FUZZ_SETTINGS.numRuns,
    seed: PLAYABLE_FUZZ_SETTINGS.seed,
    maxStepsPerRun: PLAYABLE_FUZZ_SETTINGS.maxStepsPerRun,
    requireReachableOutcomes: ["win"],
  });
}
