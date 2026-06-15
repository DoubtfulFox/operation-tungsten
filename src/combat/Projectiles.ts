import * as THREE from "three";
import type { World } from "../world";
import { explode } from "./Damage";
import { WEAPONS } from "../weapons/WeaponDefs";
import type { RayHit } from "../core/Physics";

interface AirGrenade {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
}

interface AirMine {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** safety timeout so a mine that somehow never lands still arms */
  life: number;
  onStick: (pos: THREE.Vector3, normal: THREE.Vector3, hit: RayHit | null) => void;
}

const grenadeMat = new THREE.MeshLambertMaterial({ color: 0x4a5238 });

/**
 * Shared in-flight grenade simulation — player throws and guard lobs
 * use the same physics, and friendly fire cuts both ways.
 */
export class Projectiles {
  private grenades: AirGrenade[] = [];
  private mines: AirMine[] = [];

  spawnGrenade(world: World, pos: THREE.Vector3, vel: THREE.Vector3, fuse = 2.6): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), grenadeMat);
    mesh.position.copy(pos);
    world.scene.add(mesh);
    this.grenades.push({ mesh, pos: pos.clone(), vel: vel.clone(), fuse });
  }

  /**
   * A thrown mine: same arc as a grenade, but it stops dead on first
   * contact and hands off to onStick (which arms it as a remote charge).
   */
  spawnStickyMine(
    world: World,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    mesh: THREE.Group,
    onStick: (pos: THREE.Vector3, normal: THREE.Vector3, hit: RayHit | null) => void
  ): void {
    mesh.position.copy(pos);
    world.scene.add(mesh);
    this.mines.push({ mesh, pos: pos.clone(), vel: vel.clone(), life: 6, onStick });
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

    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.vel.y -= 13 * dt;
      const step = m.vel.length() * dt;
      let stick: { pos: THREE.Vector3; normal: THREE.Vector3; hit: RayHit | null } | null = null;
      if (step > 0.0001) {
        const dir = m.vel.clone().normalize();
        const hit = world.physics.raycast(m.pos, dir, step + 0.07);
        if (hit) stick = { pos: hit.point.clone(), normal: hit.normal.clone(), hit };
        else m.pos.addScaledVector(dir, step);
      }
      // settle onto the ground if it skims along just above it
      if (!stick && m.pos.y < 0.08 && m.vel.y < 0) {
        stick = { pos: m.pos.clone().setY(0.04), normal: new THREE.Vector3(0, 1, 0), hit: null };
      }
      m.life -= dt;
      if (!stick && m.life <= 0) {
        stick = { pos: m.pos.clone(), normal: new THREE.Vector3(0, 1, 0), hit: null };
      }
      if (stick) {
        this.mines.splice(i, 1);
        m.onStick(stick.pos, stick.normal, stick.hit);
      } else {
        m.mesh.position.copy(m.pos);
      }
    }
  }
}
