import type { World } from "../world";
import type { MissionStats, PickupType } from "../types";
import { DIFFICULTY_ORDER, type Difficulty, type ObjectiveDef } from "../level/LevelTypes";
import { NavGrid } from "../ai/Nav";

export interface Objective {
  id: string;
  label: string;
  required: boolean;
  state: "pending" | "done" | "failed";
  def: ObjectiveDef;
}

export type MissionOutcome = "playing" | "won" | "lost";

/**
 * Data-driven objective tracking: the active list comes from the level
 * definition filtered by difficulty. Required objectives gate
 * extraction; bonus objectives feed the debrief rating.
 */
export class MissionSystem {
  objectives: Objective[];

  stats: MissionStats = {
    shotsFired: 0,
    shotsHit: 0,
    kills: 0,
    alarmsTriggered: 0,
    startTime: 0,
    endTime: 0
  };

  outcome: MissionOutcome = "playing";
  failReason = "";
  difficulty: Difficulty;

  private freedNpcs = new Set<string>();
  private destroyed = new Set<string>();
  private minesAttached = new Set<string>();
  private extractHintT = 0;
  /** countdown once an escape sequence is armed (-1 = not armed) */
  private escapeT = -1;

  constructor(
    private world: World,
    defs: ObjectiveDef[],
    difficulty: Difficulty
  ) {
    this.difficulty = difficulty;
    const rank = DIFFICULTY_ORDER.indexOf(difficulty);
    const atLeast = (d: Difficulty | undefined): boolean => !d || rank >= DIFFICULTY_ORDER.indexOf(d);
    this.objectives = defs
      .filter((o) => atLeast(o.minDifficulty))
      .map((o) => ({
        id: o.id,
        label: o.label,
        required: o.requiredAt ? atLeast(o.requiredAt) : !o.bonus,
        state: "pending" as const,
        def: o
      }));
    this.stats.startTime = performance.now();
  }

  get(id: string): Objective | undefined {
    return this.objectives.find((o) => o.id === id);
  }

  complete(id: string): void {
    const o = this.get(id);
    if (!o || o.state !== "pending") return;
    o.state = "done";
    this.world.sfx.objective();
    this.world.events.emit("objectiveComplete", { id, text: o.label });

    // timed escapes arm when their tripwire objective completes
    const esc = this.world.level.def.escape;
    if (esc && esc.afterObjective === id && this.escapeT < 0) {
      this.escapeT = esc.seconds;
      this.world.alarm.trigger(this.world, true);
      this.world.events.emit("toast", { text: `GET OUT — ${Math.round(esc.seconds)} SECONDS TO EXTRACTION` });
    }
  }

  fail(id: string): void {
    const o = this.get(id);
    if (!o || o.state !== "pending") return;
    o.state = "failed";
    this.world.sfx.objectiveFailed();
    this.world.events.emit("objectiveFailed", { id, text: o.label });
  }

  allRequiredDone(): boolean {
    return this.objectives.filter((o) => o.required && o.def.trigger.kind !== "extract").every((o) => o.state === "done");
  }

  // ---- generic trigger handlers -------------------------------------------

