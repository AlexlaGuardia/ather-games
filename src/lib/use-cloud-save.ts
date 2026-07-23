"use client";

import { useCallback } from "react";

type Game = "magii" | "shimmer" | "wallet";

const saveKey = (g: Game) => `ather:save:${g}`;
const bestKey = (g: Game, cat: string) => `ather:best:${g}:${cat}`;

// ather.games (public): localStorage-backed saves — no login required. Same hook
// surface as the akatskii cloud version (isSignedIn/load/save/submitScore), so games
// compile and run unchanged. Owner cloud-save (NextAuth + SQLite + /api/saves) is
// deferred — see /root/ather-games-extraction-plan.md FORK 1.
export function useCloudSave(game: Game) {
  // Every visitor is "signed in" to their own browser — keeps games' save/load paths live.
  const isSignedIn = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const load = useCallback(async (): Promise<any> => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(saveKey(game));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [game]);

  const save = useCallback(
    async (data: unknown): Promise<void> => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(saveKey(game), JSON.stringify(data));
      } catch {
        // quota / private-mode — fail silent
      }
    },
    [game],
  );

  // Write an ALREADY-serialized payload. Exists so a caller that stringifies for its own reasons
  // (dirty-checking against the last write) doesn't pay for a second JSON.stringify of the whole
  // save. `save` above is unchanged and still the right call for everyone else.
  // Returns whether the write actually landed. Callers that cache "what we last wrote" need to
  // know — marking a failed write as written would make the next identical save get skipped as a
  // no-op, so one quota error would silently stop saving forever.
  const saveRaw = useCallback(
    (json: string): boolean => {
      if (typeof window === "undefined") return false;
      try {
        localStorage.setItem(saveKey(game), json);
        return true;
      } catch {
        return false; // quota / private-mode
      }
    },
    [game],
  );

  // Synchronous read of the raw string. The async `load` is the general path; this one exists for
  // the beforeunload flush, where a promise would never settle before the page is gone.
  const loadSync = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(saveKey(game));
    } catch {
      return null;
    }
  }, [game]);

  const submitScore = useCallback(
    async (value: number, category = "score"): Promise<void> => {
      if (typeof window === "undefined") return;
      try {
        const prev = Number(localStorage.getItem(bestKey(game, category)) ?? "0");
        if (value > prev) localStorage.setItem(bestKey(game, category), String(value));
      } catch {
        // ignore
      }
    },
    [game],
  );

  return { isSignedIn, load, save, saveRaw, loadSync, submitScore, userName: undefined as string | undefined };
}
