"use client";

// Save-backed games surface a "Resume" affordance in the SiteNav recents strip.
// When a browser-local save exists, the recents chip reads as "continue where you
// left off" instead of a cold launch — every one of these games auto-loads its save
// on mount (no login, per-browser localStorage, same ethos as recents + favorites),
// so the tap genuinely resumes.
//
// Registry-driven: a game earns the affordance by registering a probe here, nothing
// more. play3d shares Shimmer's slot and Shimmer is a room-wall (never in the recents
// pool today), so it isn't wired — drop a probe under its id if that ever changes.

type SaveProbe = {
  /** a MEANINGFUL, resumable save exists — not merely "played once" (e.g. a lone high score). */
  has: () => boolean;
  /** short progress hint for the chip, e.g. "Node 4" · "Quest 5". null when there's nothing to show. */
  hint: () => string | null;
};

const raw = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const num = (k: string): number => Number(raw(k) ?? 0) || 0;

/** Read one numeric field out of a JSON-blob save without letting a parse error escape. */
const jsonNum = (k: string, field: string, fallback = 0): number => {
  const v = raw(k);
  if (!v) return fallback;
  try {
    const n = Number(JSON.parse(v)?.[field]);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

const PROBES: Record<string, SaveProbe> = {
  nolmir: {
    has: () => raw("nolmir.forge.v2") != null,
    hint: () => (raw("nolmir.forge.v2") != null ? `Node ${jsonNum("nolmir.forge.v2", "node", 1)}` : null),
  },
  manana: {
    // manana.best is just a high score (set on first play); quest.level is real progress.
    has: () => num("manana.quest.level") > 0,
    hint: () => {
      const lv = num("manana.quest.level");
      return lv > 0 ? `Quest ${lv + 1}` : null;
    },
  },
};

/** Is this game one that carries a resumable save at all? (Independent of whether one exists yet.) */
export const isSaveBacked = (id: string): boolean => id in PROBES;

/** True when a resumable save exists in THIS browser right now. SSR-safe (false on the server). */
export function hasSave(id: string): boolean {
  if (typeof window === "undefined") return false;
  return PROBES[id]?.has() ?? false;
}

/** Short progress hint for the chip, or null. SSR-safe. */
export function saveHint(id: string): string | null {
  if (typeof window === "undefined") return null;
  return PROBES[id]?.hint() ?? null;
}
