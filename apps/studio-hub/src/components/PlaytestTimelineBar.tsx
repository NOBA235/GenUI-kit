import React from "react";
import {
  FlaskConical,
  Pause,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Undo2,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import type { PlaytestFuzzReport } from "@genui-studio/core/testing";
import type { PlayableSessionView } from "../lib/playable-session.js";

export type PlaytestMode = "play" | "edit" | "fuzz";

export interface PlaytestTimelineBarProps {
  readonly view: PlayableSessionView;
  readonly mode: PlaytestMode;
  readonly onModeChange: (mode: PlaytestMode) => void;
  readonly onScrub: (historyIndex: number) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onReset: () => void;
  readonly onToggleMute: () => void;
  readonly onVerify: () => void;
  readonly onReplayWin: () => void;
  readonly onStopReplay: () => void;
  readonly fuzzReport: PlaytestFuzzReport | null;
  readonly isVerifying: boolean;
  readonly isReplaying: boolean;
}

const MODES: readonly { id: PlaytestMode; label: string; icon: typeof Play; hint: string }[] = [
  { id: "play", label: "Play", icon: Play, hint: "Interact with the preview; timers run" },
  { id: "edit", label: "Edit", icon: Pencil, hint: "Click an element to inspect its rules; timers paused" },
  { id: "fuzz", label: "Fuzz", icon: FlaskConical, hint: "Fuzz the rules and review reachable outcomes" },
];

const BUTTON =
  "inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1 text-xs font-medium text-[#09090B] transition hover:enabled:border-[#D4D4D8] hover:enabled:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer";

/**
 * Play | Edit | Fuzz switch, TimeTravelStateStore history scrubber, fired-rule strip,
 * "Verify Winnability (Fuzz)" and "Auto-Replay Winning Trace".
 */
export const PlaytestTimelineBar: React.FC<PlaytestTimelineBarProps> = ({
  view,
  mode,
  onModeChange,
  onScrub,
  onUndo,
  onRedo,
  onReset,
  onToggleMute,
  onVerify,
  onReplayWin,
  onStopReplay,
  fuzzReport,
  isVerifying,
  isReplaying,
}) => {
  const maxIndex = Math.max(0, view.historyLength - 1);
  const winTrace = fuzzReport?.shortestTraces.win ?? null;
  const recent = [...view.recentTrace].reverse().slice(0, 6);

  return (
    <section
      aria-label="Playtest timeline"
      data-testid="playtest-timeline-bar"
      className="hub-card space-y-3 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Workbench mode" className="flex rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-0.5">
          {MODES.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              type="button"
              title={hint}
              aria-pressed={mode === id}
              data-testid={`playtest-mode-${id}`}
              onClick={() => onModeChange(id)}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-md px-3 text-xs font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563EB] ${
                mode === id ? "bg-white text-[#09090B] shadow-xs" : "text-[#52525B] hover:text-[#09090B]"
              }`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" className={BUTTON} onClick={onUndo} disabled={!view.canUndo} data-testid="timeline-undo-btn" aria-label="Step back one snapshot">
            <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={BUTTON} onClick={onRedo} disabled={!view.canRedo} data-testid="timeline-redo-btn" aria-label="Step forward one snapshot">
            <Redo2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={BUTTON} onClick={onReset} data-testid="timeline-reset-btn">
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Restart
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={onToggleMute}
            aria-pressed={!view.muted}
            aria-label={view.muted ? "Unmute sound" : "Mute sound"}
            data-testid="timeline-mute-btn"
          >
            {view.muted ? <VolumeX aria-hidden="true" className="h-3.5 w-3.5" /> : <Volume2 aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={BUTTON}
            onClick={onVerify}
            disabled={isVerifying}
            data-testid="verify-winnability-btn"
          >
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#047857]" />
            {isVerifying ? "Fuzzing…" : "Verify Winnability (Fuzz)"}
          </button>
          {isReplaying ? (
            <button type="button" className={BUTTON} onClick={onStopReplay} data-testid="stop-replay-btn">
              <Pause aria-hidden="true" className="h-3.5 w-3.5" />
              Stop replay
            </button>
          ) : (
            <button
              type="button"
              className={BUTTON}
              onClick={onReplayWin}
              disabled={!winTrace}
              title={winTrace ? `Replays ${winTrace.length} events` : "Run Verify Winnability first"}
              data-testid="replay-winning-trace-btn"
            >
              <Wand2 aria-hidden="true" className="h-3.5 w-3.5 text-[#2563EB]" />
              Auto-Replay Winning Trace
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="timeline-scrubber" className="shrink-0 font-mono text-[0.6875rem] text-[#52525B]">
          Snapshot{" "}
          <span data-testid="timeline-history-position" className="font-semibold text-[#09090B] tabular-nums">
            {view.historyIndex + 1}/{view.historyLength}
          </span>
        </label>
        <input
          id="timeline-scrubber"
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={Math.min(view.historyIndex, maxIndex)}
          onChange={(e) => onScrub(Number(e.target.value))}
          disabled={maxIndex === 0}
          data-testid="timeline-scrubber"
          data-history-length={view.historyLength}
          data-history-index={view.historyIndex}
          aria-valuetext={`Snapshot ${view.historyIndex + 1} of ${view.historyLength}`}
          className="min-w-[160px] flex-1 accent-[#2563EB]"
        />
      </div>

      <ol
        aria-label="Recently fired rules"
        data-testid="fired-rule-strip"
        className="hub-scroll-row m-0 min-h-[26px] list-none gap-1.5 p-0"
      >
        {recent.length === 0 ? (
          <li className="font-mono text-[0.6875rem] text-[#71717A]">No rules fired yet. Interact with the preview.</li>
        ) : (
          recent.map((trace, i) => (
            <li
              key={`${trace.stepId}-${trace.ruleId}`}
              data-rule-id={trace.ruleId}
              title={trace.effectsSummary.join(", ")}
              className={`rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] ${
                i === 0 && view.lastFired.some((f) => f.stepId === trace.stepId)
                  ? "border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]"
                  : trace.historyIndex > view.historyIndex
                    ? "border-dashed border-[#E4E4E7] bg-white text-[#A1A1AA]"
                    : "border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B]"
              }`}
            >
              {trace.ruleLabel}
            </li>
          ))
        )}
      </ol>
    </section>
  );
};
