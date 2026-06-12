/**
 * Optional CC0 recorded samples layered over the synth engine. Files
 * live in public/audio/ (see CREDITS.txt there); anything missing
 * silently falls back to the procedural synth, so the game is fully
 * playable with an empty audio folder.
 */
const MANIFEST: Record<string, string> = {
  shot_pp9: "shot_pp9.ogg",
  shot_dd4: "shot_dd4.ogg",
  shot_kr7: "shot_kr7.ogg",
  shot_shotgun: "shot_shotgun.ogg",
  shot_klobb: "shot_klobb.ogg",
  shot_sniper: "shot_sniper.ogg",
  shot_golden: "shot_golden.ogg",
  explosion: "explosion.ogg",
  fleshhit: "fleshhit.ogg",
  reload: "reload.ogg",
  door_servo: "door_servo.ogg"
};

export class Samples {
  private buffers = new Map<string, AudioBuffer>();
  private loadStarted = false;

  /** Kick off lazy loading; failures are expected and silent. */
  load(ctx: AudioContext): void {
    if (this.loadStarted) return;
    this.loadStarted = true;
    for (const [id, file] of Object.entries(MANIFEST)) {
      fetch(import.meta.env.BASE_URL + "audio/" + file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => this.buffers.set(id, decoded))
        .catch(() => {
          // not shipped — synth fallback covers it
        });
    }
  }

  /** Play a sample into an output chain. Returns false when unavailable. */
  play(ctx: AudioContext, id: string, dest: AudioNode, rate = 1): boolean {
    const buf = this.buffers.get(id);
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    src.connect(dest);
    src.start();
    return true;
  }
}
