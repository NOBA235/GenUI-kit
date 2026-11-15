/**
 * CHIMERA // LAB — telemetry sonification (`lib/chimera/sonifier.ts`).
 *
 * `mapTelemetryToSound()` is pure: network health, entropy, flux, synapse firing, full-scan rate
 * and worst latency become synthesis parameters. The Web Audio engine only schedules what it
 * returns:
 * - Drone: three FM voices (root, fifth or tritone, octave). Healthy networks use a harmonic FM
 *   ratio of 2 and a perfect fifth; failing networks drift to √2 ratios, a tritone and detuned
 *   partials. Entropy raises modulation depth; flux opens the low-pass filter.
 * - Synapse grains: short FM blips whose density follows conductivity change.
 * - Geiger clicks: Poisson-timed noise ticks at the full-table-scan rate, capped at
 *   MAX_GEIGER_RATE.
 * Grains and clicks share one 25 ms look-ahead scheduler on the AudioContext clock. Audio starts
 * only after `unlock()` from a user gesture, and everything no-ops under SSR.
 */

/* ═══════════════════════════ Pure mapping ═══════════════════════════ */

export const MAX_GEIGER_RATE = 40;
export const MIN_ROOT_HZ = 40;
export const MAX_ROOT_HZ = 440;
export const DEFAULT_ROOT_HZ = 55;
export const MIN_GRAIN_DENSITY = 2;
export const MAX_GRAIN_DENSITY = 40;

export interface SonificationInput {
  readonly health: number;
  readonly entropy: number;
  readonly totalFlux: number;
  readonly synapseFiring: number;
  readonly fullScanRate: number;
  readonly worstRequestLatencyMs: number;
}

export interface SoundControls {
  readonly rootHz: number;
}

