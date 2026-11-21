import type {
  InteractionEffect,
  InteractionEvent,
  InteractionGuard,
  InteractionRule,
  InteractionTrigger,
  PreservedConstraint,
} from "@genui-studio/core";
import type { SkillPackContext } from "./skill-pack-types.js";

/** Commands printed in every generated doc so all IDEs see the same contract loop. */
export const CONTRACT_TEST_PATH = "contracts/invariants.pbt.test.ts";
const RUN_PRODUCTION = `npx vitest run ${CONTRACT_TEST_PATH}`;
const RUN_REFERENCE_BASH = `GENUI_DRIVER_TARGET=reference npx vitest run ${CONTRACT_TEST_PATH}`;
const RUN_REFERENCE_PWSH = `$env:GENUI_DRIVER_TARGET="reference"; npx vitest run ${CONTRACT_TEST_PATH}`;
const INSTALL_DEPS = "npm install -D @genui-studio/core vitest fast-check";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Inline code span that survives backticks inside the value. */
function code(value: string): string {
  if (!value.includes("`")) return `\`${value}\``;
  return `\`\` ${value} \`\``;
}

function json(value: unknown, max = 80): string {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tableCell(value: string): string {
  return singleLine(value).replace(/\|/g, "\\|");
}

/** Mermaid label text inside `["..."]`: no quotes, no raw angle brackets, one line. */
function mermaidLabel(value: string, max = 60): string {
  const flat = singleLine(value);
  const clipped = flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  return clipped
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;");
}

export function describeTrigger(trigger: InteractionTrigger): string {
  switch (trigger.type) {
    case "onClick":
      return `the user clicks ${code(trigger.elementKey)}`;
    case "onHover":
      return `the user hovers over ${code(trigger.elementKey)}`;
    case "onDragStart":
      return `the user starts dragging ${code(trigger.elementKey)}`;
    case "onDrop":
      return trigger.sourceElementKey
        ? `the user drops ${code(trigger.sourceElementKey)} onto ${code(trigger.targetElementKey)}`
        : `the user drops an item onto ${code(trigger.targetElementKey)}`;
    case "onKeyPress":
      return `the user presses the ${code(trigger.key)} key`;
    case "onEnterZone":
      return trigger.entityKey
        ? `${code(trigger.entityKey)} enters zone ${code(trigger.zoneKey)}`
        : `an entity enters zone ${code(trigger.zoneKey)}`;
    case "onTimerTick": {
      const name = trigger.timerId ? `timer ${code(trigger.timerId)}` : "a timer";
      return trigger.intervalMs ? `${name} ticks (every ${trigger.intervalMs} ms)` : `${name} ticks`;
    }
    case "onEvent":
      return `event ${code(trigger.eventName)} is emitted`;
    case "onStateMatch":
      return "the state starts matching the guards";
  }
}

export function describeGuard(guard: InteractionGuard): string {
  switch (guard.op) {
    case "eq":
      return `${code(guard.path)} == ${json(guard.value)}`;
    case "neq":
      return `${code(guard.path)} != ${json(guard.value)}`;
    case "gt":
      return `${code(guard.path)} > ${json(guard.value)}`;
    case "gte":
      return `${code(guard.path)} >= ${json(guard.value)}`;
    case "lt":
      return `${code(guard.path)} < ${json(guard.value)}`;
    case "lte":
      return `${code(guard.path)} <= ${json(guard.value)}`;
    case "in":
      return `${code(guard.path)} is one of ${json(guard.values)}`;
    case "truthy":
      return `${code(guard.path)} is truthy`;
    case "falsy":
      return `${code(guard.path)} is falsy`;
    case "and":
      return `(${guard.guards.map(describeGuard).join(" AND ")})`;
    case "or":
      return `(${guard.guards.map(describeGuard).join(" OR ")})`;
    case "not":
      return `NOT ${describeGuard(guard.guard)}`;
  }
}

export function describeEffect(effect: InteractionEffect): string {
  switch (effect.type) {
    case "set":
      return `set ${code(effect.path)} to ${json(effect.value)}`;
    case "inc":
      return `increase ${code(effect.path)} by ${effect.by ?? 1}${effect.max !== undefined ? ` (max ${effect.max})` : ""}`;
    case "dec":
      return `decrease ${code(effect.path)} by ${effect.by ?? 1}${effect.min !== undefined ? ` (min ${effect.min})` : ""}`;
    case "toggle":
      return `toggle ${code(effect.path)}`;
    case "append":
      return `append ${json(effect.value)} to ${code(effect.path)}${effect.maxLength !== undefined ? ` (keep last ${effect.maxLength})` : ""}`;
    case "remove":
      return `remove ${json(effect.value)} from ${code(effect.path)}`;
    case "navigateScene":
      return `switch to scene ${code(effect.sceneId)}`;
    case "playSynthSound":
      return `play the ${code(effect.cue)} sound`;
    case "setOutcome":
      return `set the outcome to ${code(effect.outcome)}${effect.reason ? ` ("${singleLine(effect.reason)}")` : ""}`;
    case "emitEvent":
      return `emit event ${code(effect.eventName)}`;
    case "resetExperience":
      return "reset the experience to its initial state";
  }
}

export function describeEvent(event: InteractionEvent): string {
  switch (event.type) {
    case "onClick":
      return `click ${code(event.elementKey)}`;
    case "onHover":
      return `hover ${code(event.elementKey)}`;
    case "onDragStart":
      return `start dragging ${code(event.elementKey)}`;
    case "onDrop":
      return `drop ${code(event.sourceElementKey)} onto ${code(event.targetElementKey)}`;
    case "onKeyPress":
      return `press ${code(event.key)}`;
    case "onEnterZone":
      return `${event.entityKey ? code(event.entityKey) : "entity"} enters ${code(event.zoneKey)}`;
    case "onTimerTick":
      return event.timerId ? `tick timer ${code(event.timerId)}` : "timer tick";
    case "onEvent":
      return `emit ${code(event.eventName)}`;
  }
}

/** One EARS acceptance criterion for a rule. */
export function ruleToEars(rule: InteractionRule): string {
  const guards = rule.guards ?? [];
  const effects = rule.effects.map(describeEffect).join(", then ");
  const suffix = [
    rule.once ? " (at most once per session)" : "",
    rule.enabled === false ? " (currently disabled)" : "",
  ].join("");
  if (rule.trigger.type === "onStateMatch") {
    const condition = guards.length > 0 ? guards.map(describeGuard).join(" AND ") : "the guards";
    return `WHEN ${condition} becomes true, THE SYSTEM SHALL ${effects}${suffix}.`;
  }
  const condition = guards.length > 0 ? ` AND ${guards.map(describeGuard).join(" AND ")}` : "";
  return `WHEN ${describeTrigger(rule.trigger)}${condition}, THE SYSTEM SHALL ${effects}${suffix}.`;
}

/**
 * Renders a preserved constraint. `requirement` is written verbatim so the coding
 * agent sees exactly what the source document said.
 */
function constraintLine(constraint: PreservedConstraint): string {
  return `**${constraint.id}** (${constraint.category}, from ${code(constraint.sourceSection)}): ${constraint.requirement}`;
}

function constraintsSection(ctx: SkillPackContext, heading: string): string {
  const constraints = ctx.document.brief.preservedConstraints ?? [];
  if (constraints.length === 0) {
    return `${heading}\n\nThe source document listed no non-UI constraints.\n`;
  }
  return `${heading}\n\nCopied verbatim from the source document. They are not covered by the contract tests; implement and verify them yourself.\n\n${constraints
    .map((c) => `- ${constraintLine(c)}`)
    .join("\n")}\n`;
}

function verificationSummary(ctx: SkillPackContext): string {
  const lines: string[] = [];
  const report = ctx.fuzzReport;
  lines.push(
    `The reference model was fuzzed with ${report.totalRuns} random sessions (seed ${ctx.fuzzSettings.seed}, up to ${ctx.fuzzSettings.maxStepsPerRun} events each): ${report.unhandledExceptions} unhandled exceptions, ${report.circuitBreakerTrips} circuit-breaker trips.`,
  );
  lines.push("");
  if (ctx.verifiedTraces.length === 0) {
    lines.push(
      ctx.actionVocabulary.length === 0
        ? "- No rule reacts to user or timer events, so the contract checks the initial state and `reset()` only."
        : "- No terminal outcome (`win`, `lose`, `complete`) was reached. The contract checks the initial state, `reset()` and agreement with the reference model on random event sequences.",
    );
  }
  for (const trace of ctx.verifiedTraces) {
    lines.push(
      `- ${code(trace.outcome)} in ${trace.events.length} events: ${trace.events.map(describeEvent).join(" → ")}`,
    );
  }
  const reached = new Set(ctx.verifiedTraces.map((t) => t.outcome));
  const missing = (["win", "lose", "complete"] as const).filter((o) => !reached.has(o));
  if (missing.length > 0 && ctx.verifiedTraces.length > 0) {
    lines.push(`- Not reached by the fuzzer: ${missing.map(code).join(", ")}.`);
  }
  if (report.deadRules.length > 0) {
    lines.push(
      `- Rules that never fired (possibly unreachable): ${report.deadRules
        .map((r) => `${code(r.id)} ${r.label}${r.sourceSection ? ` (from ${code(r.sourceSection)})` : ""}`)
        .join("; ")}.`,
    );
  }
  if (ctx.unknownComponentTypes.length > 0) {
    lines.push(
      `- Element types not in the catalog: ${ctx.unknownComponentTypes.map(code).join(", ")}. Implement them or replace them with catalog components.`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function contractCommands(): string {
  return `\`\`\`bash
# Your app (default target). Fails with NotImplementedError until production-driver.ts is wired.
${RUN_PRODUCTION}

# The bundled reference model (should always pass)
${RUN_REFERENCE_BASH}
\`\`\`

PowerShell: \`${RUN_REFERENCE_PWSH}\``;
}

const CONTRACT_RULES = `- Implement \`contracts/production-driver.ts\` so it drives your real app. Do not make it call \`reference-driver.ts\` or the GenUI rule engine; the contract only proves something when it exercises your code.
- Do not edit \`contracts/wireframe.spec.json\`, \`contracts/reference-driver.ts\`, \`contracts/app-driver.ts\` or \`${CONTRACT_TEST_PATH}\`. If the behavior must change, change the spec in GenUI Studio and re-export the pack.
- Keep the state pointers listed in the spec readable through \`AppDriver.getState()\`.`;

// ---------------------------------------------------------------------------
// Element tree helpers
// ---------------------------------------------------------------------------

function walkTree(
  ctx: SkillPackContext,
  visit: (key: string, type: string, depth: number) => void,
): void {
  const { elements, root } = ctx.document.spec;
  const seen = new Set<string>();
  const step = (key: string, depth: number) => {
    if (seen.has(key) || depth > 16) return;
    const element = elements[key];
    if (!element) return;
    seen.add(key);
    visit(key, element.type, depth);
    for (const child of element.children ?? []) step(child, depth + 1);
  };
  step(root, 0);
}

function elementTreeOutline(ctx: SkillPackContext): string {
  const lines: string[] = [];
  walkTree(ctx, (key, type, depth) => {
    lines.push(`${"  ".repeat(depth)}- ${code(key)} (${type})`);
  });
  return lines.join("\n");
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function flattenState(
  value: unknown,
  prefix: string,
  depth: number,
  rows: Array<{ pointer: string; type: string; initial: string }>,
): void {
  if (rows.length >= 64) return;
  const isPlainObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  if (isPlainObject && depth < 4 && Object.keys(value as object).length > 0) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flattenState(child, `${prefix}/${escapePointerSegment(key)}`, depth + 1, rows);
    }
    return;
  }
  if (!prefix) return;
  const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  rows.push({ pointer: prefix, type, initial: json(value, 60) });
}

function stateTable(ctx: SkillPackContext): string {
  const rows: Array<{ pointer: string; type: string; initial: string }> = [];
  flattenState(ctx.document.spec.state ?? {}, "", 0, rows);
  const lines = [
    "| Pointer | Type | Initial value |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${code(r.pointer)} | ${r.type} | ${tableCell(code(r.initial))} |`),
    `| \`/experience/activeScene\` | string | ${tableCell(code(JSON.stringify(ctx.document.initialScene)))} (managed by the rule engine) |`,
    "| `/experience/outcome` | `playing` \\| `win` \\| `lose` \\| `complete` | `\"playing\"` (managed by the rule engine) |",
    "| `/experience/outcomeReason` | string | `\"\"` (managed by the rule engine) |",
    "| `/experience/tick` | number | `0` (incremented on every timer tick) |",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Mermaid
// ---------------------------------------------------------------------------

function buildMermaid(ctx: SkillPackContext): string {
  const lines: string[] = ["flowchart TD"];
  const elementIds = new Map<string, string>();
  const extraNodes = new Map<string, string>(); // stable key -> node declaration
  const extraIds = new Map<string, string>();
  const edges: string[] = [];

  const nodeId = (kind: string, key: string, declare: (id: string) => string): string => {
    const mapKey = `${kind}:${key}`;
    const existing = extraIds.get(mapKey);
    if (existing) return existing;
    const id = `${kind}${extraIds.size}`;
    extraIds.set(mapKey, id);
    extraNodes.set(mapKey, declare(id));
    return id;
  };

  lines.push('  subgraph ui["UI Spec"]');
  walkTree(ctx, (key, type) => {
    const id = `e${elementIds.size}`;
    elementIds.set(key, id);
    lines.push(`    ${id}["${mermaidLabel(`${key}: ${type}`)}"]`);
  });
  walkTree(ctx, (key) => {
    const element = ctx.document.spec.elements[key];
    const from = elementIds.get(key);
    for (const child of element?.children ?? []) {
      const to = elementIds.get(child);
      if (from && to) lines.push(`    ${from} --> ${to}`);
    }
  });
  lines.push("  end");

  const rules = ctx.document.rules;
  if (rules.length > 0) {
    lines.push('  subgraph behavior["Interaction rules"]');
    rules.forEach((rule, index) => {
      lines.push(`    r${index}{{"${mermaidLabel(`${rule.id}: ${rule.label}`)}"}}`);
    });
    lines.push("  end");
  }

  const elementOrInput = (elementKey: string): string =>
    elementIds.get(elementKey) ??
    nodeId("x", elementKey, (id) => `  ${id}["${mermaidLabel(`${elementKey} (not in UI)`)}"]`);

  rules.forEach((rule, index) => {
    const ruleId = `r${index}`;
    const t = rule.trigger;
    switch (t.type) {
      case "onClick":
      case "onHover":
      case "onDragStart":
        edges.push(`  ${elementOrInput(t.elementKey)} -. ${t.type} .-> ${ruleId}`);
        break;
      case "onDrop":
        edges.push(`  ${elementOrInput(t.targetElementKey)} -. onDrop .-> ${ruleId}`);
        break;
      case "onKeyPress":
        edges.push(
          `  ${nodeId("k", t.key, (id) => `  ${id}(["${mermaidLabel(`key: ${t.key}`)}"])`)} -.-> ${ruleId}`,
        );
        break;
      case "onEnterZone":
        edges.push(
          `  ${nodeId("z", t.zoneKey, (id) => `  ${id}(["${mermaidLabel(`zone: ${t.zoneKey}`)}"])`)} -.-> ${ruleId}`,
        );
        break;
      case "onTimerTick": {
        const timer = t.timerId ?? "tick";
        edges.push(
          `  ${nodeId("t", timer, (id) => `  ${id}(["${mermaidLabel(`timer: ${timer}`)}"])`)} -.-> ${ruleId}`,
        );
        break;
      }
      case "onEvent":
        edges.push(
          `  ${nodeId("v", t.eventName, (id) => `  ${id}(["${mermaidLabel(`event: ${t.eventName}`)}"])`)} -.-> ${ruleId}`,
        );
        break;
      case "onStateMatch":
        for (const path of collectGuardPaths(rule.guards ?? [])) {
          edges.push(
            `  ${nodeId("p", path, (id) => `  ${id}[("${mermaidLabel(path)}")]`)} -. matches .-> ${ruleId}`,
          );
        }
        break;
    }

    for (const effect of rule.effects) {
      switch (effect.type) {
        case "set":
        case "inc":
        case "dec":
        case "toggle":
        case "append":
        case "remove":
          edges.push(
            `  ${ruleId} --> ${nodeId("p", effect.path, (id) => `  ${id}[("${mermaidLabel(effect.path)}")]`)}`,
          );
          break;
        case "setOutcome":
          edges.push(
            `  ${ruleId} --> ${nodeId("o", effect.outcome, (id) => `  ${id}(["${mermaidLabel(`outcome: ${effect.outcome}`)}"])`)}`,
          );
          break;
        case "navigateScene":
          edges.push(
            `  ${ruleId} --> ${nodeId("s", effect.sceneId, (id) => `  ${id}>"${mermaidLabel(`scene: ${effect.sceneId}`)}"]`)}`,
          );
          break;
        case "emitEvent":
          edges.push(
            `  ${ruleId} --> ${nodeId("v", effect.eventName, (id) => `  ${id}(["${mermaidLabel(`event: ${effect.eventName}`)}"])`)}`,
          );
          break;
        default:
          break;
      }
    }
  });

  lines.push(...extraNodes.values(), ...edges);
  return lines.join("\n");
}

function collectGuardPaths(guards: readonly InteractionGuard[]): string[] {
  const paths = new Set<string>();
  const visit = (guard: InteractionGuard) => {
    if ("guards" in guard) guard.guards.forEach(visit);
    else if ("guard" in guard) visit(guard.guard);
    else paths.add(guard.path);
  };
  guards.forEach(visit);
  return [...paths];
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function rulesList(ctx: SkillPackContext): string {
  if (ctx.document.rules.length === 0) {
    return "This spec has no interaction rules yet. The UI is static; the contract checks the initial state only.\n";
  }
  return `${ctx.document.rules
    .map(
      (rule, i) =>
        `${i + 1}. **${rule.label}** (${code(rule.id)}${rule.sourceSection ? `, from ${code(rule.sourceSection)}` : ""}): ${ruleToEars(rule)}`,
    )
    .join("\n")}\n`;
}

export function buildSkillMd(ctx: SkillPackContext): string {
  const { brief } = ctx.document;
  return `---
name: ${ctx.slug}
description: ${JSON.stringify(singleLine(brief.elevatorPitch).slice(0, 1000))}
---

# ${brief.title}

${brief.elevatorPitch}

This pack is a verified behavioral spec exported from GenUI Studio. The UI, state and interaction rules in \`contracts/wireframe.spec.json\` were run and fuzzed before export, and \`${CONTRACT_TEST_PATH}\` checks that your app behaves the same way.

## Creative brief

- **Input mode:** ${brief.inputMode}
- **Core loop:** ${brief.coreLoop}
- **Win condition:** ${brief.winCondition ?? "not specified"}
- **Lose condition:** ${brief.loseCondition ?? "not specified"}
- **Aesthetic direction:** ${brief.aestheticDirection}
- **Target stack:** ${brief.targetStack}
- **Scenes:** ${ctx.knownScenes.map(code).join(", ")} (initial: ${code(ctx.document.initialScene)})
${brief.promptSummary ? `- **Prompt summary:** ${brief.promptSummary}\n` : ""}
## UX loop

${rulesList(ctx)}
${constraintsSection(ctx, "## Preserved constraints")}
## Verified behavior

${verificationSummary(ctx)}
## Instructions for the coding agent

1. Install the contract dependencies: \`${INSTALL_DEPS}\`.
2. Run the reference contract and confirm it passes (commands below).
3. Build the app in your stack (${brief.targetStack}) using the components in \`contracts/catalog.ts\`, the element tree in \`contracts/wireframe.spec.json\` and the rules above. Follow \`.kiro/specs/${ctx.slug}/tasks.md\`.
4. Implement the preserved constraints.
5. Wire \`contracts/production-driver.ts\` to your app and run the contract until it passes.

${CONTRACT_RULES}

${contractCommands()}

## Files

- \`contracts/wireframe.spec.json\`: UI Spec, initial state, rules and brief
- \`contracts/catalog.ts\`: component names, descriptions and prop JSON Schemas (catalog hash \`${ctx.document.catalogHash}\`)
- \`contracts/app-driver.ts\`: the \`AppDriver\` interface
- \`contracts/reference-driver.ts\`: the reference model (passes)
- \`contracts/production-driver.ts\`: your app's driver (stub until you wire it)
- \`${CONTRACT_TEST_PATH}\`: verified traces and property tests over \`AppDriver\`
- \`.kiro/specs/${ctx.slug}/\`: requirements, design and tasks
${ctx.hasExcalidraw ? `- \`wireframe/${ctx.slug}.excalidraw.json\`: the visual blueprint (open at excalidraw.com)\n` : ""}`;
}

export function buildAgentsMd(ctx: SkillPackContext): string {
  return `# AGENTS.md

You are building **${ctx.document.brief.title}** from a verified behavioral spec exported by GenUI Studio.

- Start with \`SKILL.md\`: brief, UX loop, preserved constraints and verified behavior.
- The plan is in \`.kiro/specs/${ctx.slug}/tasks.md\`; requirements and design sit next to it.
- The source of truth is \`contracts/wireframe.spec.json\`.

## Definition of done

\`${RUN_PRODUCTION}\` passes with \`contracts/production-driver.ts\` driving your app.

${CONTRACT_RULES}

${contractCommands()}
`;
}

export function buildRequirementsMd(ctx: SkillPackContext): string {
  const { brief } = ctx.document;
  const sections: string[] = [];
  sections.push(`# Requirements: ${brief.title}

## Introduction

${brief.elevatorPitch}

${brief.promptSummary ? `${brief.promptSummary}\n\n` : ""}Core loop: ${brief.coreLoop}
`);

  sections.push("## Requirements\n");
  ctx.document.rules.forEach((rule, i) => {
    sections.push(`### Requirement ${i + 1}: ${rule.label}

${rule.sourceSection ? `**Source:** ${code(rule.sourceSection)}\n\n` : ""}${rule.description ? `${rule.description}\n\n` : ""}#### Acceptance Criteria

1. ${ruleToEars(rule)}
`);
  });

  const outcomeLines: string[] = [];
  ctx.verifiedTraces.forEach((trace, i) => {
    outcomeLines.push(
      `${i + 1}. WHEN the user performs ${trace.events.map(describeEvent).join(", then ")}, THE SYSTEM SHALL report outcome ${code(trace.outcome)} on scene ${code(trace.expectedScene)}.`,
    );
  });
  const start = outcomeLines.length + 1;
  outcomeLines.push(
    `${start}. WHEN the app starts or is reset, THE SYSTEM SHALL report outcome \`playing\` on scene ${code(ctx.document.initialScene)}.`,
  );
  sections.push(`### Requirement ${ctx.document.rules.length + 1}: Verified outcomes

${brief.winCondition ? `Win condition: ${brief.winCondition}\n\n` : ""}${brief.loseCondition ? `Lose condition: ${brief.loseCondition}\n\n` : ""}#### Acceptance Criteria

${outcomeLines.join("\n")}
`);

  sections.push(constraintsSection(ctx, "## Preserved constraints"));
  return sections.join("\n");
}

export function buildDesignMd(ctx: SkillPackContext): string {
  const { brief } = ctx.document;
  return `# Design: ${brief.title}

## Overview

${brief.elevatorPitch}

- **Core loop:** ${brief.coreLoop}
- **Aesthetic direction:** ${brief.aestheticDirection}
- **Target stack:** ${brief.targetStack}
- **Catalog hash:** \`${ctx.document.catalogHash}\`

## UI and rule flow

\`\`\`mermaid
${buildMermaid(ctx)}
\`\`\`

## Element tree

${elementTreeOutline(ctx)}

## State schema

${stateTable(ctx)}

## Interaction rules

${rulesList(ctx)}
## Verified behavior

${verificationSummary(ctx)}
${constraintsSection(ctx, "## Preserved constraints")}
## Contract

\`contracts/app-driver.ts\` defines \`AppDriver\` (\`reset\`, \`dispatch\`, \`getState\`, \`getOutcome\`, \`getActiveScene\`). \`${CONTRACT_TEST_PATH}\` replays the verified traces and compares your app with the reference model on random event sequences (fast-check, seed ${ctx.fuzzSettings.seed}).
`;
}

export function buildTasksMd(ctx: SkillPackContext): string {
  const { brief } = ctx.document;
  const tasks: string[] = [];
  let n = 0;

  n += 1;
  tasks.push(`- [ ] ${n}. Install the contract dependencies and run the reference contract
  - Run \`${INSTALL_DEPS}\`.
  - Run \`${RUN_REFERENCE_BASH}\` and confirm it passes.`);

  n += 1;
  const components = Object.entries(ctx.catalogComponents);
  tasks.push(`- [ ] ${n}. Build the UI from the catalog
${components
  .map(([name, c], i) => `  - [ ] ${n}.${i + 1} Implement ${code(name)}: ${singleLine(c.description)}`)
  .join("\n")}
  - Match the element tree in \`.kiro/specs/${ctx.slug}/design.md\`.`);

  n += 1;
  tasks.push(`- [ ] ${n}. Model the app state
  - Store state so every pointer in the design's state schema can be read by \`AppDriver.getState()\`.${ctx.observablePaths.length > 0 ? `\n  - The contract reads: ${ctx.observablePaths.map(code).join(", ")}.` : ""}`);

  if (ctx.document.rules.length > 0) {
    n += 1;
    const ruleNumber = n;
    tasks.push(`- [ ] ${ruleNumber}. Implement the interaction rules
${ctx.document.rules
  .map(
    (rule, i) =>
      `  - [ ] ${ruleNumber}.${i + 1} ${rule.label}: ${ruleToEars(rule)}${rule.sourceSection ? `\n    - _Source: ${code(rule.sourceSection)}_` : ""}`,
  )
  .join("\n")}`);
  }

  const constraints = brief.preservedConstraints ?? [];
  if (constraints.length > 0) {
    n += 1;
    const constraintNumber = n;
    tasks.push(`- [ ] ${constraintNumber}. Implement the preserved constraints
${constraints.map((c, i) => `  - [ ] ${constraintNumber}.${i + 1} ${constraintLine(c)}`).join("\n")}`);
  }

  n += 1;
  tasks.push(`- [ ] ${n}. Wire \`contracts/production-driver.ts\` to the real app and pass the contract
  - Implement \`reset\`, \`dispatch\`, \`getState\`, \`getOutcome\` and \`getActiveScene\` against your app (rendered app under test, store, or API).
  - Run \`${RUN_PRODUCTION}\` until it passes. Do not edit the contract files to make it pass.`);

  return `# Implementation Plan: ${brief.title}

${tasks.join("\n\n")}
`;
}

export function buildVisualIntentMd(ctx: SkillPackContext): string {
  const { brief, spec } = ctx.document;
  const interactiveKeys = new Set<string>();
  for (const rule of ctx.document.rules) {
    const t = rule.trigger;
    if (t.type === "onClick" || t.type === "onHover" || t.type === "onDragStart") {
      interactiveKeys.add(t.elementKey);
    } else if (t.type === "onDrop") {
      interactiveKeys.add(t.targetElementKey);
      if (t.sourceElementKey) interactiveKeys.add(t.sourceElementKey);
    }
  }
  const rootType = spec.elements[spec.root]?.type ?? "unknown";
  return `---
inclusion: always
---

# Visual intent: ${brief.title}

## Aesthetic direction

${brief.aestheticDirection}

## Layout invariants

- The root element is ${code(spec.root)} (${rootType}).
- Keep this element hierarchy and order:

${elementTreeOutline(ctx)}

## Do not break

- Every element above must render. Use the catalog components in \`contracts/catalog.ts\` with props that satisfy their schemas.
${interactiveKeys.size > 0 ? `- These elements are interaction targets and must stay reachable and operable: ${[...interactiveKeys].sort().map(code).join(", ")}.\n` : ""}- Scenes: ${ctx.knownScenes.map(code).join(", ")}. Start on ${code(ctx.document.initialScene)}.
- Do not edit the contract files in \`contracts/\` except \`production-driver.ts\`.
`;
}

export function buildCursorRule(ctx: SkillPackContext): string {
  return `---
description: ${JSON.stringify(`GenUI behavioral contract for ${singleLine(ctx.document.brief.title)}`)}
globs:
alwaysApply: true
---

# GenUI behavioral contract: ${ctx.document.brief.title}

Read \`SKILL.md\` first. The source of truth is \`contracts/wireframe.spec.json\`; the plan is \`.kiro/specs/${ctx.slug}/tasks.md\`.

The work is done when \`${RUN_PRODUCTION}\` passes with \`contracts/production-driver.ts\` driving the real app.

${CONTRACT_RULES}
`;
}
