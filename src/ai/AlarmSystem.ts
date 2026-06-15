import * as THREE from "three";
import type { World } from "../world";
import type { Destructible } from "../level/LevelBuilder";
import type { LevelDef } from "../level/LevelTypes";
import { Guard } from "./Guard";

/**
 * Facility alarm: klaxon + strobing red corridor lights + waves of
 * reinforcements that actively hunt the player. Triggered by guards who
 * reach a wall panel — shoot the panels (or the runners) to stay quiet.
 */
export class AlarmSystem {
  active = false;

  private timer = 0;
  private spawnTimer = 0;
  private spawnedThisAlarm = 0;
  private panelCells = new Map<string, [number, number]>();
  private spawns: Array<[number, number]>;
  /** rotating flank bearing so waves arrive from different directions */
  private flankIdx = 0;
  /** gate ids that latch open on alarm, each releasing its dormant guard group */
  private alarmGateIds: string[];

  constructor(def: LevelDef) {
    for (const ap of def.alarmPanels) this.panelCells.set(ap.id, [ap.cx, ap.cz]);
    this.spawns = def.reinforcementSpawns;
    this.alarmGateIds = (def.gates ?? []).filter((g) => g.openOnAlarm).map((g) => g.id);
  }

  nearestPanel(world: World, pos: THREE.Vector3): { panel: Destructible; cell: [number, number] } | null {
    let best: { panel: Destructible; cell: [number, number] } | null = null;
    let bestD = Infinity;
    for (const d of world.level.destructibles.values()) {
      if (d.kind !== "alarmpanel" || !d.alive) continue;
      const cell = this.panelCells.get(d.id);
      if (!cell) continue;
      const dist = d.pos.distanceTo(pos);
      if (dist < bestD) {
        bestD = dist;
        best = { panel: d, cell };
      }
    }
    return best;
  }

  onPanelDestroyed(_id: string): void {
    // nothing extra: guards re-check panel liveness themselves
  }

  /** `scripted` alarms (escape sequences) don't void the no-alarm bonus. */
  trigger(world: World, scripted = false): void {
    if (this.active) return;
    this.active = true;
    this.timer = 50;
    this.spawnTimer = 1.2;
    this.spawnedThisAlarm = 0;
    world.sfx.alarmStart();
    world.events.emit("alarm", { active: true });
    if (!scripted) world.mission.onAlarm();

    // blast the reserve doors open and deploy the dormant squad behind each
    for (const id of this.alarmGateIds) {
      world.level.gates.get(id)?.latchOpen();
      for (const g of world.guards) {
        if (g.dormant && g.releaseGroup === id) g.release(world);
      }
    }
  }

  update(dt: number, world: World): void {
    if (!this.active) return;
    this.timer -= dt;

    const pulse = (Math.sin(world.time * 7) * 0.5 + 0.5) * 11;
    for (const l of world.level.alarmLights) l.intensity = pulse;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6.5;
      const aliveHunters = world.guards.filter((g) => g.hunter && g.alive).length;
      if (this.spawnedThisAlarm < 8 && aliveHunters < 5) {
        this.spawnReinforcement(world);
      }
    }

    if (this.timer <= 0) {
      this.active = false;
      world.sfx.alarmStop();
      world.events.emit("alarm", { active: false });
      for (const l of world.level.alarmLights) l.intensity = 0;
    }
  }

  private spawnReinforcement(world: World): void {
    // prefer a spawn point the player can't see and isn't standing on
    let bestSpawn: [number, number] | null = null;
    let bestD = -1;
    for (const [cx, cz] of this.spawns) {
      const p = new THREE.Vector3(cx * 2 + 1, 1, cz * 2 + 1);
      const d = p.distanceTo(world.player.pos);
      if (d > 14 && d > bestD) {
        bestD = d;
        bestSpawn = [cx, cz];
      }
    }
    if (!bestSpawn) bestSpawn = this.spawns[0];
    const g = new Guard(world, { kind: "guard", cx: bestSpawn[0], cz: bestSpawn[1], route: [] });

    // assign a flank bearing: approach via a point offset to the player's
    // side instead of beelining, so waves come from multiple corridors
    const bearings: Array<[number, number]> = [
      [0, -6],
      [6, 0],
      [0, 6],
      [-6, 0]
    ];
    const [bx, bz] = bearings[this.flankIdx++ % bearings.length];
    const [pcx, pcz] = [Math.floor(world.player.pos.x / 2), Math.floor(world.player.pos.z / 2)];
    let via: THREE.Vector3 | null = null;
    if (world.level.nav.isFree(pcx + bx, pcz + bz)) {
      via = new THREE.Vector3((pcx + bx) * 2 + 1, 1, (pcz + bz) * 2 + 1);
    } else {
      via = world.level.nav.randomNearby(new THREE.Vector3((pcx + bx) * 2 + 1, 1, (pcz + bz) * 2 + 1), 3);
    }
    g.startHunting(world, via ?? undefined);
    world.guards.push(g);
    this.spawnedThisAlarm++;
  }
}
