import * as THREE from "three";
import type { PickupType } from "../types";
import { buildGunMesh } from "../weapons/GunMeshes";

const matBody = new THREE.MeshLambertMaterial({ color: 0x3a4030 });
const matRifle = new THREE.MeshLambertMaterial({ color: 0x44523a });
const matShell = new THREE.MeshLambertMaterial({ color: 0x84432c });
const matRail = new THREE.MeshLambertMaterial({ color: 0x3a5a74 });
const matArmor = new THREE.MeshLambertMaterial({ color: 0x2e3e52 });
const matMed = new THREE.MeshLambertMaterial({ color: 0xd8d8d0 });
const matCross = new THREE.MeshLambertMaterial({ color: 0xb02a2a });
const matCardLab = new THREE.MeshLambertMaterial({ color: 0x3f9f5f, emissive: 0x143f23 });
const matCardOff = new THREE.MeshLambertMaterial({ color: 0xb44040, emissive: 0x401414 });
const matOlive = new THREE.MeshLambertMaterial({ color: 0x4a5238 });
const matDark = new THREE.MeshLambertMaterial({ color: 0x23272b });
const matGold = new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x3a2c08 });

function ammoBox(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.2), mat);
  m.position.y = 0.07;
  g.add(m);
  return g;
}

export function buildPickupMesh(type: PickupType): THREE.Group {
  switch (type) {
    case "ammo_9mm":
      return ammoBox(matBody);
    case "ammo_rifle":
      return ammoBox(matRifle);
    case "ammo_shells":
      return ammoBox(matShell);
    case "ammo_rail":
      return ammoBox(matRail);
    case "grenades": {
      const g = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), matOlive);
        s.position.set(i * 0.14 - 0.07, 0.08, 0);
        g.add(s);
      }
      return g;
    }
    case "mines": {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), matDark);
        d.position.y = 0.03 + i * 0.05;
        g.add(d);
      }
      return g;
    }
    case "armor": {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.2), matArmor);
      torso.position.y = 0.28;
      g.add(torso);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), matArmor);
      collar.position.y = 0.56;
      g.add(collar);
      return g;
    }
    case "medkit": {
      const g = new THREE.Group();
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.26), matMed);
      bx.position.y = 0.09;
      g.add(bx);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.012), matCross);
      c1.position.set(0, 0.16, 0.13);
      g.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.012), matCross);
      c2.position.set(0, 0.16, 0.13);
      g.add(c2);
      return g;
    }
    case "keycard_lab":
    case "keycard_officer": {
      const g = new THREE.Group();
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.02, 0.2),
        type === "keycard_lab" ? matCardLab : matCardOff
      );
      card.position.y = 0.06;
      g.add(card);
      return g;
    }
    case "ammo_golden": {
      const g = new THREE.Group();
      const slug = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), matGold);
      slug.position.y = 0.08;
      g.add(slug);
      return g;
    }
    case "weapon_dd4":
      return wrapGun("dd4");
    case "weapon_kr7":
      return wrapGun("kr7");
    case "weapon_shotgun":
      return wrapGun("shotgun");
    case "weapon_railgun":
      return wrapGun("railgun");
    case "weapon_klobb":
      return wrapGun("klobb");
    case "weapon_sniper":
      return wrapGun("sniper");
    case "weapon_golden":
      return wrapGun("golden");
    case "weapon_knife":
      return wrapGun("knife");
  }
}

function wrapGun(id: string): THREE.Group {
  const g = new THREE.Group();
  const gun = buildGunMesh(id);
  gun.scale.setScalar(1.5);
  gun.rotation.z = Math.PI / 2.4;
  gun.rotation.y = Math.PI / 2;
  gun.position.y = 0.18;
  g.add(gun);
  return g;
}

export class Pickup {
  mesh: THREE.Group;
  alive = true;

  constructor(
    public type: PickupType,
    public pos: THREE.Vector3
  ) {
    this.mesh = buildPickupMesh(type);
    this.mesh.position.copy(pos);
  }

  update(dt: number, time: number): void {
    if (!this.alive) return;
    this.mesh.rotation.y += dt * 1.2;
    this.mesh.position.y = this.pos.y + Math.sin(time * 2 + this.pos.x) * 0.03 + 0.04;
  }

  /** Despawn (after being collected). */
  collect(): void {
    this.alive = false;
    this.mesh.visible = false;
  }
}
