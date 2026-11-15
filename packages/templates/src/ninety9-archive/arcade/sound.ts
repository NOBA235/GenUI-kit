import type { ArcadeSfxEvent } from "./types.js";

let sharedAudioCtx: AudioContext | null = null;

function resolveAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function scheduleTone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0
): void {
  const start = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, start);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      start + durationSec
    );
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationSec + 0.01);
}

/**
 * Pure Web Audio API 8-bit retro waveform synthesizer (zero external MP3/dependency footprint).
 */
export function playArcadeSfx(event: ArcadeSfxEvent, muted: boolean): void {
  if (muted) return;
  try {
    const ctx = resolveAudioContext();
    if (!ctx) return;

    switch (event) {
      case "boot":
        scheduleTone(ctx, 440, 440, 0.07, "square", 0.05, 0);
        scheduleTone(ctx, 660, 660, 0.09, "square", 0.05, 0.08);
        return;
      case "pickup":
        scheduleTone(ctx, 520, 880, 0.08, "square", 0.05, 0);
        return;
      case "shoot":
        scheduleTone(ctx, 760, 220, 0.07, "triangle", 0.045, 0);
        return;
      case "hit":
        scheduleTone(ctx, 290, 120, 0.06, "square", 0.045, 0);
        return;
      case "clear":
        scheduleTone(ctx, 440, 440, 0.07, "square", 0.05, 0);
        scheduleTone(ctx, 554, 554, 0.07, "square", 0.05, 0.08);
        scheduleTone(ctx, 659, 659, 0.12, "square", 0.05, 0.16);
        return;
      case "gameover":
        scheduleTone(ctx, 330, 220, 0.12, "sawtooth", 0.04, 0);
        scheduleTone(ctx, 220, 110, 0.18, "sawtooth", 0.04, 0.13);
        return;
    }
  } catch {
    // Ignore audio context autoplay/policy rejections silently
  }
}
