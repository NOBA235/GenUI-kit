import React, { useEffect, useRef, useState } from "react";
import { getAfterdarkSoundscape } from "../audio/soundscape.js";
import { ZONE_TELEPORT_TARGETS } from "../engine/collision.js";
import { useAfterdarkStore } from "../store.js";
import type { QualityPreset } from "../types.js";

const ZONE_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  gatehouse: "WROUGHT-IRON GATEHOUSE",
  central_path: "ASHEN CENTRAL AVENUE",
  weeping_grove: "THE WEEPING GROVE",
  mausoleum: "EAST MAUSOLEUM PORTICO",
  chapel_steps: "GOTHIC CHAPEL STEPS",
  crypt_entrance: "SUNKEN CRYPT THRESHOLD",
};

export interface SceneOverlaysProps {
  readonly touchLookDeltaRef: React.MutableRefObject<{ x: number; y: number }>;
  readonly onRequestPointerLock: () => void;
}

export const SceneOverlays: React.FC<SceneOverlaysProps> = ({
  touchLookDeltaRef,
  onRequestPointerLock,
}) => {
  const phase = useAfterdarkStore((s) => s.phase);
  const typographyStep = useAfterdarkStore((s) => s.typographyStep);
  const pointerLocked = useAfterdarkStore((s) => s.pointerLocked);
  const debugEnabled = useAfterdarkStore((s) => s.debugEnabled);
  const showCollisionWireframes = useAfterdarkStore(
    (s) => s.showCollisionWireframes,
  );
  const lightOverride = useAfterdarkStore((s) => s.lightOverride);
  const playerPosition = useAfterdarkStore((s) => s.playerPosition);
  const playerYaw = useAfterdarkStore((s) => s.playerYaw);
  const currentZone = useAfterdarkStore((s) => s.currentZone);
  const fps = useAfterdarkStore((s) => s.fps);
  const quality = useAfterdarkStore((s) => s.quality);
  const audioMuted = useAfterdarkStore((s) => s.audioMuted);
  const touchControlsForced = useAfterdarkStore((s) => s.touchControlsForced);
  const virtualSprint = useAfterdarkStore((s) => s.virtualSprint);

  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [zoneBanner, setZoneBanner] = useState<string | null>(null);
  const prevZoneRef = useRef(currentZone);
  const lookDragRef = useRef<{ active: boolean; x: number; y: number; id: number }>({
    active: false,
    x: 0,
    y: 0,
    id: -1,
  });
  const joystickCenterRef = useRef<{ x: number; y: number; active: boolean; id: number }>({
    x: 0,
    y: 0,
    active: false,
    id: -1,
  });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsCoarsePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Zone change banner whisper during exploration
  useEffect(() => {
    if (phase !== "exploration") return;
    if (currentZone !== prevZoneRef.current) {
      prevZoneRef.current = currentZone;
      setZoneBanner(ZONE_DISPLAY_NAMES[currentZone] ?? currentZone.toUpperCase());
      const timer = window.setTimeout(() => setZoneBanner(null), 2800);
      return () => window.clearTimeout(timer);
    }
  }, [currentZone, phase]);

  // Timed typography sequence progression (Scene 01 -> 2:17 AM -> Why -> Something -> Enter)
  useEffect(() => {
    if (phase !== "typography") return;
    const store = useAfterdarkStore.getState();
    const audio = getAfterdarkSoundscape();

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const t1 = window.setTimeout(
      () => {
        store.setTypographyStep(2);
        audio.playBranchCreak();
      },
      prefersReduced ? 350 : 1900,
    );
    const t2 = window.setTimeout(
      () => {
        store.setTypographyStep(3);
        audio.playRearWhisperCue();
      },
      prefersReduced ? 700 : 4100,
    );
    const t3 = window.setTimeout(
      () => {
        store.setTypographyStep(4);
      },
      prefersReduced ? 1050 : 6400,
    );

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [phase]);

  const handleShutdownWake = () => {
    const audio = getAfterdarkSoundscape();
    audio.initAndStart();
    useAfterdarkStore.getState().startSequence();
  };

  const handleEnterCemetery = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = getAfterdarkSoundscape();
    audio.initAndStart();
    useAfterdarkStore.getState().beginGateTransition();
    onRequestPointerLock();
  };

  const showTouchControls =
    phase === "exploration" && (isCoarsePointer || touchControlsForced);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* SCENE 01: Pitch-Black Shutdown & Timed Typography Sequence */}
      {(phase === "shutdown" || phase === "typography") && (
        <div
          role="region"
          aria-label="AFTERDARK Opening Sequence"
          data-testid="afterdark-shutdown-overlay"
          onClick={phase === "shutdown" ? handleShutdownWake : undefined}
          className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-[#000000] px-6 text-center select-none"
        >
          {phase === "shutdown" ? (
            <button
              type="button"
              onClick={handleShutdownWake}
              data-testid="afterdark-wake-btn"
              className="group min-h-[44px] rounded px-6 py-4 font-mono text-xs tracking-[0.28em] text-zinc-600 transition-colors hover:text-zinc-300 cursor-pointer"
            >
              SIGNAL LOST · CLICK OR PRESS ENTER TO WAKE ARCHIVE
            </button>
          ) : (
            <div className="max-w-xl space-y-6">
              {typographyStep >= 1 && (
                <p
                  data-testid="afterdark-time-stamp"
                  className="afterdark-reveal-text font-mono text-xs uppercase tracking-[0.42em] text-red-500/80"
                >
                  2:17 AM
                </p>
              )}

              {typographyStep >= 2 && (
                <h1
                  data-testid="afterdark-question-line"
                  className="afterdark-reveal-text afterdark-display text-2xl sm:text-4xl font-semibold text-zinc-100"
                >
                  Why did you come here?
                </h1>
              )}

              {typographyStep >= 3 && (
                <p
                  data-testid="afterdark-whisper-line"
                  className="afterdark-reveal-text text-sm sm:text-base italic tracking-wide text-zinc-400"
                >
                  Something is waiting.
                </p>
              )}

              {typographyStep >= 4 ? (
                <div className="afterdark-reveal-text pt-4 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleEnterCemetery}
                    data-testid="enter-cemetery-btn"
                    className="min-h-[44px] border border-red-700/70 bg-red-950/35 px-8 py-3 font-mono text-xs font-semibold tracking-[0.28em] text-red-100 shadow-[0_0_32px_rgba(185,28,28,0.28)] transition hover:border-red-500 hover:bg-red-900/50 cursor-pointer"
                  >
                    ENTER THE CEMETERY
                  </button>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                    WASD TO WALK · SHIFT TO SPRINT · MOUSE TO LOOK
                  </span>
                </div>
              ) : (
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      useAfterdarkStore.getState().setTypographyStep(4);
                    }}
                    className="min-h-[32px] px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-zinc-600 hover:text-zinc-300 transition cursor-pointer"
                  >
                    SKIP SIGNAL SEQUENCE ▸
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scene 02 Transition Whisper */}
      {phase === "gate_transition" && (
        <div className="absolute inset-0 flex items-end justify-center pb-14">
          <p
            data-testid="afterdark-gate-entry-banner"
            className="afterdark-reveal-text font-mono text-[11px] tracking-[0.35em] text-zinc-400 uppercase"
          >
            Entering Ravenshollow Cemetery...
          </p>
        </div>
      )}

      {/* Exploration HUD */}
      {phase === "exploration" && (
        <>
          {/* Center Crosshair Dot (only when pointer locked) */}
          {pointerLocked && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-200/55"
            />
          )}

          {/* Top Bar: Zone Whisper + Minimal Audio/Controls without breaking immersion */}
          <div className="flex items-start justify-between p-4 gap-3">
            <div className="space-y-1">
              {zoneBanner && (
                <div
                  role="status"
                  aria-live="polite"
                  className="afterdark-reveal-text rounded border border-zinc-800/80 bg-black/75 px-3 py-1.5 font-mono text-[11px] tracking-[0.24em] text-zinc-200"
                >
                  {zoneBanner}
                </div>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-2 font-mono text-[10px]">
              {!pointerLocked && (
                <button
                  type="button"
                  onClick={onRequestPointerLock}
                  data-testid="lock-cursor-btn"
                  className="min-h-[32px] rounded border border-red-800/60 bg-black/80 px-2.5 py-1 text-red-200 hover:border-red-500 transition cursor-pointer"
                >
                  Click View / Lock Mouse Look
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !audioMuted;
                  useAfterdarkStore.getState().toggleMute();
                  getAfterdarkSoundscape().setMuted(nextMuted);
                }}
                aria-label={audioMuted ? "Unmute Audio" : "Mute Audio"}
                className="min-h-[32px] rounded border border-zinc-800 bg-black/75 px-2.5 py-1 text-zinc-400 hover:text-zinc-100 transition cursor-pointer"
              >
                {audioMuted ? "🔇 Muted" : "🔊 Audio"}
              </button>
              <button
                type="button"
                onClick={() => useAfterdarkStore.getState().toggleTouchControls()}
                aria-pressed={showTouchControls}
                className="min-h-[32px] rounded border border-zinc-800 bg-black/75 px-2.5 py-1 text-zinc-400 hover:text-zinc-100 transition cursor-pointer"
              >
                {showTouchControls ? "Hide Touch" : "Touch Pad"}
              </button>
            </div>
          </div>

          {/* Mobile Virtual Thumbstick + Look Pad Fallback */}
          {showTouchControls && (
            <div
              data-testid="afterdark-touch-controls"
              className="pointer-events-auto flex items-end justify-between px-5 pb-12"
            >
              {/* Left Virtual Movement Stick */}
              <div
                className="afterdark-touch-surface relative h-28 w-28 rounded-full border border-zinc-700/70 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  joystickCenterRef.current = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    active: true,
                    id: e.pointerId,
                  };
                }}
                onPointerMove={(e) => {
                  if (
                    !joystickCenterRef.current.active ||
                    e.pointerId !== joystickCenterRef.current.id
                  ) {
                    return;
                  }
                  const maxR = 42;
                  const dx = e.clientX - joystickCenterRef.current.x;
                  const dy = e.clientY - joystickCenterRef.current.y;
                  const len = Math.hypot(dx, dy);
                  const clampedLen = Math.min(len, maxR);
                  const nx = len > 0 ? (dx / len) * clampedLen : 0;
                  const ny = len > 0 ? (dy / len) * clampedLen : 0;
                  setKnobOffset({ x: nx, y: ny });
                  useAfterdarkStore.getState().setVirtualMove(nx / maxR, -ny / maxR);
                }}
                onPointerUp={(e) => {
                  if (e.pointerId !== joystickCenterRef.current.id) return;
                  joystickCenterRef.current.active = false;
                  setKnobOffset({ x: 0, y: 0 });
                  useAfterdarkStore.getState().setVirtualMove(0, 0);
                }}
                onPointerCancel={() => {
                  joystickCenterRef.current.active = false;
                  setKnobOffset({ x: 0, y: 0 });
                  useAfterdarkStore.getState().setVirtualMove(0, 0);
                }}
              >
                <div
                  className="h-10 w-10 rounded-full border border-red-400/70 bg-red-900/50"
                  style={{
                    transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                  }}
                />
              </div>

              {/* Right Look Drag Pad + Sprint Toggle */}
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    useAfterdarkStore.getState().setVirtualSprint(!virtualSprint)
                  }
                  className={`min-h-[36px] rounded border px-3 py-1 font-mono text-[10px] tracking-wider transition cursor-pointer ${
                    virtualSprint
                      ? "border-red-500 bg-red-950/70 text-red-200"
                      : "border-zinc-700 bg-black/70 text-zinc-300"
                  }`}
                >
                  {virtualSprint ? "SPRINT: ON" : "SPRINT"}
                </button>
                <div
                  aria-label="Touch Look Pad"
                  className="afterdark-touch-surface flex h-28 w-28 items-center justify-center rounded-full border border-zinc-700/70 bg-black/60 font-mono text-[10px] text-zinc-400"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    lookDragRef.current = {
                      active: true,
                      x: e.clientX,
                      y: e.clientY,
                      id: e.pointerId,
                    };
                  }}
                  onPointerMove={(e) => {
                    if (
                      !lookDragRef.current.active ||
                      e.pointerId !== lookDragRef.current.id
                    ) {
                      return;
                    }
                    touchLookDeltaRef.current.x += e.clientX - lookDragRef.current.x;
                    touchLookDeltaRef.current.y += e.clientY - lookDragRef.current.y;
                    lookDragRef.current.x = e.clientX;
                    lookDragRef.current.y = e.clientY;
                  }}
                  onPointerUp={(e) => {
                    if (e.pointerId === lookDragRef.current.id) {
                      lookDragRef.current.active = false;
                    }
                  }}
                >
                  LOOK
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ?debug=true Telemetry, Collision Wireframes & Teleport Overlay */}
      {debugEnabled && (
        <aside
          data-testid="afterdark-debug-overlay"
          aria-label="AFTERDARK Debug Telemetry Overlay"
          className="pointer-events-auto afterdark-debug-panel fixed left-3 top-14 z-30 w-72 rounded-lg p-3 font-mono text-[11px] text-zinc-200 shadow-2xl space-y-2.5"
        >
          <div className="flex items-center justify-between border-b border-red-900/40 pb-1.5">
            <span className="font-bold text-red-400">
              AFTERDARK DEBUG (?debug=true)
            </span>
            <button
              type="button"
              onClick={() => useAfterdarkStore.getState().toggleDebug(false)}
              className="rounded px-1.5 py-0.5 text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded bg-black/60 px-2 py-1">
              FPS: <strong className="text-emerald-300">{fps}</strong>
            </div>
            <div className="rounded bg-black/60 px-2 py-1">
              YAW: <strong className="text-cyan-300">{playerYaw.toFixed(2)}r</strong>
            </div>
            <div className="col-span-2 rounded bg-black/60 px-2 py-1">
              POS:{" "}
              <strong className="text-amber-300">
                ({playerPosition[0].toFixed(2)}, {playerPosition[1].toFixed(2)},{" "}
                {playerPosition[2].toFixed(2)})
              </strong>
            </div>
            <div className="col-span-2 rounded bg-black/60 px-2 py-1">
              ZONE: <strong className="text-zinc-100">{currentZone}</strong>
            </div>
          </div>

          {/* Quality Hardware Preset Switcher */}
          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">QUALITY PRESET:</div>
            <div className="grid grid-cols-3 gap-1">
              {(["low", "medium", "high"] as readonly QualityPreset[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => useAfterdarkStore.getState().setQuality(q)}
                  className={`rounded border px-2 py-1 uppercase cursor-pointer transition ${
                    quality === q
                      ? "border-red-500 bg-red-950/60 text-red-200 font-bold"
                      : "border-zinc-800 bg-black/60 text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Wireframe + Light Override + Lightning */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={() =>
                useAfterdarkStore.getState().toggleCollisionWireframes()
              }
              className={`rounded border px-2 py-1 cursor-pointer transition ${
                showCollisionWireframes
                  ? "border-emerald-500 bg-emerald-950/50 text-emerald-200"
                  : "border-zinc-800 bg-black/60 text-zinc-300"
              }`}
            >
              Colliders: {showCollisionWireframes ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() => useAfterdarkStore.getState().toggleLightOverride()}
              className={`rounded border px-2 py-1 cursor-pointer transition ${
                lightOverride
                  ? "border-amber-400 bg-amber-950/50 text-amber-200"
                  : "border-zinc-800 bg-black/60 text-zinc-300"
              }`}
            >
              Env Light: {lightOverride ? "BRIGHT" : "DARK"}
            </button>
            <button
              type="button"
              onClick={() => {
                useAfterdarkStore.getState().setLightningIntensity(1.0);
                getAfterdarkSoundscape().playLightningThunder();
              }}
              className="col-span-2 rounded border border-zinc-700 bg-black/60 px-2 py-1 text-cyan-300 hover:border-cyan-400 cursor-pointer transition"
            >
              ⚡ Trigger Lightning Reveal
            </button>
          </div>

          {/* Zone Teleport Buttons */}
          <div className="space-y-1">
            <div className="text-[10px] text-zinc-400">TELEPORT TO ZONE:</div>
            <div className="grid grid-cols-2 gap-1">
              {ZONE_TELEPORT_TARGETS.map((target) => (
                <button
                  key={target.zoneId}
                  type="button"
                  onClick={() =>
                    useAfterdarkStore.getState().teleportToZone(target.zoneId)
                  }
                  className="rounded border border-zinc-800 bg-black/60 px-2 py-1 text-left text-[10px] text-zinc-300 hover:border-red-500/60 hover:text-white cursor-pointer transition truncate"
                >
                  ⌖ {target.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
