import React, { useState } from "react";
import type { TemplateManifest } from "@genui-studio/templates";

export type ViewportPreset = "desktop" | "tablet" | "mobile";

export interface StudioHudProps {
  readonly manifest: TemplateManifest;
  readonly activePageId: string;
  readonly onSelectPage: (pageId: string) => void;
  readonly viewport: ViewportPreset;
  readonly onChangeViewport: (vp: ViewportPreset) => void;
  readonly isFullscreen: boolean;
  readonly onToggleFullscreen: () => void;
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly isRemixOpen: boolean;
  readonly onToggleRemix: () => void;
  readonly isWireframeMode?: boolean;
  readonly onToggleWireframe?: () => void;
  readonly onOpenXRay: () => void;
  readonly onOpenExport: () => void;
  readonly onNavigateHome: () => void;
  readonly patchCount: number;
  readonly isStreaming: boolean;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onResetSpec: () => void;
  readonly onSubmitRemixPrompt: (prompt: string) => void;
}

export const StudioHud: React.FC<StudioHudProps> = ({
  manifest,
  activePageId,
  onSelectPage,
  viewport,
  onChangeViewport,
  isFullscreen,
  onToggleFullscreen,
  isCollapsed,
  onToggleCollapsed,
  isRemixOpen,
  onToggleRemix,
  isWireframeMode = false,
  onToggleWireframe,
  onOpenXRay,
  onOpenExport,
  onNavigateHome,
  patchCount,
  isStreaming,
  canUndo,
  onUndo,
  onResetSpec,
  onSubmitRemixPrompt,
}) => {
  const [remixInput, setRemixInput] = useState("");

  if (isFullscreen) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={onToggleFullscreen}
          data-testid="exit-fullscreen-btn"
          className="inline-flex min-h-[34px] items-center rounded-full border border-white/25 bg-[#0B1324]/95 px-4 py-1.5 font-mono text-xs font-medium text-white shadow-xl backdrop-blur hover:bg-[#0B1324] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
        >
          Exit Fullscreen ✕
        </button>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div
        data-testid="studio-hud-collapsed"
        className="fixed top-3 right-3 z-40 flex items-center gap-2.5 rounded-full border border-[#CBD5E1] bg-white/95 px-3.5 py-1.5 font-mono text-xs text-[#0B1221] shadow-lg backdrop-blur"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[#2563EB]"
        />
        <span className="font-semibold">{manifest.slug}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid="expand-hud-btn"
          className="min-h-[28px] rounded-full bg-[#0B1324] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
        >
          Expand Studio HUD
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remixInput.trim()) return;
    onSubmitRemixPrompt(remixInput.trim());
  };

  return (
    <header
      data-testid="studio-hud"
      className="sticky top-0 z-40 border-b border-[#E8EDF5] bg-white/95 text-[#0B1221] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1760px] flex-col gap-2 px-3 py-2.5 sm:px-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
        {/* Group 1: Navigation & Project Identity */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="hud-back-hub-btn"
            aria-label="Back to Studio Hub"
            className="inline-flex min-h-[34px] shrink-0 items-center border border-[#CBD5E1] bg-white px-3.5 py-1.5 font-mono text-xs font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            ←<span className="hidden sm:inline">&nbsp;Studio Hub</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:flex-wrap">
            <span className="truncate text-sm font-bold text-[#0B1221]">
              {manifest.title}
            </span>
            <span
              className={`hidden shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase sm:inline ${
                manifest.mode === "standalone"
                  ? "border-[#D97706]/40 bg-[#FEF3C7] text-[#92400E]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#5B6B82]"
              }`}
            >
              {manifest.mode === "standalone"
                ? "Mode B · Standalone"
                : "Mode A · Native"}
            </span>
            {isStreaming && (
              <span className="shrink-0 rounded-full border border-[#2563EB]/30 bg-[#EFF4FF] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#2563EB]">
                Streaming<span className="hidden sm:inline"> JSONL</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse Studio HUD"
            aria-label="Collapse Studio HUD"
            className="inline-flex min-h-[34px] shrink-0 items-center border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-mono text-xs text-[#5B6B82] hover:border-[#94A3B8] hover:text-[#0B1221] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer lg:hidden"
          >
            ▲
          </button>

          {manifest.pages.length > 1 && (
            <div
              role="group"
              aria-label="Template pages"
              className="hub-scroll-row basis-full items-center gap-0.5 rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 font-mono text-[11px] lg:basis-auto lg:flex-wrap"
            >
              {manifest.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={activePageId === p.id}
                  onClick={() => onSelectPage(p.id)}
                  className={`min-h-[28px] rounded-full px-2.5 py-0.5 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                    activePageId === p.id
                      ? "bg-[#0B1324] text-white font-semibold"
                      : "text-[#5B6B82] hover:text-[#0B1221]"
                  }`}
                >
                  {p.route}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group 2: Viewport & Fullscreen Controls (viewport presets only matter on wider screens) */}
        <div className="hidden flex-wrap items-center gap-2 font-mono text-xs md:flex">
          <div
            role="group"
            aria-label="Viewport size selector"
            className="inline-flex items-center rounded-full border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
          >
            {(
              [
                ["desktop", "Desktop"],
                ["tablet", "Tablet"],
                ["mobile", "Mobile"],
              ] as const
            ).map(([vp, label]) => (
              <button
                key={vp}
                type="button"
                onClick={() => onChangeViewport(vp)}
                data-testid={`viewport-btn-${vp}`}
                aria-pressed={viewport === vp}
                className={`min-h-[30px] rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                  viewport === vp
                    ? "bg-[#0B1324] text-white font-semibold"
                    : "text-[#5B6B82] hover:text-[#0B1221]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            data-testid="toggle-fullscreen-btn"
            className="inline-flex min-h-[34px] items-center rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            ⛶ Fullscreen
          </button>

          <a
            href={`/preview/${manifest.slug}?fullscreen=true`}
            target="_blank"
            rel="noreferrer"
            title="Pop out clean full-screen preview (?fullscreen=true)"
            className="hub-cta inline-flex min-h-[34px] items-center border border-[#CBD5E1] bg-white px-3 py-1 text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition"
          >
            Pop Out ↗
          </a>
        </div>

        {/* Group 3: Authoring & Inspection Tools (one scrollable row on phones) */}
        <div className="hub-scroll-row -mx-3 items-center gap-2 px-3 pb-0.5 font-mono text-xs sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
          {onToggleWireframe && (
            <button
              type="button"
              onClick={onToggleWireframe}
              data-testid="toggle-wireframe-btn"
              aria-pressed={isWireframeMode}
              className={`inline-flex min-h-[34px] items-center rounded-full border px-3.5 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                isWireframeMode
                  ? "border-[#2563EB] bg-[#EFF4FF] text-[#1D4ED8]"
                  : "border-[#CBD5E1] bg-white text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC]"
              }`}
            >
              📐 Wireframe<span className="hidden sm:inline">&nbsp;Architect</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleRemix}
            data-testid="toggle-remix-bar-btn"
            aria-expanded={isRemixOpen}
            className={`inline-flex min-h-[34px] items-center rounded-full border px-3.5 py-1.5 font-semibold focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
              isRemixOpen
                ? "border-[#2563EB] bg-[#EFF4FF] text-[#1D4ED8]"
                : "border-[#CBD5E1] bg-white text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC]"
            }`}
          >
            ✨ <span className="hidden sm:inline">GenUI Live&nbsp;</span>Remix
          </button>

          <button
            type="button"
            onClick={onOpenXRay}
            data-testid="open-hub-xray-btn"
            className="inline-flex min-h-[34px] items-center rounded-full border border-[#CBD5E1] bg-white px-3.5 py-1.5 font-semibold text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            🔬 X-Ray<span className="hidden sm:inline">&nbsp;&amp; PBT</span> ({patchCount})
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            data-testid="open-hub-export-btn"
            className="inline-flex min-h-[34px] items-center rounded-full bg-[#0B1324] px-4 py-1.5 font-semibold text-white hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            📦 Export
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex min-h-[34px] items-center border border-[#CBD5E1] bg-white px-3 py-1 text-[#0B1221] hover:border-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer md:hidden"
          >
            ⛶ Fullscreen
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid="collapse-hud-btn"
            title="Collapse Studio HUD"
            className="hidden min-h-[34px] items-center border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[#5B6B82] hover:border-[#94A3B8] hover:text-[#0B1221] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer lg:inline-flex"
          >
            ▲ Collapse
          </button>
        </div>
      </div>

      {/* Collapsible GenUI Live Remix Bar */}
      {isRemixOpen && (
        <div
          data-testid="genui-remix-bar"
          className="border-t border-[#E8EDF5] bg-[#F8FAFC] px-4 py-3 sm:px-6"
        >
          <div className="mx-auto max-w-[1760px] space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="hub-scroll-row items-center gap-2 sm:flex-wrap">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B82]">
                  <span className="hidden sm:inline">GenUI Live Remix </span>Presets:
                </span>
                {(manifest.remixPresets ?? []).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setRemixInput(preset.prompt);
                      onSubmitRemixPrompt(preset.prompt);
                    }}
                    className="min-h-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 font-mono text-[11px] text-[#0B1221] hover:border-[#2563EB] hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="min-h-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-[#0B1221] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                >
                  ↶ Undo
                </button>
                <button
                  type="button"
                  onClick={onResetSpec}
                  className="min-h-[30px] rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-[#0B1221] hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-wrap sm:flex-nowrap gap-2"
            >
              <input
                type="text"
                value={remixInput}
                onChange={(e) => setRemixInput(e.target.value)}
                aria-label="GenUI Live Remix prompt"
                placeholder="Stream layout or prop mutations via @genui-studio/core..."
                className="min-h-[38px] w-full flex-1 min-w-0 rounded-full border sm:min-w-[200px] border-[#CBD5E1] bg-white px-4 py-1.5 text-sm text-[#0B1221] placeholder:text-[#64748B] focus:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
              />
              <button
                type="submit"
                data-testid="submit-remix-btn"
                className="min-h-[38px] w-full bg-[#0B1324] px-5 py-1.5 font-mono text-xs font-semibold text-white sm:w-auto hover:bg-[#1E293B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
              >
                {isStreaming ? "Streaming JSONL..." : "Stream Remix ↵"}
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
