import React, { useEffect, useState } from "react";
import {
  getAllArchivalPhotos,
  getAllCategories,
  getArchiveStats,
  getCategoryPhoto,
  getCategoryWithEntries,
  getHighlightPhotos,
} from "../lib/archive/api.js";
import {
  MONOCHROME_PALETTE,
  type CategorySlug,
  type CRTMode,
} from "../lib/archive/types.js";
import { useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

export interface CategoriesViewProps {
  readonly heading: string;
  readonly initialCategory: CategorySlug | "all";
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  heading,
  initialCategory,
}) => {
  const categories = getAllCategories();
  const openDossier = useNinety9Store((s) => s.openDossier);
  const navigateTo = useNinety9Store((s) => s.navigateTo);

  const defaultSlug: CategorySlug =
    initialCategory !== "all" ? initialCategory : categories[0]?.slug ?? "music";
  const [selectedSlug, setSelectedSlug] = useState<CategorySlug>(defaultSlug);

  useEffect(() => {
    if (initialCategory !== "all") {
      setSelectedSlug(initialCategory);
    }
  }, [initialCategory]);

  const selectedWithEntries =
    getCategoryWithEntries(selectedSlug) ?? getCategoryWithEntries(categories[0]!.slug)!;
  const sectorPhoto = getCategoryPhoto(selectedWithEntries.category.slug);
  const [sectorPlateMode, setSectorPlateMode] = useState<"photo" | "schematic">(
    sectorPhoto ? "photo" : "schematic"
  );

  useEffect(() => {
    setSectorPlateMode(sectorPhoto ? "photo" : "schematic");
  }, [selectedWithEntries.category.slug, Boolean(sectorPhoto)]);

  return (
    <section
      data-testid="ninety9-categories-view"
      className="border-b-2 border-[#000000] bg-[#FFFFFF] n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6 sm:space-y-8">
        <div className="border-b-2 border-[#000000] pb-4">
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#292929]">
            SECTOR ESSAYS // 12 TAXONOMY MONOGRAPHS
          </div>
          <h1 className="n99-font-mono n99-display-h1 mt-1 font-bold uppercase tracking-tight">
            {heading}
          </h1>
        </div>

        {/* 12-Button Sector Switcher */}
        <div className="n99-sector-grid-6">
          {categories.map((cat) => {
            const active = cat.slug === selectedWithEntries.category.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedSlug(cat.slug)}
                aria-pressed={active}
                data-testid={`ninety9-sector-btn-${cat.slug}`}
                className={`n99-touch-btn border-2 border-[#000000] p-2.5 text-left font-mono text-xs font-bold uppercase transition-colors cursor-pointer sm:p-3 ${
                  active
                    ? "n99-shadow-sm bg-[#000000] text-[#FFFFFF]"
                    : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                }`}
              >
                <div className="text-[10px] opacity-80">CAT-{cat.code}</div>
                <div className="mt-0.5 truncate">{cat.shortLabel}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Category Long-Form Essay + Vector Plate */}
        <div className="n99-shadow-md n99-split-12-flush border-2 border-[#000000] bg-[#FFFFFF]">
          <div className="n99-split-divider n99-lg-span-7 n99-card-pad space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#000000] pb-2 font-mono text-[11px] font-bold uppercase">
              <span>{selectedWithEntries.category.label}</span>
              <span>
                KEY YEARS: {selectedWithEntries.category.keyYears.join(" / ")}
              </span>
            </div>

            <h2 className="n99-font-mono n99-display-h2 font-bold uppercase leading-tight text-[#000000]">
              {selectedWithEntries.category.tagline}
            </h2>

            <p className="text-sm leading-7 text-[#292929] sm:text-base">
              {selectedWithEntries.category.essay}
            </p>

            <div className="n99-halftone-light border-2 border-[#000000] p-4 space-y-1.5">
              <div className="font-mono text-[11px] font-bold uppercase text-[#000000]">
                DECADE STRUCTURAL SHIFT NOTE
              </div>
              <p className="text-xs leading-relaxed text-[#000000]">
                {selectedWithEntries.category.decadeShiftNote}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  navigateTo("archive", {
                    category: selectedWithEntries.category.slug,
                  })
                }
                className="n99-touch-btn border-2 border-[#000000] bg-[#000000] px-4 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
              >
                FILTER ARCHIVE BY {selectedWithEntries.category.shortLabel} →
              </button>
            </div>
          </div>

          <div className="n99-ortho-grid n99-card-pad n99-lg-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase text-[#292929]">
                  SECTOR VISUAL RECORD
                </span>
                <div className="flex gap-1">
                  {sectorPhoto && (
                    <button
                      type="button"
                      onClick={() => setSectorPlateMode("photo")}
                      aria-pressed={sectorPlateMode === "photo"}
                      className={`border-2 border-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                        sectorPlateMode === "photo"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] text-[#000000]"
                      }`}
                    >
                      01 // PHOTO
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSectorPlateMode("schematic")}
                    aria-pressed={sectorPlateMode === "schematic"}
                    className={`border-2 border-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                      sectorPlateMode === "schematic"
                        ? "bg-[#000000] text-[#FFFFFF]"
                        : "bg-[#FFFFFF] text-[#000000]"
                    }`}
                  >
                    02 // SVG PLATE
                  </button>
                </div>
              </div>

              {sectorPlateMode === "photo" && sectorPhoto ? (
                <div className="space-y-1.5">
                  <ArchivalMediaPlate
                    photo={sectorPhoto}
                    fallbackSrc={selectedWithEntries.category.illustrationPath}
                    fallbackAlt={`${selectedWithEntries.category.shortLabel} sector photograph`}
                    aspectClassName="h-56"
                    priority="standard"
                  />
                  <div className="border border-[#000000] bg-[#FFFFFF] p-2 font-mono text-[10px] text-[#292929]">
                    <div className="font-bold text-[#000000]">{sectorPhoto.caption}</div>
                    <a
                      href={sectorPhoto.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block underline font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] px-1"
                    >
                      COMMONS SOURCE [{sectorPhoto.license}] →
                    </a>
                  </div>
                </div>
              ) : (
                <figure className="border-2 border-[#000000] bg-[#FFFFFF] p-3">
                  <img
                    src={selectedWithEntries.category.illustrationPath}
                    alt={`${selectedWithEntries.category.shortLabel} sector monograph diagram`}
                    width={480}
                    height={320}
                    decoding="async"
                    className="n99-dither-img h-52 w-full object-contain"
                  />
                  <figcaption className="mt-2 border-t border-[#808080] pt-2 font-mono text-[10px] font-bold uppercase text-[#292929]">
                    SECTOR PLATE // {selectedWithEntries.category.label}
                  </figcaption>
                </figure>
              )}
            </div>

            <div className="space-y-2 border-2 border-[#000000] bg-[#FFFFFF] p-4">
              <div className="font-mono text-xs font-bold uppercase text-[#000000]">
                INDEXED ARTIFACTS IN THIS SECTOR ({selectedWithEntries.entries.length})
              </div>
              <ul className="space-y-2">
                {selectedWithEntries.entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openDossier(entry.slug)}
                      className="flex w-full items-center justify-between gap-2 border border-[#000000] bg-[#FFFFFF] px-3 py-2 text-left font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      <span className="truncate">
                        {entry.serialNumber} — {entry.title}
                      </span>
                      <span className="shrink-0">{entry.year} →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const PALETTE_SWATCHES: readonly {
  readonly token: string;
  readonly hex: string;
  readonly role: string;
  readonly textHex: string;
}[] = [
  {
    token: "--n99-white",
    hex: MONOCHROME_PALETTE.pureWhite,
    role: "PAPER GROUND & PRIMARY TERMINAL FIELD",
    textHex: MONOCHROME_PALETTE.pureBlack,
  },
  {
    token: "--n99-black",
    hex: MONOCHROME_PALETTE.pureBlack,
    role: "1PX / 2PX BORDERS, HARD SHADOWS & PRIMARY INK",
    textHex: MONOCHROME_PALETTE.pureWhite,
  },
  {
    token: "--n99-light",
    hex: MONOCHROME_PALETTE.lightGray,
    role: "HALFTONE DOT MATRIX & SYSTEM TELEMETRY CHROME",
    textHex: MONOCHROME_PALETTE.pureBlack,
  },
  {
    token: "--n99-medium",
    hex: MONOCHROME_PALETTE.mediumGray,
    role: "SECONDARY HAIRLINES, MICRO-LABELS & METADATA",
    textHex: MONOCHROME_PALETTE.pureWhite,
  },
  {
    token: "--n99-dark",
    hex: MONOCHROME_PALETTE.darkGray,
    role: "LONG-FORM EDITORIAL PROSE & FOOTNOTE INK",
    textHex: MONOCHROME_PALETTE.pureWhite,
  },
];

export const AboutView: React.FC<{ readonly heading: string }> = ({ heading }) => {
  const stats = getArchiveStats();
  const crtMode = useNinety9Store((s) => s.crtMode);
  const setCrtMode = useNinety9Store((s) => s.setCrtMode);
  const navigateTo = useNinety9Store((s) => s.navigateTo);

  const crtOptions: readonly CRTMode[] = ["SUBTLE", "ACTIVE", "OFF"];

  return (
    <section
      data-testid="ninety9-about-view"
      className="border-b-2 border-[#000000] bg-[#FFFFFF] n99-section-pad text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6 sm:space-y-8">
        <div className="border-b-2 border-[#000000] pb-4">
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#292929]">
            WORKSTATION COLOPHON // METHODOLOGY &amp; SPECIFICATIONS
          </div>
          <h1 className="n99-font-mono n99-display-h1 mt-1 font-bold uppercase tracking-tight">
            {heading}
          </h1>
        </div>

        {/* Manifesto Split Grid */}
        <div className="n99-split-12">
          <div className="n99-shadow-md n99-card-pad n99-lg-span-7 border-2 border-[#000000] bg-[#FFFFFF] space-y-4">
            <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-base font-bold uppercase">
              01 // THE 1997 PAPER-WHITE WORKSTATION STANDARD
            </h2>
            <p className="text-sm leading-7 text-[#292929] sm:text-base">
              NINETY9 rejects modern soft gradients, rounded corners, and nostalgic neon glow
              in favor of the crisp high-density editorial discipline shared by NeXTSTEP
              manuals, Classic Macintosh system dialogs, Wired print colophons, and HTTP/1.0
              academic index sheets. Every plate, border, and typographic rule operates inside
              a mathematically enforced 5-tone pure grayscale hierarchy.
            </p>
            <p className="text-sm leading-7 text-[#292929] sm:text-base">
              All {stats.totalEntries} historical dossiers across {stats.totalCategories} sectors
              and {stats.totalMilestones} decade milestones ({stats.yearSpan[0]}–{stats.yearSpan[1]})
              are backed by strict Zod schemas (`ArchiveEntrySchema`), zero-dependency deterministic
              halftone SVGs, and scoped CSS container isolation inside WizFrame.
            </p>
          </div>

          <div className="n99-halftone-light n99-card-pad n99-lg-span-5 border-2 border-[#000000] space-y-4">
            <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-base font-bold uppercase">
              02 // CRT SCANLINE CALIBRATION
            </h2>
            <p className="font-mono text-xs leading-relaxed text-[#000000]">
              Adjust the Paper-White CRT optical scanline mesh persisted across sessions in{" "}
              <code>localStorage</code>:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {crtOptions.map((mode) => {
                const active = crtMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCrtMode(mode)}
                    aria-pressed={active}
                    className={`n99-touch-btn border-2 border-[#000000] px-2 py-2 font-mono text-xs font-bold uppercase cursor-pointer transition-colors sm:px-3 ${
                      active
                        ? "bg-[#000000] text-[#FFFFFF]"
                        : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
            <div className="n99-wrap-anywhere border-2 border-[#000000] bg-[#FFFFFF] p-3 font-mono text-xs">
              ACTIVE STATE: <strong>CRT={crtMode}</strong> // BORDER-RADIUS: <strong>0PX</strong> //
              PALETTE CAP: <strong>{stats.paletteHexCount} HEXES</strong>
            </div>
          </div>
        </div>

        {/* Strict 5-Tone Monochrome Palette Swatches */}
        <div className="space-y-3">
          <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-base font-bold uppercase">
            03 // STRICT 5-TONE MONOCHROME HEX LAW (ZERO COLOR EXCEPTIONS)
          </h2>
          <div className="n99-card-grid-5">
            {PALETTE_SWATCHES.map((swatch) => (
              <div
                key={swatch.hex}
                className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000]"
              >
                <div
                  className="flex h-24 items-end justify-between border-b-2 border-[#000000] p-3 font-mono text-sm font-bold"
                  style={{ backgroundColor: swatch.hex, color: swatch.textHex }}
                >
                  <span>{swatch.hex}</span>
                </div>
                <div className="bg-[#FFFFFF] p-3 font-mono text-[11px] space-y-1">
                  <div className="font-bold text-[#000000]">{swatch.token}</div>
                  <div className="text-[#292929] leading-snug">{swatch.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 04 // Historic 1990s Open-Source Photo Contact Sheet */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#000000] pb-2">
            <h2 className="font-mono text-base font-bold uppercase">
              04 // HISTORIC 1990S FIGURES, EVENTS &amp; GADGETS ({getAllArchivalPhotos().length} OPEN-SOURCE PLATES)
            </h2>
            <span className="font-mono text-[11px] font-bold uppercase text-[#292929]">
              WIKIMEDIA COMMONS / PUBLIC DOMAIN ARCHIVE
            </span>
          </div>
          <div className="n99-card-grid-3">
            {getHighlightPhotos().map((photo) => (
              <article
                key={photo.key}
                className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4 space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase">
                    <span className="border border-[#000000] bg-[#000000] px-1.5 py-0.5 text-[#FFFFFF]">
                      {photo.yearTaken}
                    </span>
                    <span className="text-[#292929]">{photo.license}</span>
                  </div>
                  <ArchivalMediaPlate
                    photo={photo}
                    fallbackSrc="/images/ninety9/categories/hardware.svg"
                    fallbackAlt={photo.alt}
                    aspectClassName="h-44"
                    priority="standard"
                  />
                  <p className="text-xs leading-relaxed text-[#292929]">
                    {photo.caption}
                  </p>
                </div>
                <a
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border border-[#000000] bg-[#D9D9D9] px-2.5 py-1.5 text-center font-mono text-[10px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors"
                >
                  VIEW COMMONS ATTRIBUTION →
                </a>
              </article>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-[#000000] bg-[#D9D9D9] p-5">
          <div className="font-mono text-xs font-bold uppercase text-[#000000]">
            CLI INSTALL: npx genui-studio add ninety9-archive // STANDALONE NEXT.JS 15 READY
          </div>
          <button
            type="button"
            onClick={() => navigateTo("archive")}
            className="min-h-[42px] border-2 border-[#000000] bg-[#000000] px-5 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
          >
            RETURN TO FULL ARCHIVE CATALOG →
          </button>
        </div>
      </div>
    </section>
  );
};
