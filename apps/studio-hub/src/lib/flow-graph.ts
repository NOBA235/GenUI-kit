import type { Spec } from "@json-render/core";
import type { CreativeBrief, InteractionGuard, InteractionRule } from "@genui-studio/core";
import { describeGuard, describeTrigger } from "./rule-describe.js";

export type FlowNodeKind = "element" | "input" | "rule" | "state" | "outcome" | "scene" | "event";
export type FlowEdgeKind = "trigger" | "effect" | "match";

export interface FlowNode {
  readonly id: string;
  readonly kind: FlowNodeKind;
  readonly label: string;
  readonly detail: string;
  readonly column: 0 | 1 | 2;
  readonly row: number;
  readonly depth: number;
  /** Spec element key, rule id, state pointer, outcome, scene or event name */
  readonly ref: string;
  readonly sourceSection?: string;
  readonly interactive?: boolean;
}

export interface FlowEdge {
  readonly id: string;
  readonly kind: FlowEdgeKind;
  readonly from: string;
  readonly to: string;
  /** Rule the edge belongs to (drives the pulse when that rule fires). */
  readonly ruleId: string;
}

export interface FlowGraph {
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly rows: number;
}

const MAX_TREE_DEPTH = 16;

function guardPaths(guards: readonly InteractionGuard[]): string[] {
  const out = new Set<string>();
  const visit = (guard: InteractionGuard) => {
    if ("guards" in guard) guard.guards.forEach(visit);
    else if ("guard" in guard) visit(guard.guard);
    else out.add(guard.path);
  };
  guards.forEach(visit);
  return [...out];
}

/**
 * Builds a three-column DAG for the Live Flow Map:
 * UI blocks and inputs → interaction rules → state, outcomes, scenes and events.
 * Deterministic: the same blueprint always yields the same nodes, rows and edges.
 */
export function buildFlowGraph(input: {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief?: CreativeBrief | null;
}): FlowGraph {
  const { spec, rules, brief } = input;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const nodeIds = new Set<string>();
  const rowsByColumn = [0, 0, 0];

  const addNode = (node: Omit<FlowNode, "row">): string => {
    if (nodeIds.has(node.id)) return node.id;
    nodeIds.add(node.id);
    nodes.push({ ...node, row: rowsByColumn[node.column]!++ });
    return node.id;
  };

  const interactiveKeys = new Set<string>();
  for (const rule of rules) {
    const t = rule.trigger;
    if (t.type === "onClick" || t.type === "onHover" || t.type === "onDragStart") {
      interactiveKeys.add(t.elementKey);
    } else if (t.type === "onDrop") {
      interactiveKeys.add(t.targetElementKey);
      if (t.sourceElementKey) interactiveKeys.add(t.sourceElementKey);
    }
  }

  // Column 0: UI blocks in tree order.
  const seen = new Set<string>();
  const walk = (key: string, depth: number) => {
    if (seen.has(key) || depth > MAX_TREE_DEPTH) return;
    const element = spec.elements[key];
    if (!element) return;
    seen.add(key);
    const section = brief?.elementSourceSections?.[key];
    addNode({
      id: `el:${key}`,
      kind: "element",
      label: key,
      detail: element.type,
      column: 0,
      depth,
      ref: key,
      interactive: interactiveKeys.has(key),
      ...(section ? { sourceSection: section } : {}),
    });
    for (const child of element.children ?? []) walk(child, depth + 1);
  };
  if (spec.root) walk(spec.root, 0);

  const elementNode = (key: string): string =>
    nodeIds.has(`el:${key}`)
      ? `el:${key}`
      : addNode({
          id: `el:${key}`,
          kind: "element",
          label: key,
          detail: "not in the UI",
          column: 0,
          depth: 0,
          ref: key,
          interactive: true,
        });

  const inputNode = (id: string, label: string, detail: string): string =>
    addNode({ id, kind: "input", label, detail, column: 0, depth: 0, ref: label });

  const eventNode = (name: string): string =>
    addNode({ id: `ev:${name}`, kind: "event", label: name, detail: "event", column: 0, depth: 0, ref: name });

  // Column 1: rules. Column 2 is filled while walking effects.
  const stateNode = (path: string): string =>
    addNode({ id: `st:${path}`, kind: "state", label: path, detail: "$state", column: 2, depth: 0, ref: path });

  rules.forEach((rule) => {
    const guards = rule.guards ?? [];
    const ruleNode = addNode({
      id: `rule:${rule.id}`,
      kind: "rule",
      label: rule.label,
      detail:
        guards.length > 0
          ? `${describeTrigger(rule.trigger)} · if ${guards.map(describeGuard).join(", ")}`
          : describeTrigger(rule.trigger),
      column: 1,
      depth: 0,
      ref: rule.id,
      ...(rule.sourceSection ? { sourceSection: rule.sourceSection } : {}),
    });

    const t = rule.trigger;
    let triggerFrom: string | null = null;
    switch (t.type) {
      case "onClick":
      case "onHover":
      case "onDragStart":
        triggerFrom = elementNode(t.elementKey);
        break;
      case "onDrop":
        triggerFrom = elementNode(t.targetElementKey);
        break;
      case "onKeyPress":
        triggerFrom = inputNode(`key:${t.key.toLowerCase()}`, `key ${t.key}`, "keyboard");
        break;
      case "onEnterZone":
        triggerFrom = inputNode(`zone:${t.zoneKey}`, `zone ${t.zoneKey}`, "zone");
        break;
      case "onTimerTick":
        triggerFrom = inputNode(
          `timer:${t.timerId ?? ""}`,
          t.timerId ? `timer ${t.timerId}` : "timer",
          t.intervalMs ? `every ${t.intervalMs} ms` : "tick",
        );
        break;
      case "onEvent":
        triggerFrom = eventNode(t.eventName);
        break;
      case "onStateMatch":
        for (const path of guardPaths(guards)) {
          edges.push({
            id: `match:${path}->${rule.id}`,
            kind: "match",
            from: stateNode(path),
            to: ruleNode,
            ruleId: rule.id,
          });
        }
        break;
    }
    if (triggerFrom) {
      edges.push({ id: `trigger:${triggerFrom}->${rule.id}`, kind: "trigger", from: triggerFrom, to: ruleNode, ruleId: rule.id });
    }

    for (const effect of rule.effects) {
      let target: string | null = null;
      switch (effect.type) {
        case "set":
        case "inc":
        case "dec":
        case "toggle":
        case "append":
        case "remove":
          target = stateNode(effect.path);
          break;
        case "setOutcome":
          target = addNode({
            id: `out:${effect.outcome}`,
            kind: "outcome",
            label: effect.outcome,
            detail: "outcome",
            column: 2,
            depth: 0,
            ref: effect.outcome,
          });
          break;
        case "navigateScene":
          target = addNode({
            id: `scene:${effect.sceneId}`,
            kind: "scene",
            label: effect.sceneId,
            detail: "scene",
            column: 2,
            depth: 0,
            ref: effect.sceneId,
          });
          break;
        case "emitEvent":
          target = eventNode(effect.eventName);
          break;
        default:
          break;
      }
      if (target) {
        const id = `effect:${rule.id}->${target}`;
        if (!edges.some((e) => e.id === id)) {
          edges.push({ id, kind: "effect", from: ruleNode, to: target, ruleId: rule.id });
        }
      }
    }
  });

  return { nodes, edges, rows: Math.max(1, ...rowsByColumn) };
}