  /** Called every frame with the player's current region name. */
  onRegionEntered(region: string): void {
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "enterRegion" && o.def.trigger.region === region) {
        this.complete(o.id);
      }
    }
  }

  /** Called whenever any destructible dies. */
  onDestroyed(id: string): void {
    this.destroyed.add(id);
    for (const o of this.objectives) {
      const t = o.def.trigger;
      if (o.state !== "pending" || t.kind !== "destroyAll" || !t.ids.includes(id)) continue;
      const done = t.ids.filter((i) => this.destroyed.has(i)).length;
      if (done >= t.ids.length) this.complete(o.id);
      else this.world.events.emit("toast", { text: `${o.label} (${done}/${t.ids.length})` });
    }
  }

  onNpcFreed(id: string): void {
    this.freedNpcs.add(id);
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "freeNpc" && o.def.trigger.npcId === id) {
        this.complete(o.id);
      }
    }
  }

  onNpcKilled(id: string): void {
    if (!this.freedNpcs.has(id)) {
      // killed while still captive: a pending free-objective is now impossible
      for (const o of this.objectives) {
        if (o.state === "pending" && o.def.trigger.kind === "freeNpc" && o.def.trigger.npcId === id) {
          this.fail(o.id);
          const ndef = this.world.level.def.npcs?.find((n) => n.id === id);
          this.missionFail(ndef?.killFailReason ?? "A critical contact was killed.");
        }
      }
    }
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "npcSurvives" && o.def.trigger.npcId === id) {
        this.fail(o.id);
      }
    }
  }

  onPhoto(targetId: string): void {
    for (const o of this.objectives) {
      if (o.def.trigger.kind !== "photo" || o.def.trigger.targetId !== targetId) continue;
      if (o.state === "done") {
        this.world.events.emit("toast", { text: "Already photographed. M only needs one copy." });
      } else {
        this.complete(o.id);
      }
    }
  }

  /** Called for every collected pickup. */
  onPickup(type: PickupType): void {
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "pickup" && o.def.trigger.pickupType === type) {
        this.complete(o.id);
      }
    }
  }

  /** Level scripts (escape timers etc) raise these by id. */
  onCustom(eventId: string): void {
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "custom" && o.def.trigger.eventId === eventId) {
        this.complete(o.id);
      }
    }
  }

  onMineAttached(targetId: string): void {
    if (this.minesAttached.has(targetId)) return;
    this.minesAttached.add(targetId);
    // total comes from the destroyAll objective this target belongs to
    const o = this.objectives.find((x) => x.def.trigger.kind === "destroyAll" && x.def.trigger.ids.includes(targetId));
    const total = o && o.def.trigger.kind === "destroyAll" ? o.def.trigger.ids.length : 2;
    const n = this.minesAttached.size;
    this.world.events.emit("toast", {
      text: n >= total ? "Charges set on all targets. Get clear, then detonate (RMB)." : `Charge set (${n}/${total}).`
    });
  }

  onAlarm(): void {
    this.stats.alarmsTriggered++;
    for (const o of this.objectives) {
      if (o.state === "pending" && o.def.trigger.kind === "noAlarm") this.fail(o.id);
    }
  }

  missionFail(reason: string): void {
    if (this.outcome !== "playing") return;
    this.outcome = "lost";
    this.failReason = reason;
    this.stats.endTime = performance.now();
    this.world.events.emit("missionFailed", { reason });
  }

  update(dt: number): void {
    if (this.outcome !== "playing") return;

    // escape countdown
    if (this.escapeT > 0) {
      const before = Math.ceil(this.escapeT);
      this.escapeT -= dt;
      const now = Math.ceil(this.escapeT);
      if (now !== before && (now % 15 === 0 || now <= 5) && now > 0) {
        this.world.events.emit("toast", { text: `EXTRACTION WINDOW: ${now} SECONDS` });
      }
      if (this.escapeT <= 0) {
        this.missionFail(this.world.level.def.escape?.failReason ?? "You missed the extraction window.");
        return;
      }
    }

    const zone = this.world.level.def.extraction;
    const [cx, cz] = NavGrid.toCell(this.world.player.pos);
    const inZone = cx >= zone.x0 && cx <= zone.x1 && cz >= zone.z0 && cz <= zone.z1;
    if (!inZone) return;

    if (this.allRequiredDone()) {
      for (const o of this.objectives) {
        if (o.def.trigger.kind === "extract") this.complete(o.id);
      }
      // settle remaining side objectives
      for (const o of this.objectives) {
        if (o.state !== "pending") continue;
        const t = o.def.trigger;
        if (t.kind === "noAlarm") this.complete(o.id);
        if (t.kind === "npcSurvives" && this.freedNpcs.has(t.npcId)) {
          const npc = this.world.npcs.find((n) => n.id === (t as { npcId: string }).npcId);
          if (npc && npc.alive) this.complete(o.id);
        }
      }
      this.outcome = "won";
      this.stats.endTime = performance.now();
    } else {
      this.extractHintT -= dt;
      if (this.extractHintT <= 0) {
        this.extractHintT = 6;
        this.world.events.emit("toast", { text: "Objectives incomplete — check your watch (TAB)." });
      }
    }
  }

  // ---- debrief -----------------------------------------------------------

  accuracy(): number {
    return this.stats.shotsFired > 0 ? Math.round((this.stats.shotsHit / this.stats.shotsFired) * 100) : 0;
  }

  elapsedSeconds(): number {
    const end = this.stats.endTime || performance.now();
    return Math.floor((end - this.stats.startTime) / 1000);
  }

  rating(): string {
    if (this.outcome !== "won") return "MISSION FAILED";
    const bonus = this.objectives.filter((o) => !o.required);
    const done = bonus.filter((o) => o.state === "done").length;
    if (bonus.length > 0 && done >= bonus.length) return "00 AGENT";
    if (done >= bonus.length / 2 && done > 0) return "SECRET AGENT";
    return "AGENT";
  }
}
