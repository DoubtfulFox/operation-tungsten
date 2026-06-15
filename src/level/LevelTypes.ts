import type { GuardSpawnDef, KeycardId, PickupDef, PickupType, PropDef, RegionDef } from "../types";

export type Difficulty = "agent" | "super" | "007";

/** Order matters: later entries include everything before them. */
export const DIFFICULTY_ORDER: Difficulty[] = ["agent", "super", "007"];

export interface ObjectiveDef {
  id: string;
  label: string;
  /** side objective — feeds the rating, never gates extraction */
  bonus?: boolean;
  /** objective is absent entirely below this difficulty */
  minDifficulty?: Difficulty;
  /** bonus below this difficulty, required at/above it */
  requiredAt?: Difficulty;
  trigger:
    | { kind: "enterRegion"; region: string }
    | { kind: "destroyAll"; ids: string[] }
    | { kind: "photo"; targetId: string }
    | { kind: "freeNpc"; npcId: string }
    | { kind: "npcSurvives"; npcId: string }
    | { kind: "pickup"; pickupType: PickupType }
    | { kind: "noAlarm" }
    | { kind: "extract" }
    | { kind: "custom"; eventId: string };
}

export interface AlarmPanelDef {
  id: string;
  cx: number;
  cz: number;
  side: "N" | "S" | "E" | "W";
}

export interface SignDef {
  text: string;
  cx: number;
  cz: number;
  side: "N" | "S" | "E" | "W";
}

/** Ceiling light with a real PointLight (budgeted — keep these few). */
export interface FixtureDef {
  x: number;
  z: number;
  c: number;
  i: number;
}

export interface PipeRun {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  r: number;
  rust: boolean;
}

/** Static bar fences (jail cells etc), world coords. */
export interface BarrierSeg {
  x: number;
  z: number;
  len: number;
  axis: "x" | "z";
}

/** A named gate door (jail gate etc) the level script can look up. */
export interface GateDef {
  id: string;
  cx: number;
  cz: number;
  axis: "x" | "z";
  /** world-space panel center */
  x: number;
  z: number;
  /** "pick" requires the lockpick to open (padlock shown); default unlocked */
  lock?: "none" | "pick";
  /**
   * Sealed shut (player- and AI-unopenable) until the alarm fires, then latches
   * open for good. The gate's `id` is the release-group key for any dormant guards.
   */
  openOnAlarm?: boolean;
}

export interface NpcDef {
  id: string;
  kind: "scientist";
  /** world coords */
  x: number;
  z: number;
  yaw?: number;
  /** cell the NPC flees to once freed */
  hideCell: [number, number];
  /** gate that must be passable before the free interaction appears */
  gateId?: string;
  freePrompt: string;
  freeToasts: string[];
  grantsKeycard?: KeycardId;
  killFailReason: string;
  /** true escort: once freed the NPC follows the player instead of fleeing to hideCell */
  escort?: boolean;
  /** fail message when a freed escort is killed (defaults to killFailReason) */
  escortFailReason?: string;
}

export interface EnvironmentDef {
  fog: { color: number; density: number };
  background: number;
  ambient: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  /** outdoor levels add a directional sun */
  sun?: { color: number; intensity: number; dir: [number, number, number] };
}

export interface BriefingDef {
  /** the RE: line on the memo */
  re: string;
  paragraphs: string[];
  outro: string;
}

export interface LevelDef {
  id: string;
  name: string;
  briefing: BriefingDef;
  startToast: string;
  map: string[];
  regions: RegionDef[];
  corridorLights: Array<[number, number]>;
  roomFixtures: FixtureDef[];
  /** unlit fixture panels (visual only, keeps light count sane) */
  glowFixtures: Array<[number, number]>;
  /** world coords of the strobing red alarm lights */
  alarmLightPositions: Array<[number, number]>;
  pipes: PipeRun[];
  signs: SignDef[];
  props: PropDef[];
  pickups: PickupDef[];
  guards: GuardSpawnDef[];
  alarmPanels: AlarmPanelDef[];
  playerStart: { cx: number; cz: number; yaw: number };
  /** exfil region; if `boardProp` is set, completion is an F-interact at that prop (truck) instead */
  extraction: { x0: number; z0: number; x1: number; z1: number; boardProp?: string };
  reinforcementSpawns: Array<[number, number]>;
  environment: EnvironmentDef;
  barriers?: BarrierSeg[];
  gates?: GateDef[];
  /** cells AI pathing must avoid (anti-shortcut around barriers) */
  navBlocks?: Array<[number, number]>;
  npcs?: NpcDef[];
  /** perimeter wall height for outdoor regions (default WALL_H) */
  wallH?: number;
  /** timed escape: starts when the named objective completes */
  escape?: { afterObjective: string; seconds: number; failReason: string };
  musicTheme: string;
  /** mission-specific gear added to the loadout (slot 8 EQUIPMENT), e.g. "lockpick" */
  equipment?: string[];
  objectives: ObjectiveDef[];
}
