import React, { useEffect } from "react";
import { CHIMERA_SCENARIOS } from "../lib/chimera/scenarios.js";
import { disposeChimeraSonifier, getChimeraSonifier } from "../lib/chimera/sonifier.js";
import { formatMs } from "./format.js";
import { dispatchAgent, getLabStore, loadScenario, setLab, stepLab, useLab, type CrewAgentName, type LabMode } from "./lab-store.js";

export interface ChimeraLabShellProps {
  readonly workspaceTitle: string;
  readonly defaultMode: LabMode;
  readonly scenarioId: string;
  /** Step the solver on a timer while running. */
  readonly autoStep: boolean;
  /** Solver steps per second (1–20). React publishes at most 10 times per second. */
  readonly stepHz: number;
  /** Dispatch the three Crew agents one after another when the spec loads. */
  readonly nightShift: boolean;
  readonly children?: React.ReactNode;
}

const MIN_PUBLISH_INTERVAL_MS = 100;
/** Night-shift order: batch N+1 loops first, then the best index, then a full audit. */
const NIGHT_SHIFT: ReadonlyArray<readonly [CrewAgentName, number]> = [
  ["deadlock-hunter", 400],
  ["index-surgeon", 1400],
  ["chimera-architect", 2400],
];

/** Timer interval and steps per tick so the store publishes at most 10 times per second. */
export function stepSchedule(stepHz: number): { readonly intervalMs: number; readonly stepsPerTick: number } {
  const hz = Number.isFinite(stepHz) ? Math.min(20, Math.max(1, stepHz)) : 10;
  const intervalMs = Math.max(MIN_PUBLISH_INTERVAL_MS, 1000 / hz);
  return { intervalMs, stepsPerTick: Math.max(1, Math.round((hz * intervalMs) / 1000)) };
}

/**
 * Root of CHIMERA // LAB. Owns the mode switch (CHIMERA LAB WORKBENCH vs AI RESEARCH SAAS LANDING
 * PAGE), the scenario picker, the solver timer, the night-shift agent run and the sonifier. Child
 * modules place themselves on the grid with `data-chimera-area`.
 */
export const ChimeraLabShell: React.FC<ChimeraLabShellProps> = ({
  workspaceTitle,
  defaultMode,
  scenarioId,
  autoStep,
  stepHz,
  nightShift,
  children,
}) => {
  const mode = useLab((s) => s.mode);
  const running = useLab((s) => s.running);
  const activeScenario = useLab((s) => s.scenarioId);
  const notice = useLab((s) => s.notice);
  const tick = useLab((s) => s.telemetry.tick);
  const health = useLab((s) => s.telemetry.health);
  const latency = useLab((s) => s.telemetry.meanRequestLatencyMs);
  const fullScans = useLab((s) => s.telemetry.fullScanRate);
  const cost = useLab((s) => s.telemetry.costUnitsPerSecond);

  useEffect(() => {
    setLab({ mode: defaultMode });
  }, [defaultMode]);

  useEffect(() => {
    loadScenario(scenarioId);
  }, [scenarioId]);

  useEffect(() => {
    if (!autoStep || !running) return;
    const { intervalMs, stepsPerTick } = stepSchedule(stepHz);
    const timer = window.setInterval(() => {
      if (!document.hidden) stepLab(stepsPerTick);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoStep, running, stepHz]);

  useEffect(() => {
    if (!nightShift) return;
    const timers = NIGHT_SHIFT.map(([agent, delay]) => window.setTimeout(() => dispatchAgent(agent), delay));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [nightShift, scenarioId]);

  // Sonifier: follow telemetry and audio controls once audio is unlocked; dispose on unmount.
  useEffect(() => {
    const store = getLabStore();
    const apply = (full: boolean) => {
      const s = store.getState();
      if (!s.audioUnlocked) return;
      const sonifier = getChimeraSonifier();
      if (full) {
        sonifier.setMuted(s.audioMuted);
        sonifier.setVolume(s.audioVolume);
        sonifier.setRootFrequency(s.rootHz);
      }
      sonifier.update(s.telemetry);
    };
    apply(true);
    const unsubscribe = store.subscribe((s, prev) => {
      const controlsChanged =
        s.audioUnlocked !== prev.audioUnlocked || s.audioMuted !== prev.audioMuted || s.audioVolume !== prev.audioVolume || s.rootHz !== prev.rootHz;
      if (controlsChanged || s.telemetry !== prev.telemetry) apply(controlsChanged);
    });
    return () => {
      unsubscribe();
      disposeChimeraSonifier();
      setLab({ audioUnlocked: false });
    };
  }, []);

  const healthTone = health >= 0.6 ? "chimera-flux" : health >= 0.3 ? "chimera-synapse" : "chimera-mutation";

  return (
    <div className="relative" data-testid="chimera-lab-shell">
      <div className="chimera-workspace" data-chimera-mode={mode}>
        <nav data-chimera-area="top" aria-label="Lab controls" className="chimera-panel flex flex-wrap items-center justify-between gap-3 !py-2.5">
          <div className="min-w-0">
            <p className="chimera-heading">{workspaceTitle}</p>
            <p className="chimera-mono text-[11px] chimera-muted">
              tick {tick} · <span className={healthTone}>health {Math.round(health * 100)}%</span> · {formatMs(latency)} / request ·{" "}
              <span className={fullScans > 0.5 ? "chimera-mutation" : undefined}>{fullScans.toFixed(0)} full scans/s</span> · {cost.toFixed(0)} cost
              units/s
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Mode" className="flex flex-wrap gap-1.5">
              {(["workbench", "landing"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="chimera-button"
                  aria-pressed={mode === m}
                  data-testid={`chimera-mode-${m}`}
                  onClick={() => setLab({ mode: m, selectedNodeId: null })}
                >
                  {`[MODE: ${m === "workbench" ? "CHIMERA LAB WORKBENCH" : "AI RESEARCH SAAS LANDING PAGE"}]`}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 chimera-mono text-[11px] chimera-muted">
              Scenario
              <select className="chimera-input !w-auto !py-1" value={activeScenario} onChange={(e) => loadScenario(e.target.value)}>
                {CHIMERA_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="chimera-button" aria-pressed={running} onClick={() => setLab({ running: !running })}>
              {running ? "❚❚ Pause" : "▶ Run"}
            </button>
            <button type="button" className="chimera-button" disabled={running} onClick={() => stepLab(1)}>
              Step
            </button>
            <button type="button" className="chimera-button" onClick={() => loadScenario(activeScenario, true)}>
              Reset
            </button>
          </div>
          <p className="basis-full chimera-mono text-[11px] chimera-synapse" role="status" aria-live="polite" data-testid="chimera-notice">
            {notice ?? ""}
          </p>
        </nav>
        {children}
      </div>
    </div>
  );
};
