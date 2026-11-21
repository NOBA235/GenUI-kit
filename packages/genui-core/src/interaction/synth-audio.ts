import type { SynthSoundCue } from "./rule-types.js";

export interface MinimalAudioParam {
  setValueAtTime(value: number, startTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
}

export interface MinimalOscillatorNode {
  type: OscillatorType;
  frequency: MinimalAudioParam;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface MinimalGainNode {
  gain: MinimalAudioParam;
  connect(destination: unknown): unknown;
}

export interface MinimalAudioContext {
  readonly currentTime: number;
  readonly state?: string;
  readonly destination: unknown;
  createOscillator(): MinimalOscillatorNode;
  createGain(): MinimalGainNode;
  resume?(): Promise<void> | void;
  close?(): Promise<void> | void;
}

export interface WebAudioSynthOptions {
  /** Initial master volume in [0, 1] (default: 0.16) */
  readonly volume?: number;
  /** Whether audio output starts muted (default: false) */
  readonly muted?: boolean;
  /** Optional AudioContext factory for custom runtimes or deterministic testing */
  readonly createAudioContext?: () => MinimalAudioContext | null;
}

export interface WebAudioSynth {
  /** Play a procedural multi-note or percussive Web Audio cue (safe no-op in SSR/Node) */
  play(cue: SynthSoundCue): boolean;
  /** Mute or unmute synthesis output */
  setMuted(muted: boolean): void;
  /** Whether synthesis output is currently muted */
  isMuted(): boolean;
  /** Close and release the underlying AudioContext if initialized */
  dispose(): void;
}

interface SynthNoteSpec {
  readonly freqHz: number;
  readonly endFreqHz?: number;
  readonly delaySec: number;
  readonly durationSec: number;
  readonly wave: OscillatorType;
  readonly gainScale?: number;
}

const CUE_RECIPES: Readonly<Record<SynthSoundCue, readonly SynthNoteSpec[]>> = {
  click: [{ freqHz: 620, endFreqHz: 320, delaySec: 0, durationSec: 0.045, wave: "triangle" }],
  drop: [
    { freqHz: 240, endFreqHz: 140, delaySec: 0, durationSec: 0.08, wave: "sine" },
    { freqHz: 480, delaySec: 0.04, durationSec: 0.06, wave: "triangle", gainScale: 0.7 },
  ],
  powerup: [
    { freqHz: 330, delaySec: 0, durationSec: 0.09, wave: "triangle" },
    { freqHz: 440, delaySec: 0.07, durationSec: 0.09, wave: "triangle" },
    { freqHz: 660, delaySec: 0.14, durationSec: 0.14, wave: "sine" },
  ],
  unlock: [
    { freqHz: 523.25, delaySec: 0, durationSec: 0.08, wave: "sine" },
    { freqHz: 783.99, delaySec: 0.08, durationSec: 0.14, wave: "triangle" },
  ],
  alert: [
    { freqHz: 440, delaySec: 0, durationSec: 0.08, wave: "sawtooth", gainScale: 0.65 },
    { freqHz: 370, delaySec: 0.1, durationSec: 0.12, wave: "sawtooth", gainScale: 0.65 },
  ],
  win: [
    { freqHz: 523.25, delaySec: 0, durationSec: 0.1, wave: "triangle" },
    { freqHz: 659.25, delaySec: 0.09, durationSec: 0.1, wave: "triangle" },
    { freqHz: 783.99, delaySec: 0.18, durationSec: 0.12, wave: "triangle" },
    { freqHz: 1046.5, delaySec: 0.28, durationSec: 0.22, wave: "sine" },
  ],
  lose: [
    { freqHz: 392, delaySec: 0, durationSec: 0.13, wave: "sawtooth", gainScale: 0.7 },
    { freqHz: 311.13, delaySec: 0.12, durationSec: 0.14, wave: "sawtooth", gainScale: 0.7 },
    { freqHz: 233.08, endFreqHz: 165, delaySec: 0.24, durationSec: 0.24, wave: "triangle", gainScale: 0.8 },
  ],
};

function defaultCreateAudioContext(): MinimalAudioContext | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as {
    AudioContext?: new () => MinimalAudioContext;
    webkitAudioContext?: new () => MinimalAudioContext;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Procedural Web Audio synthesizer for `playSynthSound` interaction effects.
 * Zero external `.mp3`/`.wav` assets; gracefully no-ops in Node/SSR environments.
 */
export function createWebAudioSynth(
  options: WebAudioSynthOptions = {},
): WebAudioSynth {
  const baseVolume = Math.max(0.001, Math.min(1, options.volume ?? 0.16));
  const createCtx = options.createAudioContext ?? defaultCreateAudioContext;
  let muted = Boolean(options.muted);
  let ctx: MinimalAudioContext | null = null;
  let disposed = false;

  function ensureContext(): MinimalAudioContext | null {
    if (disposed || muted) return null;
    if (!ctx) {
      ctx = createCtx();
    }
    if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
      try {
        void ctx.resume();
      } catch {
        // Ignore autoplay resume errors
      }
    }
    return ctx;
  }

  return {
    play(cue: SynthSoundCue): boolean {
      const audio = ensureContext();
      if (!audio) return false;
      const notes = CUE_RECIPES[cue];
      if (!notes || notes.length === 0) return false;

      const now = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      try {
        for (const note of notes) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          const startAt = now + note.delaySec;
          const stopAt = startAt + note.durationSec;
          const peakGain = Math.max(0.001, baseVolume * (note.gainScale ?? 1));

          osc.type = note.wave;
          osc.frequency.setValueAtTime(note.freqHz, startAt);
          if (note.endFreqHz !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(
              Math.max(20, note.endFreqHz),
              stopAt,
            );
          }

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

          osc.connect(gain);
          gain.connect(audio.destination);
          osc.start(startAt);
          osc.stop(stopAt + 0.01);
        }
        return true;
      } catch {
        return false;
      }
    },

    setMuted(nextMuted: boolean): void {
      muted = Boolean(nextMuted);
    },

    isMuted(): boolean {
      return muted;
    },

    dispose(): void {
      disposed = true;
      if (ctx && typeof ctx.close === "function") {
        try {
          void ctx.close();
        } catch {
          // Ignore close errors
        }
      }
      ctx = null;
    },
  };
}
