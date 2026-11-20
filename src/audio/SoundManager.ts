import type { MapTheme } from '../types';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted: boolean = false;
  private lastHitTime: number = 0;
  private lastBumperTime: number = 0;
  private lastJumpTime: number = 0;
  private lastSplashTime: number = 0;
  private lastCheerTime: number = 0;
  private lastGaspTime: number = 0;
  private bgmInterval: number | null = null;
  public bgmPlaying: boolean = false;
  private currentTheme: MapTheme = 'PLAYGROUND';

  constructor() {
    const unlockAudio = () => {
      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
  }

  public setMapTheme(theme: MapTheme): void {
    this.currentTheme = theme;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public playCountdownBeep(isGo: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isGo ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.42 : 0.18));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isGo ? 0.45 : 0.2));

    if (isGo) {
      this.playStartHorn();
    }
  }

  public playStartHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Dual stadium airhorn + referee whistle chirp
    for (const freq of [349.23, 440, 523.25]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2400, now + 0.03);
    whistle.frequency.setValueAtTime(2650, now + 0.11);
    whistle.frequency.setValueAtTime(2480, now + 0.19);
    wGain.gain.setValueAtTime(0.07, now + 0.03);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    whistle.connect(wGain);
    wGain.connect(ctx.destination);
    whistle.start(now + 0.03);
    whistle.stop(now + 0.32);

    this.playCrowdCheer(0.85);
  }

  public playRagdollHit(intensity: number = 1.0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHitTime < 55) return;
    this.lastHitTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clamped = Math.min(1.6, Math.max(0.4, intensity));

    // Low punch impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * clamped, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    gain.gain.setValueAtTime(0.22 * Math.min(1, clamped), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Blocky clack / comic oof overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(320 + Math.random() * 140, now);
    osc2.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain2.gain.setValueAtTime(0.07 * Math.min(1, clamped), now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.11);
  }

  public playBumperBounce(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastBumperTime < 65) return;
    this.lastBumperTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 260 + Math.random() * 90;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.3, now + 0.16);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playJump(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastJumpTime < 110) return;
    this.lastJumpTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.11);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playWaterSplash(intensity: number = 1.0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastSplashTime < 90) return;
    this.lastSplashTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.min(1.5, Math.max(0.4, intensity));

    // Bandpass noise splash
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.28);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.32);

    // Bubble bloop overtone
    const bubble = ctx.createOscillator();
    const bGain = ctx.createGain();
    bubble.type = 'sine';
    bubble.frequency.setValueAtTime(340 + Math.random() * 140, now + 0.02);
    bubble.frequency.exponentialRampToValueAtTime(780, now + 0.14);
    bGain.gain.setValueAtTime(0.09 * clamped, now + 0.02);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    bubble.connect(bGain);
    bGain.connect(ctx.destination);
    bubble.start(now + 0.02);
    bubble.stop(now + 0.17);
  }

  public playTubeMount(): void {
    this.playWaterSplash(0.8);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.14);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playCrowdCheer(intensity: number = 1.0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastCheerTime < 380) return;
    this.lastCheerTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(1.3, Math.max(0.4, intensity));

    // Filtered stadium roar swell
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(720, now);
    filter.frequency.linearRampToValueAtTime(1280, now + 0.28);
    filter.frequency.linearRampToValueAtTime(860, now + 0.85);
    filter.Q.value = 0.85;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.005, now);
    gain.gain.linearRampToValueAtTime(0.14 * vol, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.92);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.95);

    // Cheerful crowd harmonic chime
    for (const freq of [523.25, 659.25, 783.99]) {
      const osc = ctx.createOscillator();
      const cGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.04);
      cGain.gain.setValueAtTime(0.035 * vol, now + 0.04);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(cGain);
      cGain.connect(ctx.destination);
      osc.start(now + 0.04);
      osc.stop(now + 0.47);
    }
  }

  public playCrowdGasp(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastGaspTime < 520) return;
    this.lastGaspTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Collective "Oooooh!" formant sweep + noise puff
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.45);
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.54);

    for (const freq of [293.66, 369.99]) {
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.42);
      oGain.gain.setValueAtTime(0.06, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  }

  public playVictoryFanfare(): void {
    this.playCrowdCheer(1.3);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const fanfareNotes = [
      { f: 523.25, t: 0, d: 0.14 },
      { f: 659.25, t: 0.11, d: 0.14 },
      { f: 783.99, t: 0.22, d: 0.16 },
      { f: 1046.5, t: 0.35, d: 0.55 },
      { f: 783.99, t: 0.5, d: 0.14 },
      { f: 1046.5, t: 0.64, d: 0.7 },
    ];
    for (const n of fanfareNotes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.16, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.03);
    }
  }

  public playSlowMoTrigger(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.65);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.72);
    this.playCrowdGasp();
  }

  public playFinishChime(isTargetWinner: boolean = false): void {
    if (isTargetWinner) {
      this.playVictoryFanfare();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startTime = now + idx * 0.06;
      const duration = 0.16;

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.09, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  }

  public playFingerFlick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1750, now);
    snapOsc.frequency.exponentialRampToValueAtTime(260, now + 0.055);
    snapGain.gain.setValueAtTime(0.32, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.07);

    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(210, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    thumpGain.gain.setValueAtTime(0.3, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.25);

    const whooshOsc = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whooshOsc.type = 'sine';
    whooshOsc.frequency.setValueAtTime(760, now + 0.04);
    whooshOsc.frequency.exponentialRampToValueAtTime(230, now + 0.42);
    whooshGain.gain.setValueAtTime(0.11, now + 0.04);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshOsc.start(now + 0.04);
    whooshOsc.stop(now + 0.46);
  }

  public playBigJump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.24);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playWhirlwind(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(640, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playDinoRoar(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.42);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playKartBoost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(260, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.24);
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(520, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
    gain2.gain.setValueAtTime(0.12, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.33);
  }

  public playPoopSplat(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(290, now);
    osc1.frequency.exponentialRampToValueAtTime(68, now + 0.22);
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(145, now + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(48, now + 0.2);
    gain2.gain.setValueAtTime(0.14, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.03);
    osc2.stop(now + 0.23);
  }

  public startArcadeBgm(theme?: MapTheme): void {
    if (theme) this.currentTheme = theme;
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    let step = 0;

    const patterns: Record<MapTheme, { bass: number[]; lead: number[] }> = {
      PLAYGROUND: {
        bass: [130.81, 130.81, 164.81, 196.0, 146.83, 146.83, 174.61, 196.0],
        lead: [523.25, 0, 659.25, 587.33, 659.25, 0, 783.99, 659.25],
      },
      TAEKWONDO: {
        bass: [110.0, 110.0, 130.81, 146.83, 164.81, 146.83, 130.81, 98.0],
        lead: [440.0, 523.25, 0, 587.33, 659.25, 587.33, 523.25, 440.0],
      },
      DINOSAUR: {
        bass: [98.0, 110.0, 130.81, 98.0, 146.83, 130.81, 110.0, 98.0],
        lead: [392.0, 0, 493.88, 587.33, 0, 523.25, 440.0, 392.0],
      },
      POOL: {
        bass: [146.83, 174.61, 220.0, 196.0, 146.83, 174.61, 261.63, 220.0],
        lead: [587.33, 698.46, 0, 880.0, 783.99, 698.46, 587.33, 0],
      },
      FALLGUYS: {
        bass: [130.81, 164.81, 196.0, 220.0, 196.0, 164.81, 146.83, 196.0],
        lead: [523.25, 659.25, 783.99, 0, 880.0, 783.99, 659.25, 587.33],
      },
    };

    this.bgmInterval = window.setInterval(() => {
      if (this.muted || !this.bgmPlaying) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const { bass, lead } = patterns[this.currentTheme];
      const idx = step % bass.length;
      const bassFreq = bass[idx];
      const leadFreq = lead[idx];

      // 1. Punchy bass pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(bassFreq, now);
      gain.gain.setValueAtTime(0.036, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);

      // 2. Cheerful melody pluck
      if (leadFreq > 0) {
        const lOsc = ctx.createOscillator();
        const lGain = ctx.createGain();
        lOsc.type = this.currentTheme === 'POOL' ? 'sine' : 'square';
        lOsc.frequency.setValueAtTime(leadFreq, now);
        lGain.gain.setValueAtTime(this.currentTheme === 'POOL' ? 0.025 : 0.013, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        lOsc.connect(lGain);
        lGain.connect(ctx.destination);
        lOsc.start(now);
        lOsc.stop(now + 0.14);
      }

      // 3. Soft hi-hat groove on off-beats
      if (step % 2 === 1) {
        const hat = ctx.createBufferSource();
        hat.buffer = this.getNoiseBuffer(ctx);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const hGain = ctx.createGain();
        hGain.gain.setValueAtTime(0.015, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        hat.connect(hp);
        hp.connect(hGain);
        hGain.connect(ctx.destination);
        hat.start(now);
        hat.stop(now + 0.05);
      }

      step++;
    }, 185);
  }

  public stopArcadeBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }
}
