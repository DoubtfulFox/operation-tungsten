import * as THREE from "three";
import type { World } from "../world";
import { applyDestroyedLook, type Destructible } from "../level/LevelBuilder";

/**
 * Shared damage logic: explosions hit everything in radius (with a
 * cheap line-of-sight check so walls actually protect you), and
 * destructible props route to their mission consequences.
 */

export function explode(world: World, pos: THREE.Vector3, radius: number, maxDmg: number): void {
  world.effects.explosion(pos);
  world.sfx.explosion(pos);
  world.emitNoise(pos, 50);

  const apply = (targetPos: THREE.Vector3, cb: (dmg: number) => void): void => {
    const d = targetPos.distanceTo(pos);
    if (d > radius) return;
    if (d > 1.2 && !world.physics.lineOfSight(pos, targetPos)) return;
    const dmg = Math.round(maxDmg * (1 - (d / radius) * 0.85));
    if (dmg > 0) cb(dmg);
  };

  apply(world.player.pos, (dmg) => world.player.damage(dmg, world));
  for (const g of world.guards) {
    if (!g.alive) continue;
    apply(g.center(), (dmg) => g.hit(dmg, world, false, null));
  }
  for (const npc of world.npcs) {
    if (!npc.alive) continue;
    apply(npc.center(), (dmg) => npc.hit(dmg, world));
  }
  for (const d of world.level.destructibles.values()) {
    if (!d.alive) continue;
    const dist = d.pos.distanceTo(pos);
    if (dist < radius + d.radius) {
      damageDestructible(world, d, Math.round(maxDmg * (1 - Math.max(0, dist - d.radius) / radius)), true);
    }
  }
}

export function damageDestructible(world: World, d: Destructible, amount: number, explosive: boolean): void {
  if (!d.alive || amount <= 0) return;
  if (d.bulletImmune && !explosive) return;
  d.hp -= amount;
  if (d.hp > 0) return;

  d.alive = false;
  applyDestroyedLook(d);

  if (d.kind === "gastank") {
    // the big one — chains the lab into a fireball
    explode(world, d.pos.clone().setY(1.4), 10, 170);
  } else if (d.kind === "engine") {
    explode(world, d.pos.clone().setY(1.6), 9, 150);
  } else if (d.kind === "barrel") {
    // shootable fuel drum — modest blast, chains to nearby barrels via explode()'s destructible sweep
    explode(world, d.pos.clone().setY(0.6), 4.5, 80);
  } else if (d.kind === "mainframe") {
    world.effects.sparks(d.pos, new THREE.Vector3(0, 1, 0), 0x9fd2ff, 14);
    world.effects.smoke(d.pos, 10);
    world.sfx.explosion(d.pos);
    world.emitNoise(d.pos, 25);
  } else if (d.kind === "alarmpanel") {
    world.effects.sparks(d.pos, new THREE.Vector3(0, 1, 0), 0xffd080, 10);
    world.sfx.impact(d.pos);
    world.alarm.onPanelDestroyed(d.id);
  } else {
    // generic mission target (dish, generator, fuel bowsers, ...)
    world.effects.sparks(d.pos, new THREE.Vector3(0, 1, 0), 0xffc060, 12);
    world.effects.smoke(d.pos, 8);
    world.sfx.explosion(d.pos);
    world.emitNoise(d.pos, 30);
  }
  world.mission.onDestroyed(d.id);
}
