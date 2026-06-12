import * as THREE from "three";
import { Emitter } from "./core/Events";
import { Physics } from "./core/Physics";
import { defaultModifiers, type Modifiers } from "./core/Modifiers";
import { DIFFICULTIES, type DifficultyDef } from "./core/Difficulty";
import type { Input } from "./core/Input";
import type { Sfx } from "./audio/Sfx";
import type { BuiltLevel } from "./level/LevelBuilder";
import type { Player } from "./player/Player";
import type { Guard } from "./ai/Guard";
import type { Npc } from "./npc/Npc";
import type { Effects } from "./fx/Effects";
import type { AlarmSystem } from "./ai/AlarmSystem";
import type { MissionSystem } from "./mission/MissionSystem";
import type { WeaponSystem } from "./weapons/WeaponSystem";
import type { Projectiles } from "./combat/Projectiles";
import type { HUD } from "./ui/HUD";
import type { NoiseEvent } from "./types";

export type GameEvents = {
  noise: NoiseEvent;
  alarm: { active: boolean };
  toast: { text: string };
  objectiveComplete: { id: string; text: string };
  objectiveFailed: { id: string; text: string };
  guardKilled: { pos: THREE.Vector3 };
  playerDamaged: { amount: number };
  playerDied: { reason: string };
  missionFailed: { reason: string };
};

/**
 * Central context object handed to every system. Built fresh for each
 * mission attempt (everything in here is per-run state).
 */
export class World {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  physics = new Physics();
  events = new Emitter<GameEvents>();
  time = 0;
  /** cheat toggles — owned by Game, shared across mission restarts */
  mods: Modifiers = defaultModifiers();
  /** combat scaling — set by Game before guards spawn */
  difficulty: DifficultyDef = DIFFICULTIES[1];

  level!: BuiltLevel;
  player!: Player;
  guards: Guard[] = [];
  npcs: Npc[] = [];
  effects!: Effects;
  alarm!: AlarmSystem;
  mission!: MissionSystem;
  weapons!: WeaponSystem;
  projectiles!: Projectiles;
  hud!: HUD;

  constructor(
    public input: Input,
    public sfx: Sfx
  ) {
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.07, 140);
    this.camera.rotation.order = "YXZ";
  }

  emitNoise(pos: THREE.Vector3, radius: number, hostile = true): void {
    this.events.emit("noise", { pos: pos.clone(), radius, hostile });
  }
}
