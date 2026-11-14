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
          className="rounded-full border border-slate-700/80 bg-slate-950/90 px-3.5 py-1.5 font-mono text-xs text-slate-200 shadow-xl backdrop-blur hover:border-cyan-400/60 hover:text-cyan-300 transition cursor-pointer"
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
        className="fixed top-3 right-3 z-40 flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/95 px-3 py-1.5 font-mono text-xs text-slate-200 shadow-2xl backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        <span className="font-semibold">{manifest.slug}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid="expand-hud-btn"
          className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-cyan-300 hover:bg-cyan-500/30 transition cursor-pointer"
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
      className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/95 text-slate-100 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: Back to Hub + Template Identity + Multi-page Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="hud-back-hub-btn"
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            ← Marketplace
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100">
              {manifest.title}
            </span>
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                manifest.mode === "standalone"
                  ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
              }`}
            >
              {manifest.mode === "standalone" ? "Mode B · Standalone" : "Mode A · Native"}
            </span>
          </div>

          {manifest.pages.length > 1 && (
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 font-mono text-[11px]">
              {manifest.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPage(p.id)}
                  className={`rounded px-2 py-0.5 transition cursor-pointer ${
                    activePageId === p.id
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p.route}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Viewport Switcher + Pop-Out Fullscreen */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div
            role="group"
            aria-label="Viewport size selector"
            className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5"
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
                className={`rounded px-2.5 py-1 transition cursor-pointer ${
                  viewport === vp
                    ? "bg-cyan-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-slate-100"
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
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition cursor-pointer"
          >
            ⛶ Fullscreen
          </button>

          <a
            href={`/preview/${manifest.slug}?fullscreen=true`}
            target="_blank"
            rel="noreferrer"
            title="Pop out clean full-screen preview (?fullscreen=true)"
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition"
          >
            Pop Out ↗
          </a>
        </div>

        {/* Right: Remix Bar Toggle + X-Ray PBT + Export Website + Collapse */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={onToggleRemix}
            data-testid="toggle-remix-bar-btn"
            aria-expanded={isRemixOpen}
            className={`rounded-lg border px-3 py-1.5 font-semibold transition cursor-pointer ${
              isRemixOpen
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            ✨ GenUI Live Remix
          </button>

          <button
            type="button"
            onClick={onOpenXRay}
            data-testid="open-hub-xray-btn"
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
          >
            🔬 X-Ray & PBT ({patchCount})
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            data-testid="open-hub-export-btn"
            className="rounded-lg border border-purple-400/60 bg-purple-500/20 px-3 py-1.5 font-semibold text-purple-200 hover:bg-purple-500/30 transition cursor-pointer"
          >
            📦 Export Website
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid="collapse-hud-btn"
            title="Collapse Studio HUD"
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-400 hover:text-slate-100 transition cursor-pointer"
          >
            ▲ Collapse
          </button>
        </div>
      </div>

      {/* Collapsible GenUI Live Remix Bar */}
      {isRemixOpen && (
        <div
          data-testid="genui-remix-bar"
          className="border-t border-slate-800/80 bg-slate-900/80 px-4 py-3"
        >
          <div className="mx-auto max-w-[1680px] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  GenUI Live Remix Presets:
                </span>
                {(manifest.remixPresets ?? []).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setRemixInput(preset.prompt);
                      onSubmitRemixPrompt(preset.prompt);
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200 transition cursor-pointer"
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
                  className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-300 disabled:opacity-40 hover:bg-slate-800 cursor-pointer"
                >
                  ↶ Undo
                </button>
                <button
                  type="button"
                  onClick={onResetSpec}
                  className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={remixInput}
                onChange={(e) => setRemixInput(e.target.value)}
                aria-label="GenUI Live Remix prompt"
                placeholder="Stream layout/prop mutations via @genui-studio/core (e.g., 'Switch to editorial headline and launch CTA')..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                data-testid="submit-remix-btn"
                className="rounded-lg bg-emerald-500 px-4 py-1.5 font-mono text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
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
