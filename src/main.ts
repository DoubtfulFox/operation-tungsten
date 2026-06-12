import "./style.css";
import * as THREE from "three";
import { RetroRenderer } from "./core/RetroRenderer";
import { Input } from "./core/Input";
import { Sfx } from "./audio/Sfx";
import { Music, type MusicIntensity } from "./audio/Music";
import { World } from "./world";
import { buildLevel } from "./level/LevelBuilder";
import { Player } from "./player/Player";
import { WeaponSystem } from "./weapons/WeaponSystem";
import { Effects } from "./fx/Effects";
import { Projectiles } from "./combat/Projectiles";
import { Guard } from "./ai/Guard";
import { loadCharacterAssets } from "./ai/CharacterRig";
import { AlarmSystem } from "./ai/AlarmSystem";
import { Scientist } from "./npc/Scientist";
import { MissionSystem } from "./mission/MissionSystem";
import { HUD } from "./ui/HUD";
import { WatchMenu, type Settings } from "./ui/WatchMenu";
import { Screens } from "./ui/Screens";
import { GameState, type PickupType } from "./types";
import { defaultModifiers } from "./core/Modifiers";
import { LEVELS, levelById, nextLevelId } from "./level/levels";
import { loadCampaign, recordWin } from "./core/SaveData";
import { difficultyById } from "./core/Difficulty";
import type { Difficulty } from "./level/LevelTypes";
import { NavGrid } from "./ai/Nav";
import type { Door } from "./level/Door";

const SETTINGS_KEY = "tungsten-settings";

class Game {
  private state = GameState.Menu;
  private renderer: RetroRenderer;
  private input: Input;
  private sfx = new Sfx();
  private music = new Music(this.sfx);
  private musicLevel: MusicIntensity = "stealth";
  private musicDownT = 0;
  private screens = new Screens();
  private watch: WatchMenu;
  private world: World | null = null;
  private settings: Settings;
  /** cheat toggles — survive restarts within the session, never saved */
  private mods = defaultModifiers();
  private currentLevelId = "m1";
  private lastT = 0;
  private endTimer = -1;

