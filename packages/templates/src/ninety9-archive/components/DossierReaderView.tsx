import React, { useEffect, useState } from "react";
import {
  getAllEntries,
  getCategoryBySlug,
  getCategoryPhoto,
  getEntryBySlug,
  getEntryPhoto,
  getRelatedDossiers,
} from "../lib/archive/api.js";
import { useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

export interface DossierReaderViewProps {
  readonly slug: string;
  readonly showRelated: boolean;
  readonly showGallery: boolean;
}

export const DossierReaderView: React.FC<DossierReaderViewProps> = ({
  slug,
  showRelated,
  showGallery,
}) => {
  const navigateTo = useNinety9Store((s) => s.navigateTo);
  const openDossier = useNinety9Store((s) => s.openDossier);

  const allEntries = getAllEntries();
  const fallbackEntry = allEntries[0]!;
  const resolvedEntry = getEntryBySlug(slug) ?? fallbackEntry;
  const resolvedCategory = getCategoryBySlug(resolvedEntry.category);
  const entryPhoto = getEntryPhoto(resolvedEntry.slug);
  const sectorPhoto = resolvedCategory ? getCategoryPhoto(resolvedCategory.slug) : undefined;

  const [galleryPlate, setGalleryPlate] = useState<"photo" | "entry" | "sector">(
    entryPhoto ? "photo" : "entry"
  );

  useEffect(() => {
    setGalleryPlate(entryPhoto ? "photo" : "entry");
  }, [resolvedEntry.slug, Boolean(entryPhoto)]);

  const currentIndex = allEntries.findIndex((item) => item.slug === resolvedEntry.slug);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const prevEntry =
    allEntries[(safeIndex - 1 + allEntries.length) % allEntries.length] ?? fallbackEntry;
  const nextEntry = allEntries[(safeIndex + 1) % allEntries.length] ?? fallbackEntry;
  const relatedDossiers = showRelated
    ? getRelatedDossiers(resolvedEntry.slug, 3)
    : [];

  const activePlateSrc =
    galleryPlate === "sector" && resolvedCategory
      ? resolvedCategory.illustrationPath
      : resolvedEntry.illustrationPath;

  const activePlateCaption =
    galleryPlate === "sector" && resolvedCategory
      ? `FIG. 03 // SECTOR PLATE [${resolvedCategory.code}] — ${resolvedCategory.shortLabel}: ${resolvedCategory.tagline}`
      : `FIG. 02 // ARTIFACT SCHEMATIC [${resolvedEntry.serialNumber}] — ${resolvedEntry.title.toUpperCase()} (${resolvedEntry.monthLabel})`;

  return (
    <article
      data-testid={`ninety9-dossier-reader-${resolvedEntry.slug}`}
      className="border-b-2 border-[#000000] bg-[#FFFFFF] px-4 py-10 text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-8">
        {/* Top Breadcrumb Bar */}
        <nav
          aria-label="Dossier Breadcrumb"
          className="flex flex-wrap items-center justify-between gap-3 border-2 border-[#000000] bg-[#D9D9D9] px-4 py-2 font-mono text-[11px] font-bold uppercase text-[#000000]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo("home")}
              className="underline cursor-pointer hover:bg-[#000000] hover:text-[#FFFFFF] px-1"
            >
              HOME
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => navigateTo("archive")}
              className="underline cursor-pointer hover:bg-[#000000] hover:text-[#FFFFFF] px-1"
            >
              ARCHIVE
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() =>
                navigateTo("archive", { category: resolvedEntry.category })
              }
              className="underline cursor-pointer hover:bg-[#000000] hover:text-[#FFFFFF] px-1"
            >
              CAT-{resolvedEntry.categoryCode} (
              {resolvedCategory?.shortLabel ?? resolvedEntry.category})
            </button>
            <span>/</span>
            <span className="bg-[#000000] px-1.5 py-0.5 text-[#FFFFFF]">
              {resolvedEntry.serialNumber}
            </span>
          </div>

          <span>ARCHIVE INDEX #{safeIndex + 1} OF {allEntries.length}</span>
        </nav>

        {/* ArticleHero Split Block */}
        <header className="n99-shadow-md grid grid-cols-1 gap-0 border-2 border-[#000000] bg-[#FFFFFF] lg:grid-cols-12">
          <div className="space-y-4 border-b-2 border-[#000000] p-6 lg:col-span-7 lg:border-b-0 lg:border-r-2">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase">
              <span className="border-2 border-[#000000] bg-[#000000] px-2.5 py-0.5 text-[#FFFFFF]">
                {resolvedEntry.id}
              </span>
              <span className="border border-[#000000] bg-[#D9D9D9] px-2 py-0.5">
                {resolvedEntry.type}
              </span>
              <span className="border border-[#000000] px-2 py-0.5">
                {resolvedEntry.monthLabel}
              </span>
            </div>

            <h1 className="n99-font-mono text-3xl font-bold uppercase leading-[1.08] tracking-tight md:text-4xl">
              {resolvedEntry.title}
            </h1>

            <p className="font-mono text-sm font-bold text-[#292929]">
              {resolvedEntry.subtitle}
            </p>

            <p className="text-base leading-relaxed text-[#000000]">
              {resolvedEntry.summary}
            </p>

            <div className="grid grid-cols-1 gap-2 border-t-2 border-[#000000] pt-4 font-mono text-xs sm:grid-cols-2">
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#808080]">
                  CREATOR / PUBLISHER
                </span>
                <span className="font-bold">{resolvedEntry.creatorOrPublisher}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#808080]">
                  PROVENANCE / ORIGIN
                </span>
                <span className="font-bold">{resolvedEntry.origin}</span>
              </div>
            </div>
          </div>

          {/* Interactive Photo & SVG Schematic Switcher */}
          <div className="n99-ortho-grid flex flex-col justify-between p-5 lg:col-span-5">
            {showGallery ? (
              <div className="space-y-3" data-testid="ninety9-dossier-gallery">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase text-[#292929]">
                    MONOGRAPHIC PLATE VIEWER
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {entryPhoto && (
                      <button
                        type="button"
                        onClick={() => setGalleryPlate("photo")}
                        aria-pressed={galleryPlate === "photo"}
                        className={`border-2 border-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                          galleryPlate === "photo"
                            ? "bg-[#000000] text-[#FFFFFF]"
                            : "bg-[#FFFFFF] text-[#000000]"
                        }`}
                      >
                        01 // PHOTO
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGalleryPlate("entry")}
                      aria-pressed={galleryPlate === "entry"}
                      className={`border-2 border-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                        galleryPlate === "entry"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] text-[#000000]"
                      }`}
                    >
                      02 // SCHEMATIC
                    </button>
                    {resolvedCategory && (
                      <button
                        type="button"
                        onClick={() => setGalleryPlate("sector")}
                        aria-pressed={galleryPlate === "sector"}
                        className={`border-2 border-[#000000] px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                          galleryPlate === "sector"
                            ? "bg-[#000000] text-[#FFFFFF]"
                            : "bg-[#FFFFFF] text-[#000000]"
                        }`}
                      >
                        03 // SECTOR
                      </button>
                    )}
                  </div>
                </div>

                {galleryPlate === "photo" && entryPhoto ? (
                  <div className="space-y-2">
                    <ArchivalMediaPlate
                      photo={entryPhoto}
                      fallbackSrc={resolvedEntry.illustrationPath}
                      fallbackAlt={`${resolvedEntry.title} archival photograph`}
                      aspectClassName="h-60"
                      priority="hero"
                    />
                    <div className="border border-[#000000] bg-[#FFFFFF] p-2 font-mono text-[10px] leading-relaxed text-[#292929]">
                      <div className="font-bold text-[#000000]">{entryPhoto.caption}</div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[#D9D9D9] pt-1">
                        <span>ERA: {entryPhoto.yearTaken}</span>
                        <a
                          href={entryPhoto.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-bold text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] px-1"
                        >
                          OPEN-SOURCE COMMONS RECORD →
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <figure className="border-2 border-[#000000] bg-[#FFFFFF] p-3">
                    <img
                      src={
                        galleryPlate === "sector" && sectorPhoto
                          ? resolvedCategory!.illustrationPath
                          : activePlateSrc
                      }
                      alt={`${resolvedEntry.title} high-contrast monochrome plate`}
                      width={520}
                      height={360}
                      decoding="async"
                      className="n99-dither-img h-56 w-full object-contain"
                    />
                    <figcaption className="mt-3 border-t border-[#808080] pt-2 font-mono text-[10px] font-bold uppercase text-[#292929]">
                      {activePlateCaption}
                    </figcaption>
                  </figure>
                )}
              </div>
            ) : (
              <div className="border-2 border-[#000000] bg-[#FFFFFF] p-4 font-mono text-xs">
                SCHEMATIC PREVIEW COLLAPSED BY LAYOUT PRESET.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {resolvedEntry.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigateTo("archive", { query: tag })}
                  className="border border-[#000000] bg-[#FFFFFF] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* 4-Cell Technical Spec Table */}
        <section aria-label="Technical Specifications" className="border-2 border-[#000000] bg-[#FFFFFF]">
          <div className="border-b-2 border-[#000000] bg-[#000000] px-4 py-2 font-mono text-xs font-bold uppercase text-[#FFFFFF]">
            TECHNICAL SPECIFICATION SHEET // {resolvedEntry.serialNumber}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#000000] bg-[#D9D9D9] font-mono text-[11px] font-bold uppercase text-[#000000]">
                  <th scope="col" className="border-r border-[#000000] px-4 py-2.5">
                    PARAMETER
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    VERIFIED SPECIFICATION
                  </th>
                </tr>
              </thead>
              <tbody>
                {resolvedEntry.specs.map((spec, idx) => (
                  <tr
                    key={`${spec.label}-${idx}`}
                    className={
                      idx < resolvedEntry.specs.length - 1
                        ? "border-b border-[#000000]"
                        : ""
                    }
                  >
                    <th
                      scope="row"
                      className="w-1/3 border-r border-[#000000] bg-[#FFFFFF] px-4 py-3 font-mono text-xs font-bold uppercase text-[#292929]"
                    >
                      {spec.label}
                    </th>
                    <td className="bg-[#FFFFFF] px-4 py-3 font-mono text-xs font-bold text-[#000000]">
                      {spec.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Numbered Editorial Essay Sections + Pull Quote */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {resolvedEntry.sections.map((section) => (
              <section
                key={section.index}
                className="border-2 border-[#000000] bg-[#FFFFFF] p-6 space-y-3"
              >
                <div className="border-b border-[#000000] pb-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#808080]">
                    {section.index}
                  </span>
                  <h2 className="n99-font-mono mt-1 text-xl font-bold uppercase text-[#000000]">
                    {section.heading}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-[#292929] md:text-base md:leading-7">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <aside className="space-y-6 lg:col-span-4">
            {/* Pull Quote Card */}
            <div className="n99-shadow-md border-2 border-[#000000] bg-[#000000] p-6 text-[#FFFFFF]">
              <div className="border-b border-[#808080] pb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#D9D9D9]">
                PRIMARY SOURCE EXCERPT
              </div>
              <blockquote className="mt-4 font-mono text-base font-bold leading-relaxed text-[#FFFFFF]">
                &ldquo;{resolvedEntry.pullQuote.quote}&rdquo;
              </blockquote>
              <p className="mt-4 font-mono text-xs uppercase text-[#D9D9D9]">
                — {resolvedEntry.pullQuote.attribution}
              </p>
            </div>

            {/* Cultural Impact Card */}
            <div className="border-2 border-[#000000] bg-[#FFFFFF] p-5 space-y-2">
              <h3 className="border-b-2 border-[#000000] pb-2 font-mono text-xs font-bold uppercase text-[#000000]">
                CULTURAL IMPACT ({resolvedEntry.year})
              </h3>
              <p className="text-sm leading-relaxed text-[#292929]">
                {resolvedEntry.culturalImpact}
              </p>
            </div>

            {/* Historical Legacy Card */}
            <div className="n99-halftone-light border-2 border-[#000000] p-5 space-y-2">
              <h3 className="border-b-2 border-[#000000] pb-2 font-mono text-xs font-bold uppercase text-[#000000]">
                HISTORICAL LEGACY
              </h3>
              <p className="text-sm leading-relaxed text-[#000000]">
                {resolvedEntry.historicalLegacy}
              </p>
            </div>
          </aside>
        </div>

        {/* Verified Archival Citations */}
        <section className="border-2 border-[#000000] bg-[#FFFFFF] p-6 space-y-4">
          <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-sm font-bold uppercase text-[#000000]">
            VERIFIED PRIMARY CITATIONS ({resolvedEntry.citations.length})
          </h2>
          <ol className="space-y-2 font-mono text-xs">
            {resolvedEntry.citations.map((cite, index) => (
              <li
                key={`${cite.source}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#D9D9D9] pb-2"
              >
                <div>
                  <span className="font-bold text-[#000000]">
                    [{String(index + 1).padStart(2, "0")}] {cite.source}
                  </span>
                  <span className="text-[#292929]"> — {cite.detail}</span>
                </div>
                <span className="border border-[#000000] bg-[#D9D9D9] px-1.5 py-0.5 font-bold text-[#000000]">
                  {cite.year}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Prev / Next Dossier Bar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openDossier(prevEntry.slug)}
            data-testid="ninety9-prev-dossier-btn"
            className="n99-shadow-sm flex flex-col items-start gap-1 border-2 border-[#000000] bg-[#FFFFFF] p-4 text-left hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          >
            <span className="font-mono text-[10px] font-bold uppercase opacity-80">
              &lt;- PREV DOSSIER // {prevEntry.serialNumber}
            </span>
            <span className="n99-font-mono text-sm font-bold uppercase">
              {prevEntry.title} ({prevEntry.year})
            </span>
          </button>

          <button
            type="button"
            onClick={() => openDossier(nextEntry.slug)}
            data-testid="ninety9-next-dossier-btn"
            className="n99-shadow-sm flex flex-col items-end gap-1 border-2 border-[#000000] bg-[#FFFFFF] p-4 text-right hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
          >
            <span className="font-mono text-[10px] font-bold uppercase opacity-80">
              NEXT DOSSIER // {nextEntry.serialNumber} -&gt;
            </span>
            <span className="n99-font-mono text-sm font-bold uppercase">
              {nextEntry.title} ({nextEntry.year})
            </span>
          </button>
        </div>

        {/* 3 Related Dossiers */}
        {showRelated && relatedDossiers.length > 0 && (
          <section className="space-y-4">
            <h2 className="border-b-2 border-[#000000] pb-2 font-mono text-base font-bold uppercase text-[#000000]">
              CROSS-REFERENCED ARCHIVE RECORDS ({relatedDossiers.length})
            </h2>
            <div className="n99-catalog-grid">
              {relatedDossiers.map((rel) => (
                <article
                  key={rel.id}
                  className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase text-[#292929]">
                      <span>{rel.serialNumber}</span>
                      <span>
                        {rel.year} · {rel.type}
                      </span>
                    </div>
                    <ArchivalMediaPlate
                      photo={getEntryPhoto(rel.slug)}
                      fallbackSrc={rel.illustrationPath}
                      fallbackAlt={`${rel.title} related dossier visual`}
                      fallbackCaption={rel.serialNumber}
                      aspectClassName="h-32"
                      priority="standard"
                      compact
                    />
                    <h3 className="n99-font-mono text-base font-bold uppercase leading-tight text-[#000000]">
                      {rel.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#292929]">
                      {rel.summary}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDossier(rel.slug)}
                    className="mt-4 min-h-[38px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                  >
                    INSPECT RELATED DOSSIER →
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
};
