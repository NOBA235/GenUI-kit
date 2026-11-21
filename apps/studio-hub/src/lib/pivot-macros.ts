import type { Spec, SpecStreamLine } from "@json-render/core";
import {
  createGuardrailedStreamCompiler,
  isDangerousKey,
  sanitizeInteractionRules,
  type GraphIssue,
  type InteractionRule,
  type VerifiedCatalog,
} from "@genui-studio/core";

export type PivotMacroId =
  | "add-countdown-timer"
  | "add-win-goal"
  | "add-drag-and-drop"
  | "simplify-unused-nodes";

export interface PivotMacroDefinition {
  readonly id: PivotMacroId;
  readonly label: string;
  readonly shortDescription: string;
}

export const PIVOT_MACROS: readonly PivotMacroDefinition[] = [
  {
    id: "add-countdown-timer",
    label: "+ Add Countdown Timer",
    shortDescription:
      "Adds a countdown timer state counter, timer HUD block, tick rule, and timeout lose condition.",
  },
  {
    id: "add-win-goal",
    label: "+ Add Win Goal",
    shortDescription:
      "Adds a score/goal tracker, clickable action block, increment rule, and reachable win condition.",
  },
  {
    id: "add-drag-and-drop",
    label: "+ Add Drag & Drop",
    shortDescription:
      "Adds a draggable item card, drop zone panel, and declarative onDragStart/onDrop rules.",
  },
  {
    id: "simplify-unused-nodes",
    label: "Simplify Unused Nodes",
    shortDescription:
      "Prunes unreachable orphan elements not mounted under root and removes disabled or dangling rules.",
  },
] as const;

export interface PivotMacroInput {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly catalog?: VerifiedCatalog<any, any>;
}

