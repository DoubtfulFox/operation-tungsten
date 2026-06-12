import type { Input } from "../core/Input";
import { ACTION_GROUPS, type GameAction, prettyKey } from "../core/Bindings";

/**
 * Interactive control remapper. Renders the action list with each
 * binding as a clickable chip; click → "press any key/mouse button" →
 * the next input is captured and assigned (clearing any conflict).
 * Shared by the main-menu controls box and the watch CONTROLS tab.
 */
export function mountKeyBindings(host: HTMLElement, input: Input): void {
  let listening: GameAction | null = null;
  let capture: ((e: KeyboardEvent | MouseEvent) => void) | null = null;

  const stopListening = (): void => {
    if (capture) {
      document.removeEventListener("keydown", capture, true);
      document.removeEventListener("mousedown", capture, true);
      capture = null;
    }
    listening = null;
  };

  const beginListening = (action: GameAction): void => {
    stopListening();
    listening = action;
    render();
    capture = (e: KeyboardEvent | MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e instanceof KeyboardEvent) {
        if (e.code === "Escape") {
          stopListening();
          render();
          return;
        }
        input.rebind(action, e.code);
      } else {
        input.rebind(action, "Mouse" + e.button);
      }
      stopListening();
      render();
    };
    // attach on the next tick so the click that started this doesn't bind itself
    setTimeout(() => {
      if (!listening) return;
      document.addEventListener("keydown", capture!, true);
      document.addEventListener("mousedown", capture!, true);
    }, 0);
  };

  function render(): void {
    const groups = ACTION_GROUPS.map((g) => {
      const rows = g.actions
        .map((a) => {
          const live = listening === a.id;
          const cls = "kb-chip" + (live ? " listening" : "");
          const txt = live ? "PRESS ANY KEY…" : prettyKey(input.bindings[a.id]);
          return `<div class="kb-row"><span class="kb-label">${a.label}</span><button class="${cls}" data-action="${a.id}">${txt}</button></div>`;
        })
        .join("");
      return `<div class="kb-group"><div class="kb-title">${g.title}</div>${rows}</div>`;
    }).join("");

    host.innerHTML =
      groups +
      `<div class="kb-foot"><button class="kb-reset" data-reset="1">RESET TO DEFAULTS</button>` +
      `<span class="kb-hint">Click a key, then press any key or mouse button. ESC cancels.</span></div>`;

    for (const btn of host.querySelectorAll<HTMLButtonElement>("[data-action]")) {
      btn.onclick = () => beginListening(btn.dataset.action as GameAction);
    }
    const reset = host.querySelector<HTMLButtonElement>("[data-reset]");
    if (reset) {
      reset.onclick = () => {
        stopListening();
        input.resetBindings();
        render();
      };
    }
  }

  render();
}
