import type { World } from "../world";
import { SLOT_GROUPS, WEAPONS } from "../weapons/WeaponDefs";
import { controlsHtml } from "./ControlsData";
import { MODIFIER_DEFS, type Modifiers } from "../core/Modifiers";

import type { Difficulty } from "../level/LevelTypes";

export interface Settings {
  sens: number;
  master: number;
  music: number;
  retro: boolean;
  aimAssist: boolean;
  difficulty: Difficulty;
}

type Tab = "objectives" | "gear" | "controls" | "mods" | "options";

/**
 * The pause menu IS the watch — GoldenEye style. Time freezes while
 * 007 checks his objectives, gear and options on the wrist LCD.
 */
export class WatchMenu {
  private el: HTMLDivElement;
  private tab: Tab = "objectives";
  private world: World | null = null;
  visible = false;

  constructor(
    private settings: Settings,
    private cbs: { onResume: () => void; onAbort: () => void; onSettings: () => void; onModifiers: () => void }
  ) {
    this.el = document.createElement("div");
    this.el.className = "watch-wrap hidden";
    document.getElementById("overlay")!.appendChild(this.el);
  }

  show(world: World): void {
    this.world = world;
    this.visible = true;
    this.el.classList.remove("hidden");
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.el.classList.add("hidden");
  }

  private render(): void {
    const w = this.world;
    if (!w) return;

    const secs = w.mission.elapsedSeconds();
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");

    this.el.innerHTML = `
      <div class="watch-strap"></div>
      <div class="watch-face">
        <div class="watch-screen">
          <div class="watch-tabs">
            <button class="watch-tab ${this.tab === "objectives" ? "active" : ""}" data-tab="objectives">OBJECTIVES</button>
            <button class="watch-tab ${this.tab === "gear" ? "active" : ""}" data-tab="gear">GEAR</button>
            <button class="watch-tab ${this.tab === "controls" ? "active" : ""}" data-tab="controls">CONTROLS</button>
            <button class="watch-tab ${this.tab === "mods" ? "active" : ""}" data-tab="mods">MODS</button>
            <button class="watch-tab ${this.tab === "options" ? "active" : ""}" data-tab="options">OPTIONS</button>
          </div>
          <div class="watch-content">${this.content(w)}</div>
        </div>
        <div class="watch-buttons">
          <button class="watch-btn" data-act="resume">RESUME</button>
          <button class="watch-btn" data-act="abort">ABORT MISSION</button>
        </div>
        <div class="watch-time">MISSION TIME ${mm}:${ss} — PAUSED</div>
      </div>`;

    for (const btn of this.el.querySelectorAll<HTMLButtonElement>(".watch-tab")) {
      btn.onclick = () => {
        this.tab = btn.dataset.tab as Tab;
        this.render();
      };
    }
    (this.el.querySelector('[data-act="resume"]') as HTMLButtonElement).onclick = () => this.cbs.onResume();
    (this.el.querySelector('[data-act="abort"]') as HTMLButtonElement).onclick = () => this.cbs.onAbort();

    if (this.tab === "options") this.bindOptions();
    if (this.tab === "mods") this.bindMods();
  }

  private bindMods(): void {
    const w = this.world;
    if (!w) return;
    for (const box of this.el.querySelectorAll<HTMLInputElement>("[data-mod]")) {
      box.onchange = () => {
        w.mods[box.dataset.mod as keyof Modifiers] = box.checked;
        this.cbs.onModifiers();
      };
    }
  }

  private content(w: World): string {
    if (this.tab === "objectives") {
      return w.mission.objectives
        .map((o) => {
          const cls = o.state === "done" ? "obj-done" : o.state === "failed" ? "obj-failed" : "obj-pending";
          const mark = o.state === "done" ? "▣" : o.state === "failed" ? "☒" : "□";
          const label = (o.required ? "" : "BONUS: ") + o.label;
          return `<div class="${cls}">${mark} ${label}</div>`;
        })
        .join("");
    }
    if (this.tab === "gear") {
      const ws = w.weapons;
      const rows: string[] = [];
      for (const id of SLOT_GROUPS.flatMap((g) => g.members)) {
        if (!ws.owned.has(id)) continue;
        const def = WEAPONS[id];
        let info = "";
        if (def.kind === "gun") info = `${ws.mags.get(id) ?? 0} | ${def.ammo ? ws.reserve[def.ammo] : 0}`;
        else if (def.kind === "melee") info = "—";
        else if (def.kind === "thrown") info = `x${ws.reserve.grenade}`;
        else if (def.kind === "mine") info = `x${ws.reserve.mine} (planted: ${ws.plantedMines.length})`;
        rows.push(`<div>[${def.slot}] ${def.name} — ${info}</div>`);
      }
      const cards: string[] = [];
      if (w.player.cards.has("lab")) cards.push("LAB KEYCARD");
      if (w.player.cards.has("officer")) cards.push("OFFICER KEYCARD");
      rows.push(`<div style="margin-top:10px">KEYCARDS: ${cards.length ? cards.join(", ") : "none"}</div>`);
      return rows.join("");
    }
    if (this.tab === "controls") {
      return controlsHtml();
    }
    if (this.tab === "mods") {
      return (
        `<div class="mods-hint">FIELD MODIFICATIONS — Q BRANCH DENIES EVERYTHING</div>` +
        MODIFIER_DEFS.map(
          (m) =>
            `<label><input type="checkbox" data-mod="${m.id}" ${w.mods[m.id] ? "checked" : ""}> ${m.label}` +
            `<span class="mod-hint"> — ${m.hint}</span></label>`
        ).join("")
      );
    }
    const s = this.settings;
    return `
      <label>MOUSE SENSITIVITY <input type="range" id="opt-sens" min="0.4" max="2.5" step="0.05" value="${s.sens}"></label>
      <label>MASTER VOLUME <input type="range" id="opt-master" min="0" max="1" step="0.05" value="${s.master}"></label>
      <label>MUSIC VOLUME <input type="range" id="opt-music" min="0" max="1" step="0.05" value="${s.music}"></label>
      <label style="margin-top:14px"><input type="checkbox" id="opt-retro" ${s.retro ? "checked" : ""}> 240p RETRO MODE</label>
      <label><input type="checkbox" id="opt-assist" ${s.aimAssist ? "checked" : ""}> GOLDENEYE AIM ASSIST</label>`;
  }

  private bindOptions(): void {
    const sens = this.el.querySelector<HTMLInputElement>("#opt-sens")!;
    const master = this.el.querySelector<HTMLInputElement>("#opt-master")!;
    const music = this.el.querySelector<HTMLInputElement>("#opt-music")!;
    const retro = this.el.querySelector<HTMLInputElement>("#opt-retro")!;
    sens.oninput = () => {
      this.settings.sens = parseFloat(sens.value);
      this.cbs.onSettings();
    };
    master.oninput = () => {
      this.settings.master = parseFloat(master.value);
      this.cbs.onSettings();
    };
    music.oninput = () => {
      this.settings.music = parseFloat(music.value);
      this.cbs.onSettings();
    };
    retro.onchange = () => {
      this.settings.retro = retro.checked;
      this.cbs.onSettings();
    };
    const assist = this.el.querySelector<HTMLInputElement>("#opt-assist")!;
    assist.onchange = () => {
      this.settings.aimAssist = assist.checked;
      this.cbs.onSettings();
    };
  }
}
