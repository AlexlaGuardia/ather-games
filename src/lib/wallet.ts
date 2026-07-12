"use client";

// The global Marks wallet — ather.games' ONE shared currency.
//
// Canon (ruled 2026-07-12, athernyx `world/rune-hold.md` › The Hub): Marks are the
// realm's copper coin. Every surface shares this single per-browser store — the Magii
// card game and Shimmer (through the `useWallet` hook, which now delegates here), the
// SiteNav readout, and any future earner/sink. Non-React accessors so game logic and
// React both reach the same coins; a MARKS_EVENT fires on change for live HUDs.
//
// Store: `ather:save:wallet` — the exact key + `{ marks, totalEarned, totalSpent }`
// shape that `useCloudSave('wallet')` already wrote, so existing card-game + Shimmer
// wallets stay valid. (This file replaces an earlier `ather.marks` store that split the
// currency in two; the shared key is the reconciliation.)

const KEY = "ather:save:wallet";
export const MARKS_EVENT = "ather:marks"; // CustomEvent<number> on window; detail = new balance

export interface WalletData {
  marks: number;
  totalEarned: number;
  totalSpent: number;
}
const EMPTY: WalletData = { marks: 0, totalEarned: 0, totalSpent: 0 };

const clamp = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

function read(): WalletData {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw);
    return {
      marks: clamp(Number(d?.marks)),
      totalEarned: clamp(Number(d?.totalEarned)),
      totalSpent: clamp(Number(d?.totalSpent)),
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(d: WalletData): WalletData {
  if (typeof window === "undefined") return d;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    window.dispatchEvent(new CustomEvent(MARKS_EVENT, { detail: d.marks }));
  } catch {
    /* quota / private mode — the wallet is a convenience layer, never block play */
  }
  return d;
}

/** Has the wallet ever been written? */
export function walletExists(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

/** Full snapshot — balance plus lifetime totals. */
export function getWallet(): WalletData {
  return read();
}

/** Current balance. 0 on the server / when unset. */
export function getMarks(): number {
  return read().marks;
}

/** Earn marks. Returns the new balance. Non-positive amounts are ignored. */
export function addMarks(n: number): number {
  if (!(n > 0)) return read().marks;
  const w = read();
  return write({ marks: w.marks + n, totalEarned: w.totalEarned + n, totalSpent: w.totalSpent }).marks;
}

/** Spend if affordable: debits + returns true, or leaves the balance + returns false. */
export function spendMarks(n: number): boolean {
  if (!(n > 0)) return true;
  const w = read();
  if (w.marks < n) return false;
  write({ marks: w.marks - n, totalEarned: w.totalEarned, totalSpent: w.totalSpent + n });
  return true;
}

/** Set the balance directly (rare — migrations / admin). Leaves lifetime totals. */
export function setMarks(n: number): number {
  const w = read();
  const v = clamp(n);
  if (v === w.marks && walletExists()) return v; // no-op — don't spam the event
  return write({ ...w, marks: v }).marks;
}
