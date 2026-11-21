import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
  createInteractionRuleEngine,
  createWebAudioSynth,
  evaluateInteractionGuard,
  sanitizeInteractionRules,
  type InteractionEvent,
  type InteractionRule,
  type MinimalAudioContext,
  type SynthSoundCue,
} from "../index.js";
import {
  extractActionVocabulary,
  fuzzPlaytestSpec,
} from "../testing/index.js";

/**
 * Playable micro-system fixture: "Retro Cassette Focus Desk"
 * Exercises onDrop, onClick, onKeyPress, onEnterZone, onTimerTick, onStateMatch,
 * guards, once-rules, scene navigation, synth audio cues, and win/lose outcomes.
 */
function buildCassetteDeskRules(): InteractionRule[] {
  return [
    {
      id: "load-tape",
      label: "Load Cassette Tape onto Deck",
      sourceSection: "## 2. Desk Setup",
      trigger: {
        type: "onDrop",
        sourceElementKey: "tape-lofi",
        targetElementKey: "cassette-deck",
      },
      effects: [
        { type: "set", path: "/desk/tapeLoaded", value: true },
        { type: "set", path: "/desk/ambientTrack", value: "rainy-synth-94" },
        { type: "append", path: "/desk/log", value: "loaded-lofi", maxLength: 10 },
        { type: "playSynthSound", cue: "drop" },
      ],
    },
    {
      id: "start-focus",
      label: "Start Focus Timer",
      sourceSection: "## 3. Focus Loop",
      once: true,
      trigger: { type: "onClick", elementKey: "btn-play" },
      guards: [{ op: "truthy", path: "/desk/tapeLoaded" }],
      effects: [
        { type: "set", path: "/desk/running", value: true },
        { type: "navigateScene", sceneId: "focus-active" },
        { type: "playSynthSound", cue: "powerup" },
      ],
    },
    {
      id: "toggle-lamp",
      label: "Toggle Desk Lamp via Keypress",
      sourceSection: "## 2. Desk Setup",
      trigger: { type: "onKeyPress", key: "L" },
      effects: [
        { type: "toggle", path: "/desk/lampOn" },
        { type: "playSynthSound", cue: "click" },
      ],
    },
    {
      id: "tick-countdown",
      label: "Countdown Timer Tick",
      sourceSection: "## 3. Focus Loop",
      trigger: { type: "onTimerTick", timerId: "focus-clock" },
      guards: [
        { op: "truthy", path: "/desk/running" },
        { op: "gt", path: "/desk/remainingTicks", value: 0 },
      ],
      effects: [
        { type: "dec", path: "/desk/remainingTicks", by: 1, min: 0 },
        { type: "inc", path: "/desk/focusPoints", by: 10, max: 100 },
      ],
    },
    {
      id: "distract-fail",
      label: "Open Distraction Tab (Lose Condition)",
      sourceSection: "## 4. Outcomes",
      trigger: { type: "onClick", elementKey: "btn-distract" },
      guards: [{ op: "truthy", path: "/desk/running" }],
      effects: [
        { type: "set", path: "/desk/running", value: false },
        {
          type: "setOutcome",
          outcome: "lose",
          reason: "Broke focus streak before the cassette side finished.",
        },
        { type: "playSynthSound", cue: "lose" },
      ],
    },
    {
      id: "complete-focus-win",
      label: "Finish Cassette Side (Win Condition)",
      sourceSection: "## 4. Outcomes",
      trigger: { type: "onStateMatch" },
      guards: [
        { op: "truthy", path: "/desk/running" },
        { op: "lte", path: "/desk/remainingTicks", value: 0 },
      ],
      effects: [
        { type: "set", path: "/desk/running", value: false },
        { type: "inc", path: "/desk/streak", by: 1 },
        {
          type: "setOutcome",
          outcome: "win",
          reason: "Completed full cassette side with zero distractions.",
        },
        { type: "playSynthSound", cue: "win" },
      ],
    },
  ];
}

