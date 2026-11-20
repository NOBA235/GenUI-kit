import React, { useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Download,
  ExternalLink,
  Maximize2,
  Monitor,
  PenTool,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  X,
} from "lucide-react";
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
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#09090B]/95 px-3.5 py-1.5 font-mono text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-[#18181B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
        >
          <span>Exit Fullscreen</span>
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div
        data-testid="studio-hud-collapsed"
        className="fixed top-3 right-3 z-40 flex items-center gap-2.5 rounded-lg border border-[#E4E4E7] bg-white/95 px-3 py-1.5 font-mono text-xs text-[#09090B] shadow-md backdrop-blur"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[#2563EB]"
        />
        <span className="font-medium">{manifest.slug}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid="expand-hud-btn"
          className="inline-flex min-h-[26px] items-center gap-1 rounded-md bg-[#09090B] px-2.5 py-1 text-[0.6875rem] font-medium text-white hover:bg-[#18181B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
        >
          <ChevronDown aria-hidden="true" className="h-3 w-3" />
          <span>Expand Studio HUD</span>
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
      className="sticky top-0 z-40 border-b border-[#E4E4E7] bg-white/95 text-[#09090B] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1760px] flex-col gap-2 px-3 py-2 sm:px-5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
        {/* Group 1: Navigation & Project Identity */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="hud-back-hub-btn"
            aria-label="Back to Studio Hub"
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Studio Hub</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:flex-wrap">
            <span className="truncate text-sm font-semibold tracking-tight text-[#09090B]">
              {manifest.title}
            </span>
            <span
              className={`hidden shrink-0 rounded-md border px-2 py-0.5 font-mono text-[0.625rem] font-medium sm:inline ${
                manifest.mode === "standalone"
                  ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
                  : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
              }`}
            >
              {manifest.mode === "standalone"
                ? "Mode B · Standalone"
                : "Mode A · Native"}
            </span>
            {isStreaming && (
              <span className="shrink-0 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 font-mono text-[0.625rem] font-medium text-[#1D4ED8]">
                Streaming<span className="hidden sm:inline"> JSONL</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse Studio HUD"
            aria-label="Collapse Studio HUD"
            className="inline-flex min-h-[32px] shrink-0 items-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2 py-1 text-xs text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer lg:hidden"
          >
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
          </button>

          {manifest.pages.length > 1 && (
            <div
              role="group"
              aria-label="Template pages"
              className="hub-scroll-row basis-full items-center gap-0.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-0.5 font-mono text-[0.6875rem] lg:basis-auto lg:flex-wrap"
            >
              {manifest.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={activePageId === p.id}
                  onClick={() => onSelectPage(p.id)}
                  className={`min-h-[26px] rounded-md px-2 py-0.5 focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                    activePageId === p.id
                      ? "bg-[#09090B] text-white font-medium"
                      : "text-[#52525B] hover:text-[#09090B]"
                  }`}
                >
                  {p.route}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group 2: Viewport & Fullscreen Controls */}
        <div className="hidden flex-wrap items-center gap-1.5 text-xs md:flex">
          <div
            role="group"
            aria-label="Viewport size selector"
            className="inline-flex items-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-0.5"
          >
            {(
              [
                ["desktop", "Desktop", Monitor],
                ["tablet", "Tablet", Tablet],
                ["mobile", "Mobile", Smartphone],
              ] as const
            ).map(([vp, label, Icon]) => (
              <button
                key={vp}
                type="button"
                onClick={() => onChangeViewport(vp)}
                data-testid={`viewport-btn-${vp}`}
                aria-pressed={viewport === vp}
                className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer ${
                  viewport === vp
                    ? "bg-white text-[#09090B] shadow-2xs font-semibold"
                    : "text-[#52525B] hover:text-[#09090B]"
                }`}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFullscreen}
            data-testid="toggle-fullscreen-btn"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <Maximize2 aria-hidden="true" className="h-3.5 w-3.5 text-[#52525B]" />
            <span>Fullscreen</span>
          </button>

          <a
            href={`/preview/${manifest.slug}?fullscreen=true`}
            target="_blank"
            rel="noreferrer"
            title="Pop out clean full-screen preview (?fullscreen=true)"
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition"
          >
            <span>Pop Out</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 text-[#52525B]" />
          </a>
        </div>

        {/* Group 3: Authoring & Inspection Tools */}
        <div className="hub-scroll-row -mx-3 items-center gap-1.5 px-3 pb-0.5 text-xs sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
          {onToggleWireframe && (
            <button
              type="button"
              onClick={onToggleWireframe}
              data-testid="toggle-wireframe-btn"
              aria-pressed={isWireframeMode}
              className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
                isWireframeMode
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                  : "border-[#E4E4E7] bg-white text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]"
              }`}
            >
              <PenTool aria-hidden="true" className="h-3.5 w-3.5" />
              <span>
                Wireframe<span className="hidden sm:inline">&nbsp;Architect</span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleRemix}
            data-testid="toggle-remix-bar-btn"
            aria-expanded={isRemixOpen}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer ${
              isRemixOpen
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                : "border-[#E4E4E7] bg-white text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]"
            }`}
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            <span>
              <span className="hidden sm:inline">Live&nbsp;</span>Remix
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenXRay}
            data-testid="open-hub-xray-btn"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1 font-medium text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <Activity aria-hidden="true" className="h-3.5 w-3.5 text-[#52525B]" />
            <span className="tabular-nums">
              X-Ray<span className="hidden sm:inline">&nbsp;&amp; PBT</span> ({patchCount})
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            data-testid="open-hub-export-btn"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-[#09090B] px-3.5 py-1 font-medium text-white hover:bg-[#18181B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1 text-[#09090B] hover:border-[#D4D4D8] hover:bg-[#FAFAFA] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer md:hidden"
          >
            <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Fullscreen</span>
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid="collapse-hud-btn"
            title="Collapse Studio HUD"
            className="hidden min-h-[32px] items-center gap-1 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-1 text-[#52525B] hover:border-[#D4D4D8] hover:text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer lg:inline-flex"
          >
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Collapsible GenUI Live Remix Bar */}
      {isRemixOpen && (
        <div
          data-testid="genui-remix-bar"
          className="border-t border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 sm:px-5"
        >
          <div className="mx-auto max-w-[1760px] space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="hub-scroll-row items-center gap-1.5 sm:flex-wrap">
                <span className="font-mono text-[0.6875rem] font-medium text-[#71717A] mr-1">
                  Presets:
                </span>
                {(manifest.remixPresets ?? []).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setRemixInput(preset.prompt);
                      onSubmitRemixPrompt(preset.prompt);
                    }}
                    className="min-h-[28px] rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 font-mono text-[0.6875rem] text-[#09090B] hover:border-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 font-medium text-[#09090B] hover:enabled:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                >
                  <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={onResetSpec}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 font-medium text-[#09090B] hover:bg-[#F4F4F5] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 transition cursor-pointer"
                >
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-wrap sm:flex-nowrap gap-2"
            >
              <label htmlFor="studio-remix-input" className="visually-hidden">
                GenUI Live Remix prompt
              </label>
              <input
                id="studio-remix-input"
                type="text"
                value={remixInput}
                onChange={(e) => setRemixInput(e.target.value)}
                placeholder="Stream layout or prop mutations via @genui-studio/core..."
                className="min-h-[36px] w-full flex-1 min-w-0 rounded-lg border sm:min-w-[200px] border-[#E4E4E7] bg-white px-3.5 py-1.5 text-xs text-[#09090B] placeholder:text-[#71717A] focus:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1"
              />
              <button
                type="submit"
                data-testid="submit-remix-btn"
                className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-1.5 text-xs font-medium text-white sm:w-auto hover:bg-[#18181B] focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-2 transition cursor-pointer"
              >
                <span>{isStreaming ? "Streaming JSONL..." : "Stream Remix"}</span>
                <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
