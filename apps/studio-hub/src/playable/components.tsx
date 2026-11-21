import React from "react";
import { defineRegistry } from "@json-render/react";
import { playableCatalog } from "./catalog";

/*
 * Components for the playable catalog. They hold no domain state and attach no event
 * handlers: the host page dispatches clicks, drags, drops and key presses to the
 * interaction rule engine, and the components re-render from `$state`-bound props.
 *
 * This file is also copied verbatim into exported Next.js starters as
 * `src/template/components.tsx`.
 */

const COLUMN_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
};

const TONE_CLASS: Record<string, string> = {
  primary: "border-[#F59E0B] bg-[#F59E0B] text-[#0B0F14] hover:bg-[#FBBF24]",
  neutral: "border-[#2B3A4A] bg-[#16202B] text-[#E6EDF3] hover:border-[#3B4D61]",
  danger: "border-[#F87171] bg-[#2A1215] text-[#FCA5A5] hover:bg-[#3A161B]",
};

const OUTCOME_CLASS: Record<string, string> = {
  playing: "border-[#2B3A4A] bg-[#111821] text-[#9FB0C0]",
  win: "border-[#34D399] bg-[#052E22] text-[#6EE7B7]",
  lose: "border-[#F87171] bg-[#2A1215] text-[#FCA5A5]",
  complete: "border-[#60A5FA] bg-[#0B2540] text-[#93C5FD]",
};

const OUTCOME_TITLE: Record<string, string> = {
  win: "You win",
  lose: "Game over",
  complete: "Complete",
};

export const { registry: playableRegistry } = defineRegistry(playableCatalog.catalog, {
  components: {
    PlayShell: ({ props, children }) => (
      <section
        aria-label={props.title}
        className="w-full rounded-xl bg-[#0B0F14] p-5 text-[#E6EDF3] sm:p-7"
      >
        <header className="mb-5 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{props.title}</h2>
          {props.subtitle ? (
            <p className="max-w-[62ch] text-sm leading-relaxed text-[#9FB0C0]">{props.subtitle}</p>
          ) : null}
        </header>
        <div className="grid gap-4">{children}</div>
      </section>
    ),

    Panel: ({ props, children }) => (
      <section className="rounded-lg border border-[#1F2A37] bg-[#111821] p-4">
        <h3 className="mb-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9FB0C0]">
          {props.heading}
        </h3>
        <div className={`grid gap-3 ${COLUMN_CLASS[props.columns] ?? COLUMN_CLASS[2]}`}>
          {children}
        </div>
      </section>
    ),

    ControlButton: ({ props }) => (
      <button
        type="button"
        data-tone={props.tone}
        data-highlight={props.highlight ? "true" : "false"}
        className={`flex min-h-[56px] w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-lg border px-4 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B] ${
          TONE_CLASS[props.tone] ?? TONE_CLASS.neutral
        } ${props.highlight ? "ring-2 ring-[#34D399] ring-offset-2 ring-offset-[#111821]" : ""}`}
      >
        <span className="text-sm font-semibold">{props.label}</span>
        {props.hint ? <span className="text-xs opacity-75">{props.hint}</span> : null}
      </button>
    ),

    SignalMeter: ({ props }) => {
      const ratio = Math.max(0, Math.min(1, props.value / props.max));
      return (
        <div
          role="meter"
          aria-label={props.label}
          aria-valuemin={0}
          aria-valuemax={props.max}
          aria-valuenow={props.value}
          className="space-y-2 rounded-lg border border-[#1F2A37] bg-[#0B0F14] p-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#9FB0C0]">{props.label}</span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {props.value} / {props.max}
              {props.unit ? ` ${props.unit}` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F2A37]">
            <div
              className="h-full rounded-full bg-[#F59E0B] transition-[width] duration-200"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        </div>
      );
    },

    CountdownDisplay: ({ props }) => {
      const warn = props.seconds <= props.warnAt;
      return (
        <div
          role="timer"
          aria-label={`${props.label}: ${props.seconds} seconds`}
          data-warning={warn ? "true" : "false"}
          className={`rounded-lg border p-3 ${
            warn ? "border-[#F87171] bg-[#2A1215]" : "border-[#1F2A37] bg-[#0B0F14]"
          }`}
        >
          <span className="block text-xs text-[#9FB0C0]">{props.label}</span>
          <span
            className={`font-mono text-3xl font-semibold tabular-nums ${
              warn ? "text-[#FCA5A5]" : "text-[#E6EDF3]"
            }`}
          >
            {props.seconds}s
          </span>
        </div>
      );
    },

    DragToken: ({ props }) => (
      <button
        type="button"
        draggable={!props.placed}
        aria-disabled={props.placed}
        aria-label={props.placed ? `${props.label} (placed)` : `${props.label}: drag to a slot, or click then click a slot`}
        data-placed={props.placed ? "true" : "false"}
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B] ${
          props.placed
            ? "cursor-default border-dashed border-[#2B3A4A] bg-transparent text-[#5B6B7C]"
            : "cursor-grab border-[#3B4D61] bg-[#16202B] text-[#E6EDF3] hover:border-[#F59E0B] active:cursor-grabbing"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0B0F14] font-mono text-sm font-bold text-[#F59E0B]"
        >
          {props.glyph}
        </span>
        <span className="text-sm font-medium">{props.label}</span>
        <span className="ml-auto text-xs text-[#9FB0C0]">{props.placed ? "Placed" : "Drag"}</span>
      </button>
    ),

    DropSlot: ({ props }) => (
      <button
        type="button"
        aria-label={`${props.label}: ${props.filled ? "filled" : "empty"}`}
        data-filled={props.filled ? "true" : "false"}
        className={`flex min-h-[72px] w-full flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-4 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B] ${
          props.filled
            ? "border-solid border-[#34D399] bg-[#052E22] text-[#6EE7B7]"
            : "border-dashed border-[#3B4D61] bg-[#0B0F14] text-[#9FB0C0] hover:border-[#F59E0B]"
        }`}
      >
        <span className="text-sm font-semibold">{props.label}</span>
        <span className="text-xs opacity-80">{props.filled ? "Filled" : props.hint || "Empty"}</span>
      </button>
    ),

    OutcomeBanner: ({ props }) => (
      <div
        role="status"
        aria-live="polite"
        data-status={props.status}
        className={`flex min-h-[72px] flex-col justify-center rounded-lg border p-3 ${
          OUTCOME_CLASS[props.status] ?? OUTCOME_CLASS.playing
        }`}
      >
        <span className="text-xs uppercase tracking-wider opacity-80">Status</span>
        <span className="text-sm font-semibold">
          {props.status === "playing"
            ? props.playingText
            : `${OUTCOME_TITLE[props.status] ?? props.status}${props.message ? `: ${props.message}` : ""}`}
        </span>
      </div>
    ),
  },
  actions: {},
});

/** Name the exported Next.js starter imports from `src/template/components`. */
export const templateComponents = playableRegistry;
