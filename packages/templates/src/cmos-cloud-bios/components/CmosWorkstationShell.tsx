import React, { useEffect, useRef } from "react";
import { disposeCmosAudio, getCmosAudio } from "../lib/cmos/audio.js";
import type { DefaultsPreset } from "../lib/cmos/engine.js";
import { getCmosStore, setCmosUi, useCmos, useCmosUi, type WorkspaceMode } from "./cmos-store.js";

export interface CmosWorkstationShellProps {
  readonly workspaceTitle: string;
  readonly defaultMode: WorkspaceMode;
  /** Register preset applied when the spec loads or a remix changes it. */
  readonly bootPreset: DefaultsPreset;
  readonly showPostOnBoot: boolean;
  readonly children?: React.ReactNode;
}

/**
 * Root of the template. Owns the mode switch (CMOS SETUP vs HARDWARE LANDING PAGE), lays out
 * child modules on a CSS grid (each child picks its area via `data-cmos-area`), unlocks audio on
 * the first gesture, and drives the dual-tone alarm from simulator telemetry.
 */
export const CmosWorkstationShell: React.FC<CmosWorkstationShellProps> = ({
  workspaceTitle,
  defaultMode,
  bootPreset,
  showPostOnBoot,
  children,
}) => {
  const mode = useCmosUi((s) => s.mode);
  const muted = useCmosUi((s) => s.audioMuted);
  const alarmActive = useCmos((s) => s.telemetry.alarmActive);
  const phase = useCmos((s) => s.phase);
  const presetRef = useRef<DefaultsPreset | null>(null);
  const modeRef = useRef<WorkspaceMode | null>(null);

  useEffect(() => {
    if (modeRef.current === defaultMode) return;
    modeRef.current = defaultMode;
    setCmosUi({ mode: defaultMode });
  }, [defaultMode]);

  useEffect(() => {
    setCmosUi({ postEnabled: showPostOnBoot });
  }, [showPostOnBoot]);

  // Apply the boot preset once per value. The initial "setup" preset leaves persisted CMOS alone.
  useEffect(() => {
    const first = presetRef.current === null;
    if (presetRef.current === bootPreset) return;
    presetRef.current = bootPreset;
    if (first && bootPreset === "setup") return;
    const cmos = getCmosStore().getState();
    if (cmos.phase === "post") cmos.dispatch({ type: "ENTER_SETUP" });
    getCmosStore().getState().dispatch({ type: "LOAD_DEFAULTS", preset: bootPreset });
    setCmosUi({ recoveryNotice: `PRESET LOADED: ${bootPreset.toUpperCase()}` });
  }, [bootPreset]);

  useEffect(() => {
    const audio = getCmosAudio();
    audio.setMuted(muted);
    audio.setAlarm(alarmActive && !muted && phase !== "post");
  }, [alarmActive, muted, phase]);

  useEffect(() => {
    const unlock = () => getCmosAudio().unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      disposeCmosAudio();
    };
  }, []);

  const switchMode = (next: WorkspaceMode) => {
    setCmosUi({ mode: next, activeMenu: null, hoverPart: null });
    if (next === "landing" && getCmosStore().getState().phase === "post") {
      getCmosStore().getState().dispatch({ type: "ENTER_SETUP" });
    }
  };

  return (
    <div className="relative" data-testid="cmos-workstation">
      <div className="cmos-workspace" data-cmos-mode={mode}>
        <nav
          data-cmos-area="top"
          aria-label="Workspace mode"
          className="flex flex-wrap items-center justify-between gap-2 bg-[#00AAAA] px-2 py-0.5 text-[#000000] cmos-text"
        >
          <span>{workspaceTitle}</span>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Mode">
            {(["setup", "landing"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                data-testid={`cmos-mode-${m}`}
                onClick={() => switchMode(m)}
                className={`px-2 ${mode === m ? "bg-[#AA0000] text-[#FFFF55]" : "bg-[#0000AA] text-[#FFFFFF]"}`}
              >
                [MODE: {m === "setup" ? "CMOS SETUP" : "HARDWARE LANDING PAGE"}]
              </button>
            ))}
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => setCmosUi({ audioMuted: !muted })}
              className="px-2 bg-[#000000] text-[#FFFFFF]"
            >
              {muted ? "[SPEAKER: OFF]" : "[SPEAKER: ON]"}
            </button>
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
};
