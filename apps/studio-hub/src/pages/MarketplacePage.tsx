import React, { useMemo, useState } from "react";
import {
  getTemplateCounts,
  listTemplates,
  MARKETPLACE_FILTER_TAGS,
  type DualModeTemplateEntry,
  type TemplateMode,
} from "@genui-studio/templates";
import { TemplateExportDialog } from "../components/TemplateExportDialog.js";

export interface MarketplacePageProps {
  readonly onOpenPreview: (slug: string) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onOpenPreview,
}) => {
  const [modeFilter, setModeFilter] = useState<TemplateMode | "all">("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "pro">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportTemplate, setExportTemplate] =
    useState<DualModeTemplateEntry | null>(null);

  const counts = getTemplateCounts();

  const featuredFlagships = useMemo(
    () => listTemplates({}).filter((entry) => entry.manifest.featured === true),
    [],
  );

  const filteredTemplates = useMemo(
    () =>
      listTemplates({
        mode: modeFilter,
        tag: activeTag,
        tier: tierFilter,
        searchQuery,
      }),
    [modeFilter, activeTag, tierFilter, searchQuery],
  );

  return (
    <div className="min-h-dvh bg-[#060911] text-slate-100 flex flex-col">
      {/* Studio Hub Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300">
              G∑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-100">
                  GenUI Studio Hub
                </h1>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  Dual-Mode Registry
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                Single-Server Mode A Native Websites + Mode B Standalone Ingestion
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300 hover:border-purple-500/40 hover:text-purple-200 transition"
            >
              Spatial 3D Engine :5174 ↗
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 space-y-8">
        {/* Hero & Dual-Mode Readiness Strip */}
        <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/70 p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
                Unified Marketplace Storefront Index
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Explore Verified Native Websites &amp; Ingested Standalone Projects
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Every website previews inside an isolated{" "}
                <code className="text-cyan-300 font-mono text-xs">
                  data-template-theme
                </code>{" "}
                container with live GenUI remixing, in-browser{" "}
                <code className="text-cyan-300 font-mono text-xs">fast-check</code>{" "}
                PBT inspection, and Next.js{" "}
                <code className="text-cyan-300 font-mono text-xs">.zip</code>{" "}
                export.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3">
                <span className="block text-[10px] text-slate-400">MODE A · NATIVE</span>
                <span
                  data-testid="count-mode-a"
                  className="text-xl font-bold text-cyan-300"
                >
                  {counts.native}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3">
                <span className="block text-[10px] text-slate-400">MODE B · STANDALONE</span>
                <span
                  data-testid="count-mode-b"
                  className="text-xl font-bold text-amber-300"
                >
                  {counts.standalone}
                </span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3">
                <span className="block text-[10px] text-slate-400">GENUI VERIFIED</span>
                <span
                  data-testid="count-verified"
                  className="text-xl font-bold text-emerald-300"
                >
                  {counts.verified}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-slate-400">Scaffold Mode A Website:</span>
              <code className="text-cyan-300">pnpm new:template &lt;slug&gt;</code>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/75 px-4 py-3 flex items-center justify-between gap-2">
              <span className="text-slate-400">Ingest Mode B Drop-In:</span>
              <code className="text-amber-300">pnpm ingest:standalone &lt;slug&gt;</code>
            </div>
          </div>
        </section>

        {/* Flagship Spotlight Banner */}
        {featuredFlagships.length > 0 && (
          <section
            data-testid="marketplace-featured-flagship"
            className="rounded-2xl border border-red-900/50 bg-gradient-to-r from-[#090306] via-slate-950 to-zinc-950 p-6 md:p-7 shadow-xl"
          >
            {featuredFlagships.map((flagship) => (
              <div
                key={`featured-${flagship.manifest.slug}`}
                className="flex flex-wrap items-center justify-between gap-6"
              >
                <div className="max-w-2xl space-y-2">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="rounded border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 font-bold uppercase tracking-wider text-red-300">
                      Flagship Website #1 · Featured Release
                    </span>
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      Dual-Mode + 60 FPS WebGL + 3D Audio
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                    {flagship.manifest.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {flagship.manifest.description}
                  </p>
                  <div className="font-mono text-xs text-cyan-300">
                    <code>npx genui-studio add {flagship.manifest.slug}</code>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenPreview(flagship.manifest.slug)}
                    className="rounded-lg bg-red-600 px-4 py-2.5 font-mono text-xs font-bold text-white hover:bg-red-500 transition cursor-pointer"
                  >
                    Enter 2:17 AM Preview →
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportTemplate(flagship)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-white transition cursor-pointer"
                  >
                    Export .ZIP / SKILL.md
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Search, Mode, Tier & Marketplace Tag Filters */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {(
                [
                  ["all", "All Modes"],
                  ["native", "Mode A · Internal Native"],
                  ["standalone", "Mode B · Standalone Drop-In"],
                ] as const
              ).map(([modeVal, label]) => (
                <button
                  key={modeVal}
                  type="button"
                  onClick={() => setModeFilter(modeVal)}
                  data-testid={`mode-filter-${modeVal}`}
                  className={`rounded-lg border px-3 py-1.5 font-semibold transition cursor-pointer ${
                    modeFilter === modeVal
                      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 font-mono text-xs">
                {(["all", "free", "pro"] as const).map((tierVal) => (
                  <button
                    key={tierVal}
                    type="button"
                    onClick={() => setTierFilter(tierVal)}
                    className={`rounded px-2.5 py-1 uppercase transition cursor-pointer ${
                      tierFilter === tierVal
                        ? "bg-slate-800 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tierVal}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search marketplace templates"
                placeholder="Search templates, stacks, tags..."
                data-testid="marketplace-search-input"
                className="w-64 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Tag Filter Strip */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTag("all")}
              data-testid="tag-filter-all"
              className={`rounded-full border px-3 py-1 transition cursor-pointer ${
                activeTag === "all"
                  ? "border-cyan-400 bg-cyan-500 text-slate-950 font-semibold"
                  : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
              }`}
            >
              All Tags
            </button>
            {MARKETPLACE_FILTER_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                data-testid={`tag-filter-${tag}`}
                className={`rounded-full border px-3 py-1 transition cursor-pointer ${
                  activeTag === tag
                    ? "border-cyan-400 bg-cyan-500 text-slate-950 font-semibold"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Unified Filterable Marketplace Grid */}
        {filteredTemplates.length === 0 ? (
          <div
            data-testid="marketplace-empty-state"
            className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-2"
          >
            <p className="text-base font-semibold text-slate-200">
              No templates match the active filters
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Reset filters or scaffold a new template via{" "}
              <code>pnpm new:template &lt;slug&gt;</code> or{" "}
              <code>pnpm ingest:standalone &lt;slug&gt;</code>.
            </p>
          </div>
        ) : (
          <section
            data-testid="marketplace-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredTemplates.map((entry) => {
              const { manifest, catalog } = entry;
              return (
                <article
                  key={manifest.slug}
                  data-testid={`marketplace-card-${manifest.slug}`}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/60 overflow-hidden hover:border-slate-700 transition shadow-lg"
                >
                  {/* Visual Scoped Theme Preview Strip */}
                  <div
                    className="p-5 border-b border-slate-800/80 space-y-3"
                    style={{
                      backgroundColor: manifest.theme.surfaceBg,
                      color: manifest.theme.textColor,
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                      <span
                        className="rounded px-2 py-0.5 font-bold uppercase"
                        style={{
                          backgroundColor:
                            manifest.mode === "standalone"
                              ? "rgba(245, 158, 11, 0.22)"
                              : "rgba(34, 211, 238, 0.2)",
                          color:
                            manifest.mode === "standalone"
                              ? "#fbbf24"
                              : "#22d3ee",
                        }}
                      >
                        {manifest.mode === "standalone"
                          ? "Mode B · Standalone"
                          : "Mode A · Native"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {manifest.verified && (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-400">
                            ✓ GenUI Verified
                          </span>
                        )}
                        <span className="rounded bg-slate-950/70 px-2 py-0.5 font-semibold text-slate-200 border border-white/15">
                          {manifest.tier === "pro"
                            ? `PRO · $${manifest.priceUsd}`
                            : "FREE · MIT"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 border border-white/25"
                        style={{ backgroundColor: manifest.theme.accentColor }}
                      />
                      <h3
                        className="text-lg font-bold tracking-tight truncate"
                        style={{ fontFamily: manifest.theme.displayFont }}
                      >
                        {manifest.title}
                      </h3>
                    </div>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                        {manifest.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                        {manifest.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                        <span>
                          {catalog.metadata.componentNames.length} catalog blocks
                        </span>
                        <span>
                          {manifest.pages.length}{" "}
                          {manifest.pages.length === 1 ? "page" : "pages"} ·{" "}
                          {manifest.theme.defaultColorScheme}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => onOpenPreview(manifest.slug)}
                          data-testid={`preview-btn-${manifest.slug}`}
                          className="rounded-lg bg-cyan-500 px-3 py-2 font-semibold text-slate-950 hover:bg-cyan-400 transition cursor-pointer"
                        >
                          Live Preview →
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportTemplate(entry)}
                          data-testid={`export-btn-${manifest.slug}`}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-semibold text-slate-200 hover:border-purple-400/60 hover:text-purple-200 transition cursor-pointer"
                        >
                          Export 📦
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {exportTemplate && (
        <TemplateExportDialog
          isOpen={Boolean(exportTemplate)}
          onClose={() => setExportTemplate(null)}
          template={exportTemplate}
        />
      )}
    </div>
  );
};
