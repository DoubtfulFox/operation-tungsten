import * as THREE from "three";
import type { World } from "../world";
import { CharacterRig } from "../ai/CharacterRig";
import { NavGrid } from "../ai/Nav";
import type { NpcDef } from "../level/LevelTypes";
import type { Npc } from "./Npc";

const HE = new THREE.Vector3(0.28, 0.85, 0.28);

type SciState = "captive" | "walking" | "hiding" | "following" | "dead";

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
  /** escort follow bookkeeping */
  private followRepathT = 0;
  private noProgressT = 0;
  private stuckCount = 0;
  private lastFollowPos = new THREE.Vector3();

  constructor(
    world: World,
    public def: NpcDef
  ) {
    this.id = def.id;
    this.pos.set(def.x, HE.y + 0.02, def.z);
    this.yaw = this.targetYaw = def.yaw ?? Math.PI;
    this.hideSpot = NavGrid.center(def.hideCell[0], def.hideCell[1], HE.y);
    // an escort takes sustained fire on the way out — give him a real health pool
    if (def.escort) this.health = 70;
    this.lastFollowPos.copy(this.pos);

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
    if (this.def.escort) {
      // true escort: fall in behind the player and follow them out
      this.state = "following";
      this.path = null;
      this.pathIdx = 0;
      return;
    }
    this.state = "walking";
    const path = world.level.nav.findPath(NavGrid.toCell(this.pos), NavGrid.toCell(this.hideSpot));
    this.path = path && path.length > 0 ? path : null;
    this.pathIdx = 0;
  }

  /** Advance along the current path, cutting corners and opening unlocked doors in the way. */
  private steerPath(world: World, speed: number): THREE.Vector3 | null {
    if (!this.path || this.pathIdx >= this.path.length) return null;
    if (this.pathIdx + 1 < this.path.length) {
      const n2 = this.path[this.pathIdx + 1];
      const from = new THREE.Vector3(this.pos.x, 0.9, this.pos.z);
      if (world.physics.lineOfSight(from, new THREE.Vector3(n2.x, 0.9, n2.z))) this.pathIdx++;
    }
    const wp = this.path[this.pathIdx];
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) {
      this.pathIdx++;
      return this.steerPath(world, speed);
    }
    // open an unlocked slide door blocking the way (player-opened locked doors stay open as he trails)
    const [ccx, ccz] = NavGrid.toCell(this.pos);
    const [wcx, wcz] = NavGrid.toCell(wp);
    for (const [cx, cz] of [
      [wcx, wcz],
      [ccx, ccz]
    ] as [number, number][]) {
      const door = world.level.nav.doorAtCell(cx, cz);
      if (door && door.kind === "slide" && !door.isPassable() && door.lock === "none") door.requestOpen();
    }
    this.targetYaw = Math.atan2(-dx / dist, -dz / dist);
    return new THREE.Vector3((dx / dist) * speed, 0, (dz / dist) * speed);
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
    } else if (this.state === "following") {
      const player = world.player;
      const dxp = player.pos.x - this.pos.x;
      const dzp = player.pos.z - this.pos.z;
      const distP = Math.hypot(dxp, dzp);

      // nearest active threat that can actually see me
      let threat: (typeof world.guards)[number] | null = null;
      let threatD = Infinity;
      for (const gd of world.guards) {
        if (!gd.alive || (gd.state !== "combat" && gd.state !== "chase")) continue;
        const d = Math.hypot(gd.pos.x - this.pos.x, gd.pos.z - this.pos.z);
        if (d < 13 && d < threatD && world.physics.lineOfSight(gd.center(), this.center())) {
          threat = gd;
          threatD = d;
        }
      }

      // stuck recovery: if stranded far from the player, teleport in behind them
      this.noProgressT += dt;
      if (this.noProgressT > 0.5) {
        const moved = this.pos.distanceTo(this.lastFollowPos);
        this.stuckCount = distP > 8 && moved < 0.25 ? this.stuckCount + 1 : 0;
        this.lastFollowPos.copy(this.pos);
        this.noProgressT = 0;
      }
      if (distP > 18 || this.stuckCount >= 6) {
        const spot = world.level.nav.randomNearby(player.pos, 2);
        if (spot && !world.physics.overlaps(new THREE.Vector3(spot.x, HE.y, spot.z), HE)) {
          this.pos.set(spot.x, HE.y + 0.02, spot.z);
        }
        this.path = null;
        this.followRepathT = 0;
        this.stuckCount = 0;
      }

      const gap = 2.6;
      if (distP < gap + 0.3 && !threat) {
        // tucked in behind the player — idle and face them
        this.path = null;
        this.targetYaw = Math.atan2(-dxp, -dzp);
      } else {
        // target a point behind the player, or hug their lee side away from the threat
        let desired: THREE.Vector3;
        if (threat) {
          const ax = this.pos.x - threat.pos.x;
          const az = this.pos.z - threat.pos.z;
          const al = Math.hypot(ax, az) || 1;
          desired = new THREE.Vector3(player.pos.x + (ax / al) * 1.0, this.pos.y, player.pos.z + (az / al) * 1.0);
        } else {
          const back = player.forward().multiplyScalar(-gap);
          desired = new THREE.Vector3(player.pos.x + back.x, this.pos.y, player.pos.z + back.z);
        }
        this.followRepathT -= dt;
        if (this.followRepathT <= 0 || !this.path || this.pathIdx >= this.path.length) {
          this.followRepathT = 0.4;
          const path = world.level.nav.findPath(NavGrid.toCell(this.pos), NavGrid.toCell(desired));
          this.path = path && path.length > 0 ? path : null;
          this.pathIdx = 0;
          if (this.path) this.path[this.path.length - 1] = new THREE.Vector3(desired.x, this.pos.y, desired.z);
        }
        running = world.alarm.active || distP > 5;
        const speed = threat ? 2.2 : running ? 3.6 : 2.5;
        const w = this.steerPath(world, speed);
        if (w) {
          wish.copy(w);
        } else {
          const d = new THREE.Vector3(desired.x - this.pos.x, 0, desired.z - this.pos.z);
          const dl = d.length();
          if (dl > 0.4) {
            wish.set((d.x / dl) * speed, 0, (d.z / dl) * speed);
            this.targetYaw = Math.atan2(-d.x / dl, -d.z / dl);
          }
        }
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
