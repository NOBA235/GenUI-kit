import React, { useEffect, useRef } from "react";
import {
  MAX_PARTIALS,
  MAX_ROOT_HZ,
  MIN_ROOT_HZ,
  getChimeraSonifier,
  mapTelemetryToSound,
  predictPartials,
  type SoundParams,
} from "../lib/chimera/sonifier.js";
import { getLabStore, setLab, useLab, type LabState } from "./lab-store.js";

export interface SonificationSpectrumHUDProps {
  readonly heading: string;
  /** Overlay the predicted FM partials (amber) on the live spectrum. */
  readonly showPartials: boolean;
}

const MIN_HZ = 20;
const MAX_HZ = 8000;
const LOG_MIN = Math.log(MIN_HZ);
const LOG_SPAN = Math.log(MAX_HZ) - LOG_MIN;
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000] as const;
const GRID_LABELS = ["50", "100", "200", "500", "1k", "2k", "5k"] as const;
const LABEL_FONT = "10px ui-monospace, Consolas, monospace";
const REDUCED_MOTION_FRAME_MS = 250;

const CONSONANCE_TEXT: Readonly<Record<SoundParams["consonance"], string>> = {
  harmonic: "Harmonic drone: root, perfect fifth and octave with FM ratio near 2",
  tense: "Tense drone: perfect fourth, partials drifting off the harmonic series",
  dissonant: "Dissonant drone: tritone with an inharmonic √2 FM ratio",
};

