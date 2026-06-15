# Operation Tungsten — Feature Backlog (proposal / build spec)

> Planning doc, not yet implemented. Decisions locked with the user on 2026-06-12.
> Each item lists the goal, the current code (file:line), the change, effort, and risk.
> Work the **Build order** top-to-bottom: zero-risk wins first, the big rebalance last.

## Decisions locked (2026-06-12)

- **Red reticle** → *both states*: red when aimed at an enemy **within** the gun's
  effective range, dimmed/grey when that enemy is **beyond** range, neutral otherwise.
- **Escort (M1, Dr. Volkov)** → *true escort*: he follows the player, guards actively
  target/shoot him, and the mission fails if he dies. Full M1 rebalance.
- **"Proximity mine"** → clarified: this is **M1's remote-detonated mine**, not a
  trip-mine. Keep RMB remote detonation exactly as-is; the only change is the
  **placement method** — throw it on a grenade arc and have it **stick where it lands**.
- **Alarm-triggered door** → build as a *generic, reusable* level feature
  (gate opens on alarm + dormant guards activate), then showcase it in one mission.
- **Dual-wield zoom** → on aim, **both guns should converge toward center**
  (today only the right centers; the left stays parked off to the side). Cause confirmed.
- **Spy camera** → make it require getting **closer** (stricter), not easier.
- **Damage falloff** → *declined for now*; range stays a hard on/off cutoff.

## Build order & status

