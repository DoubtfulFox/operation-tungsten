import { SLOT_GROUPS } from "../weapons/WeaponDefs";

/**
 * Rebindable input actions. A binding "code" is either a KeyboardEvent
 * `code` ("KeyW", "Space", "ShiftLeft", "Digit1", "ArrowUp"…) or a
 * synthetic mouse code ("Mouse0" LMB, "Mouse1" MMB, "Mouse2" RMB), so
 * any control can map to any key or mouse button.
 */
export type GameAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sneak"
  | "fire"
  | "aim"
  | "reload"
  | "crouch"
  | "vault"
  | "interact"
  | "pause"
  | "weapon1"
  | "weapon2"
  | "weapon3"
  | "weapon4"
  | "weapon5"
  | "weapon6"
  | "weapon7"
  | "weapon8";

export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sneak: "ShiftLeft",
  fire: "Mouse0",
  aim: "Mouse2",
  reload: "KeyR",
  crouch: "KeyC",
  vault: "Space",
  interact: "KeyF",
  pause: "Tab",
  weapon1: "Digit1",
  weapon2: "Digit2",
  weapon3: "Digit3",
  weapon4: "Digit4",
  weapon5: "Digit5",
  weapon6: "Digit6",
  weapon7: "Digit7",
  weapon8: "Digit8"
};

/** Grouped action list for the rebinding UI. */
export const ACTION_GROUPS: Array<{ title: string; actions: Array<{ id: GameAction; label: string }> }> = [
  {
    title: "MOVEMENT",
    actions: [
      { id: "forward", label: "MOVE FORWARD" },
      { id: "back", label: "MOVE BACK" },
      { id: "left", label: "STRAFE LEFT" },
      { id: "right", label: "STRAFE RIGHT" },
      { id: "sneak", label: "SNEAK" },
      { id: "crouch", label: "CROUCH" },
      { id: "vault", label: "VAULT" }
    ]
  },
  {
    title: "COMBAT",
    actions: [
      { id: "fire", label: "FIRE" },
      { id: "aim", label: "AIM / SCOPE / DETONATE" },
      { id: "reload", label: "RELOAD" },
      { id: "interact", label: "INTERACT" },
      { id: "pause", label: "WATCH (PAUSE)" }
    ]
  },
  {
    title: "WEAPONS",
    actions: SLOT_GROUPS.map((g) => ({
      id: ("weapon" + g.key) as GameAction,
      label: `SLOT ${g.key} · ${g.label}`
    }))
  }
];

/** Human-readable label for a binding code. */
export function prettyKey(code: string): string {
  if (!code) return "—";
  const map: Record<string, string> = {
    Mouse0: "LMB",
    Mouse1: "MMB",
    Mouse2: "RMB",
    Space: "SPACE",
    Tab: "TAB",
    Escape: "ESC",
    Enter: "ENTER",
    ShiftLeft: "L-SHIFT",
    ShiftRight: "R-SHIFT",
    ControlLeft: "L-CTRL",
    ControlRight: "R-CTRL",
    AltLeft: "L-ALT",
    AltRight: "R-ALT",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    Backspace: "⌫"
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "NUM " + code.slice(6);
  if (code.startsWith("Mouse")) return "MOUSE " + code.slice(5);
  return code.toUpperCase();
}

const KEY = "tungsten-bindings";

export function loadBindings(): Record<GameAction, string> {
  const b: Record<GameAction, string> = { ...DEFAULT_BINDINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<GameAction, string>>;
      for (const k of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
        if (typeof saved[k] === "string") b[k] = saved[k] as string;
      }
    }
  } catch {
    // first run or corrupt — defaults stand
  }
  return b;
}

export function saveBindings(b: Record<GameAction, string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // storage unavailable — bindings just won't persist
  }
}
