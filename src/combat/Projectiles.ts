import * as THREE from "three";
import type { World } from "../world";
import { explode } from "./Damage";
import { WEAPONS } from "../weapons/WeaponDefs";

interface AirGrenade {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
}

const grenadeMat = new THREE.MeshLambertMaterial({ color: 0x4a5238 });

/**
 * Shared in-flight grenade simulation — player throws and guard lobs
 * use the same physics, and friendly fire cuts both ways.
 */
export class Projectiles {
  private grenades: AirGrenade[] = [];

  spawnGrenade(world: World, pos: THREE.Vector3, vel: THREE.Vector3, fuse = 2.6): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), grenadeMat);
    mesh.position.copy(pos);
    world.scene.add(mesh);
    this.grenades.push({ mesh, pos: pos.clone(), vel: vel.clone(), fuse });
  }

  update(dt: number, world: World): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 13 * dt;
      const step = g.vel.length() * dt;
      if (step > 0.0001) {
        const dir = g.vel.clone().normalize();
        const hit = world.physics.raycast(g.pos, dir, step + 0.07);
        if (hit) {
          g.pos.copy(hit.point).addScaledVector(hit.normal, 0.08);
          const v = g.vel;
          const d = v.dot(hit.normal);
          v.addScaledVector(hit.normal, -2 * d).multiplyScalar(0.42);
          if (v.length() > 1.5) world.sfx.impact(g.pos);
        } else {
          g.pos.addScaledVector(dir, step);
        }
      }
      if (g.pos.y < 0.08 && g.vel.y < 0) {
        g.pos.y = 0.08;
        g.vel.y *= -0.42;
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
      }
      g.mesh.position.copy(g.pos);
      g.fuse -= dt;
      if (g.fuse <= 0) {
        world.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        explode(world, g.pos.clone(), 7, WEAPONS.grenade.damage);
      }
    }
  }
}
