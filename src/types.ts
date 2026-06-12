import * as THREE from "three";

export enum GameState {
  Menu,
  Briefing,
  Playing,
  Watch,
  Debrief
}

export type AmmoType = "9mm" | "rifle" | "shells" | "rail" | "golden" | "grenade" | "mine";

export interface WeaponDef {
  id: string;
  name: string;
  /** compact label for the hotbar */
  short: string;
  slot: number;
  kind: "gun" | "thrown" | "mine" | "camera" | "melee";
  damage: number;
  headMult: number;
  pellets: number;
  /** rounds per second; semi-auto guns still rate-limited */
  fireRate: number;
  auto: boolean;
  magSize: number;
  ammo: AmmoType | null;
  /** base spread in radians */
  spread: number;
  aimSpread: number;
  /** radius in meters that the shot is audible to guards */
  noiseRadius: number;
  reloadTime: number;
  range: number;
  /** fov when aiming (deg); 0 = no zoom */
  zoomFov: number;
  silenced: boolean;
  /** camera pitch kick per shot (radians) */
  kick: number;
  /** spread bloom added per shot (radians) */
  bloomAdd: number;
  /** rounds punch through doors and thin props at half damage */
  penetrate: boolean;
  /** show the sniper-scope overlay while aiming */
  scopeOverlay?: boolean;
  /** strike reach in meters (melee weapons) */
  meleeRange?: number;
}

export type KeycardId = "lab" | "officer";

export type CellChar = "#" | "." | "v" | "D" | "L" | "O" | "G" | " ";

export interface RegionDef {
  name: string;
  /** cell-space rect, inclusive */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  light?: { color: number; intensity: number };
  floorTex: string;
  wallTex: string;
  /** open sky: no ceiling quads, perimeter walls rise to the level's wallH */
  outdoor?: boolean;
}

export type PropType =
  | "gastank"
  | "mainframe"
  | "documents"
  | "alarmpanel"
  | "crate"
  | "desk"
  | "locker"
  | "bed"
  | "toilet"
  | "sink"
  | "table"
  | "barrel"
  | "shelf"
  | "console"
  | "cellbars"
  | "truck"
  | "floodlight"
  | "dish"
  | "fence"
  | "traincar"
  | "engine"
  | "generator"
  | "statue"
  | "monument";

export interface PropDef {
  type: PropType;
  /** cell coords (can be fractional for fine placement) */
  cx: number;
  cz: number;
  /** rotation around Y in quarter-turns */
  rot?: number;
  id?: string;
  /** make any prop a mission target (requires an id) */
  destructible?: { hp: number; radius: number; bulletImmune: boolean };
}

export type PickupType =
  | "ammo_9mm"
  | "ammo_rifle"
  | "ammo_shells"
  | "ammo_rail"
  | "grenades"
  | "mines"
  | "armor"
  | "medkit"
  | "weapon_dd4"
  | "weapon_kr7"
  | "weapon_shotgun"
  | "weapon_railgun"
  | "weapon_klobb"
  | "weapon_sniper"
  | "weapon_golden"
  | "weapon_knife"
  | "ammo_golden"
  | "keycard_lab"
  | "keycard_officer";

export interface PickupDef {
  type: PickupType;
  cx: number;
  cz: number;
}

export type GuardKind = "guard" | "officer" | "heavy";

export interface GuardSpawnDef {
  kind: GuardKind;
  cx: number;
  cz: number;
  /** patrol waypoints in cell coords; empty = stationary post */
  route: Array<[number, number]>;
  /** facing in radians when posted */
  facing?: number;
  keycard?: KeycardId;
  /** weapon override (defaults to the kind's standard gun) */
  gun?: "klobb" | "sniper" | "golden";
}

export interface NoiseEvent {
  pos: THREE.Vector3;
  radius: number;
  /** true if caused by player (guards investigate) */
  hostile: boolean;
}

export interface HitInfo {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
  /** what got hit */
  kind: "level" | "guard" | "prop" | "npc" | "door";
  guardIndex?: number;
  headshot?: boolean;
  propId?: string;
}

export interface MissionStats {
  shotsFired: number;
  shotsHit: number;
  kills: number;
  alarmsTriggered: number;
  startTime: number;
  endTime: number;
}
