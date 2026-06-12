import type { World } from "../world";
import { SLOT_GROUPS, WEAPONS } from "../weapons/WeaponDefs";

/**
 * In-game DOM overlay: health/armor bars, weapon hotbar, ammo, keycards,
 * toasts, interact prompt, damage vignette, scope + camera viewfinder.
 */
export class HUD {
  private root = document.getElementById("hud")!;
  private healthFill!: HTMLElement;
  private armorFill!: HTMLElement;
  private hotCells: HTMLElement[] = [];
  private hotState = "";
  private ammoName!: HTMLElement;
  private ammoCount!: HTMLElement;
  private ammoHint!: HTMLElement;
  private keys!: HTMLElement;
  private toasts!: HTMLElement;
  private prompt!: HTMLElement;
  private vignette!: HTMLElement;
  private flash!: HTMLElement;
  private scope!: HTMLElement;
  private viewfinder!: HTMLElement;
  private alarmEl!: HTMLElement;
  private crosshair!: HTMLElement;

  constructor(world: World) {
    this.root.innerHTML = `
      <div class="crosshair">
        <div class="ch-dot"></div>
        <div class="ch-bar ch-t"></div>
        <div class="ch-bar ch-b"></div>
        <div class="ch-bar ch-l"></div>
        <div class="ch-bar ch-r"></div>
      </div>
      <div class="hud-bars">
        <div class="hud-bar-row"><span class="hud-bar-label">HEALTH</span><div class="hud-bar-track"><div class="hud-bar-fill" id="hp-fill"></div></div></div>
        <div class="hud-bar-row"><span class="hud-bar-label">ARMOR</span><div class="hud-bar-track"><div class="hud-bar-fill armor" id="ap-fill"></div></div></div>
      </div>
      <div class="hud-alarm">⚠ ALARM ⚠</div>
      <div class="hud-hotbar"></div>
      <div class="hud-ammo">
        <div class="wname"></div>
        <div class="count"></div>
        <div class="hint"></div>
      </div>
      <div class="hud-keys"></div>
      <div class="hud-toasts"></div>
      <div class="hud-prompt"></div>
      <div id="damage-vignette"></div>
      <div id="photo-flash"></div>
      <div class="scope-overlay"></div>
      <div class="viewfinder">
        <div class="corner tl"></div><div class="corner tr"></div>
        <div class="corner bl"></div><div class="corner br"></div>
        <div class="vf-label">FIELD CAMERA — LMB CAPTURE</div>
      </div>`;

    this.healthFill = this.root.querySelector("#hp-fill")!;
    this.armorFill = this.root.querySelector("#ap-fill")!;
    this.ammoName = this.root.querySelector(".wname")!;
    this.ammoCount = this.root.querySelector(".count")!;
    this.ammoHint = this.root.querySelector(".hint")!;
    this.keys = this.root.querySelector(".hud-keys")!;
    this.toasts = this.root.querySelector(".hud-toasts")!;
    this.prompt = this.root.querySelector(".hud-prompt")!;
    this.vignette = this.root.querySelector("#damage-vignette")!;
    this.flash = this.root.querySelector("#photo-flash")!;
    this.scope = this.root.querySelector(".scope-overlay")!;
    this.viewfinder = this.root.querySelector(".viewfinder")!;
    this.alarmEl = this.root.querySelector(".hud-alarm")!;
    this.crosshair = this.root.querySelector(".crosshair")!;

    const hotbar = this.root.querySelector(".hud-hotbar")!;
    for (const g of SLOT_GROUPS) {
      const cell = document.createElement("div");
      cell.className = "hot-cell unowned";
      cell.innerHTML = `<span class="hot-key">${g.key}</span><span class="hot-name">${g.label}</span><span class="hot-pips"></span>`;
      hotbar.appendChild(cell);
      this.hotCells.push(cell);
    }

    world.events.on("toast", ({ text }) => this.toast(text));
    world.events.on("objectiveComplete", ({ text }) => this.toast("OBJECTIVE COMPLETE — " + text, "objective"));
    world.events.on("objectiveFailed", ({ text }) => this.toast("OBJECTIVE FAILED — " + text, "failed"));
    world.events.on("playerDamaged", () => this.damageFlash());
    world.events.on("alarm", ({ active }) => {
      this.alarmEl.style.display = active ? "block" : "none";
      if (active) this.toast("ALARM RAISED — REINFORCEMENTS INBOUND", "failed");
    });
  }

  setVisible(on: boolean): void {
    this.root.style.display = on ? "block" : "none";
  }

  toast(text: string, kind: "" | "objective" | "failed" = ""): void {
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.removeChild(this.toasts.firstChild!);
    window.setTimeout(() => {
      el.style.opacity = "0";
      window.setTimeout(() => el.remove(), 600);
    }, 3400);
  }

