# Mission 4 — "Mamayev Memorial Park" (proposal / build spec)

> Resume point for building M4. The **authoritative ASCII map and tables live in
> `src/level/levels/m4_mamayev.ts`** — this file is the design intent + a build
> checklist so work can be picked up later without re-deriving anything.

## Build status

- [x] `PROPOSED_MISSION_4.md` — this file
- [x] `types.ts` — added `"statue" | "monument"` to `PropType`
- [x] `LevelBuilder.ts` — `buildProp` cases for `statue` + `monument`; stone/bronze materials
- [x] `Music.ts` — added `m4` theme to `THEMES`
- [x] `src/level/levels/m4_mamayev.ts` — the full `LevelDef`
- [x] `src/level/levels/index.ts` — imported `M4`, added to `LEVELS` (`[M1, M4]` for now)
- [x] `tsc --noEmit` passes; all 28 map rows verified 36 wide
- [x] Adversarial verification workflow — 4 low/cosmetic findings, all addressed
- [x] Runtime smoke test — M4 loads & renders in-browser (port 5174), no console errors;
      11 guards / GRANITE / 7 destructibles / 6 objectives on Agent (difficulty gating confirmed)
- [ ] Playtest pass (balance: ambush wave size, floodlight coverage, sightlines, escape window)

### Verification findings (resolved)
- ammo_shells (6,6) was under the NW guard → moved to (5,6).
- Pavilion guard (30,12) stood on the SVD stash → moved to (30,11).
- SE medkit (31,21) sat inside the staff_car collider footprint → moved to (32,21).
- Escape window 90s → 60s (was trivially slack; still forgiving, tune in playtest).
- Statue collider documented as ≈0.6 (matches the nav-block-threshold-tuned value).

## Concept & lineage

This is Operation Tungsten's take on GoldenEye's **Statue** level. Anchored to the
real **Mamayev Kurgan** war memorial (Volgograd, *The Motherland Calls*), which:
- keeps the place-name convention (Arkhangelsk-7 → Zapolyarnye-9 → Mamayev),
- gives a **colossal central monument** that doubles as a navigation landmark,
- reuses M2's snowy-night outdoor palette (`floorSnow` / `snowWall` / fog / dim sun),
  so the only genuinely new visual asset is the **statue prop**.

Night. Fog. Floodlit bronze figures in pools of light; darkness in the gaps.

## Story / campaign slot

MI6's man in-country, codename **GRANITE**, has the colonel's buyer list and the
VX-90 shipment route, and will only pass it in the open. The colonel reads the
meet and rings the park. 007 inserts quiet, takes the dossier — and the moment it
changes hands the cordon drops. Fight out to the north-east gate.

(Slots after M2/M3 in the campaign. Final `LEVELS` order should be
`[M1, M2, M3, M4]` once M2/M3 are wired; until then M4 is appended so it's
reachable for testing — see index.ts note.)

## Layout (north ↑)

```
  NW terrace (statues)            N wall / EXFIL (NE gate)
  +----------------------------------------------+
  |  ✦  ✦        [floodlit plaza]            EXIT |
  |     ✦      ✦   ▟▙ MONUMENT ▟▙        ✦        |
  |            ✦   (rendezvous)      ┌──────────┐ |
  |        ✦      ✦   • GRANITE      │ PAVILION │ |
  |    ✦        colonnade  ✦         │  stash + │ |
  |        ✦   ✦      ✦              │  panel   │ |
  |   ✦      [ statue avenue ]       └────D─────┘ |
  | INSERT      ✦      ✦         motor pool 🚚🚚   |
  +----------------------------------------------+
   SW gate (player start)          SE (staff car / comms truck)
```

- **Outdoor** snowy park (`courtyard` = fallback region, `outdoor: true`).
- **plaza** — paved (`floorTile`) central region; entering it = `o_meet`.
- **pavilion** — the one *indoor* room (E side), 3×3 interior, west-facing door;
  holds the SVD stash + an alarm panel.
- **monument** — colossal statue prop at park center; landmark + hard cover.
- Statues line a south→plaza colonnade and dot the quadrants (cover / LOS blockers).
- Floodlights at the corners and flanking the monument; dark lanes between.
- Motor pool (SE) parks the **staff car** + **comms truck** (destructible bonuses).

