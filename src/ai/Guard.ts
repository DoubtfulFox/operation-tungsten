import * as THREE from "three";
import type { World } from "../world";
import type { GuardKind, GuardSpawnDef, KeycardId, PickupType } from "../types";
import { CharacterRig } from "./CharacterRig";
import { NavGrid } from "./Nav";
import { Pickup } from "../level/Pickups";
import { CELL } from "../level/Grid";
import { rayVsBox } from "../core/Physics";
import type { CoverSpot, Destructible } from "../level/LevelBuilder";
import type { Door } from "../level/Door";
import type { Modifiers } from "../core/Modifiers";
import type { DifficultyDef } from "../core/Difficulty";

type GuardState = "post" | "patrol" | "investigate" | "chase" | "combat" | "alarm" | "dead";

const HE = new THREE.Vector3(0.3, 0.85, 0.3);
const UP = new THREE.Vector3(0, 1, 0);

interface GunProfile {
  sfxId: string;
  burst: number;
  intraDelay: number;
  cooldown: number;
  dmgMin: number;
  dmgMax: number;
  falloffRange: number;
}

const GUNS: Record<string, GunProfile> = {
  guard: { sfxId: "kr7", burst: 3, intraDelay: 0.11, cooldown: 1.5, dmgMin: 7, dmgMax: 12, falloffRange: 45 },
  officer: { sfxId: "dd4", burst: 2, intraDelay: 0.2, cooldown: 1.3, dmgMin: 10, dmgMax: 15, falloffRange: 40 },
  heavy: { sfxId: "shotgun", burst: 1, intraDelay: 0, cooldown: 1.7, dmgMin: 8, dmgMax: 26, falloffRange: 13 },
  // per-spawn overrides (GuardSpawnDef.gun)
  klobb: { sfxId: "klobb", burst: 5, intraDelay: 0.07, cooldown: 1.4, dmgMin: 4, dmgMax: 8, falloffRange: 25 },
  sniper: { sfxId: "sniper", burst: 1, intraDelay: 0, cooldown: 2.2, dmgMin: 30, dmgMax: 45, falloffRange: 70 },
  golden: { sfxId: "golden", burst: 1, intraDelay: 0, cooldown: 2.0, dmgMin: 100, dmgMax: 100, falloffRange: 50 }
};

/** What a guard's hand mesh and corpse drop should be. */
function gunIdFor(kind: GuardKind, override?: string): string {
  return override ?? (kind === "officer" ? "dd4" : kind === "heavy" ? "shotgun" : "kr7");
}

const HEALTH: Record<GuardKind, number> = { guard: 60, officer: 50, heavy: 95 };

/**
 * Facility guard: patrols or stands post, investigates noises and
 * bodies, fights in bursts, and sometimes sprints for an alarm panel
 * instead of engaging (officers almost always do).
 */
export class Guard {
  /** collision-box center; y is fixed at HE.y */
  pos = new THREE.Vector3();
  yaw = 0;
  alive = true;
  gone = false;
  kind: GuardKind;
  keycard: KeycardId | undefined;
  state: GuardState = "post";
  /** reinforcements actively hunt the player while the alarm runs */
  hunter = false;
  bodyNoticed = false;
  /** set just before a stealth takedown: dies without a sound */
  silent = false;
  /** cheat scales (BIG HEAD / TINY GUARDS) — applied to rig and hitboxes */
  private headScale = 1;
  private bodyScale = 1;
  private gunId: string;

  private rig: CharacterRig;
  private health: number;
  private gun: GunProfile;
  private route: THREE.Vector3[];
  private routeIdx = 0;
  private homePos: THREE.Vector3;
  private homeYaw: number;
  private targetYaw = 0;
  private path: THREE.Vector3[] | null = null;
  private pathIdx = 0;
  /** actual velocity (momentum) */
  private vel = new THREE.Vector3();
  /** what the brain wants this frame; velocity eases toward it */
  private wishVel = new THREE.Vector3();
  private alertLevel = 0;
  private lastKnown: THREE.Vector3 | null = null;
  private loseSightT = 0;
  private reactionT = 0;
  private burstLeft = 0;
  private shotT = 0;
  private burstCooldown = 0;
  private investigateT = 0;
  private scanT = Math.random() * 0.7;
  private staggerT = 0;
  private stuckT = 0;
  private deadT = 0;
  private pressT = 0;
  private alarmPanel: Destructible | null = null;
  private alarmCell: [number, number] | null = null;
  private strafeT = 0;
  private strafeDir = 0;
  private hunterRepathT = 0;
  private unsubNoise: (() => void) | null = null;
  // --- combat dodge (the GoldenEye roll) ---
  private dodgeT = 0;
  private dodgeDir = 0;
  private dodgeCooldown = 1 + Math.random() * 2;
  private lastHitT = 999;
  // --- cover usage ---
  private coverSpot: CoverSpot | null = null;
  private coverPhase: "approach" | "duck" | "pop" = "approach";
  private coverT = 0;
  private duckAmount = 0;
  private static coverSeekers = 0;
  // --- grenade flushing ---
  private grenadeCooldown = 6 + Math.random() * 6;
  private grenadeWindup = 0;
  // --- idle life ---
  private idleT = 5 + Math.random() * 9;
  /** a one-shot gesture/roll is playing — applyPose must not stomp it */
  private poseLockT = 0;
  /** reinforcements route via this point before homing on the player */
  private flankVia: THREE.Vector3 | null = null;

