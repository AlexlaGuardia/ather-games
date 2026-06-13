// Local-only favorites for the arcade hub. Up to 3 pinned games, stored in the
// browser. No account, no server — same single-player ethos as the saves.
"use client";

const KEY = "ather_favs";
export const MAX_FAVS = 3;

export function getFavs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, MAX_FAVS) : [];
  } catch {
    return [];
  }
}

function writeFavs(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_FAVS)));
}

/** Toggle a game's pinned state. When full, pinning a new one drops the oldest. */
export function toggleFav(id: string): string[] {
  const cur = getFavs();
  let next: string[];
  if (cur.includes(id)) {
    next = cur.filter((x) => x !== id);
  } else {
    next = [...cur, id];
    if (next.length > MAX_FAVS) next = next.slice(next.length - MAX_FAVS);
  }
  writeFavs(next);
  return next;
}