## Beats

1. **Infiltrate (stealth):** SW insert → up the statue colonnade to the monument.
   Statues break line of sight; floodlit ground is the danger. No-alarm window.
2. **Contact (hinge):** reach GRANITE at the monument, take the dossier → **springs
   the ambush** (scripted alarm + reinforcement waves), GRANITE bolts for cover.
3. **Break out (combat):** waves flank from the NE gate / pavilion / N wall. Open
   ground + statue cover showcases the guard AI. Exfil NE before the window closes.

## Objectives (exact)

**Required (spine):**
| id | label | trigger |
|---|---|---|
| `o_meet` | Reach the rendezvous at the central monument | `enterRegion: plaza` |
| `o_contact` | Make contact and recover the dossier | `freeNpc: granite` |
| `o_extract` | Exfiltrate through the north-east gate | `extract` |

**Bonus (difficulty-gated, GoldenEye-style):**
| id | label | trigger | gate |
|---|---|---|---|
| `s_alarm` | Reach the contact without raising an alarm | `noAlarm` | all |
| `s_granite` | GRANITE survives the ambush | `npcSurvives: granite` | `minDifficulty: super` |
| `s_comms` | Knock out the colonel's comms truck | `destroyAll: [comms_truck]` | `minDifficulty: super` |
| `s_staffcar` | Destroy the colonel's staff car | `destroyAll: [staff_car]` | `requiredAt: 007` |
| `s_sniper` | Recover the marksman rifle from the pavilion | `pickup: weapon_sniper` | all |

**Ambush wiring:** `escape: { afterObjective: "o_contact", seconds: 90, failReason }`.
Completing `o_contact` fires a *scripted* alarm (bonus-safe — it does **not** void
`s_alarm`), spawns reinforcement waves, and opens the 90s exfil window.

## NPC

`granite` — `kind: "scientist"` (civilian tint), waits at the monument, flees to a
NW corner hide-cell when the ambush triggers. `killFailReason` set. Reuses the
existing `Scientist`/`Npc` flee-and-survive logic; no new NPC code.

## Engine additions (the only new code beyond the level file)

1. **`statue` prop** (`PropType` + `buildProp`): stone plinth + bronze figure,
   ~2.4 m tall, full-height LOS-blocking collider (`hw≈0.6, hh≈1.2, hd≈0.6` —
   `0.6×0.6 = 0.36` is just over the 0.35 nav-block threshold so guards path around it).
2. **`monument` prop**: colossal stepped-plinth statue, ~6 m, `hw≈1.3, hh≈3, hd≈1.3`.
   Indestructible scenery.
3. New `pm` materials in LevelBuilder: `stone` (granite), `stoneDark`, `bronze`.
4. **`m4` music theme** in `Music.ts` `THEMES` (A-minor, brooding → driving;
   bpm ~104; same 4-layer pattern shape as the others).
5. Everything else reuses existing systems: floodlights, fog/sun, reinforcements,
   the escape/ambush subsystem, cover spots, scientist NPC.

## How to resume

1. Work the **Build status** checklist top-to-bottom.
2. The level file is the source of truth for coords; this doc is intent.
3. After writing the map, **validate every row is the same width** (a one-line
   script) — miscounting ASCII rows is the #1 failure mode.
4. Run the adversarial verification workflow (grid integrity, type/ID consistency,
   gameplay reachability, faithfulness to this spec), then fix findings.
5. Balance pass: wave size is capped in `AlarmSystem` (≤8 spawned, ≤5 alive);
   tune floodlight count and statue spacing for the stealth↔exposure rhythm.

## Open tweaks (decide during playtest)

- Make it the **finale** by adding the colonel as a `gun:"golden"` guard at the
  monument (drops the Golden Gun) — currently designed as a mid/late mission.
- Frozen **reflecting pool** in the NW was simplified to a statue terrace to avoid
  a new water/ice asset; add an `ice` texture later if wanted.
- Pavilion door could be `O` (officer-locked) to gate the SVD stash behind the
  patrolling officer's keycard — currently unlocked `D`.