export interface PivotMacroResult {
  readonly macroId: PivotMacroId;
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly patches: readonly SpecStreamLine[];
  readonly issues: readonly GraphIssue[];
  readonly summary: string;
  readonly changed: boolean;
  readonly addedElementKeys: readonly string[];
  readonly removedElementKeys: readonly string[];
  readonly addedRuleIds: readonly string[];
  readonly removedRuleIds: readonly string[];
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function getRootKey(spec: Spec): string {
  if (spec.root && spec.elements[spec.root]) {
    return spec.root;
  }
  const firstKey = Object.keys(spec.elements)[0];
  return firstKey ?? "site-shell";
}

function pickComponentType(
  catalog: VerifiedCatalog<any, any> | undefined,
  preferred: readonly string[],
  rootType: string,
): string {
  const names = catalog?.metadata.componentNames ?? [];
  if (names.length === 0) {
    return preferred[0] ?? "HeroSection";
  }
  for (const candidate of preferred) {
    if (names.includes(candidate)) {
      return candidate;
    }
  }
  return names.find((name) => name !== rootType) ?? names[0] ?? preferred[0] ?? "HeroSection";
}

function buildValidPropsForComponent(
  componentType: string,
  catalog: VerifiedCatalog<any, any> | undefined,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const defaultsByKnownType: Record<string, Record<string, unknown>> = {
    SiteShell: {
      brandName: "GenUI Playable Blueprint",
      tagline: "Verified Behavioral Spec",
      badge: "INTERACTIVE",
      layoutDensity: "spacious",
    },
    HeroSection: {
      eyebrow: "INTERACTIVE MODULE",
      headline: "Interactive Action Panel",
      summary: "Trigger deterministic state transitions managed by InteractionRuleEngine.",
      primaryCta: "Trigger Action",
      secondaryCta: "Rule Wired",
    },
    MetricStrip: {
      heading: "Live Behavioral Telemetry",
      primaryValue: "30s",
      primaryLabel: "Countdown",
      secondaryValue: "0 / 3",
      secondaryLabel: "Goal Progress",
      uptimePercent: 100,
    },
    FeatureGrid: {
      sectionTitle: "Interactive Elements",
      columns: 2,
      items: [
        {
          title: "Draggable Item",
          detail: "Drag onto the target zone to commit a state transition.",
        },
        {
          title: "Drop Target Zone",
          detail: "Receives dropped items and increments /dropCount.",
        },
      ],
    },
  };

  const merged: Record<string, unknown> = {
    ...(defaultsByKnownType[componentType] ?? {}),
    ...overrides,
  };

  if (!catalog) {
    return merged;
  }

  return catalog.validateAndHealProps(`macro-${componentType}`, componentType, merged).props;
}

function ensureStateRootPatch(spec: Spec): SpecStreamLine[] {
  if (spec.state && typeof spec.state === "object" && !Array.isArray(spec.state)) {
    return [];
  }
  return [{ op: "add", path: "/state", value: {} }];
}

function buildChildAppendPatchIfMissing(
  spec: Spec,
  rootKey: string,
  childKey: string,
): SpecStreamLine[] {
  const rootEl = spec.elements[rootKey];
  if (!rootEl) return [];
  const existingChildren = Array.isArray(rootEl.children) ? rootEl.children : [];
  if (existingChildren.includes(childKey)) {
    return [];
  }
  const escapedRoot = escapePointerSegment(rootKey);
  if (!Array.isArray(rootEl.children)) {
    return [
      {
        op: "add",
        path: `/elements/${escapedRoot}/children`,
        value: [childKey],
      },
    ];
  }
  return [
    {
      op: "add",
      path: `/elements/${escapedRoot}/children/-`,
      value: childKey,
    },
  ];
}

function compileMacroPatches(
  initialSpec: Spec,
  patches: readonly SpecStreamLine[],
  catalog?: VerifiedCatalog<any, any>,
): { spec: Spec; issues: readonly GraphIssue[] } {
  const compiler = createGuardrailedStreamCompiler({
    catalog,
    initialSpec,
  });
  for (const patch of patches) {
    compiler.push(`${JSON.stringify(patch)}\n`);
  }
  const finalized = compiler.finalize();
  return {
    spec: finalized.spec,
    issues: finalized.issues,
  };
}

function upsertRules(
  existing: readonly InteractionRule[],
  additions: readonly InteractionRule[],
): { rules: readonly InteractionRule[]; addedIds: string[]; issues: readonly GraphIssue[] } {
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const addedIds: string[] = [];
  const next: InteractionRule[] = [...existing];

  for (const rule of additions) {
    if (existingById.has(rule.id)) {
      const idx = next.findIndex((item) => item.id === rule.id);
      if (idx >= 0) {
        next[idx] = rule;
      }
    } else {
      next.push(rule);
      addedIds.push(rule.id);
    }
  }

  const sanitized = sanitizeInteractionRules(next);
  return {
    rules: sanitized.rules,
    addedIds,
    issues: sanitized.issues,
  };
}

function collectReachableElements(spec: Spec): Set<string> {
  const reachable = new Set<string>();
  if (!spec.root || !spec.elements[spec.root]) {
    return reachable;
  }
  const queue: string[] = [spec.root];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (reachable.has(key)) continue;
    const el = spec.elements[key];
    if (!el) continue;
    reachable.add(key);

    if (Array.isArray(el.children)) {
      for (const childKey of el.children) {
        if (typeof childKey === "string" && !reachable.has(childKey)) {
          queue.push(childKey);
        }
      }
    }
    if (el.slots && typeof el.slots === "object" && !Array.isArray(el.slots)) {
      for (const slotChildren of Object.values(el.slots)) {
        if (Array.isArray(slotChildren)) {
          for (const childKey of slotChildren) {
            if (typeof childKey === "string" && !reachable.has(childKey)) {
              queue.push(childKey);
            }
          }
        }
      }
    }
  }
  return reachable;
}

/**
 * Deterministic Macro 1: `+ Add Countdown Timer`
 * Injects `/state/timerRemaining`, a timer telemetry block, an `onTimerTick` decrement rule,
 * and an `onStateMatch` timeout lose condition.
 */
