import type { LevelDef } from "../LevelTypes";
import { M1 } from "./m1_arkhangelsk";
import { M2 } from "./m2_surface";
import { M3 } from "./m3_depot";
import { M4 } from "./m4_mamayev";
import { WTEST } from "./wtest";

/** Campaign order. Winning level N unlocks N+1. */
export const LEVELS: LevelDef[] = [M1, M2, M3, M4];

/** every loadable level, including the non-campaign weapon test range */
const ALL_LEVELS: LevelDef[] = [...LEVELS, WTEST];

export function levelById(id: string): LevelDef {
  const def = ALL_LEVELS.find((l) => l.id === id);
  if (!def) throw new Error(`unknown level: ${id}`);
  return def;
}

export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}
