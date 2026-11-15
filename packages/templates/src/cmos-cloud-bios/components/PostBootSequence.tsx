import React, { useEffect, useRef, useState } from "react";
import { getCmosAudio } from "../lib/cmos/audio.js";
import { getCmosStore, useCmos, useCmosUi } from "./cmos-store.js";

export interface PostBootSequenceProps {
  readonly biosVersion: string;
  readonly vendorLine: string;
  /** Milliseconds for the RAM count-up. 0 skips the animation. */
  readonly memoryTestMs: number;
}

const ENERGY_STAR = (
  <svg
    viewBox="0 0 180 96"
    width="180"
    height="96"
    role="img"
    aria-label="Energy Star emblem"
    style={{ shapeRendering: "crispEdges" }}
  >
    <rect x="0" y="0" width="180" height="96" fill="#000000" />
    <path d="M18 70 C 30 20, 110 6, 150 40" stroke="#00AAAA" strokeWidth="5" fill="none" />
    <polygon points="140,18 146,34 163,34 149,44 154,60 140,50 126,60 131,44 117,34 134,34" fill="#FFFF55" />
    <text x="16" y="88" fill="#FFFFFF" fontFamily="monospace" fontSize="15" fontWeight="bold">
      energy
    </text>
    <text x="82" y="88" fill="#00AAAA" fontFamily="monospace" fontSize="11">
      EPA POLLUTION PREVENTER
    </text>
  </svg>
);

/**
 * Power-On Self-Test screen. Counts up system RAM, detects the IDE devices from the live CMOS
 * registers, and plays the Award beep code for the POST result once audio is unlocked.
 * DEL / Enter / click enters SETUP; SPACE skips the count-up and enters SETUP immediately.
 */
export const PostBootSequence: React.FC<PostBootSequenceProps> = ({ biosVersion, vendorLine, memoryTestMs }) => {
  const phase = useCmos((s) => s.phase);
  const draft = useCmos((s) => s.draft);
  const post = useCmos((s) => s.telemetry.post);
  const checksumError = useCmos((s) => s.checksumError);
  const mode = useCmosUi((s) => s.mode);
  const postEnabled = useCmosUi((s) => s.postEnabled);
  const visible = mode === "setup" && (phase === "post" || phase === "rebooting");
  const totalKb = draft.memory.systemRamMb * 1024;
  const [countedKb, setCountedKb] = useState(memoryTestMs <= 0 ? totalKb : 0);
  const beepedRef = useRef(false);
  const done = countedKb >= totalKb;

  // Reboot: show "rebooting" briefly, then return to POST.
  useEffect(() => {
    if (phase !== "rebooting") return;
    const timer = window.setTimeout(() => getCmosStore().getState().dispatch({ type: "REBOOT_COMPLETE" }), 900);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Skip POST entirely when disabled.
  useEffect(() => {
    if (phase === "post" && (!postEnabled || mode === "landing")) {
      getCmosStore().getState().dispatch({ type: "ENTER_SETUP" });
    }
  }, [phase, postEnabled, mode]);

  // RAM count-up.
  useEffect(() => {
    if (phase !== "post") return;
    beepedRef.current = false;
    if (memoryTestMs <= 0) {
      setCountedKb(totalKb);
      return;
    }
    setCountedKb(0);
    const started = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / memoryTestMs);
      setCountedKb(Math.round((totalKb * progress) / 64) * 64);
      if (progress >= 1) window.clearInterval(timer);
    }, 40);
    return () => window.clearInterval(timer);
  }, [phase, totalKb, memoryTestMs]);

  // Beep code once the memory test completes.
  useEffect(() => {
    if (!visible || !done || beepedRef.current) return;
    beepedRef.current = true;
    getCmosAudio().playBeepCode(post.beepCode);
  }, [visible, done, post.beepCode]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "post") return;
      if (e.key === "Delete" || e.key === "Enter" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        getCmosAudio().unlock();
        getCmosStore().getState().dispatch({ type: "ENTER_SETUP" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, phase]);

  if (!visible) return null;

  const enter = () => {
    getCmosAudio().unlock();
    getCmosStore().getState().dispatch({ type: "ENTER_SETUP" });
  };

  const db = draft.storage.primaryMaster;
  const primary =
    db === "none" ? "None" : db === "nvme" ? "POSTGRES-17-NVME" : db === "scsi" ? "POSTGRES-17-SCSI" : "POSTGRES-17-IDE";
  const secondary = draft.storage.secondaryMaster === "none" ? "None" : `REDIS-CLUSTER-CACHE ${draft.storage.secondaryMaster.toUpperCase()}`;
  const failed = post.checks.filter((c) => c.status === "fail");

  return (
    <div
      className="cmos-post cmos-text"
      data-testid="cmos-post-screen"
      role="dialog"
      aria-modal="false"
      aria-label="Power-On Self-Test"
      onClick={phase === "post" ? enter : undefined}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[#FFFFFF]">Award Modular BIOS {biosVersion}, An Energy Star Ally</p>
          <p>{vendorLine}</p>
          <p className="pt-3 text-[#FFFFFF]">GENUI CLOUD-486 CPU at {Math.round(draft.cpu.fsbMhz * draft.cpu.multiplier)}MHz</p>
          <p data-testid="cmos-post-memory">
            Memory Test : {countedKb}K {done ? "OK" : ""}
            {!done && <span className="cmos-cursor">&nbsp;</span>}
          </p>
        </div>
        <div className="hidden sm:block shrink-0">{ENERGY_STAR}</div>
      </div>

      {phase === "rebooting" ? (
        <p className="pt-6 text-[#FFFF55]">Writing CMOS... Rebooting</p>
      ) : (
        <div className="pt-5 space-y-1" aria-live="polite">
          <p>Award Plug and Play BIOS Extension v1.0A</p>
          <p>Detecting HDD Primary Master ... {primary}</p>
          <p>Detecting HDD Primary Slave ... {draft.storage.primarySlave === "pgvector" ? "PGVECTOR-INDEX" : "None"}</p>
          <p>Detecting HDD Secondary Master ... {secondary}</p>
          {checksumError && <p className="text-[#FFFF55]">CMOS checksum error - Defaults loaded</p>}
          {done && (
            <p className={post.passed ? "text-[#FFFFFF]" : "text-[#FFFF55]"} data-testid="cmos-post-result">
              {post.passed
                ? "POST complete. All devices OK."
                : `POST WARNING: ${failed.map((c) => `${c.label} ${c.detail}`).join(" | ")}`}
            </p>
          )}
        </div>
      )}

      <p className="absolute bottom-6 left-10 right-10 text-[#FFFFFF]" data-testid="cmos-post-prompt">
        Press DEL or Click to Enter SETUP // Press SPACE to Skip
      </p>
    </div>
  );
};