| # | Feature | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | Objectives screen — spacing + bullets | S | none | [x] done (tsc clean) |
| 2 | Spy-camera distance — require closer | S | none | [x] done — range 8→5m |
| 3 | Dual-wield — converge both guns on ADS | S/M | low | [x] done (tsc clean) |
| 4 | Red reticle — in-range / out-of-range states | M | low | [x] done — red in-range / dim-grey out-of-range |
| 5 | Railgun scope — stop the gun blocking the zoom | M | low | [x] done — hide gun when scoped + cyan ZMEY reticle |
| 6 | Throwable sticky mine (placement change only) | M | low-med | [x] done — arc-throw, sticks to floor/wall/tank, remote detonate (tested end-to-end) |
| 7 | Alarm door + dormant squad (generic + showcase) | M/L | med | [x] done — sealed `openOnAlarm` gate + `dormantGroup` guards (grouped per-gate); M1 dock-approach reserve squad; tested headless |
| 8 | True escort — M1 Dr. Volkov | L | high (balance) | [x] done — follows on all diffs; guards aim-divert (agent/super) + co-target (007); death = hard fail on super/007; tested headless |
| 9 | Main-menu crosshair cursor + bullet-shot click | S/M | low | [x] done — SVG crosshair cursor on all menu screens; click spawns bullet hole + flash + gunshot |
| 10 | Mission briefing narration — recorded voice clips | M | low-med | [x] done — recorded mp3 per level (m1, m2); silent if none; TTS removed; OPTIONS narration on/off |
| 11 | Auto-switch-on-pickup toggle (option to keep current weapon) | S | low | [x] done — watch OPTIONS toggle; off = acquire but keep current gun (verified) |
| 12 | Enemies open doors — officers unlock & pursue through them | M | low-med | [x] done — alerted officers path through + open their keycard-locked doors |
| 13 | Better enemy sound detection (player footstep noise) | M | med | [x] done — footsteps emit noise (sneak 4m / move 8m / run 13m); crouch silent. Graduated-hearing meter still optional |
| 14 | Red reticle uses effective range, not max weapon range | S | low | [x] done — new `effectiveRange` per gun drives the red/grey threshold |
| 15 | More spread/bloom; reward crouch + standing still (anti-laser) | S/M | med (feel) | [x] done — hip ×1.5, moving ×1.9, still ×0.8, crouch ×0.62, bloom cap 0.06 |
| 16 | Spy-cam range 5m to 1.5m | S | low | [x] done — camera range = 1.5m |
| 17 | Rename railgun (ZMEY to something else) | S | none | [x] done — renamed to GAUSS (all 7 refs) |
| 18 | Better music (richer themes or CC0 .ogg overlay) | M/L | low | [ ] |
| 19 | Improve weapon models (pp9, golden gun, knife, spy camera, slappers, +lockpick) | M | low | [x] rebuilt rounder (capsules/spheres/torus); new lockpick model; WEAPON TEST RANGE on menu to view; verify look in-game |
| 20 | Fix M1 ending — board the truck (F) + add dock garage door | M | low-med | [x] done — F-board exfil (`extraction.boardProp`); roll-up garage prop; truck remodelled as a CC0 Kenney GLB (olive), tested |
| 21 | Mission awards (no-alarm, no-damage, undetected, pacifist, 100% acc, melee-only) | M | low-med | [x] done — 6 debrief badges; tracks damageTaken/detected/meleeKills |
| 22 | Slot 8 to "EQUIPMENT" — mission-dependent (lockpick, camera, ...) | M/L | med | [x] done — slot 8 = EQUIPMENT; per-level `equipment`; working lockpick (M1) |
| 23 | GLB weapon fixes — pp9 suppressor, VZ-61 rod, KR-7 looks like an M16 | M | low | [ ] |
| 24 | Alarm audio — quieter + slower beep (it's painful) | S | low | [x] done — gain 0.07→0.035, two-tone 380→750ms (Sfx.ts) |
| 25 | Brighter mission lighting (can't see far) | S | low | [x] resolved — turning OFF 240p retro mode brightens the scene a lot; no code change needed |
| 26 | Explosive barrels | S/M | low | [x] done — barrels destructible (hp 18) + explode (r4.5/80), verified at runtime |
| 27 | Mission-start click shouldn't fire/alert guards | S | low | [x] done — clearHeld("fire") in beginPlay |
| 28 | Guards fire the weapon they actually drop | S | low | [x] done — already keyed off one id (verified 2026-06-14) |
| 29 | Tune footstep sound level | S | low | [ ] |
| 30 | Lockpick must be actively used on locked doors (not instant F) | M | low | [ ] |
| 31 | Lockpickable doors show a visible lock | S | low | [x] done — new "pick" lock type (char P) + procedural padlock; demo in range |

Effort: S ≈ minutes, M ≈ contained change, L ≈ multi-file + design/balance.
Items 1–6, 9, 11–17, 19, 21, 22 done. 12–22 were a second batch (2026-06-12).
23–31 are a third batch (2026-06-14). CC0 GLB weapon swap + firing-range test room
are done; #23 (model issues) + per-weapon fit are still being tuned.

---

## 1. Objectives screen — spacing + bullets · S · no risk

**Goal:** the OBJECTIVES list is "bunched up and not bulleted."
**Now:** built as bare concatenated `<div>`s with no per-item spacing —
`src/ui/WatchMenu.ts:107` (`▣ / □ / ☒` + label). Styled at `src/style.css:747`
(`.obj-done/.obj-failed/.obj-pending`); line-height lives on the container, not the rows.
**Change:** per-row margin/padding, a hanging bullet/checkbox so wrapped lines indent,
and a visual break between required and `BONUS:` objectives. Pure markup + CSS.

## 2. Spy-camera distance — require closer · S · no risk

**Goal:** photos should require getting closer to the target.
**Now:** `src/weapons/WeaponSystem.ts:616` — `dist < def.range` with camera
`range = 8m` (`src/weapons/WeaponDefs.ts:337`), a `facing > 0.88` (~28°) cone, and a
line-of-sight check.
**Change:** lower `range` (≈8 → 5m), optionally tighten the cone. One value; tune in playtest.

## 3. Dual-wield — converge both guns on ADS · S/M · low risk

**Goal:** aiming with dual-wield centers the right gun but strands the left off-screen-left.
**Cause (confirmed):** the left gun is built with a fixed `left.position.x = -0.46`
(`src/weapons/ViewModel.ts:50`); `update()` only moves the whole holder to the centered
`ADS` position (`ViewModel.ts:99-113`), so the left gun keeps its `-0.46` offset.
**Change:** store refs to the left/right gun meshes; in `update()` lerp their local x
toward a converged near-center pair as `adsLerp → 1`
(e.g. left `-0.46 → ~-0.10`, right `0 → ~+0.06`). Exact offsets are a playtest tweak.

## 4. Red reticle — in-range / out-of-range states · M · low risk

**Goal:** reticle communicates whether the thing under the crosshair is a hittable enemy.
**Now:** crosshair is plain DOM and already flashes orange-red on a confirmed hit via a
`.hit` class (`src/ui/HUD.ts:137`). Per-gun max range already exists and hard-caps the
hitscan (`src/weapons/WeaponSystem.ts:492`): PP9/DD4 80m, Klobb 60, KR-7 90, shotgun 40,
SVD 160, railgun 140, Golden 100.
**Change:** one per-frame camera raycast (reuse `hitscan`); toggle crosshair classes —
**red** when it hits a guard/NPC within the current weapon's `range`, **dim/grey** when it
hits an enemy beyond range, neutral otherwise. No mechanics change, just feedback.

## 5. Railgun scope — stop the gun blocking the zoom · M · low risk

**Goal:** the ZMEY's zoom is obscured by the gun model.
**Now:** railgun has `zoomFov: 20` but **no `scopeOverlay`**, and the viewmodel just slides
to center when aiming (`ViewModel.ts:99`), so the model eats the view. The SVD does it right
via `scopeOverlay: true` → vignette that hides the gun (`HUD.ts:189`, CSS `style.css:311`).
**Change:** give the railgun its own scope path — hide/pull back the viewmodel while zoomed
and show an overlay. Prefer a distinct techy railgun reticle over reusing the sniper vignette.

## 6. Throwable sticky mine — placement change only · M · low-med risk

**Goal:** throw the M1 mine like a grenade; it sticks where it lands. **Detonation stays
remote (RMB) — unchanged.**
**Now:** mine is placed by a short raycast (≤3m) at `src/weapons/WeaponSystem.ts:560`;
it can already attach to bullet-immune destructibles (gas tanks) and is RMB-detonated.
Grenades already have full arc physics — velocity `fwd×11.5 + up 3.4`, gravity 13, bounce
0.42, fuse — at `src/combat/Projectiles.ts:22`.
**Change:** new projectile variant — throw the mine on the grenade arc, but on first
surface/destructible contact **stop dead (no bounce)**, orient to the surface normal, and
arm as a remote mine at that spot. Keep the attach-to-tank logic so you can now stick a mine
on a tank from across the room and blow it on command. Replaces the 3m placement limit.

## 7. Alarm door + dormant squad — generic + showcase · M/L · med risk · DONE (2026-06-15)
**Built generic + grouped-per-gate.** New door lock `"sealed"` + `Door.latchOpen()` (a blast
door that's player/AI-unopenable and a hard Nav barrier until the alarm latches it open for
good). `GateDef.openOnAlarm` builds a gate sealed; `GuardSpawnDef.dormantGroup` spawns a guard
inert (no perception/patrol — early-return in `Guard.update`) tied to a gate id. `AlarmSystem.trigger`
latches every `openOnAlarm` gate open and `release()`s the matching dormant group (→ `startHunting`).
Also hardened the `chase` AI so a freshly-released hunter doesn't downgrade to `investigate` while
its route is briefly blocked by the still-opening gate (throttled fast-retry repath). **Showcase:**
M1 reserve guardroom carved west of the dock; its `dock_reserve` blast door blows open NORTH into
the dock-approach corridor and 4 klobb/heavy guards charge the player. Verified headless: inert +
`tryOpen()==="locked"` while sealed; on alarm the gate opens and all 4 deploy and path to the player.

**Goal:** a normally-locked door that opens on alarm and releases a squad of guards that were
locked away, who come at you aggressively.
**Now:** doors expose a runtime `requestOpen()` (`src/level/Door.ts:85`); the alarm has a
single `trigger()` entry point (`src/ai/AlarmSystem.ts:49`). Reinforcement waves already
spawn + hunt (capped 8 spawned / 5 alive). **No "dormant guard" concept exists** — all
guards spawn active at level start (`src/ai/Guard.ts:124`).
**Change (generic):**
1. LevelDef: flag a gate `openOnAlarm` and flag guards `dormant: true` (new field, types in
   `src/level/LevelTypes.ts`).
2. Dormant guards spawn inert (no perception/patrol) behind the gate.
3. `AlarmSystem.trigger()` → call the gate's `requestOpen()` and flip dormant guards into an
   aggressive hunting state (reuse `startHunting`).
**Showcase:** wire one locked guardroom into a mission (candidate: M1 or M4) as the demo.

## 8. True escort — M1 Dr. Volkov · L · high risk (balance) · DONE (2026-06-15)
**Built (decisions: follow on all difficulties, smart auto-follower, lethality scales).**
`NpcDef.escort` flips the freed scientist into a new `"following"` state in `Scientist.ts`
(standoff trail behind the player, run to catch up, ~0.4s A* repath, opens unlocked doors,
hangs back / hugs the player's lee side under fire, teleport stuck-recovery; health 30→70).
Guards target him via `Guard.fireRound` aim-diversion on agent/super and a committed
`foeNpc` co-target on 007 (`combatThink`/`fireRound` read the foe via `foePos/seesFoe`;
`maybeCoTarget` commits/releases on a timer; a player hit pulls `foeNpc` back to the player).
Death of a freed escort hard-fails the mission when the `npcSurvives` objective is required —
`s_volkov` is now "Escort Dr. Volkov to extraction" (`requiredAt: "super"`), and
`allRequiredDone()` treats a live freed escort as satisfied so extraction isn't circularly
blocked. Verified headless: he follows a multi-leg route (~3-6m trail), takes diverted fire,
007 guards co-target then drop him when you shoot them, and his death = mission lost on
super/007 but harmless on agent.

**Goal:** Volkov follows the player and can realistically die, making the escort a challenge.
**Now:** he's freed then walks to a fixed `hideCell` and waits; guards **never target NPCs**
(`src/ai/Guard.ts:237`) — he only catches stray bullets. He already has A* pathfinding,
momentum physics, and access to `world.player.pos` (`src/npc/Scientist.ts:61`).
**Change:**
1. New "following" state on the Scientist: path toward the player, hold a follow distance,
   catch up, and stuck-recovery (teleport-behind if wedged).
2. Make guards able to **target and shoot** the escorted NPC (extend guard target selection),
   with the existing `killFailReason` as the fail-state.
3. Full M1 balance pass — this reshapes the whole mission's difficulty.
**Why last:** code groundwork is easy; the risk is escort pathing + making it hard-but-fair.

## 9. Main-menu crosshair cursor + bullet-shot click · S/M · low risk

**Goal:** on the menu screens the cursor is a gun crosshair, and a click looks (and
sounds) like firing — a bullet-hole impact left at the click point.
**Now:** menus are DOM templates in `src/ui/Screens.ts` (main menu / briefing /
debrief), mounted in `#overlay`. The SFX engine is available before a level loads as
`Game.sfx` (there is no `world` at the menu yet, so use `Game.sfx`, not `world.sfx`).
In-game bullet holes already exist as a decal motif to match the look to.
**Change:**
1. CSS: set a crosshair `cursor` on `.screen` via an inline SVG data-URI reticle (no
   shipped asset — stays consistent with the procedural ethos).
2. On mousedown over a menu, spawn a short-lived "bullet hole" element at the cursor
   (dark ring + cracks, fade out), optionally a quick muzzle-flash flash, and play a
   gunshot through `Game.sfx`.
Cosmetic only; contained to `Screens.ts` + `style.css`. If the custom cursor hurts
button affordance, keep the default cursor on actual buttons (tune in playtest).

## 10. Mission briefing narration — recorded clips · M · low-med risk · DONE (2026-06-14)
**Final design (recorded-clips only — browser TTS removed; it sounded terrible).**
`src/audio/BriefingVoice.ts` plays a recorded clip per level at
`public/audio/voice/<levelId>.mp3` on the briefing screen; **if a level has no clip, nothing
plays** (no text-to-speech fallback). Triggered once at the briefing entry (`main.ts`, after
`showBriefing()`), `beginPlay()` stops it. Watch OPTIONS has a **BRIEFING NARRATION** on/off
checkbox (`Settings.voice: boolean`, default on; old off/male/female value migrated on load).
**Clips shipped:** `m1.mp3` (22s) and `m2.mp3`. Drop a `<levelId>.mp3` into `public/audio/voice/`
to give any other mission VO. Verified end-to-end: M1/M2 briefings play their clips, a clip-less
mission (M3) is silent, BEGIN stops playback, no console errors.

**Goal:** the mission **background / briefing** (the M-to-007 setup) is read aloud in a
British intelligence-handler voice when the briefing screen appears — **not** the
objectives checklist.
**What's spoken:** `def.briefing.re` + `paragraphs[]` + `outro`, assembled in
`src/ui/Screens.ts` `showBriefing()` (line ~56).
**Voice packs — layered, mirroring the existing CC0 sample overlay** (`src/audio/Samples.ts`
lazy-fetches `public/audio/*.ogg` and silently falls back to synth when a file is absent):
1. New `src/audio/BriefingVoice.ts` lazy-loads recorded briefing clips from
   `public/audio/voice/<pack>/<levelId>.ogg` (e.g. `voice/mi6/m1.ogg`) using the same
   fetch-with-silent-fail pattern. Drop a pack in → it just works; multiple packs coexist.
2. On briefing show, choose the source in priority order:
   a. **recorded voice-pack clip** for this level → play it (best; a real British read);
   b. else **Web Speech API** (`speechSynthesis`, an `en-GB` voice such as "Google UK
      English Male" / macOS "Daniel", `rate ≈ 0.95`, `pitch ≈ 0.9`) speaks the assembled
      briefing text — procedural fallback;
   c. else **silent** (text-only briefing, exactly as today).
3. Watch OPTIONS gets a **Voice** selector — Off / Synth (TTS) / <installed pack> —
   persisted with the other settings.
**Why this fits:** it's the same "ship nothing, overlay real audio if present" model the
game already uses for gunshots, so a hand-recorded MI6 briefing is drop-in, and machines
with no pack and no en-GB voice degrade gracefully to text.
**Risks:** TTS voice quality varies by OS/browser; voices load async (`voiceschanged`
event); needs the no-voice fallback. Recording or sourcing the actual VO is out of code
scope. Decide single-clip-per-mission (simpler to record) vs per-paragraph clips.

## 11. Auto-switch-on-pickup toggle · S · low risk

**Goal:** an option to **stop auto-equipping** a weapon you just walked over, so you keep
the gun already in hand.
**Now:** `WeaponSystem.give()` calls `switchTo()` on every newly acquired weapon
(`src/weapons/WeaponSystem.ts:94`, plus `:83` for the second-klobb dual-wield case),
driven by the weapon pickups in `applyPickup` (`src/main.ts:450-477`).
**Change:** add an `autoSwitchOnPickup` setting (default **on**), surfaced as a watch
OPTIONS toggle and persisted with the rest (Settings / `core/SaveData`); thread it to
`WeaponSystem` and skip the `switchTo()` in `give()` when it's off — still acquire the
weapon and show the toast, just don't swap. Nicety: if the player is currently
empty-handed/melee-only, still ready the first real gun picked up.
**Risk:** trivial, self-contained.

---

# Second batch (2026-06-12)

## 12. Enemies open doors — officers unlock & pursue · M · low-med risk

**Now:** guards **already** open unlocked slide doors while pathing
(`src/ai/Guard.ts:355` → `door.requestOpen()`); officer/lab-locked doors are hard
pathfinding barriers they can't cross (`src/ai/Nav.ts` treats locked doors as blocked).
**Change:** let **officers** (who carry a keycard) open officer-locked doors when hunting
— mark such doors passable for keycard-holding guards in nav + `requestOpen()`; optionally
let any alerted guard breach a locked door after a delay. Check `grate` doors too.
**Why noted:** base "open doors" works; this closes the gap so a locked door isn't a
permanent safe wall once you've been spotted.

## 13. Better enemy sound detection · M · med risk

**Now:** guards hear via a radius check on `emitNoise` and investigate instantly
(`src/ai/Guard.ts:142`); per-weapon `noiseRadius` (PP9 7m … sniper 36m, grenades 45m).
The **player's own movement makes no noise** — only shots/takedowns/explosions do.
**Change:** emit player footstep noise scaled by gait — running loud (~12–16m), walking
quiet (~6m), crouch / Shift-sneak ~silent; make hearing graduated (an alert meter that
builds toward investigate→alert instead of instant), biased toward the noise direction.
**Risk:** balance — too sensitive and stealth becomes impossible; tune the radii.

## 14. Red reticle uses effective range, not max range · S · low risk

**Now:** the #4 reticle goes red anywhere inside the gun's **max** `range` (80–160m), so it
reads "hittable" far past where a shot reliably lands.
**Change:** add an `effectiveRange` (new per-weapon field, or a fraction of `range`) and use
it for the red/grey threshold so red means "you can realistically hit this." Pairs with #15.

## 15. More spread/bloom; reward crouch + standing still · S/M · med (feel) risk

**Goal:** no more lasering enemies from the hip on the move.
**Now:** `effectiveSpread()` (`src/weapons/WeaponSystem.ts:310`): moving ×1.45, crouch
×0.65, per-shot bloom (cap 0.035, decay 7); base `spread`/`aimSpread`/`bloomAdd` per weapon
in `WeaponDefs.ts`.
**Change:** widen base hip `spread` + `bloomAdd`, raise the moving multiplier, add a distinct
**standing-still** tightening (separate from crouch) so planting your feet matters, and raise
the bloom cap so sustained fire walks off. Heavy playtest knob.

## 16. Spy-cam range 5m → 1.5m · S · low risk

**Now:** camera `range = 5m` (`src/weapons/WeaponDefs.ts`, set in #2) + ~28° facing cone in
`snapPhoto` (`WeaponSystem.ts`).
**Change:** drop `range` to **1.5m** (near point-blank). One value — but 1.5m is very tight;
confirm photo objectives don't become fiddly in playtest. *(Trivial — can apply on request.)*

## 17. Rename railgun (ZMEY → ?) · S · no risk

**Now:** "ZMEY" lives in `WeaponDefs.ts:250-251` (name/short), pickup toast `main.ts:460`,
objective `m1_arkhangelsk.ts:347`, the scope CSS class toggle `HUD.ts:192` (`"zmey"`), and
`README.md:91`.
**Change:** pick a name and update all six (rename the CSS class to match, or leave it).
Candidates: GAUSS, ARC-9, TESLA, RAILSPIKE, COILGUN. Pure rename.

## 18. Better music · M/L · low risk

**Now:** per-level step-sequenced themes in `src/audio/Music.ts` (bpm + 16-step bass/lead,
4-bar pads, perc strings; stealth/combat/alarm layer gains). Data-driven, pause-safe.
**Change (pick scope):** richer authored themes (longer patterns, more layers, countermelody,
key/mode shifts), and/or drop CC0 `.ogg` stems into `public/audio/` via the existing overlay
hook for recorded tracks.

## 19. Improve weapon models · M · low risk

**Now:** `src/weapons/GunMeshes.ts` builds each gun from primitives — pp9 ~10 parts, golden
~6, knife 3, camera 5, slappers 4 (hands). Functional but blocky.
**Change:** add detail/silhouette to **pp9, golden gun, knife, spy camera, slappers** (slide
serrations, bevels, a proper camera body + lens, defined gloved fingers). Contained to
GunMeshes; keep the soft-N64 look, no external assets.

## 20. Fix M1 ending — board the truck · M · low-med risk · DONE (2026-06-15)
**Built + truck remodelled.** `LevelDef.extraction.boardProp` turns exfil into an **F-interact at
the truck** instead of an auto-win region: `MissionSystem.boardExtract()` (+ shared `settleAndWin`)
fires from the `main.ts` interact when near the prop and `allRequiredDone()`; `allRequiredDone` now
treats a live freed escort as satisfied so it isn't circularly blocked. A roll-up **garage door**
prop (`PropType "garage"`, corrugated slats + frame) sits on the dock's south wall behind the truck.
**Truck model:** swapped the procedural box for a CC0 **Kenney truck GLB** (`public/models/truck.glb`
+ `Textures/colormap.png`) via a new `src/level/PropModels.ts` loader (flat-Lambert, auto-oriented,
scaled, fitted collider, olive `0x4d5942` tint multiplied over the atlas), preloaded alongside the
weapon/character assets; falls back to the box mesh if the GLB is absent. Verified in-game: truck
renders olive + textured (no console errors), board refused until objectives done, board → win on
Agent and Super (escort objective settles on board). Model previewed + approved by the user first.



**Now:** M1 exfil is a **region** in the dock's back corner (`m1_arkhangelsk.ts:293`
`{40,33→42,36}`); entering it after required objectives auto-wins (`MissionSystem.ts:219`).
A truck prop sits at (31.5,35) but isn't the exit, and there's **no dock/garage door** — so
you run into an empty corner, which reads oddly.
**Change:** make the **truck** the exfil — an "F — BOARD" interact at the truck completes
`extract` (extend the extract trigger to accept a prop/interact target, or move the
extraction region onto the truck and show the F prompt). Add a **roll-up garage door** to the
dock wall for the fiction of driving out. Mirror this onto other missions' exits later.

## 21. Mission awards · M · low-med risk

**Now:** `MissionSystem.stats` tracks `shotsFired/shotsHit/kills/alarmsTriggered` + time;
`rating()` is bonus-based. **No** tracking of damage taken, detection, or weapon-of-kill.
**Change:** add tracking — `damageTaken` (on player hit), `everDetected` (set when any guard
enters combat / spots the player), `meleeKills` (vs total). Award badges on the debrief:
**No Alarms** (`alarmsTriggered===0`), **No Damage** (`damageTaken===0`), **Undetected**
(`!everDetected`), **Pacifist** (`kills===0`), **Perfect Aim** (`shotsHit===shotsFired>0`),
**Silent Hands** (`kills>0 && meleeKills===kills`). Render as earned medals in
`Screens.showDebrief`.

## 22. Slot 8 → "EQUIPMENT" (mission-dependent) · M/L · med risk

**Now:** slot 8 is `{ key:8, label:"GADGET", members:["camera"] }`
(`src/weapons/WeaponDefs.ts:364`), fixed across levels.
**Change:** relabel to **EQUIPMENT** and drive its contents from the level — a new
`LevelDef.equipment?: string[]` the loadout reads, so a mission can grant a **lockpick** (new
gadget: hold-F / minigame to open a locked door without a keycard), the spy camera, mines,
etc. The relabel is trivial; the real work is the lockpick mechanic + per-level loadout wiring.

---

# Third batch (2026-06-14)

> Context: the realistic guns (pp9, dd4, golden, klobb, kr7, shotgun, sniper) were swapped to
> CC0 Quaternius GLB models (`src/weapons/WeaponModels.ts`; files in `public/models/q_*.glb`).
> railgun / camera / slappers / knife / lockpick / grenade / mines stay procedural (approved).
> The weapon test range (`src/level/levels/wtest.ts`) is now a firing range with downrange
> targets, bright lighting, full arsenal, and no difficulty (its menu button skips the briefing).

## 23. GLB weapon model fixes · M · low risk
The GLB swap is wired but the source models don't all fit:
- **pp9** has no suppressor (plain pistol) — attach a procedural suppressor to the GLB, or find a
  silenced-pistol model.
- **VZ-61 (klobb)** has a long rod poking out the back — wrong part/orientation in the Quaternius
  SMG; trim/re-fit or pick a different SMG (also affects dual-wield).
- **KR-7** uses an M16/AR-looking model — swap for a Russian AK-style CC0 model.
Per-weapon fit (scale/rotation/muzzle) also needs an eyeball pass — all in the `MODELS` table in
`src/weapons/WeaponModels.ts`.

## 24. Alarm audio — quieter + slower beep · S · low risk
The alarm is too loud and beeps too often (grating). Lower its gain and lengthen the beep
interval — `src/audio/Sfx.ts` (alarm tone) and the cadence in `src/ai/AlarmSystem.ts`.

## 25. Brighter mission lighting · S · low risk
Can't see far in missions. Raise ambient/hemi/region intensities (and/or cut fog density) in the
level `environment` blocks + `LevelBuilder` lighting. The firing range is bright as a reference.

## 26. Explosive barrels · S/M · low risk
`barrel` props are inert. Make them destructibles that explode (reuse the gas-tank / `explode`
path in `src/combat/Damage.ts`) — shootable, with a blast radius and chain potential.

## 27. Mission-start click shouldn't fire/alert guards · S · low risk
Clicking BEGIN / the menu carries into the first play frame as a fire input → a gunshot whose
noise alerts nearby guards at spawn. Swallow fire input for the first frame(s) after `beginPlay()`
(or until the mouse button is released).

## 28. Guards fire the weapon they drop · S · low risk · ALREADY DONE
**Verified 2026-06-14:** already correct. Ballistics/gunshot sound come from
`this.gun = GUNS[def.gun ?? def.kind]` (`Guard.ts:128`), the hand mesh + drop id from
`this.gunId = gunIdFor(def.kind, def.gun)` (`Guard.ts:129`), and the corpse drop is
`"weapon_" + this.gunId` (`Guard.ts:1006`) — all keyed off one id. A KR-7 guard fires the
KR-7 sound, holds the KR-7, and drops `weapon_kr7`. *Maintenance note (not a bug): the
`GUNS` table, `WeaponModels.ts` entries, and the `PickupType` union are coupled by string
keys — adding a new guard gun means updating all three or you get a runtime miss.*

## 29. Tune footstep sound level · S · low risk
Balance the footstep SFX volume — `src/audio/Sfx.ts:409` `footstep(run)` (run `0.16` / walk `0.08`).
**Note (2026-06-14):** this is *audio only* (what the player hears). It does **not** change what
guards hear. If guards detect footsteps from too far, that's the **noise radius** at
`src/player/Player.ts:256` — `emitNoise(pos, sneaking ? 4 : loud ? 13 : 8)`. Default movement is a
run (4.2 m/s > the 2.6 "loud" cutoff) → a 13 m pulse every step. To shorten guard hearing, lower
those radii (e.g. run 13→8, walk 8→5); crouch is already silent. Treat these as two separate knobs.

## 30. Lockpick must be actively used · M · low risk
Owning the lockpick currently opens a locked door with a plain F. Instead require *using* it:
equip it (slot 8) + hold-F / a short pick action at the door — no free instant open. Tighten the
door-interact branch in `src/main.ts` and the `pickLock` flow.

## 31. Lockpickable doors show a visible lock · S · low risk · DONE (2026-06-14)
Added a distinct **"pick"** lock type (map char **`P`**) separate from the keycard locks, and a
procedural padlock (dark backplate + brass body + steel shackle + keyhole) that renders on both
faces of any `pick` door at handle height (`src/level/Door.ts`, `buildLockBadge`). Pick doors open
only via the lockpick (keycard/plain-F return locked; prompt "LOCKED — NEEDS LOCKPICK" without it);
AI treats them as barriers (`Nav.ts`). Demo: the firing-range closet door is a `pick` door.
Keycard doors (lab/officer) are unchanged — verified M1's 4 locked doors get no padlock.
**Placement (2026-06-14):** M1's **Dr. Volkov jail cell** gate is now `lock: "pick"` — the lockpick
(granted by M1's equipment) is required to open the cell, free Volkov, and earn the lab keycard.
Gates can now carry a lock via `GateDef.lock` (`LevelTypes.ts`); the gate-interact branch in
`main.ts` enforces it ("LOCKED — NEEDS LOCKPICK" without one). Verified end-to-end: gate shows the
padlock, picking it opens it and makes it passable so Volkov can be freed.
Pairs with **#30** (make the lockpick require active use instead of the current instant-F open).

---

## Open / deferred

- **Damage falloff** — declined for now (range is a hard cutoff; revisit if guns feel too
  lethal at distance).
- **Dual-wield convergence offsets** — exact x values are a playtest tweak.
- **Camera cone tightening** — optional alongside the distance change.
- **Live screenshot of the dual-wield bug** — couldn't capture this session: a leftover dev
  server holds port 5174 in a process the shell can't kill (access denied), and the preview
  tool can't attach to an untracked server. Restart the preview server from the app to enable
  before/after screenshots.

## How to resume

1. Build top-to-bottom; bank items 1–3 first (trivial, no gameplay impact).
2. Each section names the exact file:line to start from.
3. For #7 and #8 (new fields), update `src/level/LevelTypes.ts` first, then the systems,
   then wire one level.
4. Type-check (`tsc --noEmit`) after each item; smoke-test in the preview (port 5174).
5. #8 needs a dedicated M1 balance/playtest pass before it's considered done.
