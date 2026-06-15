# OPERATION TUNGSTEN

A browser-based, GoldenEye 007–style first-person mission. One level, full
stealth/alarm sandbox, procedural N64 aesthetic — no external assets, every
texture and sound is generated in code.

## Run it

```bash
npm install
npm run dev      # then open http://localhost:5174
```

`npm run build` produces a static `dist/` you can host anywhere.

## The campaign

Four missions, unlocked in order. Each has its own briefing, objectives
and bonus objectives, picked on the briefing screen at one of three
difficulties — **Agent**, **Super Agent**, **007** — that scale both the
guards and how many objectives are mandatory.

1. **Arkhangelsk-7 Facility** — infiltrate the chemical-weapons plant
   through the vents, free Dr. Volkov, photograph the VX-90 formula, mine
   both nerve-gas tanks and escape the loading dock.
2. **Zapolyarnye-9 Bunker** — a snowy, floodlit surface station. Cross
   the open yard in the dark, destroy the uplink dish and photograph the
   launch codes before you cut the link.
3. **Krasnaya Pad Depot** — the rail finale. Free the captured MI6
   contact, photograph the shipment manifest, plant charges on the
   armored train's engine, then run for the platform on a 90-second
   escape clock.
4. **Mamayev Memorial Park** — a midnight rendezvous with the agent
   GRANITE at a floodlit war memorial that springs into an ambush; take
   the dossier and fight out to the north-east gate.

**Bonus objectives** (no alarms, optional pickups/sabotage, keeping
contacts alive) feed the debrief rating: Agent → Secret Agent → 00 Agent.
Higher difficulties promote some bonuses into required objectives.

## Controls

| Input | Action |
|---|---|
| WASD + mouse | Move / look |
| LMB / RMB | Fire / aim (scope on the railgun, detonate on mines) |
| R | Reload |
| F | Interact — doors, grates, locks, Dr. Volkov |
| C | Crouch (you'll need it in the vents) |
| Space | Vault over low cover |
| Shift | Sneak quietly |
| 1–8 / wheel | Weapon select |
| Tab / Esc | The watch — objectives, gear, controls, options, abort |

Every control is **fully rebindable** to any key or mouse button — open
the **CONTROLS** panel on the main menu or the watch's CONTROLS tab,
click a binding, and press the input you want. Bindings persist locally.

## Gunplay

- Spread is live: it blooms as you fire, widens while moving, tightens
  when crouched or aiming — watch the crosshair.
- Bullets **penetrate doors and thin cover** at half damage. Guards
  camping behind a door are not safe (and neither are you).
- Bullet holes persist; spent casings hit the floor; the railgun scope
  sways unless you crouch.
- **GoldenEye aim assist** (hip-fire magnetism) is on by default —
  toggle it in the watch options.

## How the stealth works

- Guards have vision cones and investigate **noise**: the silenced PP9 is
  whisper-quiet, everything else carries 30m+.
- Guards who spot you may **run for a wall-mounted alarm panel** (officers
  almost always do). Shoot the runner or the panel.
- In a firefight they **dodge-roll**, **duck behind cover** between
  bursts, and **lob a grenade** if you camp one spot. Alarm
  reinforcements **flank** in from multiple directions.
- Unaware guards have a life of their own — they stretch, wander their
  post, and check the radio. Sneak up behind one with the **slappers or
  knife** for a silent takedown.
- An active alarm spawns waves of reinforcements that hunt you.
- Headshots kill instantly. Bodies attract attention until they fade.
- Dead guards drop their weapons; officers drop keycards.

## Arsenal & extras

- Grouped weapon slots (1–8) — tap a slot key again to cycle within it.
  Melee, three pistols (incl. the hidden **Golden Gun**), the **VZ-61**
  machine pistol (grab a second for **dual-wield**), the scoped **SVD
  sniper** and the **GAUSS railgun**, grenades, mines and the camera.
- The watch holds a **Modifiers** page of GoldenEye-style cheats — big
  head, paintball, turbo, invincibility, infinite ammo, all guns, slow
  motion, tiny guards — all freely toggleable, and a **Controls** page.

## Tech

Three.js + Vite + TypeScript. Custom AABB physics, grid A* AI navigation,
procedural noise-based textures with baked vertex shading, and a 272p
bilinear render pipeline for the authentic soft N64-through-composite
look (toggle in the watch options). Levels are pure data (`LevelDef`), so
the four missions share one builder and one objective engine.

Audio is a WebAudio synth engine with a **step-sequenced dynamic score**
— per-level themes whose bass/perc/pad/lead layers crossfade between
stealth, combat and alarm. Drop CC0 `.ogg` files into `public/audio/` to
overlay recorded gunshots/impacts; anything missing falls back to synth.

Characters are rigged, skeletally-animated CC0 models by
[Quaternius](https://quaternius.com) (SWAT / Business Man / Worker from
the Ultimate Modular Men pack, via [Poly Pizza](https://poly.pizza)),
retinted to fit the palette. Everything else is generated in code.

*Unofficial tribute. Not affiliated with the James Bond franchise or Rare.*
