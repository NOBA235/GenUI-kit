import React from "react";
import { useCmos } from "./cmos-store.js";

export interface HardwareTelemetryMonitorProps {
  readonly heading: string;
  readonly showCostBreakdown: boolean;
}

function bar(fraction: number, width = 18): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return `${"#".repeat(filled)}${".".repeat(width - filled)}`;
}

/** "PC Health Status" panel: live cost, P99, throughput, thermal, power and stability. */
export const HardwareTelemetryMonitor: React.FC<HardwareTelemetryMonitorProps> = ({ heading, showCostBreakdown }) => {
  const t = useCmos((s) => s.telemetry);
  const draft = useCmos((s) => s.draft);
  const throttleC = draft.health.throttleC;

  const rows: ReadonlyArray<readonly [string, string, number, boolean]> = [
    ["Monthly Burn (est.)", `$${t.monthlyCostUsd.toFixed(2)}`, t.budgetUsage, t.budgetUsage > 1],
    ["P99 Latency", `${t.p99LatencyMs.toFixed(1)} ms`, t.p99LatencyMs / 1000, t.p99LatencyMs > 1000],
    ["Max Throughput", `${t.maxRps.toLocaleString("en-US")} rps`, t.peakDemandRps / Math.max(1, t.maxRps), t.rejectedShare > 0],
    ["CPU Temperature", `${t.thermalC.toFixed(1)} C`, t.thermalC / 100, t.thermalC > throttleC],
    ["Rated Package Power", `${t.powerDrawW.toFixed(1)} W`, t.powerDrawW / 80, false],
    ["System Stability", `${t.stabilityPct}%`, t.stabilityPct / 100, t.stabilityPct < 60],
  ];

  return (
    <section
      data-cmos-area="telemetry"
      className="cmos-frame p-3 pt-5 min-w-0"
      aria-label={heading}
      data-testid="cmos-telemetry-monitor"
    >
      <span className="cmos-frame-title cmos-text">{heading}</span>
      <dl className="cmos-small grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: "auto 1fr auto" }}>
        {rows.map(([label, value, fraction, bad]) => (
          <React.Fragment key={label}>
            <dt className="cmos-help">{label}</dt>
            <dd className="text-[#00AAAA] overflow-hidden whitespace-nowrap" aria-hidden="true">
              [{bar(fraction)}]
            </dd>
            <dd className={bad ? "text-[#FFFF55] bg-[#AA0000] px-1" : "cmos-value"}>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="cmos-small pt-1">
        <span className="cmos-help">Bottleneck: </span>
        <span className="cmos-value">{t.bottleneck.toUpperCase()}</span>
        <span className="cmos-help"> | Peak {t.peakDemandRps.toLocaleString("en-US")} rps</span>
        {t.rejectedShare > 0 && <span className="text-[#FFFF55]"> | Shedding {Math.round(t.rejectedShare * 100)}%</span>}
      </p>
      <div aria-live="polite" className="cmos-small pt-1 space-y-0.5" data-testid="cmos-telemetry-alarms">
        {t.alarms.length === 0 ? (
          <p className="cmos-help">No alarms. All registers within spec.</p>
        ) : (
          t.alarms.map((a) => (
            <p key={a.code} className={a.severity === "fail" ? "bg-[#AA0000] text-[#FFFF55] px-1" : "text-[#FFFF55]"}>
              {a.severity === "fail" ? "!! " : "-- "}
              {a.code}: {a.message}
            </p>
          ))
        )}
      </div>
      {showCostBreakdown && (
        <table className="cmos-small w-full pt-2 mt-1 border-t border-[#00AAAA]">
          <caption className="sr-only">Estimated monthly cost breakdown</caption>
          <tbody>
            {t.costBreakdown.map((line) => (
              <tr key={line.id}>
                <td className="cmos-help pr-2">{line.label}</td>
                <td className="cmos-value text-right">${line.usd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