  setPrompt(text: string | null): void {
    if (text) {
      this.prompt.textContent = text;
      this.prompt.style.display = "block";
    } else {
      this.prompt.style.display = "none";
    }
  }

  damageFlash(): void {
    this.vignette.style.transition = "none";
    this.vignette.style.opacity = "0.85";
    requestAnimationFrame(() => {
      this.vignette.style.transition = "opacity 0.45s";
      this.vignette.style.opacity = "0";
    });
  }

  photoFlash(): void {
    this.flash.style.transition = "none";
    this.flash.style.opacity = "0.9";
    requestAnimationFrame(() => {
      this.flash.style.transition = "opacity 0.3s";
      this.flash.style.opacity = "0";
    });
  }

  /** Brief crosshair flash on a confirmed hit. */
  hitPulse(): void {
    this.crosshair.classList.add("hit");
    window.setTimeout(() => this.crosshair.classList.remove("hit"), 130);
  }

  update(world: World): void {
    const p = world.player;
    this.healthFill.style.width = Math.max(0, p.health) + "%";
    this.armorFill.style.width = Math.max(0, p.armor) + "%";

    const ws = world.weapons;
    const def = ws.def();

    // hotbar — only touch the DOM when selection or ownership changes
    const hotKey = def.id + "|" + ws.owned.size + "|" + (world.mods.allGuns ? 1 : 0);
    if (hotKey !== this.hotState) {
      this.hotState = hotKey;
      SLOT_GROUPS.forEach((g, i) => {
        const cell = this.hotCells[i];
        const ownedMembers = g.members.filter((m) => ws.isOwned(m));
        const active = g.members.includes(def.id);
        cell.classList.toggle("active", active);
        cell.classList.toggle("unowned", ownedMembers.length === 0);
        const showId = active ? def.id : ownedMembers[0];
        cell.querySelector<HTMLElement>(".hot-name")!.textContent = showId ? WEAPONS[showId].short : g.label;
        // pips hint there is more in this group to cycle to with the same key
        cell.querySelector<HTMLElement>(".hot-pips")!.textContent = ownedMembers.length > 1 ? "·".repeat(ownedMembers.length) : "";
      });
    }

    this.ammoName.textContent = def.name;
    if (def.kind === "gun") {
      this.ammoCount.textContent = ws.reloading ? "··· | " + ws.reserveAmmo() : `${ws.magAmmo()} | ${ws.reserveAmmo()}`;
      this.ammoHint.textContent = def.zoomFov > 0 ? "RMB SCOPE" : "";
    } else if (def.kind === "melee") {
      this.ammoCount.textContent = "—";
      this.ammoHint.textContent = "LMB STRIKE · SILENT FROM BEHIND";
    } else if (def.kind === "thrown") {
      this.ammoCount.textContent = String(ws.reserve.grenade);
      this.ammoHint.textContent = "LMB THROW";
    } else if (def.kind === "mine") {
      this.ammoCount.textContent = String(ws.reserve.mine);
      this.ammoHint.textContent = `PLANTED: ${ws.plantedMines.length} · LMB PLANT · RMB DETONATE`;
    } else {
      this.ammoCount.textContent = "▣";
      this.ammoHint.textContent = "LMB CAPTURE · RMB ZOOM";
    }

    this.keys.innerHTML = "";
    if (p.cards.has("lab")) this.keys.innerHTML += `<span class="keychip lab">LAB KEY</span>`;
    if (p.cards.has("officer")) this.keys.innerHTML += `<span class="keychip officer">OFFICER KEY</span>`;

    const scopeOn = ws.aiming && def.zoomFov > 0 && def.kind === "gun";
    const vfOn = def.id === "camera";
    this.scope.style.display = scopeOn ? "block" : "none";
    this.viewfinder.style.display = vfOn ? "block" : "none";
    this.crosshair.style.display = scopeOn || vfOn ? "none" : "block";

    // dynamic crosshair: bars spread with the live bullet-cone
    if (!scopeOn && !vfOn) {
      const fovRad = (world.camera.fov * Math.PI) / 180;
      const px = (Math.tan(ws.visualSpread) / Math.tan(fovRad / 2)) * (window.innerHeight / 2);
      const gap = Math.min(70, 4 + px);
      const t = this.crosshair.querySelector<HTMLElement>(".ch-t")!;
      const b = this.crosshair.querySelector<HTMLElement>(".ch-b")!;
      const l = this.crosshair.querySelector<HTMLElement>(".ch-l")!;
      const r = this.crosshair.querySelector<HTMLElement>(".ch-r")!;
      t.style.transform = `translate(-1px, ${-gap - 7}px)`;
      b.style.transform = `translate(-1px, ${gap}px)`;
      l.style.transform = `translate(${-gap - 7}px, -1px)`;
      r.style.transform = `translate(${gap}px, -1px)`;
    }
  }
}
