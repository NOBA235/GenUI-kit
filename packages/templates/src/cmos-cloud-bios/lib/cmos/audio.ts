/**
 * BIOS // NECROMANCER — PC Speaker + Acoustic FSK Modem (`lib/cmos/audio.ts`)
 *
 * Zero-dependency Web Audio API synthesizer:
 * - 1994 PC speaker: 1000 Hz POST beep, Award beep codes, key-navigation ticks.
 * - Dual-tone (high/low) alarm while thermal or budget limits are exceeded.
 * - Bell 103-style acoustic FSK transmitter: 1070 Hz space / 1270 Hz mark data tones after a
 *   2025 Hz answer-channel handshake tone, 8-N-1 framing, length header and CRC-16/CCITT.
 *   All audio passes one AnalyserNode so the UI can draw a live oscilloscope / FFT.
 *
 * Audio starts only after `unlock()` is called from a user gesture. Everything no-ops under SSR
 * or when AudioContext is unavailable. Sample buffers are bounded by MAX_FSK_PAYLOAD_BYTES.
 */

import type { BeepCode } from "./engine.js";

/* ═══════════════════════════ 1. Pure FSK framing & encoder ═══════════════════════════ */

export const FSK_TONES_HZ = { space: 1070, mark: 1270, answer: 2025 } as const;
/**
 * 300 baud is the Bell 103 standard. 600 baud still demodulates cleanly with Goertzel filters;
 * above that a 200 Hz tone shift spans less than one cycle per bit and cannot be decoded.
 */
export type FskBaud = 300 | 600;
export const FSK_BAUD_RATES: readonly FskBaud[] = [300, 600];
export const MAX_FSK_PAYLOAD_BYTES = 2048;

const SYN = 0x16;
const STX = 0x02;
const ETX = 0x03;
/** SYN SYN STX LEN_HI LEN_LO ... CRC_HI CRC_LO ETX */
export const FSK_FRAME_OVERHEAD_BYTES = 8;

const PREAMBLE_SEC = 0.5;
const GAP_SEC = 0.08;
const MARK_LEAD_SEC = 0.3;
const MARK_TAIL_SEC = 0.1;
const FADE_SEC = 0.004;

export function crc16Ccitt(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function buildFskFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_FSK_PAYLOAD_BYTES) {
    throw new RangeError(`FSK payload is ${payload.length} bytes; the modem limit is ${MAX_FSK_PAYLOAD_BYTES}.`);
  }
  const crc = crc16Ccitt(payload);
  const frame = new Uint8Array(payload.length + FSK_FRAME_OVERHEAD_BYTES);
  frame.set([SYN, SYN, STX, (payload.length >> 8) & 0xff, payload.length & 0xff], 0);
  frame.set(payload, 5);
  frame.set([(crc >> 8) & 0xff, crc & 0xff, ETX], 5 + payload.length);
  return frame;
}

/** Asynchronous serial 8-N-1, LSB first. 1 = mark, 0 = space. */
export function frameToBits(frame: Uint8Array): Uint8Array {
  const bits = new Uint8Array(frame.length * 10);
  frame.forEach((byte, i) => {
    const base = i * 10;
    bits[base] = 0;
    for (let b = 0; b < 8; b++) bits[base + 1 + b] = (byte >> b) & 1;
    bits[base + 9] = 1;
  });
  return bits;
}

export interface FskLayout {
  readonly sampleRate: number;
  readonly baud: FskBaud;
  readonly preambleEnd: number;
  readonly gapEnd: number;
  readonly dataStart: number;
  readonly dataEnd: number;
  readonly totalSamples: number;
  readonly bitCount: number;
  readonly durationSec: number;
}

export function planFskLayout(frameBytes: number, sampleRate: number, baud: FskBaud = 300): FskLayout {
  const bitCount = frameBytes * 10;
  const preambleEnd = Math.round(PREAMBLE_SEC * sampleRate);
  const gapEnd = preambleEnd + Math.round(GAP_SEC * sampleRate);
  const dataStart = gapEnd + Math.round(MARK_LEAD_SEC * sampleRate);
  const dataEnd = dataStart + Math.round((bitCount * sampleRate) / baud);
  const totalSamples = dataEnd + Math.round(MARK_TAIL_SEC * sampleRate);
  return { sampleRate, baud, preambleEnd, gapEnd, dataStart, dataEnd, totalSamples, bitCount, durationSec: totalSamples / sampleRate };
}

export function estimateFskDurationSec(payloadBytes: number, baud: FskBaud = 300): number {
  return PREAMBLE_SEC + GAP_SEC + MARK_LEAD_SEC + ((payloadBytes + FSK_FRAME_OVERHEAD_BYTES) * 10) / baud + MARK_TAIL_SEC;
}

export interface FskEncodeOptions {
  readonly sampleRate: number;
  readonly baud?: FskBaud;
  readonly amplitude?: number;
}

/**
 * Phase-continuous FSK synthesis: [2025 Hz answer tone][silence][mark lead][8-N-1 data][mark tail].
 * Deterministic and DOM-free, so it can be verified by a Goertzel demodulator in tests.
 */
