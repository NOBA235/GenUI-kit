/**
 * 100% Procedural Web Audio API Soundscape Synthesizer for AFTERDARK.
 * Zero external `.mp3`/`.wav` HTTP requests (no 404 failures in offline or headless runs).
 * Gracefully degrades to a silent no-op implementation when AudioContext is unavailable.
 */

export type FootstepSurface = "gravel" | "stone";

export interface AfterdarkAudioEngine {
  readonly isSupported: boolean;
  readonly isActive: boolean;
  initAndStart(): boolean;
  setMuted(muted: boolean): void;
  setWindIntensity(level: number): void;
  playRearWhisperCue(): void;
  playGateCreak(): void;
  playGateSlam(): void;
  playFootstep(surface: FootstepSurface, sprinting?: boolean): void;
  playLightningThunder(): void;
  playBranchCreak(): void;
  playDistantOwl(): void;
  dispose(): void;
}

class ProceduralWebAudioSoundscape implements AfterdarkAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeNodes: AudioNode[] = [];
  private activeSources: AudioScheduledSourceNode[] = [];
  private ambientIntervalId: number | null = null;
  private muted = false;
  private started = false;

  get isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(
      window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext,
    );
  }

  get isActive(): boolean {
    return this.started && this.ctx !== null && this.ctx.state !== "closed";
  }

  private createNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-weighted cold wind noise (biquad-friendly spectrum)
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    return buffer;
  }

  initAndStart(): boolean {
    if (typeof window === "undefined") return false;
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtxCtor) return false;

    try {
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtxCtor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.72;
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer(this.ctx, 4);
      }

      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      if (!this.started) {
        this.startContinuousBeds();
        this.started = true;
      }
      return true;
    } catch {
      return false;
    }
  }

  private startContinuousBeds(): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    const buffer = this.noiseBuffer;
    if (!ctx || !master || !buffer) return;

    const now = ctx.currentTime;

    // 1. Eerie modulated night wind loop
    const windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.setValueAtTime(340, now);
    windFilter.Q.setValueAtTime(2.6, now);

    const windLfo = ctx.createOscillator();
    windLfo.type = "sine";
    windLfo.frequency.setValueAtTime(0.085, now);
    const windLfoDepth = ctx.createGain();
    windLfoDepth.gain.setValueAtTime(190, now);
    windLfo.connect(windLfoDepth);
    windLfoDepth.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.001, now);
    windGain.gain.linearRampToValueAtTime(0.24, now + 2.4);

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    windSource.start(now);
    windLfo.start(now);
    this.windGain = windGain;
    this.activeSources.push(windSource, windLfo);
    this.activeNodes.push(windFilter, windLfoDepth, windGain);

    // 2. Sub-bass horror rumble drone (38 Hz + 41.5 Hz beating)
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(92, now);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.11, now + 3.0);

    const oscA = ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.setValueAtTime(38, now);

    const oscB = ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.setValueAtTime(41.5, now);

    oscA.connect(rumbleFilter);
    oscB.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);

    oscA.start(now);
    oscB.start(now);
    this.rumbleGain = rumbleGain;
    this.activeSources.push(oscA, oscB);
    this.activeNodes.push(rumbleFilter, rumbleGain);

    // 3. Occasional distant owl / creaking limb ambience
    this.ambientIntervalId = window.setInterval(() => {
      if (!this.isActive || this.muted) return;
      if (Math.random() < 0.45) {
        this.playBranchCreak();
      } else {
        this.playDistantOwl();
      }
    }, 9500);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    try {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.72,
        this.ctx.currentTime,
        0.08,
      );
    } catch {
      // Ignore closed context
    }
  }

  setWindIntensity(level: number): void {
    if (!this.ctx || !this.windGain) return;
    const clamped = Math.max(0.05, Math.min(1.5, level));
    try {
      this.windGain.gain.setTargetAtTime(
        0.28 * clamped,
        this.ctx.currentTime,
        0.25,
      );
      if (this.rumbleGain) {
        this.rumbleGain.gain.setTargetAtTime(
          0.08 + 0.06 * clamped,
          this.ctx.currentTime,
          0.25,
        );
      }
    } catch {
      // Ignore
    }
  }

  playRearWhisperCue(): void {
    if (!this.initAndStart() || !this.ctx || !this.masterGain || !this.noiseBuffer) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Cold spatialized breath from behind listener (PannerNode z = +3)
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.setValueAtTime(1150, now);
    formant.frequency.exponentialRampToValueAtTime(520, now + 1.4);
    formant.Q.setValueAtTime(6.0, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.26, now + 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    if (typeof ctx.createPanner === "function") {
      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.positionX.setValueAtTime(-0.35, now);
      panner.positionY.setValueAtTime(1.65, now);
      panner.positionZ.setValueAtTime(2.6, now);
      source.connect(formant);
      formant.connect(env);
      env.connect(panner);
      panner.connect(this.masterGain);
    } else {
      source.connect(formant);
      formant.connect(env);
      env.connect(this.masterGain);
    }

    source.start(now);
    source.stop(now + 1.75);
  }

  playGateCreak(): void {
    if (!this.initAndStart() || !this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const carrier = ctx.createOscillator();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(146, now);
    carrier.frequency.linearRampToValueAtTime(92, now + 0.9);
    carrier.frequency.linearRampToValueAtTime(64, now + 1.9);

    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(29, now);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(24, now);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(640, now);
    filter.Q.setValueAtTime(4.8, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.18, now + 0.25);
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.05);

    carrier.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + 2.1);
    mod.stop(now + 2.1);
  }

  playGateSlam(): void {
    if (!this.initAndStart() || !this.ctx || !this.masterGain || !this.noiseBuffer) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low iron thud
    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.35);

    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(0.42, now);
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subEnv);
    subEnv.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.48);

    // Metallic iron latch clang
    for (const freq of [392, 648]) {
      const metal = ctx.createOscillator();
      metal.type = "square";
      metal.frequency.setValueAtTime(freq, now);
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.setValueAtTime(freq, now);
      hp.Q.setValueAtTime(12, now);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.12, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      metal.connect(hp);
      hp.connect(env);
      env.connect(this.masterGain);
      metal.start(now);
      metal.stop(now + 0.55);
    }
  }

  playFootstep(surface: FootstepSurface, sprinting = false): void {
    if (!this.isActive || !this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pitchJitter = 0.88 + Math.random() * 0.24;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(
      (surface === "stone" ? 560 : 1450) * pitchJitter,
      now,
    );
    filter.Q.setValueAtTime(surface === "stone" ? 2.2 : 1.3, now);

    const env = ctx.createGain();
    const peak = sprinting ? 0.22 : 0.14;
    const dur = surface === "stone" ? 0.085 : 0.135;
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    const offset = Math.random() * 2.5;
    src.start(now, offset, dur + 0.02);
  }

  playLightningThunder(): void {
    if (!this.isActive || !this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuffer;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(340, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + 2.6);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.38, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

    rumble.connect(lp);
    lp.connect(env);
    env.connect(this.masterGain);
    rumble.start(now);
    rumble.stop(now + 2.9);
  }

  playBranchCreak(): void {
    if (!this.isActive || !this.ctx || !this.masterGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(132, now + 0.55);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(420, now);
    bp.Q.setValueAtTime(8, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.045, now + 0.14);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(bp);
    bp.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playDistantOwl(): void {
    if (!this.isActive || !this.ctx || !this.masterGain || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const pan =
      typeof ctx.createStereoPanner === "function"
        ? ctx.createStereoPanner()
        : null;
    if (pan) {
      pan.pan.value = Math.random() > 0.5 ? -0.65 : 0.65;
      pan.connect(this.masterGain);
    }
    const target = pan ?? this.masterGain;

    // Two-note minor third nocturnal owl hoot
    for (const [delay, freq, len] of [
      [0, 520, 0.24],
      [0.36, 440, 0.48],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.linearRampToValueAtTime(freq * 0.96, now + delay + len);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now + delay);
      env.gain.linearRampToValueAtTime(0.04, now + delay + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, now + delay + len);

      osc.connect(env);
      env.connect(target);
      osc.start(now + delay);
      osc.stop(now + delay + len + 0.04);
    }
  }

  dispose(): void {
    if (this.ambientIntervalId !== null && typeof window !== "undefined") {
      window.clearInterval(this.ambientIntervalId);
      this.ambientIntervalId = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.activeSources = [];

    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeNodes = [];

    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.rumbleGain = null;
    this.noiseBuffer = null;
    this.started = false;
  }
}

let sharedSoundscape: AfterdarkAudioEngine | null = null;

export function getAfterdarkSoundscape(): AfterdarkAudioEngine {
  if (!sharedSoundscape) {
    sharedSoundscape = new ProceduralWebAudioSoundscape();
  }
  return sharedSoundscape;
}

export function disposeAfterdarkSoundscape(): void {
  if (sharedSoundscape) {
    sharedSoundscape.dispose();
    sharedSoundscape = null;
  }
}
