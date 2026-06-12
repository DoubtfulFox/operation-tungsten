/**
 * Keyboard + mouse input with Pointer Lock. Tracks held state plus
 * one-frame "pressed" edges; mouse deltas accumulate between frames
 * and are consumed by the game loop.
 */
export class Input {
  keysDown = new Set<string>();
  keysPressed = new Set<string>();
  buttonsDown = new Set<number>();
  buttonsPressed = new Set<number>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;

  /** Fired when pointer lock is lost for any reason (Esc included). */
  onLockLost: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    document.addEventListener("keydown", (e) => {
      // keep browser behaviors (tab focus, page scroll) from stealing game keys
      if (e.code === "Tab" || (this.locked && e.code === "Space")) e.preventDefault();
      if (!e.repeat) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
    });
    document.addEventListener("keyup", (e) => {
      this.keysDown.delete(e.code);
    });
    document.addEventListener("mousemove", (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    document.addEventListener("mousedown", (e) => {
      this.buttonsDown.add(e.button);
      this.buttonsPressed.add(e.button);
    });
    document.addEventListener("mouseup", (e) => {
      this.buttonsDown.delete(e.button);
    });
    document.addEventListener(
      "wheel",
      (e) => {
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true }
    );
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === this.el;
      if (wasLocked && !this.locked && this.onLockLost) this.onLockLost();
    });
  }

  requestLock(): void {
    if (!this.locked) this.el.requestPointerLock();
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  down(code: string): boolean {
    return this.keysDown.has(code);
  }

  pressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  buttonDown(b: number): boolean {
    return this.buttonsDown.has(b);
  }

  buttonPressed(b: number): boolean {
    return this.buttonsPressed.has(b);
  }

  /** Call at the end of every frame to clear edge/delta state. */
  endFrame(): void {
    this.keysPressed.clear();
    this.buttonsPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
