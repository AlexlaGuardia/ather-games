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

  return { isSignedIn, load, save, submitScore, userName: undefined as string | undefined };
}
