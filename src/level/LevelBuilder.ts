import * as THREE from "three";
import type { Collider, Physics } from "../core/Physics";
import type { Sfx } from "../audio/Sfx";
import { Door } from "./Door";
import { NavGrid } from "../ai/Nav";
import { Pickup } from "./Pickups";
import { Tex } from "../textures/TextureGen";
import { CELL, GridMap, VENT_H, WALL_H, cw, isFloorChar } from "./Grid";
import { buildPropModel } from "./PropModels";
import type { LevelDef } from "./LevelTypes";
import type { CellChar, PropDef } from "../types";

export interface Destructible {
  id: string;
  /** prop type; gastank/mainframe/alarmpanel get bespoke death effects */
  kind: string;
  hp: number;
  alive: boolean;
  pos: THREE.Vector3;
  radius: number;
  group: THREE.Object3D;
  colliders: Collider[];
  /** gas tanks shrug off bullets — explosives only */
  bulletImmune: boolean;
}

export interface BuiltLevel {
  def: LevelDef;
  grid: GridMap;
  group: THREE.Group;
  doors: Door[];
  /** named scripted gates (jail etc), by GateDef id */
  gates: Map<string, Door>;
  pickups: Pickup[];
  destructibles: Map<string, Destructible>;
  nav: NavGrid;
  alarmLights: THREE.PointLight[];
  /** photo-objective targets by prop id */
  photoTargets: Map<string, THREE.Vector3>;
  /** free cells beside waist-high props guards can duck behind */
  coverSpots: CoverSpot[];
  playerStart: { pos: THREE.Vector3; yaw: number };
}

export interface CoverSpot {
  pos: THREE.Vector3;
  /** unit vector from the spot into the covering prop */
  coverDir: THREE.Vector3;
}

function ceilH(ch: CellChar): number {
  if (ch === "v" || ch === "G") return VENT_H;
  if (ch === "D" || ch === "L" || ch === "O") return 2.6;
  return WALL_H;
}

class Bucket {
  pos: number[] = [];
  norm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  constructor(public tex: THREE.Texture) {}

  quad(
    corners: Array<[number, number, number]>,
    uvs: Array<[number, number]>,
    n: [number, number, number],
    shades: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(corners[i][0], corners[i][1], corners[i][2]);
      this.norm.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(shades[i], shades[i], shades[i]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    // vertex colors carry baked corner/edge shading — GoldenEye's depth
    // came from exactly this kind of vertex lighting
    const mat = new THREE.MeshLambertMaterial({ map: this.tex, side: THREE.DoubleSide, vertexColors: true });
    return new THREE.Mesh(g, mat);
  }
}

// ---- prop materials ----------------------------------------------------

const pm = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6b5230 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x55401f }),
  metal: new THREE.MeshLambertMaterial({ color: 0x5d646b }),
  darkMetal: new THREE.MeshLambertMaterial({ color: 0x33383d }),
  white: new THREE.MeshLambertMaterial({ color: 0xd8dcd4 }),
  porcelain: new THREE.MeshLambertMaterial({ color: 0xc8cfc8 }),
  olive: new THREE.MeshLambertMaterial({ color: 0x4a5238 }),
  mattress: new THREE.MeshLambertMaterial({ color: 0x6a7258 }),
  redDome: new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x661111 }),
  tire: new THREE.MeshLambertMaterial({ color: 0x1c1f22 }),
  truckBody: new THREE.MeshLambertMaterial({ color: 0x46523e }),
  glass: new THREE.MeshLambertMaterial({ color: 0x2a3a44, emissive: 0x101b21 }),
  pipe: new THREE.MeshLambertMaterial({ color: 0x70777e }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8c8f88 }),
  stoneDark: new THREE.MeshLambertMaterial({ color: 0x5b5e58 }),
  bronze: new THREE.MeshLambertMaterial({ color: 0x6e5a36 }),
  targetRed: new THREE.MeshLambertMaterial({ color: 0xc0392b })
};

