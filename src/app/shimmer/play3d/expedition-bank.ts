// expedition-bank.ts — what an expedition sends home (2026-09-29).
//
// WRACK BANKS. Until today wrack lived only inside a Breach run: picked up, studied at the bench, gone when you left.
// Alex: elites in an expedition "drop the same samples needed to upgrade the tree in the breach", so wrack now keeps
// between runs, per keeper, and a SOLO Breach run carries up to `WRACK_CARRY` of it in. Every study is still loud (a
// harder flood), so a banked study is a head start paid for, never free power. ⚠ Co-op runs do not carry it yet: the
// server owns a party's wrack (`breach-link.ts` overwrites it from the snapshot), so banking there is server work.
//
// FINDS: a puzzle cache that held together is recorded here until the home plot can take it (the voxel world has no
// mailbox from play3d yet, and the unique chest block is not built). Recorded, never lost.
import { keeperKey } from '@/lib/keeper-local'

const BANK_KEY = 'ather:shimmer:wrackBank'
const FINDS_KEY = 'ather:shimmer:expeditionFinds'
/** the most banked wrack one Breach run takes in: enough for one study and change, never the whole tree */
export const WRACK_CARRY = 6

export function loadWrackBank(): number {
  try { return Math.max(0, Math.floor(Number(localStorage.getItem(keeperKey(BANK_KEY)) ?? 0)) || 0) } catch { return 0 }
}
function saveWrackBank(n: number): void {
  try { localStorage.setItem(keeperKey(BANK_KEY), String(Math.max(0, Math.floor(n)))) } catch { /* private mode */ }
}
export function bankWrack(n: number): number { const next = loadWrackBank() + Math.max(0, n); saveWrackBank(next); return next }
/** Take up to `WRACK_CARRY` out of the bank for a run; returns what was taken. */
export function takeWrackForRun(cap = WRACK_CARRY): number {
  const have = loadWrackBank(), take = Math.min(have, cap)
  if (take > 0) saveWrackBank(have - take)
  return take
}

export interface ExpFind { kind: 'held-cache'; at: number; seed: number }
export function loadFinds(): ExpFind[] {
  try { const v = JSON.parse(localStorage.getItem(keeperKey(FINDS_KEY)) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
export function recordFind(f: ExpFind): void {
  try { localStorage.setItem(keeperKey(FINDS_KEY), JSON.stringify([...loadFinds(), f])) } catch { /* private mode */ }
}