  constructor(world: World, def: GuardSpawnDef) {
    this.kind = def.kind;
    this.keycard = def.keycard;
    this.health = Math.round(HEALTH[def.kind] * world.difficulty.guardHealth);
    this.gun = GUNS[def.gun ?? def.kind];
    this.gunId = gunIdFor(def.kind, def.gun);
    this.rig = new CharacterRig(def.kind, this.gunId);
    this.pos.set(def.cx * CELL + CELL / 2, HE.y + 0.02, def.cz * CELL + CELL / 2);
    this.yaw = this.targetYaw = this.homeYaw = def.facing ?? Math.random() * Math.PI * 2;
    this.homePos = this.pos.clone();
    this.route = def.route.map(([cx, cz]) => NavGrid.center(cx, cz, this.pos.y));
    this.state = this.route.length > 0 ? "patrol" : "post";
    world.scene.add(this.rig.root);

    this.unsubNoise = world.events.on("noise", (n) => {
      if (!this.alive) return;
      const d = this.pos.distanceTo(n.pos);
      if (d > n.radius) return;
      if (this.state === "combat" || this.state === "dead" || this.state === "alarm") return;
      this.alertLevel = Math.max(this.alertLevel, 1);
      this.investigate(world, n.pos);
    });
  }

  center(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, 0.95, this.pos.z);
  }

  eye(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, (1.6 - this.duckAmount * 0.45) * this.bodyScale, this.pos.z);
  }

  applyMods(mods: Modifiers): void {
    this.headScale = mods.bigHead ? 2.3 : 1;
    this.bodyScale = mods.tinyGuards ? 0.62 : 1;
    this.rig.setHeadScale(this.headScale);
    this.rig.setBodyScale(this.bodyScale);
  }

  /** Briefing-screen difficulty change, before any shots are fired. */
  applyDifficulty(d: DifficultyDef): void {
    this.health = Math.round(HEALTH[this.kind] * d.guardHealth);
  }

  facingDir(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  hitBoxes(): { headMin: THREE.Vector3; headMax: THREE.Vector3; bodyMin: THREE.Vector3; bodyMax: THREE.Vector3 } {
    const x = this.pos.x;
    const z = this.pos.z;
    const b = this.bodyScale;
    const duckDrop = this.duckAmount * 0.45;
    // big head: grow the head box around its center
    const headC = (1.65 - duckDrop) * b;
    const headHalfH = 0.19 * b * this.headScale;
    const headHalfW = 0.17 * b * this.headScale;
    return {
      headMin: new THREE.Vector3(x - headHalfW, headC - headHalfH, z - headHalfW),
      headMax: new THREE.Vector3(x + headHalfW, headC + headHalfH, z + headHalfW),
      bodyMin: new THREE.Vector3(x - 0.3 * b, 0.02, z - 0.3 * b),
      bodyMax: new THREE.Vector3(x + 0.3 * b, (1.46 - duckDrop) * b, z + 0.3 * b)
    };
  }

  // ---- perception -------------------------------------------------------

  private canSeePlayer(world: World): boolean {
    const player = world.player;
    if (!player.alive) return false;
    const eye = this.eye();
    const pEye = player.eyePos();
    const to = pEye.clone().sub(eye);
    const dist = to.length();
    let maxR = this.alertLevel > 0 ? 30 : 19;
    if (player.crouched) maxR *= 0.7;
    if (dist > maxR) return false;
    const dirN = to.clone().divideScalar(dist);
    if (!(this.alertLevel >= 2 && dist < 8)) {
      const flat = new THREE.Vector3(dirN.x, 0, dirN.z).normalize();
      if (this.facingDir().dot(flat) < 0.42) return false;
    }
    return world.physics.raycast(eye, dirN, dist - 0.2) === null;
  }

  private investigate(world: World, point: THREE.Vector3): void {
    this.state = "investigate";
    this.investigateT = 2.5;
    this.setPath(world, point);
  }

  private onSpotPlayer(world: World): void {
    this.lastKnown = world.player.pos.clone();
    if (this.alertLevel < 2) {
      this.alertLevel = 2;
      this.reactionT = 0.45 * world.difficulty.guardReaction;
      world.sfx.guardAlert(this.pos);
      // run for an alarm panel instead of fighting?
      if (!world.alarm.active) {
        const wantAlarm = this.kind === "officer" ? Math.random() < 0.8 : Math.random() < 0.3;
        if (wantAlarm) {
          const target = world.alarm.nearestPanel(world, this.pos);
          if (target && target.panel.pos.distanceTo(this.pos) < 30) {
            this.alarmPanel = target.panel;
            this.alarmCell = target.cell;
            this.state = "alarm";
            this.setPath(world, NavGrid.center(target.cell[0], target.cell[1]));
            return;
          }
        }
      }
    }
    this.state = "combat";
  }

  // ---- movement ---------------------------------------------------------

  private setPath(world: World, target: THREE.Vector3): void {
    const path = world.level.nav.findPath(NavGrid.toCell(this.pos), NavGrid.toCell(target));
    this.path = path && path.length > 0 ? path : null;
    this.pathIdx = 0;
    if (this.path) {
      // walk to the exact target at the end, not just the cell center
      this.path[this.path.length - 1] = new THREE.Vector3(target.x, this.pos.y, target.z);
    }
  }

  /** Is there body-width clearance straight to a point? (3 parallel rays) */
  private canShortcut(world: World, to: THREE.Vector3): boolean {
    const dx = to.x - this.pos.x;
    const dz = to.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return true;
    const sideX = (-dz / dist) * 0.34;
    const sideZ = (dx / dist) * 0.34;
    for (const s of [0, 1, -1]) {
      const from = new THREE.Vector3(this.pos.x + sideX * s, 0.9, this.pos.z + sideZ * s);
      const target = new THREE.Vector3(to.x + sideX * s, 0.9, to.z + sideZ * s);
      if (!world.physics.lineOfSight(from, target)) return false;
    }
    return true;
  }

  /**
   * Steers toward the path by setting wishVel (the shared momentum
   * integrator does the actual moving). Cuts corners whenever the
   * next-next waypoint is directly reachable, so grid zigzags become
   * smooth diagonals. Returns true when the path is finished.
   */
  private followPath(_dt: number, world: World, speed: number): boolean {
    if (!this.path || this.pathIdx >= this.path.length) return true;

    if (this.pathIdx + 1 < this.path.length && this.canShortcut(world, this.path[this.pathIdx + 1])) {
      this.pathIdx++;
    }

    const wp = this.path[this.pathIdx];
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const lastWp = this.pathIdx >= this.path.length - 1;
    if (dist < (lastWp ? 0.3 : 0.5)) {
      this.pathIdx++;
      return this.pathIdx >= this.path.length;
    }

    // doors in the way
    const [ccx, ccz] = NavGrid.toCell(this.pos);
    const [wcx, wcz] = NavGrid.toCell(wp);
    for (const [cx, cz] of [
      [wcx, wcz],
      [ccx, ccz]
    ]) {
      const door = world.level.nav.doorAtCell(cx, cz);
      if (door && door.kind === "slide" && !door.isPassable()) {
        if (door.lock === "none") {
          door.requestOpen();
          if (door.isClosed()) return false; // wait (wishVel stays zero)
        }
      }
    }

    const nx = dx / dist;
    const nz = dz / dist;
    this.targetYaw = Math.atan2(-nx, -nz);
    // ease into the final waypoint instead of overshooting it
    const sp = lastWp && dist < 1.2 ? speed * Math.max(0.45, dist / 1.2) : speed;
    this.wishVel.set(nx * sp, 0, nz * sp);
    return false;
  }

  // ---- combat -----------------------------------------------------------

  private fireRound(world: World): void {
    const player = world.player;
    const gunPos = this.eye().addScaledVector(this.facingDir(), 0.35);
    gunPos.y = 1.35;
    world.sfx.shot(this.gun.sfxId, this.pos);
    world.effects.muzzleFlash(gunPos);
    world.emitNoise(this.pos, 26, false);

    const pEye = player.eyePos();
    const dist = gunPos.distanceTo(pEye);
    let p = 0.32 * (1 - dist / this.gun.falloffRange);
    if (player.moving) p *= 0.75;
    if (player.crouched) p *= 0.75;
    if (world.alarm.active) p += 0.04;
    p = THREE.MathUtils.clamp(p * world.difficulty.guardAccuracy, 0.05, world.difficulty.accuracyCap);
    const hitRoll = Math.random() < p;

    // where is the round actually going?
    const target = pEye.clone();
    if (!hitRoll) {
      target.add(
        new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6)
      );
    }
    const dir = target.sub(gunPos).normalize();
    const range = 60;

    // can the round reach the player (or does it hit a wall / an NPC)?
    const lvl = world.physics.raycast(gunPos, dir, range);
    let endT = lvl ? lvl.t : range;
    let hitNpc: (typeof world.npcs)[number] | null = null;
    for (const npc of world.npcs) {
      if (!npc.alive) continue;
      const sb = npc.hitBox();
      const t = rayVsBox(gunPos, dir, sb.min, sb.max, endT);
      if (t !== null) {
        endT = t;
        hitNpc = npc;
      }
    }
    const end = gunPos.clone().addScaledVector(dir, endT);
    world.effects.tracer(gunPos, end);

    if (hitNpc) {
      hitNpc.hit(THREE.MathUtils.randInt(this.gun.dmgMin, this.gun.dmgMax), world);
      world.effects.blood(end);
      return;
    }
    if (hitRoll && endT >= dist - 0.6) {
      let dmg = THREE.MathUtils.randInt(this.gun.dmgMin, this.gun.dmgMax);
      if (this.kind === "heavy") dmg = Math.max(4, Math.round(26 * (1 - dist / this.gun.falloffRange)));
      player.damage(Math.max(1, Math.round(dmg * world.difficulty.guardDamage)), world);
    } else {
      // the crack of a round passing close by
      const toPlayer = pEye.clone().sub(gunPos);
      const along = toPlayer.dot(dir);
      if (along > 0 && along < endT + 0.5) {
        const closest = gunPos.clone().addScaledVector(dir, along);
        if (closest.distanceTo(pEye) < 1.2) world.sfx.whiz(closest);
      }
      if (lvl) {
        world.effects.sparks(lvl.point, lvl.normal, 0xccc6b8, 3);
        // their stray rounds chew up the walls too
        if (lvl.collider.kind !== "prop") {
          const doorRef = lvl.collider.kind === "door" ? (lvl.collider.ref as Door).panel : undefined;
          world.effects.spawnDecal(lvl.point, lvl.normal, doorRef);
        }
      }
    }
  }

  /** Rate-limited burst fire; call only while the player is visible. */
  private burstFire(dt: number, world: World): void {
    if (this.burstLeft > 0) {
      this.shotT -= dt;
      if (this.shotT <= 0) {
        this.burstLeft--;
        this.shotT = this.gun.intraDelay;
        this.fireRound(world);
      }
    } else {
      this.burstCooldown -= dt;
      if (this.burstCooldown <= 0) {
        this.burstLeft = this.gun.burst;
        this.shotT = 0;
        this.burstCooldown = this.gun.cooldown * (0.8 + Math.random() * 0.6);
      }
    }
  }

  /** Claim a duck-behind spot if a prop sits between it and the player. */
  private tryTakeCover(world: World): boolean {
    if (this.kind === "heavy") return false;
    // keep fights aggressive: at most two guards hiding at once
    let seekers = 0;
    for (const g of world.guards) if (g.alive && g.coverSpot) seekers++;
    if (seekers >= 2) return false;

    let best: CoverSpot | null = null;
    let bestD = 7;
    for (const spot of world.level.coverSpots) {
      const d = Math.hypot(spot.pos.x - this.pos.x, spot.pos.z - this.pos.z);
      if (d > bestD) continue;
      const dirToPlayer = new THREE.Vector3(world.player.pos.x - spot.pos.x, 0, world.player.pos.z - spot.pos.z).normalize();
      if (spot.coverDir.dot(dirToPlayer) < 0.6) continue;
      let taken = false;
      for (const g of world.guards) {
        if (g !== this && g.alive && g.coverSpot && g.coverSpot.pos.distanceTo(spot.pos) < 1) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      best = spot;
      bestD = d;
    }
    if (!best) return false;
    this.coverSpot = best;
    this.coverPhase = "approach";
    this.setPath(world, best.pos);
    return true;
  }

  private releaseCover(): void {
    this.coverSpot = null;
    this.coverPhase = "approach";
  }

  /** Duck-and-pop firefight rhythm while a cover spot is claimed. */
  private coverThink(dt: number, world: World, sees: boolean): void {
    const spot = this.coverSpot!;
    const player = world.player;

    // player flanked the cover — it isn't cover anymore
    const dirToPlayer = new THREE.Vector3(player.pos.x - spot.pos.x, 0, player.pos.z - spot.pos.z).normalize();
    if (sees && spot.coverDir.dot(dirToPlayer) < 0.25) {
      this.releaseCover();
      return;
    }

    if (sees) {
      this.lastKnown = player.pos.clone();
      this.loseSightT = 0;
    } else {
      this.loseSightT += dt;
      if (this.loseSightT > 4 && this.lastKnown) {
        this.releaseCover();
        this.state = "chase";
        this.setPath(world, this.lastKnown);
        return;
      }
    }
    const aim = (this.lastKnown ?? player.pos).clone().sub(this.pos);
    this.targetYaw = Math.atan2(-aim.x, -aim.z);

    if (this.coverPhase === "approach") {
      if (this.path) {
        if (this.followPath(dt, world, 3.2)) {
          this.path = null;
          this.coverPhase = "duck";
          this.coverT = 0.8 + Math.random() * 0.8;
        }
      } else if (Math.hypot(spot.pos.x - this.pos.x, spot.pos.z - this.pos.z) > 0.6) {
        this.setPath(world, spot.pos);
      } else {
        this.coverPhase = "duck";
        this.coverT = 0.8 + Math.random() * 0.8;
      }
    } else if (this.coverPhase === "duck") {
      this.coverT -= dt;
      if (this.coverT <= 0) {
        this.coverPhase = "pop";
        this.coverT = 1.3;
        this.burstLeft = this.gun.burst;
        this.shotT = 0.15;
      }
    } else {
      // pop up, empty the burst, sink back down
      if (sees && this.burstLeft > 0) {
        this.shotT -= dt;
        if (this.shotT <= 0) {
          this.burstLeft--;
          this.shotT = this.gun.intraDelay;
          this.fireRound(world);
        }
      }
      this.coverT -= dt;
      if (this.coverT <= 0 || this.burstLeft <= 0) {
        this.coverPhase = "duck";
        this.coverT = 0.9 + Math.random() * 0.9;
      }
    }
  }

  /** Can a lobbed grenade leave over close obstacles? */
  private arcClear(world: World, target: THREE.Vector3): boolean {
    const eye = this.eye();
    const flat = new THREE.Vector3(target.x - eye.x, 0, target.z - eye.z).normalize();
    const dir = flat.addScaledVector(UP, 0.47).normalize();
    return world.physics.raycast(eye, dir, 3) === null;
  }

  private lobGrenade(world: World, target: THREE.Vector3): void {
    const eye = this.eye();
    const flat = new THREE.Vector3(target.x - eye.x, 0, target.z - eye.z);
    const d = flat.length();
    flat.normalize();
    const vel = flat.multiplyScalar(Math.min(12, d * 1.45)).add(new THREE.Vector3(0, 4.5, 0));
    world.projectiles.spawnGrenade(world, eye.clone().addScaledVector(this.facingDir(), 0.3), vel, 2.2);
    // hold position a moment instead of charging into the blast
    this.loseSightT = -1.5;
  }

  private combatThink(dt: number, world: World, sees: boolean): void {
    const player = world.player;

    // mid-roll: keep moving, no shooting
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.wishVel.copy(new THREE.Vector3().crossVectors(this.facingDir(), UP).multiplyScalar(this.dodgeDir * 4.2));
      return;
    }

    // telegraphed grenade lob
    if (this.grenadeWindup > 0) {
      this.grenadeWindup -= dt;
      if (this.grenadeWindup <= 0 && this.lastKnown) this.lobGrenade(world, this.lastKnown);
      return;
    }

    if (this.coverSpot) {
      this.coverThink(dt, world, sees);
      return;
    }

    if (sees) {
      this.lastKnown = player.pos.clone();
      this.loseSightT = 0;
      const to = player.pos.clone().sub(this.pos);
      this.targetYaw = Math.atan2(-to.x, -to.z);

      if (this.reactionT > 0) {
        this.reactionT -= dt;
        return;
      }
      const dist = to.length();

      // GoldenEye dodge roll: on taking fire, or randomly while exposed
      this.dodgeCooldown -= dt;
      if (this.dodgeCooldown <= 0 && dist > 8 && (this.lastHitT < 0.6 || Math.random() < dt * 0.35)) {
        this.dodgeT = 0.45;
        this.dodgeDir = Math.random() < 0.5 ? -1 : 1;
        this.dodgeCooldown = 2.5 + Math.random() * 1.5;
        this.rig.play("Roll", { once: true, fade: 0.08, timeScale: 1.4 });
        this.poseLockT = 0.55;
        return;
      }

      const hadBurst = this.burstLeft > 0;
      this.burstFire(dt, world);
      // a burst just finished — sometimes break for cover instead of strafing
      if (hadBurst && this.burstLeft === 0 && Math.random() < 0.45 && this.tryTakeCover(world)) return;

      // reposition
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 1.2 + Math.random() * 1.4;
        this.strafeDir = dist > 15 ? 2 : Math.random() < 0.5 ? -1 : 1;
      }
      if (this.strafeDir !== 0) {
        const fwd = this.facingDir();
        const move =
          this.strafeDir === 2
            ? fwd.clone()
            : new THREE.Vector3().crossVectors(fwd, UP).multiplyScalar(this.strafeDir);
        this.wishVel.copy(move.multiplyScalar(1.8));
      }
    } else {
      this.loseSightT += dt;
      // flush a camper: known position, no line of sight, clear arc
      if (
        this.kind === "guard" &&
        this.grenadeCooldown <= 0 &&
        this.lastKnown &&
        this.loseSightT > 0.7 &&
        this.pos.distanceTo(this.lastKnown) < 14 &&
        this.pos.distanceTo(this.lastKnown) > 4 &&
        this.arcClear(world, this.lastKnown)
      ) {
        this.grenadeWindup = 0.8;
        this.grenadeCooldown = 12;
        world.sfx.guardAlert(this.pos);
        this.rig.play("Idle_Gun_Shoot", { once: true, fade: 0.1 });
        this.poseLockT = 0.8;
        return;
      }
      if (this.loseSightT > 1.3 && this.lastKnown) {
        this.state = "chase";
        this.setPath(world, this.lastKnown);
      }
    }
  }

  // ---- main update ------------------------------------------------------

  update(dt: number, world: World): void {
    if (this.state === "dead") {
      this.updateDeath(dt, world);
      return;
    }
    this.lastHitT += dt;
    this.grenadeCooldown -= dt;
    this.duckAmount = THREE.MathUtils.damp(this.duckAmount, this.coverSpot && this.coverPhase === "duck" ? 1 : 0, 8, dt);

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      this.wishVel.set(0, 0, 0);
      this.integrate(dt, world);
      this.applyPose(dt);
      return;
    }
    this.wishVel.set(0, 0, 0);

    // idle life: unaware guards stretch, wander, check the radio
    if ((this.state === "post" || this.state === "patrol") && this.alertLevel === 0) {
      this.idleT -= dt;
      if (this.idleT <= 0) {
        this.idleT = 6 + Math.random() * 8;
        const spd = Math.hypot(this.vel.x, this.vel.z);
        const r = Math.random();
        if (r < 0.4 && spd < 0.5) {
          const gesture = ["Wave", "Idle_Neutral", "Interact"][(Math.random() * 3) | 0];
          this.rig.play(gesture, { once: true, fade: 0.2 });
          this.poseLockT = 2.3;
        } else if (r < 0.7 && this.state === "post" && !this.path) {
          const spot = world.level.nav.randomNearby(this.homePos, 3);
          if (spot) this.setPath(world, spot);
        } else {
          world.sfx.radioChatter(this.pos);
        }
      }
    }

    const sees = this.canSeePlayer(world);
    if (sees && this.state !== "combat" && this.state !== "alarm") {
      this.onSpotPlayer(world);
    }

    // notice dead bodies
    this.scanT -= dt;
    if (this.scanT <= 0 && this.state !== "combat" && this.state !== "alarm") {
      this.scanT = 0.7;
      for (const g of world.guards) {
        if (g === this || g.alive || g.gone || g.bodyNoticed) continue;
        const to = g.pos.clone().sub(this.pos);
        const d = to.length();
        if (d > 12) continue;
        const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
        if (this.facingDir().dot(flat) < 0.4) continue;
        if (!world.physics.lineOfSight(this.eye(), g.center())) continue;
        g.bodyNoticed = true;
        this.alertLevel = Math.max(this.alertLevel, 1);
        world.sfx.guardAlert(this.pos);
        this.investigate(world, g.pos.clone());
        break;
      }
    }

    let moving = false;
    switch (this.state) {
      case "patrol": {
        if (this.route.length > 0) {
          if (!this.path) this.setPath(world, this.route[this.routeIdx]);
          if (this.followPath(dt, world, this.alertLevel > 0 ? 2.4 : 1.5)) {
            this.routeIdx = (this.routeIdx + 1) % this.route.length;
            this.setPath(world, this.route[this.routeIdx]);
          } else {
            moving = true;
          }
        }
        break;
      }
      case "post": {
        // drift back to facing direction, occasional glances
        this.targetYaw = this.homeYaw + Math.sin(world.time * 0.3 + this.homePos.x) * 0.5;
        if (this.path) {
          // wandering (idle life) or returning home
          moving = !this.followPath(dt, world, 1.4);
          if (!moving) this.path = null;
        } else if (this.pos.distanceTo(this.homePos) > 0.6) {
          this.setPath(world, this.homePos);
        }
        break;
      }
      case "investigate": {
        if (this.path) {
          moving = !this.followPath(dt, world, 2.4);
          if (!moving) this.path = null;
        } else {
          this.investigateT -= dt;
          this.targetYaw += dt * 1.4 * Math.sin(world.time * 1.7);
          if (this.investigateT <= 0) {
            this.alertLevel = Math.max(0, this.alertLevel - 1);
            this.state = this.route.length > 0 ? "patrol" : "post";
            this.path = null;
          }
        }
        break;
      }
      case "chase": {
        // flankers commit to their via point before homing on the player
        if (this.hunter && world.alarm.active && !this.flankVia) {
          this.hunterRepathT -= dt;
          if (this.hunterRepathT <= 0) {
            this.hunterRepathT = 2.5;
            this.setPath(world, world.player.pos);
          }
        }
        if (this.path) {
          moving = !this.followPath(dt, world, 3.5);
          if (!moving) {
            this.path = null;
            if (this.flankVia) {
              this.flankVia = null;
              this.setPath(world, world.player.pos);
            }
          }
        } else if (this.flankVia) {
          this.flankVia = null;
          this.setPath(world, world.player.pos);
        } else {
          this.state = "investigate";
          this.investigateT = 2.5;
        }
        break;
      }
      case "combat": {
        this.combatThink(dt, world, sees);
        moving = this.strafeDir !== 0 && sees;
        break;
      }
      case "alarm": {
        if (this.alarmPanel && !this.alarmPanel.alive) {
          // panel got shot out from under them
          this.alarmPanel = null;
          this.state = "combat";
          break;
        }
        if (world.alarm.active) {
          this.state = "combat";
          break;
        }
        if (this.path) {
          moving = !this.followPath(dt, world, 3.6);
          if (!moving) {
            this.path = null;
            this.pressT = 1.2;
          }
        } else if (this.alarmCell) {
          const panelPos = this.alarmPanel!.pos;
          const panelDist = Math.hypot(panelPos.x - this.pos.x, panelPos.z - this.pos.z);
          if (panelDist > 2.6) {
            // got knocked off course — walk back to the panel
            this.setPath(world, NavGrid.center(this.alarmCell[0], this.alarmCell[1]));
          } else {
            // at the panel: face it and press
            const to = panelPos.clone().sub(this.pos);
            this.targetYaw = Math.atan2(-to.x, -to.z);
            this.pressT -= dt;
            if (this.pressT <= 0) {
              world.alarm.trigger(world);
              this.state = "combat";
            }
          }
        }
        break;
      }
    }
    void moving;

    // turn toward target yaw (faster pivots in a fight)
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const turnRate = this.state === "combat" ? 8 : 6;
    this.yaw += THREE.MathUtils.clamp(dy, -dt * turnRate, dt * turnRate);

    this.integrate(dt, world);
    this.applyPose(dt);
  }

  /** Shared momentum integrator: velocity eases toward intent, motion arcs through corners. */
  private integrate(dt: number, world: World): void {
    this.vel.x = THREE.MathUtils.damp(this.vel.x, this.wishVel.x, 9, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, this.wishVel.z, 9, dt);
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (spd < 0.02) return;
    const bx = this.pos.x;
    const bz = this.pos.z;
    world.physics.moveBox(this.pos, HE, new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt));
    const actual = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    if (this.wishVel.lengthSq() > 0.5 && actual < spd * dt * 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 0.8) {
        this.stuckT = 0;
        this.path = null; // force a fresh path from wherever we got wedged
      }
    } else {
      this.stuckT = 0;
    }
  }

  private applyPose(dt: number): void {
    // ducked guards sink toward the floor (no crouch clip in the rig set)
    this.rig.root.position.set(this.pos.x, this.pos.y - HE.y - this.duckAmount * 0.45, this.pos.z);
    this.rig.root.rotation.y = this.yaw;

    if (this.staggerT > 0) {
      // HitRecieve is playing
      this.rig.update(dt);
      return;
    }
    if (this.poseLockT > 0) {
      // a one-shot (roll, gesture, throw telegraph) owns the mixer
      this.poseLockT -= dt;
      this.rig.update(dt);
      return;
    }

    // animation follows the ACTUAL velocity, so feet match the floor
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const moving = spd > 0.45;
    let anim = "Idle";
    let ts = 1;
    switch (this.state) {
      case "combat":
        if (this.coverSpot && this.coverPhase === "duck") anim = "Idle_Gun";
        else anim = moving ? "Run_Shoot" : "Idle_Gun_Pointing";
        ts = moving ? THREE.MathUtils.clamp(spd / 3.2, 0.5, 1.4) : 1;
        break;
      case "alarm":
      case "chase":
        anim = moving ? "Run" : "Idle_Gun";
        ts = moving ? THREE.MathUtils.clamp(spd / 3.2, 0.5, 1.5) : 1;
        break;
      case "investigate":
        anim = moving ? "Walk" : "Idle_Gun";
        ts = moving ? THREE.MathUtils.clamp(spd / 1.4, 0.6, 2) : 1;
        break;
      case "patrol":
        anim = moving ? "Walk" : "Idle";
        ts = moving ? THREE.MathUtils.clamp(spd / 1.4, 0.6, 2) : 1;
        break;
      default:
        anim = "Idle";
    }
    this.rig.play(anim);
    this.rig.setTimeScale(ts);
    this.rig.update(dt);
  }

  /** Reinforcements spawn already hunting; `via` makes them flank instead of beeline. */
  startHunting(world: World, via?: THREE.Vector3): void {
    this.hunter = true;
    this.alertLevel = 2;
    this.lastKnown = world.player.pos.clone();
    this.state = "chase";
    this.flankVia = via ?? null;
    this.setPath(world, via ?? this.lastKnown);
    this.hunterRepathT = 2.5;
  }

  hit(dmg: number, world: World, headshot: boolean, fromPos: THREE.Vector3 | null): void {
    if (!this.alive) return;
    this.health -= dmg;
    this.lastHitT = 0;
    this.staggerT = Math.max(this.staggerT, headshot ? 0.4 : 0.22);
    if (this.health <= 0) {
      this.die(world);
      return;
    }
    this.rig.play("HitRecieve", { once: true, fade: 0.06 });
    // getting shot tells them roughly where you are
    this.alertLevel = 2;
    if (fromPos) {
      this.lastKnown = world.player.pos.clone();
      if (this.state !== "combat" && this.state !== "alarm") {
        if (this.canSeePlayer(world)) this.state = "combat";
        else {
          this.state = "chase";
          this.setPath(world, this.lastKnown);
        }
      }
    }
  }

  private die(world: World): void {
    this.alive = false;
    this.state = "dead";
    this.releaseCover();
    this.deadT = 0;
    this.rig.play("Death", { once: true, fade: 0.1 });
    if (!this.silent) world.sfx.guardDie(this.pos);
    world.mission.stats.kills++;
    world.events.emit("guardKilled", { pos: this.pos.clone() });
    if (this.unsubNoise) this.unsubNoise();

    // drops — whatever they were actually holding
    const dropType = ("weapon_" + this.gunId) as PickupType;
    const drop = new Pickup(dropType, new THREE.Vector3(this.pos.x + 0.3, 0, this.pos.z + 0.2));
    world.level.pickups.push(drop);
    world.scene.add(drop.mesh);
    if (this.keycard) {
      const card = new Pickup(this.keycard === "lab" ? "keycard_lab" : "keycard_officer", new THREE.Vector3(this.pos.x - 0.35, 0, this.pos.z - 0.25));
      world.level.pickups.push(card);
      world.scene.add(card.mesh);
    }
  }

  private updateDeath(dt: number, world: World): void {
    if (this.gone) return;
    this.deadT += dt;
    this.rig.update(dt);
    if (this.deadT > 8) {
      const op = Math.max(0, 1 - (this.deadT - 8) / 1.2);
      for (const mat of this.rig.materials) {
        mat.transparent = true;
        mat.opacity = op;
      }
      if (op <= 0) {
        world.scene.remove(this.rig.root);
        this.gone = true;
      }
    }
  }
}
