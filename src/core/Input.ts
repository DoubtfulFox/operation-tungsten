import { type GameAction, DEFAULT_BINDINGS, loadBindings, saveBindings } from "./Bindings";

/** Codes that would scroll/navigate the page; suppressed while locked. */
const PREVENT_WHEN_LOCKED = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * Keyboard + mouse input with Pointer Lock. Mouse buttons are folded
 * into the same code space as keys ("Mouse0/1/2"), so every control
 * resolves through one rebindable action → code map. Tracks held state
 * plus one-frame "pressed" edges; mouse deltas accumulate between frames.
 */
export class Input {
  /** held codes — keys and "Mouse<button>" alike */
  keysDown = new Set<string>();
  keysPressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;

  /** action → input code; rebindable, persisted to localStorage */
  bindings = loadBindings();

  /** Fired when pointer lock is lost for any reason (Esc included). */
  onLockLost: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    document.addEventListener("keydown", (e) => {
      // keep browser behaviors (tab focus, page scroll) from stealing game keys
      if (e.code === "Tab" || (this.locked && PREVENT_WHEN_LOCKED.has(e.code))) e.preventDefault();
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
      const code = "Mouse" + e.button;
      this.keysPressed.add(code);
      this.keysDown.add(code);
    });
    document.addEventListener("mouseup", (e) => {
      this.keysDown.delete("Mouse" + e.button);
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

  /** True while the action's bound input is held. */
  actionDown(action: GameAction): boolean {
    const c = this.bindings[action];
    return c ? this.keysDown.has(c) : false;
  }

  /** True on the frame the action's bound input goes down. */
  actionPressed(action: GameAction): boolean {
    const c = this.bindings[action];
    return c ? this.keysPressed.has(c) : false;
  }

  /** Assign a code to an action; clears it from any other action it collided with. */
  rebind(action: GameAction, code: string): void {
    for (const k of Object.keys(this.bindings) as GameAction[]) {
      if (k !== action && this.bindings[k] === code) this.bindings[k] = "";
    }
    this.bindings[action] = code;
    saveBindings(this.bindings);
  }

  resetBindings(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveBindings(this.bindings);
  }

  /** Call at the end of every frame to clear edge/delta state. */
  endFrame(): void {
    this.keysPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
