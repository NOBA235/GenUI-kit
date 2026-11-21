import React, { useId, useMemo } from "react";
import type { Spec } from "@json-render/core";
import type { CreativeBrief, FiredRuleTrace, InteractionRule, OutcomeStatus } from "@genui-studio/core";
import { buildFlowGraph, type FlowNode } from "../lib/flow-graph.js";

export interface FlowMapViewProps {
  readonly spec: Spec;
  readonly rules: readonly InteractionRule[];
  readonly brief?: CreativeBrief | null;
  /** Rules fired by the latest dispatch; their nodes and edges pulse. */
  readonly lastFired: readonly FiredRuleTrace[];
  /** Restarts the pulse animation for every new dispatch. */
  readonly pulseId: number;
  readonly outcome: OutcomeStatus;
  readonly scene: string;
  readonly firedCounts: Readonly<Record<string, number>>;
}

const COLUMN_X = [12, 300, 588] as const;
const NODE_WIDTH = 236;
const NODE_HEIGHT = 34;
const ROW_GAP = 8;
const TOP = 34;
const INDENT = 10;
const VIEW_WIDTH = COLUMN_X[2] + NODE_WIDTH + 12;
const COLUMN_TITLES = ["UI blocks & inputs", "Interaction rules", "State · outcomes · scenes"];

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function nodeBox(node: FlowNode) {
  const indent = node.column === 0 ? Math.min(node.depth, 4) * INDENT : 0;
  return {
    x: COLUMN_X[node.column] + indent,
    y: TOP + node.row * (NODE_HEIGHT + ROW_GAP),
    width: NODE_WIDTH - indent,
  };
}

/**
 * Live SVG flow map of a playable spec. Rules that fired in the latest dispatch, and the
 * edges into and out of them, are marked `data-active="true"` and pulse once.
 */
export const FlowMapView: React.FC<FlowMapViewProps> = ({
  spec,
  rules,
  brief,
  lastFired,
  pulseId,
  outcome,
  scene,
  firedCounts,
}) => {
  const titleId = useId();
  const graph = useMemo(() => buildFlowGraph({ spec, rules, brief }), [spec, rules, brief]);
  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const activeRules = useMemo(() => new Set(lastFired.map((t) => t.ruleId)), [lastFired]);
  const height = TOP + graph.rows * (NODE_HEIGHT + ROW_GAP) + 8;

  const isNodeActive = (node: FlowNode): boolean => {
    if (node.kind === "rule") return activeRules.has(node.ref);
    if (node.kind === "outcome") return node.ref === outcome && outcome !== "playing";
    if (node.kind === "scene") return node.ref === scene;
    return graph.edges.some(
      (e) => activeRules.has(e.ruleId) && (e.from === node.id || e.to === node.id),
    );
  };

  return (
    <figure
      data-testid="flow-map-view"
      data-active-rules={[...activeRules].join(" ")}
      className="m-0 space-y-3"
    >
      <figcaption id={titleId} className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#52525B]">
        <span>
          {graph.nodes.filter((n) => n.kind === "element").length} UI blocks ·{" "}
          {rules.length} rules · {graph.nodes.filter((n) => n.kind === "state").length} state paths.
          Highlighted edges show the rules that fired on the last interaction.
        </span>
        <span className="flex items-center gap-3 font-mono text-[0.6875rem]">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-[#A1A1AA]" /> trigger / effect
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#A1A1AA]" /> state match
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-[#2563EB]" /> fired
          </span>
        </span>
      </figcaption>

      <div className="overflow-x-auto rounded-xl border border-[#E4E4E7] bg-white">
        <svg
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          className="block h-auto w-full min-w-[720px]"
        >
          {COLUMN_TITLES.map((title, i) => (
            <text
              key={title}
              x={COLUMN_X[i]}
              y={18}
              className="fill-[#71717A] font-mono text-[11px] font-semibold uppercase"
            >
              {title}
            </text>
          ))}

          <g fill="none">
            {graph.edges.map((edge) => {
              const from = nodesById.get(edge.from);
              const to = nodesById.get(edge.to);
              if (!from || !to) return null;
              const a = nodeBox(from);
              const b = nodeBox(to);
              const forward = from.column < to.column;
              const x1 = forward ? a.x + a.width : a.x;
              const x2 = forward ? b.x : b.x + b.width;
              const y1 = a.y + NODE_HEIGHT / 2;
              const y2 = b.y + NODE_HEIGHT / 2;
              const bend = Math.max(40, Math.abs(x2 - x1) / 2);
              const c1 = forward ? x1 + bend : x1 - bend;
              const c2 = forward ? x2 - bend : x2 + bend;
              const active = activeRules.has(edge.ruleId);
              return (
                <path
                  key={active ? `${edge.id}#${pulseId}` : edge.id}
                  className="flow-edge"
                  data-edge-kind={edge.kind}
                  data-rule-id={edge.ruleId}
                  data-active={active ? "true" : "false"}
                  d={`M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`}
                />
              );
            })}
          </g>

          {graph.nodes.map((node) => {
            const box = nodeBox(node);
            const active = isNodeActive(node);
            const fired = node.kind === "rule" ? (firedCounts[node.ref] ?? 0) : null;
            return (
              <g
                key={active && node.kind === "rule" ? `${node.id}#${pulseId}` : node.id}
                className="flow-node"
                data-node-kind={node.kind}
                data-node-ref={node.ref}
                data-active={active ? "true" : "false"}
                data-interactive={node.interactive ? "true" : undefined}
                transform={`translate(${box.x} ${box.y})`}
              >
                <title>
                  {`${node.label}: ${node.detail}${node.sourceSection ? ` (from ${node.sourceSection})` : ""}`}
                </title>
                <rect width={box.width} height={NODE_HEIGHT} rx={7} />
                <text x={10} y={14} className="flow-node-label text-[11px] font-semibold">
                  {clip(node.label, node.kind === "rule" ? 30 : 32)}
                </text>
                <text x={10} y={27} className="flow-node-detail font-mono text-[9.5px]">
                  {clip(node.detail, 40)}
                </text>
                {fired !== null ? (
                  <text
                    x={box.width - 8}
                    y={14}
                    textAnchor="end"
                    className="flow-node-detail font-mono text-[10px]"
                  >
                    {fired}×
                  </text>
                ) : null}
                {node.sourceSection ? (
                  <text
                    x={box.width - 8}
                    y={27}
                    textAnchor="end"
                    className="flow-node-section font-mono text-[9px]"
                  >
                    § {clip(node.sourceSection, 16)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
};
