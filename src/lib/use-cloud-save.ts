"use client";

import { useCallback } from "react";
import { saveKey as shimmerSlot, gameSlot, type SaveGame } from "@/lib/save-slot";

type Game = SaveGame;

// ── ★ SHIMMER'S SLOT IS KEYED TO THE ACCOUNT (#682, 2026-08-23) ────────────────────────────────
// `shimmer` is the one game here that PUSHES to the cloud (`Shimmer3D` → `pushCloudSave`), and the
// push reads this slot and POSTs it under whatever session holds the cookie. With one shared slot
// that meant a second account uploaded the first account's world into its own row and destroyed
// whatever was there. Reproduced end to end, and found already done once in production.
//
// ── ★ ALL THREE ARE SCOPED NOW (2026-08-23, Alex: "split it per account") ──────────────────────
// The note here used to say `wallet` and `magii` were deliberately left shared, on the grounds that
// nothing pushes them so the damage is contained to one browser. That reasoning was correct and it
// was never the whole question: two people on one machine sharing a coin balance is wrong however
// contained it is, and there was no record of who earned a coin.
//
// ⚠ THE FOLLOW-UP THAT NOTE DEMANDED CAME WITH IT, which is the only reason this is safe: without
// `adoptAnonSlots`, scoping the wallet shows every existing player a balance of ZERO on the day it
// ships, with their coins sitting one key over. Do not scope a fourth slot without its adoption.
//
// ⚠ Shimmer still goes through `saveKey()` rather than `gameSlot('shimmer')` — same answer, but
// that path carries the unresolved-owner warning, and shimmer is the one slot where reading the
// wrong one gets UPLOADED.
const saveKey = (g: Game) => (g === "shimmer" ? shimmerSlot() : gameSlot(g));
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
