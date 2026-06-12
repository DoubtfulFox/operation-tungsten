import * as THREE from "three";
import type { World } from "../world";
import { CharacterRig } from "../ai/CharacterRig";
import { NavGrid } from "../ai/Nav";
import type { NpcDef } from "../level/LevelTypes";
import type { Npc } from "./Npc";

const HE = new THREE.Vector3(0.28, 0.85, 0.28);

type SciState = "captive" | "walking" | "hiding" | "dead";

/**
 * A captive scientist (Dr. Volkov in M1): free them for whatever they
 * carry; keep them alive (stray rounds and explosions hurt) for the bonus.
 */
export class Scientist implements Npc {
  id: string;
  pos = new THREE.Vector3();
  yaw = 0;
  alive = true;
  freed = false;
  state: SciState = "captive";
  health = 30;

  private rig: CharacterRig;
  private path: THREE.Vector3[] | null = null;
  private pathIdx = 0;
  private vel = new THREE.Vector3();
  private targetYaw = Math.PI;
  private hideSpot: THREE.Vector3;

  constructor(
    world: World,
    public def: NpcDef
  ) {
    this.id = def.id;
    this.pos.set(def.x, HE.y + 0.02, def.z);
    this.yaw = this.targetYaw = def.yaw ?? Math.PI;
    this.hideSpot = NavGrid.center(def.hideCell[0], def.hideCell[1], HE.y);

    this.rig = new CharacterRig("scientist", null);
    world.scene.add(this.rig.root);
  }

  center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, 0.95, this.pos.z);
  }

  hitBox(): { min: THREE.Vector3; max: THREE.Vector3 } {
    return {
      min: new THREE.Vector3(this.pos.x - 0.28, 0.02, this.pos.z - 0.28),
      max: new THREE.Vector3(this.pos.x + 0.28, 1.78, this.pos.z + 0.28)
    };
  }

  /** Player interaction after the gate is open. */
  free(world: World): void {
    if (this.freed || !this.alive) return;
    this.freed = true;
    this.state = "walking";
    const path = world.level.nav.findPath(NavGrid.toCell(this.pos), NavGrid.toCell(this.hideSpot));
    this.path = path && path.length > 0 ? path : null;
    this.pathIdx = 0;
  }

  hit(dmg: number, world: World): void {
    if (!this.alive) return;
    this.health -= dmg;
    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
      this.rig.play("Death", { once: true, fade: 0.1 });
      world.sfx.guardDie(this.pos);
      world.mission.onNpcKilled(this.id);
    }
  }

  update(dt: number, world: World): void {
    if (this.state === "dead") {
      this.rig.update(dt);
      this.rig.root.position.set(this.pos.x, this.pos.y - HE.y, this.pos.z);
      return;
    }

    const wish = new THREE.Vector3();
    let running = false;
    if (this.state === "captive") {
      // nervous shuffle behind the bars
      this.targetYaw = Math.PI + Math.sin(world.time * 0.8) * 0.4;
    } else if (this.state === "walking") {
      if (this.path && this.pathIdx < this.path.length) {
        // cut corners when the next-next waypoint is directly visible
        if (this.pathIdx + 1 < this.path.length) {
          const n2 = this.path[this.pathIdx + 1];
          const from = new THREE.Vector3(this.pos.x, 0.9, this.pos.z);
          if (world.physics.lineOfSight(from, new THREE.Vector3(n2.x, 0.9, n2.z))) this.pathIdx++;
        }
        const wp = this.path[this.pathIdx];
        const dx = wp.x - this.pos.x;
        const dz = wp.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.45) {
          this.pathIdx++;
        } else {
          running = world.alarm.active;
          const speed = running ? 3.4 : 2.4;
          wish.set((dx / dist) * speed, 0, (dz / dist) * speed);
          this.targetYaw = Math.atan2(-dx / dist, -dz / dist);
        }
      } else {
        this.state = "hiding";
      }
    } else if (this.state === "hiding") {
      this.targetYaw += Math.sin(world.time * 1.3) * dt * 0.3;
    }

    // momentum + smooth turning, same model as the guards
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wish.x, 9, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wish.z, 9, dt);
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (spd > 0.02) {
      world.physics.moveBox(this.pos, HE, new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt));
    }
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += THREE.MathUtils.clamp(dy, -dt * 6, dt * 6);

    if (spd > 0.45) {
      this.rig.play(running ? "Run" : "Walk");
      this.rig.setTimeScale(THREE.MathUtils.clamp(spd / (running ? 3.2 : 1.5), 0.6, 1.8));
    } else {
      this.rig.play("Idle");
    }
    this.rig.update(dt);

    this.rig.root.position.set(this.pos.x, this.pos.y - HE.y, this.pos.z);
    this.rig.root.rotation.y = this.yaw;
  }
}
