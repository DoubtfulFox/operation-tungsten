import * as THREE from "three";

/**
 * Renders the scene into a ~240px-tall render target and blits it to
 * the canvas with BILINEAR upscaling. The N64-on-a-CRT look was soft
 * and smeary, never pixelated — nearest-neighbor reads as "Minecraft",
 * linear reads as "N64 through composite video".
 */
export class RetroRenderer {
  readonly renderer: THREE.WebGLRenderer;
  enabled = true;
  virtualHeight = 272;

  private rt: THREE.WebGLRenderTarget;
  private blitScene = new THREE.Scene();
  private blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(1);

    this.rt = new THREE.WebGLRenderTarget(320, 240, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true
    });

    const mat = new THREE.MeshBasicMaterial({ map: this.rt.texture, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    this.blitScene.add(quad);
  }

  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    const vh = this.virtualHeight;
    const vw = Math.max(64, Math.round((vh * w) / h));
    this.rt.setSize(vw, vh);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCam);
  }

  setRetro(on: boolean): void {
    this.enabled = on;
    this.setSize(this.width, this.height);
  }
}
