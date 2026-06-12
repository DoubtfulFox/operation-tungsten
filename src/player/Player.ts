import * as THREE from "three";
import type { World } from "../world";
import type { KeycardId } from "../types";

const HE_STAND = new THREE.Vector3(0.34, 0.85, 0.34); // 1.7m tall
const HE_CROUCH = new THREE.Vector3(0.34, 0.5, 0.34); // 1.0m tall
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * First-person controller: GoldenEye pacing (default speed is a brisk
 * run, Shift sneaks quietly), crouch for the vents, health + armor with
 * no regeneration.
 */
export class Player {
  /** center of the collision box; feet are at pos.y - he.y */
  pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  crouched = false;
  health = 100;
  armor = 0;
  alive = true;
  cards = new Set<KeycardId>();
  sensitivity = 0.0022;
  /** scaled down while zoomed (set by the weapon system) */
  zoomScale = 1;

  /** true while move keys produce motion (guards aim better at campers) */
  moving = false;
  sneaking = false;
  /** mid-vault: input and firing are suspended */
  vaulting = false;

  private vaultT = 0;
  private vaultFrom = new THREE.Vector3();
  private vaultApex = new THREE.Vector3();
  private vaultTo = new THREE.Vector3();
  private vaultDip = 0;

  private crouchLerp = 0; // 0 standing, 1 crouched
  private stepTimer = 0;
  /** horizontal velocity with momentum — input steers this, never position */
  private vel = new THREE.Vector3();
  /** Perfect Dark-style camera roll while strafing */
  private lean = 0;
  bobPhase = 0;
  bobAmount = 0;

  get he(): THREE.Vector3 {
    return this.crouched ? HE_CROUCH : HE_STAND;
  }