function soundParamsFor(state: LabState): SoundParams {
  return mapTelemetryToSound(state.telemetry, { rootHz: state.rootHz });
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Harmonic sonification HUD: live FFT of the lab's Web Audio output with the predicted FM partials
 * of the current telemetry overlaid, audio controls (enable, mute, volume, root frequency), and a
 * text equivalent of everything the audio conveys.
 */
export const SonificationSpectrumHUD: React.FC<SonificationSpectrumHUDProps> = ({ heading, showPartials }) => {
  const mode = useLab((s) => s.mode);
  const telemetry = useLab((s) => s.telemetry);
  const rootHz = useLab((s) => s.rootHz);
  const unlocked = useLab((s) => s.audioUnlocked);
  const muted = useLab((s) => s.audioMuted);
  const volume = useLab((s) => s.audioVolume);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const params = mapTelemetryToSound(telemetry, { rootHz });
  const visible = mode === "workbench";

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;
    const store = getLabStore();

    const partialHz = new Float32Array(MAX_PARTIALS);
    const partialLevel = new Float32Array(MAX_PARTIALS);
    let partialCount = 0;
    const syncPartials = (state: LabState) => {
      partialCount = predictPartials(soundParamsFor(state), partialHz, partialLevel);
    };
    syncPartials(store.getState());
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.telemetry !== prev.telemetry || state.rootHz !== prev.rootHz) syncPartials(state);
    });

    let width = 1;
    let height = 1;
    const size = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null;
    observer?.observe(wrap);

    const xOf = (hz: number) => ((Math.log(hz) - LOG_MIN) / LOG_SPAN) * width;
    let bins = new Uint8Array(0);
    let reducedMotion = prefersReducedMotion();
    let lastDraw = 0;
    let frame = 0;

    const draw = (now: number) => {
      frame = window.requestAnimationFrame(draw);
      if (document.hidden) return;
      if (reducedMotion && now - lastDraw < REDUCED_MOTION_FRAME_MS) return;
      lastDraw = now;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(0, 245, 184, 0.12)";
      ctx.fillStyle = "rgba(217, 255, 244, 0.5)";
      ctx.lineWidth = 1;
      ctx.font = LABEL_FONT;
      for (let i = 0; i < GRID_HZ.length; i++) {
        const x = xOf(GRID_HZ[i]!);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 14);
        ctx.stroke();
        ctx.fillText(GRID_LABELS[i]!, x + 2, height - 3);
      }

      const analyser = getChimeraSonifier().getAnalyser();
      if (analyser) {
        if (bins.length !== analyser.frequencyBinCount) bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        const binHz = analyser.context.sampleRate / analyser.fftSize;
        ctx.fillStyle = "#00F5B8";
        ctx.globalAlpha = 0.75;
        let prevX = xOf(MIN_HZ);
        for (let i = 1; i < bins.length; i++) {
          const hz = i * binHz;
          if (hz < MIN_HZ) continue;
          if (hz > MAX_HZ) break;
          const x = xOf(hz);
          const h = (bins[i]! / 255) * (height - 16);
          ctx.fillRect(prevX, height - 14 - h, Math.max(1, x - prevX), h);
          prevX = x;
        }
        ctx.globalAlpha = 1;
      }

      if (showPartials) {
        ctx.strokeStyle = "#FFB000";
        ctx.lineWidth = 2;
        for (let i = 0; i < partialCount; i++) {
          const hz = partialHz[i]!;
          if (hz < MIN_HZ || hz > MAX_HZ || partialLevel[i]! < 0.002) continue;
          const x = xOf(hz);
          const h = Math.min(1, partialLevel[i]! / 0.16) * (height - 20);
          ctx.beginPath();
          ctx.moveTo(x, height - 14);
          ctx.lineTo(x, height - 14 - h);
          ctx.stroke();
        }
      }
    };
    frame = window.requestAnimationFrame(draw);

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery?.addEventListener("change", onMotion);

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
      observer?.disconnect();
      motionQuery?.removeEventListener("change", onMotion);
    };
  }, [visible, showPartials]);

  if (!visible) return null;

  const enableAudio = () => {
    const ok = getChimeraSonifier().unlock();
    setLab({ audioUnlocked: ok, notice: ok ? "Audio enabled" : "Web Audio is not available in this browser" });
  };
  const bend = params.pitchBendSemitones;

  return (
    <section data-chimera-area="spectrum" className="chimera-panel space-y-3" aria-label={heading} data-testid="chimera-spectrum-hud">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="chimera-heading">{heading}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {!unlocked ? (
            <button type="button" className="chimera-button" data-variant="primary" onClick={enableAudio}>
              ▶ Enable audio
            </button>
          ) : (
            <button type="button" className="chimera-button" aria-pressed={muted} onClick={() => setLab({ audioMuted: !muted })}>
              {muted ? "■ Muted" : "♪ Sound on"}
            </button>
          )}
        </div>
      </div>

      <div ref={wrapRef} className="relative h-40 overflow-hidden rounded-lg bg-[rgba(0,0,0,0.45)]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Spectrum from ${MIN_HZ} Hz to ${MAX_HZ / 1000} kHz. ${CONSONANCE_TEXT[params.consonance]}.`}
          className="block h-full w-full"
        />
        {!unlocked && (
          <p className="pointer-events-none absolute left-3 top-2 chimera-mono text-[10px] chimera-muted">
            Audio off: showing predicted partials only.
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="chimera-mono text-[11px] chimera-muted">
          Volume {Math.round(volume * 100)}%
          <input
            type="range"
            className="block w-full accent-[#00F5B8]"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setLab({ audioVolume: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="chimera-mono text-[11px] chimera-muted">
          Root {rootHz.toFixed(0)} Hz
          <input
            type="range"
            className="block w-full accent-[#00F5B8]"
            min={MIN_ROOT_HZ}
            max={MAX_ROOT_HZ}
            value={rootHz}
            onChange={(e) => setLab({ rootHz: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="space-y-1 chimera-mono text-[11px]" data-testid="chimera-sound-text">
        <p aria-live="polite" className={params.consonance === "harmonic" ? "chimera-flux" : params.consonance === "tense" ? "chimera-synapse" : "chimera-mutation"}>
          {params.consonance === "harmonic" ? "● " : params.consonance === "tense" ? "◐ " : "▲ "}
          {CONSONANCE_TEXT[params.consonance]}
        </p>
        <p className="chimera-muted">
          FM ratio {params.fmRatio.toFixed(2)} · index {params.fmIndex.toFixed(1)} (flux entropy) · low-pass {(params.filterHz / 1000).toFixed(2)} kHz
          (total flux) · detune {params.detuneCents.toFixed(0)} cents
        </p>
        <p className="chimera-muted">
          Synapse grains {params.grainDensity.toFixed(0)}/s (conductivity change) · Geiger clicks {params.geigerRate.toFixed(1)}/s (full-table
          scans) · pitch bend {bend === 0 ? "0" : bend.toFixed(2)} semitones (worst latency)
        </p>
      </div>
    </section>
  );
};
