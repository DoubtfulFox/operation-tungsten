import type * as THREE from "three";
import type { World } from "../world";
import type { NpcDef } from "../level/LevelTypes";

/** A mission-critical non-combatant placed by the level definition. */
export interface Npc {
  def: NpcDef;
  id: string;
  alive: boolean;
  freed: boolean;
  pos: THREE.Vector3;
  center(): THREE.Vector3;
  hitBox(): { min: THREE.Vector3; max: THREE.Vector3 };
  hit(dmg: number, world: World): void;
  free(world: World): void;
  update(dt: number, world: World): void;
}
