import type { Difficulty } from "../level/LevelTypes";

/**
 * Difficulty affects exactly two things (GoldenEye-style):
 * which objectives are active (tagged on the ObjectiveDefs) and how
 * dangerous guards are in combat.
 */
export interface DifficultyDef {
  id: Difficulty;
  label: string;
  /** multiplier on a guard's per-round hit probability */
  guardAccuracy: number;
  /** multiplier on the 0.45s spot-to-shoot reaction delay */
  guardReaction: number;
  /** multiplier on guard damage rolls */
  guardDamage: number;
  /** multiplier on guard health at spawn */
  guardHealth: number;
  /** cap on the per-round hit probability */
  accuracyCap: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "agent", label: "AGENT", guardAccuracy: 0.75, guardReaction: 1.35, guardDamage: 0.7, guardHealth: 0.85, accuracyCap: 0.35 },
  { id: "super", label: "SUPER AGENT", guardAccuracy: 1.0, guardReaction: 1.0, guardDamage: 1.0, guardHealth: 1.0, accuracyCap: 0.4 },
  { id: "007", label: "007", guardAccuracy: 1.35, guardReaction: 0.65, guardDamage: 1.4, guardHealth: 1.25, accuracyCap: 0.5 }
];

export function difficultyById(id: string): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}
