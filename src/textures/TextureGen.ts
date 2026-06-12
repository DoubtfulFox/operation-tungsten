import * as THREE from "three";

/**
 * Procedural canvas texture factory, N64-flavored: multi-octave value
 * noise for surface grime, beveled panel edges, stains and streaks —
 * then BILINEAR filtering (the N64 look was soft, never pixelated).
 * Textures are cached by key.
 */

const cache = new Map<string, THREE.Texture>();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTex(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void,
  repeat = true
): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  let seed = 1;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  draw(ctx, w, h, mulberry32(seed));
  const tex = new THREE.CanvasTexture(canvas);
  // 3-point-bilinear-ish: smooth both ways, with mipmaps
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

// ---- paint helpers -------------------------------------------------------

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Tiling multi-octave value noise field in [0,1]. octaves = [cellSize, amplitude][] */
function noiseField(w: number, h: number, rnd: () => number, octaves: Array<[number, number]>): Float32Array {
  const field = new Float32Array(w * h);
  let total = 0;
  for (const [cell, amp] of octaves) {
    total += amp;
    const gw = Math.max(1, Math.round(w / cell));
    const gh = Math.max(1, Math.round(h / cell));
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * gh;
      const y0 = Math.floor(fy) % gh;
      const y1 = (y0 + 1) % gh;
      let ty = fy - Math.floor(fy);
      ty = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * gw;
        const x0 = Math.floor(fx) % gw;
        const x1 = (x0 + 1) % gw;
        let tx = fx - Math.floor(fx);
        tx = tx * tx * (3 - 2 * tx);
        const v =
          grid[y0 * gw + x0] * (1 - tx) * (1 - ty) +
          grid[y0 * gw + x1] * tx * (1 - ty) +
          grid[y1 * gw + x0] * (1 - tx) * ty +
          grid[y1 * gw + x1] * tx * ty;
        field[y * w + x] += v * amp;
      }
    }
  }
  for (let i = 0; i < field.length; i++) field[i] /= total;
  return field;
}

/** Fill the canvas with base color modulated by tiling noise. */
function paintBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rnd: () => number,
  base: string,
  contrast: number,
  octaves: Array<[number, number]> = [
    [32, 1],
    [11, 0.6],
    [4, 0.35]
  ]
): void {
  const [r, g, b] = hexToRgb(base);
  const field = noiseField(w, h, rnd, octaves);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const m = 1 + (field[i] - 0.5) * 2 * contrast;
    img.data[i * 4] = Math.max(0, Math.min(255, r * m));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, g * m));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, b * m));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Vertical grime streaks running down from a y position. */
function streaks(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * w);
    const y0 = Math.floor(rnd() * h * 0.5);
    const len = h * (0.25 + rnd() * 0.6);
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + len);
    grad.addColorStop(0, `rgba(20,20,16,${alpha})`);
    grad.addColorStop(1, "rgba(20,20,16,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y0, 1 + Math.floor(rnd() * 2), len);
  }
}

/** Soft circular stain. */
function stain(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  grad.addColorStop(0, color.replace(")", `,${alpha})`).replace("rgb", "rgba"));
  grad.addColorStop(1, color.replace(")", ",0)").replace("rgb", "rgba"));
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Beveled edge: light top/left, dark bottom/right — fakes raised panels. */
function bevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, strength = 0.22, inset = false): void {
  const light = `rgba(255,255,240,${inset ? strength * 0.5 : strength})`;
  const dark = `rgba(10,10,8,${strength * 1.4})`;
  ctx.fillStyle = inset ? dark : light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = inset ? light : dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function shadowLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "rgba(8,8,6,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,240,0.12)";
  ctx.fillRect(x, y + h, w, 1);
}

// ---- the textures --------------------------------------------------------