  constructor() {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.renderer = new RetroRenderer(canvas);
    this.input = new Input(canvas);

    this.settings = { sens: 1.0, master: 0.8, music: 0.5, retro: true, aimAssist: true, difficulty: "agent" };
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) Object.assign(this.settings, JSON.parse(saved));
    } catch {
      // first run
    }
    if (!["agent", "super", "007"].includes(this.settings.difficulty)) this.settings.difficulty = "agent";
    this.renderer.enabled = this.settings.retro;

    this.watch = new WatchMenu(this.settings, {
      onResume: () => this.input.requestLock(),
      onAbort: () => {
        if (this.world) {
          this.world.mission.missionFail("Mission aborted. M is not pleased.");
          this.showDebrief();
        }
      },
      onSettings: () => this.applySettings(),
      onModifiers: () => this.applyModifiers()
    });

    window.addEventListener("resize", () => this.onResize());
    this.onResize();

    this.input.onLockLost = () => {
      if (this.state === GameState.Playing) this.openWatch();
    };

    // audio needs one user gesture
    document.addEventListener(
      "click",
      () => {
        this.sfx.ensure();
        this.applySettings();
        if (this.state === GameState.Menu) this.music.start("menu");
      },
      { once: true }
    );

    this.showMenu();
    requestAnimationFrame((t) => this.loop(t));
    // debug/inspection handle
    (window as unknown as Record<string, unknown>).__game = this;
  }

  private applySettings(): void {
    this.sfx.setVolumes(this.settings.master, this.settings.music);
    this.renderer.setRetro(this.settings.retro);
    if (this.world) {
      this.world.player.sensitivity = 0.0022 * this.settings.sens;
      this.world.weapons.aimAssist = this.settings.aimAssist;
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // storage unavailable — settings just won't persist
    }
  }

  /** Push live cheat toggles into systems that cache visual/physical state. */
  private applyModifiers(): void {
    if (!this.world) return;
    for (const g of this.world.guards) g.applyMods(this.mods);
    this.world.effects.paintball = this.mods.paintball;
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.world) {
      this.world.camera.aspect = window.innerWidth / window.innerHeight;
      this.world.camera.updateProjectionMatrix();
    }
  }

  // ---- state transitions -------------------------------------------------

  private showMenu(): void {
    this.disposeWorld();
    this.state = GameState.Menu;
    this.sfx.ambientStop();
    this.sfx.alarmStop();
    this.music.start("menu");
    const save = loadCampaign();
    this.screens.showMenu(
      LEVELS.map((def) => ({
        def,
        locked: !save.unlocked.includes(def.id),
        best: save.best[def.id]
      })),
      this.input,
      (id) => {
        this.sfx.ensure();
        this.currentLevelId = id;
        void this.startMission();
      }
    );
  }

  private async startMission(skipBriefing = false): Promise<void> {
    this.disposeWorld();
    this.endTimer = -1;
    this.sfx.alarmStop();
    await loadCharacterAssets();
    const def = levelById(this.currentLevelId);

    const world = new World(this.input, this.sfx);
    world.mods = this.mods;
    world.camera.aspect = window.innerWidth / window.innerHeight;
    world.camera.updateProjectionMatrix();
    const env = def.environment;
    world.scene.fog = new THREE.FogExp2(env.fog.color, env.fog.density);
    world.scene.background = new THREE.Color(env.background);
    world.scene.add(new THREE.AmbientLight(env.ambient.color, env.ambient.intensity));
    world.scene.add(new THREE.HemisphereLight(env.hemi.sky, env.hemi.ground, env.hemi.intensity));
    if (env.sun) {
      const sun = new THREE.DirectionalLight(env.sun.color, env.sun.intensity);
      sun.position.set(env.sun.dir[0], env.sun.dir[1], env.sun.dir[2]);
      world.scene.add(sun);
    }
    world.scene.add(world.camera); // the view model hangs off the camera

    world.effects = new Effects(this.sfx);
    world.scene.add(world.effects.group);
    world.level = buildLevel(def, world.physics, this.sfx);
    world.scene.add(world.level.group);

    world.player = new Player();
    world.player.sensitivity = 0.0022 * this.settings.sens;
    world.player.spawn(world, world.level.playerStart.pos, world.level.playerStart.yaw);

    world.alarm = new AlarmSystem(def);
    world.difficulty = difficultyById(this.settings.difficulty);
    world.mission = new MissionSystem(world, def.objectives, this.settings.difficulty);
    world.weapons = new WeaponSystem(world);
    world.weapons.aimAssist = this.settings.aimAssist;
    world.projectiles = new Projectiles();
    world.npcs = (def.npcs ?? []).map((nd) => new Scientist(world, nd));
    world.guards = def.guards.map((gd) => new Guard(world, gd));
    world.hud = new HUD(world);
    this.world = world;
    this.applyModifiers();

    world.events.on("playerDied", ({ reason }) => world.mission.missionFail(reason));
    world.events.on("missionFailed", () => {
      if (this.endTimer < 0) this.endTimer = 1.8;
    });

    if (skipBriefing) {
      this.beginPlay();
    } else {
      this.state = GameState.Briefing;
      this.music.start("menu");
      this.showBriefing();
    }
  }

  /** (Re)renders the briefing; picking a difficulty rebuilds the objective list. */
  private showBriefing(): void {
    const world = this.world;
    if (!world) return;
    const def = world.level.def;
    this.screens.showBriefing(def, world.mission, () => this.beginPlay(), {
      current: this.settings.difficulty,
      onSelect: (d: Difficulty) => {
        this.settings.difficulty = d;
        this.applySettings();
        // guards haven't acted yet — rescale their combat stats in place
        world.difficulty = difficultyById(d);
        for (const g of world.guards) g.applyDifficulty(world.difficulty);
        world.mission = new MissionSystem(world, def.objectives, d);
        this.showBriefing();
      }
    });
  }

  private beginPlay(): void {
    if (!this.world) return;
    this.screens.clear();
    this.input.endFrame(); // swallow the click that pressed the button
    this.state = GameState.Playing;
    this.world.hud.setVisible(true); // debrief hid it; a fresh run must show it again
    this.sfx.ensure();
    this.musicLevel = "stealth";
    this.musicDownT = 0;
    this.music.start(this.world.level.def.musicTheme, "stealth");
    this.sfx.ambientStart();
    this.world.mission.stats.startTime = performance.now();
    this.input.requestLock();
    this.world.hud.toast(this.world.level.def.startToast);
  }

  private openWatch(): void {
    if (this.state !== GameState.Playing || !this.world) return;
    this.state = GameState.Watch;
    this.music.duck(true);
    this.watch.show(this.world);
  }

  private closeWatch(): void {
    this.watch.hide();
    this.music.duck(false);
    this.state = GameState.Playing;
  }

  private showDebrief(): void {
    if (!this.world || this.state === GameState.Debrief) return;
    this.state = GameState.Debrief;
    this.watch.hide();
    this.input.exitLock();
    this.music.stop();
    this.sfx.ambientStop();
    this.sfx.alarmStop();
    this.world.hud.setVisible(false);

    const mission = this.world.mission;
    const next = nextLevelId(this.currentLevelId);
    if (mission.outcome === "won") {
      recordWin(this.currentLevelId, next, {
        rating: mission.rating(),
        timeSec: mission.elapsedSeconds(),
        difficulty: mission.difficulty
      });
    }
    this.screens.showDebrief(
      mission,
      () => void this.startMission(true),
      () => this.showMenu(),
      mission.outcome === "won" && next
        ? () => {
            this.currentLevelId = next;
            void this.startMission();
          }
        : undefined
    );
  }

  private disposeWorld(): void {
    if (!this.world) return;
    this.world.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });
    this.world.events.clear();
    this.world = null;
    document.getElementById("hud")!.innerHTML = "";
  }

  // ---- per-frame ----------------------------------------------------------

  private loop(t: number): void {
    const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;

    if (this.state === GameState.Playing && this.world) {
      // slow motion scales game time only — look stays full-speed
      this.updatePlaying(this.mods.slowMotion ? dt * 0.55 : dt);
    } else if (this.state === GameState.Watch) {
      // resume when pointer lock comes back (or on the pause/Esc key)
      if (this.input.locked) this.closeWatch();
      else if (this.input.actionPressed("pause") || this.input.pressed("Escape")) this.input.requestLock();
    }

    if (this.world) {
      this.renderer.render(this.world.scene, this.world.camera);
    } else {
      this.renderer.renderer.clear();
    }
    this.input.endFrame();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  private updatePlaying(dt: number): void {
    const w = this.world!;
    w.time += dt;

    if (this.input.actionPressed("pause")) {
      if (this.input.locked) this.input.exitLock();
      else this.openWatch();
      return;
    }

    w.player.update(dt, w);
    if (!w.player.alive) {
      // slump to the floor
      const cam = w.camera;
      cam.position.y = THREE.MathUtils.damp(cam.position.y, 0.35, 4, dt);
      cam.rotation.z = THREE.MathUtils.damp(cam.rotation.z, 0.55, 4, dt);
    }
    w.weapons.update(dt, w);

    const nearby: THREE.Vector3[] = [w.player.pos];
    for (const g of w.guards) if (g.alive) nearby.push(g.pos);
    for (const npc of w.npcs) if (npc.alive) nearby.push(npc.pos);
    for (const d of w.level.doors) d.update(dt, nearby);

    for (const g of w.guards) g.update(dt, w);
    for (const npc of w.npcs) npc.update(dt, w);
    w.projectiles.update(dt, w);
    w.alarm.update(dt, w);
    w.effects.update(dt);
    for (const p of w.level.pickups) p.update(dt, w.time);

    if (w.player.alive) {
      this.checkPickups(w);
      this.interact(w);
      const [cx, cz] = NavGrid.toCell(w.player.pos);
      w.mission.onRegionEntered(w.level.grid.regionAt(cx, cz).name);
    } else {
      w.hud.setPrompt(null);
    }

    w.mission.update(dt);
    w.hud.update(w);
    this.sfx.setListener(w.player.eyePos(), w.player.forward());

    // music intensity: upgrade instantly, cool down after ~4s of calm
    const target: MusicIntensity = w.alarm.active
      ? "alarm"
      : w.guards.some((g) => g.alive && (g.state === "combat" || g.state === "chase"))
        ? "combat"
        : "stealth";
    const rank: Record<MusicIntensity, number> = { stealth: 0, combat: 1, alarm: 2 };
    if (rank[target] >= rank[this.musicLevel]) {
      if (target !== this.musicLevel) this.music.setIntensity(target);
      this.musicLevel = target;
      this.musicDownT = 4;
    } else {
      this.musicDownT -= dt;
      if (this.musicDownT <= 0) {
        this.musicLevel = target;
        this.music.setIntensity(target);
      }
    }

    if (w.mission.outcome === "won" && this.endTimer < 0) this.endTimer = 1.4;
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.showDebrief();
    }
  }

  private checkPickups(w: World): void {
    const feet = w.player.pos;
    for (const p of w.level.pickups) {
      if (!p.alive) continue;
      const dx = p.pos.x - feet.x;
      const dz = p.pos.z - feet.z;
      if (dx * dx + dz * dz > 1.1) continue;
      if (this.applyPickup(w, p.type)) {
        p.collect();
        w.mission.onPickup(p.type);
      }
    }
  }

  private applyPickup(w: World, type: PickupType): boolean {
    const ws = w.weapons;
    const pl = w.player;
    switch (type) {
      case "medkit":
        if (pl.health >= 100) return false;
        pl.heal(50);
        w.hud.toast("MEDICAL KIT +50");
        break;
      case "armor":
        if (pl.armor >= 100) return false;
        pl.giveArmor();
        w.hud.toast("BODY ARMOR");
        break;
      case "ammo_9mm":
        ws.addAmmo("9mm", 12);
        w.hud.toast("9MM ROUNDS +12");
        break;
      case "ammo_rifle":
        ws.addAmmo("rifle", 30);
        w.hud.toast("RIFLE ROUNDS +30");
        break;
      case "ammo_shells":
        ws.addAmmo("shells", 8);
        w.hud.toast("SHOTGUN SHELLS +8");
        break;
      case "ammo_rail":
        ws.addAmmo("rail", 3);
        w.hud.toast("RAIL SLUGS +3");
        break;
      case "grenades":
        ws.owned.add("grenade");
        ws.addAmmo("grenade", 3);
        w.hud.toast("HAND GRENADES +3");
        break;
      case "mines":
        ws.addAmmo("mine", 3);
        w.hud.toast("REMOTE MINES +3");
        break;
      case "weapon_dd4":
        w.hud.toast(ws.give("dd4", 8) ? "DD4 DOSTOVEI ACQUIRED" : "9MM ROUNDS +8");
        break;
      case "weapon_kr7":
        w.hud.toast(ws.give("kr7", 15) ? "KR-7 SOVIET ACQUIRED" : "RIFLE ROUNDS +15");
        break;
      case "weapon_shotgun":
        w.hud.toast(ws.give("shotgun", 5) ? "KS-23 SHOTGUN ACQUIRED" : "SHOTGUN SHELLS +5");
        break;
      case "weapon_railgun":
        w.hud.toast(ws.give("railgun", 3) ? "ZMEY PROTOTYPE RAILGUN ACQUIRED" : "RAIL SLUGS +3");
        break;
      case "weapon_klobb": {
        const second = ws.owned.has("klobb");
        w.hud.toast(ws.give("klobb", 20) ? (second ? "A SECOND VZ-61 — ONE FOR EACH HAND" : "VZ-61 SKORPION ACQUIRED") : "9MM ROUNDS +20");
        break;
      }
      case "weapon_sniper":
        w.hud.toast(ws.give("sniper", 5) ? "SVD-63 SNIPER RIFLE ACQUIRED" : "RIFLE ROUNDS +5");
        break;
      case "weapon_golden":
        w.hud.toast(ws.give("golden", 1) ? "THE GOLDEN GUN — ONE SHOT, ONE KILL" : "GOLDEN BULLET +1");
        break;
      case "weapon_knife":
        if (ws.owned.has("knife")) return false;
        ws.give("knife", 0);
        w.hud.toast("COMBAT KNIFE ACQUIRED");
        break;
      case "ammo_golden":
        ws.addAmmo("golden", 1);
        w.hud.toast("GOLDEN BULLET +1");
        break;
      case "keycard_lab":
        pl.cards.add("lab");
        w.sfx.keycard();
        w.hud.toast("LAB KEYCARD ACQUIRED");
        return true;
      case "keycard_officer":
        pl.cards.add("officer");
        w.sfx.keycard();
        w.hud.toast("OFFICER KEYCARD ACQUIRED");
        return true;
    }
    w.sfx.pickup();
    return true;
  }

  private interact(w: World): void {
    let prompt: string | null = null;
    let action: (() => void) | null = null;

    for (const npc of w.npcs) {
      if (!npc.alive || npc.freed) continue;
      if (w.player.pos.distanceTo(npc.pos) >= 2.4) continue;
      const ndef = npc.def;
      if (ndef.gateId && !(w.level.gates.get(ndef.gateId)?.isPassable() ?? true)) continue;
      prompt = ndef.freePrompt;
      action = () => {
        npc.free(w);
        w.mission.onNpcFreed(npc.id);
        if (ndef.grantsKeycard) {
          w.player.cards.add(ndef.grantsKeycard);
          w.sfx.keycard();
        }
        for (const t of ndef.freeToasts) w.hud.toast(t);
      };
      break;
    }

    if (!prompt) {
      const hit = w.physics.raycast(w.player.eyePos(), w.player.forward(), 2.9);
      if (hit && hit.collider.kind === "door") {
        const door = hit.collider.ref as Door;
        if (door.kind === "grate") {
          prompt = "F — KICK GRATE OPEN";
          action = () => door.kick();
        } else if (door.kind === "gate") {
          prompt = "F — PICK LOCK";
          action = () => door.requestOpen();
        } else if (door.isClosed()) {
          if (door.lock === "none") {
            prompt = "F — OPEN DOOR";
            action = () => door.tryOpen(w.player.cards);
          } else if (w.player.cards.has(door.lock)) {
            prompt = `F — USE ${door.lock.toUpperCase()} KEYCARD`;
            action = () => {
              if (door.tryOpen(w.player.cards) === "unlocked") {
                w.hud.toast(`Used ${door.lock.toUpperCase()} keycard.`);
              }
            };
          } else {
            prompt = `LOCKED — NEEDS ${door.lock.toUpperCase()} KEYCARD`;
            action = () => {
              door.tryOpen(w.player.cards);
              w.hud.toast(`This door needs the ${door.lock.toUpperCase()} keycard.`);
            };
          }
        }
      }
    }

    // vault hint (Space is handled inside Player)
    if (!prompt && w.player.canVault(w)) prompt = "SPACE — VAULT";

    w.hud.setPrompt(prompt);
    if (action && this.input.actionPressed("interact")) action();
  }
}

new Game();
