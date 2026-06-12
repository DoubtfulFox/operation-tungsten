import type { Sfx } from "./Sfx";

export type MusicIntensity = "stealth" | "combat" | "alarm";

/**
 * Step-sequenced dark-synth score, GoldenEye style: each level has a
 * theme built from 16-step patterns, and four layers (bass / percussion
 * / pads / lead) crossfade with the game state — sneaking gets brooding
 * bass and pads, combat brings in the kit and the lead, the alarm
 * doubles the drive. Runs on the AudioContext clock with a lookahead
 * scheduler, so pause-menu ducking and slow-motion never affect tempo.
 */

interface Theme {
  bpm: number;
  /** 16-step bass line in Hz (0 = rest) */
  bass: number[];
  /** denser bass used while the alarm runs */
  bassAlarm: number[];
  /** 16-step lead line in Hz (0 = rest) — combat and alarm only */
  lead: number[];
  /** chord (Hz list) per bar, cycling */
  pads: number[][];
  /** 16-step kit: k kick, s snare, h hat, . rest */
  perc: string;
  percDrive: string;
}

// note frequencies
const D2 = 73.42, E2 = 82.41, F2 = 87.31, G2 = 98.0, A2 = 110.0, Bb2 = 116.54, C2 = 65.41, C3 = 130.81;
const D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.0, A3 = 220.0, Bb3 = 233.08;
const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, GS4 = 415.3, A4 = 440.0, C4 = 261.63;

const THEMES: Record<string, Theme> = {
  menu: {
    bpm: 96,
    bass: [D2, 0, 0, 0, D2, 0, F2, 0, C2, 0, 0, 0, G2, 0, F2, 0],
    bassAlarm: [D2, 0, D2, 0, F2, 0, F2, 0, C2, 0, C2, 0, G2, 0, F2, 0],
    lead: [D4, 0, 0, 0, F4, 0, 0, 0, A4, 0, GS4, 0, 0, 0, F4, 0],
    pads: [[D3, F3, A3], [Bb2, D3, F3], [C3, E3, G3], [A2, C3, E3]],
    perc: "k...............",
    percDrive: "k...h...k...h..."
  },
  m1: {
    bpm: 112,
    bass: [D2, 0, 0, D2, 0, 0, F2, 0, C2, 0, 0, C2, 0, G2, 0, F2],
    bassAlarm: [D2, D3, D2, D3, F2, F3, F2, F3, C2, C3, C2, C3, G2, G3, F2, F3],
    lead: [D4, 0, F4, 0, 0, A4, 0, GS4, 0, 0, F4, 0, D4, 0, 0, 0],
    pads: [[D3, F3, A3], [D3, F3, A3], [Bb2, D3, F3], [A2, C3, E3]],
    perc: "k.......k.....s.",
    percDrive: "k..h..s.k.h..s.h"
  },
  m2: {
    bpm: 100,
    bass: [E2, 0, 0, 0, 0, 0, G2, 0, E2, 0, 0, 0, D2, 0, 0, 0],
    bassAlarm: [E2, E3, E2, E3, G2, G3, G2, G3, E2, E3, E2, E3, D2, D3, D2, D3],
    lead: [E4, 0, 0, G4, 0, 0, 0, 0, E4, 0, D4, 0, 0, 0, 0, 0],
    pads: [[E3, G3, B3()], [C3, E3, G3], [E3, G3, B3()], [D3, F3, A3]],
    perc: "k...............",
    percDrive: "k...h.s.k...h.s."
  },
  m3: {
    bpm: 120,
    bass: [A2, 0, A2, 0, C3, 0, A2, 0, G2, 0, G2, 0, F2, 0, G2, 0],
    bassAlarm: [A2, A3, A2, A3, C3, C3 * 2, C3, C3 * 2, G2, G3, G2, G3, F2, F3, G2, G3],
    lead: [A4, 0, 0, C4 * 2, 0, A4, 0, G4, 0, 0, E4, 0, G4, 0, 0, 0],
    pads: [[A2, C3, E3], [F3, A3, C3 * 2], [G3, Bb3, D3 * 2], [A2, C3, E3]],
    perc: "k..h.s..k.h..s..",
    percDrive: "kh.hs.h.kh.hsh.h"
  },
  m4: {
    bpm: 104,
    bass: [A2, 0, 0, A2, 0, 0, E2, 0, F2, 0, 0, 0, G2, 0, E2, 0],
    bassAlarm: [A2, A3, A2, A3, E2, E3, E2, E3, F2, F3, F2, F3, G2, G3, E2, E3],
    lead: [E4, 0, 0, 0, A4, 0, 0, GS4, 0, 0, F4, 0, E4, 0, 0, 0],
    pads: [[A2, C3, E3], [F3, A3, C4], [G3, Bb3, D4], [A2, C3, E3]],
    perc: "k.......k.......",
    percDrive: "k..h.s..k.h.s.h."
  }
};

function B3(): number {
  return 246.94;
}

const LAYER_GAINS: Record<MusicIntensity, { bass: number; perc: number; pads: number; lead: number }> = {
  stealth: { bass: 0.15, perc: 0.05, pads: 0.09, lead: 0 },
  combat: { bass: 0.17, perc: 0.15, pads: 0.06, lead: 0.06 },
  alarm: { bass: 0.19, perc: 0.19, pads: 0.04, lead: 0.08 }
};

