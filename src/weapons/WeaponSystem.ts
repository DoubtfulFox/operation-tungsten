import * as THREE from "three";
import type { World } from "../world";
import type { AmmoType, WeaponDef } from "../types";
import type { GameAction } from "../core/Bindings";
import { SLOT_GROUPS, SLOT_ORDER, WEAPONS } from "./WeaponDefs";
import { ViewModel } from "./ViewModel";
import { buildGunMesh } from "./GunMeshes";
import { rayVsBox, type Collider } from "../core/Physics";
import { damageDestructible, explode } from "../combat/Damage";
import type { Destructible } from "../level/LevelBuilder";
import type { Door } from "../level/Door";

interface PlantedMine {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  attachedTo: string | null;
}

interface ShotHit {
  kind: "level" | "door" | "prop" | "guard" | "npc" | "none";
  point: THREE.Vector3;
  normal: THREE.Vector3;
  guardIndex: number;
  npcIndex: number;
  headshot: boolean;
  destructible: Destructible | null;
  collider: Collider | null;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Player arsenal: inventory, switching, hitscan firing, grenades, mines, camera. */
export class WeaponSystem {
  owned = new Set<string>(["slappers", "pp9", "mines", "camera"]);
  mags = new Map<string, number>([["pp9", 7]]);
  reserve: Record<AmmoType, number> = { "9mm": 28, rifle: 0, shells: 0, rail: 0, golden: 0, grenade: 0, mine: 3 };
  currentId = "pp9";
  aiming = false;
  reloading = false;
  viewModel: ViewModel;
  plantedMines: PlantedMine[] = [];
  /** GoldenEye-style hip-fire magnetism (watch options) */
  aimAssist = true;
  /** auto-equip a weapon the moment it's picked up (watch options) */
  autoSwitchOnPickup = true;
  /** current effective spread in radians, for the HUD crosshair */
  visualSpread = 0;
  /** what the crosshair is on: a hostile in range, beyond range, or nothing */
  aimTarget: "in" | "far" | null = null;

  private cooldown = 0;
  private reloadT = 0;
  private switchT = 0;
  /** last selected member per slot group, for first-press recall */
  private lastUsedInGroup = new Map<number, string>();
  private pendingId: string | null = null;
  private baseFov: number;
  private tankHintShown = false;
  private bloom = 0;
  private prevSwayX = 0;
  private prevSwayY = 0;

  constructor(private world: World) {
    this.viewModel = new ViewModel(world.camera);
    this.viewModel.setWeapon("pp9");
    this.baseFov = world.camera.fov;
  }

  def(): WeaponDef {
    return WEAPONS[this.currentId];
  }

  /** Ownership including the ALL GUNS cheat — use for every switch/UI check. */
  isOwned(id: string): boolean {
    return this.owned.has(id) || this.world.mods.allGuns;
  }

  /** Returns true if the weapon was newly acquired (vs just ammo). */
  give(id: string, withAmmo: number): boolean {
    // a second klobb means one for each hand
    if (id === "klobb" && this.owned.has("klobb")) {
      if (!this.owned.has("klobb_dual")) {
        this.owned.add("klobb_dual");
        this.mags.set("klobb_dual", WEAPONS.klobb_dual.magSize);
        if (this.autoSwitchOnPickup) this.switchTo("klobb_dual");
        return true;
      }
      this.reserve["9mm"] += withAmmo;
      return false;
    }
    const def = WEAPONS[id];
    const isNew = !this.owned.has(id);
    if (isNew) {
      this.owned.add(id);
      if (def.kind === "gun") this.mags.set(id, def.magSize);
      if (this.autoSwitchOnPickup) this.switchTo(id);
    } else if (def.ammo) {
      this.reserve[def.ammo] += withAmmo;
    }
    return isNew;
  }

  addAmmo(type: AmmoType, n: number): void {
    this.reserve[type] += n;
  }

  switchTo(id: string): void {
    if (!this.isOwned(id) || id === this.currentId || this.pendingId) return;
    this.pendingId = id;
    this.switchT = 0.18;
    this.reloading = false;
  }

  magAmmo(): number {
    return this.mags.get(this.currentId) ?? 0;
  }

  reserveAmmo(): number {
    const a = this.def().ammo;
    return a ? this.reserve[a] : 0;
  }

