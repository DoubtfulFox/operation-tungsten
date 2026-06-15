import * as THREE from "three";
import { CELL, type GridMap } from "../level/Grid";
import type { Door } from "../level/Door";
import type { KeycardId } from "../types";

/**
 * Grid A* over the level map. Walkability comes straight from the
 * ASCII map; prop cells get blocked at build time; locked doors are
 * impassable to AI unless currently open.
 */
export class NavGrid {
  private readonly w: number;
  private readonly h: number;
  private walkable: Uint8Array;
  private blocked: Uint8Array;
  private doorAt = new Map<number, Door>();

  constructor(grid: GridMap) {
    this.w = grid.w;
    this.h = grid.h;
    this.walkable = new Uint8Array(this.w * this.h);
    this.blocked = new Uint8Array(this.w * this.h);
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        if (grid.isFloor(x, z)) this.walkable[z * this.w + x] = 1;
      }
    }
  }

  registerDoor(door: Door): void {
    this.doorAt.set(door.cz * this.w + door.cx, door);
  }

  doorAtCell(cx: number, cz: number): Door | undefined {
    return this.doorAt.get(cz * this.w + cx);
  }

  block(cx: number, cz: number): void {
    if (cx >= 0 && cz >= 0 && cx < this.w && cz < this.h) this.blocked[cz * this.w + cx] = 1;
  }

  isFree(cx: number, cz: number, keys?: Set<KeycardId>): boolean {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return false;
    const i = cz * this.w + cx;
    if (!this.walkable[i] || this.blocked[i]) return false;
    const door = this.doorAt.get(i);
    // a locked door blocks pathing unless it's open, or the pather holds its key
    // ("pick" and "sealed" gates are never key-openable — only a lockpick / the alarm)
    if (
      door &&
      door.lock !== "none" &&
      !door.isPassable() &&
      !(door.lock !== "pick" && door.lock !== "sealed" && keys && keys.has(door.lock))
    )
      return false;
    return true;
  }

  static toCell(p: THREE.Vector3): [number, number] {
    return [Math.floor(p.x / CELL), Math.floor(p.z / CELL)];
  }

  static center(cx: number, cz: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3(cx * CELL + CELL / 2, y, cz * CELL + CELL / 2);
  }

  /** A* (4-directional). Returns world-space waypoint centers, excluding the start cell. */
  findPath(from: [number, number], to: [number, number], keys?: Set<KeycardId>): THREE.Vector3[] | null {
    const [sx, sz] = from;
    const [tx, tz] = to;
    if (!this.isFree(tx, tz, keys) || !this.isFree(sx, sz, keys)) return null;
    if (sx === tx && sz === tz) return [];

    const open: number[] = [sz * this.w + sx];
    const came = new Map<number, number>();
    const g = new Map<number, number>([[sz * this.w + sx, 0]]);
    const f = new Map<number, number>([[sz * this.w + sx, Math.abs(tx - sx) + Math.abs(tz - sz)]]);
    const target = tz * this.w + tx;
    const dirs = [1, -1, this.w, -this.w];

    let guard = 0;
    while (open.length > 0 && guard++ < 4000) {
      let bi = 0;
      let bf = Infinity;
      for (let i = 0; i < open.length; i++) {
        const fv = f.get(open[i]) ?? Infinity;
        if (fv < bf) {
          bf = fv;
          bi = i;
        }
      }
      const cur = open.splice(bi, 1)[0];
      if (cur === target) {
        const path: THREE.Vector3[] = [];
        let n = cur;
        while (n !== sz * this.w + sx) {
          path.push(NavGrid.center(n % this.w, Math.floor(n / this.w)));
          const prev = came.get(n);
          if (prev === undefined) break;
          n = prev;
        }
        path.reverse();
        return path;
      }
      const cg = g.get(cur)!;
      for (const d of dirs) {
        const nb = cur + d;
        const nx = nb % this.w;
        const nz = Math.floor(nb / this.w);
        // prevent horizontal wrap
        if (d === 1 && nx === 0) continue;
        if (d === -1 && nx === this.w - 1) continue;
        if (!this.isFree(nx, nz, keys)) continue;
        const ng = cg + 1;
        if (ng < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, ng);
          f.set(nb, ng + Math.abs(tx - nx) + Math.abs(tz - nz));
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    return null;
  }

  /** A random free cell within `radius` cells of a world position (for investigate wandering). */
  randomNearby(pos: THREE.Vector3, radius: number): THREE.Vector3 | null {
    const [cx, cz] = NavGrid.toCell(pos);
    for (let i = 0; i < 10; i++) {
      const nx = cx + Math.floor((Math.random() * 2 - 1) * radius);
      const nz = cz + Math.floor((Math.random() * 2 - 1) * radius);
      if (this.isFree(nx, nz)) return NavGrid.center(nx, nz);
    }
    return null;
  }
}
