import type { StateModel } from "@json-render/core";
import { createTimeTravelStateStore } from "../state/time-travel-store.js";
import type { GraphIssue, TimeTravelStateStore } from "../types.js";
import {
  deepEqualInteractionValue,
  evaluateInteractionGuard,
} from "./guard-eval.js";
import {
  DEFAULT_MAX_TRANSITIONS_PER_STEP,
  sanitizeInteractionRules,
  type InteractionEvent,
  type InteractionRule,
  type OutcomeStatus,
  type SynthSoundCue,
} from "./rule-types.js";

export interface FiredRuleTrace {
  readonly stepId: number;
  readonly ruleId: string;
  readonly ruleLabel: string;
  readonly sourceSection?: string;
  readonly triggerType: InteractionRule["trigger"]["type"];
  readonly historyIndex: number;
  readonly changedPaths: readonly string[];
  readonly effectsSummary: readonly string[];
  readonly soundCues: readonly SynthSoundCue[];
  readonly outcomeAfter: OutcomeStatus;
  readonly timestamp: number;
}

export interface InteractionStepReport {
  readonly event: InteractionEvent;
  readonly firedRules: readonly FiredRuleTrace[];
  readonly soundCues: readonly SynthSoundCue[];
  readonly transitionsExecuted: number;
  readonly circuitBreakerTripped: boolean;
  readonly outcome: OutcomeStatus;
  readonly outcomeReason: string;
  readonly activeScene: string;
  readonly issues: readonly GraphIssue[];
}

export interface InteractionRuleEngineOptions {
  /** Existing TimeTravelStateStore to mutate (or a new one is created from initialState) */
  readonly store?: TimeTravelStateStore;
  /** Initial state when no store is provided */
  readonly initialState?: StateModel;
  /** Initial declarative rules (sanitized automatically) */
  readonly rules?: readonly InteractionRule[];
  /** Default scene ID stored at /experience/activeScene (default: "main") */
  readonly initialScene?: string;
  /** Per-event transition circuit breaker (default: 32) */
  readonly maxTransitionsPerStep?: number;
  /** Maximum fired-rule trace records kept in memory (default: 256) */
  readonly maxTraceEntries?: number;
  /** Optional procedural audio callback when playSynthSound effects execute */
  readonly onSynthSound?: (cue: SynthSoundCue) => void;
  /** Optional callback when /experience/outcome changes */
  readonly onOutcomeChange?: (outcome: OutcomeStatus, reason: string) => void;
}

