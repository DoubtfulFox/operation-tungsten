/**
 * Single source of truth for the controls reference — rendered both in
 * the main-menu controls box and the watch CONTROLS tab.
 */
export const CONTROLS: Array<{ keys: string; action: string }> = [
  { keys: "WASD", action: "MOVE" },
  { keys: "MOUSE", action: "LOOK" },
  { keys: "LMB", action: "FIRE" },
  { keys: "RMB", action: "AIM / SCOPE / DETONATE" },
  { keys: "R", action: "RELOAD" },
  { keys: "F", action: "INTERACT" },
  { keys: "C", action: "CROUCH" },
  { keys: "SPACE", action: "VAULT OVER LOW COVER" },
  { keys: "SHIFT", action: "SNEAK QUIETLY" },
  { keys: "1-8 / WHEEL", action: "WEAPONS (TAP AGAIN TO CYCLE GROUP)" },
  { keys: "TAB / ESC", action: "WATCH (PAUSE)" }
];

export const CONTROL_NOTES: string[] = [
  "SILENCED SHOTS KEEP YOU HIDDEN. GUARDS HEAR LOUD GUNFIRE.",
  "IF A GUARD REACHES AN ALARM PANEL, EXPECT COMPANY."
];

export function controlsHtml(): string {
  const rows = CONTROLS.map(
    (c) => `<div class="ctl-row"><span class="ctl-keys">${c.keys}</span><span class="ctl-action">${c.action}</span></div>`
  ).join("");
  const notes = CONTROL_NOTES.map((n) => `<div class="ctl-note">${n}</div>`).join("");
  return `<div class="ctl-grid">${rows}</div><div class="ctl-notes">${notes}</div>`;
}
