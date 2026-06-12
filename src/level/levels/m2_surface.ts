import type { LevelDef } from "../LevelTypes";

/**
 * Mission 2 — Zapolyarnye-9 surface bunker. Snowy floodlit courtyards
 * ring a half-buried comms bunker; the pools of light are the stealth
 * language, the darkness between them is yours.
 *
 * Layout (40 x 20 cells): an open outdoor yard wraps a 20x11 bunker.
 * North hall = comms (the dish). South-west = ops (launch codes,
 * officer-locked). South-east = generator room.
 */
export const M2: LevelDef = {
  id: "m2",
  name: "ZAPOLYARNYE-9 BUNKER",
  briefing: {
    re: "ZAPOLYARNYE-9 RELAY STATION",
    paragraphs: [
      "The colonel's buyers talk to Arkhangelsk-7 through a relay bunker above the arctic circle. " +
        "Moscow can't hear the traffic; we'd prefer nobody could. The station uplinks launch codes " +
        "for the VX-90 delivery rockets every six hours — the next window is yours.",
      "It's open ground, James. The floodlights sweep the yard and the snow holds every footprint. " +
        "Stay in the dark, and if you must use the SVD they keep on site, remember the whole yard will hear it."
    ],
    outro: "Photograph the codes before you cut the link — M wants both the evidence and the silence."
  },
  startToast: "Breach point reached. Cross the yard — stay out of the light.",

  // 40 columns x 20 rows
  map: [
    "########################################", // 0
    "#......................................#", // 1
    "#......................................#", // 2
    "#......................................#", // 3
    "#.........###########D########.........#", // 4
    "#.........#..................#.........#", // 5
    "#.........#..................#.........#", // 6
    "#.........#..................#.........#", // 7
    "#.........#..................#.........#", // 8
    "#.........####D##########O####.........#", // 9
    "#.........#.........#........#.........#", // 10
    "#.........#.........#........#.........#", // 11
    "#.........#.........D........#.........#", // 12
    "#.........#.........#........#.........#", // 13
    "#.........#######D############.........#", // 14
    "#......................................#", // 15
    "#......................................#", // 16
    "#......................................#", // 17
    "#......................................#", // 18
    "########################################" // 19
  ],

  regions: [
    { name: "comms", x0: 11, z0: 5, x1: 28, z1: 8, floorTex: "floorMetal", wallTex: "metalWall", light: { color: 0xbfe8ff, intensity: 6 } },
    { name: "ops", x0: 11, z0: 10, x1: 19, z1: 13, floorTex: "floorTile", wallTex: "concreteWall", light: { color: 0xfff2cc, intensity: 6 } },
    { name: "genroom", x0: 21, z0: 10, x1: 28, z1: 13, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xffd9a0, intensity: 5 } },
    // the yard is the fallback: open sky, snow underfoot
    { name: "courtyard", x0: 0, z0: 0, x1: 39, z1: 19, floorTex: "floorSnow", wallTex: "snowWall", outdoor: true }
  ],

  corridorLights: [],

  roomFixtures: [
    { x: 15, z: 6.5, c: 0xbfe8ff, i: 5.5 }, // comms W
    { x: 24, z: 6.5, c: 0xbfe8ff, i: 5.5 }, // comms E
    { x: 15, z: 11.5, c: 0xfff2cc, i: 5 }, // ops
    { x: 24.5, z: 11.5, c: 0xffd9a0, i: 5 } // generator room
  ],

  glowFixtures: [],

  alarmLightPositions: [
    [40, 4],
    [40, 26],
    [14, 14],
    [66, 14]
  ],

  pipes: [
    // generator exhaust run along the bunker's south face
    { x0: 23, z0: 28.6, x1: 57, z1: 28.6, y: 2.6, r: 0.07, rust: true }
  ],

  signs: [
    { text: "СВЯЗЬ", cx: 22, cz: 4, side: "N" },
    { text: "ШТАБ", cx: 14, cz: 14, side: "S" },
    { text: "ГЕНЕРАТОР", cx: 26, cz: 14, side: "S" }
  ],

  props: [
    // floodlights command the yard
    { type: "floodlight", cx: 5, cz: 3 },
    { type: "floodlight", cx: 34, cz: 3 },
    { type: "floodlight", cx: 5, cz: 16 },
    { type: "floodlight", cx: 34, cz: 16 },
    // yard cover
    { type: "crate", cx: 6.5, cz: 7 },
    { type: "crate", cx: 7.6, cz: 7.4 },
    { type: "barrel", cx: 6.8, cz: 8.4 },
    { type: "crate", cx: 33, cz: 12 },
    { type: "crate", cx: 32.2, cz: 13.1 },
    { type: "truck", cx: 35.5, cz: 8.5 },
    { type: "fence", cx: 17, cz: 2, rot: 0 },
    { type: "fence", cx: 23, cz: 2, rot: 0 },
    // fuel bowsers (007 must burn the stockpile)
    { type: "barrel", cx: 32.5, cz: 4.5, id: "bowser_a", destructible: { hp: 50, radius: 2.6, bulletImmune: false } },
    { type: "barrel", cx: 7.5, cz: 14.5, id: "bowser_b", destructible: { hp: 50, radius: 2.6, bulletImmune: false } },
    // comms hall
    { type: "dish", cx: 24, cz: 7, id: "dish", destructible: { hp: 150, radius: 2.2, bulletImmune: false } },
    { type: "console", cx: 13, cz: 5.6 },
    { type: "console", cx: 16, cz: 5.6 },
    { type: "shelf", cx: 27.6, cz: 8 },
    { type: "table", cx: 19, cz: 7.5 },
    // ops room
    { type: "desk", cx: 13, cz: 11 },
    { type: "desk", cx: 17, cz: 12.5 },
    { type: "documents", cx: 14.5, cz: 10.35, id: "launchcodes" },
    { type: "shelf", cx: 18.5, cz: 10.6 },
    // generator room
    { type: "generator", cx: 24.5, cz: 12.5, id: "generator", destructible: { hp: 120, radius: 1.8, bulletImmune: false } },
    { type: "barrel", cx: 27.4, cz: 13.3 },
    { type: "barrel", cx: 26.5, cz: 13.5 },
    { type: "crate", cx: 21.8, cz: 13.2 }
  ],

  pickups: [
    { type: "medkit", cx: 2.5, cz: 17.5 },
    { type: "ammo_9mm", cx: 6.8, cz: 7.8 },
    { type: "armor", cx: 35.5, cz: 9.6 },
    { type: "ammo_rifle", cx: 33, cz: 12.6 },
    { type: "grenades", cx: 27, cz: 13 },
    { type: "weapon_sniper", cx: 18.5, cz: 11 },
    { type: "ammo_rifle", cx: 18.9, cz: 11.6 },
    { type: "medkit", cx: 13, cz: 12.8 },
    { type: "ammo_9mm", cx: 19, cz: 6.8 },
    { type: "ammo_shells", cx: 27.2, cz: 7.6 }
  ],

  guards: [
    // yard patrols — conscripts with cheap SMGs
    { kind: "guard", cx: 20, cz: 2, route: [[3, 2], [36, 2]], gun: "klobb" },
    { kind: "guard", cx: 20, cz: 17, route: [[36, 17], [3, 17]], gun: "klobb" },
    { kind: "guard", cx: 2, cz: 10, route: [[2, 4], [2, 16]], gun: "klobb" },
    { kind: "guard", cx: 37, cz: 10, route: [[37, 4], [37, 16]] },
    // the officer with the keycard circles the bunker
    { kind: "officer", cx: 10, cz: 5, route: [[10, 2], [30, 2], [30, 17], [10, 17]], keycard: "officer" },
    // posted marksman covering the long west run
    { kind: "guard", cx: 36, cz: 5, route: [], facing: Math.PI / 2, gun: "sniper" },
    // yard posts
    { kind: "guard", cx: 8, cz: 3, route: [], facing: Math.PI },
    { kind: "guard", cx: 31, cz: 15, route: [], facing: 0 },
    // comms hall
    { kind: "guard", cx: 14, cz: 7, route: [[12, 6], [26, 6]] },
    { kind: "heavy", cx: 26, cz: 7, route: [], facing: Math.PI / 2 },
    // ops + generator
    { kind: "guard", cx: 16, cz: 12, route: [], facing: 0 },
    { kind: "guard", cx: 23, cz: 11, route: [], facing: Math.PI }
  ],

  alarmPanels: [
    { id: "ap_yard_n", cx: 20, cz: 1, side: "N" },
    { id: "ap_yard_s", cx: 12, cz: 18, side: "S" },
    { id: "ap_comms", cx: 11, cz: 6, side: "W" },
    { id: "ap_gen", cx: 28, cz: 12, side: "E" }
  ],

  playerStart: { cx: 2, cz: 18, yaw: -Math.PI / 2 },

  // the breach in the north wall
  extraction: { x0: 17, z0: 1, x1: 22, z1: 2 },

  reinforcementSpawns: [
    [2, 2],
    [37, 18],
    [37, 2]
  ],

  environment: {
    fog: { color: 0x0a0e16, density: 0.034 },
    background: 0x0a0e16,
    ambient: { color: 0x9aa8c0, intensity: 0.55 },
    hemi: { sky: 0x4a5870, ground: 0x303636, intensity: 0.6 },
    sun: { color: 0xbfd0ea, intensity: 0.45, dir: [-30, 50, -18] }
  },

  wallH: 4,
  musicTheme: "m2",

  objectives: [
    { id: "o_dish", label: "Destroy the uplink dish", trigger: { kind: "destroyAll", ids: ["dish"] } },
    { id: "o_codes", label: "Photograph the launch codes", trigger: { kind: "photo", targetId: "launchcodes" } },
    { id: "o_extract", label: "Exfiltrate through the north breach", trigger: { kind: "extract" } },
    { id: "s_alarm", label: "Complete the mission without an alarm", bonus: true, trigger: { kind: "noAlarm" } },
    { id: "s_generator", label: "Sabotage the generator", bonus: true, minDifficulty: "super", trigger: { kind: "destroyAll", ids: ["generator"] } },
    { id: "s_bowsers", label: "Burn the fuel reserves", bonus: true, requiredAt: "007", trigger: { kind: "destroyAll", ids: ["bowser_a", "bowser_b"] } },
    { id: "s_svd", label: "Recover the SVD-63 marksman rifle", bonus: true, trigger: { kind: "pickup", pickupType: "weapon_sniper" } }
  ]
};
