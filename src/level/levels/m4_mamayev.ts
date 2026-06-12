import type { LevelDef } from "../LevelTypes";

/**
 * Mission 4 — Mamayev Memorial Park. Operation Tungsten's "Statue": a
 * floodlit Soviet war memorial at night, snow underfoot, a colossal
 * monument at its heart. 007 crosses the dark between the light pools to
 * meet GRANITE at the monument — and the handover springs the colonel's
 * ambush. Reinforcement waves flank in; fight out to the north-east gate.
 *
 *  # wall   . open ground (snow)   D door
 *  Outdoor park (fog + dim sun, like M2); the pavilion (E) is the one
 *  indoor room. See PROPOSED_MISSION_4.md for the design intent.
 */
export const M4: LevelDef = {
  id: "m4",
  name: "MAMAYEV MEMORIAL PARK",
  briefing: {
    re: "MAMAYEV MEMORIAL PARK — RENDEZVOUS WITH 'GRANITE'",
    paragraphs: [
      "Our man in the region — codename GRANITE — has the colonel's buyer list and the route the VX-90 " +
        "shipment will take. He will pass it only in person, in the open, at the war memorial above the city. " +
        "Midnight, at the foot of the monument.",
      "It is open ground, James, and the colonel is not a trusting man. If GRANITE has been followed — or turned — " +
        "you will be walking into a cordon. Stay off the floodlit paths, keep the statues between you and their eyes, " +
        "and do not fire until you must."
    ],
    outro:
      "Take the dossier and get out through the north gate. If the trap springs, GRANITE is your responsibility — " +
      "M would like him alive. Good luck, 007."
  },
  startToast: "Cross the park to the monument — stay out of the floodlights.",

  // 36 columns x 28 rows
  map: [
    "####################################", // 0
    "#..................................#", // 1
    "#..................................#", // 2
    "#..................................#", // 3
    "#..................................#", // 4
    "#..................................#", // 5
    "#..................................#", // 6
    "#..................................#", // 7
    "#..................................#", // 8
    "#..................................#", // 9
    "#...........................#####..#", // 10
    "#...........................#...#..#", // 11
    "#...........................D...#..#", // 12
    "#...........................#...#..#", // 13
    "#...........................#####..#", // 14
    "#..................................#", // 15
    "#..................................#", // 16
    "#..................................#", // 17
    "#..................................#", // 18
    "#..................................#", // 19
    "#..................................#", // 20
    "#..................................#", // 21
    "#..................................#", // 22
    "#..................................#", // 23
    "#..................................#", // 24
    "#..................................#", // 25
    "#..................................#", // 26
    "####################################" // 27
  ],

  regions: [
    // paved plaza around the monument (open-air); entering it = the rendezvous
    { name: "plaza", x0: 12, z0: 9, x1: 23, z1: 18, floorTex: "floorTile", wallTex: "snowWall", outdoor: true, light: { color: 0xe8eef2, intensity: 5 } },
    // the one enclosed structure — gets a ceiling
    { name: "pavilion", x0: 29, z0: 11, x1: 31, z1: 13, floorTex: "floorMetal", wallTex: "metalWall", light: { color: 0xffe2c0, intensity: 6 } },
    // the yard: open sky, snow underfoot (fallback — must be last)
    { name: "courtyard", x0: 0, z0: 0, x1: 35, z1: 27, floorTex: "floorSnow", wallTex: "snowWall", outdoor: true }
  ],

  corridorLights: [],

  roomFixtures: [
    { x: 30, z: 12, c: 0xffe2c0, i: 6 } // pavilion ceiling
  ],

  glowFixtures: [],

  alarmLightPositions: [
    [36, 8],
    [36, 48],
    [14, 28],
    [58, 28]
  ],

  pipes: [],

  signs: [
    { text: "СЛАВА ГЕРОЯМ", cx: 18, cz: 18, side: "S" },
    { text: "ПАВИЛЬОН", cx: 30, cz: 14, side: "S" },
    { text: "ВЫХОД", cx: 32, cz: 2, side: "N" }
  ],

  props: [
    // the colossal central memorial — landmark + hard cover
    { type: "monument", cx: 17.5, cz: 13.5 },
    // colonnade leading south -> plaza
    { type: "statue", cx: 14, cz: 20 },
    { type: "statue", cx: 21, cz: 20 },
    { type: "statue", cx: 14, cz: 17 },
    { type: "statue", cx: 21, cz: 17 },
    // statues bracketing the plaza
    { type: "statue", cx: 12, cz: 11 },
    { type: "statue", cx: 23, cz: 11 },
    { type: "statue", cx: 12, cz: 16 },
    { type: "statue", cx: 23, cz: 16 },
    // NW memorial terrace
    { type: "statue", cx: 6, cz: 5 },
    { type: "statue", cx: 8, cz: 7 },
    { type: "statue", cx: 5, cz: 9 },
    // NE + scattered
    { type: "statue", cx: 29, cz: 6 },
    { type: "statue", cx: 31, cz: 8 },
    { type: "statue", cx: 8, cz: 22 },
    { type: "statue", cx: 27, cz: 20 },
    // floodlights: corners + flanking the monument (pools of light)
    { type: "floodlight", cx: 3, cz: 3 },
    { type: "floodlight", cx: 32, cz: 3 },
    { type: "floodlight", cx: 3, cz: 24 },
    { type: "floodlight", cx: 32, cz: 24 },
    { type: "floodlight", cx: 13, cz: 13 },
    { type: "floodlight", cx: 22, cz: 13 },
    // motor pool (SE) — destructible bonus targets
    { type: "truck", cx: 30, cz: 22, id: "staff_car", destructible: { hp: 60, radius: 2.8, bulletImmune: false } },
    { type: "truck", cx: 26, cz: 24, id: "comms_truck", destructible: { hp: 60, radius: 2.8, bulletImmune: false } },
    // a little dressing
    { type: "crate", cx: 28, cz: 18 },
    { type: "barrel", cx: 27.2, cz: 18.4 }
  ],

  pickups: [
    { type: "medkit", cx: 4, cz: 25 },
    { type: "ammo_9mm", cx: 8, cz: 20 },
    { type: "grenades", cx: 14, cz: 21 },
    { type: "armor", cx: 21, cz: 21 },
    { type: "ammo_rifle", cx: 30, cz: 5 },
    { type: "medkit", cx: 32, cz: 21 }, // clear of the staff_car collider footprint
    { type: "weapon_sniper", cx: 30, cz: 12 }, // pavilion stash (the secret)
    { type: "ammo_rifle", cx: 31, cz: 12 },
    { type: "ammo_shells", cx: 5, cz: 6 },
    { type: "weapon_shotgun", cx: 6, cz: 8 },
    { type: "grenades", cx: 26, cz: 21 },
    { type: "armor", cx: 18, cz: 8 }
  ],

  guards: [
    // the officer with the keycard circles the whole park
    { kind: "officer", cx: 18, cz: 6, route: [[6, 4], [31, 4], [31, 18], [6, 18]], keycard: "officer" },
    // perimeter + yard patrols (conscripts on cheap SMGs)
    { kind: "guard", cx: 6, cz: 12, route: [[4, 4], [4, 24]], gun: "klobb" },
    { kind: "guard", cx: 30, cz: 18, route: [[33, 16], [33, 6]] },
    { kind: "guard", cx: 18, cz: 21, route: [[10, 22], [24, 22]], gun: "klobb" },
    // plaza posts
    { kind: "guard", cx: 14, cz: 11, route: [], facing: Math.PI / 2 },
    { kind: "guard", cx: 21, cz: 16, route: [], facing: -Math.PI / 2 },
    // pavilion guard (inside) — posted off the SVD stash so the rifle stays visible
    { kind: "guard", cx: 30, cz: 11, route: [], facing: Math.PI },
    // near the NE exfil gate
    { kind: "guard", cx: 33, cz: 3, route: [], facing: Math.PI / 2 },
    // NW terrace
    { kind: "guard", cx: 6, cz: 6, route: [], facing: 0 },
    // the lieutenant — posted at the monument, covering the approach
    { kind: "heavy", cx: 18, cz: 16, route: [], facing: Math.PI },
    // motor pool
    { kind: "guard", cx: 28, cz: 20, route: [], facing: Math.PI, gun: "klobb" }
  ],

  alarmPanels: [
    { id: "ap_w", cx: 1, cz: 14, side: "W" },
    { id: "ap_n", cx: 18, cz: 1, side: "N" },
    { id: "ap_e", cx: 34, cz: 9, side: "E" },
    { id: "ap_s", cx: 18, cz: 26, side: "S" },
    { id: "ap_pav", cx: 30, cz: 11, side: "N" }
  ],

  playerStart: { cx: 3, cz: 24, yaw: -Math.PI / 4 },

  // the breach in the north-east wall
  extraction: { x0: 30, z0: 1, x1: 33, z1: 2 },

  reinforcementSpawns: [
    [33, 2],
    [18, 1],
    [2, 3],
    [33, 16],
    [2, 24]
  ],

  environment: {
    fog: { color: 0x0a0e16, density: 0.03 },
    background: 0x0a0e16,
    ambient: { color: 0x9aa8c0, intensity: 0.5 },
    hemi: { sky: 0x4a5870, ground: 0x303636, intensity: 0.55 },
    sun: { color: 0xbfd0ea, intensity: 0.4, dir: [-30, 50, -18] }
  },

  wallH: 4,

  // the meeting springs the trap: a scripted (bonus-safe) alarm + waves,
  // and a 90s window to reach the gate
  escape: { afterObjective: "o_contact", seconds: 60, failReason: "The colonel's cordon closed before you reached the gate." },

  npcs: [
    {
      id: "granite",
      kind: "scientist",
      x: 37,
      z: 25,
      yaw: Math.PI,
      hideCell: [5, 6],
      freePrompt: "F — MAKE CONTACT",
      freeToasts: ['GRANITE: "The buyer list — and they know you are here. GO!"'],
      killFailReason: "GRANITE was killed before you could make contact."
    }
  ],

  musicTheme: "m4",

  objectives: [
    { id: "o_meet", label: "Reach the rendezvous at the central monument", trigger: { kind: "enterRegion", region: "plaza" } },
    { id: "o_contact", label: "Make contact and recover the dossier", trigger: { kind: "freeNpc", npcId: "granite" } },
    { id: "o_extract", label: "Exfiltrate through the north-east gate", trigger: { kind: "extract" } },
    { id: "s_alarm", label: "Reach the contact without raising an alarm", bonus: true, trigger: { kind: "noAlarm" } },
    { id: "s_granite", label: "GRANITE survives the ambush", bonus: true, minDifficulty: "super", trigger: { kind: "npcSurvives", npcId: "granite" } },
    { id: "s_comms", label: "Knock out the colonel's comms truck", bonus: true, minDifficulty: "super", trigger: { kind: "destroyAll", ids: ["comms_truck"] } },
    { id: "s_staffcar", label: "Destroy the colonel's staff car", bonus: true, requiredAt: "007", trigger: { kind: "destroyAll", ids: ["staff_car"] } },
    { id: "s_sniper", label: "Recover the marksman rifle from the pavilion", bonus: true, trigger: { kind: "pickup", pickupType: "weapon_sniper" } }
  ]
};
