import type { LevelDef } from "../level/LevelTypes";

/**
 * Narrates a mission briefing by playing a recorded voice clip at
 * `public/audio/voice/<levelId>.mp3`. If a level has no clip, nothing plays —
 * there is intentionally no text-to-speech fallback.
 */
export class BriefingVoice {
  private clip: HTMLAudioElement | null = null;

  /** Play the recorded briefing clip for this level, if narration is on and a clip exists. */
  speakBriefing(def: LevelDef, enabled: boolean): void {
    this.cancel();
    if (!enabled || typeof Audio === "undefined") return;
    const audio = new Audio(import.meta.env.BASE_URL + "audio/voice/" + def.id + ".mp3");
    audio.volume = 1;
    this.clip = audio;
    // a missing clip (404 / decode failure) just stays silent
    audio.addEventListener("error", () => {
      if (this.clip === audio) this.clip = null;
    });
    audio.play().catch(() => {
      if (this.clip === audio) this.clip = null;
    });
  }

  cancel(): void {
    if (this.clip) {
      this.clip.pause();
      this.clip.currentTime = 0;
      this.clip = null;
    }
  }
}
