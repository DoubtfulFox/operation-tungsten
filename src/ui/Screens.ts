import type { MissionSystem } from "../mission/MissionSystem";
import type { Difficulty, LevelDef } from "../level/LevelTypes";
import type { BestEntry } from "../core/SaveData";
import { DIFFICULTIES } from "../core/Difficulty";
import { mountKeyBindings } from "./KeyBindUI";
import type { Input } from "../core/Input";
import type { Sfx } from "../audio/Sfx";

export interface MissionEntry {
  def: LevelDef;
  locked: boolean;
  best?: BestEntry;
}

/** Main menu, mission briefing and debrief screens. */
export class Screens {
  private overlay = document.getElementById("overlay")!;

  constructor(private sfx: Sfx) {}

  clear(): void {
    // the watch menu lives in the overlay too — only remove screens
    for (const el of [...this.overlay.querySelectorAll(".screen")]) el.remove();
  }

  private mount(html: string): HTMLDivElement {
    this.clear();
    const el = document.createElement("div");
    el.className = "screen";
    el.innerHTML = html;
    this.overlay.appendChild(el);
    this.armShots(el);
    return el;
  }

  /** Menu surfaces read like a gun sight: a click fires a shot and leaves a hole. */
  private armShots(el: HTMLDivElement): void {
    el.addEventListener("mousedown", (e) => {
      const me = e as MouseEvent;
      // leave control rebinding alone — mouse-button binds are captured in there
      if ((me.target as HTMLElement).closest(".controls-box")) return;
      const hole = document.createElement("div");
      hole.className = "menu-bullet";
      hole.style.left = me.clientX + "px";
      hole.style.top = me.clientY + "px";
      el.appendChild(hole);
      window.setTimeout(() => hole.remove(), 1500);
      this.sfx.ensure();
      this.sfx.shot("dd4");
    });
  }

  showMenu(missions: MissionEntry[], input: Input, onStart: (id: string) => void): void {
    const rows = missions
      .map((m, i) => {
        const best = m.best ? `<span class="mission-best">${m.best.rating}</span>` : "";
        return m.locked
          ? `<button class="btn mission-btn locked" disabled>${i + 1}. ${m.def.name} — [ LOCKED ]</button>`
          : `<button class="btn mission-btn" data-level="${m.def.id}">${i + 1}. ${m.def.name}${best}</button>`;
      })
      .join("");
    const el = this.mount(`
      <div class="title">OPERATION TUNGSTEN</div>
      <div class="subtitle">A 1997-STYLE COVERT OPS MISSION · UNOFFICIAL TRIBUTE</div>
      <div class="mission-list">${rows}</div>
      <button class="btn" data-level="wtest">⚙ WEAPON TEST RANGE</button>
      <button class="btn" data-act="controls">CONTROLS</button>
      <div class="controls-box hidden"></div>
    `);
    const controlsBox = el.querySelector<HTMLDivElement>(".controls-box")!;
    mountKeyBindings(controlsBox, input);
    for (const btn of el.querySelectorAll<HTMLButtonElement>("[data-level]")) {
      btn.onclick = () => onStart(btn.dataset.level!);
    }
    (el.querySelector('[data-act="controls"]') as HTMLButtonElement).onclick = () => controlsBox.classList.toggle("hidden");
  }

  showBriefing(
    def: LevelDef,
    mission: MissionSystem,
    onBegin: () => void,
    diff: { current: Difficulty; onSelect: (d: Difficulty) => void }
  ): void {
    const required = mission.objectives.filter((o) => o.required);
    const bonus = mission.objectives.filter((o) => !o.required);
    const bullets = required.map((o) => `<li>${o.label}</li>`).join("");
    const bonusLine =
      bonus.length > 0 ? `<ul><li class="bonus">Bonus: ${bonus.map((o) => o.label.toLowerCase()).join(" · ")}</li></ul>` : "";
    const paragraphs = def.briefing.paragraphs.map((p) => `<p style="margin-top:10px">${p}</p>`).join("");
    const diffBtns = DIFFICULTIES.map(
      (d) => `<button class="diff-btn ${d.id === diff.current ? "active" : ""}" data-diff="${d.id}">${d.label}</button>`
    ).join("");

    const el = this.mount(`
      <div class="memo">
        <div class="stamp">FOR YOUR EYES ONLY</div>
        <h2>MISSION BRIEFING — OPERATION TUNGSTEN</h2>
        <p>TO: 007 &nbsp;&nbsp; FROM: M &nbsp;&nbsp; RE: ${def.briefing.re}</p>
        ${paragraphs}
        <ul>${bullets}</ul>
        ${bonusLine}
        <p>${def.briefing.outro}</p>
        <p class="sig">— M</p>
      </div>
      <div class="diff-row">${diffBtns}</div>
      <button class="btn" style="margin-top:14px" data-act="begin">BEGIN MISSION</button>
    `);
    for (const btn of el.querySelectorAll<HTMLButtonElement>("[data-diff]")) {
      btn.onclick = () => diff.onSelect(btn.dataset.diff as Difficulty);
    }
    (el.querySelector('[data-act="begin"]') as HTMLButtonElement).onclick = onBegin;
  }

  showDebrief(mission: MissionSystem, onRetry: () => void, onMenu: () => void, onNext?: () => void): void {
    const won = mission.outcome === "won";
    const awards = won ? mission.awards() : [];
    const secs = mission.elapsedSeconds();
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");

    const rows = mission.objectives
      .map((o) => {
        const cls = o.state === "done" ? "done" : o.state === "failed" ? "failed" : "pending";
        const mark = o.state === "done" ? "COMPLETED" : o.state === "failed" ? "FAILED" : "INCOMPLETE";
        const label = (o.required ? "" : "BONUS: ") + o.label;
        return `<div class="row"><span>${label}</span><span class="${cls}">${mark}</span></div>`;
      })
      .join("");

    const el = this.mount(`
      <div class="debrief-result ${won ? "won" : "lost"}">${won ? "MISSION ACCOMPLISHED" : "MISSION FAILED"}</div>
      ${won ? "" : `<div class="debrief-reason">${mission.failReason}</div>`}
      <div class="debrief-list">${rows}</div>
      <div class="debrief-stats">
        <span>TIME <b>${mm}:${ss}</b></span>
        <span>KILLS <b>${mission.stats.kills}</b></span>
        <span>ACCURACY <b>${mission.accuracy()}%</b></span>
        <span>ALARMS <b>${mission.stats.alarmsTriggered}</b></span>
      </div>
      ${won ? `<div class="debrief-rating">RATING: ${mission.rating()}</div>` : ""}
      ${awards.length ? `<div class="debrief-awards">${awards.map((a) => `<span class="award" title="${a.desc}">${a.name}</span>`).join("")}</div>` : ""}
      ${won && onNext ? `<button class="btn" data-act="next">NEXT MISSION</button>` : ""}
      <button class="btn" data-act="retry">${won ? "PLAY AGAIN" : "RETRY MISSION"}</button>
      <button class="btn" data-act="menu">MAIN MENU</button>
    `);
    if (won && onNext) (el.querySelector('[data-act="next"]') as HTMLButtonElement).onclick = onNext;
    (el.querySelector('[data-act="retry"]') as HTMLButtonElement).onclick = onRetry;
    (el.querySelector('[data-act="menu"]') as HTMLButtonElement).onclick = onMenu;
  }
}
