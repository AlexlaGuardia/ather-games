// Recently-played games, browser-local. Powers the SiteNav quick-menu's game→game
// hop (the loudest wayfinding pain — moving sideways used to bounce you off the Room).
// Same single-player, no-account ethos as favorites + the saves.
"use client";

const KEY = "ather_recents";
const MAX_RECENTS = 8;

export function getRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/** Record a game as the most-recently-played. Dedups (moves to front), caps the list.
 *  SiteNav calls this on mount with its own gameId, so recents fill with no per-game wiring. */
export function pushRecent(id: string): string[] {
  if (typeof window === "undefined" || !id) return getRecents();
  const next = [id, ...getRecents().filter((x) => x !== id)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — recents are garnish, never block */
  }
  return next;
}
