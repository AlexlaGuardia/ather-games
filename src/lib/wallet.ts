"use client";

// The global Marks wallet — ather.games' one shared currency.
//
// Canon (ruled 2026-07-12, athernyx `world/rune-hold.md` › The Hub): Marks are the
// realm's copper coin. The hub is Rune Hold; you EARN marks at the Kindled Mug's
// cabinet (the games) and SPEND them down the Passage (the market). Every game reads
// and writes this ONE per-browser store — same no-account / localStorage ethos as
// recents, favorites, and the saves.
//
// Source of truth: this wallet. A game that holds marks reads/writes here directly;
// Nolmir (the only pre-existing holder) mirrors it through host.ts on load/save, so
// its ~15 in-place `host.marks` sites keep working unchanged. A `MARKS_EVENT` fires on
// every change so any mounted HUD can live-update without polling.

const KEY = "ather.marks";
export const MARKS_EVENT = "ather:marks"; // CustomEvent<number> on window; detail = new balance

const clamp = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const read = (): number => {
  if (typeof window === "undefined") return 0;
  try {
    return clamp(Number(localStorage.getItem(KEY)));
  } catch {
    return 0;
  }
};

const write = (n: number): number => {
  const v = clamp(n);
  if (typeof window === "undefined") return v;
  try {
    localStorage.setItem(KEY, String(v));
    window.dispatchEvent(new CustomEvent(MARKS_EVENT, { detail: v }));
  } catch {
    /* storage full / disabled — the wallet is a convenience layer, never block play */
  }
  return v;
};

/** Has the wallet ever been written? Lets a legacy holder migrate its coins in exactly once. */
export function walletExists(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

/** Current balance. 0 on the server or when unset. */
export function getMarks(): number {
  return read();
}

/** Overwrite the balance (the one-time legacy migration + the host mirror use this). */
export function setMarks(n: number): number {
  const v = clamp(n);
  if (v === read() && walletExists()) return v; // no-op — don't spam the event
  return write(v);
}

/** Earn marks. Returns the new balance. Non-positive amounts are ignored. */
export function addMarks(n: number): number {
  if (!(n > 0)) return read();
  return write(read() + n);
}

/** Spend marks if affordable: debits + returns true, or leaves the balance + returns false. */
export function spendMarks(n: number): boolean {
  if (!(n > 0)) return true;
  const cur = read();
  if (cur < n) return false;
  write(cur - n);
  return true;
}
