import * as THREE from "three";
import type { Collider, Physics } from "../core/Physics";
import type { Sfx } from "../audio/Sfx";
import { CELL, VENT_H } from "./Grid";
import { Tex, lambert } from "../textures/TextureGen";
import type { KeycardId } from "../types";

export type DoorKind = "slide" | "grate" | "gate";
export type DoorLock = "none" | KeycardId;

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
    else tex = Tex.doorLocked(lock);

    const w = this.axis === "z" ? width : thickness;
    const d = this.axis === "z" ? thickness : width;
    this.panel = new THREE.Mesh(new THREE.BoxGeometry(w, this.height, d), lambert(tex));
    this.panel.position.copy(this.center);
    this.group.add(this.panel);

    const min = new THREE.Vector3(wx - w / 2, 0, wz - d / 2);
    const max = new THREE.Vector3(wx + w / 2, this.height, wz + d / 2);
    this.collider = physics.addBox(min, max, "door", this);
  }

  isPassable(): boolean {
    return this.broken || this.open01 > 0.7;
  }

  isClosed(): boolean {
    return !this.broken && this.open01 < 0.05;
  }

  /** AI or an unlocked player interaction. Ignores locks. */
  requestOpen(): void {
    if (this.broken) return;
    if (this.want === 0) this.sfx.doorOpen(this.center);
    this.want = 1;
    this.closeTimer = 3.5;
  }

  /**
   * Player interaction. Returns "opened", "locked" (needs a card the
   * player doesn't have) or "unlocked" (card used).
   */
  tryOpen(cards: Set<KeycardId>): "opened" | "locked" | "unlocked" {
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

    if (this.want === 1) {
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