describe("Phase 1: Declarative Interaction Engine, Guard Evaluator, Synth Audio & Playtest Fuzzer", () => {
  it("(a) executes drop, click, keypress, timer tick, reactive onStateMatch win, and synth cues deterministically", () => {
    const sounds: SynthSoundCue[] = [];
    const engine = createInteractionRuleEngine({
      initialState: {
        desk: {
          tapeLoaded: false,
          running: false,
          lampOn: false,
          remainingTicks: 2,
          focusPoints: 0,
          streak: 0,
          log: [],
        },
      },
      rules: buildCassetteDeskRules(),
      onSynthSound: (cue) => sounds.push(cue),
    });

    // Guard blocks clicking Play before tape is loaded
    const earlyClick = engine.dispatch({ type: "onClick", elementKey: "btn-play" });
    expect(earlyClick.firedRules).toHaveLength(0);

    // Keypress toggles lamp
    const lampStep = engine.dispatch({ type: "onKeyPress", key: "l" });
    expect(lampStep.firedRules.map((r) => r.ruleId)).toEqual(["toggle-lamp"]);
    expect(engine.store.get("/desk/lampOn")).toBe(true);

    // Drop tape onto deck
    const dropStep = engine.dispatch({
      type: "onDrop",
      sourceElementKey: "tape-lofi",
      targetElementKey: "cassette-deck",
    });
    expect(dropStep.firedRules[0]?.sourceSection).toBe("## 2. Desk Setup");
    expect(engine.store.get("/desk/tapeLoaded")).toBe(true);
    expect(engine.store.get("/desk/log")).toEqual(["loaded-lofi"]);

    // Click Play -> navigates to focus-active scene
    const playStep = engine.dispatch({ type: "onClick", elementKey: "btn-play" });
    expect(playStep.firedRules.map((r) => r.ruleId)).toEqual(["start-focus"]);
    expect(engine.getActiveScene()).toBe("focus-active");

    // Tick 1 & Tick 2 -> remainingTicks hits 0 -> reactive onStateMatch wins
    expect(engine.dispatch({ type: "onTimerTick", timerId: "focus-clock" }).outcome).toBe(
      "playing",
    );
    const tick2 = engine.dispatch({ type: "onTimerTick", timerId: "focus-clock" });
    expect(tick2.firedRules.map((r) => r.ruleId)).toEqual([
      "tick-countdown",
      "complete-focus-win",
    ]);
    expect(tick2.outcome).toBe("win");
    expect(engine.store.get("/desk/streak")).toBe(1);
    expect(sounds).toEqual(["click", "drop", "powerup", "win"]);
  });

  it("(b) trips the 32-transition circuit breaker on mutually recursive emitEvent loops without hanging", () => {
    const loopRules: InteractionRule[] = [
      {
        id: "ping",
        label: "Ping",
        trigger: { type: "onClick", elementKey: "btn-loop" },
        effects: [
          { type: "inc", path: "/loop/count", by: 1 },
          { type: "emitEvent", eventName: "pong-evt" },
        ],
      },
      {
        id: "pong",
        label: "Pong",
        trigger: { type: "onEvent", eventName: "pong-evt" },
        effects: [
          { type: "inc", path: "/loop/count", by: 1 },
          { type: "emitEvent", eventName: "ping-evt" },
        ],
      },
      {
        id: "ping-again",
        label: "Ping Again",
        trigger: { type: "onEvent", eventName: "ping-evt" },
        effects: [
          { type: "inc", path: "/loop/count", by: 1 },
          { type: "emitEvent", eventName: "pong-evt" },
        ],
      },
    ];

    const engine = createInteractionRuleEngine({
      initialState: { loop: { count: 0 } },
      rules: loopRules,
    });

    const step = engine.dispatch({ type: "onClick", elementKey: "btn-loop" });
    expect(step.circuitBreakerTripped).toBe(true);
    expect(step.transitionsExecuted).toBe(32);
    expect(step.issues.some((i) => i.code === "rule_budget_exceeded")).toBe(true);
    expect(engine.getCircuitBreakerTripCount()).toBe(1);
    expect(engine.store.get("/loop/count")).toBe(32);
  });

  it("(c) blocks __proto__ / constructor paths and neutralizes javascript: URIs during rule sanitization", () => {
    const rawHostileRules = [
      {
        id: "__proto__",
        label: "Dangerous ID",
        trigger: { type: "onClick", elementKey: "a" },
        effects: [{ type: "set", path: "/ok", value: 1 }],
      },
      {
        id: "proto-write",
        label: "Proto Pollution Attempt",
        trigger: { type: "onClick", elementKey: "b" },
        effects: [
          { type: "set", path: "/__proto__/polluted", value: true },
          { type: "set", path: "/constructor/prototype/pwn", value: true },
        ],
      },
      {
        id: "xss-uri-rule",
        label: "XSS URI Neutralized",
        trigger: { type: "onClick", elementKey: "c" },
        effects: [{ type: "set", path: "/link/href", value: "javascript:alert(1)" }],
      },
    ];

    const result = sanitizeInteractionRules(rawHostileRules);
    expect(result.droppedCount).toBe(2);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.id).toBe("xss-uri-rule");
    expect(JSON.stringify(result.rules)).not.toContain("javascript:");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("(d) scrubToHistoryIndex rewinds from lose state and replays into win state, including once: true re-arming", () => {
    const engine = createInteractionRuleEngine({
      initialState: {
        desk: {
          tapeLoaded: false,
          running: false,
          remainingTicks: 1,
          focusPoints: 0,
          streak: 0,
        },
      },
      rules: buildCassetteDeskRules(),
    });

    engine.dispatch({
      type: "onDrop",
      sourceElementKey: "tape-lofi",
      targetElementKey: "cassette-deck",
    });
    const playTrace = engine.dispatch({ type: "onClick", elementKey: "btn-play" });
    const frameBeforeLose = playTrace.firedRules[0]!.historyIndex;

    // Hit lose outcome
    expect(engine.dispatch({ type: "onClick", elementKey: "btn-distract" }).outcome).toBe(
      "lose",
    );

    // Scrub backward and win instead
    expect(engine.scrubToHistoryIndex(frameBeforeLose)).toBe(true);
    expect(engine.getOutcome().status).toBe("playing");
    expect(engine.dispatch({ type: "onTimerTick", timerId: "focus-clock" }).outcome).toBe(
      "win",
    );

    // Scrub all the way to snapshot 0 -> `once: true` rule "start-focus" re-arms cleanly
    expect(engine.scrubToHistoryIndex(0)).toBe(true);
    engine.dispatch({
      type: "onDrop",
      sourceElementKey: "tape-lofi",
      targetElementKey: "cassette-deck",
    });
    const replayPlay = engine.dispatch({ type: "onClick", elementKey: "btn-play" });
    expect(replayPlay.firedRules.map((r) => r.ruleId)).toEqual(["start-focus"]);
  });

  it("(e) fuzzPlaytestSpec finds concrete shortestTraces for win/lose and flags unreachable deadRules", () => {
    const rulesWithDeadBranch: InteractionRule[] = [
      ...buildCassetteDeskRules(),
      {
        id: "unreachable-secret",
        label: "Impossible Secret Rule",
        sourceSection: "## 5. Bonus Mode",
        trigger: { type: "onClick", elementKey: "btn-play" },
        guards: [{ op: "eq", path: "/desk/impossibleFlag", value: "never" }],
        effects: [{ type: "set", path: "/desk/secret", value: true }],
      },
    ];

    expect(extractActionVocabulary(rulesWithDeadBranch).length).toBe(5);

    const report = fuzzPlaytestSpec({
      initialState: {
        desk: {
          tapeLoaded: false,
          running: false,
          remainingTicks: 2,
          focusPoints: 0,
          streak: 0,
        },
      },
      rules: rulesWithDeadBranch,
      numRuns: 200,
      maxStepsPerRun: 16,
      seed: 1337,
      requireReachableOutcomes: ["win", "lose"],
    });

    expect(report.passed).toBe(true);
    expect(report.unhandledExceptions).toBe(0);
    expect(report.outcomesReached.win).toBeGreaterThan(0);
    expect(report.outcomesReached.lose).toBeGreaterThan(0);
    expect(report.shortestTraces.win).not.toBeNull();
    expect(report.shortestTraces.lose).not.toBeNull();
    expect(report.deadRules).toEqual([
      {
        id: "unreachable-secret",
        label: "Impossible Secret Rule",
        sourceSection: "## 5. Bonus Mode",
      },
    ]);

    // Replay the discovered shortestTraces.win independently to prove it really wins!
    const verifier = createInteractionRuleEngine({
      initialState: {
        desk: {
          tapeLoaded: false,
          running: false,
          remainingTicks: 2,
          focusPoints: 0,
          streak: 0,
        },
      },
      rules: rulesWithDeadBranch,
    });
    for (const evt of report.shortestTraces.win!) {
      verifier.dispatch(evt);
    }
    expect(verifier.getOutcome().status).toBe("win");
  });

  it("(f) createWebAudioSynth drives AudioContext oscillators cleanly and no-ops safely in Node/muted mode", () => {
    // Headless Node no-op (no global AudioContext)
    const headlessSynth = createWebAudioSynth();
    expect(headlessSynth.play("win")).toBe(false);

    // Mocked Web Audio context verifies oscillator scheduling and dispose()
    const oscStarts = vi.fn();
    const oscStops = vi.fn();
    const ctxClose = vi.fn();
    const mockCtx: MinimalAudioContext = {
      currentTime: 1.5,
      state: "running",
      destination: {},
      createOscillator: () => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: oscStarts,
        stop: oscStops,
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      close: ctxClose,
    };

    const synth = createWebAudioSynth({ createAudioContext: () => mockCtx });
    expect(synth.play("win")).toBe(true);
    expect(oscStarts).toHaveBeenCalledTimes(4); // 4-note arpeggio for win
    expect(oscStops).toHaveBeenCalledTimes(4);

    synth.setMuted(true);
    expect(synth.isMuted()).toBe(true);
    expect(synth.play("click")).toBe(false);

    synth.dispose();
    expect(ctxClose).toHaveBeenCalledTimes(1);
  });

  it("(g) PBT (100 runs): compound guard evaluation & random hostile event streams never throw or pollute Object.prototype", () => {
    const guardEngine = createInteractionRuleEngine({
      initialState: { player: { role: "architect", score: 75, locked: false } },
    });
    expect(
      evaluateInteractionGuard(
        {
          op: "and",
          guards: [
            { op: "in", path: "/player/role", values: ["engineer", "architect"] },
            { op: "gte", path: "/player/score", value: 50 },
            { op: "not", guard: { op: "truthy", path: "/player/locked" } },
          ],
        },
        guardEngine.store,
      ),
    ).toBe(true);

    const eventArb: fc.Arbitrary<InteractionEvent> = fc.oneof(
      fc.record({
        type: fc.constant("onClick" as const),
        elementKey: fc.constantFrom("btn-play", "btn-distract", "unknown-btn", "__proto__"),
      }),
      fc.record({
        type: fc.constant("onDrop" as const),
        sourceElementKey: fc.constantFrom("tape-lofi", "tape-ambient"),
        targetElementKey: fc.constantFrom("cassette-deck", "trash"),
      }),
      fc.record({
        type: fc.constant("onTimerTick" as const),
        timerId: fc.constantFrom("focus-clock", undefined),
      }),
      fc.record({
        type: fc.constant("onKeyPress" as const),
        key: fc.constantFrom("L", "Space", "Enter", "Escape"),
      }),
      fc.record({
        type: fc.constant("onEnterZone" as const),
        zoneKey: fc.constantFrom("zone-exit", "zone-desk"),
      }),
    );

    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 30 }), (events) => {
        const engine = createInteractionRuleEngine({
          initialState: {
            desk: { tapeLoaded: false, running: false, remainingTicks: 2, streak: 0 },
          },
          rules: buildCassetteDeskRules(),
        });
        for (const evt of events) {
          const step = engine.dispatch(evt);
          expect(["playing", "win", "lose", "complete"]).toContain(step.outcome);
        }
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
