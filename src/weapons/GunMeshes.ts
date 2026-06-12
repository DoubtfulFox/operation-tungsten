import * as THREE from "three";

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
  cuff: new THREE.MeshLambertMaterial({ color: 0x23272e })
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

export function buildGunMesh(id: string): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "pp9": {
      // slide with rounded top
      const slide = box(0.052, 0.05, 0.25, mats.gunmetal, 0, 0.035, -0.06);
      slide.scale.y = 1.15;
      g.add(slide);
      g.add(box(0.05, 0.035, 0.2, mats.steel, 0, 0.0, -0.04)); // frame
      g.add(taper(0.04, 0.052, 0.13, 0.085, mats.grip, 0, -0.07, 0.035, 0.22));
      // trigger guard
      g.add(box(0.012, 0.008, 0.06, mats.darkmetal, 0, -0.03, -0.045));
      g.add(box(0.012, 0.035, 0.008, mats.darkmetal, 0, -0.015, -0.075));
      // suppressor with rings
      g.add(cyl(0.022, 0.16, mats.darkmetal, 0, 0.035, -0.26));
      g.add(cyl(0.0245, 0.02, mats.steel, 0, 0.035, -0.2));
      g.add(cyl(0.0245, 0.02, mats.steel, 0, 0.035, -0.32));
      // sights
      g.add(box(0.008, 0.012, 0.01, mats.darkmetal, 0, 0.066, -0.17));
      g.add(box(0.02, 0.01, 0.012, mats.darkmetal, 0, 0.065, 0.06));
      muzzleAt(g, 0, 0.035, -0.35);
      break;
    }
    case "dd4": {
      const slide = box(0.06, 0.055, 0.28, mats.darkmetal, 0, 0.03, -0.06);
      slide.scale.y = 1.1;
      g.add(slide);
      g.add(box(0.055, 0.04, 0.22, mats.gunmetal, 0, -0.005, -0.045));
      g.add(taper(0.045, 0.06, 0.14, 0.09, mats.woodDark, 0, -0.08, 0.05, 0.26));
      // hammer + sights
      g.add(box(0.016, 0.03, 0.025, mats.steel, 0, 0.055, 0.075, -0.5));
      g.add(box(0.008, 0.014, 0.01, mats.steel, 0, 0.062, -0.18));
      // trigger guard
      g.add(box(0.012, 0.008, 0.07, mats.darkmetal, 0, -0.035, -0.04));
      g.add(cyl(0.016, 0.06, mats.gunmetal, 0, 0.03, -0.225));
      muzzleAt(g, 0, 0.03, -0.26);
      break;
    }
    case "kr7": {
      // receiver
      g.add(box(0.055, 0.075, 0.34, mats.gunmetal, 0, 0.005, -0.05));
      // wooden handguard, tapered
      g.add(taper(0.05, 0.058, 0.2, 0.06, mats.wood, 0, 0.005, -0.32, Math.PI / 2));
      // barrel + gas tube + front sight
      g.add(cyl(0.016, 0.24, mats.darkmetal, 0, 0.005, -0.54));
      g.add(cyl(0.01, 0.16, mats.steel, 0, 0.04, -0.42));
      g.add(box(0.01, 0.05, 0.012, mats.darkmetal, 0, 0.045, -0.62));
      g.add(box(0.024, 0.014, 0.02, mats.darkmetal, 0, 0.07, -0.6));
      // banana magazine: two angled segments
      g.add(box(0.04, 0.12, 0.06, mats.darkmetal, 0, -0.095, -0.06, 0.3));
      g.add(box(0.038, 0.1, 0.055, mats.darkmetal, 0, -0.175, -0.015, 0.62));
      // pistol grip + tapered buttstock
      g.add(taper(0.04, 0.05, 0.11, 0.07, mats.grip, 0, -0.08, 0.1, 0.3));
      g.add(taper(0.045, 0.065, 0.26, 0.085, mats.wood, 0, -0.035, 0.255, Math.PI / 2 - 0.18));
      // rear sight
      g.add(box(0.024, 0.016, 0.03, mats.steel, 0, 0.052, -0.14));
      muzzleAt(g, 0, 0.005, -0.68);
      break;
    }
    case "shotgun": {
      // barrel over mag tube
      g.add(cyl(0.024, 0.6, mats.gunmetal, 0, 0.035, -0.3));
      g.add(cyl(0.019, 0.48, mats.darkmetal, 0, -0.008, -0.27));
      // receiver
      g.add(box(0.055, 0.085, 0.18, mats.darkmetal, 0, 0.01, 0.0));
      // ribbed pump
      for (const pz of [-0.26, -0.3, -0.34]) {
        g.add(cyl(0.03, 0.028, mats.woodDark, 0, -0.008, pz));
      }
      // bead sight
      g.add(box(0.008, 0.01, 0.008, mats.steel, 0, 0.063, -0.58));
      // grip + tapered stock
      g.add(taper(0.04, 0.05, 0.1, 0.07, mats.wood, 0, -0.07, 0.09, 0.35));
      g.add(taper(0.05, 0.075, 0.24, 0.09, mats.wood, 0, -0.045, 0.23, Math.PI / 2 - 0.2));
      muzzleAt(g, 0, 0.035, -0.61);
      break;
    }
    case "railgun": {
      // main body with tapered nose
      g.add(box(0.065, 0.095, 0.62, mats.gunmetal, 0, 0, -0.05));
      g.add(taper(0.05, 0.08, 0.24, 0.07, mats.gunmetal, 0, 0, -0.46, Math.PI / 2));
      // top rail
      g.add(box(0.018, 0.04, 0.66, mats.accent, 0, 0.068, -0.08));
      // energy coils
      g.add(cyl(0.052, 0.05, mats.energy, 0, 0, -0.28, true, 6));
      g.add(cyl(0.048, 0.05, mats.energy, 0, 0, -0.42, true, 6));
      g.add(cyl(0.044, 0.05, mats.energy, 0, 0, -0.55, true, 6));
      // cooling fins
      g.add(box(0.11, 0.012, 0.2, mats.steel, 0, -0.02, -0.12));
      g.add(box(0.11, 0.012, 0.2, mats.steel, 0, 0.02, -0.12));
      // scope with eyepiece
      g.add(cyl(0.032, 0.2, mats.lens, 0, 0.125, 0.02));
      g.add(cyl(0.038, 0.03, mats.darkmetal, 0, 0.125, 0.11));
      g.add(cyl(0.038, 0.03, mats.darkmetal, 0, 0.125, -0.07));
      // grip + stock
      g.add(taper(0.04, 0.052, 0.13, 0.07, mats.grip, 0, -0.1, 0.08, 0.25));
      g.add(box(0.05, 0.09, 0.16, mats.darkmetal, 0, -0.04, 0.25));
      muzzleAt(g, 0, 0, -0.6);
      break;
    }
    case "klobb": {
      // cheap stamped-metal machine pistol
      g.add(box(0.05, 0.06, 0.24, mats.gunmetal, 0, 0.02, -0.05));
      g.add(cyl(0.014, 0.1, mats.darkmetal, 0, 0.03, -0.22));
      // straight stick mag
      g.add(box(0.034, 0.13, 0.05, mats.darkmetal, 0, -0.08, -0.07, 0.12));
      // grip
      g.add(taper(0.038, 0.05, 0.11, 0.07, mats.grip, 0, -0.07, 0.04, 0.28));
      // folded wire stock
      g.add(box(0.012, 0.012, 0.16, mats.steel, 0.028, 0.055, 0.0));
      g.add(box(0.012, 0.05, 0.012, mats.steel, 0.028, 0.035, 0.075));
      // sights
      g.add(box(0.008, 0.014, 0.01, mats.darkmetal, 0, 0.062, -0.16));
      muzzleAt(g, 0, 0.03, -0.28);
      break;
    }
    case "sniper": {
      // long-barrel marksman rifle, SVD silhouette
      g.add(box(0.05, 0.07, 0.3, mats.gunmetal, 0, 0.005, -0.02));
      g.add(taper(0.045, 0.052, 0.18, 0.055, mats.wood, 0, 0.0, -0.28, Math.PI / 2));
      g.add(cyl(0.013, 0.4, mats.darkmetal, 0, 0.01, -0.62));
      // muzzle brake + front sight
      g.add(cyl(0.018, 0.05, mats.steel, 0, 0.01, -0.8));
      g.add(box(0.01, 0.045, 0.012, mats.darkmetal, 0, 0.045, -0.76));
      // scope
      g.add(cyl(0.03, 0.22, mats.lens, 0, 0.105, -0.06));
      g.add(cyl(0.036, 0.03, mats.darkmetal, 0, 0.105, 0.04));
      g.add(cyl(0.036, 0.03, mats.darkmetal, 0, 0.105, -0.16));
      // box mag, grip, skeleton stock
      g.add(box(0.036, 0.1, 0.06, mats.darkmetal, 0, -0.075, -0.04, 0.35));
      g.add(taper(0.04, 0.05, 0.11, 0.07, mats.grip, 0, -0.075, 0.1, 0.3));
      g.add(taper(0.04, 0.055, 0.26, 0.075, mats.wood, 0, -0.025, 0.26, Math.PI / 2 - 0.16));
      muzzleAt(g, 0, 0.01, -0.84);
      break;
    }
    case "golden": {
      // a gilded DD4 — unmistakable
      const slide = box(0.06, 0.055, 0.28, mats.gold, 0, 0.03, -0.06);
      slide.scale.y = 1.1;
      g.add(slide);
      g.add(box(0.055, 0.04, 0.22, mats.gold, 0, -0.005, -0.045));
      g.add(taper(0.045, 0.06, 0.14, 0.09, mats.woodDark, 0, -0.08, 0.05, 0.26));
      g.add(box(0.016, 0.03, 0.025, mats.gold, 0, 0.055, 0.075, -0.5));
      g.add(box(0.012, 0.008, 0.07, mats.gold, 0, -0.035, -0.04));
      g.add(cyl(0.016, 0.1, mats.gold, 0, 0.03, -0.24));
      muzzleAt(g, 0, 0.03, -0.3);
      break;
    }
    case "knife": {
      // blade
      const blade = taper(0.006, 0.03, 0.26, 0.012, mats.blade, 0, 0.02, -0.16, Math.PI / 2);
      g.add(blade);
      // guard + grip
      g.add(box(0.055, 0.014, 0.018, mats.darkmetal, 0, 0.02, -0.03));
      g.add(cyl(0.016, 0.11, mats.grip, 0, 0.02, 0.035));
      muzzleAt(g, 0, 0.02, -0.3);
      break;
    }
    case "slappers": {
      // bare hands, ready to chop
      const palmR = taper(0.05, 0.07, 0.16, 0.035, mats.skin, 0.02, 0, -0.08, Math.PI / 2 - 0.3);
      palmR.rotation.z = -0.5;
      g.add(palmR);
      g.add(box(0.075, 0.04, 0.05, mats.cuff, 0.045, -0.02, 0.02));
      const palmL = taper(0.05, 0.07, 0.16, 0.035, mats.skin, -0.24, -0.01, -0.06, Math.PI / 2 - 0.3);
      palmL.rotation.z = 0.5;
      g.add(palmL);
      g.add(box(0.075, 0.04, 0.05, mats.cuff, -0.26, -0.03, 0.04));
      muzzleAt(g, 0, 0, -0.2);
      break;
    }
    case "grenade": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.olive);
      body.scale.y = 1.15;
      g.add(body);
      g.add(cyl(0.022, 0.03, mats.steel, 0, 0.085, 0, false));
      g.add(box(0.018, 0.07, 0.03, mats.accent, 0.025, 0.07, 0, 0.15));
      g.add(cyl(0.012, 0.04, mats.steel, 0.045, 0.095, 0, false));
      muzzleAt(g, 0, 0, -0.1);
      break;
    }
    case "mine": {
      g.add(cyl(0.1, 0.04, mats.darkmetal, 0, 0, 0, false, 10));
      g.add(cyl(0.07, 0.018, mats.gunmetal, 0, 0.028, 0, false, 8));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), mats.redlight);
      led.position.set(0, 0.042, 0);
      g.add(led);
      for (const a of [0, 2.1, 4.2]) {
        g.add(box(0.025, 0.02, 0.045, mats.steel, Math.cos(a) * 0.09, 0.005, Math.sin(a) * 0.09));
      }
      muzzleAt(g, 0, 0, -0.1);
      break;
    }
    case "mines": {
      // the held first-person view: a proximity mine tilted so its face + LED read clearly
      const m = new THREE.Group();
      m.add(cyl(0.09, 0.045, mats.darkmetal, 0, 0, 0, false, 12)); // puck body
      m.add(cyl(0.062, 0.024, mats.gunmetal, 0, 0.034, 0, false, 10)); // raised cap
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), mats.redlight);
      led.position.set(0, 0.055, 0);
      m.add(led);
      // clamp legs ringing the rim
      for (const a of [0, 1.05, 2.1, 3.14, 4.19, 5.24]) {
        m.add(box(0.022, 0.02, 0.05, mats.steel, Math.cos(a) * 0.085, 0.004, Math.sin(a) * 0.085));
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
      g.add(box(0.18, 0.11, 0.06, mats.darkmetal));
      g.add(box(0.05, 0.105, 0.07, mats.grip, -0.07, 0, 0.002));
      // lens barrel
      g.add(cyl(0.034, 0.035, mats.gunmetal, 0.03, 0, -0.045));
      g.add(cyl(0.028, 0.025, mats.lens, 0.03, 0, -0.07));
      // flash + viewfinder
      g.add(box(0.035, 0.022, 0.015, mats.accent, -0.055, 0.066, -0.01));
      g.add(box(0.022, 0.018, 0.02, mats.steel, 0.055, 0.062, 0.01));
      muzzleAt(g, 0.03, 0, -0.1);
      break;
    }
    default: {
      g.add(box(0.08, 0.08, 0.3, mats.gunmetal));
      muzzleAt(g, 0, 0, -0.18);
    }
  }
  return g;
}
