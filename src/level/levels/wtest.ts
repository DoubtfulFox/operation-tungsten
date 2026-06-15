import type { LevelDef } from "../LevelTypes";

/**
 * Weapon test range — an indoor firing range. Not part of the campaign
 * (reached from the menu's WEAPON TEST RANGE button, which skips the briefing
 * so there is no difficulty to pick). The player spawns with the full arsenal;
 * downrange targets at three distances are there to shoot.
 */
export const WTEST: LevelDef = {
  id: "wtest",
  name: "WEAPON TEST RANGE",
  briefing: {
    re: "WEAPON TEST RANGE",
    paragraphs: ["Live-fire range. Cycle the arsenal (keys 1–8) and put rounds downrange."],
    outro: "Have at it, 007."
  },
  startToast: "Firing range — keys 1–8 to cycle, RMB to aim. Locked PADLOCK door in the SE corner (preview).",

  // 14 columns x 24 rows. Bottom-right is a small walled closet behind a
  // pickable padlocked door ("P") — shows the visible-padlock feature (#31).
  map: [
    "##############",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#.........####",
    "#........#...#",
    "#........P...#",
    "#........#...#",
    "##############"
  ],

  regions: [
    { name: "range", x0: 0, z0: 0, x1: 13, z1: 23, floorTex: "floorConcrete", wallTex: "concreteWall", light: { color: 0xfff4e0, intensity: 9 } }
  ],

  corridorLights: [],
  roomFixtures: [
    { x: 15, z: 7, c: 0xffffff, i: 9 },
    { x: 15, z: 19, c: 0xffffff, i: 9 },
    { x: 15, z: 31, c: 0xffffff, i: 9 },
    { x: 15, z: 43, c: 0xffffff, i: 9 }
  ],
  glowFixtures: [],
  alarmLightPositions: [],
  pipes: [],
  signs: [{ text: "ТИР", cx: 7, cz: 1, side: "N" }],

  props: [
    // downrange targets — far row
    { type: "target", cx: 2.5, cz: 3 },
    { type: "target", cx: 4.75, cz: 3 },
    { type: "target", cx: 7, cz: 3 },
    { type: "target", cx: 9.25, cz: 3 },
    { type: "target", cx: 11.5, cz: 3 },
    // mid row
    { type: "target", cx: 4, cz: 9 },
    { type: "target", cx: 7, cz: 9 },
    { type: "target", cx: 10, cz: 9 },
    // near row
    { type: "target", cx: 5.5, cz: 15 },
    { type: "target", cx: 8.5, cz: 15 },
    // firing-line benches (the cx:10 bench moved out — that cell is now the closet)
    { type: "table", cx: 4, cz: 20 },
    { type: "table", cx: 7, cz: 20 },
    // two adjacent explosive barrels — shoot one to test the #26 chain reaction
    { type: "barrel", cx: 1.5, cz: 19 },
    { type: "barrel", cx: 2.5, cz: 19 }
  ],

  pickups: [],
  guards: [],
  alarmPanels: [],

  playerStart: { cx: 7, cz: 21, yaw: 0 },
  // unreachable corner — the range never "completes"
  extraction: { x0: 0, z0: 0, x1: 0, z1: 0 },
  reinforcementSpawns: [],

  environment: {
    fog: { color: 0x20242c, density: 0.008 },
    background: 0x20242c,
    ambient: { color: 0xeef0f4, intensity: 1.1 },
    hemi: { sky: 0xd0d6e0, ground: 0x9498a0, intensity: 1.0 }
  },

  musicTheme: "m1",

  // full arsenal (pp9, slappers, mines, camera are owned by default)
  equipment: ["dd4", "kr7", "shotgun", "klobb", "klobb_dual", "sniper", "railgun", "golden", "knife", "grenade", "lockpick"],

  objectives: []
};
