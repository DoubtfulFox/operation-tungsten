import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { buildGunMesh } from "../weapons/GunMeshes";

/**
 * Rigged character system: CC0 Quaternius models (SWAT / Business Man /
 * Worker — all on the same skeleton with the same 24 animations),
 * loaded once and cloned per character. Materials are converted to
 * flat-shaded Lambert with per-faction tints to fit the N64 palette.
 */

export type RigKind = "guard" | "officer" | "heavy" | "scientist";

interface LoadedAsset {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

const loaded = new Map<string, LoadedAsset>();

const FILES: Record<string, string> = {
  swat: "models/swat.glb",
  officer: "models/officer.glb",
  scientist: "models/scientist.glb"
};

const SOURCE: Record<RigKind, string> = {
  guard: "swat",
  heavy: "swat",
  officer: "officer",
  scientist: "scientist"
};

const SCALE: Record<RigKind, number> = { guard: 1, heavy: 1.09, officer: 1, scientist: 0.98 };

/** Per-kind material recolors, keyed by GLTF material name. */
const TINTS: Record<RigKind, Record<string, number>> = {
  guard: { Swat: 0x4d5942, Swat_Black: 0x2c3128 }, // olive fatigues
  heavy: { Swat: 0x5c4b38, Swat_Black: 0x32291e }, // brown armor
  officer: { Suit: 0x394049, Tie: 0x7d2a2a }, // dark uniform suit, red tie
  scientist: {
    Worker_Yellow: 0xd6d8ce, // jumpsuit -> lab coat white
    Worker_Vest: 0xc6c8be,
    Brown: 0x9fa3a7, // hair -> grey
    LightBrown: 0xb4b8bc
  }
};

export async function loadCharacterAssets(): Promise<void> {
  if (loaded.size > 0) return;
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const gltf = await loader.loadAsync(import.meta.env.BASE_URL + file);
      loaded.set(key, { scene: gltf.scene, clips: gltf.animations });
    })
  );
}

export class CharacterRig {
  /** position + yaw this; origin at the feet */
  root = new THREE.Group();
  /** per-instance materials, for death fade */
  materials: THREE.MeshLambertMaterial[] = [];

  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = "";
  private holder: THREE.Group;
  private baseScale: number;
  private headBone: THREE.Object3D | null;

  constructor(kind: RigKind, gunId: string | null) {
    const asset = loaded.get(SOURCE[kind]);
    if (!asset) throw new Error("character assets not loaded");
    const model = cloneSkeleton(asset.scene) as THREE.Group;

    // Normalize height to ~1.75m and face -Z (our forward convention).
    // NOTE: measure from the BONES, not Box3 — these FBX-derived GLBs have
    // inflated mesh-node transforms that skinning ignores entirely.
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI;
    holder.add(model);
    this.root.add(holder);
    this.root.updateMatrixWorld(true);
    const headBone = model.getObjectByName("Head");
    const headY = headBone ? headBone.getWorldPosition(new THREE.Vector3()).y : 1.5;
    const estHeight = Math.max(0.5, headY * 1.18);
    const s = (1.75 / estHeight) * SCALE[kind];
    holder.scale.setScalar(s);
    this.holder = holder;
    this.baseScale = s;
    this.headBone = headBone ?? null;

    // swap PBR materials for tinted flat Lambert
    const tints = TINTS[kind];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as Partial<THREE.Mesh>).isMesh && !(o as Partial<THREE.SkinnedMesh>).isSkinnedMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const swapped = mats.map((m) => {
        const src = m as THREE.MeshStandardMaterial;
        const color = tints[src.name] ?? (src.color ? src.color.getHex() : 0xffffff);
        const lam = new THREE.MeshLambertMaterial({ color });
        lam.name = src.name;
        this.materials.push(lam);
        return lam;
      });
      mesh.material = Array.isArray(mesh.material) ? swapped : swapped[0];
      mesh.frustumCulled = false; // skinned bounds lag the animation
    });

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of asset.clips) {
      const name = clip.name.replace("CharacterArmature|", "");
      this.actions.set(name, this.mixer.clipAction(clip));
    }

    if (gunId) {
      const hand = model.getObjectByName("WristR");
      if (hand) {
        const gun = buildGunMesh(gunId);
        // Pose the skeleton in the patrol idle (what guards show most of the time)
        // before measuring the hand, so the gun is oriented against a real held pose.
        const idle = this.actions.get("Idle");
        if (idle) {
          idle.reset().play();
          this.mixer.update(0);
          this.current = "Idle";
        }
        this.root.updateMatrixWorld(true);
        // The rig's bones carry an inflated world scale (see note above), so divide
        // by the hand's *actual* world scale — not just the holder scale — to land
        // the gun at its natural (viewmodel) size in the guard's grip.
        const inv = 1 / (hand.getWorldScale(new THREE.Vector3()).x || 1);
        gun.scale.setScalar(inv);
        // Aim the barrel (gun-local -Z) along the body's forward by cancelling the
        // hand bone's world rotation. A fixed Euler can't do this for these rigs —
        // the hand bone's orientation varies, so derive it from the live pose.
        const qHand = hand.getWorldQuaternion(new THREE.Quaternion());
        const qRoot = this.root.getWorldQuaternion(new THREE.Quaternion());
        gun.quaternion.copy(qHand.invert().multiply(qRoot));
        gun.position.set(0, 0.03 * inv, 0);
        hand.add(gun);
      }
    }
  }

  /** Switch animation with a crossfade. once=true plays through and holds the last frame. */
  play(name: string, opts: { once?: boolean; fade?: number; timeScale?: number } = {}): void {
    if (this.current === name && !opts.once) return;
    const action = this.actions.get(name);
    if (!action) return;
    const prev = this.actions.get(this.current);
    action.reset();
    action.timeScale = opts.timeScale ?? 1;
    if (opts.once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (prev && prev !== action) action.crossFadeFrom(prev, opts.fade ?? 0.16, false);
    action.play();
    this.current = name;
  }

  setTimeScale(t: number): void {
    const a = this.actions.get(this.current);
    if (a) a.timeScale = t;
  }

  /** BIG HEAD cheat — scaling the head bone scales everything skinned to it. */
  setHeadScale(s: number): void {
    if (this.headBone) this.headBone.scale.setScalar(s);
  }

  /** TINY GUARDS cheat — scales the whole model relative to its fitted size. */
  setBodyScale(s: number): void {
    this.holder.scale.setScalar(this.baseScale * s);
  }

  currentAnim(): string {
    return this.current;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
