import type { Spec } from "@json-render/core";
import type { CreativeBrief, InteractionRule } from "@genui-studio/core";
import type { MasterPromptAudit } from "./llm-architect.js";

/** A playable spec as edited in the workbench: UI Spec + rules + brief. */
export interface PlayableBlueprint {
  readonly brief: CreativeBrief;
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly initialScene: string;
  /** Present when the blueprint came from a Master Prompt (.md) stream. */
  readonly audit?: MasterPromptAudit | null;
}

export const PLAYABLE_STARTER_SLUG = "signal-relay-vault";

/**
 * Fuzz settings used by "Verify Winnability" and the Skill Pack export. The lose path needs
 * the 15-second signal to drain, so sessions are longer than the fuzzer's 24-event default.
 */
export const PLAYABLE_FUZZ_SETTINGS = {
  numRuns: 300,
  seed: 42,
  maxStepsPerRun: 48,
} as const;

const PLAYING = { op: "eq", path: "/experience/outcome", value: "playing" } as const;

const SIGNAL_SECONDS = 15;
const WRONG_SOCKET_PENALTY = 5;

const BRIEF: CreativeBrief = {
  title: "Signal Relay Vault",
  slug: PLAYABLE_STARTER_SLUG,
  inputMode: "starter",
  promptSummary: "",
  elevatorPitch:
    "A 15-second vault puzzle: charge the relay, seat two power cells in their matching sockets and open the vault before the signal dies.",
  aestheticDirection:
    "Dark control room, amber accents, chunky tactile controls and monospace readouts.",
  coreLoop:
    "Click Charge relay three times, drag each cell into its matching socket, then click Open vault.",
  winCondition: "Open the vault while the signal is still alive.",
  loseCondition: `The signal reaches 0 seconds. A cell dropped in the wrong socket costs ${WRONG_SOCKET_PENALTY} seconds.`,
  targetStack: "Next.js 15, React 19, @genui-studio/core",
  scenes: ["main", "vault"],
};

const SPEC: Spec = {
  root: "vault-shell",
  state: {
    relay: { charge: 0 },
    cells: { amber: false, cyan: false },
    vault: { ready: false },
    signal: { seconds: SIGNAL_SECONDS, running: false },
  },
  elements: {
    "vault-shell": {
      type: "PlayShell",
      props: {
        title: "Signal Relay Vault",
        subtitle: `Charge the relay three times, seat both power cells, then open the vault. The ${SIGNAL_SECONDS}-second signal starts draining on your first move; a cell in the wrong socket costs ${WRONG_SOCKET_PENALTY} seconds.`,
      },
      children: ["status-panel", "relay-panel", "cells-panel"],
    },
    "status-panel": {
      type: "Panel",
      props: { heading: "Signal", columns: 2 },
      children: ["signal-timer", "vault-status"],
    },
    "signal-timer": {
      type: "CountdownDisplay",
      props: { label: "Signal", seconds: { $state: "/signal/seconds" }, warnAt: 5 },
      children: [],
    },
    "vault-status": {
      type: "OutcomeBanner",
      props: {
        status: { $state: "/experience/outcome" },
        message: { $state: "/experience/outcomeReason" },
        playingText: "Vault sealed",
      },
      children: [],
    },
    "relay-panel": {
      type: "Panel",
      props: { heading: "Relay", columns: 3 },
      children: ["charge-meter", "charge-relay", "open-vault"],
    },
    "charge-meter": {
      type: "SignalMeter",
      props: { label: "Relay charge", value: { $state: "/relay/charge" }, max: 3, unit: "" },
      children: [],
    },
    "charge-relay": {
      type: "ControlButton",
      props: { label: "Charge relay", hint: "Click 3 times (or press C)", tone: "neutral", highlight: false },
      children: [],
    },
    "open-vault": {
      type: "ControlButton",
      props: {
        label: "Open vault",
        hint: "Needs a full charge and both cells",
        tone: "primary",
        highlight: { $state: "/vault/ready" },
      },
      children: [],
    },
    "cells-panel": {
      type: "Panel",
      props: { heading: "Power cells", columns: 2 },
      children: ["cell-amber", "cell-cyan", "socket-amber", "socket-cyan"],
    },
    "cell-amber": {
      type: "DragToken",
      props: { label: "Amber cell", glyph: "A", placed: { $state: "/cells/amber" } },
      children: [],
    },
    "cell-cyan": {
      type: "DragToken",
      props: { label: "Cyan cell", glyph: "C", placed: { $state: "/cells/cyan" } },
      children: [],
    },
    "socket-amber": {
      type: "DropSlot",
      props: { label: "Amber socket", hint: "Takes the amber cell", filled: { $state: "/cells/amber" } },
      children: [],
    },
    "socket-cyan": {
      type: "DropSlot",
      props: { label: "Cyan socket", hint: "Takes the cyan cell", filled: { $state: "/cells/cyan" } },
      children: [],
    },
  },
};

function chargeEffects() {
  return [
    { type: "inc", path: "/relay/charge", by: 1, max: 3 },
    { type: "set", path: "/signal/running", value: true },
    { type: "playSynthSound", cue: "click" },
  ] as const;
}