function bx(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

interface BuiltProp {
  group: THREE.Group;
  /** local-space collider half extents + center y (rotated by builder) */
  collider?: { hw: number; hh: number; hd: number };
  destructible?: { kind: string; hp: number; radius: number; bulletImmune: boolean };
}

function buildProp(def: PropDef): BuiltProp {
  const g = new THREE.Group();
  switch (def.type) {
    case "crate": {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshLambertMaterial({ map: Tex.crate() }));
      c.position.y = 0.65;
      c.rotation.y = (def.cx * 7919) % 0.5;
      g.add(c);
      return { group: g, collider: { hw: 0.7, hh: 0.65, hd: 0.7 } };
    }
    case "barrel": {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10), new THREE.MeshLambertMaterial({ map: Tex.barrel() }));
      b.position.y = 0.53;
      g.add(b);
      return {
        group: g,
        collider: { hw: 0.45, hh: 0.53, hd: 0.45 },
        // explosive fuel drum: shootable (not bullet-immune), detonated in Damage.damageDestructible
        destructible: { kind: "barrel", hp: 18, radius: 0.5, bulletImmune: false }
      };
    }
    case "target": {
      // firing-range standee: a tall board with a painted bullseye (face on +Z)
      g.add(bx(0.5, 0.09, 0.34, pm.darkMetal, 0, 0.045, 0)); // base
      g.add(bx(0.62, 1.5, 0.05, pm.white, 0, 0.85, 0)); // board
      g.add(bx(0.66, 0.06, 0.07, pm.darkMetal, 0, 1.585, 0)); // top trim
      g.add(bx(0.66, 0.06, 0.07, pm.darkMetal, 0, 0.115, 0)); // bottom trim
      const disc = (r: number, mat: THREE.Material, z: number): THREE.Mesh => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 20), mat);
        m.rotation.x = Math.PI / 2;
        m.position.set(0, 1.12, z);
        return m;
      };
      g.add(disc(0.26, pm.targetRed, 0.03));
      g.add(disc(0.2, pm.white, 0.034));
      g.add(disc(0.14, pm.targetRed, 0.038));
      g.add(disc(0.08, pm.white, 0.042));
      g.add(disc(0.038, pm.targetRed, 0.046));
      return { group: g, collider: { hw: 0.33, hh: 0.8, hd: 0.06 } };
    }
    case "table": {
      g.add(bx(1.8, 0.07, 1.0, pm.wood, 0, 0.82));
      for (const [lx, lz] of [
        [-0.8, -0.4],
        [0.8, -0.4],
        [-0.8, 0.4],
        [0.8, 0.4]
      ]) {
        g.add(bx(0.08, 0.8, 0.08, pm.woodDark, lx, 0.4, lz));
      }
      return { group: g, collider: { hw: 0.9, hh: 0.43, hd: 0.5 } };
    }
    case "desk": {
      g.add(bx(1.7, 0.07, 0.9, pm.wood, 0, 0.8));
      g.add(bx(1.7, 0.5, 0.06, pm.woodDark, 0, 0.55, 0.4));
      g.add(bx(0.5, 0.76, 0.85, pm.woodDark, -0.55, 0.38, 0));
      g.add(bx(0.08, 0.78, 0.08, pm.woodDark, 0.78, 0.39, -0.38));
      g.add(bx(0.08, 0.78, 0.08, pm.woodDark, 0.78, 0.39, 0.38));
      return { group: g, collider: { hw: 0.85, hh: 0.42, hd: 0.45 } };
    }
    case "locker": {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.55), new THREE.MeshLambertMaterial({ map: Tex.metalWall() }));
      l.position.y = 1.05;
      g.add(l);
      return { group: g, collider: { hw: 0.5, hh: 1.05, hd: 0.3 } };
    }
    case "bed": {
      g.add(bx(0.95, 0.32, 2.05, pm.woodDark, 0, 0.18));
      g.add(bx(0.88, 0.12, 1.95, pm.mattress, 0, 0.4));
      g.add(bx(0.5, 0.1, 0.38, pm.white, 0, 0.48, -0.7));
      return { group: g, collider: { hw: 0.5, hh: 0.25, hd: 1.05 } };
    }
    case "shelf": {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 0.5), new THREE.MeshLambertMaterial({ map: Tex.crate() }));
      s.position.y = 1.0;
      g.add(s);
      return { group: g, collider: { hw: 1.0, hh: 1.0, hd: 0.3 } };
    }
    case "toilet": {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 8), pm.porcelain);
      bowl.position.y = 0.2;
      g.add(bowl);
      g.add(bx(0.46, 0.55, 0.18, pm.porcelain, 0, 0.45, 0.26));
      return { group: g, collider: { hw: 0.3, hh: 0.4, hd: 0.35 } };
    }
    case "sink": {
      g.add(bx(0.55, 0.16, 0.42, pm.porcelain, 0, 0.85));
      g.add(bx(0.14, 0.8, 0.14, pm.porcelain, 0, 0.4));
      return { group: g, collider: { hw: 0.3, hh: 0.5, hd: 0.25 } };
    }
    case "console": {
      g.add(bx(0.95, 0.9, 0.6, pm.darkMetal, 0, 0.45));
      const scr = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.5, 0.07),
        new THREE.MeshLambertMaterial({ map: Tex.screen(), emissive: 0x335533, emissiveMap: Tex.screen() })
      );
      scr.position.set(0, 1.12, 0.12);
      scr.rotation.x = -0.45;
      g.add(scr);
      return { group: g, collider: { hw: 0.5, hh: 0.62, hd: 0.35 } };
    }
    case "mainframe": {
      const rackMat = new THREE.MeshLambertMaterial({
        map: Tex.serverRack(),
        emissive: 0x224422,
        emissiveMap: Tex.serverRack()
      });
      for (const ox of [-1.1, 0, 1.1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.85), rackMat);
        r.position.set(ox, 1.1, 0);
        g.add(r);
      }
      return {
        group: g,
        collider: { hw: 1.65, hh: 1.1, hd: 0.45 },
        destructible: { kind: "mainframe", hp: 120, radius: 2.4, bulletImmune: false }
      };
    }
    case "gastank": {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.5, 12), new THREE.MeshLambertMaterial({ map: Tex.tank() }));
      tank.position.y = 1.45;
      g.add(tank);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), pm.metal);
      cap.position.y = 2.7;
      g.add(cap);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), pm.pipe);
      pipe.position.y = 3.1;
      g.add(pipe);
      g.add(bx(2.0, 0.2, 2.0, pm.darkMetal, 0, 0.1));
      return {
        group: g,
        collider: { hw: 1.05, hh: 1.5, hd: 1.05 },
        destructible: { kind: "gastank", hp: 400, radius: 1.7, bulletImmune: true }
      };
    }
    case "documents": {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshLambertMaterial({ map: Tex.docsBoard() }));
      board.position.y = 1.55;
      g.add(board);
      return { group: g };
    }
    case "floodlight": {
      g.add(bx(0.14, 3.4, 0.14, pm.darkMetal, 0, 1.7));
      g.add(bx(0.5, 0.34, 0.3, pm.metal, 0, 3.42, 0.12));
      const lens = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.26),
        new THREE.MeshBasicMaterial({ color: 0xfff2cc })
      );
      lens.position.set(0, 3.4, 0.28);
      g.add(lens);
      const light = new THREE.PointLight(0xeae2c0, 6.5, 15, 1.15);
      light.position.set(0, 3.1, 0.6);
      g.add(light);
      return { group: g, collider: { hw: 0.2, hh: 1.7, hd: 0.2 } };
    }
    case "dish": {
      g.add(bx(1.0, 0.5, 1.0, pm.darkMetal, 0, 0.25));
      g.add(bx(0.16, 1.6, 0.16, pm.metal, 0, 1.3));
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.95, 0.22, 12), pm.white);
      dish.position.set(0, 2.35, -0.25);
      dish.rotation.x = -0.85;
      g.add(dish);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), pm.metal);
      feed.position.set(0, 2.6, 0.25);
      feed.rotation.x = 0.7;
      g.add(feed);
      return { group: g, collider: { hw: 0.7, hh: 1.2, hd: 0.7 } };
    }
    case "fence": {
      // a 4m chain fence run along local x — thin, shoot-through cover
      for (const px of [-1.9, 0, 1.9]) {
        g.add(bx(0.08, 2.2, 0.08, pm.darkMetal, px, 1.1));
      }
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.9, 2.0),
        new THREE.MeshLambertMaterial({ map: Tex.grate(), side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
      );
      mesh.position.y = 1.1;
      g.add(mesh);
      return { group: g, collider: { hw: 2.0, hh: 1.1, hd: 0.07 } };
    }
    case "traincar":
    case "engine": {
      const side = new THREE.MeshLambertMaterial({ map: Tex.trainSide() });
      g.add(bx(2.5, 2.4, 7.4, side, 0, 1.7));
      g.add(bx(2.7, 0.25, 7.6, pm.darkMetal, 0, 0.45));
      for (const wz of [-2.9, -1.6, 1.6, 2.9]) {
        for (const wx of [-1.0, 1.0]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 10), pm.tire);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.45, wz);
          g.add(wheel);
        }
      }
      if (def.type === "engine") {
        g.add(bx(1.8, 0.9, 1.6, pm.darkMetal, 0, 3.3, -2.2));
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.1, 8), pm.darkMetal);
        stack.position.set(0, 3.4, -3.3);
        g.add(stack);
        g.add(bx(2.3, 0.7, 0.6, pm.redDome, 0, 1.0, -3.85));
      }
      return { group: g, collider: { hw: 1.4, hh: 1.5, hd: 3.85 } };
    }
    case "generator": {
      g.add(bx(1.7, 1.3, 1.0, pm.olive, 0, 0.65));
      g.add(bx(0.5, 0.4, 0.5, pm.darkMetal, -0.4, 1.5));
      const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), pm.pipe);
      pipe1.position.set(0.5, 1.65, 0);
      g.add(pipe1);
      g.add(bx(1.5, 0.15, 0.85, pm.metal, 0, 1.38));
      return { group: g, collider: { hw: 0.9, hh: 0.75, hd: 0.55 } };
    }
    case "truck": {
      // CC0 Kenney truck (olive military recolor); falls back to the box mesh if the GLB is absent
      const model = buildPropModel("truck");
      if (model) return model;
      g.add(bx(1.9, 1.7, 1.7, pm.truckBody, 0, 1.25, -2.4));
      g.add(bx(1.6, 0.6, 0.1, pm.glass, 0, 1.7, -1.55));
      g.add(bx(2.1, 2.0, 4.4, pm.olive, 0, 1.6, 0.6));
      for (const [wx, wz] of [
        [-0.95, -2.3],
        [0.95, -2.3],
        [-0.95, 1.6],
        [0.95, 1.6]
      ]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.3, 10), pm.tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.52, wz);
        g.add(wheel);
      }
      return { group: g, collider: { hw: 1.15, hh: 1.3, hd: 3.4 } };
    }
    case "garage": {
      // roll-up dock door (corrugated slats + frame), flush on a wall; decorative (no collider)
      const gw = 4.4;
      const gh = 3.0;
      const n = 8;
      for (let i = 0; i < n; i++) {
        g.add(bx(gw, gh / n - 0.05, 0.16, i % 2 ? pm.metal : pm.darkMetal, 0, 0.1 + (i + 0.5) * (gh / n)));
      }
      g.add(bx(0.22, gh + 0.4, 0.34, pm.darkMetal, -(gw / 2 + 0.1), (gh + 0.4) / 2));
      g.add(bx(0.22, gh + 0.4, 0.34, pm.darkMetal, gw / 2 + 0.1, (gh + 0.4) / 2));
      g.add(bx(gw + 0.6, 0.34, 0.34, pm.darkMetal, 0, gh + 0.25));
      return { group: g };
    }
    case "statue": {
      // stone plinth + bronze figure — tall enough to break line of sight (full cover)
      g.add(bx(1.0, 0.4, 1.0, pm.stoneDark, 0, 0.2));
      g.add(bx(0.7, 0.8, 0.7, pm.stone, 0, 0.8));
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.0, 8), pm.bronze);
      torso.position.y = 1.7;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), pm.bronze);
      head.position.y = 2.3;
      g.add(head);
      const arm = bx(0.12, 0.5, 0.12, pm.bronze, 0.26, 2.0, 0);
      arm.rotation.z = -0.7;
      g.add(arm);
      const staff = bx(0.05, 1.0, 0.05, pm.bronze, 0.48, 2.2, 0);
      staff.rotation.z = -0.16;
      g.add(staff);
      // hw/hd just over the nav-block threshold so guards path around it
      return { group: g, collider: { hw: 0.6, hh: 1.2, hd: 0.6 } };
    }
    case "monument": {
      // colossal central war memorial — stepped plinth + towering figure (scenery, indestructible)
      g.add(bx(2.6, 0.5, 2.6, pm.stoneDark, 0, 0.25));
      g.add(bx(2.0, 0.5, 2.0, pm.stone, 0, 0.75));
      g.add(bx(1.4, 1.5, 1.4, pm.stoneDark, 0, 1.75));
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.2, 10), pm.bronze);
      torso.position.y = 3.6;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), pm.bronze);
      head.position.y = 4.95;
      g.add(head);
      const arm = bx(0.24, 1.0, 0.24, pm.bronze, 0.5, 4.2, 0);
      arm.rotation.z = -0.6;
      g.add(arm);
      const sword = bx(0.1, 2.4, 0.1, pm.bronze, 1.05, 5.2, 0);
      sword.rotation.z = -0.25;
      g.add(sword);
      return { group: g, collider: { hw: 1.3, hh: 3.0, hd: 1.3 } };
    }
    default:
      return { group: g };
  }
}

