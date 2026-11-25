// ── DEWLS: what the Burrfolk take (BETA M159) ────────────────────────────────────────────────────────────────────────────
// Canon: CANON/game/shimmer-folds-settlements.md › THE BURRFOLK › ★ DEWLS (RULED 2026-11-25, Alex) + glossary Dewl: small gems in
// EVERY mining node beside its usual drop; spent at Burrfolk stalls and the camp, nowhere else. Numbers = Alex (dialog 11-25).
// ★ A BAG ITEM (Alex): it stacks, takes a slot and falls with the pack, like anything else. No wallet, no counter of its own.
// ★ NOT one of the four gem grades and cuts into no rune-gem: it has no ITEM_GROUP, so no room keeps it and no bench takes it.
// PURE (no imports from the game): inventory.ts holds the bag row, prospecting.ts the drop, ground-loot-view.tsx the first-one line.
export const DEWL = 'dewl'
/** always, beside the normal drop: by the crystal's tier (prospecting.ts TIER: raw 1 · elements 2 · pure 3 · Ather 4) */
export const DEWLS_BY_TIER = { 1: 1, 2: 2, 3: 3, 4: 5 } as const
/** the yield with its dewls on (once: a roll that already carries them is returned as it is; a node first touched before dewls
 *  came is topped up as it is finished) */
export function withDewls(drops: readonly { id: string; n: number }[], tier: 1 | 2 | 3 | 4): { id: string; n: number }[] {
  return drops.some(d => d.id === DEWL) ? [...drops] : [...drops, { id: DEWL, n: DEWLS_BY_TIER[tier] }]
}
export const dewls = (n: number) => `${n} ${n === 1 ? 'dewl' : 'dewls'}`
/** ★ SIGNED (athernyx 0c9415c): CANON/game/shimmer-lines-batch-2026-11-25b.md › D, MAIN. Once ever per keeper. */
export const DEWL_FIRST = 'A dewl. Burrfolk stalls take them.'
/** the mark rides in the bag's `gifts` (every bag op and a death keep it: inventory.ts, backpack.ts) */
export const GIFT_DEWL_FIRST = 'dewl_first'
export function markFirstDewl<I extends { gifts?: string[] }>(inv: I): I | null {
  return (inv.gifts ?? []).includes(GIFT_DEWL_FIRST) ? null : { ...inv, gifts: [...(inv.gifts ?? []), GIFT_DEWL_FIRST] }
}