export class Music {
  private timer: number | null = null;
  private theme: Theme | null = null;
  private nextT = 0;
  private step = 0;
  private intensity: MusicIntensity = "stealth";
  private layers: { bass: GainNode; perc: GainNode; pads: GainNode; lead: GainNode } | null = null;
  private duckGain: GainNode | null = null;
  private scheduled: AudioScheduledSourceNode[] = [];
  private noiseBuf: AudioBuffer | null = null;

  constructor(private sfx: Sfx) {}

  start(themeId: string, intensity: MusicIntensity = "stealth"): void {
    const ctx = this.sfx.audioCtx;
    const bus = this.sfx.musicOut;
    if (!ctx || !bus) return;
    this.stop();
    this.theme = THEMES[themeId] ?? THEMES.m1;
    this.intensity = intensity;

    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }

    this.duckGain = ctx.createGain();
    this.duckGain.connect(bus);
    const mk = (): GainNode => {
      const g = ctx.createGain();
      g.connect(this.duckGain!);
      return g;
    };
    this.layers = { bass: mk(), perc: mk(), pads: mk(), lead: mk() };
    const lg = LAYER_GAINS[intensity];
    this.layers.bass.gain.value = lg.bass;
    this.layers.perc.gain.value = lg.perc;
    this.layers.pads.gain.value = lg.pads;
    this.layers.lead.gain.value = lg.lead;

    this.step = 0;
    this.nextT = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    // hard-stop everything scheduled so no tail leaks into menus
    for (const n of this.scheduled) {
      try {
        n.stop();
      } catch {
        // already ended
      }
    }
    this.scheduled.length = 0;
    if (this.layers) {
      for (const g of Object.values(this.layers)) g.disconnect();
      this.layers = null;
    }
    if (this.duckGain) {
      this.duckGain.disconnect();
      this.duckGain = null;
    }
  }

  /** Crossfade the layer mix toward the game state. */
  setIntensity(i: MusicIntensity): void {
    if (i === this.intensity || !this.layers) return;
    this.intensity = i;
    const ctx = this.sfx.audioCtx;
    if (!ctx) return;
    const lg = LAYER_GAINS[i];
    const t = ctx.currentTime;
    for (const k of ["bass", "perc", "pads", "lead"] as const) {
      this.layers[k].gain.cancelScheduledValues(t);
      this.layers[k].gain.setValueAtTime(this.layers[k].gain.value, t);
      this.layers[k].gain.linearRampToValueAtTime(lg[k], t + 1.5);
    }
  }

  /** Watch menu open — soften, never suspend (keeps the scheduler honest). */
  duck(on: boolean): void {
    const ctx = this.sfx.audioCtx;
    if (!ctx || !this.duckGain) return;
    const t = ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setValueAtTime(this.duckGain.gain.value, t);
    this.duckGain.gain.linearRampToValueAtTime(on ? 0.35 : 1, t + 0.25);
  }

  private tick(): void {
    const ctx = this.sfx.audioCtx;
    if (!ctx || !this.theme || !this.layers) return;
    const spb = 60 / this.theme.bpm / 4; // 16th notes
    while (this.nextT < ctx.currentTime + 0.12) {
      this.scheduleStep(ctx, this.step, this.nextT, spb);
      this.nextT += spb;
      this.step++;
    }
    // keep the ring from growing unbounded
    if (this.scheduled.length > 120) this.scheduled.splice(0, this.scheduled.length - 120);
  }

  private scheduleStep(ctx: AudioContext, step: number, t: number, spb: number): void {
    const th = this.theme!;
    const s16 = step % 16;
    const alarm = this.intensity === "alarm";

    // bass
    const bassPat = alarm ? th.bassAlarm : th.bass;
    const bn = bassPat[s16];
    if (bn > 0) this.noteAt(this.layers!.bass, "sawtooth", bn, t, spb * 0.92, 1);

    // pads: one chord per bar, only on the downbeat
    if (s16 === 0) {
      const chord = th.pads[Math.floor(step / 16) % th.pads.length];
      for (const f of chord) this.noteAt(this.layers!.pads, "triangle", f, t, spb * 15, 0.5, 0.4);
    }

    // lead
    const ln = th.lead[s16];
    if (ln > 0) this.noteAt(this.layers!.lead, "square", ln, t, spb * 1.7, 0.8);

    // percussion
    const pat = this.intensity === "stealth" ? th.perc : th.percDrive;
    const ch = pat[s16];
    if (ch === "k") this.kickAt(ctx, t);
    if (ch === "s") this.snareAt(ctx, t);
    if (ch === "h" || (alarm && s16 % 2 === 1)) this.hatAt(ctx, t);
  }

  // --- absolute-time synth voices ---------------------------------------

  private noteAt(dest: GainNode, type: OscillatorType, freq: number, t: number, dur: number, gain: number, attack = 0.01): void {
    const ctx = this.sfx.audioCtx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    this.scheduled.push(osc);
  }

  private kickAt(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(env);
    env.connect(this.layers!.perc);
    osc.start(t);
    osc.stop(t + 0.16);
    this.scheduled.push(osc);
  }

  private hatAt(ctx: AudioContext, t: number): void {
    this.noiseHit(ctx, t, 0.03, "highpass", 7000, 0.35);
  }

  private snareAt(ctx: AudioContext, t: number): void {
    this.noiseHit(ctx, t, 0.09, "bandpass", 1900, 0.7);
  }

  private noiseHit(ctx: AudioContext, t: number, dur: number, type: BiquadFilterType, freq: number, gain: number): void {
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(env);
    env.connect(this.layers!.perc);
    src.start(t);
    src.stop(t + dur + 0.02);
    this.scheduled.push(src);
  }
}
