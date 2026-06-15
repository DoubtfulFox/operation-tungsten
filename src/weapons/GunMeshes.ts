import * as THREE from "three";
import { buildWeaponModel } from "./WeaponModels";

/**
 * Low-poly gun models, GoldenEye silhouettes: tapered prisms instead of
 * raw boxes, proper grips/stocks/sights. Barrel points -Z; an empty
 * named "muzzle" marks the tip for flashes/tracers. Shared by the view
 * model, floor pickups and guard hands.
 */

const mats = {
  gunmetal: new THREE.MeshLambertMaterial({ color: 0x32373d }),
  darkmetal: new THREE.MeshLambertMaterial({ color: 0x23272b }),
  steel: new THREE.MeshLambertMaterial({ color: 0x4a525a }),
  grip: new THREE.MeshLambertMaterial({ color: 0x4a3a26 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b5230 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x55401f }),
  accent: new THREE.MeshLambertMaterial({ color: 0x666e76 }),
  energy: new THREE.MeshLambertMaterial({ color: 0x2a6e8c, emissive: 0x1d4f66 }),
  redlight: new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x881111 }),
  olive: new THREE.MeshLambertMaterial({ color: 0x4a5238 }),
  lens: new THREE.MeshLambertMaterial({ color: 0x182838, emissive: 0x0a1623 }),
  gold: new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x3a2c08 }),
  blade: new THREE.MeshLambertMaterial({ color: 0x9aa4ac }),
  skin: new THREE.MeshLambertMaterial({ color: 0xc9a183 }),
  cuff: new THREE.MeshLambertMaterial({ color: 0x23272e }),
  goldBright: new THREE.MeshLambertMaterial({ color: 0xe6c84e, emissive: 0x4a3a10 }),
  pearl: new THREE.MeshLambertMaterial({ color: 0xe9e4d6 }),
  lensHi: new THREE.MeshLambertMaterial({ color: 0x2f6e96, emissive: 0x10384f })
};

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return m;
}

function cyl(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, alongZ = true, segs = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  if (alongZ) m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

/** 4-sided tapered prism, hinged at center. w0 = top width, w1 = bottom width. */
function taper(w0: number, w1: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0): THREE.Mesh {
  const g = new THREE.CylinderGeometry(w0 / Math.SQRT2, w1 / Math.SQRT2, h, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(1, 1, d / w1);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return m;
}

function muzzleAt(g: THREE.Group, x: number, y: number, z: number): void {
  const m = new THREE.Object3D();
  m.name = "muzzle";
  m.position.set(x, y, z);
  g.add(m);
}

function sph(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, segs = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, Math.max(6, segs - 2)), mat);
  m.position.set(x, y, z);
  return m;
}

/** Rounded rod (capsule). axis: "z" (default, points down-range), "x" or "y". */
function cap(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, axis: "x" | "y" | "z" = "z", segs = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, segs), mat);
  if (axis === "z") m.rotation.x = Math.PI / 2;
  else if (axis === "x") m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