function seatRule(cell: "amber" | "cyan"): InteractionRule {
  return {
    id: `seat-${cell}`,
    label: `Seat the ${cell} cell`,
    sourceSection: "Power cells",
    trigger: { type: "onDrop", sourceElementKey: `cell-${cell}`, targetElementKey: `socket-${cell}` },
    guards: [PLAYING, { op: "falsy", path: `/cells/${cell}` }],
    effects: [
      { type: "set", path: `/cells/${cell}`, value: true },
      { type: "set", path: "/signal/running", value: true },
      { type: "playSynthSound", cue: "drop" },
    ],
  };
}

function wrongSocketRule(cell: "amber" | "cyan", socket: "amber" | "cyan"): InteractionRule {
  return {
    id: `wrong-socket-${cell}`,
    label: `${cell[0]!.toUpperCase()}${cell.slice(1)} cell in the wrong socket`,
    sourceSection: "Penalties",
    trigger: { type: "onDrop", sourceElementKey: `cell-${cell}`, targetElementKey: `socket-${socket}` },
    guards: [PLAYING, { op: "falsy", path: `/cells/${cell}` }],
    effects: [
      { type: "dec", path: "/signal/seconds", by: WRONG_SOCKET_PENALTY, min: 0 },
      { type: "set", path: "/signal/running", value: true },
      { type: "playSynthSound", cue: "alert" },
    ],
  };
}

function liftRule(cell: "amber" | "cyan"): InteractionRule {
  return {
    id: `lift-${cell}`,
    label: `Pick up the ${cell} cell`,
    sourceSection: "Power cells",
    trigger: { type: "onDragStart", elementKey: `cell-${cell}` },
    guards: [PLAYING, { op: "falsy", path: `/cells/${cell}` }],
    effects: [{ type: "playSynthSound", cue: "click" }],
  };
}

const RULES: readonly InteractionRule[] = [
  {
    id: "charge-relay",
    label: "Charge the relay",
    sourceSection: "Relay",
    trigger: { type: "onClick", elementKey: "charge-relay" },
    guards: [PLAYING],
    effects: [...chargeEffects()],
  },
  {
    id: "charge-relay-key",
    label: "Charge the relay from the keyboard",
    sourceSection: "Relay",
    trigger: { type: "onKeyPress", key: "c" },
    guards: [PLAYING],
    effects: [...chargeEffects()],
  },
  {
    id: "relay-charged",
    label: "Relay fully charged",
    sourceSection: "Relay",
    trigger: { type: "onStateMatch" },
    guards: [{ op: "gte", path: "/relay/charge", value: 3 }],
    effects: [{ type: "playSynthSound", cue: "powerup" }],
  },
  liftRule("amber"),
  liftRule("cyan"),
  seatRule("amber"),
  seatRule("cyan"),
  wrongSocketRule("amber", "cyan"),
  wrongSocketRule("cyan", "amber"),
  {
    id: "vault-ready",
    label: "Vault ready to open",
    sourceSection: "Vault",
    trigger: { type: "onStateMatch" },
    guards: [
      { op: "gte", path: "/relay/charge", value: 3 },
      { op: "truthy", path: "/cells/amber" },
      { op: "truthy", path: "/cells/cyan" },
    ],
    effects: [
      { type: "set", path: "/vault/ready", value: true },
      { type: "playSynthSound", cue: "unlock" },
    ],
  },
  {
    id: "open-vault",
    label: "Open the vault",
    sourceSection: "Win condition",
    trigger: { type: "onClick", elementKey: "open-vault" },
    guards: [PLAYING, { op: "truthy", path: "/vault/ready" }],
    effects: [
      { type: "navigateScene", sceneId: "vault" },
      { type: "setOutcome", outcome: "win", reason: "Vault opened before the signal died." },
      { type: "playSynthSound", cue: "win" },
    ],
  },
  {
    id: "open-vault-locked",
    label: "Vault still locked",
    sourceSection: "Vault",
    trigger: { type: "onClick", elementKey: "open-vault" },
    guards: [PLAYING, { op: "falsy", path: "/vault/ready" }],
    effects: [{ type: "playSynthSound", cue: "alert" }],
  },
  {
    id: "signal-drain",
    label: "Signal drains",
    sourceSection: "Timer",
    trigger: { type: "onTimerTick", timerId: "signal", intervalMs: 1000 },
    guards: [PLAYING, { op: "truthy", path: "/signal/running" }],
    effects: [{ type: "dec", path: "/signal/seconds", by: 1, min: 0 }],
  },
  {
    id: "signal-lost",
    label: "Signal lost",
    sourceSection: "Lose condition",
    trigger: { type: "onStateMatch" },
    guards: [PLAYING, { op: "lte", path: "/signal/seconds", value: 0 }],
    effects: [
      { type: "setOutcome", outcome: "lose", reason: "The signal died before the vault opened." },
      { type: "playSynthSound", cue: "lose" },
    ],
  },
];

/** Fresh copy of the flagship playable starter. */
export function createPlayableStarter(): PlayableBlueprint {
  return structuredClone({
    brief: BRIEF,
    spec: SPEC,
    rules: RULES,
    initialScene: "main",
    audit: null,
  }) as PlayableBlueprint;
}
