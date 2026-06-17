# OPERATION TUNGSTEN

A GoldenEye 007–style first-person stealth-action game for Windows. Four
missions, a full stealth/alarm sandbox, and a procedural N64 aesthetic —
every texture and most sounds are generated in code.

*Unofficial tribute. Not affiliated with the James Bond franchise or Rare.*

---

## ▶ Download & install

1. Go to the **[latest release](https://github.com/DoubtfulFox/operation-tungsten/releases/latest)**.
2. Download **`OperationTungsten-Setup-0.1.0.exe`**.
3. Run it. Windows SmartScreen may warn because the installer is unsigned —
   click **More info → Run anyway**.
4. Launch **Operation Tungsten** from the Start menu or desktop shortcut.

Windows 10/11, 64-bit. Offline single-player — no account, no internet
needed after download. Your progress, settings and control bindings are
saved automatically and survive reinstalls and updates.

---

## The campaign

Four missions, unlocked in order. Each has its own briefing, objectives
and bonus objectives, played at one of three difficulties — **Agent**,
**Super Agent**, **007** — that scale both the guards and how many
objectives are mandatory.

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
| Left / right mouse | Fire / aim |
| R | Reload |
| Interact | Doors, grates, locks, Dr. Volkov |
| Crouch | Get through the vents and stay quiet |
| Vault | Hop low cover |
| Sneak | Quiet movement (toggle) |
| Weapon wheel | Hold to open the radial wheel; mouse-wheel to quick-cycle |
| Weapon function | Suppressor / mine mode / akimbo, depending on weapon |
| Watch | Objectives, gear, controls, options, abort |

Every control is **fully rebindable** to any key or mouse button — open
the **CONTROLS** panel on the main menu or the watch's CONTROLS tab,
click a binding, and press the input you want. Bindings persist locally.

## How the stealth works

- Guards have vision cones and investigate **noise** — crouch, sneak and
  run are progressively louder; the silenced PP9 is whisper-quiet while
  everything else carries 30m+.
- Guards who spot you may **run for a wall-mounted alarm panel** (officers
  almost always do). Shoot the runner or the panel.
- In a firefight they **dodge-roll**, **duck behind cover** between
  bursts, and **lob a grenade** if you camp one spot. Alarm
  reinforcements **flank** in from multiple directions.
- Sneak up behind an unaware guard with the **slappers or knife** for a
  silent takedown. Bodies stay put — and a guard who finds one raises the
  alarm.
- Headshots kill instantly. Dead guards drop their weapons; officers drop
  keycards.

## Arsenal & extras

- Curate up to **8 weapons** on the radial wheel from the **GEAR** screen.
  Melee, three pistols (incl. the hidden **Golden Gun**), the **VZ-61**
  machine pistol (toggle **akimbo** with the weapon-function button), the
  scoped **SVD sniper** and the charge-up **GAUSS railgun**, grenades,
  remote/proximity mines and the spy camera.
- The watch holds a **Modifiers** page of GoldenEye-style cheats — big
  head, paintball, turbo, invincibility, infinite ammo, all guns, slow
  motion, tiny guards — all freely toggleable.

---

*Built with Three.js + TypeScript, packaged for Windows with Electron.
Character models are CC0 work by [Quaternius](https://quaternius.com) via
[Poly Pizza](https://poly.pizza); everything else is generated in code.*
