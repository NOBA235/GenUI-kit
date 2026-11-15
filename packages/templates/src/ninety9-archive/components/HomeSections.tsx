import React from "react";
import {
  getAllCategories,
  getAllEntries,
  getArchiveStats,
  getCategoryBySlug,
  getCategoryPhoto,
  getEntryBySlug,
  getEntryPhoto,
  getHighlightPhotos,
  queryArchiveEntries,
} from "../lib/archive/api.js";
import type { ArcadeCartridgeId } from "../arcade/types.js";
import type { CategorySlug } from "../lib/archive/types.js";
import { useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

export interface HeroSectionProps {
  readonly classificationBadge: string;
  readonly headline: string;
  readonly subheadline: string;
  readonly quote: string;
  readonly quoteAttribution: string;
  readonly primaryCtaLabel: string;
  readonly secondaryCtaLabel: string;
  readonly inkHex: string;
  readonly surfaceHex: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  classificationBadge,
  headline,
  subheadline,
  quote,
  quoteAttribution,
  primaryCtaLabel,
  secondaryCtaLabel,
  inkHex,
  surfaceHex,
}) => {
  const stats = getArchiveStats();
  const navigateTo = useNinety9Store((s) => s.navigateTo);
  const retransmitRandomPacket = useNinety9Store((s) => s.retransmitRandomPacket);
  const requestImmediateArcadeBoot = useNinety9Store(
    (s) => s.requestImmediateArcadeBoot
  );

  const handleHeroBootGame = (cartridge?: ArcadeCartridgeId) => {
    const bay =
      typeof document !== "undefined"
        ? document.getElementById("ninety9-arcade-bay")
        : null;
    if (!bay) {
      if (cartridge) {
        requestImmediateArcadeBoot(cartridge);
      }
      navigateTo("arcade");
      return;
    }
    requestImmediateArcadeBoot(cartridge);
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bay.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const safeInk = inkHex || "#000000";
  const safeSurface = surfaceHex || "#FFFFFF";
  const isDarkInverted = safeSurface === "#000000" && safeInk === "#FFFFFF";
  const textTone = isDarkInverted ? "#FFFFFF" : "#000000";
  const bgTone = isDarkInverted ? "#000000" : "#FFFFFF";

  return (
    <section
      data-testid="ninety9-hero-section"
      className="border-b-2 border-[#000000] n99-section-pad"
      style={{ backgroundColor: bgTone, color: textTone }}
    >
      <div className="mx-auto max-w-[1380px] space-y-6 sm:space-y-8">
        <div className="n99-split-hero">
          {/* Left Masthead Column */}
          <div className="n99-grid-cell space-y-5 sm:space-y-6">
            <div className="inline-block border-2 border-[#000000] bg-[#000000] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#FFFFFF]">
              {classificationBadge}
            </div>

            <h1 className="n99-font-mono n99-display-hero n99-wrap-anywhere font-bold uppercase tracking-tight">
              {headline}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[#292929]">
              {subheadline}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigateTo("archive")}
                data-testid="ninety9-hero-primary-cta"
                className="n99-shadow-md n99-touch-btn border-2 border-[#000000] bg-[#000000] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer sm:px-5"
              >
                {primaryCtaLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  retransmitRandomPacket();
                  navigateTo("random-transmit");
                }}
                data-testid="ninety9-hero-secondary-cta"
                className="n99-shadow-md n99-touch-btn border-2 border-[#000000] bg-[#FFFFFF] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#000000] hover:bg-[#D9D9D9] transition-colors cursor-pointer sm:px-5"
              >
                {secondaryCtaLabel}
              </button>
              <button
                type="button"
                onClick={() => handleHeroBootGame()}
                data-testid="ninety9-hero-arcade-cta"
                className="n99-shadow-md n99-touch-btn border-2 border-[#000000] bg-[#D9D9D9] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer sm:px-5"
              >
                BOOT NINETY9 ARCADE [05]
              </button>
            </div>

            {/* Instant Hero Game Launcher Bay Strip */}
            <div className="border-2 border-[#000000] bg-[#D9D9D9] p-3 font-mono text-xs text-[#000000]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold uppercase tracking-wider">
                  PLAY WORKSTATION ARCADE IMMEDIATELY BELOW ↓
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "packet-invaders", label: "▶ PACKET INVADERS" },
                      { id: "serpent-98", label: "▶ SERPENT-98" },
                      { id: "break-grid", label: "▶ BREAK-GRID" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleHeroBootGame(item.id)}
                      data-testid={`ninety9-hero-quickboot-${item.id}`}
                      className="min-h-[34px] border-2 border-[#000000] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Archival Pull Quote & Technical Telemetry Plate */}
          <aside className="n99-halftone-light n99-shadow-md n99-card-pad flex flex-col justify-between border-2 border-[#000000] text-[#000000]">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#000000] pb-2 font-mono text-[11px] font-bold uppercase">
                <span>STATION DECLARATION</span>
                <span>REV 1990–1999</span>
              </div>
              <blockquote className="font-mono text-base font-bold leading-snug text-[#000000]">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#292929]">
                — {quoteAttribution}
              </p>
            </div>

            <div className="mt-6 border-2 border-[#000000] bg-[#FFFFFF] p-3 font-mono text-[11px]">
              <div className="font-bold uppercase text-[#000000]">
                STRICT 5-TONE HEX LAW ACTIVE
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {[
                  { hex: "#FFFFFF", label: "FFF" },
                  { hex: "#D9D9D9", label: "D9D" },
                  { hex: "#808080", label: "808" },
                  { hex: "#292929", label: "292" },
                  { hex: "#000000", label: "000" },
                ].map((tone) => (
                  <div
                    key={tone.hex}
                    className="border border-[#000000] p-1 text-center"
                    style={{
                      backgroundColor: tone.hex,
                      color:
                        tone.hex === "#000000" || tone.hex === "#292929"
                          ? "#FFFFFF"
                          : "#000000",
                    }}
                  >
                    <span className="text-[9px] font-bold">{tone.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {getHighlightPhotos()
                  .slice(0, 3)
                  .map((photo) => (
                    <div
                      key={photo.key}
                      className="border border-[#000000] bg-[#FFFFFF] p-0.5"
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        width={photo.width}
                        height={photo.height}
                        decoding="async"
                        className="n99-archival-photo h-14 w-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </aside>
        </div>

        {/* 4-Card Metrics Strip */}
        <div className="n99-card-grid-4">
          {[
            {
              code: "METRIC // 01",
              value: `${stats.totalEntries}`,
              label: "ARCHIVED DOSSIERS",
              sub: "COMPLETE MULTI-SECTION PLATES",
            },
            {
              code: "METRIC // 02",
              value: `${stats.totalCategories}`,
              label: "INDEXED SECTORS",
              sub: "MUSIC TO Y2K INCIDENT",
            },
            {
              code: "METRIC // 03",
              value: `${stats.yearSpan[0]}–${stats.yearSpan[1]}`,
              label: "DECADE COVERAGE",
              sub: `${stats.totalMilestones} VERIFIED MILESTONES`,
            },
            {
              code: "METRIC // 04",
              value: `${stats.paletteHexCount}-TONE`,
              label: "WHITE MONOCHROME",
              sub: "ZERO OFF-PALETTE EXCEPTIONS",
            },
          ].map((card) => (
            <div
              key={card.code}
              className="n99-shadow-sm border-2 border-[#000000] bg-[#FFFFFF] p-4 text-[#000000]"
            >
              <div className="font-mono text-[10px] font-bold uppercase text-[#292929]">
                {card.code}
              </div>
              <div className="n99-font-retro mt-1 text-4xl font-bold leading-none text-[#000000]">
                {card.value}
              </div>
              <div className="mt-2 font-mono text-xs font-bold uppercase text-[#000000]">
                {card.label}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[#292929]">
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export interface FeaturedSectionProps {
  readonly sectionHeading: string;
  readonly leadSlug: string;
  readonly secondarySlugs: readonly string[];
  readonly panelSurfaceHex: string;
}

export const FeaturedSection: React.FC<FeaturedSectionProps> = ({
  sectionHeading,
  leadSlug,
  secondarySlugs,
  panelSurfaceHex,
}) => {
  const openDossier = useNinety9Store((s) => s.openDossier);
  const allEntries = getAllEntries();
  const lead = getEntryBySlug(leadSlug) ?? allEntries[0]!;
  const secondary = secondarySlugs
    .map((slug) => getEntryBySlug(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 4);

  const secondaryFilled =
    secondary.length > 0
      ? secondary
      : allEntries.filter((e) => e.slug !== lead.slug).slice(0, 4);

  const safeBg = panelSurfaceHex === "#000000" ? "#FFFFFF" : panelSurfaceHex || "#FFFFFF";

  return (
    <section
      data-testid="ninety9-featured-section"
      className="border-b-2 border-[#000000] n99-section-pad text-[#000000]"
      style={{ backgroundColor: safeBg }}
    >
      <div className="mx-auto max-w-[1380px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#000000] pb-2">
          <h2 className="n99-font-mono n99-display-h2 font-bold uppercase tracking-tight">
            {sectionHeading}
          </h2>
          <span className="font-mono text-xs font-bold uppercase text-[#292929]">
            LEAD + 04 SECONDARY TRANSMISSIONS
          </span>
        </div>

        {/* Large Split Lead Dossier */}
        <article className="n99-shadow-md n99-split-12-flush border-2 border-[#000000] bg-[#FFFFFF]">
          <div className="n99-split-divider n99-lg-span-6 bg-[#FFFFFF] p-4">
            <ArchivalMediaPlate
              photo={getEntryPhoto(lead.slug)}
              fallbackSrc={lead.illustrationPath}
              fallbackAlt={`Technical schematic plate for ${lead.title}`}
              fallbackCaption={`PLATE // ${lead.serialNumber} — ${lead.illustrationMotif.toUpperCase()} SCHEMATIC`}
              aspectClassName="h-56 sm:h-72"
              priority="hero"
            />
          </div>

          <div className="n99-card-pad n99-lg-span-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold">
                <span className="border border-[#000000] bg-[#000000] px-2 py-0.5 text-[#FFFFFF]">
                  LEAD DOSSIER // {lead.serialNumber}
                </span>
                <span className="border border-[#000000] bg-[#D9D9D9] px-2 py-0.5 text-[#000000]">
                  {lead.year} // {lead.type}
                </span>
              </div>

              <div>
                <h3 className="n99-font-mono n99-display-h2 n99-wrap-anywhere font-bold uppercase tracking-tight text-[#000000]">
                  {lead.title}
                </h3>
                <p className="mt-1 font-mono text-xs font-bold text-[#292929]">
                  {lead.creatorOrPublisher} · {lead.origin}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-[#292929]">{lead.summary}</p>

              <dl className="n99-card-grid-2 border-2 border-[#000000] bg-[#D9D9D9] p-3 font-mono text-[11px]">
                {lead.specs.map((spec) => (
                  <div key={spec.label} className="n99-grid-cell">
                    <dt className="text-[10px] uppercase text-[#292929]">{spec.label}</dt>
                    <dd className="n99-wrap-anywhere font-bold text-[#000000]">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#000000] pt-4">
              <span className="font-mono text-xs font-bold text-[#292929]">
                CAT-{lead.categoryCode} // {getCategoryBySlug(lead.category)?.shortLabel}
              </span>
              <button
                type="button"
                onClick={() => openDossier(lead.slug)}
                data-testid={`ninety9-inspect-${lead.slug}`}
                className="n99-shadow-sm min-h-[40px] border-2 border-[#000000] bg-[#000000] px-4 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#D9D9D9] hover:text-[#000000] transition-colors cursor-pointer"
              >
                INSPECT DOSSIER →
              </button>
            </div>
          </div>
        </article>

        {/* 4 Secondary Dithered Monochrome Cards */}
        <div className="n99-card-grid-4">
          {secondaryFilled.map((item) => (
            <article
              key={item.slug}
              className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold">
                  <span className="bg-[#000000] px-1.5 py-0.5 text-[#FFFFFF]">
                    {item.year}
                  </span>
                  <span className="text-[#292929]">{item.serialNumber}</span>
                </div>

                <ArchivalMediaPlate
                  photo={getEntryPhoto(item.slug)}
                  fallbackSrc={item.illustrationPath}
                  fallbackAlt={`${item.title} archival plate`}
                  fallbackCaption={item.serialNumber}
                  aspectClassName="h-40"
                  priority="standard"
                  compact
                />

                <div className="space-y-1">
                  <h4 className="n99-font-mono text-sm font-bold uppercase leading-snug text-[#000000]">
                    {item.title}
                  </h4>
                  <p className="font-mono text-[11px] font-bold text-[#292929]">
                    {item.type}
                  </p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-[#292929]">
                    {item.summary}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDossier(item.slug)}
                className="mt-4 min-h-[36px] w-full border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                READ PLATE [{item.serialNumber}] →
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export interface CategoryGridProps {
  readonly sectionHeading: string;
  readonly subcaption: string;
  readonly highlightCategory: CategorySlug | "all";
  readonly showEssaysPreview: boolean;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  sectionHeading,
  subcaption,
  highlightCategory,
  showEssaysPreview,
}) => {
  const categories = getAllCategories();
  const navigateTo = useNinety9Store((s) => s.navigateTo);

  return (
    <section
      data-testid="ninety9-category-grid"
      className="border-b-2 border-[#000000] bg-[#FFFFFF] n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#000000] pb-3">
          <div className="n99-grid-cell space-y-1">
            <h2 className="n99-font-mono n99-display-h2 font-bold uppercase tracking-tight">
              {sectionHeading}
            </h2>
            <p className="text-xs text-[#292929]">{subcaption}</p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo("categories")}
            className="min-h-[36px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          >
            OPEN SECTOR ESSAYS [03] →
          </button>
        </div>

        <div className="n99-card-grid-3">
          {categories.map((cat) => {
            const count = queryArchiveEntries({ category: cat.slug }).length;
            const isHighlighted = highlightCategory === cat.slug;
            return (
              <article
                key={cat.slug}
                className={`n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] p-4 ${
                  isHighlighted ? "bg-[#D9D9D9]" : "bg-[#FFFFFF]"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs font-bold">
                    <span className="border border-[#000000] bg-[#000000] px-2 py-0.5 text-[#FFFFFF]">
                      {cat.label}
                    </span>
                    <span className="text-[#000000]">{count} PLATES</span>
                  </div>

                  <ArchivalMediaPlate
                    photo={getCategoryPhoto(cat.slug)}
                    fallbackSrc={cat.illustrationPath}
                    fallbackAlt={`${cat.shortLabel} sector monograph preview`}
                    fallbackCaption={`SECTOR // CAT-${cat.code}`}
                    aspectClassName="h-32"
                    priority="standard"
                    compact
                  />

                  <p className="text-xs font-bold leading-snug text-[#000000]">
                    {cat.tagline}
                  </p>

                  {showEssaysPreview && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-[#292929]">
                      {cat.decadeShiftNote}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#000000] pt-3">
                  <span className="font-mono text-[10px] font-bold text-[#292929]">
                    KEYS: {cat.keyYears.join(" / ")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      navigateTo("archive", {
                        category: cat.slug,
                        year: "all",
                        query: "",
                      })
                    }
                    className="min-h-[32px] border border-[#000000] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                  >
                    FILTER ARCHIVE →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