export function encodeFskSamples(payload: Uint8Array, options: FskEncodeOptions): Float32Array<ArrayBuffer> {
  const { sampleRate } = options;
  const baud = options.baud ?? 300;
  const amplitude = options.amplitude ?? 0.5;
  const bits = frameToBits(buildFskFrame(payload));
  const layout = planFskLayout(bits.length / 10, sampleRate, baud);
  const out = new Float32Array(layout.totalSamples);
  const fade = Math.max(1, Math.round(FADE_SEC * sampleRate));
  const twoPi = Math.PI * 2;
  let phase = 0;

  for (let i = 0; i < layout.totalSamples; i++) {
    let freq: number;
    let gain = 1;
    if (i < layout.preambleEnd) {
      freq = FSK_TONES_HZ.answer;
      gain = Math.min(1, i / fade, (layout.preambleEnd - i) / fade);
    } else if (i < layout.gapEnd) {
      freq = FSK_TONES_HZ.mark;
      gain = 0;
    } else if (i < layout.dataStart || i >= layout.dataEnd) {
      freq = FSK_TONES_HZ.mark;
      gain = Math.min(1, (i - layout.gapEnd) / fade, (layout.totalSamples - i) / fade);
    } else {
      const bitIndex = Math.min(bits.length - 1, Math.floor(((i - layout.dataStart) * baud) / sampleRate));
      freq = bits[bitIndex] === 1 ? FSK_TONES_HZ.mark : FSK_TONES_HZ.space;
    }
    phase += (twoPi * freq) / sampleRate;
    if (phase > twoPi) phase -= twoPi;
    out[i] = Math.sin(phase) * amplitude * Math.max(0, gain);
  }
  return out;
}

export function encodePayload(payload: string | Uint8Array): Uint8Array {
  return typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
}

/* ═══════════════════════════ 2. Web Audio engine ═══════════════════════════ */

export type TransmissionOutcome = "completed" | "cancelled";

export interface FskTransmission {
  readonly id: number;
  readonly payloadBytes: number;
  readonly baud: FskBaud;
  readonly durationSec: number;
  /** 0..1 based on the AudioContext clock. */
  progress(): number;
  readonly done: Promise<TransmissionOutcome>;
  cancel(): void;
}

export interface CmosAudioEngine {
  readonly isSupported: boolean;
  readonly isUnlocked: boolean;
  readonly muted: boolean;
  /** Call from a click/keydown handler. Creates and resumes the AudioContext. */
  unlock(): boolean;
  setMuted(muted: boolean): void;
  playPostBeep(): void;
  playBeepCode(code: BeepCode): void;
  playKeyTick(): void;
  setAlarm(active: boolean): void;
  /** Encode and play the payload. Returns null when audio is locked or unsupported. */
  transmit(payload: string | Uint8Array, options?: { readonly baud?: FskBaud }): FskTransmission | null;
  cancelTransmission(): void;
  /** Shared analyser for the oscilloscope (time domain) and FFT (frequency domain). */
  getAnalyser(): AnalyserNode | null;
  dispose(): void;
}

const MASTER_GAIN = 0.6;
const KEY_TICK_MIN_INTERVAL_SEC = 0.028;

type AudioContextCtor = typeof AudioContext;