export const Tex = {
  concreteWall(): THREE.Texture {
    return makeTex("concreteWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#6d6e60", 0.16);
      // pour seams with depth
      shadowLine(ctx, 0, 40, w, 2);
      shadowLine(ctx, 0, 92, w, 2);
      streaks(ctx, w, h, rnd, 9, 0.16);
      // stains
      for (let i = 0; i < 3; i++) stain(ctx, rnd() * w, rnd() * h, 12 + rnd() * 18, "rgb(48,46,36)", 0.18);
      // grime gathers at the floor line
      const grad = ctx.createLinearGradient(0, h - 26, 0, h);
      grad.addColorStop(0, "rgba(28,28,22,0)");
      grad.addColorStop(1, "rgba(28,28,22,0.5)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 26, w, 26);
      // hairline cracks
      for (let c = 0; c < 3; c++) {
        let x = rnd() * w;
        ctx.fillStyle = "rgba(40,40,33,0.7)";
        for (let y = Math.floor(rnd() * 30); y < h - rnd() * 40; y++) {
          if (rnd() < 0.35) x += rnd() < 0.5 ? -1 : 1;
          ctx.fillRect((x + w) % w, y, 1, 1);
        }
      }
    });
  },

  metalWall(): THREE.Texture {
    return makeTex("metalWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#59616a", 0.1, [
        [64, 1],
        [3, 0.5]
      ]);
      // brushed vertical sheen
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.045})`;
        ctx.fillRect(x, 0, 1, h);
      }
      // panels with beveled edges
      for (const [px, py, pw, ph] of [
        [0, 0, 64, 64],
        [64, 0, 64, 64],
        [0, 64, 64, 64],
        [64, 64, 64, 64]
      ]) {
        bevel(ctx, px + 1, py + 1, pw - 2, ph - 2, 0.16);
      }
      // rivets with highlight + drop shadow
      for (const px of [8, 56, 72, 120]) {
        for (const py of [8, 56, 72, 120]) {
          ctx.fillStyle = "rgba(10,10,10,0.5)";
          ctx.fillRect(px - 1, py, 3, 3);
          ctx.fillStyle = "#8b929a";
          ctx.fillRect(px - 1, py - 1, 2, 2);
          ctx.fillStyle = "#c9ced4";
          ctx.fillRect(px - 1, py - 1, 1, 1);
        }
      }
      streaks(ctx, w, h, rnd, 6, 0.14);
    });
  },

  labWall(): THREE.Texture {
    return makeTex("labWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#b9bdae", 0.07, [
        [40, 1],
        [6, 0.4]
      ]);
      // tiles: per-tile tone variation + grout
      const ts = 32;
      for (let ty = 0; ty < h; ty += ts) {
        for (let tx = 0; tx < w; tx += ts) {
          ctx.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,245" : "60,64,50"},${0.04 + rnd() * 0.05})`;
          ctx.fillRect(tx, ty, ts, ts);
          bevel(ctx, tx, ty, ts, ts, 0.13);
        }
      }
      // wainscot band at the bottom
      ctx.fillStyle = "rgba(80,88,72,0.85)";
      ctx.fillRect(0, h - 26, w, 26);
      paintWainscot(ctx, w, h, rnd);
      shadowLine(ctx, 0, h - 27, w, 2);
      streaks(ctx, w, h, rnd, 4, 0.08);
    });

    function paintWainscot(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number): void {
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? "30,34,26" : "110,118,98"},0.12)`;
        ctx.fillRect(Math.floor(rnd() * w), h - 26 + Math.floor(rnd() * 26), 2, 1);
      }
    }
  },

  ventWall(): THREE.Texture {
    return makeTex("ventWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#464c52", 0.12, [
        [64, 1],
        [4, 0.5]
      ]);
      // long panel bevels
      bevel(ctx, 1, 1, w - 2, 62, 0.14);
      bevel(ctx, 1, 65, w - 2, 62, 0.14);
      for (const px of [16, 48, 80, 112]) {
        ctx.fillStyle = "#788089";
        ctx.fillRect(px, 30, 2, 2);
        ctx.fillRect(px, 94, 2, 2);
      }
      streaks(ctx, w, h, rnd, 5, 0.2);
    });
  },

  brickWall(): THREE.Texture {
    return makeTex("brickWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#5d5046", 0.1);
      const bh = 16;
      const bw = 32;
      for (let y = 0; y < h; y += bh) {
        const off = (y / bh) % 2 === 0 ? 0 : bw / 2;
        // mortar
        ctx.fillStyle = "#46403a";
        ctx.fillRect(0, y, w, 2);
        for (let x = -bw; x < w + bw; x += bw) {
          ctx.fillRect(((x + off) % w + w) % w, y, 2, bh);
          // per-brick tint
          const tint = rnd();
          ctx.fillStyle = tint < 0.33 ? "rgba(120,95,75,0.16)" : tint < 0.66 ? "rgba(50,40,32,0.16)" : "rgba(0,0,0,0)";
          ctx.fillRect((((x + off + 2) % w) + w) % w, y + 2, bw - 2, bh - 2);
        }
      }
      streaks(ctx, w, h, rnd, 7, 0.15);
      stain(ctx, rnd() * w, h * 0.7, 20, "rgb(40,34,26)", 0.25);
    });
  },

  floorConcrete(): THREE.Texture {
    return makeTex("floorConcrete", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#585a4e", 0.14);
      // expansion joints
      shadowLine(ctx, 0, 0, w, 2);
      ctx.fillStyle = "rgba(8,8,6,0.55)";
      ctx.fillRect(0, 0, 2, h);
      // scuffs and oil
      for (let i = 0; i < 4; i++) stain(ctx, rnd() * w, rnd() * h, 10 + rnd() * 16, "rgb(30,30,24)", 0.22);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,240" : "20,20,16"},0.06)`;
        ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 1);
      }
    });
  },

  floorTile(): THREE.Texture {
    return makeTex("floorTile", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#979d8e", 0.08, [
        [50, 1],
        [7, 0.4]
      ]);
      const ts = 32;
      for (let ty = 0; ty < h; ty += ts) {
        for (let tx = 0; tx < w; tx += ts) {
          ctx.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,245" : "50,54,44"},${0.04 + rnd() * 0.06})`;
          ctx.fillRect(tx, ty, ts, ts);
          // grout
          ctx.fillStyle = "rgba(58,62,52,0.85)";
          ctx.fillRect(tx, ty, ts, 2);
          ctx.fillRect(tx, ty, 2, ts);
          ctx.fillStyle = "rgba(255,255,245,0.1)";
          ctx.fillRect(tx + 2, ty + 2, ts - 2, 1);
        }
      }
      stain(ctx, rnd() * w, rnd() * h, 16, "rgb(40,44,34)", 0.14);
    });
  },

  floorMetal(): THREE.Texture {
    return makeTex("floorMetal", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#4b5158", 0.1, [
        [64, 1],
        [4, 0.45]
      ]);
      // diamond plate
      for (let y = 8; y < h; y += 16) {
        for (let x = 8; x < w; x += 16) {
          const odd = ((x + y) / 16) % 2 === 0;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(odd ? 0.78 : -0.78);
          ctx.fillStyle = "rgba(10,10,10,0.4)";
          ctx.fillRect(-4, 0, 9, 3);
          ctx.fillStyle = "#697077";
          ctx.fillRect(-4, -2, 9, 3);
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(-4, -2, 9, 1);
          ctx.restore();
        }
      }
      shadowLine(ctx, 0, 0, w, 2);
      ctx.fillStyle = "rgba(8,8,6,0.5)";
      ctx.fillRect(0, 0, 2, h);
    });
  },

  floorVent(): THREE.Texture {
    return makeTex("floorVent", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#3d4248", 0.12, [
        [64, 1],
        [5, 0.5]
      ]);
      for (let y = 0; y < h; y += 16) shadowLine(ctx, 0, y, w, 2);
      streaks(ctx, w, h, rnd, 4, 0.18);
    });
  },

  floorSnow(): THREE.Texture {
    return makeTex("floorSnow", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#aeb6bb", 0.1, [
        [40, 1],
        [6, 0.5]
      ]);
      // trampled slush paths and exposed dirt
      for (let i = 0; i < 5; i++) stain(ctx, rnd() * w, rnd() * h, 12 + rnd() * 20, "rgb(96,100,98)", 0.22);
      for (let i = 0; i < 3; i++) stain(ctx, rnd() * w, rnd() * h, 8 + rnd() * 10, "rgb(70,68,58)", 0.16);
      // boot scuffs
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.6 ? "236,242,246" : "120,126,128"},0.1)`;
        ctx.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 5, 1 + rnd() * 2);
      }
    });
  },

  snowWall(): THREE.Texture {
    return makeTex("snowWall", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#5e6258", 0.16);
      shadowLine(ctx, 0, 52, w, 2);
      streaks(ctx, w, h, rnd, 7, 0.14);
      // frost creeping up from the ground line
      const grad = ctx.createLinearGradient(0, h - 40, 0, h);
      grad.addColorStop(0, "rgba(212,222,228,0)");
      grad.addColorStop(1, "rgba(212,222,228,0.55)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 40, w, 40);
      // snow caps along the top edge
      ctx.fillStyle = "rgba(222,230,236,0.7)";
      for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 5, 2 + rnd() * 4);
    });
  },

  trainSide(): THREE.Texture {
    return makeTex("trainSide", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#4a4f42", 0.12);
      // riveted panel seams
      shadowLine(ctx, 0, 32, w, 2);
      shadowLine(ctx, 0, 96, w, 2);
      ctx.fillStyle = "rgba(8,8,6,0.5)";
      ctx.fillRect(42, 0, 2, h);
      ctx.fillRect(86, 0, 2, h);
      for (let y = 8; y < h; y += 24) {
        for (let x = 6; x < w; x += 20) {
          ctx.fillStyle = "rgba(255,255,240,0.16)";
          ctx.fillRect(x, y, 2, 2);
          ctx.fillStyle = "rgba(10,10,8,0.4)";
          ctx.fillRect(x, y + 2, 2, 1);
        }
      }
      // rust bleeding down
      for (let i = 0; i < 4; i++) stain(ctx, rnd() * w, rnd() * h, 8 + rnd() * 9, "rgb(96,62,38)", 0.2);
    });
  },

  floorPlatform(): THREE.Texture {
    return makeTex("floorPlatform", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#666458", 0.12);
      // big paving slabs
      for (const [px, py] of [
        [0, 0],
        [64, 0],
        [0, 64],
        [64, 64]
      ]) {
        bevel(ctx, px + 1, py + 1, 62, 62, 0.12, true);
      }
      // painted safety line along one edge
      ctx.fillStyle = "rgba(196,168,72,0.6)";
      ctx.fillRect(0, 4, w, 6);
      for (let i = 0; i < 4; i++) stain(ctx, rnd() * w, rnd() * h, 10 + rnd() * 14, "rgb(42,42,36)", 0.2);
    });
  },

  ceiling(): THREE.Texture {
    return makeTex("ceiling", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#54564c", 0.1);
      // ceiling panels
      for (const [px, py] of [
        [0, 0],
        [64, 0],
        [0, 64],
        [64, 64]
      ]) {
        bevel(ctx, px + 1, py + 1, 62, 62, 0.1, true);
      }
      for (let i = 0; i < 3; i++) stain(ctx, rnd() * w, rnd() * h, 14, "rgb(35,36,30)", 0.2);
    });
  },

  lightPanel(): THREE.Texture {
    return makeTex("lightPanel", 32, 32, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, "#f4f8e4");
      grad.addColorStop(0.7, "#dde4c8");
      grad.addColorStop(1, "#aab29a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#8a9280";
      ctx.fillRect(0, 0, w, 2);
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillRect(0, 0, 2, h);
      ctx.fillRect(w - 2, 0, 2, h);
      ctx.fillStyle = "rgba(140,148,128,0.6)";
      ctx.fillRect(15, 0, 2, h);
    });
  },

  door(): THREE.Texture {
    return makeTex("door", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#68707a", 0.09, [
        [64, 1],
        [4, 0.4]
      ]);
      // frame rails
      ctx.fillStyle = "#4c535b";
      ctx.fillRect(0, 0, 6, h);
      ctx.fillRect(w - 6, 0, 6, h);
      bevel(ctx, 0, 0, 6, h, 0.2);
      bevel(ctx, w - 6, 0, 6, h, 0.2);
      // recessed panels
      bevel(ctx, 10, 8, w - 20, 40, 0.2, true);
      bevel(ctx, 10, 56, w - 20, 44, 0.2, true);
      shadowLine(ctx, 0, 50, w, 3);
      // window slit
      ctx.fillStyle = "#14181c";
      ctx.fillRect(44, 16, 40, 12);
      bevel(ctx, 43, 15, 42, 14, 0.3, true);
      ctx.fillStyle = "rgba(160,190,210,0.18)";
      ctx.fillRect(46, 17, 12, 4);
      // hazard stripe bottom
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = "#ad9832";
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 8, h - 14);
        ctx.lineTo(x + 16, h - 14);
        ctx.lineTo(x + 8, h);
        ctx.fill();
        ctx.fillStyle = "#23231c";
        ctx.beginPath();
        ctx.moveTo(x + 8, h);
        ctx.lineTo(x + 16, h - 14);
        ctx.lineTo(x + 24, h - 14);
        ctx.lineTo(x + 16, h);
        ctx.fill();
      }
      streaks(ctx, w, h, rnd, 5, 0.12);
      ctx.fillStyle = "rgba(20,20,16,0.35)";
      ctx.fillRect(0, h - 15, w, 1);
    });
  },

  doorLocked(kind: "lab" | "officer"): THREE.Texture {
    const accent = kind === "lab" ? "#4f9f63" : "#a84444";
    return makeTex("doorLocked_" + kind, 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#646b74", 0.09, [
        [64, 1],
        [4, 0.4]
      ]);
      ctx.fillStyle = "#4a5159";
      ctx.fillRect(0, 0, 6, h);
      ctx.fillRect(w - 6, 0, 6, h);
      bevel(ctx, 0, 0, 6, h, 0.2);
      bevel(ctx, w - 6, 0, 6, h, 0.2);
      bevel(ctx, 10, 30, w - 20, 66, 0.2, true);
      // keycard stripe
      ctx.fillStyle = accent;
      ctx.fillRect(12, 12, w - 24, 10);
      bevel(ctx, 12, 12, w - 24, 10, 0.25);
      // card reader box
      ctx.fillStyle = "#15181b";
      ctx.fillRect(52, 66, 24, 30);
      bevel(ctx, 52, 66, 24, 30, 0.3);
      ctx.fillStyle = accent;
      ctx.fillRect(56, 74, 16, 5);
      ctx.fillStyle = "#0c0e10";
      ctx.fillRect(56, 84, 16, 2);
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = "#ad9832";
        ctx.fillRect(x, h - 10, 8, 10);
        ctx.fillStyle = "#23231c";
        ctx.fillRect(x + 8, h - 10, 8, 10);
      }
      streaks(ctx, w, h, rnd, 4, 0.12);
    });
  },

  grate(): THREE.Texture {
    return makeTex("grate", 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#272b2f", 0.15, [
        [32, 1],
        [4, 0.5]
      ]);
      for (let y = 4; y < h; y += 10) {
        ctx.fillStyle = "#5f666d";
        ctx.fillRect(2, y, w - 4, 4);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(2, y, w - 4, 1);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(2, y + 3, w - 4, 1);
      }
      ctx.fillStyle = "#4c5258";
      ctx.fillRect(0, 0, 3, h);
      ctx.fillRect(w - 3, 0, 3, h);
    });
  },

  crate(): THREE.Texture {
    return makeTex("crate", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#75603c", 0.13, [
        [60, 1],
        [5, 0.4]
      ]);
      // planks with grain
      for (let y = 0; y < h; y += 25) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? "40,30,16" : "120,100,64"},0.14)`;
        ctx.fillRect(0, y, w, 25);
        shadowLine(ctx, 0, y, w, 2);
        // grain lines
        for (let i = 0; i < 4; i++) {
          const gy = y + 4 + rnd() * 18;
          ctx.strokeStyle = `rgba(50,38,20,${0.18 + rnd() * 0.15})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          for (let x = 0; x <= w; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.1 + rnd() * 6) * 1.5);
          ctx.stroke();
        }
      }
      // corner brackets
      ctx.fillStyle = "#3e3526";
      for (const [bx, by] of [
        [0, 0],
        [w - 14, 0],
        [0, h - 14],
        [w - 14, h - 14]
      ]) {
        ctx.fillRect(bx, by, 14, 14);
        bevel(ctx, bx, by, 14, 14, 0.2);
      }
      // stencil
      ctx.fillStyle = "rgba(40,30,14,0.85)";
      ctx.font = "bold 16px monospace";
      ctx.fillText("ОПАСНО", 24, 70);
      ctx.font = "10px monospace";
      ctx.fillText("№ 47-Б", 38, 88);
    });
  },

  barrel(): THREE.Texture {
    return makeTex("barrel", 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#7a4030", 0.16, [
        [32, 1],
        [4, 0.5]
      ]);
      // ribs
      for (const ry of [12, 30, 48]) {
        ctx.fillStyle = "#8c5238";
        ctx.fillRect(0, ry, w, 5);
        ctx.fillStyle = "rgba(255,255,240,0.25)";
        ctx.fillRect(0, ry, w, 1);
        ctx.fillStyle = "rgba(10,8,6,0.45)";
        ctx.fillRect(0, ry + 4, w, 1);
      }
      // rust patches
      for (let i = 0; i < 5; i++) stain(ctx, rnd() * w, rnd() * h, 8 + rnd() * 8, "rgb(60,30,18)", 0.4);
      streaks(ctx, w, h, rnd, 5, 0.25);
    });
  },

  tank(): THREE.Texture {
    return makeTex("tank", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#878f96", 0.08, [
        [64, 1],
        [3, 0.35]
      ]);
      // vertical sheen
      const sheen = ctx.createLinearGradient(0, 0, w, 0);
      sheen.addColorStop(0, "rgba(0,0,0,0.25)");
      sheen.addColorStop(0.3, "rgba(255,255,255,0.14)");
      sheen.addColorStop(0.6, "rgba(0,0,0,0.05)");
      sheen.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
      // weld seams
      shadowLine(ctx, 0, 14, w, 2);
      shadowLine(ctx, 0, 110, w, 2);
      // hazard band
      ctx.fillStyle = "#a89a36";
      ctx.fillRect(0, 50, w, 26);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 50, w, 2);
      ctx.fillRect(0, 74, w, 2);
      ctx.fillStyle = "#1d2014";
      ctx.font = "bold 15px monospace";
      ctx.fillText("VX-90", 8, 68);
      ctx.font = "bold 13px monospace";
      ctx.fillText("☠", 76, 68);
      ctx.font = "8px monospace";
      ctx.fillText("НЕРВНО-ПАРАЛИТИЧЕСКИЙ", 8, 88);
      streaks(ctx, w, h, rnd, 4, 0.1);
    });
  },

  screen(): THREE.Texture {
    return makeTex("screen", 64, 64, (ctx, w, h, rnd) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.75);
      grad.addColorStop(0, "#0c1c0e");
      grad.addColorStop(1, "#050a06");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#39d24a";
      for (let y = 6; y < h - 6; y += 6) {
        const len = 6 + Math.floor(rnd() * (w - 18));
        ctx.fillRect(6, y, len, 2);
      }
      ctx.fillStyle = "rgba(60,220,90,0.1)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    });
  },

  serverRack(): THREE.Texture {
    return makeTex("serverRack", 64, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#2c3036", 0.1, [
        [32, 1],
        [4, 0.4]
      ]);
      for (let y = 6; y < h - 8; y += 14) {
        ctx.fillStyle = "#1b1e23";
        ctx.fillRect(5, y, w - 10, 10);
        bevel(ctx, 5, y, w - 10, 10, 0.22, true);
        // vents
        ctx.fillStyle = "rgba(90,96,104,0.5)";
        for (let vx = 24; vx < w - 10; vx += 5) ctx.fillRect(vx, y + 3, 3, 4);
        // status LEDs
        ctx.fillStyle = rnd() < 0.6 ? "#3ad24a" : "#d2b13a";
        ctx.fillRect(9, y + 4, 2, 2);
        if (rnd() < 0.4) {
          ctx.fillStyle = "#d23a3a";
          ctx.fillRect(14, y + 4, 2, 2);
        }
      }
    });
  },

  docsBoard(): THREE.Texture {
    return makeTex("docsBoard", 128, 128, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#6b5436", 0.12, [
        [48, 1],
        [5, 0.4]
      ]);
      bevel(ctx, 0, 0, w, h, 0.25);
      const spots: Array<[number, number, number]> = [
        [10, 12, -0.06],
        [50, 8, 0.04],
        [88, 16, -0.03],
        [16, 64, 0.05],
        [62, 56, -0.05],
        [92, 72, 0.06]
      ];
      for (const [px, py, rot] of spots) {
        ctx.save();
        ctx.translate(px + 14, py + 18);
        ctx.rotate(rot);
        ctx.fillStyle = "rgba(20,16,10,0.4)";
        ctx.fillRect(-13, -17, 28, 38);
        ctx.fillStyle = "#dcdccc";
        ctx.fillRect(-14, -18, 28, 38);
        ctx.fillStyle = "#84847a";
        for (let line = -10; line < 16; line += 5) ctx.fillRect(-10, line, 20, 1);
        ctx.fillStyle = "#c23a3a";
        ctx.fillRect(-2, -20, 4, 4);
        ctx.restore();
      }
      // the formula sheet
      ctx.save();
      ctx.translate(48, 92);
      ctx.rotate(0.03);
      ctx.fillStyle = "#e8e0b4";
      ctx.fillRect(-18, -16, 40, 34);
      ctx.fillStyle = "#9c3030";
      ctx.font = "bold 11px monospace";
      ctx.fillText("VX-90", -12, -2);
      ctx.fillStyle = "#55554a";
      ctx.fillRect(-12, 4, 28, 1);
      ctx.fillRect(-12, 9, 22, 1);
      ctx.fillRect(-12, 14, 25, 1);
      ctx.restore();
    });
  },

  alarmPanel(): THREE.Texture {
    return makeTex("alarmPanel", 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#8c3030", 0.1, [
        [32, 1],
        [4, 0.4]
      ]);
      bevel(ctx, 0, 0, w, h, 0.3);
      ctx.fillStyle = "#6b2222";
      ctx.fillRect(3, 3, w - 6, 12);
      ctx.fillStyle = "#e8e4d8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("ТРЕВОГА", 8, 12);
      // button plate
      ctx.fillStyle = "#d8d4c8";
      ctx.fillRect(18, 22, 28, 26);
      bevel(ctx, 18, 22, 28, 26, 0.3);
      ctx.fillStyle = "#3a3a36";
      ctx.beginPath();
      ctx.arc(32, 35, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#992222";
      ctx.beginPath();
      ctx.arc(31, 34, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(28, 30, 3, 2);
      ctx.fillStyle = "#e8e4d8";
      ctx.font = "bold 7px monospace";
      ctx.fillText("ALARM", 17, 58);
    });
  },

  uniform(jacket: string, belt: string): THREE.Texture {
    return makeTex("uniform_" + jacket + belt, 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, jacket, 0.09, [
        [32, 1],
        [5, 0.5]
      ]);
      // fabric weave
      for (let y = 0; y < h; y += 2) {
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(0, y, w, 1);
      }
      // collar shadow at the top
      const grad = ctx.createLinearGradient(0, 0, 0, 10);
      grad.addColorStop(0, "rgba(0,0,0,0.4)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 10);
      // chest pockets with flaps
      for (const px of [8, 40]) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(px, 22, 16, 12);
        bevel(ctx, px, 22, 16, 12, 0.18);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(px, 22, 16, 4);
        ctx.fillStyle = "#b8a858";
        ctx.fillRect(px + 7, 24, 2, 2);
      }
      // zipper
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(31, 0, 2, 50);
      ctx.fillStyle = "rgba(200,200,190,0.3)";
      ctx.fillRect(33, 0, 1, 50);
      // belt
      ctx.fillStyle = belt;
      ctx.fillRect(0, 50, w, 9);
      bevel(ctx, 0, 50, w, 9, 0.25);
      ctx.fillStyle = "#c9b04a";
      ctx.fillRect(28, 52, 8, 5);
      bevel(ctx, 28, 52, 8, 5, 0.3);
      // shading below belt
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 59, w, 5);
    });
  },

  labcoat(): THREE.Texture {
    return makeTex("labcoat", 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#cfd1c6", 0.06, [
        [32, 1],
        [6, 0.4]
      ]);
      const grad = ctx.createLinearGradient(0, 0, 0, 10);
      grad.addColorStop(0, "rgba(0,0,0,0.3)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 10);
      // lapels
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(32, 18);
      ctx.lineTo(40, 0);
      ctx.fill();
      // buttons
      ctx.fillStyle = "#8a8c80";
      for (const by of [22, 32, 42]) ctx.fillRect(31, by, 3, 3);
      // breast pocket with pens
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(10, 22, 14, 12);
      ctx.fillStyle = "#3a4a8c";
      ctx.fillRect(13, 19, 2, 7);
      ctx.fillStyle = "#8c3a3a";
      ctx.fillRect(17, 19, 2, 7);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 56, w, 8);
    });
  },

  face(): THREE.Texture {
    return makeTex("face", 64, 64, (ctx, w, h, rnd) => {
      // skin with side shading
      paintBase(ctx, w, h, rnd, "#c4946a", 0.05, [
        [32, 1],
        [8, 0.4]
      ]);
      const side = ctx.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, "rgba(60,30,16,0.35)");
      side.addColorStop(0.25, "rgba(60,30,16,0)");
      side.addColorStop(0.75, "rgba(60,30,16,0)");
      side.addColorStop(1, "rgba(60,30,16,0.35)");
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, w, h);
      // hair
      ctx.fillStyle = "#3a2d20";
      ctx.fillRect(0, 0, w, 14);
      for (let x = 0; x < w; x += 3) {
        ctx.fillRect(x, 12, 2, 2 + Math.floor(rnd() * 4));
      }
      // brow ridge shadow
      ctx.fillStyle = "rgba(70,40,22,0.5)";
      ctx.fillRect(10, 22, 18, 3);
      ctx.fillRect(36, 22, 18, 3);
      // eyebrows
      ctx.fillStyle = "#3e2e1c";
      ctx.fillRect(11, 20, 16, 3);
      ctx.fillRect(37, 20, 16, 3);
      // eyes
      for (const ex of [14, 40]) {
        ctx.fillStyle = "#e8e2d2";
        ctx.fillRect(ex, 26, 11, 6);
        ctx.fillStyle = "#4a3a28";
        ctx.fillRect(ex + 4, 26, 4, 6);
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(ex + 5, 28, 2, 3);
        ctx.fillStyle = "rgba(60,30,16,0.4)";
        ctx.fillRect(ex, 25, 11, 1);
      }
      // nose
      ctx.fillStyle = "rgba(70,40,22,0.35)";
      ctx.fillRect(30, 30, 2, 12);
      ctx.fillRect(28, 41, 8, 2);
      ctx.fillStyle = "rgba(40,22,12,0.5)";
      ctx.fillRect(28, 42, 2, 2);
      ctx.fillRect(34, 42, 2, 2);
      // mouth
      ctx.fillStyle = "rgba(60,28,20,0.75)";
      ctx.fillRect(24, 50, 16, 2);
      ctx.fillStyle = "rgba(180,110,90,0.4)";
      ctx.fillRect(26, 52, 12, 2);
      // stubble
      for (let i = 0; i < 130; i++) {
        const sx = 8 + rnd() * 48;
        const sy = 44 + rnd() * 18;
        if (sx > 22 && sx < 42 && sy > 47 && sy < 56) continue;
        ctx.fillStyle = "rgba(40,28,18,0.25)";
        ctx.fillRect(sx, sy, 1, 1);
      }
    });
  },

  scientistFace(): THREE.Texture {
    return makeTex("scientistFace", 64, 64, (ctx, w, h, rnd) => {
      paintBase(ctx, w, h, rnd, "#d2a87c", 0.05, [
        [32, 1],
        [8, 0.4]
      ]);
      const side = ctx.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, "rgba(70,40,22,0.3)");
      side.addColorStop(0.25, "rgba(70,40,22,0)");
      side.addColorStop(0.75, "rgba(70,40,22,0)");
      side.addColorStop(1, "rgba(70,40,22,0.3)");
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, w, h);
      // grey receding hair
      ctx.fillStyle = "#b4b8bc";
      ctx.fillRect(0, 0, 14, 10);
      ctx.fillRect(50, 0, 14, 10);
      ctx.fillRect(0, 0, w, 4);
      // wrinkles
      ctx.fillStyle = "rgba(90,60,36,0.35)";
      ctx.fillRect(16, 14, 32, 1);
      ctx.fillRect(20, 17, 24, 1);
      // glasses
      ctx.strokeStyle = "#22262c";
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 24, 18, 12);
      ctx.strokeRect(36, 24, 18, 12);
      ctx.beginPath();
      ctx.moveTo(28, 29);
      ctx.lineTo(36, 29);
      ctx.stroke();
      ctx.fillStyle = "rgba(150,180,200,0.35)";
      ctx.fillRect(12, 26, 14, 8);
      ctx.fillRect(38, 26, 14, 8);
      ctx.fillStyle = "#2c241c";
      ctx.fillRect(16, 28, 3, 4);
      ctx.fillRect(43, 28, 3, 4);
      // nose + mouth
      ctx.fillStyle = "rgba(80,46,26,0.35)";
      ctx.fillRect(30, 34, 2, 10);
      ctx.fillStyle = "rgba(70,34,24,0.7)";
      ctx.fillRect(25, 50, 14, 2);
    });
  },

  sign(text: string, fg = "#d8d4c0", bg = "#3a4148"): THREE.Texture {
    return makeTex(
      "sign_" + text,
      128,
      32,
      (ctx, w, h, rnd) => {
        paintBase(ctx, w, h, rnd, bg, 0.08, [
          [32, 1],
          [4, 0.4]
        ]);
        bevel(ctx, 0, 0, w, h, 0.3);
        ctx.fillStyle = fg;
        ctx.font = "bold 17px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text, w / 2, 22);
      },
      false
    );
  },

  hazardStripe(): THREE.Texture {
    return makeTex("hazardStripe", 32, 8, (ctx, w, h) => {
      for (let x = -8; x < w; x += 8) {
        ctx.fillStyle = "#b9a23a";
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 4, 0);
        ctx.lineTo(x + 8, 0);
        ctx.lineTo(x + 4, h);
        ctx.fill();
        ctx.fillStyle = "#26261f";
        ctx.beginPath();
        ctx.moveTo(x + 4, h);
        ctx.lineTo(x + 8, 0);
        ctx.lineTo(x + 12, 0);
        ctx.lineTo(x + 8, h);
        ctx.fill();
      }
    });
  }
};

/** Shared Lambert material per texture, cached. */
const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function lambert(tex: THREE.Texture, opts: { emissive?: number; color?: number } = {}): THREE.MeshLambertMaterial {
  const key = tex.uuid + "|" + (opts.emissive ?? 0) + "|" + (opts.color ?? 0xffffff);
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshLambertMaterial({ map: tex, color: opts.color ?? 0xffffff });
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveMap = tex;
  }
  matCache.set(key, m);
  return m;
}
