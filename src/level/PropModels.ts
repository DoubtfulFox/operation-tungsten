import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * CC0 GLB prop models (Kenney "Car Kit" / racing kit, CC0), loaded once and
 * cloned per build — same pattern as the weapon/character rigs. Each model is
 * flattened to flat Lambert, auto-oriented length-along-Z, scaled to a target
 * length, recentred on x/z and sat on the floor, with a collider derived from
 * its bounds. Anything without an entry here falls back to the procedural mesh
 * in LevelBuilder.buildProp.
 */
interface PropModelDef {
  file: string;
  /** scale so the longest horizontal dimension reaches this many world units */
  targetLen: number;
  /** recolor the body (mid-luminance) materials to this, keeping tyres/glass */
  bodyTint?: number;
}

const MODELS: Record<string, PropModelDef> = {
  // tint multiplies over Kenney's colour-atlas texture (Textures/colormap.png) → olive-drab
  // body while the atlas keeps tyres dark and glass distinct
  truck: { file: "truck.glb", targetLen: 6.0, bodyTint: 0x4d5942 }
};

const cache = new Map<string, THREE.Group>();

function toLambert(src: THREE.Material): THREE.MeshLambertMaterial {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshLambertMaterial({ color: s.color ? s.color.clone() : new THREE.Color(0x9099a0), map: s.map ?? null });
  m.vertexColors = !!s.vertexColors;
  m.name = s.name;
  return m;
}

/**
 * Multiply a tint over the material colour. Kenney models share one colour-atlas
 * texture, so the tint shifts the whole truck toward olive while the atlas keeps the
 * tyres dark and the body/glass distinct (final colour = tint × texel).
 */
function tintBody(m: THREE.MeshLambertMaterial, tint: number): void {
  if (m.color) m.color.setHex(tint);
}

/** Lazy-load all referenced GLBs and flatten their materials to the retro Lambert look. */
export async function loadPropAssets(): Promise<void> {
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
        mesh.frustumCulled = false;
      });
      cache.set(file, gltf.scene);
    })
  );
}

/**
 * A transformed clone of the GLB prop plus a fitted collider, or null to use the
 * procedural mesh. Returns the same `{ group, collider }` shape buildProp expects.
 */
export function buildPropModel(id: string): { group: THREE.Group; collider: { hw: number; hh: number; hd: number } } | null {
  const def = MODELS[id];
  if (!def) return null;
  const src = cache.get(def.file);
  if (!src) return null;

  const model = src.clone(true);
  // per-instance materials so the tint doesn't bleed across clones
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const lm = (m as THREE.MeshLambertMaterial).clone();
      if (def.bodyTint != null) tintBody(lm, def.bodyTint);
      return lm;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });

  // auto-orient so the longer footprint axis runs along Z (level `rot` turns from there)
  model.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (size.x > size.z) model.rotation.y = Math.PI / 2;

  // scale to target length, then recentre on x/z and sit on the floor
  model.updateMatrixWorld(true);
  size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const s = def.targetLen / (Math.max(size.x, size.z) || 1);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  const g = new THREE.Group();
  g.add(model);
  return { group: g, collider: { hw: size.x / 2, hh: size.y / 2, hd: size.z / 2 } };
}