  update(dt: number, world: World): void {
    const input = world.input;
    const def = this.def();

    // --- switching: slot keys select a group; repeat presses cycle it ---
    for (const grp of SLOT_GROUPS) {
      if (!input.actionPressed(("weapon" + grp.key) as GameAction)) continue;
      const avail = grp.members.filter((id) => this.isOwned(id));
      if (avail.length === 0) continue;
      const activeId = this.pendingId ?? this.currentId;
      const idx = avail.indexOf(activeId);
      if (idx >= 0) {
        if (avail.length > 1) this.switchTo(avail[(idx + 1) % avail.length]);
      } else {
        const last = this.lastUsedInGroup.get(grp.key);
        this.switchTo(last && avail.includes(last) ? last : avail[0]);
      }
    }
    if (input.wheel !== 0) {
      const ownedOrdered = SLOT_ORDER.filter((id) => this.isOwned(id));
      const idx = ownedOrdered.indexOf(this.currentId);
      const next = ownedOrdered[(idx + (input.wheel > 0 ? 1 : -1) + ownedOrdered.length) % ownedOrdered.length];
      this.switchTo(next);
    }
    if (this.pendingId) {
      this.switchT -= dt;
      if (this.switchT <= 0) {
        this.currentId = this.pendingId;
        this.pendingId = null;
        this.viewModel.setWeapon(this.currentId);
        // ALL GUNS can hand over a gun that was never picked up — give it a mag
        const cur = this.def();
        if (cur.kind === "gun" && !this.mags.has(this.currentId)) this.mags.set(this.currentId, cur.magSize);
        const grp = SLOT_GROUPS.find((s) => s.members.includes(this.currentId));
        if (grp) this.lastUsedInGroup.set(grp.key, this.currentId);
      }
    }

    // INFINITE AMMO: reserves never drop below a comfortable floor
    if (world.mods.infiniteAmmo) {
      for (const k of Object.keys(this.reserve) as AmmoType[]) {
        if (this.reserve[k] < 99) this.reserve[k] = 99;
      }
    }

    // --- aiming + zoom ---
    this.aiming = input.actionDown("aim") && (def.kind === "gun" || def.kind === "camera");
    const targetFov = this.aiming && def.zoomFov > 0 ? def.zoomFov : this.baseFov;
    const cam = world.camera;
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 14, dt);
      cam.updateProjectionMatrix();
    }
    world.player.zoomScale = cam.fov / this.baseFov;

    // --- spread bloom decay + crosshair feed ---
    this.bloom = THREE.MathUtils.damp(this.bloom, 0, 7, dt);
    this.visualSpread = this.effectiveSpread(def, world);

    // --- scope sway (steadier when crouched) ---
    if (this.aiming && def.zoomFov > 0 && def.kind === "gun") {
      const f = world.player.crouched ? 0.4 : 1;
      const sx = Math.sin(world.time * 1.3) * 0.0011 * f;
      const sy = Math.sin(world.time * 1.9 + 1.3) * 0.0009 * f;
      world.player.yaw += sx - this.prevSwayX;
      world.player.pitch += sy - this.prevSwayY;
      this.prevSwayX = sx;
      this.prevSwayY = sy;
    } else {
      this.prevSwayX = 0;
      this.prevSwayY = 0;
    }