export interface InteractionRuleEngine {
  readonly store: TimeTravelStateStore;
  /** Dispatch a user or timer interaction event and run matching + reactive rules */
  dispatch(event: InteractionEvent): InteractionStepReport;
  /** Replace the active ruleset safely (e.g. after AI reframing) without resetting state */
  setRules(nextRules: readonly unknown[]): readonly GraphIssue[];
  /** Return the current sanitized ruleset */
  getRules(): readonly InteractionRule[];
  /** Return chronological log of fired rules for live pulse visualization & debugging */
  getTraceLog(): readonly FiredRuleTrace[];
  /** Jump to a TimeTravelStateStore history index and restore once-rule eligibility up to that frame */
  scrubToHistoryIndex(historyIndex: number): boolean;
  /** Undo one snapshot and sync rule replay state */
  undo(): boolean;
  /** Redo one snapshot and sync rule replay state */
  redo(): boolean;
  /** Reset the experience store, trace log, and once-rule flags back to initial state */
  reset(): void;
  /** Read current /experience/outcome status */
  getOutcome(): { readonly status: OutcomeStatus; readonly reason: string };
  /** Read current /experience/activeScene */
  getActiveScene(): string;
  /** Total times the infinite-loop circuit breaker tripped */
  getCircuitBreakerTripCount(): number;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function triggerMatchesEvent(
  trigger: InteractionRule["trigger"],
  event: InteractionEvent,
): boolean {
  if (trigger.type === "onStateMatch" || trigger.type !== event.type) {
    return false;
  }
  switch (trigger.type) {
    case "onClick":
    case "onHover":
    case "onDragStart":
      return trigger.elementKey === (event as { elementKey: string }).elementKey;
    case "onDrop": {
      const dropEvt = event as Extract<InteractionEvent, { type: "onDrop" }>;
      if (trigger.targetElementKey !== dropEvt.targetElementKey) return false;
      if (trigger.sourceElementKey && trigger.sourceElementKey !== dropEvt.sourceElementKey) {
        return false;
      }
      return true;
    }
    case "onKeyPress": {
      const keyEvt = event as Extract<InteractionEvent, { type: "onKeyPress" }>;
      return trigger.key.toLowerCase() === keyEvt.key.toLowerCase();
    }
    case "onEnterZone": {
      const zoneEvt = event as Extract<InteractionEvent, { type: "onEnterZone" }>;
      if (trigger.zoneKey !== zoneEvt.zoneKey) return false;
      if (trigger.entityKey && trigger.entityKey !== zoneEvt.entityKey) return false;
      return true;
    }
    case "onTimerTick": {
      const tickEvt = event as Extract<InteractionEvent, { type: "onTimerTick" }>;
      if (trigger.timerId && trigger.timerId !== tickEvt.timerId) return false;
      return true;
    }
    case "onEvent": {
      const customEvt = event as Extract<InteractionEvent, { type: "onEvent" }>;
      return trigger.eventName === customEvt.eventName;
    }
    default:
      return false;
  }
}

function readExperienceEnvelope(
  store: TimeTravelStateStore,
  fallbackScene: string,
): { outcome: OutcomeStatus; reason: string; activeScene: string } {
  const rawOutcome = store.get("/experience/outcome");
  const outcome: OutcomeStatus =
    rawOutcome === "win" ||
    rawOutcome === "lose" ||
    rawOutcome === "complete" ||
    rawOutcome === "playing"
      ? rawOutcome
      : "playing";
  const rawReason = store.get("/experience/outcomeReason");
  const reason = typeof rawReason === "string" ? rawReason : "";
  const rawScene = store.get("/experience/activeScene");
  const activeScene =
    typeof rawScene === "string" && rawScene.length > 0 ? rawScene : fallbackScene;
  return { outcome, reason, activeScene };
}

function ensureInitialExperienceState(
  base: StateModel | undefined,
  initialScene: string,
): StateModel {
  const existingExp =
    base &&
    typeof base.experience === "object" &&
    base.experience !== null &&
    !Array.isArray(base.experience)
      ? (base.experience as Record<string, unknown>)
      : {};
  return {
    ...(base ?? {}),
    experience: {
      activeScene: initialScene,
      outcome: "playing",
      outcomeReason: "",
      tick: 0,
      lastEvent: "",
      ...existingExp,
    },
  };
}

/**
 * Bounded, deterministic Interaction Rule Engine powered by `TimeTravelStateStore`.
 *
 * Guarantees:
 * - Zero `eval` / dynamic code execution (pure JSON Trigger -> Guard -> Effect IR).
 * - Hard per-step transition budget (`maxTransitionsPerStep`, default 32) preventing infinite loops.
 * - Full time-travel correlation: scrubbing history via `scrubToHistoryIndex()` restores state
 *   AND `once: true` rule eligibility at any past playtest frame.
 */
export function createInteractionRuleEngine(
  options: InteractionRuleEngineOptions = {},
): InteractionRuleEngine {
  const initialScene = options.initialScene ?? "main";
  const maxTransitionsPerStep = Math.max(
    1,
    Math.min(256, options.maxTransitionsPerStep ?? DEFAULT_MAX_TRANSITIONS_PER_STEP),
  );
  const maxTraceEntries = Math.max(16, options.maxTraceEntries ?? 256);

  const initialSeedState = ensureInitialExperienceState(
    options.store ? options.store.getSnapshot() : options.initialState,
    initialScene,
  );
  const store = options.store ?? createTimeTravelStateStore(initialSeedState);

  if (options.store && store.get("/experience/outcome") === undefined) {
    store.update({
      "/experience/activeScene": initialScene,
      "/experience/outcome": "playing",
      "/experience/outcomeReason": "",
      "/experience/tick": 0,
    });
  }

  let rules: readonly InteractionRule[] = sanitizeInteractionRules(
    options.rules ?? [],
  ).rules;
  let traceLog: FiredRuleTrace[] = [];
  let firedOnceRules = new Set<string>();
  let activeStateMatchIds = new Set<string>();
  let stepCounter = 0;
  let circuitBreakerTrips = 0;

  function recomputeStateMatchEdges(): void {
    const nextActive = new Set<string>();
    for (const rule of rules) {
      if (rule.enabled === false || rule.trigger.type !== "onStateMatch") continue;
      const guards = rule.guards ?? [];
      if (
        guards.length > 0 &&
        guards.every((g) => evaluateInteractionGuard(g, store))
      ) {
        nextActive.add(rule.id);
      }
    }
    activeStateMatchIds = nextActive;
  }

  recomputeStateMatchEdges();

  function syncReplayStateToCurrentCursor(): void {
    const cursor = store.getCurrentHistoryIndex();
    const rebuiltOnce = new Set<string>();
    for (const trace of traceLog) {
      if (trace.historyIndex <= cursor) {
        const rule = rules.find((r) => r.id === trace.ruleId);
        if (rule?.once) {
          rebuiltOnce.add(rule.id);
        }
      }
    }
    firedOnceRules = rebuiltOnce;
    recomputeStateMatchEdges();
  }

  function applyRuleEffects(
    rule: InteractionRule,
    queuedEvents: InteractionEvent[],
    stepSoundCues: SynthSoundCue[],
  ): {
    changedPaths: string[];
    effectsSummary: string[];
    ruleSoundCues: SynthSoundCue[];
    requestedReset: boolean;
  } {
    const updates: Record<string, unknown> = {};
    const changedPaths: string[] = [];
    const effectsSummary: string[] = [];
    const ruleSoundCues: SynthSoundCue[] = [];
    let requestedReset = false;

    const readWorkingValue = (path: string): unknown =>
      Object.prototype.hasOwnProperty.call(updates, path)
        ? updates[path]
        : store.get(path);

    for (const effect of rule.effects) {
      switch (effect.type) {
        case "set": {
          updates[effect.path] = effect.value;
          changedPaths.push(effect.path);
          effectsSummary.push(`set ${effect.path} = ${JSON.stringify(effect.value)}`);
          break;
        }
        case "inc": {
          const current = asFiniteNumber(readWorkingValue(effect.path), 0);
          const delta = effect.by ?? 1;
          let next = current + delta;
          if (effect.max !== undefined) next = Math.min(effect.max, next);
          updates[effect.path] = Object.is(next, -0) ? 0 : next;
          changedPaths.push(effect.path);
          effectsSummary.push(`inc ${effect.path} -> ${updates[effect.path]}`);
          break;
        }
        case "dec": {
          const current = asFiniteNumber(readWorkingValue(effect.path), 0);
          const delta = effect.by ?? 1;
          let next = current - delta;
          if (effect.min !== undefined) next = Math.max(effect.min, next);
          updates[effect.path] = Object.is(next, -0) ? 0 : next;
          changedPaths.push(effect.path);
          effectsSummary.push(`dec ${effect.path} -> ${updates[effect.path]}`);
          break;
        }
        case "toggle": {
          const current = Boolean(readWorkingValue(effect.path));
          updates[effect.path] = !current;
          changedPaths.push(effect.path);
          effectsSummary.push(`toggle ${effect.path} -> ${!current}`);
          break;
        }
        case "append": {
          const existing = readWorkingValue(effect.path);
          const arr = Array.isArray(existing) ? [...existing] : [];
          arr.push(effect.value);
          const bounded =
            effect.maxLength !== undefined && arr.length > effect.maxLength
              ? arr.slice(arr.length - effect.maxLength)
              : arr;
          updates[effect.path] = bounded;
          changedPaths.push(effect.path);
          effectsSummary.push(`append ${effect.path}`);
          break;
        }
        case "remove": {
          const existing = readWorkingValue(effect.path);
          if (Array.isArray(existing)) {
            updates[effect.path] = existing.filter(
              (item) => !deepEqualInteractionValue(item, effect.value),
            );
            changedPaths.push(effect.path);
            effectsSummary.push(`remove ${effect.path}`);
          }
          break;
        }
        case "navigateScene": {
          updates["/experience/activeScene"] = effect.sceneId;
          changedPaths.push("/experience/activeScene");
          effectsSummary.push(`scene -> ${effect.sceneId}`);
          break;
        }
        case "playSynthSound": {
          ruleSoundCues.push(effect.cue);
          stepSoundCues.push(effect.cue);
          options.onSynthSound?.(effect.cue);
          effectsSummary.push(`sound:${effect.cue}`);
          break;
        }
        case "setOutcome": {
          updates["/experience/outcome"] = effect.outcome;
          updates["/experience/outcomeReason"] = effect.reason ?? "";
          changedPaths.push("/experience/outcome", "/experience/outcomeReason");
          effectsSummary.push(`outcome -> ${effect.outcome}`);
          break;
        }
        case "emitEvent": {
          queuedEvents.push({
            type: "onEvent",
            eventName: effect.eventName,
            ...(effect.payload ? { payload: effect.payload } : {}),
          });
          effectsSummary.push(`emit:${effect.eventName}`);
          break;
        }
        case "resetExperience": {
          requestedReset = true;
          effectsSummary.push("resetExperience");
          break;
        }
      }
    }

    if (requestedReset) {
      store.reset(initialSeedState);
      firedOnceRules = new Set<string>();
      activeStateMatchIds = new Set<string>();
    } else if (Object.keys(updates).length > 0) {
      store.update(updates);
    }

    return { changedPaths, effectsSummary, ruleSoundCues, requestedReset };
  }

  return {
    store,

    dispatch(event: InteractionEvent): InteractionStepReport {
      const prevOutcome = readExperienceEnvelope(store, initialScene).outcome;
      const queuedEvents: InteractionEvent[] = [event];
      const firedRules: FiredRuleTrace[] = [];
      const soundCues: SynthSoundCue[] = [];
      const issues: GraphIssue[] = [];
      let transitionsExecuted = 0;
      let circuitBreakerTripped = false;

      if (event.type === "onTimerTick") {
        const nextTick = asFiniteNumber(store.get("/experience/tick"), 0) + 1;
        store.set("/experience/tick", nextTick);
      }

      const executeRule = (rule: InteractionRule): boolean => {
        if (transitionsExecuted >= maxTransitionsPerStep) {
          circuitBreakerTripped = true;
          circuitBreakerTrips += 1;
          issues.push({
            severity: "error",
            code: "rule_budget_exceeded",
            elementKey: rule.id,
            message: `Interaction rule engine tripped circuit breaker after ${maxTransitionsPerStep} transitions in one step (stopped before "${rule.id}").`,
          });
          return false;
        }

        if (rule.once && firedOnceRules.has(rule.id)) {
          return true;
        }

        const guards = rule.guards ?? [];
        const allGuardsPass = guards.every((g) => evaluateInteractionGuard(g, store));
        if (!allGuardsPass) {
          return true;
        }

        transitionsExecuted += 1;
        if (rule.once) {
          firedOnceRules.add(rule.id);
        }

        const { changedPaths, effectsSummary, ruleSoundCues } = applyRuleEffects(
          rule,
          queuedEvents,
          soundCues,
        );
        const envAfter = readExperienceEnvelope(store, initialScene);

        stepCounter += 1;
        const trace: FiredRuleTrace = {
          stepId: stepCounter,
          ruleId: rule.id,
          ruleLabel: rule.label,
          ...(rule.sourceSection ? { sourceSection: rule.sourceSection } : {}),
          triggerType: rule.trigger.type,
          historyIndex: store.getCurrentHistoryIndex(),
          changedPaths,
          effectsSummary,
          soundCues: ruleSoundCues,
          outcomeAfter: envAfter.outcome,
          timestamp: Date.now(),
        };
        firedRules.push(trace);
        traceLog.push(trace);
        if (traceLog.length > maxTraceEntries) {
          traceLog = traceLog.slice(traceLog.length - maxTraceEntries);
        }

        return true;
      };

      // Drain direct + emitted events, checking edge-triggered onStateMatch rules after each wave.
      while (queuedEvents.length > 0 && !circuitBreakerTripped) {
        const currentEvent = queuedEvents.shift()!;
        for (const rule of rules) {
          if (rule.enabled === false) continue;
          if (!triggerMatchesEvent(rule.trigger, currentEvent)) continue;
          if (!executeRule(rule)) break;
        }

        let stateMatchProgress = true;
        while (stateMatchProgress && !circuitBreakerTripped) {
          stateMatchProgress = false;
          for (const rule of rules) {
            if (rule.enabled === false || rule.trigger.type !== "onStateMatch") {
              continue;
            }
            const guards = rule.guards ?? [];
            const matchesNow =
              guards.length > 0 &&
              guards.every((g) => evaluateInteractionGuard(g, store));

            if (!matchesNow) {
              activeStateMatchIds.delete(rule.id);
              continue;
            }
            if (activeStateMatchIds.has(rule.id)) {
              continue;
            }
            activeStateMatchIds.add(rule.id);
            stateMatchProgress = true;
            if (!executeRule(rule)) break;
          }
        }
      }

      const finalEnv = readExperienceEnvelope(store, initialScene);
      if (finalEnv.outcome !== prevOutcome) {
        options.onOutcomeChange?.(finalEnv.outcome, finalEnv.reason);
      }

      return {
        event,
        firedRules,
        soundCues,
        transitionsExecuted,
        circuitBreakerTripped,
        outcome: finalEnv.outcome,
        outcomeReason: finalEnv.reason,
        activeScene: finalEnv.activeScene,
        issues,
      };
    },

    setRules(nextRules: readonly unknown[]): readonly GraphIssue[] {
      const result = sanitizeInteractionRules(nextRules);
      rules = result.rules;
      recomputeStateMatchEdges();
      return result.issues;
    },

    getRules(): readonly InteractionRule[] {
      return rules;
    },

    getTraceLog(): readonly FiredRuleTrace[] {
      return traceLog;
    },

    scrubToHistoryIndex(historyIndex: number): boolean {
      const ok = store.jumpToSnapshot(historyIndex);
      if (ok) {
        syncReplayStateToCurrentCursor();
      }
      return ok;
    },

    undo(): boolean {
      const ok = store.undo();
      if (ok) {
        syncReplayStateToCurrentCursor();
      }
      return ok;
    },

    redo(): boolean {
      const ok = store.redo();
      if (ok) {
        syncReplayStateToCurrentCursor();
      }
      return ok;
    },

    reset(): void {
      store.reset(initialSeedState);
      traceLog = [];
      firedOnceRules = new Set<string>();
      recomputeStateMatchEdges();
    },

    getOutcome(): { readonly status: OutcomeStatus; readonly reason: string } {
      const env = readExperienceEnvelope(store, initialScene);
      return { status: env.outcome, reason: env.reason };
    },

    getActiveScene(): string {
      return readExperienceEnvelope(store, initialScene).activeScene;
    },

    getCircuitBreakerTripCount(): number {
      return circuitBreakerTrips;
    },
  };
}