export function addCountdownTimerMacro(
  input: PivotMacroInput,
  options: { readonly initialSeconds?: number } = {},
): PivotMacroResult {
  const initialSeconds = Math.max(
    1,
    Math.min(600, Math.round(options.initialSeconds ?? 30)),
  );
  const rootKey = getRootKey(input.spec);
  const rootType = input.spec.elements[rootKey]?.type ?? "SiteShell";
  const timerElementKey = "macro-countdown-hud";
  const componentType = pickComponentType(
    input.catalog,
    ["MetricStrip", "HeroSection", "FeatureGrid", "CountdownDisplay"],
    rootType,
  );

  const props = buildValidPropsForComponent(componentType, input.catalog, {
    // Playable catalog (CountdownDisplay); showcase components ignore these keys.
    label: "Countdown",
    seconds: { $state: "/timerRemaining" },
    warnAt: 5,
    heading: "Countdown Timer HUD",
    primaryValue: `${initialSeconds}s`,
    primaryLabel: "Time Remaining",
    secondaryValue: "ACTIVE",
    secondaryLabel: "Timer Status",
    uptimePercent: 100,
    eyebrow: "COUNTDOWN TIMER",
    headline: `Countdown Timer (${initialSeconds}s)`,
    summary: "Ticks down on each onTimerTick event until the timeout lose condition fires.",
    primaryCta: "Tick Timer",
    secondaryCta: `${initialSeconds}s remaining`,
  });

  const alreadyHasElement = Boolean(input.spec.elements[timerElementKey]);
  const patches: SpecStreamLine[] = [
    ...ensureStateRootPatch(input.spec),
    { op: "add", path: "/state/timerRemaining", value: initialSeconds },
    { op: "add", path: "/state/timerActive", value: true },
    ...(input.spec.state?.outcome === undefined
      ? [{ op: "add" as const, path: "/state/outcome", value: "playing" }]
      : []),
    {
      op: "add",
      path: `/elements/${timerElementKey}`,
      value: {
        type: componentType,
        props,
        children: [],
      },
    },
    ...buildChildAppendPatchIfMissing(input.spec, rootKey, timerElementKey),
  ];

  const compiled = compileMacroPatches(input.spec, patches, input.catalog);

  const macroRules: InteractionRule[] = [
    {
      id: "macro-timer-tick",
      label: "Countdown Timer Tick",
      description: "Decrements /timerRemaining by 1 second while playing.",
      enabled: true,
      trigger: { type: "onTimerTick", timerId: "countdown", intervalMs: 1000 },
      guards: [
        { op: "gt", path: "/timerRemaining", value: 0 },
        { op: "eq", path: "/experience/outcome", value: "playing" },
      ],
      effects: [
        { type: "dec", path: "/timerRemaining", by: 1, min: 0 },
        { type: "playSynthSound", cue: "click" },
      ],
    },
    {
      id: "macro-timer-expired",
      label: "Countdown Timeout Lose",
      description: "Triggers lose outcome when /timerRemaining reaches 0.",
      enabled: true,
      once: true,
      trigger: { type: "onStateMatch" },
      guards: [
        { op: "lte", path: "/timerRemaining", value: 0 },
        { op: "eq", path: "/experience/outcome", value: "playing" },
      ],
      effects: [
        {
          type: "setOutcome",
          outcome: "lose",
          reason: "Countdown timer expired before the objective was completed.",
        },
        { type: "playSynthSound", cue: "lose" },
      ],
    },
  ];

  const ruleUpdate = upsertRules(input.rules, macroRules);

  return {
    macroId: "add-countdown-timer",
    spec: compiled.spec,
    rules: ruleUpdate.rules,
    patches,
    issues: [...compiled.issues, ...ruleUpdate.issues],
    summary: `Added ${initialSeconds}s countdown timer HUD ("${timerElementKey}") and 2 timer rules.`,
    changed: true,
    addedElementKeys: alreadyHasElement ? [] : [timerElementKey],
    removedElementKeys: [],
    addedRuleIds: ruleUpdate.addedIds,
    removedRuleIds: [],
  };
}

/**
 * Deterministic Macro 2: `+ Add Win Goal`
 * Injects `/state/score`, `/state/goalTarget`, an interactive action panel,
 * an `onClick` score increment rule, and a reachable `onStateMatch` win rule.
 */
