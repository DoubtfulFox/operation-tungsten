import * as THREE from "three";
import type { Sfx } from "../audio/Sfx";

interface Casing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  bounces: number;
}

interface Particle {
  vel: THREE.Vector3;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  color: THREE.Color;
  size: number;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Shock {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  targetScale: number;
}

const MAX_PARTICLES = 360;
const MAX_CASINGS = 36;
const MAX_DECALS = 90;
const UP = new THREE.Vector3(0, 1, 0);
const PAINT_COLORS = [0xff3355, 0x33aaff, 0x44dd44, 0xffcc22, 0xcc44ff];

function makeDecalTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, "rgba(12,11,9,0.95)");
  grad.addColorStop(0.4, "rgba(20,18,15,0.8)");
  grad.addColorStop(0.75, "rgba(30,28,24,0.35)");
  grad.addColorStop(1, "rgba(30,28,24,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  // chipped rim
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 5;
    ctx.fillStyle = "rgba(8,8,6,0.5)";
    ctx.fillRect(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/** White splat the paintball materials tint per-color. */
function makeSplatTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 13);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  // runny droplets
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 6;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, 2 + Math.random() * 2, 2 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Chunky retro particles (THREE.Points), 1-pixel tracer lines, shared
 * muzzle-flash / explosion lights (kept permanently in the scene so the
 * forward renderer never recompiles shaders mid-firefight).
 */
export class Effects {
  group = new THREE.Group();
  flashLight: THREE.PointLight;
  explosionLight: THREE.PointLight;
  /** PAINTBALL cheat — splats instead of bullet holes, rainbow blood */
  paintball = false;

  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private shocks: Shock[] = [];
  private casings: Casing[] = [];
  private decals: THREE.Mesh[] = [];
  private points: THREE.Points;
  private posAttr: THREE.Float32BufferAttribute;
  private colAttr: THREE.Float32BufferAttribute;
  private casingGeo = new THREE.BoxGeometry(0.024, 0.011, 0.011);
  private casingMat = new THREE.MeshLambertMaterial({ color: 0xc09a44 });
  private decalGeo = new THREE.PlaneGeometry(1, 1);
  private decalMat = new THREE.MeshBasicMaterial({
    map: makeDecalTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  // pre-built so toggling the cheat never compiles shaders mid-firefight
  private paintMats = PAINT_COLORS.map(
    (color) =>
      new THREE.MeshBasicMaterial({
        map: makeSplatTexture(),
        color,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
  );
  private paintIdx = 0;
  private tracerMat = new THREE.LineBasicMaterial({
    color: 0xffe8a0,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  constructor(private sfx?: Sfx) {
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    this.colAttr = new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    geo.setAttribute("position", this.posAttr);
    geo.setAttribute("color", this.colAttr);
    const mat = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, sizeAttenuation: true, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    this.flashLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.4);
    this.explosionLight = new THREE.PointLight(0xffa040, 0, 30, 1.0);
    this.group.add(this.flashLight);
    this.group.add(this.explosionLight);
  }

  private spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, gravity: number, color: number, size = 1): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      pos: pos.clone(),
      vel,
      life,
      maxLife: life,
      gravity,
      color: new THREE.Color(color),
      size
    });
  }

  sparks(pos: THREE.Vector3, normal: THREE.Vector3, color = 0xffd080, count = 6): void {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      v.addScaledVector(normal, 1.6 + Math.random() * 2);
      this.spawn(pos, v, 0.22 + Math.random() * 0.18, 7, color);
    }
  }

  blood(pos: THREE.Vector3): void {
    for (let i = 0; i < 7; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 1.6 - 0.3, (Math.random() - 0.5) * 2.4);
      const col = this.paintball ? PAINT_COLORS[(Math.random() * PAINT_COLORS.length) | 0] : 0x8c1818;
      this.spawn(pos, v, 0.3 + Math.random() * 0.2, 6, col);
    }
  }

  smoke(pos: THREE.Vector3, count = 8): void {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.4, (Math.random() - 0.5) * 1.2);
      this.spawn(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), v, 0.9 + Math.random() * 0.7, -0.4, 0x3a3a3a);
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.group.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  muzzleFlash(pos: THREE.Vector3): void {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 5;
  }

  /** Eject a spent casing that arcs right and tinkles on the floor. */
  spawnCasing(pos: THREE.Vector3, right: THREE.Vector3, fwd: THREE.Vector3): void {
    if (this.casings.length >= MAX_CASINGS) {
      const old = this.casings.shift()!;
      this.group.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.group.add(mesh);
    const vel = right
      .clone()
      .multiplyScalar(1.5 + Math.random() * 0.9)
      .addScaledVector(UP, 1.3 + Math.random() * 0.8)
      .addScaledVector(fwd, (Math.random() - 0.5) * 0.6);
    this.casings.push({
      mesh,
      vel,
      spin: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
      life: 4,
      bounces: 0
    });
  }

  /** Persistent bullet hole. Pass `parent` to pin it to a moving object (door panels). */
  spawnDecal(point: THREE.Vector3, normal: THREE.Vector3, parent?: THREE.Object3D): void {
    if (this.decals.length >= MAX_DECALS) {
      const old = this.decals.shift()!;
      old.removeFromParent();
    }
    const paint = this.paintball;
    const size = (0.11 + Math.random() * 0.06) * (paint ? 2.2 : 1);
    const mesh = new THREE.Mesh(this.decalGeo, paint ? this.paintMats[this.paintIdx++ % this.paintMats.length] : this.decalMat);
    mesh.scale.setScalar(size);
    mesh.position.copy(point).addScaledVector(normal, 0.012);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.group.add(mesh);
    if (parent) parent.attach(mesh);
    this.decals.push(mesh);
  }

  explosion(pos: THREE.Vector3): void {
    this.explosionLight.position.copy(pos);
    this.explosionLight.intensity = 26;
    // fireball
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9);
      this.spawn(pos, v, 0.35 + Math.random() * 0.3, 6, i % 3 === 0 ? 0xffe080 : 0xff7020);
    }
    this.smoke(pos, 14);
    // shockwave sphere
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffb050,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.shocks.push({ mesh, life: 0.3, maxLife: 0.3, targetScale: 5.5 });
  }

  update(dt: number): void {
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
    }
    const pa = this.posAttr.array as Float32Array;
    const ca = this.colAttr.array as Float32Array;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        pa[i * 3] = p.pos.x;
        pa[i * 3 + 1] = p.pos.y;
        pa[i * 3 + 2] = p.pos.z;
        const f = p.life / p.maxLife;
        ca[i * 3] = p.color.r * f;
        ca[i * 3 + 1] = p.color.g * f;
        ca[i * 3 + 2] = p.color.b * f;
      } else {
        pa[i * 3 + 1] = -200;
      }
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;

    // tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.group.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // shockwaves
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life -= dt;
      const f = 1 - s.life / s.maxLife;
      s.mesh.scale.setScalar(0.5 + f * s.targetScale);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - f);
      if (s.life <= 0) {
        this.group.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.shocks.splice(i, 1);
      }
    }

    // shell casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.group.remove(c.mesh);
        this.casings.splice(i, 1);
        continue;
      }
      if (c.bounces < 3) {
        c.vel.y -= 9.8 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += c.spin.x * dt;
        c.mesh.rotation.y += c.spin.y * dt;
        c.mesh.rotation.z += c.spin.z * dt;
        if (c.mesh.position.y < 0.012 && c.vel.y < 0) {
          c.mesh.position.y = 0.012;
          c.vel.y *= -0.32;
          c.vel.x *= 0.55;
          c.vel.z *= 0.55;
          c.spin.multiplyScalar(0.5);
          c.bounces++;
          if (c.bounces === 1 && this.sfx) this.sfx.casing(c.mesh.position);
          if (c.bounces >= 3) c.vel.set(0, 0, 0);
        }
      }
    }

    // light decay
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 90);
    this.explosionLight.intensity = Math.max(0, this.explosionLight.intensity - dt * 60);
  }
}
