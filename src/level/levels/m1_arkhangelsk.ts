import type { LevelDef } from "../LevelTypes";

/**
 * Mission 1 — the Arkhangelsk-7 chemical facility.
 *
 *  # wall   . floor   v vent (low ceiling)   G vent grate
 *  D door   L lab-keycard door   O officer-keycard door
 *
 * Layout: a rectangular corridor ring with rooms inside and out.
 *   NW vent -> bathroom -> west corridor.  North band: barracks,
 *   storage, records office.  Center corridor.  South band: server
 *   room, cell block, main lab, armory, mess.  Loading dock SE.
 */
export const M1: LevelDef = {
  id: "m1",
  name: "ARKHANGELSK-7 FACILITY",
  briefing: {
    re: "ARKHANGELSK-7 CHEMICAL FACILITY",
    paragraphs: [
      "Our friends in Moscow deny the facility exists, which is how we know it matters. " +
        "A renegade colonel is producing the VX-90 nerve agent for sale on the open market. " +
        "Dr. Volkov, the chemist forced to build the program, has signalled his intent to defect — " +
        "he is being held in the facility's detention block."
    ],
    outro:
      "Q Branch has supplied your silenced PP9, a field camera, and three remote mines. " +
      "The rest you'll have to borrow from the opposition. Don't be seen, James."
  },
  startToast: "Find a way out of the ventilation system. (C to crouch)",

  // 44 columns x 38 rows
  map: [
    "############################################", // 0
    "##v#########################################", // 1
    "##v#########################################", // 2
    "##vvv#######################################", // 3
    "####v###.................................###", // 4
    "####v###.................................###", // 5
    "####G###..####D########################..###", // 6
    "##.....#..#........##.......##........#..###", // 7
    "##.....D..#........##.......##........#..###", // 8
    "##.....#..#........##.......##........#..###", // 9
    "##.....#..#........##.......##........#..###", // 10
    "########..#........##.......##........#..###", // 11
    "########..#........##.......##........#..###", // 12
    "########..####D#########D########O#####..###", // 13
    "########.................................###", // 14
    "########.................................###", // 15
    "########..####D##########L#############..###", // 16
    "########..#.......##............##....#..###", // 17
    "########..#.......##............##....#..###", // 18
    "########..D.......##............##....O..###", // 19
    "########..#.......##............##....#..###", // 20
    "########..#.......##............##....#..###", // 21
    "########..##########............#######..###", // 22
    "########..##########............#######..###", // 23
    "########..#.......##............##....#..###", // 24
    "########..#.......##............##....#..###", // 25
    "########..D.......##............##....D..###", // 26
    "########..#.......##............##....#..###", // 27
    "########..#.......##............##....#..###", // 28
    "########..###############L#############..###", // 29
    "########.................................###", // 30
    "########.................................###", // 31
    "##################################DD########", // 32
    "############################...............#", // 33
    "############################...............#", // 34
    "############################...............#", // 35
    "############################...............#", // 36
    "############################################" // 37
  ],

  regions: [
    { name: "vent", x0: 2, z0: 1, x1: 4, z1: 6, floorTex: "floorVent", wallTex: "ventWall" },
    { name: "bathroom", x0: 2, z0: 7, x1: 7, z1: 10, floorTex: "floorTile", wallTex: "labWall", light: { color: 0xcfe8e0, intensity: 6 } },
    { name: "barracks", x0: 11, z0: 6, x1: 18, z1: 13, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xffe6b8, intensity: 7 } },
    { name: "storage", x0: 21, z0: 7, x1: 27, z1: 13, floorTex: "floorMetal", wallTex: "brickWall", light: { color: 0xffd9a0, intensity: 6 } },
    { name: "records", x0: 30, z0: 7, x1: 37, z1: 13, floorTex: "floorTile", wallTex: "concreteWall", light: { color: 0xfff2cc, intensity: 7 } },
    { name: "server", x0: 11, z0: 16, x1: 17, z1: 21, floorTex: "floorMetal", wallTex: "metalWall", light: { color: 0xbfe8ff, intensity: 6 } },
    { name: "cells", x0: 11, z0: 24, x1: 17, z1: 28, floorTex: "floorConcrete", wallTex: "brickWall", light: { color: 0xd8e2e8, intensity: 5 } },
    { name: "lab", x0: 20, z0: 16, x1: 31, z1: 29, floorTex: "floorTile", wallTex: "labWall", light: { color: 0xe8fff2, intensity: 8 } },
    { name: "armory", x0: 34, z0: 17, x1: 38, z1: 21, floorTex: "floorMetal", wallTex: "metalWall", light: { color: 0xffe2c0, intensity: 6 } },
    { name: "mess", x0: 34, z0: 24, x1: 38, z1: 28, floorTex: "floorTile", wallTex: "concreteWall", light: { color: 0xffeccc, intensity: 6 } },
    { name: "dock", x0: 28, z0: 32, x1: 43, z1: 36, floorTex: "floorConcrete", wallTex: "metalWall", light: { color: 0xd0e0ff, intensity: 8 } },
    // corridors (must be last: acts as the fallback for ring + center)
    { name: "corridor", x0: 0, z0: 0, x1: 43, z1: 37, floorTex: "floorConcrete", wallTex: "concreteWall" }
  ],

  corridorLights: [
    [24, 4.5],
    [8.5, 18],
    [40, 18],
    [24, 30.5],
    [24, 14.5],
    [12, 14.5],
    [36, 14.5]
  ],

  roomFixtures: [
    { x: 2, z: 2, c: 0x9fb3c0, i: 2.2 }, // vent (dim — just enough to crawl by)
    { x: 4, z: 4.5, c: 0x9fb3c0, i: 2.2 }, // vent elbow
    { x: 4.5, z: 8.5, c: 0xcfe8e0, i: 5 }, // bathroom
    { x: 15, z: 9.5, c: 0xffe6b8, i: 6 }, // barracks
    { x: 24.5, z: 10, c: 0xffd9a0, i: 5.5 }, // storage
    { x: 34, z: 10, c: 0xfff2cc, i: 6 }, // records
    { x: 14.5, z: 19, c: 0xbfe8ff, i: 5.5 }, // server
    { x: 14.5, z: 26, c: 0xd8e2e8, i: 4.5 }, // cells
    { x: 23.5, z: 19.5, c: 0xe8fff2, i: 6.5 }, // lab N
    { x: 28, z: 25.5, c: 0xe8fff2, i: 6.5 }, // lab S
    { x: 36, z: 19, c: 0xffe2c0, i: 5 }, // armory
    { x: 36, z: 26, c: 0xffeccc, i: 5 }, // mess
    { x: 31, z: 34.5, c: 0xd0e0ff, i: 7 }, // dock W
    { x: 39.5, z: 34.5, c: 0xd0e0ff, i: 7 } // dock E
  ],

  glowFixtures: [
    [13, 4.5],
    [18.5, 4.5],
    [29, 4.5],
    [35, 4.5],
    [13, 30.5],
    [18.5, 30.5],
    [29, 30.5],
    [35, 30.5],
    [8.5, 8],
    [8.5, 13],
    [8.5, 22],
    [8.5, 27],
    [40, 8],
    [40, 13],
    [40, 22],
    [40, 27],
    [18, 14.5],
    [30, 14.5]
  ],

  alarmLightPositions: [
    [49, 10],
    [18, 36],
    [80, 36],
    [49, 62],
    [70, 69]
  ],

  pipes: [
    // north corridor, along the north wall
    { x0: 17, z0: 8.22, x1: 81, z1: 8.22, y: 2.72, r: 0.075, rust: true },
    { x0: 17, z0: 8.4, x1: 81, z1: 8.4, y: 2.52, r: 0.05, rust: false },
    // south corridor, along the south wall
    { x0: 17, z0: 63.78, x1: 81, z1: 63.78, y: 2.72, r: 0.075, rust: true },
    // east + west corridor walls
    { x0: 81.78, z0: 9, x1: 81.78, z1: 63, y: 2.72, r: 0.075, rust: false },
    { x0: 16.22, z0: 9, x1: 16.22, z1: 63, y: 2.72, r: 0.075, rust: true },
    // lab back wall
    { x0: 41, z0: 57.8, x1: 63, z1: 57.8, y: 2.7, r: 0.06, rust: false }
  ],

  signs: [
    { text: "КАЗАРМА", cx: 14, cz: 6, side: "N" },
    { text: "СКЛАД", cx: 24, cz: 13, side: "S" },
    { text: "АРХИВ", cx: 33, cz: 13, side: "S" },
    { text: "СЕРВЕР", cx: 14, cz: 16, side: "N" },
    { text: "ЛАБ-2", cx: 25, cz: 16, side: "N" },
    { text: "АРСЕНАЛ", cx: 38, cz: 19, side: "E" },
    { text: "СТОЛОВАЯ", cx: 38, cz: 26, side: "E" },
    { text: "КАРЦЕР", cx: 10, cz: 26, side: "W" },
    { text: "ПОГРУЗКА", cx: 34.5, cz: 32, side: "N" }
  ],

  props: [
    // bathroom
    { type: "toilet", cx: 2.3, cz: 10.2 },
    { type: "toilet", cx: 3.6, cz: 10.2 },
    { type: "sink", cx: 6, cz: 6.78 },
    { type: "sink", cx: 5, cz: 6.78 },
    // barracks
    { type: "bed", cx: 11.8, cz: 7.8, rot: 1 },
    { type: "bed", cx: 11.8, cz: 9.8, rot: 1 },
    { type: "bed", cx: 11.8, cz: 11.8, rot: 1 },
    { type: "locker", cx: 18.3, cz: 7.6 },
    { type: "locker", cx: 18.3, cz: 8.6 },
    { type: "table", cx: 15.5, cz: 10.5 },
    // storage
    { type: "crate", cx: 21.8, cz: 7.8 },
    { type: "crate", cx: 23.2, cz: 7.7 },
    { type: "crate", cx: 22.4, cz: 9 },
    { type: "barrel", cx: 26.5, cz: 7.8 },
    { type: "barrel", cx: 25.6, cz: 8.2 },
    { type: "crate", cx: 26.6, cz: 12.2 },
    { type: "shelf", cx: 21.6, cz: 11.5, rot: 1 },
    // records office
    { type: "desk", cx: 32, cz: 9.5 },
    { type: "desk", cx: 35, cz: 11 },
    { type: "shelf", cx: 36.6, cz: 8 },
    { type: "documents", cx: 33.5, cz: 7.35, id: "documents" },
    // server room
    { type: "mainframe", cx: 14, cz: 17.6, id: "mainframe" },
    { type: "console", cx: 12, cz: 20.5 },
    { type: "desk", cx: 16, cz: 20.5 },
    // cell block
    { type: "bed", cx: 12, cz: 28.2 },
    { type: "desk", cx: 16.5, cz: 24.6 },
    // lab
    { type: "gastank", cx: 23.5, cz: 20, id: "tank_a" },
    { type: "gastank", cx: 27.5, cz: 20, id: "tank_b" },
    { type: "table", cx: 22, cz: 24.5 },
    { type: "table", cx: 25.5, cz: 24.5 },
    { type: "console", cx: 30.5, cz: 18 },
    { type: "barrel", cx: 20.6, cz: 28.3 },
    { type: "barrel", cx: 21.5, cz: 28.5 },
    { type: "shelf", cx: 30.8, cz: 27.5 },
    // armory
    { type: "shelf", cx: 34.5, cz: 17.6 },
    { type: "table", cx: 36.5, cz: 20.5 },
    { type: "crate", cx: 34.6, cz: 20.6 },
    // mess
    { type: "table", cx: 35, cz: 25 },
    { type: "table", cx: 37, cz: 27 },
    { type: "crate", cx: 34.6, cz: 27.8 },
    // dock
    { type: "truck", cx: 31.5, cz: 35, rot: 1 },
    { type: "crate", cx: 29, cz: 33.6 },
    { type: "crate", cx: 30.2, cz: 33.5 },
    { type: "crate", cx: 29.6, cz: 34.7 },
    { type: "barrel", cx: 42.4, cz: 33.5 },
    { type: "barrel", cx: 42.4, cz: 36.3 },
    { type: "crate", cx: 37.5, cz: 36.3 }
  ],

  pickups: [
    { type: "medkit", cx: 2.5, cz: 7.5 },
    { type: "ammo_9mm", cx: 12.5, cz: 11.5 },
    { type: "grenades", cx: 15.5, cz: 10.5 },
    { type: "armor", cx: 24, cz: 8 },
    { type: "ammo_rifle", cx: 26, cz: 11 },
    { type: "mines", cx: 22, cz: 11.5 },
    { type: "ammo_9mm", cx: 31, cz: 8 },
    { type: "ammo_9mm", cx: 16, cz: 19 },
    { type: "medkit", cx: 16.5, cz: 27.5 },
    { type: "ammo_9mm", cx: 21, cz: 26.5 },
    { type: "weapon_shotgun", cx: 35.5, cz: 18.5 },
    { type: "weapon_railgun", cx: 36.5, cz: 20.5 },
    { type: "ammo_shells", cx: 34.7, cz: 18.7 },
    { type: "ammo_rail", cx: 37.3, cz: 20.7 },
    { type: "grenades", cx: 34.7, cz: 19.6 },
    { type: "armor", cx: 37.3, cz: 17.7 },
    { type: "ammo_rifle", cx: 35, cz: 24.5 },
    { type: "weapon_knife", cx: 36.2, cz: 24.6 },
    { type: "armor", cx: 29, cz: 36.2 },
    { type: "ammo_rifle", cx: 41, cz: 33.5 },
    { type: "medkit", cx: 41, cz: 36.2 },
    // the Golden Gun, tucked behind the dock truck — a secret worth finding
    { type: "weapon_golden", cx: 32, cz: 36.3 },
    { type: "ammo_golden", cx: 32.7, cz: 36.3 }
  ],

  guards: [
    // corridor patrols
    { kind: "guard", cx: 8, cz: 5, route: [[8, 5], [39, 5], [39, 30], [9, 30]] },
    { kind: "guard", cx: 20, cz: 4, route: [[11, 4], [36, 4]] },
    { kind: "guard", cx: 8, cz: 12, route: [[8, 7], [8, 28]] },
    { kind: "guard", cx: 40, cz: 20, route: [[40, 7], [40, 28]] },
    { kind: "guard", cx: 30, cz: 31, route: [[10, 31], [38, 31]] },
    // the officer with the keycard patrols the center corridor
    { kind: "officer", cx: 18, cz: 15, route: [[11, 15], [36, 15]], keycard: "officer" },
    // room posts
    { kind: "guard", cx: 13, cz: 8, route: [], facing: Math.PI / 2 },
    { kind: "guard", cx: 17, cz: 11, route: [], facing: -Math.PI / 2 },
    { kind: "guard", cx: 24, cz: 10, route: [[22, 8], [26, 11]] },
    { kind: "guard", cx: 15, cz: 26, route: [], facing: Math.PI },
    { kind: "guard", cx: 22, cz: 19, route: [], facing: Math.PI },
    { kind: "guard", cx: 29, cz: 26, route: [[29, 22], [24, 27]] },
    { kind: "guard", cx: 35, cz: 25, route: [], facing: 0 },
    { kind: "guard", cx: 36, cz: 27, route: [], facing: -Math.PI / 2 },
    // dock crew (conscripts with cheap SMGs)
    { kind: "guard", cx: 33, cz: 34, route: [[29, 34], [41, 34]], gun: "klobb" },
    { kind: "guard", cx: 40, cz: 35, route: [], facing: Math.PI / 2, gun: "klobb" },
    { kind: "officer", cx: 38, cz: 33, route: [], facing: -Math.PI / 2, keycard: "officer" },
    // armory surprise
    { kind: "heavy", cx: 36, cz: 19, route: [], facing: Math.PI / 2 }
  ],

  alarmPanels: [
    { id: "ap_north", cx: 20, cz: 4, side: "N" },
    { id: "ap_west", cx: 8, cz: 20, side: "W" },
    { id: "ap_east", cx: 40, cz: 12, side: "E" },
    { id: "ap_south", cx: 28, cz: 31, side: "S" },
    { id: "ap_barracks", cx: 11, cz: 8, side: "W" }
  ],

  playerStart: { cx: 2, cz: 1, yaw: Math.PI },

  extraction: { x0: 40, z0: 33, x1: 42, z1: 36 },

  reinforcementSpawns: [
    [8, 4],
    [40, 30],
    [42, 35]
  ],

  environment: {
    fog: { color: 0x06080a, density: 0.028 },
    background: 0x06080a,
    ambient: { color: 0xa0a8b4, intensity: 0.78 },
    hemi: { sky: 0x55606e, ground: 0x262a20, intensity: 0.72 }
  },

  // Dr. Volkov's jail cell: bar segments + a gate, in world coords
  barriers: [
    { x: 22, z: 54, len: 2, axis: "x" },
    { x: 26, z: 54, len: 2, axis: "x" },
    { x: 28, z: 54, len: 4, axis: "z" }
  ],
  gates: [{ id: "jail", cx: 12, cz: 27, axis: "z", x: 25, z: 54 }],
  navBlocks: [
    [11, 27],
    [13, 27],
    [14, 27],
    [14, 28]
  ],

  npcs: [
    {
      id: "volkov",
      kind: "scientist",
      x: 26.5,
      z: 56.5,
      yaw: Math.PI,
      hideCell: [16, 25],
      gateId: "jail",
      freePrompt: "F — FREE DR. VOLKOV",
      freeToasts: ['DR. VOLKOV: "Destroy what they made me build. Take my keycard!"', "LAB KEYCARD ACQUIRED"],
      grantsKeycard: "lab",
      killFailReason: "Dr. Volkov was killed before you reached him."
    }
  ],

  musicTheme: "m1",

  objectives: [
    { id: "o_infiltrate", label: "Infiltrate the facility through the ventilation system", trigger: { kind: "enterRegion", region: "bathroom" } },
    { id: "o_scientist", label: "Locate and free Dr. Volkov", minDifficulty: "super", trigger: { kind: "freeNpc", npcId: "volkov" } },
    { id: "o_photo", label: "Photograph the VX-90 nerve gas formula", trigger: { kind: "photo", targetId: "documents" } },
    { id: "o_tanks", label: "Destroy both nerve gas tanks", trigger: { kind: "destroyAll", ids: ["tank_a", "tank_b"] } },
    { id: "o_extract", label: "Escape via the loading dock", trigger: { kind: "extract" } },
    { id: "s_alarm", label: "Complete the mission without an alarm", bonus: true, trigger: { kind: "noAlarm" } },
    { id: "s_railgun", label: "Recover the ZMEY prototype railgun", bonus: true, trigger: { kind: "pickup", pickupType: "weapon_railgun" } },
    { id: "s_mainframe", label: "Destroy the security mainframe", bonus: true, requiredAt: "007", trigger: { kind: "destroyAll", ids: ["mainframe"] } },
    { id: "s_volkov", label: "Dr. Volkov survives", bonus: true, minDifficulty: "super", trigger: { kind: "npcSurvives", npcId: "volkov" } }
  ]
};
