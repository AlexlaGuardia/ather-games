"use client";

import { useCallback } from "react";
import { saveKey as shimmerSlot } from "@/lib/save-slot";

type Game = "magii" | "shimmer" | "wallet";

// ── ★ SHIMMER'S SLOT IS KEYED TO THE ACCOUNT (#682, 2026-08-23) ────────────────────────────────
// `shimmer` is the one game here that PUSHES to the cloud (`Shimmer3D` → `pushCloudSave`), and the
// push reads this slot and POSTs it under whatever session holds the cookie. With one shared slot
// that meant a second account uploaded the first account's world into its own row and destroyed
// whatever was there. Reproduced end to end, and found already done once in production.
//
// ⚠ `wallet` and `magii` are DELIBERATELY still unscoped, and the reason is the one that matters:
// nothing pushes them, so the failure they have is two accounts sharing a browser's coins — visible
// and reversible — not a garden overwritten in the cloud. Scoping them needs the same first-sign-in
// adoption shimmer gets in `play3d/page.tsx`, or every existing wallet reads as emptied on upgrade.
// That is a follow-up, not an oversight; do not "tidy" this into scoping all three without it.
const saveKey = (g: Game) => (g === "shimmer" ? shimmerSlot() : `ather:save:${g}`);
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