export interface SoundParams {
  readonly rootHz: number;
  /** Frequency ratios of the three drone voices relative to the bent root. */
  readonly voiceRatios: readonly [number, number, number];
  /** Spread applied as −d, +d·0.6, +d cents across the voices. */
  readonly detuneCents: number;
  /** Modulator frequency = carrier × fmRatio. 2 is harmonic, √2 inharmonic. */
  readonly fmRatio: number;
  /** Modulation index (peak deviation ÷ modulator frequency). */
  readonly fmIndex: number;
  readonly filterHz: number;
  readonly grainDensity: number;
  readonly geigerRate: number;
  readonly pitchBendSemitones: number;
  /** "harmonic" when the network is healthy enough for consonant intervals. */
  readonly consonance: "harmonic" | "tense" | "dissonant";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Pure telemetry → synthesis parameter mapping (design.md §7). */
export function mapTelemetryToSound(t: SonificationInput, controls: SoundControls = { rootHz: DEFAULT_ROOT_HZ }): SoundParams {
  const health = clamp(t.health, 0, 1);
  const entropy = clamp(t.entropy, 0, 1);
  const flux01 = 1 - Math.exp(-Math.max(0, t.totalFlux) / 2);
  const firing01 = 1 - Math.exp(-Math.max(0, t.synapseFiring) / 0.02);
  const consonance = health >= 0.6 ? "harmonic" : health >= 0.3 ? "tense" : "dissonant";
  const middle = consonance === "harmonic" ? 1.5 : consonance === "tense" ? 4 / 3 : Math.SQRT2;
  return {
    rootHz: clamp(controls.rootHz, MIN_ROOT_HZ, MAX_ROOT_HZ),
    voiceRatios: [1, middle, 2],
    detuneCents: (1 - health) * 35,
    fmRatio: Math.SQRT2 + (2 - Math.SQRT2) * health,
    fmIndex: 0.5 + entropy * 5.5,
    filterHz: 300 * (4500 / 300) ** flux01,
    grainDensity: MIN_GRAIN_DENSITY + (MAX_GRAIN_DENSITY - MIN_GRAIN_DENSITY) * firing01,
    geigerRate: clamp(t.fullScanRate, 0, MAX_GEIGER_RATE),
    pitchBendSemitones: -clamp(t.worstRequestLatencyMs / 2000, 0, 1),
    consonance,
  };
}

/** Seeded mulberry32 PRNG: grain pitches and click timing repeat exactly for a given seed. */
export function createSonifierRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poisson inter-arrival time (seconds) for a rate (events/s) and a uniform sample in [0, 1). */
export function poissonInterval(rate: number, u: number): number {
  if (!(rate > 0)) return Infinity;
  return -Math.log(1 - clamp(u, 0, 0.999999)) / rate;
}

/* ═══════════════════════════ Web Audio engine ═══════════════════════════ */

export interface ChimeraSonifier {
  readonly isSupported: boolean;
  readonly isUnlocked: boolean;
  readonly muted: boolean;
  readonly volume: number;
  readonly rootHz: number;
  /** Call from a click or keydown handler. Creates the graph and resumes the AudioContext. */
  unlock(): boolean;
  setMuted(muted: boolean): void;
  /** Master volume 0..1. */
  setVolume(volume: number): void;
  setRootFrequency(hz: number): void;
  /** Feed the latest telemetry; parameters glide to their new targets. */
  update(telemetry: SonificationInput): SoundParams;
  getAnalyser(): AnalyserNode | null;
  dispose(): void;
}

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_S = 0.12;
const GLIDE_S = 0.35;
const MASTER_LEVEL = 0.5;

interface Voice {
  readonly carrier: OscillatorNode;
  readonly modulator: OscillatorNode;
  readonly modDepth: GainNode;
  readonly level: GainNode;
}

type AudioContextCtor = typeof AudioContext;

function resolveAudioContext(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

class WebAudioChimeraSonifier implements ChimeraSonifier {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private voices: Voice[] = [];
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextGrainAt = 0;
  private nextClickAt = 0;
  private params: SoundParams = mapTelemetryToSound({ health: 1, entropy: 0, totalFlux: 0, synapseFiring: 0, fullScanRate: 0, worstRequestLatencyMs: 0 });
  private readonly rng = createSonifierRng(0xc41a3);
  private mutedState = false;
  private volumeState = 0.7;
  private rootState = DEFAULT_ROOT_HZ;

  get isSupported(): boolean {
    return resolveAudioContext() !== null;
  }

  get isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  get muted(): boolean {
    return this.mutedState;
  }

  get volume(): number {
    return this.volumeState;
  }

  get rootHz(): number {
    return this.rootState;
  }

  unlock(): boolean {
    const Ctor = resolveAudioContext();
    if (!Ctor) return false;
    try {
      if (!this.ctx || this.ctx.state === "closed") this.build(new Ctor());
      if (this.ctx!.state === "suspended") void this.ctx!.resume().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  private build(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, now);
    compressor.ratio.setValueAtTime(4, now);
    const master = ctx.createGain();
    master.gain.setValueAtTime(this.targetMasterGain(), now);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1, now);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(0.9, now);
    filter.frequency.setValueAtTime(this.params.filterHz, now);

    filter.connect(bus);
    bus.connect(analyser);
    analyser.connect(master);
    master.connect(compressor);
    compressor.connect(ctx.destination);

    // A 2 ms decaying noise burst, reused for every Geiger click.
    const length = Math.max(1, Math.round(ctx.sampleRate * 0.002));
    const click = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = click.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (this.rng() * 2 - 1) * (1 - i / length) ** 2;

    this.ctx = ctx;
    this.master = master;
    this.bus = bus;
    this.filter = filter;
    this.analyser = analyser;
    this.compressor = compressor;
    this.clickBuffer = click;
    this.voices = [0, 1, 2].map(() => this.createVoice(ctx, filter));
    this.applyParams(0);
    this.nextGrainAt = now + 0.2;
    this.nextClickAt = now + 0.2;
    this.schedulerId = setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  private createVoice(ctx: AudioContext, destination: AudioNode): Voice {
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    const modDepth = ctx.createGain();
    const level = ctx.createGain();
    level.gain.setValueAtTime(0, ctx.currentTime);
    modulator.connect(modDepth);
    modDepth.connect(carrier.frequency);
    carrier.connect(level);
    level.connect(destination);
    carrier.start();
    modulator.start();
    return { carrier, modulator, modDepth, level };
  }

  private targetMasterGain(): number {
    return this.mutedState ? 0 : MASTER_LEVEL * this.volumeState;
  }

  /** Glide the drone and filter toward the current parameters. */
  private applyParams(glide = GLIDE_S): void {
    const ctx = this.ctx;
    if (!ctx || !this.filter) return;
    const now = ctx.currentTime;
    const p = this.params;
    const root = this.rootState * 2 ** (p.pitchBendSemitones / 12);
    const levels = [0.16, 0.09, 0.06];
    const detune = [-p.detuneCents, p.detuneCents * 0.6, p.detuneCents];
    this.voices.forEach((voice, i) => {
      const freq = root * p.voiceRatios[i]!;
      const modFreq = freq * p.fmRatio;
      const target = (param: AudioParam, value: number) => {
        if (glide <= 0) param.setValueAtTime(value, now);
        else param.setTargetAtTime(value, now, glide / 3);
      };
      target(voice.carrier.frequency, freq);
      target(voice.carrier.detune, detune[i]!);
      target(voice.modulator.frequency, modFreq);
      target(voice.modDepth.gain, p.fmIndex * modFreq);
      target(voice.level.gain, levels[i]!);
    });
    if (glide <= 0) this.filter.frequency.setValueAtTime(p.filterHz, now);
    else this.filter.frequency.setTargetAtTime(p.filterHz, now, glide / 3);
  }

  /** Look-ahead scheduler for grains and clicks on the AudioContext clock. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.bus) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    const p = this.params;
    // Never schedule into the past after a stall (tab throttling, suspend).
    if (this.nextGrainAt < ctx.currentTime) this.nextGrainAt = ctx.currentTime + 0.01;
    if (this.nextClickAt < ctx.currentTime) this.nextClickAt = ctx.currentTime + 0.01;

    while (this.nextGrainAt < horizon) {
      this.playGrain(this.nextGrainAt);
      this.nextGrainAt += poissonInterval(p.grainDensity, this.rng());
    }
    if (p.geigerRate > 0) {
      while (this.nextClickAt < horizon) {
        this.playClick(this.nextClickAt);
        this.nextClickAt += poissonInterval(p.geigerRate, this.rng());
      }
    } else {
      this.nextClickAt = horizon;
    }
  }

  private playGrain(at: number): void {
    const ctx = this.ctx!;
    const p = this.params;
    const root = this.rootState * 2 ** (p.pitchBendSemitones / 12);
    // Grain pitches come from the current harmonic set, two to four octaves above the root.
    const ratio = p.voiceRatios[Math.floor(this.rng() * 3)]! * 2 ** (2 + Math.floor(this.rng() * 3));
    const freq = Math.min(8000, root * ratio);
    const duration = 0.02 + this.rng() * 0.05;
    const carrier = ctx.createOscillator();
    carrier.frequency.setValueAtTime(freq, at);
    const modulator = ctx.createOscillator();
    modulator.frequency.setValueAtTime(freq * p.fmRatio, at);
    const modDepth = ctx.createGain();
    modDepth.gain.setValueAtTime(freq * p.fmRatio * Math.min(2, p.fmIndex * 0.4), at);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.05, at + duration * 0.3);
    env.gain.linearRampToValueAtTime(0, at + duration);
    modulator.connect(modDepth);
    modDepth.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(this.filter!);
    carrier.start(at);
    modulator.start(at);
    carrier.stop(at + duration + 0.01);
    modulator.stop(at + duration + 0.01);
    carrier.onended = () => {
      carrier.disconnect();
      modulator.disconnect();
      modDepth.disconnect();
      env.disconnect();
    };
  }

  private playClick(at: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.clickBuffer;
    const level = ctx.createGain();
    level.gain.setValueAtTime(0.25 + this.rng() * 0.15, at);
    // Clicks bypass the low-pass so they stay sharp regardless of flux.
    source.connect(level);
    level.connect(this.bus!);
    source.start(at);
    source.onended = () => {
      source.disconnect();
      level.disconnect();
    };
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.glideMaster();
  }

  setVolume(volume: number): void {
    this.volumeState = clamp(volume, 0, 1);
    this.glideMaster();
  }

  private glideMaster(): void {
    if (!this.ctx || !this.master) return;
    try {
      this.master.gain.setTargetAtTime(this.targetMasterGain(), this.ctx.currentTime, 0.03);
    } catch {
      // Closed context.
    }
  }

  setRootFrequency(hz: number): void {
    this.rootState = clamp(hz, MIN_ROOT_HZ, MAX_ROOT_HZ);
    this.params = { ...this.params, rootHz: this.rootState };
    this.applyParams();
  }

  update(telemetry: SonificationInput): SoundParams {
    this.params = mapTelemetryToSound(telemetry, { rootHz: this.rootState });
    this.applyParams();
    return this.params;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  dispose(): void {
    if (this.schedulerId !== null) clearInterval(this.schedulerId);
    this.schedulerId = null;
    for (const voice of this.voices) {
      try {
        voice.carrier.stop();
        voice.modulator.stop();
      } catch {
        // Already stopped.
      }
      voice.carrier.disconnect();
      voice.modulator.disconnect();
      voice.modDepth.disconnect();
      voice.level.disconnect();
    }
    this.voices = [];
    for (const node of [this.filter, this.bus, this.analyser, this.master, this.compressor]) node?.disconnect();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.filter = null;
    this.analyser = null;
    this.compressor = null;
    this.clickBuffer = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }
}

let sharedSonifier: ChimeraSonifier | null = null;

export function getChimeraSonifier(): ChimeraSonifier {
  if (!sharedSonifier) sharedSonifier = new WebAudioChimeraSonifier();
  return sharedSonifier;
}

export function disposeChimeraSonifier(): void {
  sharedSonifier?.dispose();
  sharedSonifier = null;
}