export function addWinGoalMacro(
  input: PivotMacroInput,
  options: { readonly targetScore?: number } = {},
): PivotMacroResult {
  const targetScore = Math.max(1, Math.min(20, Math.round(options.targetScore ?? 3)));
  const rootKey = getRootKey(input.spec);
  const rootType = input.spec.elements[rootKey]?.type ?? "SiteShell";
  const goalElementKey = "macro-win-goal-panel";
  const componentType = pickComponentType(
    input.catalog,
    ["HeroSection", "MetricStrip", "FeatureGrid", "ControlButton"],
    rootType,
  );

  const props = buildValidPropsForComponent(componentType, input.catalog, {
    // Playable catalog (ControlButton); showcase components ignore these keys.
    label: "Advance objective (+1)",
    hint: `Reach ${targetScore} to win`,
    tone: "primary",
    eyebrow: "WIN OBJECTIVE",
    headline: `Reach ${targetScore} Points to Win`,
    summary: `Click this interactive objective ${targetScore} times to trigger the verified win state.`,
    primaryCta: "Advance Objective (+1)",
    secondaryCta: `Target: ${targetScore}`,
    heading: "Win Goal Progress",
    primaryValue: `0 / ${targetScore}`,
    primaryLabel: "Objective Score",
    secondaryValue: "PLAYING",
    secondaryLabel: "Outcome",
    uptimePercent: 100,
  });

  const alreadyHasElement = Boolean(input.spec.elements[goalElementKey]);
  const patches: SpecStreamLine[] = [
    ...ensureStateRootPatch(input.spec),
    { op: "add", path: "/state/score", value: 0 },
    { op: "add", path: "/state/goalTarget", value: targetScore },
    { op: "add", path: "/state/outcome", value: "playing" },
    {
      op: "add",
      path: `/elements/${goalElementKey}`,
      value: {
        type: componentType,
        props,
        children: [],
      },
    },
    ...buildChildAppendPatchIfMissing(input.spec, rootKey, goalElementKey),
  ];

  const compiled = compileMacroPatches(input.spec, patches, input.catalog);

  const macroRules: InteractionRule[] = [
    {
      id: "macro-goal-increment",
      label: "Advance Win Goal",
      description: `Clicking "${goalElementKey}" increments /score by 1 up to ${targetScore}.`,
      enabled: true,
      trigger: { type: "onClick", elementKey: goalElementKey },
      guards: [{ op: "eq", path: "/experience/outcome", value: "playing" }],
      effects: [
        { type: "inc", path: "/score", by: 1, max: targetScore },
        { type: "playSynthSound", cue: "powerup" },
      ],
    },
    {
      id: "macro-goal-win",
      label: "Goal Reached Win Condition",
      description: `Declares win when /score reaches ${targetScore}.`,
      enabled: true,
      once: true,
      trigger: { type: "onStateMatch" },
      guards: [
        { op: "gte", path: "/score", value: targetScore },
        { op: "eq", path: "/experience/outcome", value: "playing" },
      ],
      effects: [
        {
          type: "setOutcome",
          outcome: "win",
          reason: `Reached target score of ${targetScore}.`,
        },
        { type: "playSynthSound", cue: "win" },
      ],
    },
  ];

  const ruleUpdate = upsertRules(input.rules, macroRules);

  return {
    macroId: "add-win-goal",
    spec: compiled.spec,
    rules: ruleUpdate.rules,
    patches,
    issues: [...compiled.issues, ...ruleUpdate.issues],
    summary: `Added win goal panel ("${goalElementKey}") with target score ${targetScore} and 2 win-loop rules.`,
    changed: true,
    addedElementKeys: alreadyHasElement ? [] : [goalElementKey],
    removedElementKeys: [],
    addedRuleIds: ruleUpdate.addedIds,
    removedRuleIds: [],
  };
}

/**
 * Deterministic Macro 3: `+ Add Drag & Drop`
 * Injects a draggable item block, a drop target block, `/state/droppedItems`,
 * `/state/dropCount`, and declarative `onDragStart` + `onDrop` rules.
 */