function resolveAudioContext(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

interface ActiveTransmission {
  readonly handle: FskTransmission;
  readonly source: AudioBufferSourceNode;
  readonly finish: (outcome: TransmissionOutcome) => void;
}

class WebAudioCmosEngine implements CmosAudioEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private alarm: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  private active: ActiveTransmission | null = null;
  private lastTickAt = -1;
  private nextTransmissionId = 1;
  private mutedState = false;

  get isSupported(): boolean {
    return resolveAudioContext() !== null;
  }

  get isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  get muted(): boolean {
    return this.mutedState;
  }

  unlock(): boolean {
    const Ctor = resolveAudioContext();
    if (!Ctor) return false;
    try {
      if (!this.ctx || this.ctx.state === "closed") {
        const ctx = new Ctor();
        const bus = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        const master = ctx.createGain();
        master.gain.value = this.mutedState ? 0 : MASTER_GAIN;
        // Analyser sits before the master gain so the oscilloscope still works when muted.
        bus.connect(analyser);
        analyser.connect(master);
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.bus = bus;
        this.analyser = analyser;
        this.master = master;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    if (!this.ctx || !this.master) return;
    try {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.015);
    } catch {
      // Closed context.
    }
  }

  private ready(): { ctx: AudioContext; bus: GainNode } | null {
    if (!this.ctx || !this.bus || this.ctx.state === "closed") return null;
    return { ctx: this.ctx, bus: this.bus };
  }

  /** Square-wave PC speaker tone with 3 ms attack/release to avoid clicks. */
  private tone(freq: number, start: number, duration: number, level: number): void {
    const r = this.ready();
    if (!r) return;
    const osc = r.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, start);
    const lowpass = r.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(4200, start);
    const env = r.ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(level, start + 0.003);
    env.gain.setValueAtTime(level, start + Math.max(0.003, duration - 0.003));
    env.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(lowpass);
    lowpass.connect(env);
    env.connect(r.bus);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  playPostBeep(): void {
    const r = this.ready();
    if (r) this.tone(1000, r.ctx.currentTime + 0.01, 0.18, 0.11);
  }

  playBeepCode(code: BeepCode): void {
    const r = this.ready();
    if (!r) return;
    let t = r.ctx.currentTime + 0.01;
    const beep = (seconds: number, freq = 1000) => {
      this.tone(freq, t, seconds, 0.11);
      t += seconds + 0.16;
    };
    switch (code) {
      case "ok":
        beep(0.18);
        break;
      case "irq-conflict":
        beep(0.6);
        beep(0.15);
        beep(0.15);
        break;
      case "undervolt":
        beep(0.6);
        beep(0.15);
        beep(0.15);
        beep(0.15);
        break;
      case "budget":
        beep(0.15);
        beep(0.15);
        break;
      case "thermal":
        // Award overheat siren: alternating high/low tones.
        for (let i = 0; i < 4; i++) {
          this.tone(1000, t, 0.22, 0.1);
          this.tone(600, t + 0.25, 0.22, 0.1);
          t += 0.5;
        }
        break;
    }
  }

  playKeyTick(): void {
    const r = this.ready();
    if (!r || this.mutedState) return;
    const now = r.ctx.currentTime;
    if (now - this.lastTickAt < KEY_TICK_MIN_INTERVAL_SEC) return;
    this.lastTickAt = now;
    this.tone(2400, now, 0.004, 0.035);
  }

  setAlarm(active: boolean): void {
    const r = this.ready();
    if (!r) return;
    const now = r.ctx.currentTime;
    if (active && !this.alarm) {
      const osc = r.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(800, now);
      // A 2.5 Hz square LFO swings the pitch between 1000 Hz and 600 Hz.
      const lfo = r.ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.setValueAtTime(2.5, now);
      const depth = r.ctx.createGain();
      depth.gain.setValueAtTime(200, now);
      const lowpass = r.ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(3200, now);
      const gain = r.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.05);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      osc.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(r.bus);
      osc.start(now);
      lfo.start(now);
      this.alarm = { osc, lfo, gain };
    } else if (!active && this.alarm) {
      const { osc, lfo, gain } = this.alarm;
      this.alarm = null;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.stop(now + 0.06);
        lfo.stop(now + 0.06);
      } catch {
        // Already stopped.
      }
    }
  }

  transmit(payload: string | Uint8Array, options: { readonly baud?: FskBaud } = {}): FskTransmission | null {
    const r = this.ready();
    if (!r) return null;
    const bytes = encodePayload(payload);
    const baud = options.baud ?? 300;
    const samples = encodeFskSamples(bytes, { sampleRate: r.ctx.sampleRate, baud });
    this.cancelTransmission();

    const buffer = r.ctx.createBuffer(1, samples.length, r.ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = r.ctx.createBufferSource();
    source.buffer = buffer;
    const level = r.ctx.createGain();
    level.gain.value = 0.36;
    source.connect(level);
    level.connect(r.bus);

    const startAt = r.ctx.currentTime + 0.02;
    const durationSec = samples.length / r.ctx.sampleRate;
    const ctx = r.ctx;
    let settle: (outcome: TransmissionOutcome) => void = () => undefined;
    const done = new Promise<TransmissionOutcome>((resolve) => {
      settle = resolve;
    });
    let finished = false;
    const finish = (outcome: TransmissionOutcome) => {
      if (finished) return;
      finished = true;
      if (this.active?.source === source) this.active = null;
      try {
        level.disconnect();
      } catch {
        // Already disconnected.
      }
      settle(outcome);
    };

    const handle: FskTransmission = {
      id: this.nextTransmissionId++,
      payloadBytes: bytes.length,
      baud,
      durationSec,
      progress: () => (finished ? 1 : clamp01((ctx.currentTime - startAt) / durationSec)),
      done,
      cancel: () => {
        try {
          source.stop();
        } catch {
          // Not started or already stopped.
        }
        finish("cancelled");
      },
    };
    source.onended = () => finish("completed");
    source.start(startAt);
    this.active = { handle, source, finish };
    return handle;
  }

  cancelTransmission(): void {
    this.active?.handle.cancel();
    this.active = null;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  dispose(): void {
    this.cancelTransmission();
    this.setAlarm(false);
    const ctx = this.ctx;
    this.ctx = null;
    this.bus = null;
    this.analyser = null;
    this.master = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

let sharedEngine: CmosAudioEngine | null = null;

export function getCmosAudio(): CmosAudioEngine {
  if (!sharedEngine) sharedEngine = new WebAudioCmosEngine();
  return sharedEngine;
}

export function disposeCmosAudio(): void {
  sharedEngine?.dispose();
  sharedEngine = null;
}
