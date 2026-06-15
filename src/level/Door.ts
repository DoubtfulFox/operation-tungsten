import * as THREE from "three";
import type { Collider, Physics } from "../core/Physics";
import type { Sfx } from "../audio/Sfx";
import { CELL, VENT_H } from "./Grid";
import { Tex, lambert } from "../textures/TextureGen";
import type { KeycardId } from "../types";

export type DoorKind = "slide" | "grate" | "gate";
/**
 * "pick"   = a padlocked door (no keycard) that only the lockpick opens.
 * "sealed" = a blast door nothing opens manually; it stays shut (and a hard
 *            Nav barrier) until the alarm latches it open via `latchOpen()`.
 */
export type DoorLock = "none" | KeycardId | "pick" | "sealed";

const LOCK_PLATE = new THREE.MeshLambertMaterial({ color: 0x15171a });
const LOCK_BODY = new THREE.MeshLambertMaterial({ color: 0xc59a3a });
const LOCK_STEEL = new THREE.MeshLambertMaterial({ color: 0xaab0b8 });

/** A small procedural padlock (backplate + brass body + steel shackle + keyhole), proud face toward +z. */
function buildLockBadge(): THREE.Group {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.27, 0.025), LOCK_PLATE);
  g.add(plate);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.07), LOCK_BODY);
  body.position.set(0, -0.035, 0.045);
  g.add(body);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 18, Math.PI), LOCK_STEEL);
  shackle.position.set(0, 0.04, 0.045);
  g.add(shackle);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.02, 14), LOCK_PLATE);
  keyhole.position.set(0, -0.05, 0.081);
  g.add(keyhole);
  return g;
}

/**
 * Sliding facility doors (GoldenEye style: the panel slides up),
 * the vent grate you kick open, and the jail-cell gate.
 */
export class Door {
  group = new THREE.Group();
  panel: THREE.Mesh;
  collider: Collider;
  lock: DoorLock;
  kind: DoorKind;
  cx: number;
  cz: number;
  /** travel axis through the doorway */
  axis: "x" | "z";
  center: THREE.Vector3;
  broken = false;
  /** a sealed door that has been latched permanently open (by the alarm) */
  latched = false;

  private open01 = 0;
  private want = 0;
  private closeTimer = 0;
  private height: number;
  private closedY: number;

  constructor(
    private physics: Physics,
    private sfx: Sfx,
    cx: number,
    cz: number,
    kind: DoorKind,
    lock: DoorLock,
    /** passage axis: open floor on N/S neighbors => travel along z (the builder computes this) */
    axis: "x" | "z",
    centerOverride?: { x: number; z: number }
  ) {
    this.cx = cx;
    this.cz = cz;
    this.kind = kind;
    this.lock = lock;
    this.axis = axis;

    const wx = centerOverride ? centerOverride.x : cx * CELL + CELL / 2;
    const wz = centerOverride ? centerOverride.z : cz * CELL + CELL / 2;
    this.height = kind === "grate" ? VENT_H : 2.6;
    this.center = new THREE.Vector3(wx, this.height / 2, wz);
    this.closedY = this.height / 2;

    const thickness = 0.24;
    const width = CELL;
    let tex: THREE.Texture;
    if (kind === "grate") tex = Tex.grate();
    else if (kind === "gate") tex = Tex.grate();
    else if (lock === "none") tex = Tex.door();
    else if (lock === "pick") tex = Tex.door(); // plain panel; the padlock mesh is the lock cue
    else if (lock === "sealed") tex = Tex.door(); // sealed is gate-only; never reached for a slide
    else tex = Tex.doorLocked(lock);

    const w = this.axis === "z" ? width : thickness;
    const d = this.axis === "z" ? thickness : width;
    this.panel = new THREE.Mesh(new THREE.BoxGeometry(w, this.height, d), lambert(tex));
    this.panel.position.copy(this.center);
    this.group.add(this.panel);

    if (lock === "pick") this.attachLockBadge(thickness);

    const min = new THREE.Vector3(wx - w / 2, 0, wz - d / 2);
    const max = new THREE.Vector3(wx + w / 2, this.height, wz + d / 2);
    this.collider = physics.addBox(min, max, "door", this);
  }

