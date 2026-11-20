import React, { useEffect, useState } from "react";
import { nextCronRuns } from "../lib/chimera/cron.js";
import { CREW_AGENT_NAMES, WORKER_FLIGHT_MS, dispatchAgent, useLab, type ActivityEntry, type CrewAgentName } from "./lab-store.js";

export interface OptimizerAgentConstellationProps {
  readonly heading: string;
  /** Fixed UTC offset used for the cron preview (e.g. -480 for UTC-08:00). */
  readonly utcOffsetMinutes: number;
  readonly showCronPreview: boolean;
}

interface AgentSchedule {
  readonly name: string;
  readonly cronExpr: string;
}

interface OptimizerAgentProfile {
  readonly name: CrewAgentName;
  readonly description: string;
  readonly strategy: string;
  readonly schedule: AgentSchedule;
}

/** Local deterministic optimizer agents built into the CHIMERA // LAB workbench. */
export const OPTIMIZER_AGENTS: readonly OptimizerAgentProfile[] = [
  {
    name: "chimera-architect",
    description: "Audits slow SQL queries, EXPLAIN plans, and missing indexes, applying top composite indexes and N+1 batch rewrites.",
    strategy: "full-audit",
    schedule: { name: "bottleneck-audit", cronExpr: "0 */6 * * *" },
  },
  {
    name: "index-surgeon",
    description: "Inspects sequential scans on hot tables and injects the highest-impact composite B-tree or HNSW index.",
    strategy: "index-injection",
    schedule: { name: "nightly-index-review", cronExpr: "0 3 * * *" },
  },
  {
    name: "deadlock-hunter",
    description: "Detects N+1 round-trip storms, statement_timeout stalls, and saturated database nodes, batching loops with = ANY($1).",
    strategy: "n-plus-one-batching",
    schedule: { name: "lock-watch", cronExpr: "*/30 * * * *" },
  },
];

const runFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Suggested commit message for a lab change, in Conventional Commits form. */
export function suggestedCommitMessage(entry: ActivityEntry): string {
  const sql = entry.sql ?? "";
  if (/^CREATE INDEX/i.test(sql)) return `perf(db): ${entry.title.length > 72 ? `${entry.title.slice(0, 69)}…` : entry.title}`;
  if (entry.title.toLowerCase().includes("batch")) return `perf(api): ${entry.title}`;
  return `chore(lab): ${entry.title}`;
}

const AGENT_ANGLE: Readonly<Record<CrewAgentName, number>> = {
  "chimera-architect": -90,
  "index-surgeon": 30,
  "deadlock-hunter": 150,
};

/**
 * Local optimizer agent constellation: three deterministic SQL optimization workers
 * (chimera-architect, index-surgeon, deadlock-hunter), their previewed audit schedules,
 * one-click dispatch buttons, and the lab activity checkpoint feed.
 */
