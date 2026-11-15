import React, { useEffect, useState } from "react";
import { nextCronRuns } from "../lib/chimera/cron.js";
import { CREW_APP_FILES, CREW_APP_ZIP_NAME, buildCrewAppZip, validateCrewAppFiles } from "../lib/chimera/crew-bundle.js";
import type { CrewAgent, CrewManifest } from "../lib/chimera/crew-manifest.js";
import { CREW_AGENT_NAMES, WORKER_FLIGHT_MS, dispatchAgent, useLab, type ActivityEntry, type CrewAgentName } from "./lab-store.js";

export interface KiroCrewAgentConstellationProps {
  readonly heading: string;
  /** Fixed UTC offset used for the cron preview (e.g. -480 for UTC-08:00). */
  readonly utcOffsetMinutes: number;
  readonly showCronPreview: boolean;
}

interface CrewCronView {
  readonly name: string;
  readonly schedule: string;
  readonly cronExpr: string | null;
  readonly enabled: boolean;
}

interface CrewAppView {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly manifest: CrewManifest | null;
  readonly agents: readonly CrewAgent[];
  readonly cronsByAgent: Readonly<Record<string, readonly CrewCronView[]>>;
}

let crewAppView: CrewAppView | null = null;

/** The embedded app, validated once with the Kiro Crew App Kit rules. */
export function getCrewAppView(): CrewAppView {
  if (crewAppView) return crewAppView;
  const validation = validateCrewAppFiles(CREW_APP_FILES);
  if (!validation.ok) {
    crewAppView = {
      ok: false,
      issues: validation.issues.map((i) => `${i.file}${i.path ? ` ${i.path}` : ""}: ${i.message}`),
      manifest: null,
      agents: [],
      cronsByAgent: {},
    };
    return crewAppView;
  }
  const cronsByAgent: Record<string, CrewCronView[]> = {};
  for (const cron of validation.value.manifest.crons ?? []) {
    const agent = cron.agent ?? "default";
    (cronsByAgent[agent] ??= []).push({
      name: cron.name,
      schedule: cron.cron_expr ?? `every ${cron.every}s`,
      cronExpr: cron.cron_expr ?? null,
      enabled: cron.enabled !== false,
    });
  }
  crewAppView = { ok: true, issues: [], manifest: validation.value.manifest, agents: validation.value.agents, cronsByAgent };
  return crewAppView;
}

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
 * Kiro Crew agent hive: the three CHIMERA agents read from the embedded `app.json` bundle, their
 * (paused) cron schedules with the next runs, a dispatch button per agent, the lab activity feed
 * as commit-style checkpoints, and a download of the installable Kiro Crew app.
 */
