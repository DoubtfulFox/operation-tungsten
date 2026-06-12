/**
 * GoldenEye-style cheat modifiers. All freely toggleable from the watch;
 * the instance lives on Game so toggles survive mission restarts within
 * a session (deliberately not persisted to localStorage).
 */
export interface Modifiers {
  bigHead: boolean;
  paintball: boolean;
  turbo: boolean;
  invincible: boolean;
  infiniteAmmo: boolean;
  allGuns: boolean;
  slowMotion: boolean;
  tinyGuards: boolean;
}

export function defaultModifiers(): Modifiers {
  return {
    bigHead: false,
    paintball: false,
    turbo: false,
    invincible: false,
    infiniteAmmo: false,
    allGuns: false,
    slowMotion: false,
    tinyGuards: false
  };
}

export const MODIFIER_DEFS: Array<{ id: keyof Modifiers; label: string; hint: string }> = [
  { id: "bigHead", label: "BIG HEAD MODE", hint: "inflated heads, easier headshots" },
  { id: "paintball", label: "PAINTBALL MODE", hint: "bullets splatter paint" },
  { id: "turbo", label: "TURBO BOND", hint: "move at 160% speed" },
  { id: "invincible", label: "INVINCIBILITY", hint: "nothing hurts" },
  { id: "infiniteAmmo", label: "INFINITE AMMO", hint: "reserves never run dry" },
  { id: "allGuns", label: "ALL GUNS", hint: "every slot unlocked" },
  { id: "slowMotion", label: "SLOW MOTION", hint: "the world at 55% speed" },
  { id: "tinyGuards", label: "TINY GUARDS", hint: "the opposition, miniaturized" }
];