/** Thin ring, e.g. a trigger guard. Loop lies in the X-Y plane; rotate at the call site. */
function ring(r: number, tube: number, mat: THREE.Material, x = 0, y = 0, z = 0, segs = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, segs), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildGunMesh(id: string): THREE.Group {
  const glb = buildWeaponModel(id);
  if (glb) return glb;
  const g = new THREE.Group();
  switch (id) {
    case "pp9": {
      // PPK-style silenced pistol — rounded slide + capsule suppressor
      g.add(box(0.05, 0.03, 0.25, mats.gunmetal, 0, 0.035, -0.06)); // slide body
      g.add(cyl(0.026, 0.25, mats.gunmetal, 0, 0.05, -0.06, true, 14)); // rounded crown
      g.add(cyl(0.027, 0.055, mats.steel, 0, 0.05, 0.05, true, 14)); // rear of slide
      g.add(box(0.044, 0.028, 0.2, mats.steel, 0, 0.008, -0.04)); // frame
      // suppressor: capsule with rounded tip + rings
      g.add(cap(0.024, 0.12, mats.darkmetal, 0, 0.05, -0.27, "z", 16));
      g.add(cyl(0.027, 0.014, mats.steel, 0, 0.05, -0.21, true, 16));
      g.add(cyl(0.027, 0.014, mats.steel, 0, 0.05, -0.33, true, 16));
      g.add(sph(0.006, mats.darkmetal, 0, 0.05, -0.35, 8)); // bore tip
      // sights
      g.add(box(0.008, 0.012, 0.012, mats.darkmetal, 0, 0.072, -0.16));
      g.add(box(0.02, 0.01, 0.012, mats.darkmetal, 0, 0.071, 0.05));
      // round trigger guard + trigger + hammer
      const guard = ring(0.024, 0.005, mats.darkmetal, 0, -0.028, -0.05, 14);
      guard.rotation.y = Math.PI / 2;
      g.add(guard);
      g.add(box(0.008, 0.018, 0.006, mats.steel, 0, -0.022, -0.05));
      g.add(sph(0.013, mats.steel, 0, 0.05, 0.078, 8));
      // rounded grip (flattened capsule), angled back
      const grip = cap(0.032, 0.07, mats.grip, 0, -0.07, 0.04, "y", 12);
      grip.scale.set(1.25, 1, 0.7);
      grip.rotation.x = 0.32;
      g.add(grip);
      muzzleAt(g, 0, 0.05, -0.36);
      break;
    }
    case "dd4": {
      // DD4 service pistol — full slide, integrated barrel, two-tone grip
      g.add(box(0.052, 0.038, 0.27, mats.darkmetal, 0, 0.032, -0.05)); // slide
      g.add(cyl(0.028, 0.27, mats.darkmetal, 0, 0.05, -0.05, true, 14)); // rounded crown
      g.add(box(0.026, 0.014, 0.05, mats.gunmetal, 0.015, 0.04, 0.0)); // ejection port
      g.add(box(0.046, 0.03, 0.2, mats.gunmetal, 0, 0.006, -0.04)); // frame
      g.add(cyl(0.014, 0.04, mats.gunmetal, 0, 0.05, -0.2, true, 12)); // barrel face
      g.add(sph(0.007, mats.darkmetal, 0, 0.05, -0.215, 8)); // muzzle
      g.add(box(0.008, 0.013, 0.012, mats.steel, 0, 0.073, -0.15)); // front sight
      g.add(box(0.02, 0.012, 0.012, mats.steel, 0, 0.072, 0.06)); // rear sight
      g.add(sph(0.013, mats.steel, 0, 0.052, 0.085, 8)); // hammer
      const guard = ring(0.025, 0.005, mats.darkmetal, 0, -0.026, -0.035, 14);
      guard.rotation.y = Math.PI / 2;
      g.add(guard);
      g.add(box(0.009, 0.02, 0.006, mats.steel, 0, -0.018, -0.035)); // trigger
      // rounded two-tone grip (dark frame + wood panel)
      const grip = cap(0.032, 0.085, mats.darkmetal, 0, -0.085, 0.06, "y", 12);
      grip.scale.set(1.18, 1, 0.7);
      grip.rotation.x = 0.33;
      g.add(grip);
      const panel = cap(0.02, 0.06, mats.woodDark, 0, -0.085, 0.077, "y", 10);
      panel.scale.set(1.0, 1, 0.5);
      panel.rotation.x = 0.33;
      g.add(panel);
      muzzleAt(g, 0, 0.05, -0.22);
      break;
    }
    case "kr7": {
      g.add(box(0.052, 0.07, 0.34, mats.gunmetal, 0, 0.005, -0.05)); // receiver
      g.add(cyl(0.037, 0.34, mats.gunmetal, 0, 0.018, -0.05, true, 12)); // rounded receiver top
      g.add(taper(0.05, 0.058, 0.2, 0.06, mats.wood, 0, 0.005, -0.32, Math.PI / 2)); // handguard
      g.add(cap(0.016, 0.2, mats.darkmetal, 0, 0.005, -0.55, "z", 14)); // barrel
      g.add(cyl(0.01, 0.16, mats.steel, 0, 0.04, -0.42, true, 10)); // gas tube
      g.add(sph(0.008, mats.darkmetal, 0, 0.005, -0.67, 8)); // muzzle
      g.add(box(0.01, 0.05, 0.012, mats.darkmetal, 0, 0.045, -0.62)); // front sight post
      // banana magazine
      g.add(box(0.04, 0.12, 0.06, mats.darkmetal, 0, -0.095, -0.06, 0.3));
      g.add(box(0.038, 0.1, 0.055, mats.darkmetal, 0, -0.175, -0.015, 0.62));
      // rounded grip + tapered buttstock
      const grip = cap(0.03, 0.08, mats.grip, 0, -0.085, 0.1, "y", 12);
      grip.scale.set(1.1, 1, 0.72);
      grip.rotation.x = 0.3;
      g.add(grip);
      g.add(taper(0.045, 0.065, 0.26, 0.085, mats.wood, 0, -0.035, 0.255, Math.PI / 2 - 0.18));
      g.add(box(0.024, 0.016, 0.03, mats.steel, 0, 0.052, -0.14)); // rear sight
      muzzleAt(g, 0, 0.005, -0.68);
      break;
    }
    case "shotgun": {
      g.add(cap(0.024, 0.55, mats.gunmetal, 0, 0.035, -0.3, "z", 16)); // rounded barrel
      g.add(cap(0.019, 0.44, mats.darkmetal, 0, -0.008, -0.27, "z", 14)); // mag tube
      g.add(box(0.055, 0.085, 0.18, mats.darkmetal, 0, 0.01, 0.0)); // receiver
      g.add(cyl(0.04, 0.18, mats.darkmetal, 0, 0.038, 0.0, true, 12)); // rounded receiver top
      for (const pz of [-0.26, -0.3, -0.34]) g.add(cyl(0.031, 0.026, mats.woodDark, 0, -0.008, pz, true, 12)); // ribbed pump
      g.add(sph(0.006, mats.steel, 0, 0.063, -0.58, 6)); // bead sight
      const grip = cap(0.03, 0.06, mats.wood, 0, -0.06, 0.085, "y", 12);
      grip.scale.set(1.1, 1, 0.7);
      grip.rotation.x = 0.35;
      g.add(grip);
      g.add(taper(0.05, 0.075, 0.24, 0.09, mats.wood, 0, -0.045, 0.23, Math.PI / 2 - 0.2)); // stock
      muzzleAt(g, 0, 0.035, -0.61);
      break;
    }
    case "railgun": {
      g.add(cap(0.05, 0.5, mats.gunmetal, 0, 0, -0.06, "z", 16)); // rounded main body
      g.add(cap(0.044, 0.16, mats.gunmetal, 0, 0, -0.46, "z", 14)); // rounded nose
      g.add(box(0.018, 0.04, 0.66, mats.accent, 0, 0.07, -0.08)); // top rail
      // energy coils (rounder, glowing)
      g.add(cyl(0.055, 0.05, mats.energy, 0, 0, -0.28, true, 16));
      g.add(cyl(0.051, 0.05, mats.energy, 0, 0, -0.42, true, 16));
      g.add(cyl(0.047, 0.05, mats.energy, 0, 0, -0.55, true, 16));
      // scope
      g.add(cap(0.032, 0.18, mats.lens, 0, 0.125, 0.02, "z", 16));
      g.add(cyl(0.038, 0.03, mats.darkmetal, 0, 0.125, 0.11, true, 14));
      g.add(cyl(0.038, 0.03, mats.darkmetal, 0, 0.125, -0.07, true, 14));
      // rounded grip + stock
      const grip = cap(0.03, 0.08, mats.grip, 0, -0.1, 0.08, "y", 12);
      grip.scale.set(1.1, 1, 0.72);
      grip.rotation.x = 0.25;
      g.add(grip);
      g.add(box(0.05, 0.09, 0.16, mats.darkmetal, 0, -0.04, 0.25)); // stock
      muzzleAt(g, 0, 0, -0.6);
      break;
    }
    case "klobb": {
      // VZ-61 Skorpion — compact slab receiver, thin barrel, folding wire stock
      g.add(box(0.044, 0.062, 0.2, mats.gunmetal, 0, 0.012, -0.04)); // receiver
      g.add(box(0.046, 0.02, 0.09, mats.darkmetal, 0, 0.05, 0.02)); // bolt/sight rib on top
      // thin barrel out front
      g.add(cap(0.012, 0.1, mats.darkmetal, 0, 0.022, -0.2, "z", 12));
      g.add(cyl(0.018, 0.02, mats.steel, 0, 0.022, -0.13, true, 12)); // barrel nut
      g.add(box(0.01, 0.028, 0.012, mats.darkmetal, 0, 0.046, -0.235)); // front sight
      g.add(sph(0.005, mats.darkmetal, 0, 0.022, -0.26, 8)); // muzzle
      g.add(box(0.03, 0.14, 0.045, mats.darkmetal, 0, -0.1, -0.03, 0.04)); // straight stick mag
      // vertical pistol grip
      const grip = cap(0.028, 0.07, mats.grip, 0, -0.078, 0.06, "y", 12);
      grip.scale.set(1.1, 1, 0.72);
      g.add(grip);
      // folding wire stock (U-shape) over the top, extending back
      g.add(cyl(0.006, 0.22, mats.steel, 0.024, 0.07, 0.05, true, 8));
      g.add(cyl(0.006, 0.22, mats.steel, -0.024, 0.07, 0.05, true, 8));
      g.add(cap(0.006, 0.04, mats.steel, 0, 0.07, 0.16, "x", 8)); // stock crossbar
      muzzleAt(g, 0, 0.022, -0.27);
      break;
    }
    case "sniper": {
      // long-barrel marksman rifle, SVD silhouette — rounded
      g.add(box(0.05, 0.06, 0.3, mats.gunmetal, 0, 0.005, -0.02)); // receiver
      g.add(cyl(0.032, 0.3, mats.gunmetal, 0, 0.018, -0.02, true, 12)); // rounded top
      g.add(taper(0.045, 0.052, 0.18, 0.055, mats.wood, 0, 0.0, -0.28, Math.PI / 2)); // handguard
      g.add(cap(0.013, 0.36, mats.darkmetal, 0, 0.01, -0.62, "z", 14)); // barrel
      g.add(cyl(0.02, 0.05, mats.steel, 0, 0.01, -0.8, true, 12)); // muzzle brake
      g.add(sph(0.006, mats.darkmetal, 0, 0.01, -0.83, 8));
      g.add(box(0.01, 0.045, 0.012, mats.darkmetal, 0, 0.045, -0.76)); // front sight
      // scope (very round)
      g.add(cap(0.03, 0.2, mats.lens, 0, 0.105, -0.06, "z", 16));
      g.add(cyl(0.037, 0.03, mats.darkmetal, 0, 0.105, 0.04, true, 14));
      g.add(cyl(0.037, 0.03, mats.darkmetal, 0, 0.105, -0.16, true, 14));
      g.add(box(0.036, 0.1, 0.06, mats.darkmetal, 0, -0.075, -0.04, 0.35)); // box mag
      const grip = cap(0.03, 0.08, mats.grip, 0, -0.075, 0.1, "y", 12);
      grip.scale.set(1.1, 1, 0.72);
      grip.rotation.x = 0.3;
      g.add(grip);
      g.add(taper(0.04, 0.055, 0.26, 0.075, mats.wood, 0, -0.025, 0.26, Math.PI / 2 - 0.16)); // stock
      muzzleAt(g, 0, 0.01, -0.84);
      break;
    }
    case "golden": {
      // sleek, ornate gold pistol — rounded, with a thin "pen" barrel
      const slide = cap(0.024, 0.24, mats.gold, 0, 0.032, -0.07, "z", 16);
      slide.scale.set(1.4, 1, 1); // a touch wider than tall
      g.add(slide);
      g.add(box(0.038, 0.028, 0.2, mats.gold, 0, 0.004, -0.05)); // frame
      g.add(cyl(0.0035, 0.26, mats.goldBright, 0, 0.054, -0.07, true, 8)); // engraved top line
      // long slim barrel with rounded tip
      g.add(cyl(0.016, 0.018, mats.gold, 0, 0.032, -0.2, true, 14)); // collar
      g.add(cap(0.011, 0.18, mats.goldBright, 0, 0.032, -0.32, "z", 14));
      g.add(sph(0.005, mats.gold, 0, 0.032, -0.42, 8));
      // hammer + round trigger guard + trigger
      g.add(sph(0.012, mats.goldBright, 0, 0.054, 0.072, 8));
      const guard = ring(0.021, 0.004, mats.gold, 0, -0.028, -0.04, 14);
      guard.rotation.y = Math.PI / 2;
      g.add(guard);
      g.add(box(0.007, 0.016, 0.006, mats.goldBright, 0, -0.022, -0.04));
      // slim rounded grip with a pearl inlay
      const grip = cap(0.03, 0.075, mats.gold, 0, -0.075, 0.04, "y", 12);
      grip.scale.set(1.1, 1, 0.62);
      grip.rotation.x = 0.3;
      g.add(grip);
      const pearl = cap(0.018, 0.055, mats.pearl, 0, -0.072, 0.052, "y", 10);
      pearl.scale.set(1.0, 1, 0.5);
      pearl.rotation.x = 0.3;
      g.add(pearl);
      muzzleAt(g, 0, 0.032, -0.43);
      break;
    }
    case "knife": {
      // flat blade (knives are flat) with a rounded handle + pommel
      g.add(box(0.004, 0.032, 0.24, mats.blade, 0, 0.024, -0.15));
      g.add(taper(0.032, 0.004, 0.08, 0.004, mats.blade, 0, 0.024, -0.3, Math.PI / 2)); // point
      g.add(box(0.005, 0.007, 0.22, mats.steel, 0, 0.009, -0.15)); // sharpened edge
      // rounded crossguard
      g.add(cap(0.01, 0.05, mats.darkmetal, 0, 0.024, -0.02, "x", 8));
      // rounded cord-wrapped grip + wrap rings + spherical pommel
      g.add(cap(0.017, 0.075, mats.grip, 0, 0.024, 0.045, "z", 12));
      for (const gz of [0.012, 0.034, 0.056]) g.add(cyl(0.019, 0.006, mats.cuff, 0, 0.024, gz, true, 12));
      g.add(sph(0.022, mats.darkmetal, 0, 0.024, 0.095, 10));
      muzzleAt(g, 0, 0.024, -0.34);
      break;
    }
    case "slappers": {
      // bare hands — rounded palm + capsule fingers, fingers forward
      const hand = (cxp: number, flip: number): THREE.Group => {
        const h = new THREE.Group();
        const palm = sph(0.05, mats.skin, 0, 0, -0.04, 12); // flattened-sphere palm
        palm.scale.set(1.1, 0.55, 1.3);
        h.add(palm);
        for (let i = 0; i < 4; i++) {
          const len = 0.055 - Math.abs(i - 1.5) * 0.006;
          h.add(cap(0.01, len, mats.skin, -0.026 + i * 0.018, 0.006, -0.12, "z", 8));
        }
        const thumb = cap(0.012, 0.04, mats.skin, flip * -0.03, 0.004, -0.05, "z", 8);
        thumb.rotation.y = flip * 0.7;
        h.add(thumb);
        h.add(cap(0.045, 0.05, mats.cuff, 0, -0.004, 0.05, "z", 12)); // rounded cuff
        h.position.x = cxp;
        h.rotation.z = flip * -0.1;
        h.rotation.y = flip * 0.18;
        return h;
      };
      g.add(hand(0.04, 1));
      g.add(hand(-0.24, -1));
      muzzleAt(g, 0, 0, -0.2);
      break;
    }
    case "grenade": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), mats.olive);
      body.scale.y = 1.15;
      g.add(body);
      g.add(cyl(0.022, 0.03, mats.steel, 0, 0.085, 0, false, 12)); // fuse top
      g.add(box(0.018, 0.07, 0.03, mats.accent, 0.025, 0.07, 0, 0.15)); // lever
      g.add(cyl(0.012, 0.04, mats.steel, 0.045, 0.095, 0, false, 10)); // pin ring
      muzzleAt(g, 0, 0, -0.1);
      break;
    }
    case "mine": {
      g.add(cyl(0.1, 0.04, mats.darkmetal, 0, 0, 0, false, 16));
      g.add(cyl(0.07, 0.018, mats.gunmetal, 0, 0.028, 0, false, 14));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mats.redlight);
      led.position.set(0, 0.042, 0);
      g.add(led);
      for (const a of [0, 2.1, 4.2]) {
        g.add(cap(0.012, 0.03, mats.steel, Math.cos(a) * 0.09, 0.005, Math.sin(a) * 0.09, "y", 8)); // rounded legs
      }
      muzzleAt(g, 0, 0, -0.1);
      break;
    }
    case "mines": {
      // the held first-person view: a proximity mine tilted so its face + LED read clearly
      const m = new THREE.Group();
      m.add(cyl(0.09, 0.045, mats.darkmetal, 0, 0, 0, false, 16)); // puck body
      m.add(cyl(0.062, 0.024, mats.gunmetal, 0, 0.034, 0, false, 14)); // raised cap
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), mats.redlight);
      led.position.set(0, 0.055, 0);
      m.add(led);
      // clamp legs ringing the rim
      for (const a of [0, 1.05, 2.1, 3.14, 4.19, 5.24]) {
        m.add(cap(0.011, 0.03, mats.steel, Math.cos(a) * 0.085, 0.004, Math.sin(a) * 0.085, "y", 8));
      }
      // tip the face up toward the camera and hold it a touch closer/over
      m.rotation.set(1.15, 0.35, 0);
      m.position.set(0.02, 0.01, 0.1);
      m.scale.setScalar(1.3);
      g.add(m);
      muzzleAt(g, 0.02, 0.05, 0.02);
      break;
    }
    case "camera": {
      // subminiature spy camera (Minox-style) — small, flat, covert
      g.add(box(0.13, 0.048, 0.07, mats.darkmetal)); // slab body
      g.add(cap(0.026, 0.09, mats.gunmetal, 0, 0.0, 0, "x", 12)); // rounded brushed shell
      g.add(box(0.1, 0.005, 0.003, mats.steel, 0, 0.006, -0.036)); // engraved seam
      // lens on the front edge (faces -Z), offset to one end
      g.add(cyl(0.022, 0.016, mats.gunmetal, 0.035, 0.004, -0.04, true, 16)); // mount
      g.add(cyl(0.026, 0.01, mats.steel, 0.035, 0.004, -0.05, true, 16)); // ring
      g.add(sph(0.017, mats.lens, 0.035, 0.004, -0.052, 14)); // glass
      g.add(sph(0.006, mats.lensHi, 0.03, 0.011, -0.062, 8)); // glint
      // viewfinder window, shutter button, film-advance knob
      g.add(box(0.022, 0.008, 0.014, mats.lens, -0.038, 0.026, 0.02)); // viewfinder
      g.add(cyl(0.007, 0.01, mats.accent, 0.05, 0.028, 0.018, false, 10)); // shutter
      g.add(cyl(0.013, 0.018, mats.steel, -0.072, 0.0, 0.0, false, 12)); // film knob
      muzzleAt(g, 0.035, 0.004, -0.07);
      break;
    }
    case "lockpick": {
      // a hook pick + tension wrench, slim rounded steel
      g.add(cap(0.017, 0.07, mats.grip, 0.012, -0.005, 0.035, "z", 12)); // grip
      for (const gz of [0.01, 0.032, 0.054]) g.add(cyl(0.019, 0.006, mats.cuff, 0.012, -0.005, gz, true, 10));
      g.add(cyl(0.0035, 0.17, mats.steel, 0.012, -0.005, -0.07, true, 8)); // shaft
      const tip = cap(0.0045, 0.02, mats.steel, 0.012, 0.006, -0.158, "y", 6); // up-bent hook
      tip.rotation.x = 0.6;
      g.add(tip);
      // tension wrench: short L tucked alongside
      g.add(cyl(0.005, 0.12, mats.steel, -0.03, -0.03, -0.02, true, 8));
      g.add(cyl(0.005, 0.03, mats.steel, -0.03, -0.043, -0.085, false, 8));
      muzzleAt(g, 0.012, 0, -0.16);
      break;
    }
    default: {
      g.add(box(0.08, 0.08, 0.3, mats.gunmetal));
      muzzleAt(g, 0, 0, -0.18);
    }
  }
  return g;
}