  get feet(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y - this.he.y, this.pos.z);
  }

  get eyeY(): number {
    // smooth crouch transition
    const standEye = 1.58;
    const crouchEye = 0.86;
    return this.pos.y - this.he.y + THREE.MathUtils.lerp(standEye, crouchEye, this.crouchLerp);
  }

  eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.eyeY, this.pos.z);
  }

  forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  spawn(world: World, pos: THREE.Vector3, yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.vel.set(0, 0, 0);
    this.lean = 0;
    this.cards.clear();
    this.crouched = true; // mission starts inside the vent
    this.crouchLerp = 1;
    this.pos.set(pos.x, this.he.y + 0.01, pos.z);
    // stand up if there's actually headroom at the start point
    if (!world.physics.overlaps(new THREE.Vector3(pos.x, HE_STAND.y + 0.01, pos.z), HE_STAND)) {
      this.crouched = false;
      this.crouchLerp = 0;
      this.pos.y = HE_STAND.y + 0.01;
    }
  }

  /**
   * Vault check: waist-high obstacle ahead, clearance above it, open
   * floor on the far side. Returns the landing center or null.
   */
  canVault(world: World): THREE.Vector3 | null {
    if (this.crouched || this.vaulting || !this.alive) return null;
    const feetY = this.pos.y - this.he.y;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const kneeOrigin = new THREE.Vector3(this.pos.x, feetY + 0.45, this.pos.z);

    // knee ray must hit something waist-high
    const knee = world.physics.raycast(kneeOrigin, fwd, 1.0);
    if (!knee || (knee.collider.kind !== "prop" && knee.collider.kind !== "level")) return null;
    const top = knee.collider.max.y;
    const rise = top - feetY;
    if (rise < 0.5 || rise > 1.35) return null;

    // chest must be clear (it's a ledge, not a wall)
    const chestOrigin = new THREE.Vector3(this.pos.x, feetY + 1.35, this.pos.z);
    if (world.physics.raycast(chestOrigin, fwd, 1.0)) return null;

    // crouch-height clearance above the obstacle
    const overMid = knee.point.clone().addScaledVector(fwd, 0.3);
    const overCenter = new THREE.Vector3(overMid.x, top + HE_CROUCH.y + 0.06, overMid.z);
    if (world.physics.overlaps(overCenter, HE_CROUCH)) return null;

    // landing: just past the collider's far face along our heading
    const exitX = fwd.x > 1e-4 ? (knee.collider.max.x - kneeOrigin.x) / fwd.x : fwd.x < -1e-4 ? (knee.collider.min.x - kneeOrigin.x) / fwd.x : Infinity;
    const exitZ = fwd.z > 1e-4 ? (knee.collider.max.z - kneeOrigin.z) / fwd.z : fwd.z < -1e-4 ? (knee.collider.min.z - kneeOrigin.z) / fwd.z : Infinity;
    const exitT = Math.min(exitX, exitZ);
    if (!isFinite(exitT) || exitT > 2.6) return null;
    const land = new THREE.Vector3(this.pos.x + fwd.x * (exitT + 0.45), HE_STAND.y + 0.01, this.pos.z + fwd.z * (exitT + 0.45));
    if (world.physics.overlaps(land, HE_STAND)) return null;
    const [lcx, lcz] = [Math.floor(land.x / 2), Math.floor(land.z / 2)];
    if (!world.level.grid.isFloor(lcx, lcz)) return null;
    return land;
  }

  private startVault(world: World, land: THREE.Vector3): void {
    this.vaulting = true;
    this.vaultT = 0;
    this.vaultFrom.copy(this.pos);
    this.vaultTo.copy(land);
    const midX = (this.pos.x + land.x) / 2;
    const midZ = (this.pos.z + land.z) / 2;
    this.vaultApex.set(midX, Math.max(this.pos.y, land.y) + 0.55, midZ);
    this.vel.set(0, 0, 0);
    world.sfx.footstep(true);
  }

  update(dt: number, world: World): void {
    if (!this.alive) return;
    const input = world.input;

    // --- look ---
    this.yaw -= input.mouseDX * this.sensitivity * this.zoomScale;
    this.pitch -= input.mouseDY * this.sensitivity * this.zoomScale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);

    // --- vault in progress: scripted arc, everything else suspended ---
    if (this.vaulting) {
      this.vaultT = Math.min(1, this.vaultT + dt / 0.5);
      const t = this.vaultT;
      const u = 1 - t;
      this.pos.set(
        u * u * this.vaultFrom.x + 2 * u * t * this.vaultApex.x + t * t * this.vaultTo.x,
        u * u * this.vaultFrom.y + 2 * u * t * this.vaultApex.y + t * t * this.vaultTo.y,
        u * u * this.vaultFrom.z + 2 * u * t * this.vaultApex.z + t * t * this.vaultTo.z
      );
      this.vaultDip = Math.sin(t * Math.PI) * -0.1;
      if (this.vaultT >= 1) {
        this.vaulting = false;
        this.vaultDip = 0;
        this.pos.copy(this.vaultTo);
      }
      const cam = world.camera;
      cam.position.set(this.pos.x, this.eyeY, this.pos.z);
      cam.rotation.y = this.yaw;
      cam.rotation.x = this.pitch + this.vaultDip;
      cam.rotation.z = this.lean;
      return;
    }

    // --- vault trigger ---
    if (input.actionPressed("vault")) {
      const land = this.canVault(world);
      if (land) {
        this.startVault(world, land);
        return;
      }
    }

    // --- crouch toggle ---
    if (input.actionPressed("crouch")) {
      if (this.crouched) {
        // only stand if there's headroom
        const standCenter = new THREE.Vector3(this.pos.x, HE_STAND.y + 0.01, this.pos.z);
        if (!world.physics.overlaps(standCenter, HE_STAND)) {
          this.crouched = false;
          this.pos.y = HE_STAND.y + 0.01;
        }
      } else {
        this.crouched = true;
        this.pos.y = HE_CROUCH.y + 0.01;
      }
    }
    this.crouchLerp = THREE.MathUtils.damp(this.crouchLerp, this.crouched ? 1 : 0, 12, dt);

    // --- move ---
    let mx = 0;
    let mz = 0;
    if (input.actionDown("forward")) mz -= 1;
    if (input.actionDown("back")) mz += 1;
    if (input.actionDown("left")) mx -= 1;
    if (input.actionDown("right")) mx += 1;
    this.sneaking = input.actionDown("sneak");
    let speed = this.crouched ? 1.6 : this.sneaking ? 1.9 : 4.2;
    if (world.mods.turbo) speed *= 1.6;

    // momentum: velocity eases toward the input direction instead of
    // snapping — GoldenEye/Perfect Dark had a distinct accelerate/glide
    const wish = new THREE.Vector3(mx, 0, mz);
    const hasInput = wish.lengthSq() > 0;
    if (hasInput) wish.normalize().applyAxisAngle(UP_AXIS, this.yaw).multiplyScalar(speed);
    const k = hasInput ? 12 : 15; // slightly snappier stop than start
    this.vel.x = THREE.MathUtils.damp(this.vel.x, wish.x, k, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, wish.z, k, dt);
    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.moving = spd > 0.4;

    if (spd > 0.01) {
      const res = world.physics.moveBox(this.pos, this.he, new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt));
      // don't keep shoving into walls — kills the bounce-off jitter
      if (res.hitX) this.vel.x = 0;
      if (res.hitZ) this.vel.z = 0;
    }

    // soft push-out from living guards
    for (const g of world.guards) {
      if (!g.alive) continue;
      const dx = this.pos.x - g.pos.x;
      const dz = this.pos.z - g.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.55 * 0.55 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (0.55 - d) / d;
        const np = this.pos.clone();
        np.x += dx * push;
        np.z += dz * push;
        if (!world.physics.overlaps(np, this.he)) this.pos.copy(np);
      }
    }

    // head bob + footsteps follow the real speed, not the input
    this.bobPhase += dt * spd * 2.4;
    this.bobAmount = THREE.MathUtils.damp(this.bobAmount, THREE.MathUtils.clamp(spd / 4.2, 0, 1), 8, dt);
    if (spd > 1.2 && !this.crouched) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 1.55 / spd;
        world.sfx.footstep(spd > 2.6);
      }
    } else {
      this.stepTimer = 0.12;
    }

    // --- camera (with a Perfect Dark strafe lean) ---
    this.lean = THREE.MathUtils.damp(this.lean, -mx * 0.016 * (spd / speed), 7, dt);
    const cam = world.camera;
    cam.position.set(this.pos.x, this.eyeY + Math.sin(this.bobPhase) * 0.035 * this.bobAmount, this.pos.z);
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = this.lean;
  }

  damage(amount: number, world: World): void {
    if (!this.alive || world.mods.invincible) return;
    const absorbed = Math.min(this.armor, amount);
    this.armor -= absorbed;
    this.health -= amount - absorbed;
    world.sfx.hurt();
    world.events.emit("playerDamaged", { amount });
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      world.events.emit("playerDied", { reason: "James Bond was killed in action." });
    }
  }

  heal(amount: number): void {
    this.health = Math.min(100, this.health + amount);
  }

  giveArmor(): void {
    this.armor = 100;
  }
}