export const KiroCrewAgentConstellation: React.FC<KiroCrewAgentConstellationProps> = ({ heading, utcOffsetMinutes, showCronPreview }) => {
  const mode = useLab((s) => s.mode);
  const feed = useLab((s) => s.feed);
  const workers = useLab((s) => s.workers);
  const selectedNodeId = useLab((s) => s.selectedNodeId);
  const [nextRuns, setNextRuns] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const app = getCrewAppView();

  // Cron previews depend on the current time, so compute them after mount (no SSR mismatch).
  useEffect(() => {
    if (!showCronPreview) return;
    const compute = () => {
      const from = new Date();
      const out: Record<string, string[]> = {};
      for (const crons of Object.values(app.cronsByAgent)) {
        for (const cron of crons) {
          if (!cron.cronExpr) continue;
          out[cron.name] = nextCronRuns(cron.cronExpr, from, 3, utcOffsetMinutes).map((d) =>
            runFormat.format(new Date(d.getTime() + utcOffsetMinutes * 60_000)),
          );
        }
      }
      setNextRuns(out);
    };
    compute();
    const timer = window.setInterval(compute, 60_000);
    return () => window.clearInterval(timer);
  }, [app, showCronPreview, utcOffsetMinutes]);

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

  const download = async () => {
    try {
      setDownloadState("Packing…");
      const bytes = await buildCrewAppZip(CREW_APP_FILES);
      const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = CREW_APP_ZIP_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadState(`Downloaded ${CREW_APP_ZIP_NAME} (${(bytes.byteLength / 1024).toFixed(1)} KB)`);
    } catch (err) {
      setDownloadState(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const cronCount = Object.values(app.cronsByAgent).reduce((n, c) => n + c.length, 0);
  const paused = Object.values(app.cronsByAgent).reduce((n, c) => n + c.filter((x) => !x.enabled).length, 0);

  return (
    <section data-chimera-area="crew" className="chimera-panel space-y-3" aria-label={heading} data-testid="chimera-crew-constellation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="chimera-heading">{heading}</h2>
        <span className={`chimera-badge ${app.ok ? "chimera-flux" : "chimera-mutation"}`} data-testid="chimera-crew-validation">
          {app.ok
            ? `● app.json valid · ${app.agents.length} agents · ${cronCount} crons (${paused} paused)`
            : `✕ app.json invalid (${app.issues.length} issue(s))`}
        </span>
      </div>
      {!app.ok && (
        <ul role="alert" className="chimera-mono text-[11px] chimera-mutation">
          {app.issues.map((issue) => (
            <li key={issue}>✕ {issue}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
        <svg viewBox="-100 -100 200 200" className="mx-auto h-44 w-44" role="img" aria-label="Crew agent constellation">
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

        <ul className="space-y-2" aria-label="Crew agents">
          {CREW_AGENT_NAMES.map((name) => {
            const agent = app.agents.find((a) => a.name === name);
            const crons = app.cronsByAgent[name] ?? [];
            return (
              <li key={name} className="rounded-lg border border-[rgba(0,245,184,0.12)] p-2.5" data-testid={`chimera-agent-${name}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="chimera-mono text-xs font-semibold">
                    <span className={flying.has(name) ? "chimera-synapse" : "chimera-flux"}>{flying.has(name) ? "◆ working" : "◇ idle"}</span> {name}
                  </p>
                  <button type="button" className="chimera-button" onClick={() => dispatchAgent(name, selectedNodeId)}>
                    Dispatch{selectedNodeId ? ` → ${selectedNodeId}` : ""}
                  </button>
                </div>
                {agent && <p className="mt-1 text-[11px] chimera-muted">{agent.description}</p>}
                <p className="chimera-mono mt-1 text-[10px] chimera-muted">
                  model {agent?.model ?? "?"} · tools {(agent?.tools ?? []).join(", ")} · {changesBy(name)} change(s) this session
                </p>
                {crons.map((cron) => (
                  <p key={cron.name} className="chimera-mono mt-1 text-[10px]">
                    <span className="chimera-synapse">⏱ {cron.name}</span> <code>{cron.schedule}</code>{" "}
                    <span className={cron.enabled ? "chimera-flux" : "chimera-muted"}>{cron.enabled ? "● enabled" : "‖ paused until configured"}</span>
                    {showCronPreview && (
                      <span className="chimera-muted">
                        {" "}
                        · next ({offsetLabel(utcOffsetMinutes)}): {nextRuns?.[cron.name]?.join(", ") ?? "…"}
                      </span>
                    )}
                  </p>
                ))}
              </li>
            );
          })}
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
          Checkpoints are content hashes of lab changes with a suggested commit message. Nothing is committed to a repository.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(0,245,184,0.12)] pt-3">
        <button type="button" className="chimera-button" data-variant="primary" disabled={!app.ok} onClick={() => void download()} data-testid="chimera-crew-download">
          Download Kiro Crew App app.json Bundle
        </button>
        <code className="chimera-mono text-[11px] chimera-muted">kirocrew app install /absolute/path/to/chimera-lab</code>
        {downloadState && (
          <span className="chimera-mono text-[11px] chimera-flux" role="status">
            {downloadState}
          </span>
        )}
      </div>
    </section>
  );
};
