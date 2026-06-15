import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * CC0 GLB weapon models (Quaternius "Ultimate Guns Pack", CC0),
 * loaded once and cloned per build — same pattern as the character rigs.
 * Each model is recentred at the origin with the barrel down -Z and a "muzzle"
 * empty at the tip, so it drops into the viewmodel / pickups / guard hands
 * exactly like the procedural meshes. Anything without an entry here falls back
 * to the hand-built mesh in GunMeshes.
 *
 * scale/rotY/muzzle are a first-pass fit — tune against the in-game look.
 */
interface ModelDef {
  file: string;
  /** uniform scale to bring the model to viewmodel size */
  scale: number;
  /** Y rotation to point the barrel down -Z (Quaternius guns model along +X) */
  rotY: number;
  /** muzzle tip offset (after centring), barrel points -Z */
  muzzle: [number, number, number];
  /** optional flat recolor (e.g. the Golden Gun) */
  tint?: number;
}

const MODELS: Record<string, ModelDef> = {
  pp9: { file: "q_pistol1.glb", scale: 0.12, rotY: Math.PI / 2, muzzle: [0, 0, -0.13] },
  dd4: { file: "q_pistol2.glb", scale: 0.11, rotY: Math.PI / 2, muzzle: [0, 0, -0.15] },
  golden: { file: "q_pistol3.glb", scale: 0.12, rotY: Math.PI / 2, muzzle: [0, 0, -0.13], tint: 0xc9a227 },
  klobb: { file: "q_smg.glb", scale: 0.1, rotY: Math.PI / 2, muzzle: [0, 0, -0.22] },
  kr7: { file: "q_rifle.glb", scale: 0.13, rotY: Math.PI / 2, muzzle: [0, 0, -0.36] },
  shotgun: { file: "q_shotgun.glb", scale: 0.12, rotY: Math.PI / 2, muzzle: [0, 0, -0.36] },
  sniper: { file: "q_sniper.glb", scale: 0.13, rotY: Math.PI / 2, muzzle: [0, 0, -0.45] }
  // railgun, camera, slappers, knife, lockpick, grenade, mines stay procedural
};

const cache = new Map<string, THREE.Group>();

function toLambert(src: THREE.Material): THREE.MeshLambertMaterial {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshLambertMaterial({ color: s.color ? s.color.clone() : new THREE.Color(0x9099a0), map: s.map ?? null });
  m.vertexColors = !!s.vertexColors; // Quaternius guns are vertex-coloured
  return m;
}

/** Lazy-load all referenced GLBs and flatten their materials to the retro Lambert look. */
export async function loadWeaponAssets(): Promise<void> {
  const files = [...new Set(Object.values(MODELS).map((m) => m.file))];
  const loader = new GLTFLoader();
  await Promise.all(
    files.map(async (file) => {
      if (cache.has(file)) return;
      const gltf = await loader.loadAsync(import.meta.env.BASE_URL + "models/" + file);
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toLambert) : toLambert(mesh.material);
      });
      cache.set(file, gltf.scene);
    })
  );
}

/** A transformed clone of the GLB for this weapon, or null to use the procedural mesh. */
export function buildWeaponModel(id: string): THREE.Group | null {
  const def = MODELS[id];
  if (!def) return null;
  const src = cache.get(def.file);
  if (!src) return null;

  const model = src.clone(true);
  model.rotation.y = def.rotY;
  model.scale.setScalar(def.scale);
  if (def.tint != null) {
    const mat = new THREE.MeshLambertMaterial({ color: def.tint, emissive: 0x2a1f06 });
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = mat;
    });
  }
  // recentre so the model's bounding box sits at the holder origin
  model.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.position.sub(c);

  const g = new THREE.Group();
  g.add(model);
  const muz = new THREE.Object3D();
  muz.name = "muzzle";
  muz.position.set(def.muzzle[0], def.muzzle[1], def.muzzle[2]);
  g.add(muz);
  return g;
}