// ---- the main build ------------------------------------------------------

export function buildLevel(def: LevelDef, physics: Physics, sfx: Sfx): BuiltLevel {
  const group = new THREE.Group();
  const grid = new GridMap(def);
  const nav = new NavGrid(grid);
  const buckets = new Map<string, Bucket>();
  const TexAny = Tex as unknown as Record<string, () => THREE.Texture>;

  function bucket(texName: string): Bucket {
    let b = buckets.get(texName);
    if (!b) {
      b = new Bucket(TexAny[texName]());
      buckets.set(texName, b);
    }
    return b;
  }

  const solid = (x: number, z: number): boolean => !grid.isFloor(x, z);

  // --- geometry from the grid ---
  for (let cz = 0; cz < grid.h; cz++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const ch = grid.at(cx, cz);
      if (!isFloorChar(ch)) continue;
      const region = grid.regionAt(cx, cz);
      const outdoor = !!region.outdoor;
      const h = outdoor && (ch === "." || ch === "v") ? (def.wallH ?? WALL_H) : ceilH(ch);
      const x0 = cx * CELL;
      const x1 = x0 + CELL;
      const z0 = cz * CELL;
      const z1 = z0 + CELL;

      // baked corner AO: darken grid corners that touch walls
      const cornerShade = (dx: number, dz: number): number =>
        solid(cx + dx, cz) || solid(cx, cz + dz) || solid(cx + dx, cz + dz) ? 0.62 : 1;
      const fShades: [number, number, number, number] = [
        cornerShade(-1, -1),
        cornerShade(1, -1),
        cornerShade(1, 1),
        cornerShade(-1, 1)
      ];

      // floor + ceiling
      bucket(region.floorTex).quad(
        [
          [x0, 0, z0],
          [x1, 0, z0],
          [x1, 0, z1],
          [x0, 0, z1]
        ],
        [
          [x0 / 2, z0 / 2],
          [x1 / 2, z0 / 2],
          [x1 / 2, z1 / 2],
          [x0 / 2, z1 / 2]
        ],
        [0, 1, 0],
        fShades
      );
      if (!outdoor) {
        bucket("ceiling").quad(
          [
            [x0, h, z0],
            [x1, h, z0],
            [x1, h, z1],
            [x0, h, z1]
          ],
          [
            [x0 / 2, z0 / 2],
            [x1 / 2, z0 / 2],
            [x1 / 2, z1 / 2],
            [x0 / 2, z1 / 2]
          ],
          [0, -1, 0],
          [fShades[0] * 0.8, fShades[1] * 0.8, fShades[2] * 0.8, fShades[3] * 0.8]
        );
      }

      // walls against solid neighbors
      const sides: Array<{
        nx: number;
        nz: number;
        corners: (hh: number) => Array<[number, number, number]>;
        u: [number, number];
        n: [number, number, number];
        /** cells continuing the wall line to either side of this face */
        edges: [[number, number], [number, number]];
      }> = [
        {
          nx: cx,
          nz: cz - 1,
          corners: (hh) => [
            [x0, 0, z0],
            [x1, 0, z0],
            [x1, hh, z0],
            [x0, hh, z0]
          ],
          u: [x0 / 2, x1 / 2],
          n: [0, 0, 1],
          edges: [
            [-1, 0],
            [1, 0]
          ]
        },
        {
          nx: cx,
          nz: cz + 1,
          corners: (hh) => [
            [x0, 0, z1],
            [x1, 0, z1],
            [x1, hh, z1],
            [x0, hh, z1]
          ],
          u: [x0 / 2, x1 / 2],
          n: [0, 0, -1],
          edges: [
            [-1, 0],
            [1, 0]
          ]
        },
        {
          nx: cx - 1,
          nz: cz,
          corners: (hh) => [
            [x0, 0, z0],
            [x0, 0, z1],
            [x0, hh, z1],
            [x0, hh, z0]
          ],
          u: [z0 / 2, z1 / 2],
          n: [1, 0, 0],
          edges: [
            [0, -1],
            [0, 1]
          ]
        },
        {
          nx: cx + 1,
          nz: cz,
          corners: (hh) => [
            [x1, 0, z0],
            [x1, 0, z1],
            [x1, hh, z1],
            [x1, hh, z0]
          ],
          u: [z0 / 2, z1 / 2],
          n: [-1, 0, 0],
          edges: [
            [0, -1],
            [0, 1]
          ]
        }
      ];

      for (const s of sides) {
        const nch = grid.at(s.nx, s.nz);
        if (!isFloorChar(nch)) {
          // full wall face, shaded darker at floor + inside corners
          const wShades: [number, number, number, number] = [0.74, 0.74, 0.85, 0.85];
          if (solid(cx + s.edges[0][0], cz + s.edges[0][1])) {
            wShades[0] *= 0.68;
            wShades[3] *= 0.68;
          }
          if (solid(cx + s.edges[1][0], cz + s.edges[1][1])) {
            wShades[1] *= 0.68;
            wShades[2] *= 0.68;
          }
          const c = s.corners(h);
          bucket(region.wallTex).quad(
            c,
            [
              [s.u[0], 0],
              [s.u[1], 0],
              [s.u[1], h / 2],
              [s.u[0], h / 2]
            ],
            s.n,
            wShades
          );
        } else {
          // header between rooms of different ceiling heights (drawn from the taller side)
          const nh = ceilH(nch);
          if (nh < h) {
            const c = s.corners(h).map((p) => [...p] as [number, number, number]);
            c[0][1] = nh;
            c[1][1] = nh;
            bucket(region.wallTex).quad(
              c,
              [
                [s.u[0], nh / 2],
                [s.u[1], nh / 2],
                [s.u[1], h / 2],
                [s.u[0], h / 2]
              ],
              s.n,
              [0.72, 0.72, 0.82, 0.82]
            );
          }
        }
      }

      // low vent ceilings block standing
      if (h <= VENT_H + 0.01) {
        physics.addBox(new THREE.Vector3(x0, h, z0), new THREE.Vector3(x1, h + 0.4, z1), "level");
      }
    }
  }

  // wall colliders: any solid cell touching a floor cell
  for (let cz = 0; cz < grid.h; cz++) {
    for (let cx = 0; cx < grid.w; cx++) {
      if (grid.isFloor(cx, cz)) continue;
      let touchesFloor = false;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        if (grid.isFloor(cx + dx, cz + dz)) {
          touchesFloor = true;
          break;
        }
      }
      if (touchesFloor) {
        physics.addBox(
          new THREE.Vector3(cx * CELL, 0, cz * CELL),
          new THREE.Vector3(cx * CELL + CELL, Math.max(WALL_H, def.wallH ?? 0), cz * CELL + CELL),
          "level"
        );
      }
    }
  }

  // --- lights ---
  const lightPanelMat = new THREE.MeshBasicMaterial({ map: Tex.lightPanel() });
  const alarmLights: THREE.PointLight[] = [];

  function addFixture(x: number, z: number, color: number, intensity: number, dist = 17): void {
    const [cxi, czi] = [Math.floor(x / CELL), Math.floor(z / CELL)];
    const h = ceilH(grid.at(cxi, czi));
    const fixture = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), lightPanelMat);
    fixture.rotation.x = Math.PI / 2;
    fixture.position.set(x, h - 0.03, z);
    group.add(fixture);
    if (intensity > 0) {
      const light = new THREE.PointLight(color, intensity, dist, 1.1);
      light.position.set(x, h - 0.5, z);
      group.add(light);
    }
  }

  for (const r of def.roomFixtures) {
    addFixture(cw(r.x) - 1, cw(r.z) - 1, r.c, r.i);
  }
  for (const [lx, lz] of def.corridorLights) {
    addFixture(cw(lx) - 1, cw(lz) - 1, 0xcfd6dd, 5.2, 16);
  }
  // extra glow-only fixtures so the long corridors read lit without
  // blowing up the forward-renderer light count
  for (const [fx, fz] of def.glowFixtures) {
    addFixture(cw(fx) - 1, cw(fz) - 1, 0xcfd6dd, 0);
  }

  // red alarm lights (always in scene so the shader count stays stable)
  for (const [ax, az] of def.alarmLightPositions) {
    const l = new THREE.PointLight(0xff2222, 0, 24, 1.0);
    l.position.set(ax, 2.6, az);
    group.add(l);
    alarmLights.push(l);
  }

  // --- doors ---
  const doors: Door[] = [];
  for (let cz = 0; cz < grid.h; cz++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const ch = grid.at(cx, cz);
      if (ch === "D" || ch === "L" || ch === "O" || ch === "P" || ch === "G") {
        const kind = ch === "G" ? "grate" : "slide";
        const lock = ch === "L" ? "lab" : ch === "O" ? "officer" : ch === "P" ? "pick" : "none";
        // passage axis: open floor on N/S neighbors => travel along z
        const axis = grid.isFloor(cx, cz - 1) && grid.isFloor(cx, cz + 1) ? "z" : "x";
        const door = new Door(physics, sfx, cx, cz, kind, lock, axis);
        doors.push(door);
        group.add(door.group);
        nav.registerDoor(door);
      }
    }
  }

  // barriers (jail bars etc) + named gates
  const barMat = pm.darkMetal;
  for (const seg of def.barriers ?? []) {
    const segGroup = new THREE.Group();
    const count = Math.floor(seg.len / 0.25);
    for (let i = 0; i <= count; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5), barMat);
      const off = i * 0.25;
      bar.position.set(seg.axis === "x" ? seg.x + off : seg.x, 1.15, seg.axis === "x" ? seg.z : seg.z + off);
      segGroup.add(bar);
    }
    const railLen = seg.len;
    for (const ry of [0.06, 2.26]) {
      const rail = bx(seg.axis === "x" ? railLen : 0.1, 0.08, seg.axis === "x" ? 0.1 : railLen, barMat);
      rail.position.set(seg.axis === "x" ? seg.x + railLen / 2 : seg.x, ry, seg.axis === "x" ? seg.z : seg.z + railLen / 2);
      segGroup.add(rail);
    }
    group.add(segGroup);
    const thick = 0.12;
    physics.addBox(
      new THREE.Vector3(seg.axis === "x" ? seg.x : seg.x - thick, 0, seg.axis === "x" ? seg.z - thick : seg.z),
      new THREE.Vector3(seg.axis === "x" ? seg.x + seg.len : seg.x + thick, 2.3, seg.axis === "x" ? seg.z + thick : seg.z + seg.len),
      "level"
    );
  }
  const gates = new Map<string, Door>();
  for (const gd of def.gates ?? []) {
    // an alarm gate is a blast door: sealed shut (and a Nav barrier) until the alarm
    const lock = gd.openOnAlarm ? "sealed" : (gd.lock ?? "none");
    const gate = new Door(physics, sfx, gd.cx, gd.cz, "gate", lock, gd.axis, { x: gd.x, z: gd.z });
    doors.push(gate);
    group.add(gate.group);
    nav.registerDoor(gate);
    gates.set(gd.id, gate);
  }
  // keep AI paths out of barrier shortcuts (through-bars cells etc)
  for (const [bx2, bz2] of def.navBlocks ?? []) {
    nav.block(bx2, bz2);
  }

  // --- props ---
  const destructibles = new Map<string, Destructible>();
  let autoDestructId = 0; // synthetic ids for inherently-destructible scenery placed without an author id (e.g. barrels)
  const photoTargets = new Map<string, THREE.Vector3>();
  const coverSpots: CoverSpot[] = [];

  for (const pd of def.props) {
    const built = buildProp(pd);
    const px = cw(pd.cx);
    let pz = cw(pd.cz);
    if (pd.type === "documents") {
      // wall-mounted: snap to the north wall of its cell
      pz = Math.floor(pd.cz) * CELL + 0.08;
      if (pd.id) photoTargets.set(pd.id, new THREE.Vector3(px, 1.55, pz));
    }
    built.group.position.set(px, 0, pz);
    if (pd.rot) built.group.rotation.y = (pd.rot * Math.PI) / 2;
    group.add(built.group);

    const colliders: Collider[] = [];
    if (built.collider) {
      const { hw, hh, hd } = built.collider;
      const rot = (pd.rot ?? 0) % 2 === 1;
      const ex = rot ? hd : hw;
      const ez = rot ? hw : hd;
      const c = physics.addBox(
        new THREE.Vector3(px - ex, 0, pz - ez),
        new THREE.Vector3(px + ex, hh * 2, pz + ez),
        "prop"
      );
      colliders.push(c);
      for (let bcx = Math.floor((px - ex) / CELL); bcx <= Math.floor((px + ex - 0.01) / CELL); bcx++) {
        for (let bcz = Math.floor((pz - ez) / CELL); bcz <= Math.floor((pz + ez - 0.01) / CELL); bcz++) {
          if (ex * ez > 0.35) nav.block(bcx, bcz);
        }
      }

      // waist-high props make cover: the four neighboring cells qualify
      const top = hh * 2;
      if (top >= 0.6 && top <= 1.4 && ex * ez > 0.3) {
        const pcx = Math.floor(px / CELL);
        const pcz = Math.floor(pz / CELL);
        for (const [dx2, dz2] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const ncx = pcx + dx2;
          const ncz = pcz + dz2;
          if (!nav.isFree(ncx, ncz)) continue;
          const spotPos = NavGrid.center(ncx, ncz);
          const dir = new THREE.Vector3(px - spotPos.x, 0, pz - spotPos.z).normalize();
          coverSpots.push({ pos: spotPos, coverDir: dir });
        }
      }
    }

    // level data can promote any prop into a mission target; props that are
    // inherently destructible (gas tanks, barrels, ...) register even without an
    // author id so plain scenery barrels are still shootable/explosive.
    const spec = pd.destructible ?? built.destructible;
    const did = pd.id ?? (built.destructible ? `prop_${pd.type}_${autoDestructId++}` : undefined);
    if (spec && did) {
      const d: Destructible = {
        id: did,
        kind: built.destructible?.kind ?? pd.type,
        hp: spec.hp,
        alive: true,
        pos: new THREE.Vector3(px, 1.2, pz),
        radius: spec.radius,
        group: built.group,
        colliders,
        bulletImmune: spec.bulletImmune
      };
      destructibles.set(did, d);
      for (const c of colliders) c.ref = d;
    }
  }

  // --- alarm panels ---
  for (const ap of def.alarmPanels) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.12), new THREE.MeshLambertMaterial({ map: Tex.alarmPanel() }));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pm.redDome.clone());
    dome.position.y = 0.45;
    g.add(panel);
    g.add(dome);

    let px = cw(ap.cx);
    let pz = cw(ap.cz);
    if (ap.side === "N") {
      pz = ap.cz * CELL + 0.1;
    } else if (ap.side === "S") {
      pz = (ap.cz + 1) * CELL - 0.1;
      g.rotation.y = Math.PI;
    } else if (ap.side === "W") {
      px = ap.cx * CELL + 0.1;
      g.rotation.y = Math.PI / 2;
    } else {
      px = (ap.cx + 1) * CELL - 0.1;
      g.rotation.y = -Math.PI / 2;
    }
    g.position.set(px, 1.5, pz);
    group.add(g);

    const c = physics.addBox(
      new THREE.Vector3(px - 0.32, 1.1, pz - 0.32),
      new THREE.Vector3(px + 0.32, 1.95, pz + 0.32),
      "prop"
    );
    const d: Destructible = {
      id: ap.id,
      kind: "alarmpanel",
      hp: 25,
      alive: true,
      pos: new THREE.Vector3(px, 1.5, pz),
      radius: 0.6,
      group: g,
      colliders: [c],
      bulletImmune: false
    };
    destructibles.set(ap.id, d);
    c.ref = d;
  }

  // --- signs ---
  for (const s of def.signs) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: Tex.sign(s.text) }));
    let px = cw(s.cx);
    let pz = cw(s.cz);
    if (s.side === "N") {
      pz = s.cz * CELL - 0.06;
      plane.rotation.y = Math.PI;
    } else if (s.side === "S") {
      pz = (s.cz + 1) * CELL + 0.06;
    } else if (s.side === "W") {
      px = s.cx * CELL - 0.06;
      plane.rotation.y = -Math.PI / 2;
    } else {
      px = (s.cx + 1) * CELL + 0.06;
      plane.rotation.y = Math.PI / 2;
    }
    plane.position.set(px, 2.72, pz);
    group.add(plane);
  }

  // --- corridor pipes (industrial dressing, very Facility) ---
  const pipeMatRust = new THREE.MeshLambertMaterial({ color: 0x4d4234 });
  const pipeMatSteel = new THREE.MeshLambertMaterial({ color: 0x39424a });
  for (const run of def.pipes) {
    const dx = run.x1 - run.x0;
    const dz = run.z1 - run.z0;
    const len = Math.hypot(dx, dz);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(run.r, run.r, len, 6), run.rust ? pipeMatRust : pipeMatSteel);
    if (Math.abs(dx) > Math.abs(dz)) pipe.rotation.z = Math.PI / 2;
    else pipe.rotation.x = Math.PI / 2;
    pipe.position.set((run.x0 + run.x1) / 2, run.y, (run.z0 + run.z1) / 2);
    group.add(pipe);
    // mounting brackets every ~10m
    const count = Math.floor(len / 10);
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(run.r * 3, run.r * 3, 0.06), pipeMatSteel);
      bracket.position.set(run.x0 + dx * t, run.y, run.z0 + dz * t);
      if (Math.abs(dx) > Math.abs(dz)) bracket.rotation.y = Math.PI / 2;
      group.add(bracket);
    }
  }

  // --- pickups ---
  const pickups: Pickup[] = [];
  for (const p of def.pickups) {
    const pk = new Pickup(p.type, new THREE.Vector3(cw(p.cx), 0, cw(p.cz)));
    pickups.push(pk);
    group.add(pk.mesh);
  }

  // --- static geometry meshes ---
  for (const b of buckets.values()) {
    group.add(b.build());
  }

  return {
    def,
    grid,
    group,
    doors,
    gates,
    pickups,
    destructibles,
    nav,
    alarmLights,
    photoTargets,
    coverSpots,
    playerStart: {
      pos: new THREE.Vector3(cw(def.playerStart.cx), 0.55, cw(def.playerStart.cz)),
      yaw: def.playerStart.yaw
    }
  };
}

/** Visual state swap when something gets destroyed. */
export function applyDestroyedLook(d: Destructible): void {
  const charcoal = new THREE.MeshLambertMaterial({ color: 0x1b1d1f });
  if (d.kind === "gastank") {
    d.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = charcoal;
    });
    d.group.scale.y = 0.55;
    d.group.rotation.z = 0.12;
  } else if (d.kind === "mainframe") {
    d.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = charcoal;
    });
    d.group.rotation.x = 0.06;
  } else {
    d.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = charcoal;
    });
  }
}