export function addDragAndDropMacro(input: PivotMacroInput): PivotMacroResult {
  const rootKey = getRootKey(input.spec);
  const rootType = input.spec.elements[rootKey]?.type ?? "SiteShell";
  const sourceKey = "macro-drag-source";
  const targetKey = "macro-drop-target";
  const sourceType = pickComponentType(
    input.catalog,
    ["FeatureGrid", "HeroSection", "MetricStrip", "DragToken"],
    rootType,
  );
  const targetType = pickComponentType(
    input.catalog,
    ["HeroSection", "FeatureGrid", "MetricStrip", "DropSlot"],
    rootType,
  );

  const sourceProps = buildValidPropsForComponent(sourceType, input.catalog, {
    // Playable catalog (DragToken); showcase components ignore these keys.
    label: "Payload card",
    glyph: "P",
    sectionTitle: "Draggable Token Source",
    columns: 1,
    items: [
      {
        title: "Payload Card",
        detail: "Drag this item into the Drop Target Zone to trigger onDrop.",
      },
    ],
    eyebrow: "DRAG SOURCE",
    headline: "Draggable Payload Card",
    summary: "Drag this element into the Drop Target Zone.",
    primaryCta: "Drag Item",
    secondaryCta: null,
  });

  const targetProps = buildValidPropsForComponent(targetType, input.catalog, {
    // Playable catalog (DropSlot); showcase components ignore these keys.
    label: "Drop target zone",
    hint: "Drop the payload card here",
    eyebrow: "DROP ZONE",
    headline: "Drop Target Zone",
    summary: "Release the draggable payload card here to commit it into /droppedItems.",
    primaryCta: "Drop Target Ready",
    secondaryCta: "onDrop Wired",
    sectionTitle: "Drop Target Zone",
    columns: 1,
    items: [
      {
        title: "Active Drop Slot",
        detail: "Accepts macro-drag-source and increments /dropCount.",
      },
    ],
  });

  const addedElementKeys: string[] = [];
  if (!input.spec.elements[sourceKey]) addedElementKeys.push(sourceKey);
  if (!input.spec.elements[targetKey]) addedElementKeys.push(targetKey);

  const patches: SpecStreamLine[] = [
    ...ensureStateRootPatch(input.spec),
    { op: "add", path: "/state/droppedItems", value: [] },
    { op: "add", path: "/state/dropCount", value: 0 },
    { op: "add", path: "/state/draggingItem", value: "" },
    ...(input.spec.state?.outcome === undefined
      ? [{ op: "add" as const, path: "/state/outcome", value: "playing" }]
      : []),
    {
      op: "add",
      path: `/elements/${sourceKey}`,
      value: { type: sourceType, props: sourceProps, children: [] },
    },
    ...buildChildAppendPatchIfMissing(input.spec, rootKey, sourceKey),
    {
      op: "add",
      path: `/elements/${targetKey}`,
      value: { type: targetType, props: targetProps, children: [] },
    },
    ...buildChildAppendPatchIfMissing(input.spec, rootKey, targetKey),
  ];

  const compiled = compileMacroPatches(input.spec, patches, input.catalog);

  const macroRules: InteractionRule[] = [
    {
      id: "macro-drag-start",
      label: "Begin Drag Payload",
      description: `Marks "${sourceKey}" as the active dragged item.`,
      enabled: true,
      trigger: { type: "onDragStart", elementKey: sourceKey },
      effects: [
        { type: "set", path: "/draggingItem", value: sourceKey },
        { type: "playSynthSound", cue: "click" },
      ],
    },
    {
      id: "macro-drop-commit",
      label: "Commit Dropped Payload",
      description: `Appends "${sourceKey}" into /droppedItems when dropped on "${targetKey}".`,
      enabled: true,
      trigger: {
        type: "onDrop",
        sourceElementKey: sourceKey,
        targetElementKey: targetKey,
      },
      effects: [
        {
          type: "append",
          path: "/droppedItems",
          value: sourceKey,
          maxLength: 16,
        },
        { type: "inc", path: "/dropCount", by: 1, max: 16 },
        { type: "set", path: "/draggingItem", value: "" },
        { type: "playSynthSound", cue: "drop" },
      ],
    },
  ];

  const ruleUpdate = upsertRules(input.rules, macroRules);

  return {
    macroId: "add-drag-and-drop",
    spec: compiled.spec,
    rules: ruleUpdate.rules,
    patches,
    issues: [...compiled.issues, ...ruleUpdate.issues],
    summary: `Added drag-and-drop pair ("${sourceKey}" -> "${targetKey}") and 2 interaction rules.`,
    changed: true,
    addedElementKeys,
    removedElementKeys: [],
    addedRuleIds: ruleUpdate.addedIds,
    removedRuleIds: [],
  };
}