    // --- reload ---
    if (input.actionPressed("reload") && !this.reloading && !this.pendingId && def.kind === "gun") {
      this.startReload();
    }
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        const ammoType = def.ammo!;
        const take = Math.min(def.magSize - this.magAmmo(), this.reserve[ammoType]);
        this.mags.set(this.currentId, this.magAmmo() + take);
        this.reserve[ammoType] -= take;
      }
    }

    // --- fire (suspended mid-vault) ---
    this.cooldown -= dt;
    const wantFire = (def.auto ? input.actionDown("fire") : input.actionPressed("fire")) && !world.player.vaulting;
    if (wantFire && this.cooldown <= 0 && !this.reloading && !this.pendingId && world.player.alive) {
      this.fire(world, def);
    }
    // mines: the aim control detonates
    if (def.kind === "mine" && input.actionPressed("aim") && !world.player.vaulting) {
      this.detonate(world);
    }

    // --- aim-target probe: tint the reticle for in / out-of-range hostiles ---
    this.aimTarget = null;
    if (def.kind === "gun") {
      const eye = world.player.eyePos();
      const probe = this.hitscan(world, eye, world.player.forward(), Math.max(def.range, 300));
      if (probe.kind === "guard") {
        this.aimTarget = eye.distanceTo(probe.point) <= (def.effectiveRange ?? def.range) ? "in" : "far";
      }
    }

    const scoped = this.aiming && def.zoomFov > 0 && def.kind === "gun";
    this.viewModel.update(dt, world.player, input.mouseDX, this.aiming, scoped);
  }

  private startReload(): void {
    const def = this.def();
    if (this.magAmmo() >= def.magSize) return;
    if (this.reserve[def.ammo!] <= 0) return;
    this.reloading = true;
    this.reloadT = def.reloadTime;
    this.world.sfx.reload();
  }

  private fire(world: World, def: WeaponDef): void {
    switch (def.kind) {
      case "gun":
        this.fireGun(world, def);
        break;
      case "melee":
        this.fireMelee(world, def);
        break;
      case "thrown":
        this.throwGrenade(world);
        break;
      case "mine":
        this.throwMine(world, def);
        break;
      case "camera":
        this.snapPhoto(world, def);
        break;
      case "tool":
        this.pickLock(world, def);
        break;
    }
  }

  /**
   * Short assisted strike. Hitting an unaware guard from behind is an
   * instant silent takedown — the GoldenEye slapper fantasy.
   */
  private fireMelee(world: World, def: WeaponDef): void {
    this.cooldown = 1 / def.fireRate;
    this.viewModel.onShot(false);
    world.sfx.whoosh();
    const player = world.player;
    const eye = player.eyePos();
    const fwd = player.forward();
    const range = def.meleeRange ?? 1.6;

    let hit = this.hitscan(world, eye, fwd, range);
    if (hit.kind !== "guard" && hit.kind !== "npc") {
      const limit = hit.kind === "none" ? range : Math.min(range, hit.point.distanceTo(eye));
      const assisted = this.assistTarget(world, eye, fwd, limit);
      if (assisted) hit = assisted;
    }

    if (hit.kind === "guard") {
      const guard = world.guards[hit.guardIndex];
      const fromGuard = new THREE.Vector3(player.pos.x - guard.pos.x, 0, player.pos.z - guard.pos.z).normalize();
      const behind = guard.facingDir().dot(fromGuard) < -0.45;
      const unaware = guard.state === "post" || guard.state === "patrol" || guard.state === "investigate";
      if (unaware && behind) {
        guard.silent = true;
        guard.hit(9999, world, false, null, true);
        world.sfx.takedown(guard.pos);
        world.hud.hitPulse();
        return;
      }
      guard.hit(def.damage, world, false, player.eyePos(), true);
      world.effects.blood(hit.point);
      world.sfx.fleshHit(hit.point);
      world.emitNoise(player.pos, 4);
      world.hud.hitPulse();
    } else if (hit.kind === "npc") {
      world.npcs[hit.npcIndex].hit(def.damage, world);
      world.effects.blood(hit.point);
    } else if (hit.kind !== "none") {
      world.effects.sparks(hit.point, hit.normal, 0xccc6b8, 2);
      world.sfx.impact(hit.point);
      world.emitNoise(hit.point, 3);
    }
  }

  /** Spread after stance, movement and sustained-fire bloom. */
  private effectiveSpread(def: WeaponDef, world: World): number {
    if (def.kind !== "gun") return 0;
    const p = world.player;
    let s = this.aiming ? def.aimSpread : def.spread;
    if (!this.aiming) s *= 1.5; // hip-fire is inherently loose — no lasering from the hip
    if (p.moving) s *= 1.9; // moving blooms the cone hard
    else s *= 0.8; // planting your feet tightens it (rewards standing still)
    if (p.crouched) s *= 0.62; // crouch tightens further, stacking with standing still
    return s + this.bloom * (this.aiming ? 0.5 : 1);
  }

  private fireGun(world: World, def: WeaponDef): void {
    const mag = this.magAmmo();
    if (mag <= 0) {
      if (this.reserve[def.ammo!] > 0) this.startReload();
      else world.sfx.dryfire();
      this.cooldown = 0.25;
      return;
    }
    this.mags.set(this.currentId, mag - 1);
    this.cooldown = 1 / def.fireRate;
    world.sfx.shot(def.id);
    world.emitNoise(world.player.pos, def.noiseRadius);
    world.mission.stats.shotsFired++;
    this.viewModel.onShot();
    const muzzle = this.viewModel.muzzleWorld();
    world.effects.muzzleFlash(muzzle);

    const player = world.player;
    const eye = player.eyePos();
    const fwd = player.forward();
    const spread = this.effectiveSpread(def, world);
    this.bloom = Math.min(0.06, this.bloom + def.bloomAdd);

    // camera recoil kick
    player.pitch = Math.min(1.45, player.pitch + def.kick);
    player.yaw += (Math.random() - 0.5) * def.kick * 0.7;

    // eject a casing (energy weapons don't)
    if (def.ammo === "9mm" || def.ammo === "rifle" || def.ammo === "shells") {
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const ejectPos = eye.clone().addScaledVector(fwd, 0.3).addScaledVector(right, 0.16);
      ejectPos.y -= 0.06;
      world.effects.spawnCasing(ejectPos, right, fwd);
    }

    let anyHit = false;
    for (let p = 0; p < def.pellets; p++) {
      const dir = fwd.clone();
      if (spread > 0) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
        const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
        dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      }
      let hit = this.hitscan(world, eye, dir, def.range);

      // GoldenEye-style hip-fire magnetism: a narrow miss still connects
      if (this.aimAssist && !this.aiming && hit.kind !== "guard" && hit.kind !== "npc") {
        const limit = hit.kind === "none" ? def.range : hit.point.distanceTo(eye);
        const assisted = this.assistTarget(world, eye, dir, limit);
        if (assisted) hit = assisted;
      }

      const endPoint = hit.kind === "none" ? eye.clone().addScaledVector(dir, def.range) : hit.point;
      if (p === 0 || def.pellets <= 2) world.effects.tracer(muzzle, endPoint);

      if (this.applyHit(world, def, hit, 1)) anyHit = true;

      // punch through doors and thin cover at half damage
      if (def.penetrate && this.isPenetrable(hit)) {
        world.sfx.penetrate(hit.point);
        const origin2 = hit.point.clone().addScaledVector(dir, 0.35);
        world.effects.sparks(origin2, dir, 0xccc6b8, 3);
        const hit2 = this.hitscan(world, origin2, dir, def.range * 0.5);
        if (this.applyHit(world, def, hit2, 0.5)) anyHit = true;
      }
    }
    if (anyHit) {
      world.mission.stats.shotsHit++;
      world.hud.hitPulse();
    }
    if (this.magAmmo() <= 0 && this.reserve[def.ammo!] > 0) this.startReload();
  }

  /** Resolve one ray's impact: damage, effects, decals. Returns true on a flesh hit. */
  private applyHit(world: World, def: WeaponDef, hit: ShotHit, scale: number): boolean {
    switch (hit.kind) {
      case "guard": {
        const dmg = Math.round(def.damage * (hit.headshot ? def.headMult : 1) * scale);
        world.guards[hit.guardIndex].hit(dmg, world, hit.headshot, world.player.eyePos());
        world.effects.blood(hit.point);
        world.sfx.fleshHit(hit.point);
        return true;
      }
      case "npc": {
        world.npcs[hit.npcIndex].hit(Math.round(def.damage * scale), world);
        world.effects.blood(hit.point);
        return true;
      }
      case "prop": {
        if (hit.destructible) {
          if (hit.destructible.bulletImmune) {
            world.effects.sparks(hit.point, hit.normal, 0xffd080, 4);
            if (!this.tankHintShown && hit.destructible.kind === "gastank") {
              this.tankHintShown = true;
              world.events.emit("toast", { text: "Small arms won't crack the tanks — plant REMOTE MINES." });
            }
          } else {
            damageDestructible(world, hit.destructible, Math.round(def.damage * scale), false);
            world.effects.sparks(hit.point, hit.normal, 0x9fd2ff, 5);
          }
        } else {
          world.effects.sparks(hit.point, hit.normal, 0xccc6b8, 4);
          world.effects.spawnDecal(hit.point, hit.normal);
        }
        world.emitNoise(hit.point, 5);
        return false;
      }
      case "door": {
        world.effects.sparks(hit.point, hit.normal, 0xccc6b8, 4);
        const door = hit.collider?.ref as Door | undefined;
        world.effects.spawnDecal(hit.point, hit.normal, door ? door.panel : undefined);
        if (Math.random() < 0.25) world.sfx.ricochet(hit.point);
        world.emitNoise(hit.point, 5);
        return false;
      }
      case "level": {
        world.effects.sparks(hit.point, hit.normal, 0xccc6b8, 5);
        world.effects.spawnDecal(hit.point, hit.normal);
        if (Math.random() < 0.3) world.sfx.ricochet(hit.point);
        else world.sfx.impact(hit.point);
        world.emitNoise(hit.point, 5);
        return false;
      }
      case "none":
        return false;
    }
  }

  /** Doors and thin non-destructible props can be shot through. */
  private isPenetrable(hit: ShotHit): boolean {
    if (hit.kind === "door") return true;
    if (hit.kind === "prop" && !hit.destructible && hit.collider) {
      const ex = hit.collider.max.x - hit.collider.min.x;
      const ez = hit.collider.max.z - hit.collider.min.z;
      return Math.min(ex, ez) < 1.3;
    }
    return false;
  }

  /** Hip-fire magnetism: widened body boxes, still blocked by walls. */
  private assistTarget(world: World, eye: THREE.Vector3, dir: THREE.Vector3, maxT: number): ShotHit | null {
    let best: ShotHit | null = null;
    let bestT = maxT;
    const margin = 0.3;
    for (let i = 0; i < world.guards.length; i++) {
      const g = world.guards[i];
      if (!g.alive) continue;
      const hb = g.hitBoxes();
      const min = hb.bodyMin.clone();
      const max = hb.bodyMax.clone();
      min.x -= margin;
      min.z -= margin;
      max.x += margin;
      max.z += margin;
      max.y = hb.headMax.y + 0.1;
      const t = rayVsBox(eye, dir, min, max, bestT);
      if (t !== null && t < bestT) {
        bestT = t;
        best = {
          kind: "guard",
          point: eye.clone().addScaledVector(dir, t),
          normal: dir.clone().negate(),
          guardIndex: i,
          npcIndex: -1,
          headshot: false,
          destructible: null,
          collider: null
        };
      }
    }
    return best;
  }

  hitscan(world: World, origin: THREE.Vector3, dir: THREE.Vector3, range: number): ShotHit {
    const result: ShotHit = {
      kind: "none",
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      guardIndex: -1,
      npcIndex: -1,
      headshot: false,
      destructible: null,
      collider: null
    };
    let bestT = range;

    const lvl = world.physics.raycast(origin, dir, range);
    if (lvl) {
      bestT = lvl.t;
      result.point.copy(lvl.point);
      result.normal.copy(lvl.normal);
      result.collider = lvl.collider;
      if (lvl.collider.kind === "door") result.kind = "door";
      else if (lvl.collider.kind === "prop") {
        result.kind = "prop";
        result.destructible = (lvl.collider.ref as Destructible | undefined) ?? null;
      } else result.kind = "level";
    }

    for (let i = 0; i < world.guards.length; i++) {
      const g = world.guards[i];
      if (!g.alive) continue;
      const hb = g.hitBoxes();
      const tHead = rayVsBox(origin, dir, hb.headMin, hb.headMax, bestT);
      const tBody = rayVsBox(origin, dir, hb.bodyMin, hb.bodyMax, bestT);
      const t = tHead !== null && (tBody === null || tHead <= tBody) ? tHead : tBody;
      if (t !== null && t < bestT) {
        bestT = t;
        result.kind = "guard";
        result.guardIndex = i;
        result.headshot = tHead !== null && t === tHead;
        result.point.copy(origin).addScaledVector(dir, t);
        result.normal.copy(dir).negate();
        result.destructible = null;
        result.collider = null;
      }
    }

    for (let i = 0; i < world.npcs.length; i++) {
      const npc = world.npcs[i];
      if (!npc.alive) continue;
      const sb = npc.hitBox();
      const t = rayVsBox(origin, dir, sb.min, sb.max, bestT);
      if (t !== null && t < bestT) {
        bestT = t;
        result.kind = "npc";
        result.npcIndex = i;
        result.point.copy(origin).addScaledVector(dir, t);
        result.normal.copy(dir).negate();
        result.destructible = null;
        result.collider = null;
      }
    }
    return result;
  }

  private throwGrenade(world: World): void {
    if (this.reserve.grenade <= 0) {
      world.sfx.dryfire();
      this.cooldown = 0.4;
      return;
    }
    this.reserve.grenade--;
    this.cooldown = 1 / WEAPONS.grenade.fireRate;
    this.viewModel.onShot(false);
    const eye = world.player.eyePos();
    const fwd = world.player.forward();
    const pos = eye.clone().addScaledVector(fwd, 0.4);
    world.projectiles.spawnGrenade(world, pos, fwd.clone().multiplyScalar(11.5).add(new THREE.Vector3(0, 3.4, 0)), 2.6);
    if (this.reserve.grenade <= 0 && this.owned.has("pp9")) this.switchTo("pp9");
  }

  /**
   * Lob a remote mine on a short arc. It sticks where it lands — wall,
   * floor, or clamped onto an explosive target (gas tank, train engine) —
   * and arms as a remote charge; RMB still detonates the whole field.
   */
  private throwMine(world: World, def: WeaponDef): void {
    if (this.reserve.mine <= 0) {
      world.sfx.dryfire();
      this.cooldown = 0.4;
      return;
    }
    this.reserve.mine--;
    this.cooldown = 1 / def.fireRate;
    this.viewModel.onShot(false);
    world.sfx.whoosh();
    const eye = world.player.eyePos();
    const fwd = world.player.forward();
    const pos = eye.clone().addScaledVector(fwd, 0.4);
    const vel = fwd.clone().multiplyScalar(13).add(new THREE.Vector3(0, 2.4, 0));
    const mesh = buildGunMesh("mine");
    world.projectiles.spawnStickyMine(world, pos, vel, mesh, (stickPos, normal, hit) => {
      mesh.position.copy(stickPos).addScaledVector(normal, 0.035);
      mesh.quaternion.setFromUnitVectors(UP, normal);
      world.sfx.minePlant();
      let attachedTo: string | null = null;
      const ref = hit?.collider.ref as Destructible | Door | undefined;
      // charges clamp onto explosive-only targets (gas tanks, train engines)
      if (ref && (ref as Destructible).bulletImmune && (ref as Destructible).alive) {
        attachedTo = (ref as Destructible).id;
        world.mission.onMineAttached(attachedTo);
      }
      this.plantedMines.push({ mesh, pos: mesh.position.clone(), attachedTo });
    });
  }

  private detonate(world: World): void {
    if (this.plantedMines.length === 0) {
      world.sfx.beep();
      return;
    }
    world.sfx.beep();
    for (const m of this.plantedMines) {
      world.scene.remove(m.mesh);
      if (m.attachedTo) {
        const d = world.level.destructibles.get(m.attachedTo);
        if (d && d.alive) {
          damageDestructible(world, d, 9999, true);
          continue;
        }
      }
      explode(world, m.pos.clone(), 7.5, WEAPONS.mines.damage);
    }
    this.plantedMines.length = 0;
  }

  private snapPhoto(world: World, def: WeaponDef): void {
    this.cooldown = 1 / def.fireRate;
    world.sfx.shutter();
    world.hud.photoFlash();
    const eye = world.player.eyePos();
    for (const [targetId, target] of world.level.photoTargets) {
      const toTarget = target.clone().sub(eye);
      const dist = toTarget.length();
      const facing = toTarget.normalize().dot(world.player.forward());
      if (dist < def.range && facing > 0.88 && world.physics.lineOfSight(eye, target)) {
        world.mission.onPhoto(targetId);
        return;
      }
    }
    world.events.emit("toast", { text: "Nothing mission-critical in frame." });
  }

  /** Lock pick: open whatever closed door you're pointed at, no keycard needed. */
  private pickLock(world: World, def: WeaponDef): void {
    this.cooldown = 1 / def.fireRate;
    const eye = world.player.eyePos();
    const hit = world.physics.raycast(eye, world.player.forward(), def.range);
    const door = hit && hit.collider.kind === "door" ? (hit.collider.ref as Door) : null;
    if (door && door.isClosed()) {
      door.requestOpen();
      world.sfx.keycard();
      world.events.emit("toast", { text: door.lock !== "none" ? "Lock picked." : "Door opened." });
    } else {
      world.events.emit("toast", { text: "Point the pick at a closed door." });
    }
  }
}
