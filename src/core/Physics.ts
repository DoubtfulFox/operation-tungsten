import * as THREE from "three";

export type ColliderKind = "level" | "prop" | "door";

export interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  kind: ColliderKind;
  /** doors toggle this when opening/closing */
  enabled: boolean;
  /** opaque back-reference (Door instance, prop id, ...) */
  ref?: unknown;
}

export interface RayHit {
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  collider: Collider;
}

/**
 * Custom AABB world: the whole facility is axis-aligned boxes, so we
 * skip a physics engine entirely. Movement uses axis-separated sweeps,
 * bullets/vision use slab raycasts.
 */
export class Physics {
  colliders: Collider[] = [];

  addBox(min: THREE.Vector3, max: THREE.Vector3, kind: ColliderKind, ref?: unknown): Collider {
    const c: Collider = { min: min.clone(), max: max.clone(), kind, enabled: true, ref };
    this.colliders.push(c);
    return c;
  }

  remove(c: Collider): void {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  clear(): void {
    this.colliders.length = 0;
  }

  /** Does a box centered at pos with half-extents he overlap any solid collider? */
  overlaps(pos: THREE.Vector3, he: THREE.Vector3, skip?: Collider): boolean {
    for (const c of this.colliders) {
      if (!c.enabled || c === skip) continue;
      if (
        pos.x - he.x < c.max.x &&
        pos.x + he.x > c.min.x &&
        pos.y - he.y < c.max.y &&
        pos.y + he.y > c.min.y &&
        pos.z - he.z < c.max.z &&
        pos.z + he.z > c.min.z
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Move a box through the world one axis at a time, clamping against
   * whatever it hits. Returns which axes collided.
   */
  moveBox(pos: THREE.Vector3, he: THREE.Vector3, delta: THREE.Vector3): { hitX: boolean; hitY: boolean; hitZ: boolean } {
    const res = { hitX: false, hitY: false, hitZ: false };
    const eps = 0.001;

    const axes: Array<"x" | "z" | "y"> = ["x", "z", "y"];
    for (const axis of axes) {
      const d = delta[axis];
      if (d === 0) continue;
      pos[axis] += d;
      for (const c of this.colliders) {
        if (!c.enabled) continue;
        if (
          pos.x - he.x < c.max.x &&
          pos.x + he.x > c.min.x &&
          pos.y - he.y < c.max.y &&
          pos.y + he.y > c.min.y &&
          pos.z - he.z < c.max.z &&
          pos.z + he.z > c.min.z
        ) {
          if (d > 0) pos[axis] = c.min[axis] - he[axis] - eps;
          else pos[axis] = c.max[axis] + he[axis] + eps;
          if (axis === "x") res.hitX = true;
          else if (axis === "y") res.hitY = true;
          else res.hitZ = true;
        }
      }
    }
    return res;
  }

  /** Slab-method raycast against all enabled colliders. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, skip?: Collider): RayHit | null {
    let best: RayHit | null = null;
    const invX = 1 / dir.x;
    const invY = 1 / dir.y;
    const invZ = 1 / dir.z;

    for (const c of this.colliders) {
      if (!c.enabled || c === skip) continue;

      let tmin = (c.min.x - origin.x) * invX;
      let tmax = (c.max.x - origin.x) * invX;
      let axis = 0;
      if (tmin > tmax) {
        const tmp = tmin;
        tmin = tmax;
        tmax = tmp;
      }

      let tymin = (c.min.y - origin.y) * invY;
      let tymax = (c.max.y - origin.y) * invY;
      if (tymin > tymax) {
        const tmp = tymin;
        tymin = tymax;
        tymax = tmp;
      }
      if (tmin > tymax || tymin > tmax) continue;
      if (tymin > tmin) {
        tmin = tymin;
        axis = 1;
      }
      if (tymax < tmax) tmax = tymax;

      let tzmin = (c.min.z - origin.z) * invZ;
      let tzmax = (c.max.z - origin.z) * invZ;
      if (tzmin > tzmax) {
        const tmp = tzmin;
        tzmin = tzmax;
        tzmax = tmp;
      }
      if (tmin > tzmax || tzmin > tmax) continue;
      if (tzmin > tmin) {
        tmin = tzmin;
        axis = 2;
      }

      if (tmin < 0 || tmin > maxDist) continue;
      if (best && tmin >= best.t) continue;

      const point = origin.clone().addScaledVector(dir, tmin);
      const normal = new THREE.Vector3();
      if (axis === 0) normal.set(-Math.sign(dir.x), 0, 0);
      else if (axis === 1) normal.set(0, -Math.sign(dir.y), 0);
      else normal.set(0, 0, -Math.sign(dir.z));
      best = { t: tmin, point, normal, collider: c };
    }
    return best;
  }

  /** True if a straight segment between two points is unobstructed by level/door/prop geometry. */
  lineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.0001) return true;
    dir.divideScalar(dist);
    return this.raycast(from, dir, dist) === null;
  }
}

/** Ray vs a single free AABB (used for guard body/head boxes). Returns t or null. */
export function rayVsBox(origin: THREE.Vector3, dir: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3, maxDist: number): number | null {
  let tmin = (min.x - origin.x) / dir.x;
  let tmax = (max.x - origin.x) / dir.x;
  if (tmin > tmax) {
    const tmp = tmin;
    tmin = tmax;
    tmax = tmp;
  }
  let tymin = (min.y - origin.y) / dir.y;
  let tymax = (max.y - origin.y) / dir.y;
  if (tymin > tymax) {
    const tmp = tymin;
    tymin = tymax;
    tymax = tmp;
  }
  if (tmin > tymax || tymin > tmax) return null;
  if (tymin > tmin) tmin = tymin;
  if (tymax < tmax) tmax = tymax;
  let tzmin = (min.z - origin.z) / dir.z;
  let tzmax = (max.z - origin.z) / dir.z;
  if (tzmin > tzmax) {
    const tmp = tzmin;
    tzmin = tzmax;
    tzmax = tmp;
  }
  if (tmin > tzmax || tzmin > tmax) return null;
  if (tzmin > tmin) tmin = tzmin;
  if (tmin < 0 || tmin > maxDist) return null;
  return tmin;
}
