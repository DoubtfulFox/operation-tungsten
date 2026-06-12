import type { CellChar, RegionDef } from "../types";
import type { LevelDef } from "./LevelTypes";

/** Universal grid constants — every level uses 2m cells. */
export const CELL = 2;
export const WALL_H = 3;
export const VENT_H = 1.3;

export function isFloorChar(ch: CellChar): boolean {
  return ch === "." || ch === "v" || ch === "D" || ch === "L" || ch === "O" || ch === "G";
}

/** Cell coordinate -> world coordinate (c=12 gives cell center, c=12.5 gives the boundary). */
export function cw(c: number): number {
  return c * CELL + CELL / 2;
}

/** Instance view over one level's ASCII map + regions. */
export class GridMap {
  readonly w: number;
  readonly h: number;

  constructor(public readonly def: LevelDef) {
    this.w = def.map[0].length;
    this.h = def.map.length;
  }

  at(cx: number, cz: number): CellChar {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return " ";
    return this.def.map[cz][cx] as CellChar;
  }

  isFloor(cx: number, cz: number): boolean {
    return isFloorChar(this.at(cx, cz));
  }

  /** Region lookup — the last region acts as the fallback (corridors). */
  regionAt(cx: number, cz: number): RegionDef {
    for (const r of this.def.regions) {
      if (cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1) return r;
    }
    return this.def.regions[this.def.regions.length - 1];
  }
}
