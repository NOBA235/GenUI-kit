import React, { useEffect, useId, useRef, useState } from "react";
import {
  getAllEntries,
  getCategoryBySlug,
  getCategoryPhoto,
  getEntryBySlug,
  getEntryPhoto,
  getTimelineMilestones,
  queryArchiveEntries,
} from "../lib/archive/api.js";
import type { ArchiveSortOption, CategorySlug } from "../lib/archive/types.js";
import { useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

const DECADE_YEARS = [
  1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999,
] as const;

export interface TimelinePreviewProps {
  readonly sectionHeading: string;
  readonly initialYear: number;
  readonly displayMode: "preview" | "full";
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  sectionHeading,
  initialYear,
  displayMode,
}) => {
  const storeYear = useNinety9Store((s) => s.timelineYear);
  const setTimelineYear = useNinety9Store((s) => s.setTimelineYear);
  const openDossier = useNinety9Store((s) => s.openDossier);
  const navigateTo = useNinety9Store((s) => s.navigateTo);

  const clampedInitialYear =
    initialYear >= 1990 && initialYear <= 1999 ? initialYear : 1991;
  const [localYear, setLocalYear] = useState<number | "all">(clampedInitialYear);

  useEffect(() => {
    setLocalYear(clampedInitialYear);
  }, [clampedInitialYear]);

  const effectiveYear = displayMode === "full" ? storeYear : localYear;
  const tabIdPrefix = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const yearOptions: readonly (number | "all")[] =
    displayMode === "full" ? ["all", ...DECADE_YEARS] : DECADE_YEARS;

  const selectYear = (yr: number | "all") => {
    if (displayMode === "full") {
      setTimelineYear(yr);
    } else {
      setLocalYear(yr);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    let nextIndex = idx;
    if (e.key === "ArrowRight") {
      nextIndex = (idx + 1) % yearOptions.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (idx - 1 + yearOptions.length) % yearOptions.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = yearOptions.length - 1;
    }
    const nextOption = yearOptions[nextIndex]!;
    selectYear(nextOption);
    tabRefs.current[nextIndex]?.focus();
  };

  const milestones = getTimelineMilestones(effectiveYear);

  return (
    <section
      data-testid="ninety9-timeline-section"
      className="border-b-2 border-[#000000] bg-[#FFFFFF] n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#000000] pb-3">
          <div className="n99-grid-cell space-y-1">
            <h2 className="n99-font-mono n99-display-h2 font-bold uppercase tracking-tight">
              {sectionHeading}
            </h2>
            <p className="font-mono text-xs text-[#292929]">
              SELECT A DECADE YEAR TO INSPECT QUARTERLY CULTURAL &amp; TECHNICAL EVENTS
            </p>
          </div>
          {displayMode === "preview" && (
            <button
              type="button"
              onClick={() => {
                setTimelineYear("all");
                navigateTo("timeline");
              }}
              className="min-h-[36px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              FULL DECADE TIMELINE [02] →
            </button>
          )}
        </div>

        {/* Accessible Single-Row Scrollable Year Switcher */}
        <div
          role="tablist"
          aria-label="1990 to 1999 chronology selector"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {yearOptions.map((option, idx) => {
            const isSelected = effectiveYear === option;
            const label = option === "all" ? "ALL (1990–1999)" : String(option);
            return (
              <button
                key={label}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`${tabIdPrefix}-tab-${String(option)}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectYear(option)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                data-testid={`ninety9-timeline-year-${String(option)}`}
                className={`min-h-[38px] shrink-0 border-2 border-[#000000] px-3.5 py-1.5 font-mono text-xs font-bold uppercase transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#000000] text-[#FFFFFF] n99-shadow-sm"
                    : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-${String(effectiveYear)}`}
          tabIndex={0}
          className="n99-card-grid-3"
        >
          {milestones.map((milestone) => {
            const linked = milestone.linkedEntrySlug
              ? getEntryBySlug(milestone.linkedEntrySlug)
              : undefined;
            const category = getCategoryBySlug(milestone.category);

            return (
              <article
                key={milestone.id}
                className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold">
                    <span className="bg-[#000000] px-2 py-0.5 text-[#FFFFFF]">
                      {milestone.dateLabel}
                    </span>
                    <span className="text-[#292929]">
                      {milestone.year} // {milestone.quarter}
                    </span>
                  </div>

                  <h3 className="n99-font-mono text-sm font-bold uppercase leading-snug text-[#000000]">
                    {milestone.headline}
                  </h3>

                  <ArchivalMediaPlate
                    photo={
                      linked
                        ? getEntryPhoto(linked.slug)
                        : getCategoryPhoto(milestone.category)
                    }
                    fallbackSrc={
                      linked?.illustrationPath ??
                      category?.illustrationPath ??
                      "/images/ninety9/categories/pop-culture.svg"
                    }
                    fallbackAlt={`${milestone.headline} archival visual`}
                    fallbackCaption={`${milestone.year} // ${milestone.quarter}`}
                    aspectClassName="h-36"
                    priority="standard"
                    compact
                  />

                  <p className="text-xs leading-relaxed text-[#292929]">
                    {milestone.significance}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#000000] pt-3">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#292929]">
                    {category?.label ?? milestone.category}
                  </span>
                  {linked && (
                    <button
                      type="button"
                      onClick={() => openDossier(linked.slug)}
                      className="min-h-[32px] border border-[#000000] bg-[#D9D9D9] px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      INSPECT [{linked.serialNumber}] →
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export interface RandomTransmitProps {
  readonly frequencyLabel: string;
  readonly heading: string;
  readonly subheadline: string;
  readonly defaultSeed: number;
  readonly autoExpandTelemetry: boolean;
}

export const RandomTransmit: React.FC<RandomTransmitProps> = ({
  frequencyLabel,
  heading,
  subheadline,
  autoExpandTelemetry,
}) => {
  const packet = useNinety9Store((s) => s.transmitPacket);
  const transmissionCount = useNinety9Store((s) => s.transmissionCount);
  const retransmitRandomPacket = useNinety9Store((s) => s.retransmitRandomPacket);
  const openDossier = useNinety9Store((s) => s.openDossier);

  const [isTuning, setIsTuning] = useState(false);
  const [tuningFreq, setTuningFreq] = useState("99.4 MHZ");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRetransmit = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      retransmitRandomPacket();
      setTuningFreq("99.4 MHZ");
      setIsTuning(false);
      return;
    }

    setIsTuning(true);
    setTuningFreq("96.8 MHZ");
    timerRef.current = window.setTimeout(() => {
      retransmitRandomPacket();
      setTuningFreq("99.4 MHZ");
      setIsTuning(false);
    }, 260);
  };

  const { entry, category } = packet;

  return (
    <section
      data-testid="ninety9-random-transmit"
      className="border-b-2 border-[#000000] n99-halftone-light n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px]">
        <div className="n99-shadow-md n99-card-pad border-2 border-[#000000] bg-[#FFFFFF]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#000000] pb-4">
            <div className="n99-grid-cell space-y-1">
              <div className="inline-block border border-[#000000] bg-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#FFFFFF]">
                {frequencyLabel} // LOCKED @ {tuningFreq}
              </div>
              <h2 className="n99-font-mono n99-display-h2 font-bold uppercase tracking-tight">
                {heading}
              </h2>
              <p className="text-xs text-[#292929]">{subheadline}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRetransmit}
                data-testid="ninety9-retransmit-btn"
                className="n99-shadow-sm n99-touch-btn border-2 border-[#000000] bg-[#000000] px-4 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#D9D9D9] hover:text-[#000000] transition-colors cursor-pointer"
              >
                {isTuning ? "TUNING CARRIER..." : "RE-TRANSMIT [99.4 MHZ]"}
              </button>
              <button
                type="button"
                onClick={() => openDossier(entry.slug)}
                data-testid="ninety9-transmit-inspect-btn"
                className="n99-shadow-sm n99-touch-btn border-2 border-[#000000] bg-[#FFFFFF] px-4 py-2 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                INSPECT DOSSIER →
              </button>
            </div>
          </div>

          <div
            aria-live="polite"
            className="mt-5 n99-split-md-12"
          >
            <div className="n99-grid-cell n99-md-span-5">
              <div className="space-y-1.5">
                <ArchivalMediaPlate
                  photo={getEntryPhoto(entry.slug)}
                  fallbackSrc={entry.illustrationPath}
                  fallbackAlt={`Transmitted plate for ${entry.title}`}
                  fallbackCaption={`${packet.packetId} // ${packet.baudLabel}`}
                  aspectClassName="h-56 sm:h-60"
                  priority="standard"
                />
                <div className="flex flex-wrap justify-between gap-2 border border-[#000000] bg-[#D9D9D9] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#000000]">
                  <span>{packet.packetId}</span>
                  <span>{packet.baudLabel}</span>
                </div>
              </div>
            </div>

            <div className="n99-grid-cell n99-md-span-7 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold">
                  <span className="border border-[#000000] bg-[#D9D9D9] px-2 py-0.5">
                    PACKET #{String(transmissionCount).padStart(3, "0")}
                  </span>
                  <span className="border border-[#000000] px-2 py-0.5">
                    {category.label}
                  </span>
                  <span className="border border-[#000000] px-2 py-0.5">
                    {entry.year} // {entry.type}
                  </span>
                </div>

                <h3
                  data-testid="ninety9-transmitted-title"
                  className="n99-font-mono n99-display-h2 n99-wrap-anywhere font-bold uppercase tracking-tight text-[#000000]"
                >
                  {entry.title}
                </h3>
                <p className="font-mono text-xs font-bold text-[#292929]">
                  {entry.subtitle}
                </p>
                <p className="text-sm leading-relaxed text-[#292929]">
                  {entry.summary}
                </p>
              </div>

              {autoExpandTelemetry && (
                <dl className="n99-card-grid-4 border-2 border-[#000000] bg-[#D9D9D9] p-3 font-mono text-xs">
                  {entry.specs.map((spec) => (
                    <div key={spec.label} className="n99-grid-cell">
                      <dt className="text-[10px] uppercase text-[#292929]">{spec.label}</dt>
                      <dd className="n99-wrap-anywhere font-bold text-[#000000]">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export interface RecentArchiveProps {
  readonly heading: string;
  readonly initialCategory: CategorySlug | "all";
  readonly initialYearFilter: string;
  readonly initialSort: ArchiveSortOption;
  readonly limitCount: number;
}

export const RecentArchive: React.FC<RecentArchiveProps> = ({
  heading,
  initialCategory,
  initialYearFilter,
  initialSort,
  limitCount,
}) => {
  const openDossier = useNinety9Store((s) => s.openDossier);
  const navigateTo = useNinety9Store((s) => s.navigateTo);

  const parsedYear: number | "all" =
    initialYearFilter !== "all" && /^\d{4}$/.test(initialYearFilter)
      ? Number(initialYearFilter)
      : "all";

  const filtered = queryArchiveEntries({
    category: initialCategory,
    year: parsedYear,
    sort: initialSort,
  });
  const items = (filtered.length > 0 ? filtered : getAllEntries()).slice(
    0,
    limitCount,
  );

  return (
    <section
      data-testid="ninety9-recent-archive"
      className="n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#000000] pb-2">
          <h2 className="n99-font-mono n99-display-h2 font-bold uppercase tracking-tight">
            {heading}
          </h2>
          <button
            type="button"
            onClick={() =>
              navigateTo("archive", {
                category: initialCategory,
                year: parsedYear,
                sortBy: initialSort,
              })
            }
            className="min-h-[36px] border-2 border-[#000000] bg-[#000000] px-3.5 py-1.5 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
          >
            VIEW ALL 34 DOSSIERS →
          </button>
        </div>

        <div className="n99-card-grid-3">
          {items.map((item) => (
            <article
              key={item.slug}
              className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                  <span className="border border-[#000000] bg-[#D9D9D9] px-2 py-0.5">
                    {item.serialNumber}
                  </span>
                  <span>
                    {item.year} // CAT-{item.categoryCode}
                  </span>
                </div>

                <ArchivalMediaPlate
                  photo={getEntryPhoto(item.slug)}
                  fallbackSrc={item.illustrationPath}
                  fallbackAlt={`Archival visual preview for ${item.title}`}
                  fallbackCaption={item.serialNumber}
                  aspectClassName="h-40"
                  priority="standard"
                  compact
                />

                <div>
                  <h3 className="n99-font-mono text-base font-bold uppercase leading-snug text-[#000000]">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] font-bold text-[#292929]">
                    {item.creatorOrPublisher}
                  </p>
                </div>

                <p className="line-clamp-3 text-xs leading-relaxed text-[#292929]">
                  {item.summary}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openDossier(item.slug)}
                className="mt-4 min-h-[38px] w-full border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                OPEN DOSSIER [{item.id}] →
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
