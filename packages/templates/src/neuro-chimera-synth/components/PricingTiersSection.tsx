import React from "react";
import { setLab, useLab } from "./lab-store.js";

export interface PricingTier {
  readonly name: string;
  readonly priceLabel: string;
  readonly cadence: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly ctaLabel: string;
  readonly highlighted: boolean;
}

export interface PricingTiersSectionProps {
  readonly heading: string;
  readonly footnote: string;
  readonly tiers: readonly PricingTier[];
}

/** Landing-page pricing tiers. CTAs open the lab workbench; wire them to checkout in your own app. */
export const PricingTiersSection: React.FC<PricingTiersSectionProps> = ({ heading, footnote, tiers }) => {
  const mode = useLab((s) => s.mode);
  if (mode !== "landing") return null;

  return (
    <section data-chimera-area="pricing" className="chimera-panel space-y-4" aria-label={heading} data-testid="chimera-pricing">
      <h2 className="chimera-heading">{heading}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`flex flex-col gap-3 rounded-lg border p-4 ${
              tier.highlighted ? "border-[#00F5B8] bg-[rgba(0,245,184,0.06)]" : "border-[rgba(0,245,184,0.18)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{tier.name}</h3>
              {tier.highlighted && <span className="chimera-badge chimera-flux">◆ Recommended</span>}
            </div>
            <p>
              <span className="chimera-mono text-2xl font-semibold">{tier.priceLabel}</span>{" "}
              <span className="chimera-mono text-[11px] chimera-muted">{tier.cadence}</span>
            </p>
            <p className="text-[13px] chimera-muted">{tier.description}</p>
            <ul className="flex-1 space-y-1">
              {tier.features.map((feature) => (
                <li key={feature} className="text-[13px]">
                  <span className="chimera-flux" aria-hidden="true">
                    ✓{" "}
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="chimera-button"
              data-variant={tier.highlighted ? "primary" : undefined}
              onClick={() => setLab({ mode: "workbench" })}
            >
              {tier.ctaLabel}
            </button>
          </article>
        ))}
      </div>
      <p className="chimera-mono text-[11px] chimera-muted">{footnote}</p>
    </section>
  );
};
