import React, { useState } from "react";
import { setCmosUi, useCmos, useCmosUi } from "./cmos-store.js";

export interface DevToolsHeroSectionProps {
  readonly eyebrow: string;
  readonly headline: string;
  readonly subheadline: string;
  readonly primaryCtaLabel: string;
  readonly installCommand: string;
  readonly features: readonly string[];
}

/** Landing-page hero for HARDWARE LANDING PAGE mode, with live numbers from the CMOS simulator. */
export const DevToolsHeroSection: React.FC<DevToolsHeroSectionProps> = ({
  eyebrow,
  headline,
  subheadline,
  primaryCtaLabel,
  installCommand,
  features,
}) => {
  const mode = useCmosUi((s) => s.mode);
  const t = useCmos((s) => s.telemetry);
  const [copied, setCopied] = useState(false);
  if (mode !== "landing") return null;

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(installCommand);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section data-cmos-area="hero" data-testid="cmos-landing-hero" className="cmos-frame cmos-landing-hero p-6 pt-8 space-y-5 min-w-0">
      <p className="cmos-small cmos-help">{eyebrow}</p>
      <h1>{headline}</h1>
      <p className="cmos-text max-w-prose">{subheadline}</p>
      <div className="flex flex-wrap items-center gap-3 cmos-text">
        <button type="button" className="cmos-button" data-variant="danger" onClick={() => setCmosUi({ mode: "setup" })}>
          {primaryCtaLabel}
        </button>
        <button type="button" className="cmos-button" onClick={copy} aria-label={`Copy install command: ${installCommand}`}>
          <code>{installCommand}</code> {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 cmos-small">
        {[
          ["EST. BURN", `$${t.monthlyCostUsd.toFixed(0)}/mo`],
          ["P99", `${t.p99LatencyMs.toFixed(0)} ms`],
          ["MAX RPS", t.maxRps.toLocaleString("en-US")],
          ["STABILITY", `${t.stabilityPct}%`],
        ].map(([label, value]) => (
          <div key={label} className="border-2 border-[#00AAAA] px-2 py-1">
            <dt className="cmos-help">{label}</dt>
            <dd className="cmos-value text-xl">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="cmos-text space-y-1">
        {features.map((feature) => (
          <li key={feature}>
            <span className="cmos-value">► </span>
            {feature}
          </li>
        ))}
      </ul>
    </section>
  );
};
