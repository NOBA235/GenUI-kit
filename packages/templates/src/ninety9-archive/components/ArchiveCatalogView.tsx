import React, { useEffect, useId, useRef } from "react";
import {
  getAllCategories,
  getArchiveStats,
  getAvailableArchiveYears,
  getAvailableEntryTypes,
  getCategoryBySlug,
  getEntryPhoto,
  queryArchiveEntries,
} from "../lib/archive/api.js";
import type {
  ArchiveEntry,
  ArchiveEntryType,
  ArchiveSortOption,
  CategorySlug,
} from "../lib/archive/types.js";
import { useNinety9Store } from "../store.js";
import { ArchivalMediaPlate } from "./ArchivalMediaPlate.js";

export interface ArchiveCatalogViewProps {
  readonly heading: string;
  readonly initialCategory: CategorySlug | "all";
  readonly initialYearFilter:
    | "all"
    | "1990"
    | "1991"
    | "1992"
    | "1993"
    | "1994"
    | "1995"
    | "1996"
    | "1997"
    | "1998"
    | "1999";
  readonly initialSort: ArchiveSortOption;
  readonly limitCount?: number;
}

export const ArchiveCatalogView: React.FC<ArchiveCatalogViewProps> = ({
  heading,
  initialCategory,
  initialYearFilter,
  initialSort,
  limitCount,
}) => {
  const searchQuery = useNinety9Store((s) => s.searchQuery);
  const selectedYear = useNinety9Store((s) => s.selectedYear);
  const selectedCategory = useNinety9Store((s) => s.selectedCategory);
  const selectedType = useNinety9Store((s) => s.selectedType);
  const sortBy = useNinety9Store((s) => s.sortBy);

  const setSearchQuery = useNinety9Store((s) => s.setSearchQuery);
  const setSelectedYear = useNinety9Store((s) => s.setSelectedYear);
  const setSelectedCategory = useNinety9Store((s) => s.setSelectedCategory);
  const setSelectedType = useNinety9Store((s) => s.setSelectedType);
  const setSortBy = useNinety9Store((s) => s.setSortBy);
  const resetArchiveFilters = useNinety9Store((s) => s.resetArchiveFilters);
  const openDossier = useNinety9Store((s) => s.openDossier);

  const prevPropsRef = useRef<{
    category: CategorySlug | "all";
    year: string;
    sort: ArchiveSortOption;
  } | null>(null);

  useEffect(() => {
    const prev = prevPropsRef.current;
    const isFirstRun = prev === null;

    if (
      (isFirstRun && initialCategory !== "all") ||
      (!isFirstRun && prev.category !== initialCategory)
    ) {
      setSelectedCategory(initialCategory);
    }

    if (
      (isFirstRun && initialYearFilter !== "all") ||
      (!isFirstRun && prev.year !== initialYearFilter)
    ) {
      setSelectedYear(
        initialYearFilter === "all" ? "all" : Number.parseInt(initialYearFilter, 10)
      );
    }

    if (
      (isFirstRun && initialSort !== "chronological-asc") ||
      (!isFirstRun && prev.sort !== initialSort)
    ) {
      setSortBy(initialSort);
    }

    prevPropsRef.current = {
      category: initialCategory,
      year: initialYearFilter,
      sort: initialSort,
    };
  }, [
    initialCategory,
    initialYearFilter,
    initialSort,
    setSelectedCategory,
    setSelectedYear,
    setSortBy,
  ]);

  const searchInputId = useId();
  const categorySelectId = useId();
  const typeSelectId = useId();
  const sortSelectId = useId();

  const stats = getArchiveStats();
  const categories = getAllCategories();
  const availableYears = getAvailableArchiveYears();
  const availableTypes = getAvailableEntryTypes();

  const results = queryArchiveEntries({
    query: searchQuery,
    year: selectedYear,
    category: selectedCategory,
    type: selectedType,
    sort: sortBy,
  });

  const visibleEntries: readonly ArchiveEntry[] =
    typeof limitCount === "number" && limitCount > 0 && limitCount < results.length
      ? results.slice(0, limitCount)
      : results;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedYear !== "all" ||
    selectedCategory !== "all" ||
    selectedType !== "all" ||
    sortBy !== "chronological-asc";

  return (
    <section
      data-testid="ninety9-archive-catalog-view"
      className="border-b-2 border-[#000000] bg-[#FFFFFF] px-4 py-10 text-[#000000]"
    >
      <div className="mx-auto max-w-[1380px] space-y-6">
        {/* Catalog Terminal Header */}
        <div className="n99-halftone-light border-2 border-[#000000] p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#000000] pb-4">
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#292929]">
                DIRECTORY // ARCHIVE CATALOG MATRIX
              </div>
              <h1 className="n99-font-mono text-2xl font-bold uppercase tracking-tight md:text-3xl">
                {heading}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                aria-live="polite"
                data-testid="ninety9-catalog-count"
                className="border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase"
              >
                SHOWING {visibleEntries.length} OF {stats.totalEntries} DOSSIERS
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => resetArchiveFilters()}
                  data-testid="ninety9-reset-filters-inline"
                  className="min-h-[36px] border-2 border-[#000000] bg-[#000000] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
                >
                  CLEAR FILTERS
                </button>
              )}
            </div>
          </div>

          {/* Search & Facet Controls */}
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label
                htmlFor={searchInputId}
                className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]"
              >
                FUZZY INDEX QUERY (TITLE / SERIAL / CREATOR / TAG)
              </label>
              <input
                id={searchInputId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH E.G. 'THINKPAD', 'KURT', 'ARC-06', 'HTTP'..."
                data-testid="ninety9-catalog-search"
                className="w-full min-h-[42px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-2 font-mono text-xs font-bold text-[#000000] placeholder:text-[#808080]"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor={categorySelectId}
                className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]"
              >
                CATEGORY SECTOR
              </label>
              <select
                id={categorySelectId}
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as CategorySlug | "all")
                }
                data-testid="ninety9-catalog-category-select"
                className="w-full min-h-[42px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-2 font-mono text-xs font-bold uppercase text-[#000000]"
              >
                <option value="all">ALL 12 SECTORS</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    [{cat.code}] {cat.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={typeSelectId}
                className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]"
              >
                ARTIFACT TYPE
              </label>
              <select
                id={typeSelectId}
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(e.target.value as ArchiveEntryType | "all")
                }
                data-testid="ninety9-catalog-type-select"
                className="w-full min-h-[42px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-2 font-mono text-xs font-bold uppercase text-[#000000]"
              >
                <option value="all">ALL TYPES</option>
                {availableTypes.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={sortSelectId}
                className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]"
              >
                SORT ORDER
              </label>
              <select
                id={sortSelectId}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ArchiveSortOption)}
                data-testid="ninety9-catalog-sort-select"
                className="w-full min-h-[42px] border-2 border-[#000000] bg-[#FFFFFF] px-3 py-2 font-mono text-xs font-bold uppercase text-[#000000]"
              >
                <option value="chronological-asc">YEAR: 1990 → 1999</option>
                <option value="chronological-desc">YEAR: 1999 → 1990</option>
                <option value="title-asc">TITLE: A → Z</option>
                <option value="serial-asc">SERIAL: ARC-01 → 12</option>
              </select>
            </div>
          </div>

          {/* 1990–1999 Year Filter Ribbon */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#808080] pt-4">
            <span className="mr-2 font-mono text-[11px] font-bold uppercase text-[#292929]">
              DECADE FILTER:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear("all")}
              aria-pressed={selectedYear === "all"}
              data-testid="ninety9-year-pill-all"
              className={`min-h-[34px] border-2 border-[#000000] px-2.5 py-1 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
                selectedYear === "all"
                  ? "bg-[#000000] text-[#FFFFFF]"
                  : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
              }`}
            >
              ALL YEARS
            </button>
            {availableYears.map((yr) => {
              const active = selectedYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  aria-pressed={active}
                  data-testid={`ninety9-year-pill-${yr}`}
                  className={`min-h-[34px] border-2 border-[#000000] px-2.5 py-1 font-mono text-xs font-bold cursor-pointer transition-colors ${
                    active
                      ? "bg-[#000000] text-[#FFFFFF]"
                      : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State vs Dossier Grid */}
        {visibleEntries.length === 0 ? (
          <div
            data-testid="ninety9-catalog-empty-state"
            className="n99-shadow-md border-2 border-[#000000] bg-[#FFFFFF] p-8 text-center"
          >
            <div className="mx-auto max-w-lg space-y-4">
              <div className="inline-block border-2 border-[#000000] bg-[#000000] px-3 py-1 font-mono text-xs font-bold uppercase text-[#FFFFFF]">
                STATUS 404 // ZERO MATCHING RECORDS
              </div>
              <h2 className="n99-font-mono text-xl font-bold uppercase text-[#000000]">
                NO ARCHIVAL DOSSIERS MATCH CURRENT TERMINAL FILTERS
              </h2>
              <p className="text-sm leading-relaxed text-[#292929]">
                Adjust your search keywords, year selection, or artifact type classification, or
                reset the workstation index to inspect all {stats.totalEntries} verified records.
              </p>
              <button
                type="button"
                onClick={() => resetArchiveFilters()}
                data-testid="ninety9-reset-all-filters-btn"
                className="n99-shadow-sm min-h-[44px] border-2 border-[#000000] bg-[#000000] px-6 py-2.5 font-mono text-xs font-bold uppercase text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
              >
                RESET ALL FILTERS
              </button>
            </div>
          </div>
        ) : (
          <div className="n99-catalog-grid">
            {visibleEntries.map((entry) => {
              const cat = getCategoryBySlug(entry.category);
              return (
                <article
                  key={entry.id}
                  data-testid={`ninety9-catalog-card-${entry.slug}`}
                  className="n99-shadow-sm flex flex-col justify-between border-2 border-[#000000] bg-[#FFFFFF] p-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-[#000000] pb-2 font-mono text-[10px] font-bold uppercase text-[#292929]">
                      <span>
                        {entry.id} // {entry.serialNumber}
                      </span>
                      <span>
                        {entry.year} · {entry.type}
                      </span>
                    </div>

                    <ArchivalMediaPlate
                      photo={getEntryPhoto(entry.slug)}
                      fallbackSrc={entry.illustrationPath}
                      fallbackAlt={`${entry.title} archival plate (${entry.year})`}
                      fallbackCaption={entry.serialNumber}
                      aspectClassName="h-36"
                      priority="standard"
                      compact
                    />

                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] font-bold uppercase text-[#808080]">
                        SECTOR [{entry.categoryCode}] {cat?.shortLabel ?? entry.category}
                      </div>
                      <h2 className="n99-font-mono text-base font-bold uppercase leading-tight text-[#000000]">
                        {entry.title}
                      </h2>
                      <p className="text-xs leading-relaxed text-[#292929]">
                        {entry.summary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-[#808080] pt-3">
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSearchQuery(tag)}
                          className="border border-[#000000] bg-[#D9D9D9] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => openDossier(entry.slug)}
                      className="min-h-[38px] w-full border-2 border-[#000000] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      OPEN DOSSIER →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