  /** Mount a padlock on both faces at handle height (it rides up with the panel when opened). */
  private attachLockBadge(thickness: number): void {
    const faceOff = thickness / 2 + 0.02;
    for (const sign of [1, -1]) {
      const badge = buildLockBadge();
      badge.position.y = 1.12 - this.center.y; // ~handle height in world space
      if (this.axis === "z") {
        badge.position.z = sign * faceOff;
        badge.rotation.y = sign > 0 ? 0 : Math.PI;
      } else {
        badge.position.x = sign * faceOff;
        badge.rotation.y = (sign * Math.PI) / 2;
      }
      this.panel.add(badge);
    }
  }

  isPassable(): boolean {
    return this.broken || this.open01 > 0.7;
  }

  isClosed(): boolean {
    return !this.broken && this.open01 < 0.05;
  }

  /** AI or an unlocked player interaction. Ignores keycard locks, but a sealed
   *  blast door stays shut until the alarm latches it (so a passing guard can't
   *  pop it early). */
  requestOpen(): void {
    if (this.broken) return;
    if (this.lock === "sealed" && !this.latched) return;
    if (this.want === 0) this.sfx.doorOpen(this.center);
    this.want = 1;
    this.closeTimer = 3.5;
  }

  /** Alarm release: a sealed gate opens and stays open for the rest of the mission. */
  latchOpen(): void {
    if (this.broken) return;
    this.latched = true;
    this.sfx.doorOpen(this.center);
    this.want = 1;
  }

  /**
   * Player interaction. Returns "opened", "locked" (needs a card the
   * player doesn't have) or "unlocked" (card used).
   */
  tryOpen(cards: Set<KeycardId>): "opened" | "locked" | "unlocked" {
    if (this.lock === "sealed") {
      // blast door: nothing the player carries opens it — only the alarm (latchOpen)
      this.sfx.doorDenied();
      return "locked";
    }
    if (this.lock === "pick") {
      // padlocked: no keycard opens it — only the lockpick (handled in the interact flow)
      this.sfx.doorDenied();
      return "locked";
    }
    if (this.lock !== "none" && !cards.has(this.lock)) {
      this.sfx.doorDenied();
      return "locked";
    }
    const usedCard = this.lock !== "none";
    if (usedCard) this.sfx.keycard();
    this.requestOpen();
    return usedCard ? "unlocked" : "opened";
  }

  /** Kick the vent grate out (permanent). */
  kick(): void {
    if (this.kind !== "grate" || this.broken) return;
    this.broken = true;
    this.collider.enabled = false;
    this.sfx.grateKick(this.center);
  }

  update(dt: number, nearbyEntities: THREE.Vector3[]): void {
    if (this.broken) {
      // grate falls over and sinks away
      if (this.panel.parent) {
        this.panel.rotation.x += dt * 4;
        this.panel.position.y -= dt * 1.4;
        if (this.panel.position.y < -1.2) this.group.remove(this.panel);
      }
      return;
    }

    if (this.want === 1 && !this.latched) {
      let anyoneNear = false;
      for (const p of nearbyEntities) {
        if (Math.abs(p.x - this.center.x) < 2.4 && Math.abs(p.z - this.center.z) < 2.4) {
          anyoneNear = true;
          break;
        }
      }
      if (anyoneNear) this.closeTimer = 2.0;
      else {
        this.closeTimer -= dt;
        if (this.closeTimer <= 0) this.want = 0;
      }
    }

    const speed = this.kind === "gate" ? 1.6 : 2.4;
    const prev = this.open01;
    this.open01 = THREE.MathUtils.clamp(this.open01 + (this.want === 1 ? dt * speed : -dt * speed), 0, 1);
    if (prev > 0.05 && this.open01 <= 0.05 && this.want === 0) {
      // soft close thunk
      this.sfx.impact(this.center);
    }

    if (this.kind === "gate") {
      // jail gate slides sideways
      const slide = this.open01 * (CELL - 0.2);
      if (this.axis === "z") this.panel.position.x = this.center.x + slide;
      else this.panel.position.z = this.center.z + slide;
    } else {
      this.panel.position.y = this.closedY + this.open01 * (this.height - 0.15);
    }
    this.collider.enabled = this.open01 < 0.5;
  }
}
