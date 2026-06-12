/**
 * Campaign progress in localStorage. Versioned; fields are only ever
 * added, and a corrupt save degrades to defaults instead of throwing.
 */
import { LEVELS } from "../level/levels";

const KEY = "tungsten-campaign";

/**
 * Dev/sandbox: all missions are selectable from the start so every level
 * is reachable for testing. For the "earn your unlock" campaign release,
 * set this false — then only m1 is open and beating a level unlocks the
 * next (recordWin already wires the chain).
 */
const UNLOCK_ALL = true;

export interface BestEntry {
  rating: string;
  timeSec: number;
  difficulty: string;
}

export interface CampaignSave {
  version: number;
  unlocked: string[];
  best: Record<string, BestEntry>;
}

function baseUnlocked(): string[] {
  return UNLOCK_ALL ? LEVELS.map((l) => l.id) : ["m1"];
}

function defaults(): CampaignSave {
  return { version: 1, unlocked: baseUnlocked(), best: {} };
}

export function loadCampaign(): CampaignSave {
  const save = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(save, JSON.parse(raw));
  } catch {
    // first run or corrupt save
  }
  if (!Array.isArray(save.unlocked) || save.unlocked.length === 0) save.unlocked = ["m1"];
  // honor UNLOCK_ALL even over an older saved progression
  for (const id of baseUnlocked()) if (!save.unlocked.includes(id)) save.unlocked.push(id);
  if (typeof save.best !== "object" || save.best === null) save.best = {};
  return save;
}

export function saveCampaign(save: CampaignSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable — progress just won't persist
  }
}

/** Record a win; unlocks `nextId` when given. Keeps the best (fastest) time per level. */
export function recordWin(levelId: string, nextId: string | null, entry: BestEntry): CampaignSave {
  const save = loadCampaign();
  const prev = save.best[levelId];
  if (!prev || entry.timeSec < prev.timeSec) save.best[levelId] = entry;
  if (nextId && !save.unlocked.includes(nextId)) save.unlocked.push(nextId);
  saveCampaign(save);
  return save;
}