/**
 * Deterministic Macro 4: `Simplify Unused Nodes`
 * Removes unreachable orphan elements not referenced from `spec.root` via RFC 6902 `remove`
 * patches, and prunes disabled rules or rules whose DOM triggers reference missing elements.
 */
export function simplifyUnusedNodesMacro(input: PivotMacroInput): PivotMacroResult {
  const reachable = collectReachableElements(input.spec);
  const removedElementKeys = Object.keys(input.spec.elements)
    .filter((key) => !isDangerousKey(key) && !reachable.has(key))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const patches: SpecStreamLine[] = removedElementKeys.map((key) => ({
    op: "remove",
    path: `/elements/${escapePointerSegment(key)}`,
  }));

  const compiled =
    patches.length > 0
      ? compileMacroPatches(input.spec, patches, input.catalog)
      : { spec: input.spec, issues: [] as readonly GraphIssue[] };

  const survivingKeys = new Set(Object.keys(compiled.spec.elements));
  const keptRules: InteractionRule[] = [];
  const removedRuleIds: string[] = [];

  for (const rule of input.rules) {
    if (rule.enabled === false) {
      removedRuleIds.push(rule.id);
      continue;
    }

    let targetsMissingElement = false;
    const t = rule.trigger;
    switch (t.type) {
      case "onClick":
      case "onHover":
      case "onDragStart":
        targetsMissingElement = !survivingKeys.has(t.elementKey);
        break;
      case "onDrop":
        targetsMissingElement =
          !survivingKeys.has(t.targetElementKey) ||
          (t.sourceElementKey !== undefined &&
            !survivingKeys.has(t.sourceElementKey));
        break;
      case "onKeyPress":
      case "onEnterZone":
      case "onTimerTick":
      case "onEvent":
      case "onStateMatch":
        targetsMissingElement = false;
        break;
    }

    if (targetsMissingElement) {
      removedRuleIds.push(rule.id);
    } else {
      keptRules.push(rule);
    }
  }

  const sanitized = sanitizeInteractionRules(keptRules);
  const changed = removedElementKeys.length > 0 || removedRuleIds.length > 0;

  return {
    macroId: "simplify-unused-nodes",
    spec: compiled.spec,
    rules: sanitized.rules,
    patches,
    issues: [...compiled.issues, ...sanitized.issues],
    summary: changed
      ? `Removed ${removedElementKeys.length} unused node(s) and ${removedRuleIds.length} dangling/disabled rule(s).`
      : "No unused nodes or dangling rules found; blueprint is already minimal.",
    changed,
    addedElementKeys: [],
    removedElementKeys,
    addedRuleIds: [],
    removedRuleIds,
  };
}

/**
 * Dispatcher for all deterministic, offline Pivot Macros.
 */
export function applyPivotMacro(
  macroId: PivotMacroId,
  input: PivotMacroInput,
): PivotMacroResult {
  switch (macroId) {
    case "add-countdown-timer":
      return addCountdownTimerMacro(input);
    case "add-win-goal":
      return addWinGoalMacro(input);
    case "add-drag-and-drop":
      return addDragAndDropMacro(input);
    case "simplify-unused-nodes":
      return simplifyUnusedNodesMacro(input);
  }
}
