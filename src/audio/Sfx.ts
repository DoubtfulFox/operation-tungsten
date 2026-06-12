import * as THREE from "three";
import { Samples } from "./Samples";

/**
 * Procedural WebAudio sound engine with optional CC0 sample overlays.
 * Every effect has a synthesized fallback; recorded samples (when
 * present in public/audio/) replace the weakest synths. Positional
 * sounds get distance attenuation + stereo pan relative to the listener.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private samples = new Samples();

  private listenerPos = new THREE.Vector3();
  private listenerRight = new THREE.Vector3(1, 0, 0);

  private alarmNodes: { osc: OscillatorNode; gain: GainNode; timer: number } | null = null;
  private ambientNodes: { stop: () => void } | null = null;

  masterVolume = 0.8;
  musicVolume = 0.5;

  /** Must be called from a user gesture before sounds can play. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.samples.load(this.ctx);
  }

  /** For the music sequencer (needs absolute-time scheduling). */
  get audioCtx(): AudioContext | null {
    return this.ctx;
  }

  get musicOut(): GainNode | null {
    return this.ctx ? this.musicBus : null;
  }

  setVolumes(master: number, music: number): void {
    this.masterVolume = master;
    this.musicVolume = music;
    if (this.ctx) {
      this.master.gain.value = master;
      this.musicBus.gain.value = music;
    }
  }

  setListener(pos: THREE.Vector3, forward: THREE.Vector3): void {
    this.listenerPos.copy(pos);
    this.listenerRight.set(-forward.z, 0, forward.x).normalize();
  }

  // ---- plumbing -------------------------------------------------------

  /** Build an output chain. pos=null → straight to bus (player-local sound). */
  private out(pos: THREE.Vector3 | null, baseGain: number, maxDist = 55): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    let vol = baseGain;
    if (pos) {
      const d = pos.distanceTo(this.listenerPos);
      if (d > maxDist) return null;
      const fall = 1 - d / maxDist;
      vol = baseGain * fall * fall;
      const toward = pos.clone().sub(this.listenerPos);
      const len = toward.length();
      const pan = len > 0.5 ? THREE.MathUtils.clamp(toward.normalize().dot(this.listenerRight), -1, 1) * 0.7 : 0;
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      g.connect(panner);
      panner.connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    g.gain.value = vol;
    return g;
  }

  private noise(dest: AudioNode, dur: number, filterType: BiquadFilterType, freq: number, gainEnv: [number, number], q = 1): void {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gainEnv[0], t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnv[1]), t + dur);
    src.connect(filt);
    filt.connect(env);
    env.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, g0: number, delay = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(g0, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ---- weapons --------------------------------------------------------

  shot(weaponId: string, pos: THREE.Vector3 | null = null): void {
    if (!this.ctx) return;
    // recorded sample first, synth as the fallback
    {
      const gain = weaponId === "pp9" ? 0.4 : weaponId === "shotgun" || weaponId === "sniper" ? 0.85 : 0.6;
      const o = this.out(pos, gain);
      if (o && this.samples.play(this.ctx, "shot_" + weaponId, o)) return;
    }
    switch (weaponId) {
      case "pp9": {
        const o = this.out(pos, 0.35);
        if (!o) return;
        this.noise(o, 0.07, "lowpass", 1100, [1, 0.01]);
        this.tone(o, "triangle", 320, 90, 0.05, 0.4);
        break;
      }
      case "dd4": {
        const o = this.out(pos, 0.6);
        if (!o) return;
        this.noise(o, 0.14, "lowpass", 2600, [1.2, 0.01]);
        this.tone(o, "square", 180, 50, 0.09, 0.5);
        break;
      }
      case "kr7": {
        const o = this.out(pos, 0.5);
        if (!o) return;
        this.noise(o, 0.1, "lowpass", 3200, [1.1, 0.01]);
        this.tone(o, "sawtooth", 220, 60, 0.07, 0.4);
        break;
      }
      case "shotgun": {
        const o = this.out(pos, 0.8);
        if (!o) return;
        this.noise(o, 0.3, "lowpass", 1400, [1.6, 0.01]);
        this.tone(o, "sine", 110, 40, 0.22, 0.8);
        break;
      }
      case "railgun": {
        const o = this.out(pos, 0.7);
        if (!o) return;
        this.noise(o, 0.25, "highpass", 2400, [0.7, 0.01]);
        this.tone(o, "sawtooth", 1800, 120, 0.35, 0.5);
        this.tone(o, "sine", 70, 45, 0.3, 0.7);
        break;
      }
      case "klobb": {
        // thin, rattly, cheap
        const o = this.out(pos, 0.45);
        if (!o) return;
        this.noise(o, 0.06, "bandpass", 2800, [0.9, 0.01]);
        this.tone(o, "square", 260, 90, 0.04, 0.3);
        break;
      }
      case "sniper": {
        // deep authoritative crack
        const o = this.out(pos, 0.85);
        if (!o) return;
        this.noise(o, 0.2, "lowpass", 2000, [1.5, 0.01]);
        this.tone(o, "sine", 90, 35, 0.25, 0.8);
        this.noise(o, 0.35, "highpass", 3000, [0.4, 0.005]);
        break;
      }
      case "golden": {
        // a gunshot with a signature ring
        const o = this.out(pos, 0.7);
        if (!o) return;
        this.noise(o, 0.14, "lowpass", 2600, [1.3, 0.01]);
        this.tone(o, "square", 180, 50, 0.09, 0.5);
        this.tone(o, "sine", 1320, 1180, 0.5, 0.16);
        break;
      }
      default: {
        const o = this.out(pos, 0.5);
        if (!o) return;
        this.noise(o, 0.12, "lowpass", 2500, [1, 0.01]);
      }
    }
  }

  dryfire(): void {
    const o = this.out(null, 0.3);
    if (!o) return;
    this.noise(o, 0.03, "bandpass", 2300, [0.8, 0.01], 4);
  }

  reload(): void {
    const o = this.out(null, 0.35);
    if (!o) return;
    if (this.ctx && this.samples.play(this.ctx, "reload", o)) return;
    this.noise(o, 0.04, "bandpass", 1700, [0.9, 0.01], 5);
    if (this.ctx) {
      const o2 = this.out(null, 0.35);
      if (o2) {
        const t = 0.28;
        this.tone(o2, "square", 900, 500, 0.03, 0.25, t);
        this.noise(o2, 0.05, "bandpass", 2100, [0.001, 0.9], 5);
      }
    }
  }

  ricochet(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.3, 40);
    if (!o) return;
    const f = 2400 + Math.random() * 1800;
    this.tone(o, "sine", f, f * 0.4, 0.18, 0.35);
  }

  impact(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.25, 35);
    if (!o) return;
    this.noise(o, 0.05, "lowpass", 900, [0.8, 0.01]);
  }

  fleshHit(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.4, 35);
    if (!o) return;
    if (this.ctx && this.samples.play(this.ctx, "fleshhit", o)) return;
    this.noise(o, 0.08, "lowpass", 500, [1, 0.01]);
    this.tone(o, "sine", 160, 70, 0.08, 0.4);
  }

  /** Idle-guard radio squawk — two clipped tones and a crackle. */
  radioChatter(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.18, 14);
    if (!o) return;
    this.tone(o, "square", 1250, 1100, 0.05, 0.3);
    this.tone(o, "square", 880, 940, 0.07, 0.25, 0.09);
    this.noise(o, 0.1, "bandpass", 2400, [0.25, 0.01], 4);
  }

  /** Melee swing — soft air swish, player-local. */
  whoosh(): void {
    const o = this.out(null, 0.25);
    if (!o) return;
    this.noise(o, 0.12, "bandpass", 900, [0.5, 0.02]);
  }

  /** Silent stealth takedown — a dull thud and a body easing down. */
  takedown(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.45, 12);
    if (!o) return;
    this.noise(o, 0.09, "lowpass", 350, [1, 0.01]);
    this.tone(o, "sine", 110, 55, 0.12, 0.5);
  }

  /** A round passing very close — filtered noise sweeping down. */
  whiz(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuf) return;
    const o = this.out(pos, 0.45, 20);
    if (!o) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 3;
    filt.frequency.setValueAtTime(3400, t);
    filt.frequency.exponentialRampToValueAtTime(650, t + 0.13);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.6, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(filt);
    filt.connect(env);
    env.connect(o);
    src.start(t);
    src.stop(t + 0.2);
  }

  /** Round punching through a door or thin cover. */
  penetrate(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.4, 30);
    if (!o) return;
    this.noise(o, 0.07, "lowpass", 650, [0.9, 0.01]);
    this.tone(o, "sine", 130, 60, 0.08, 0.5);
  }

  /** Spent casing tinkling on the floor. */
  casing(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.18, 9);
    if (!o) return;
    const f = 3800 + Math.random() * 1400;
    this.tone(o, "triangle", f, f * 0.85, 0.03, 0.4);
    this.tone(o, "triangle", f * 1.34, f, 0.025, 0.25, 0.045);
  }

  explosion(pos: THREE.Vector3 | null): void {
    const o = this.out(pos, 1.2, 120);
    if (!o) return;
    if (this.ctx && this.samples.play(this.ctx, "explosion", o)) return;
    this.noise(o, 0.8, "lowpass", 700, [2, 0.005]);
    this.tone(o, "sine", 85, 28, 0.9, 1.2);
    this.noise(o, 0.25, "highpass", 1800, [0.5, 0.01]);
  }

  // ---- world ----------------------------------------------------------

  doorOpen(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.5, 30);
    if (!o) return;
    if (this.ctx && this.samples.play(this.ctx, "door_servo", o)) return;
    this.noise(o, 0.45, "bandpass", 480, [0.5, 0.05], 2);
    this.tone(o, "triangle", 95, 130, 0.45, 0.12);
  }

  doorDenied(): void {
    const o = this.out(null, 0.4);
    if (!o) return;
    this.tone(o, "square", 220, 220, 0.09, 0.3);
    this.tone(o, "square", 160, 160, 0.12, 0.3, 0.11);
  }

  grateKick(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.7, 35);
    if (!o) return;
    this.noise(o, 0.2, "bandpass", 800, [1.4, 0.01], 3);
    this.tone(o, "triangle", 420, 120, 0.25, 0.5);
    this.tone(o, "triangle", 660, 200, 0.18, 0.3, 0.03);
  }

  pickup(): void {
    const o = this.out(null, 0.4);
    if (!o) return;
    this.tone(o, "square", 660, 660, 0.05, 0.25);
    this.tone(o, "square", 990, 990, 0.07, 0.25, 0.06);
  }

  keycard(): void {
    const o = this.out(null, 0.45);
    if (!o) return;
    this.tone(o, "square", 880, 880, 0.05, 0.3);
    this.tone(o, "square", 1175, 1175, 0.05, 0.3, 0.07);
    this.tone(o, "square", 1568, 1568, 0.09, 0.3, 0.14);
  }

  objective(): void {
    const o = this.out(null, 0.5);
    if (!o) return;
    this.tone(o, "triangle", 523, 523, 0.09, 0.35);
    this.tone(o, "triangle", 784, 784, 0.16, 0.35, 0.1);
  }

  objectiveFailed(): void {
    const o = this.out(null, 0.5);
    if (!o) return;
    this.tone(o, "triangle", 392, 392, 0.12, 0.35);
    this.tone(o, "triangle", 261, 261, 0.25, 0.35, 0.13);
  }

  shutter(): void {
    const o = this.out(null, 0.5);
    if (!o) return;
    this.noise(o, 0.04, "bandpass", 3200, [1, 0.02], 4);
    this.noise(o, 0.1, "bandpass", 1400, [0.001, 0.5], 3);
  }

  beep(): void {
    const o = this.out(null, 0.35);
    if (!o) return;
    this.tone(o, "square", 1320, 1320, 0.06, 0.2);
  }

  minePlant(): void {
    const o = this.out(null, 0.5);
    if (!o) return;
    this.noise(o, 0.06, "bandpass", 900, [0.8, 0.02], 3);
    this.tone(o, "square", 1100, 1100, 0.05, 0.2, 0.1);
  }

  footstep(run: boolean): void {
    const o = this.out(null, run ? 0.16 : 0.08);
    if (!o) return;
    this.noise(o, 0.045, "lowpass", 380 + Math.random() * 120, [0.9, 0.02]);
  }

  hurt(): void {
    const o = this.out(null, 0.6);
    if (!o) return;
    this.noise(o, 0.12, "lowpass", 600, [1, 0.01]);
    this.tone(o, "sine", 140, 60, 0.15, 0.5);
  }

  guardAlert(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.4, 40);
    if (!o) return;
    // radio chirp
    this.tone(o, "square", 1450, 1450, 0.04, 0.18);
    this.tone(o, "square", 1100, 1100, 0.04, 0.18, 0.06);
  }

  guardDie(pos: THREE.Vector3): void {
    const o = this.out(pos, 0.5, 40);
    if (!o) return;
    this.tone(o, "sawtooth", 220, 60, 0.35, 0.25);
    this.noise(o, 0.25, "lowpass", 400, [0.6, 0.01]);
  }

  // ---- alarm ----------------------------------------------------------

  alarmStart(): void {
    if (!this.ctx || this.alarmNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 560;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1600;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07;
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxBus);
    osc.start();
    let hi = true;
    const timer = window.setInterval(() => {
      hi = !hi;
      osc.frequency.setValueAtTime(hi ? 560 : 415, this.ctx!.currentTime);
    }, 380);
    this.alarmNodes = { osc, gain, timer };
  }

  alarmStop(): void {
    if (!this.alarmNodes) return;
    window.clearInterval(this.alarmNodes.timer);
    this.alarmNodes.gain.gain.linearRampToValueAtTime(0.0001, this.ctx!.currentTime + 0.4);
    const osc = this.alarmNodes.osc;
    window.setTimeout(() => osc.stop(), 600);
    this.alarmNodes = null;
  }

  // ---- ambience & music -----------------------------------------------

  ambientStart(): void {
    if (!this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    const oscA = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = "sawtooth";
    oscB.frequency.value = 55.6;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 130;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(filt);
    oscB.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxBus);
    oscA.start();
    oscB.start();
    lfo.start();
    // random distant clanks
    const clankTimer = window.setInterval(() => {
      if (Math.random() < 0.5) {
        const o = this.out(null, 0.05);
        if (o) this.tone(o, "triangle", 300 + Math.random() * 500, 100, 0.4, 0.6);
      }
    }, 9000);
    this.ambientNodes = {
      stop: () => {
        window.clearInterval(clankTimer);
        gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        window.setTimeout(() => {
          oscA.stop();
          oscB.stop();
          lfo.stop();
        }, 700);
      }
    };
  }

  ambientStop(): void {
    if (this.ambientNodes) {
      this.ambientNodes.stop();
      this.ambientNodes = null;
    }
  }

  /** Moody spy-synth loop for menu/briefing: minor bass line + sparse lead. */
}
