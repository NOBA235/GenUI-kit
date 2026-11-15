import React, { useState } from "react";
import { setLab, useLab } from "./lab-store.js";
import { formatMs } from "./format.js";

export interface BiotechHeroSectionProps {
  readonly eyebrow: string;
  readonly headline: string;
  readonly subheadline: string;
  readonly primaryCtaLabel: string;
  readonly installCommand: string;
  readonly features: readonly string[];
}

/** Landing-page hero for AI RESEARCH SAAS LANDING PAGE mode, with live figures from the running network. */
export const BiotechHeroSection: React.FC<BiotechHeroSectionProps> = ({
  eyebrow,
  headline,
  subheadline,
  primaryCtaLabel,
  installCommand,
  features,
}) => {
  const mode = useLab((s) => s.mode);
  const health = useLab((s) => s.telemetry.health);
  const latency = useLab((s) => s.telemetry.meanRequestLatencyMs);
  const fullScans = useLab((s) => s.telemetry.fullScanRate);
  const changes = useLab((s) => s.feed.length);
  const [copied, setCopied] = useState<string | null>(null);

  if (mode !== "landing") return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied("Copied");
    } catch {
      setCopied("Copy failed: select the command and copy it manually");
    }
  };

  const stats = [
    { label: "Network health", value: `${Math.round(health * 100)}%`, tone: health >= 0.6 ? "chimera-flux" : health >= 0.3 ? "chimera-synapse" : "chimera-mutation" },
    { label: "Mean request", value: formatMs(latency), tone: "chimera-flux" },
    { label: "Full scans / s", value: fullScans.toFixed(0), tone: fullScans > 0.5 ? "chimera-mutation" : "chimera-flux" },
    { label: "Lab changes", value: String(changes), tone: "chimera-synapse" },
  ] as const;

  return (
    <section data-chimera-area="hero" className="chimera-panel chimera-hero space-y-5" aria-label="Introduction" data-testid="chimera-landing-hero">
      <p className="chimera-heading">{eyebrow}</p>
      <h1>
        <span className="chimera-gradient-text">{headline}</span>
      </h1>
      <p className="max-w-[60ch] text-base leading-relaxed chimera-muted">{subheadline}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="chimera-button" data-variant="primary" onClick={() => setLab({ mode: "workbench" })}>
          {primaryCtaLabel}
        </button>
        <code className="chimera-code !max-h-none !py-2">{installCommand}</code>
        <button type="button" className="chimera-button" onClick={() => void copy()}>
          Copy
        </button>
        {copied && (
          <span role="status" className="chimera-mono text-[11px] chimera-muted">
            {copied}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Live lab figures">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[rgba(0,245,184,0.12)] p-2.5">
            <dt className="chimera-mono text-[10px] uppercase tracking-wider chimera-muted">{s.label}</dt>
            <dd className={`chimera-mono text-lg font-semibold ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="text-sm">
            <span className="chimera-flux" aria-hidden="true">
              ◆{" "}
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </section>
  );
};
