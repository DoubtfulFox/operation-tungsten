import * as THREE from "three";
import { buildGunMesh } from "./GunMeshes";
import type { Player } from "../player/Player";

const HIP = new THREE.Vector3(0.24, -0.21, -0.42);
const ADS = new THREE.Vector3(0.0, -0.155, -0.34);

/** First-person gun rendering: bob, sway, recoil, raise/lower, muzzle flash. */
export class ViewModel {
  group = new THREE.Group();
  private holders = new Map<string, THREE.Group>();
  private current: THREE.Group | null = null;
  private currentId = "";
  private flash: THREE.Mesh;
  private flashT = 0;
  private recoil = 0;
  /** alternating barrel for dual-wield */
  private dualSide = 0;
  private raiseT = 1;
  private swayX = 0;
  private swayY = 0;
  private adsLerp = 0;
  /** dual-wield gun meshes, so they can converge toward center on ADS */
  private dualR: THREE.Object3D | null = null;
  private dualL: THREE.Object3D | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    camera.add(this.group);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe2a8,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), flashMat);
    this.flash.visible = false;
    this.group.add(this.flash);
  }

  setWeapon(id: string): void {
    if (id === this.currentId) return;
    if (this.current) this.current.visible = false;
    let holder = this.holders.get(id);
    if (!holder) {
      if (id === "klobb_dual") {
        // one for each hand
        holder = new THREE.Group();
        const right = buildGunMesh("klobb");
        right.name = "dualR";
        const left = buildGunMesh("klobb");
        left.name = "dualL";
        left.position.x = -0.46;
        holder.add(right, left);
      } else {
        holder = buildGunMesh(id);
      }
      this.holders.set(id, holder);
      this.group.add(holder);
    }
    holder.visible = true;
    this.current = holder;
    this.currentId = id;
    this.raiseT = 0;
    if (id === "klobb_dual") {
      this.dualR = holder.getObjectByName("dualR") ?? null;
      this.dualL = holder.getObjectByName("dualL") ?? null;
    } else {
      this.dualR = this.dualL = null;
    }
  }

  private activeMuzzle(): THREE.Object3D | null {
    if (!this.current) return null;
    if (this.currentId === "klobb_dual") {
      const side = this.current.getObjectByName(this.dualSide === 0 ? "dualR" : "dualL");
      return side?.getObjectByName("muzzle") ?? null;
    }
    return this.current.getObjectByName("muzzle") ?? null;
  }

  onShot(showFlash = true): void {
    this.recoil = 1;
    if (!showFlash) return;
    this.flashT = 0.055;
    const muzzle = this.activeMuzzle();
    if (muzzle) {
      const v = muzzle.getWorldPosition(new THREE.Vector3());
      this.flash.position.copy(this.group.worldToLocal(v));
      this.flash.rotation.z = Math.random() * Math.PI;
    }
    if (this.currentId === "klobb_dual") this.dualSide = 1 - this.dualSide;
  }

  muzzleWorld(): THREE.Vector3 {
    const muzzle = this.activeMuzzle();
    if (muzzle) {
      const v = new THREE.Vector3();
      muzzle.getWorldPosition(v);
      return v;
    }
    const v = new THREE.Vector3();
    this.group.getWorldPosition(v);
    return v;
  }

  update(dt: number, player: Player, mouseDX: number, aiming: boolean, scoped = false): void {
    this.adsLerp = THREE.MathUtils.damp(this.adsLerp, aiming ? 1 : 0, 11, dt);
    this.raiseT = Math.min(1, this.raiseT + dt * 5);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.swayX = THREE.MathUtils.damp(this.swayX, THREE.MathUtils.clamp(-mouseDX * 0.0012, -0.04, 0.04), 10, dt);
    this.swayY = THREE.MathUtils.damp(this.swayY, 0, 6, dt);

    const pos = HIP.clone().lerp(ADS, this.adsLerp);
    const bob = player.bobAmount * (1 - this.adsLerp * 0.8);
    // figure-8 weapon bob: side-to-side at the sway rate, dip on each step
    pos.x += Math.sin(player.bobPhase * 0.5) * 0.018 * bob + this.swayX;
    pos.y += Math.abs(Math.cos(player.bobPhase)) * -0.014 * bob + this.swayY;
    pos.y -= (1 - this.raiseT) * 0.35;
    pos.z += this.recoil * 0.07;

    this.group.position.copy(pos);
    // the gun lags the bob with a gentle roll, on top of recoil + raise
    const bobRoll = Math.sin(player.bobPhase * 0.5) * 0.03 * bob;
    this.group.rotation.set(this.recoil * 0.12 - (1 - this.raiseT) * 0.5, 0.04 + this.swayX * 1.4, bobRoll);

    // dual-wield: at the hip the guns sit apart (right centered, left out to the
    // side); aiming pulls both toward center so they flank the crosshair evenly.
    if (this.dualR && this.dualL) {
      this.dualR.position.x = THREE.MathUtils.lerp(0, 0.06, this.adsLerp);
      this.dualL.position.x = THREE.MathUtils.lerp(-0.46, -0.1, this.adsLerp);
    }

    // looking through a scope: hide the gun so it doesn't block the lens
    if (this.current) this.current.visible = !scoped;

    this.flashT -= dt;
    this.flash.visible = this.flashT > 0 && !scoped;
  }
}
