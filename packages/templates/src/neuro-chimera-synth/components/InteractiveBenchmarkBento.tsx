import React from "react";
import { getScenarioBenchmarks } from "../lib/chimera/benchmarks.js";
import { loadScenario, useLab } from "./lab-store.js";
import { formatMs } from "./format.js";

export interface ArchitectureCard {
  readonly tag: string;
  readonly title: string;
  readonly body: string;
}

export interface InteractiveBenchmarkBentoProps {
  readonly heading: string;
  readonly benchmarkCaption: string;
  readonly architecture: readonly ArchitectureCard[];
}

function speedup(before: number, after: number): string {
  if (!(after > 0) || !Number.isFinite(before)) return "—";
  const x = before / after;
  return x >= 10 ? `${x.toFixed(0)}×` : `${x.toFixed(1)}×`;
}

/**
 * Landing-page benchmark matrix (every scenario run through the real solver and optimizer agent)
 * plus the architecture bento grid. Selecting a row loads that scenario into the live canvas.
 */
export const InteractiveBenchmarkBento: React.FC<InteractiveBenchmarkBentoProps> = ({ heading, benchmarkCaption, architecture }) => {
  const mode = useLab((s) => s.mode);
  const scenarioId = useLab((s) => s.scenarioId);
  if (mode !== "landing") return null;
  const rows = getScenarioBenchmarks();

  return (
    <section data-chimera-area="bench" className="chimera-panel space-y-4" aria-label={heading} data-testid="chimera-benchmark-bento">
      <h2 className="chimera-heading">{heading}</h2>
      <div className="overflow-x-auto">
        <table className="chimera-table" data-testid="chimera-benchmark-matrix">
          <caption className="pb-2 text-left chimera-mono text-[11px] chimera-muted">{benchmarkCaption}</caption>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Mean request before</th>
              <th scope="col">After Crew</th>
              <th scope="col">Speed-up</th>
              <th scope="col">Full scans / s</th>
              <th scope="col">Health</th>
              <th scope="col">Changes</th>
              <th scope="col">
                <span className="sr-only">Load</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.scenarioId === scenarioId;
              return (
                <tr key={row.scenarioId} data-active={active}>
                  <th scope="row" className="font-normal">
                    {row.title}
                  </th>
                  <td className="chimera-mutation">{formatMs(row.before.meanRequestLatencyMs)}</td>
                  <td className="chimera-flux">{formatMs(row.after.meanRequestLatencyMs)}</td>
                  <td className="chimera-synapse">{speedup(row.before.meanRequestLatencyMs, row.after.meanRequestLatencyMs)}</td>
                  <td>
                    {row.before.fullScanRate.toFixed(0)} → {row.after.fullScanRate.toFixed(0)}
                  </td>
                  <td>
                    {Math.round(row.before.health * 100)}% → {Math.round(row.after.health * 100)}%
                  </td>
                  <td>{row.actions.length}</td>
                  <td>
                    <button
                      type="button"
                      className="chimera-button"
                      aria-pressed={active}
                      aria-label={`Load ${row.title} into the live network`}
                      onClick={() => loadScenario(row.scenarioId)}
                    >
                      {active ? "● Live" : "Load"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="chimera-bento" data-testid="chimera-architecture-bento">
        {architecture.map((card, i) => (
          <article key={`${card.title}-${i}`} className="rounded-lg border border-[rgba(0,245,184,0.18)] bg-[rgba(0,0,0,0.25)] p-4 space-y-1.5">
            <p className="chimera-badge chimera-synapse">{card.tag}</p>
            <h3 className="text-sm font-semibold">{card.title}</h3>
            <p className="text-[13px] leading-relaxed chimera-muted">{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