export const OptimizerAgentConstellation: React.FC<OptimizerAgentConstellationProps> = ({ heading, utcOffsetMinutes, showCronPreview }) => {
  const mode = useLab((s) => s.mode);
  const feed = useLab((s) => s.feed);
  const workers = useLab((s) => s.workers);
  const selectedNodeId = useLab((s) => s.selectedNodeId);
  const [nextRuns, setNextRuns] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [now, setNow] = useState(0);

  // Cron previews depend on the current time, so compute them after mount (no SSR mismatch).
  useEffect(() => {
    if (!showCronPreview) return;
    const compute = () => {
      const from = new Date();
      const out: Record<string, string[]> = {};
      for (const agent of OPTIMIZER_AGENTS) {
        out[agent.schedule.name] = nextCronRuns(agent.schedule.cronExpr, from, 3, utcOffsetMinutes).map((d) =>
          runFormat.format(new Date(d.getTime() + utcOffsetMinutes * 60_000)),
        );
      }
      setNextRuns(out);
    };
    compute();
    const timer = window.setInterval(compute, 60_000);
    return () => window.clearInterval(timer);
  }, [showCronPreview, utcOffsetMinutes]);

  // Re-render once when worker flights end so the constellation stops highlighting them.
  useEffect(() => {
    if (workers.length === 0) return;
    setNow(performance.now());
    const timer = window.setTimeout(() => setNow(performance.now()), WORKER_FLIGHT_MS + 50);
    return () => window.clearTimeout(timer);
  }, [workers]);

  if (mode !== "workbench") return null;

  const flying = new Set(workers.filter((w) => now - w.startedAt < WORKER_FLIGHT_MS).map((w) => w.agent));
  const changesBy = (agent: CrewAgentName) => feed.filter((e) => e.author === agent).length;

  return (
    <section data-chimera-area="crew" className="chimera-panel space-y-3" aria-label={heading} data-testid="chimera-agent-constellation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="chimera-heading">{heading}</h2>
        <span className="chimera-badge chimera-flux" data-testid="chimera-agent-status">
          ● {OPTIMIZER_AGENTS.length} deterministic optimizer agents · local sandbox
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
        <svg viewBox="-100 -100 200 200" className="mx-auto h-44 w-44" role="img" aria-label="Optimizer agent constellation">
          <circle r="16" fill="rgba(0,245,184,0.12)" stroke="#00F5B8" strokeWidth="1" />
          <text y="4" textAnchor="middle" fontSize="9" fill="#d9fff4" fontFamily="ui-monospace, monospace">
            lab
          </text>
          {CREW_AGENT_NAMES.map((agent) => {
            const angle = (AGENT_ANGLE[agent] * Math.PI) / 180;
            const x = Math.cos(angle) * 66;
            const y = Math.sin(angle) * 66;
            const active = flying.has(agent);
            return (
              <g key={agent}>
                <line x1="0" y1="0" x2={x.toFixed(2)} y2={y.toFixed(2)} stroke={active ? "#FFB000" : "rgba(0,245,184,0.35)"} strokeWidth={active ? 2 : 1} strokeDasharray={active ? undefined : "3 4"} />
                <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r="11" fill={active ? "#FFB000" : "rgba(2,18,24,0.9)"} stroke={active ? "#FFB000" : "#00F5B8"} strokeWidth="1.5" className={active ? "chimera-pulse" : undefined} />
                <text x={x.toFixed(2)} y={(y + 24).toFixed(2)} textAnchor="middle" fontSize="8" fill="#d9fff4" fontFamily="ui-monospace, monospace">
                  {agent}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="space-y-2" aria-label="Optimizer agents">
          {OPTIMIZER_AGENTS.map((agent) => (
            <li key={agent.name} className="rounded-lg border border-[rgba(0,245,184,0.12)] p-2.5" data-testid={`chimera-agent-${agent.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="chimera-mono text-xs font-semibold">
                  <span className={flying.has(agent.name) ? "chimera-synapse" : "chimera-flux"}>{flying.has(agent.name) ? "◆ working" : "◇ idle"}</span> {agent.name}
                </p>
                <button type="button" className="chimera-button" onClick={() => dispatchAgent(agent.name, selectedNodeId)}>
                  Dispatch{selectedNodeId ? ` → ${selectedNodeId}` : ""}
                </button>
              </div>
              <p className="mt-1 text-[11px] chimera-muted">{agent.description}</p>
              <p className="chimera-mono mt-1 text-[10px] chimera-muted">
                strategy {agent.strategy} · {changesBy(agent.name)} change(s) this session
              </p>
              <p className="chimera-mono mt-1 text-[10px]">
                <span className="chimera-synapse">⏱ {agent.schedule.name}</span> <code>{agent.schedule.cronExpr}</code>
                {showCronPreview && (
                  <span className="chimera-muted">
                    {" "}
                    · next ({offsetLabel(utcOffsetMinutes)}): {nextRuns?.[agent.schedule.name]?.join(", ") ?? "…"}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <p className="chimera-heading">Activity &amp; checkpoints</p>
        {feed.length === 0 ? (
          <p className="chimera-mono text-[11px] chimera-muted">No changes yet. Dispatch an agent or act on a node.</p>
        ) : (
          <ol className="max-h-56 space-y-1 overflow-auto" aria-label="Lab activity" data-testid="chimera-activity-feed">
            {feed.map((entry) => (
              <li key={entry.seq} className="chimera-mono text-[11px]">
                <span className="chimera-synapse">◇ {entry.checkpoint}</span> <span className="chimera-flux">{entry.author}</span>{" "}
                <span>{suggestedCommitMessage(entry)}</span>
                <span className="chimera-muted">
                  {" "}
                  · {entry.latencyBeforeMs.toFixed(1)} → {entry.latencyAfterMs.toFixed(1)} ms/request · cost {entry.costBefore.toFixed(0)} →{" "}
                  {entry.costAfter.toFixed(0)}/s
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="chimera-mono text-[10px] chimera-muted">
          Checkpoints are content hashes of local simulator changes with a suggested commit message. Nothing is committed to a repository.
        </p>
      </div>
    </section>
  );
};
