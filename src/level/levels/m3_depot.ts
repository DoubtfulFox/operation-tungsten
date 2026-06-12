import type { LevelDef } from "../LevelTypes";

/**
 * Mission 3 — Krasnaya Pad rail depot. The VX-90 leaves by armored
 * train tonight. 007 works through a warehouse of stacked crates (vault
 * country), frees the captured MI6 contact in the holding office, plants
 * charges on the engine, and runs for the platform under a scripted
 * 90-second escape once the train blows.
 *
 *  # wall   . floor   D door   L lab-key door   O officer-key door
 *  Tall interior (wallH 5). West = warehouse maze. Centre = the train on
 *  its track strip. East = dispatch office + holding cell.
 */
export const M3: LevelDef = {
  id: "m3",
  name: "KRASNAYA PAD DEPOT",
  briefing: {
    re: "KRASNAYA PAD RAIL DEPOT — VX-90 SHIPMENT",
    paragraphs: [
      "This is the end of the line, James — literally. The colonel is moving the entire VX-90 stockpile out " +
        "of the country by rail tonight, aboard an armored military train at the Krasnaya Pad depot. If it " +
        "leaves the yard, we lose it.",
      "One of ours — the agent who first flagged Arkhangelsk-7 — was taken trying to photograph the manifest. " +
        "He's held in the dispatch office. Get him out, get the manifest, and put the train beyond use. " +
        "When the charges blow, the whole garrison comes down on you. Be on that platform."
    ],
    outro: "Plant on the engine, detonate, and run for the north platform. Don't be a hero about the timing."
  },
  startToast: "Inside the depot. Work west through the warehouse — vault the crates (SPACE).",

  // 44 columns x 32 rows
  map: [
    "############################################", // 0
    "#........................#.................#", // 1
    "#..####..####..####......#.................#", // 2
    "#..#..#..#..#..#..#......#....######D####..#", // 3
    "#..#..#..#..#..#..#......#....#.........#..#", // 4
    "#..####..####..####......#....#.........#..#", // 5
    "#........................#....#.........#..#", // 6
    "#..####..####..####......D....######L####..#", // 7
    "#..#..#..#..#..#..#......#.................#", // 8
    "#..#..#..#..#..#..#......#.................#", // 9
    "#..####..####..####......#....######O####..#", // 10
    "#........................#....#.........#..#", // 11
    "#........................#....#.........#..#", // 12
    "####D#######D############D....#.........#..#", // 13
    "#..........................#..######D####..#", // 14
    "#.........................................##", // 15
    "#.........................................##", // 16  (track strip — train sits here)
    "#.........................................##", // 17
    "#..........................#..######D####..#", // 18
    "####D#######D############D....#.........#..#", // 19
    "#........................#....#.........#..#", // 20
    "#........................#....#.........#..#", // 21
    "#..####..####..####......#....######D####..#", // 22
    "#..#..#..#..#..#..#......#.................#", // 23
    "#..#..#..#..#..#..#......#.................#", // 24
    "#..####..####..####......D.................#", // 25
    "#........................#....######.......#", // 26
    "#..####..####..####......#....#....#.......#", // 27
    "#..#..#..#..#..#..#......#....#....#.......#", // 28
    "#..####..####..####......#....######.......#", // 29
    "#........................#.................#", // 30
    "############################################" // 31
  ],

  regions: [
    { name: "warehouse", x0: 1, z0: 1, x1: 23, z1: 12, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xffd9a0, intensity: 5 } },
    { name: "warehouse2", x0: 1, z0: 20, x1: 23, z1: 30, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xffd9a0, intensity: 5 } },
    { name: "platform", x0: 1, z0: 14, x1: 43, z1: 18, floorTex: "floorPlatform", wallTex: "metalWall", light: { color: 0xd0e0ff, intensity: 7 } },
    { name: "dispatch", x0: 30, z0: 3, x1: 38, z1: 6, floorTex: "floorTile", wallTex: "concreteWall", light: { color: 0xfff2cc, intensity: 6 } },
    { name: "holding", x0: 30, z0: 8, x1: 38, z1: 13, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xd8e2e8, intensity: 5 } },
    { name: "office", x0: 30, z0: 19, x1: 38, z1: 25, floorTex: "floorTile", wallTex: "concreteWall", light: { color: 0xffeccc, intensity: 6 } },
    { name: "corridor", x0: 0, z0: 0, x1: 43, z1: 31, floorTex: "floorMetal", wallTex: "metalWall" }
  ],

  corridorLights: [
    [25, 8],
    [25, 23],
    [40, 16],
    [6, 16]
  ],

  roomFixtures: [
    { x: 12, z: 4, c: 0xffd9a0, i: 5 },
    { x: 12, z: 9, c: 0xffd9a0, i: 5 },
    { x: 12, z: 24, c: 0xffd9a0, i: 5 },
    { x: 12, z: 27, c: 0xffd9a0, i: 5 },
    { x: 34, z: 4.5, c: 0xfff2cc, i: 6 }, // dispatch
    { x: 34, z: 10.5, c: 0xd8e2e8, i: 5 }, // holding
    { x: 34, z: 22, c: 0xffeccc, i: 6 }, // office
    { x: 12, z: 16, c: 0xd0e0ff, i: 7 }, // platform W
    { x: 34, z: 16, c: 0xd0e0ff, i: 7 } // platform E
  ],

  glowFixtures: [
    [20, 16],
    [28, 16]
  ],

  alarmLightPositions: [
    [16, 8],
    [70, 8],
    [16, 50],
    [70, 50],
    [50, 32]
  ],

  pipes: [
    { x0: 3, z0: 2.3, x1: 47, z1: 2.3, y: 4.6, r: 0.08, rust: true },
    { x0: 3, z0: 61.7, x1: 47, z1: 61.7, y: 4.6, r: 0.08, rust: true }
  ],

  signs: [
    { text: "СКЛАД", cx: 12, cz: 1, side: "N" },
    { text: "ДИСПЕТЧЕР", cx: 34, cz: 3, side: "N" },
    { text: "КАРЦЕР", cx: 30, cz: 10, side: "W" },
    { text: "ПЛАТФОРМА", cx: 2, cz: 14, side: "N" }
  ],

  props: [
    // warehouse crate maze (north) — vault country
    { type: "crate", cx: 5, cz: 15.3 },
    { type: "crate", cx: 9, cz: 15.3 },
    { type: "crate", cx: 7, cz: 12.5 },
    { type: "table", cx: 14, cz: 4 },
    { type: "crate", cx: 18, cz: 4 },
    { type: "crate", cx: 19, cz: 9 },
    { type: "barrel", cx: 21, cz: 11 },
    { type: "shelf", cx: 2.6, cz: 6, rot: 1 },
    // warehouse south
    { type: "crate", cx: 6, cz: 21 },
    { type: "crate", cx: 7.1, cz: 21.3 },
    { type: "barrel", cx: 19, cz: 24 },
    { type: "table", cx: 14, cz: 28 },
    { type: "crate", cx: 9, cz: 30 },
    // the train on the track strip
    { type: "engine", cx: 7, cz: 16, id: "train_engine", destructible: { hp: 9999, radius: 4.0, bulletImmune: true } },
    { type: "traincar", cx: 16, cz: 16 },
    { type: "traincar", cx: 25, cz: 16 },
    { type: "traincar", cx: 34, cz: 16 },
    // dispatch office (manifest)
    { type: "desk", cx: 32, cz: 4 },
    { type: "console", cx: 36.5, cz: 4 },
    { type: "documents", cx: 34, cz: 3.35, id: "manifest" },
    // holding cell (the contact)
    { type: "bed", cx: 31.5, cz: 12 },
    { type: "desk", cx: 37, cz: 9 },
    // office (east)
    { type: "desk", cx: 32, cz: 21 },
    { type: "table", cx: 36, cz: 23 },
    { type: "shelf", cx: 31, cz: 24.5 },
    // armory nook (SE) — the golden gun on 007's officer drops here too
    { type: "crate", cx: 31, cz: 27.5 },
    { type: "shelf", cx: 33.5, cz: 27.4 }
  ],

  pickups: [
    { type: "medkit", cx: 2.5, cz: 30.4 },
    { type: "ammo_9mm", cx: 5, cz: 6 },
    { type: "grenades", cx: 18, cz: 8 },
    { type: "armor", cx: 21, cz: 4 },
    { type: "ammo_rifle", cx: 21, cz: 24 },
    { type: "mines", cx: 14, cz: 24 },
    { type: "weapon_kr7", cx: 6, cz: 24 },
    { type: "ammo_rifle", cx: 6.6, cz: 24.5 },
    { type: "weapon_shotgun", cx: 37, cz: 24 },
    { type: "ammo_shells", cx: 36.4, cz: 24.5 },
    { type: "medkit", cx: 31, cz: 20 },
    { type: "ammo_9mm", cx: 33, cz: 11 },
    { type: "armor", cx: 40, cz: 16 },
    { type: "weapon_knife", cx: 3, cz: 27 }
  ],

  guards: [
    // platform patrols
    { kind: "guard", cx: 20, cz: 15, route: [[3, 15], [40, 15]], gun: "klobb" },
    { kind: "guard", cx: 20, cz: 17, route: [[40, 17], [3, 17]], gun: "klobb" },
    // warehouse
    { kind: "guard", cx: 12, cz: 6, route: [[4, 6], [22, 6]] },
    { kind: "guard", cx: 12, cz: 11, route: [], facing: 0 },
    { kind: "guard", cx: 12, cz: 23, route: [[4, 26], [22, 23]] },
    { kind: "guard", cx: 19, cz: 28, route: [], facing: Math.PI },
    // the officer with the keycard works the centre aisle
    { kind: "officer", cx: 25, cz: 10, route: [[25, 4], [25, 26]], keycard: "officer" },
    // dispatch + holding
    { kind: "guard", cx: 34, cz: 5, route: [], facing: Math.PI / 2 },
    { kind: "heavy", cx: 34, cz: 11, route: [], facing: -Math.PI / 2 },
    // office (east) — the colonel's guard captain carries the Golden Gun on 007
    { kind: "officer", cx: 34, cz: 22, route: [[31, 21], [37, 24]], keycard: "lab", gun: "golden" },
    { kind: "guard", cx: 40, cz: 22, route: [], facing: Math.PI }
  ],

  alarmPanels: [
    { id: "ap_plat_w", cx: 2, cz: 15, side: "W" },
    { id: "ap_plat_e", cx: 41, cz: 17, side: "E" },
    { id: "ap_ware", cx: 12, cz: 1, side: "N" },
    { id: "ap_disp", cx: 38, cz: 4, side: "E" },
    { id: "ap_office", cx: 38, cz: 22, side: "E" }
  ],

  playerStart: { cx: 41, cz: 30, yaw: Math.PI },

  // north platform extraction (only arms after detonation)
  extraction: { x0: 1, z0: 14, x1: 4, z1: 17 },

  reinforcementSpawns: [
    [25, 1],
    [25, 30],
    [41, 1]
  ],

  environment: {
    fog: { color: 0x07090c, density: 0.03 },
    background: 0x07090c,
    ambient: { color: 0x9aa0ac, intensity: 0.72 },
    hemi: { sky: 0x4e5664, ground: 0x282c24, intensity: 0.7 }
  },

  wallH: 5,

  npcs: [
    {
      // held in the keycard-locked holding room (the L door gates access)
      id: "agent",
      kind: "scientist",
      x: 68,
      z: 21,
      yaw: -Math.PI / 2,
      hideCell: [34, 16],
      freePrompt: "F — FREE THE MI6 CONTACT",
      freeToasts: ['CONTACT: "Took you long enough. The manifest is in dispatch — go!"'],
      killFailReason: "The MI6 contact was killed before you could free him.",
      grantsKeycard: "officer"
    }
  ],

  escape: { afterObjective: "o_train", seconds: 90, failReason: "The depot garrison overran the platform before you reached the train." },

  musicTheme: "m3",

  objectives: [
    { id: "o_contact", label: "Free the captured MI6 contact", trigger: { kind: "freeNpc", npcId: "agent" } },
    { id: "o_manifest", label: "Photograph the shipment manifest", trigger: { kind: "photo", targetId: "manifest" } },
    { id: "o_train", label: "Plant charges and destroy the engine", trigger: { kind: "destroyAll", ids: ["train_engine"] } },
    { id: "o_extract", label: "Escape via the north platform", trigger: { kind: "extract" } },
    { id: "s_alarm", label: "Reach the train without raising an alarm", bonus: true, trigger: { kind: "noAlarm" } },
    { id: "s_agent", label: "The contact survives", bonus: true, minDifficulty: "super", trigger: { kind: "npcSurvives", npcId: "agent" } },
    { id: "s_golden", label: "Recover the Golden Gun", bonus: true, requiredAt: "007", trigger: { kind: "pickup", pickupType: "weapon_golden" } }
  ]
};
