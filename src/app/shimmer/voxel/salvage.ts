// Retired items — what happens to a bag full of a world that no longer exists.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── ★ WHY A RULING NEEDS ONE OF THESE ─────────────────────────────────────────────────────────
// The building grammar (2026-08-13) stopped raw stone being placeable and changed what it drops.
// That is correct for the world and silently hostile to the SAVE: a player who quarried a stack of
// `block_stone` last week now holds an item that nothing places, nothing crafts and nothing names.
// It is not a bug the game can report — the stack just sits there being useless forever.
//
// ── ★ REMAP, DO NOT DELETE ────────────────────────────────────────────────────────────────────
// The obvious fix is to drop unknown items on load, and it is the wrong one: silently destroying
// what someone mined is a worse failure than leaving junk in a slot, and it is unrecoverable. Every
// retirement here therefore names a SUCCESSOR — `block_stone` was rock and rubble is rock, so the
// hour spent quarrying survives the ruling that changed what rock is called.
//
// ⚠ AND AN UNLISTED ITEM IS LEFT ALONE, deliberately. This table is a list of decisions someone
// made on purpose, not a whitelist of everything valid — treating it as a whitelist would mean any
// item this file has not heard of gets eaten, which is the same silent destruction wearing a
// different hat. A stray unknown id costs one dead slot; a wrong deletion costs a player's evening.
//
// ⚠ THIS IS NOT A RECIPE, and that distinction is load-bearing: `recipes.test.ts` asserts nothing
// can be crafted FROM raw stone, and a `block_stone -> rubble` recipe would contradict it and hand
// the player a farmable loop back into the old economy. A migration runs once over what already
// exists and can never be re-entered, because after it runs there is no `block_stone` left.

/**
 * Items that no longer exist, and what each became.
 *
 * Keep the reason on the line. A bare mapping ages into something nobody dares delete because
 * nobody remembers whether it is still load-bearing.
 */
export const RETIRED_ITEMS: Readonly<Record<string, string>> = {
  // 2026-08-13, the building grammar: raw stone stopped being placeable and now yields rubble.
  // Both stone tiers collapsed onto one broken-rock economy, so both legacy ids land on it.
  block_stone: 'rubble',
  block_deep_stone: 'rubble',
}

/** One slot of a bag: an item and how many, or nothing. Structural, so this file needs no import. */
export interface SlotLike { itemId: string; count: number }

export interface SalvageChange { from: string; to: string; count: number }

export interface SalvageResult<T extends SlotLike> {
  slots: (T | null)[]
  /** What was rewritten, merged per id — the line the player is shown. Empty means nothing to say. */
  changed: SalvageChange[]
}

/**
 * Rewrite retired items in place across a bag.
 *
 * ⚠ SLOTS ARE REWRITTEN, NOT MERGED. Two slots of `block_stone` become two slots of `rubble`
 * rather than one combined stack, and that is on purpose: merging means deciding what to do with
 * the overflow past a stack limit, which needs the stack ladder this pure file must not know
 * about. Walking the two stacks together costs the player one click and costs this function all of
 * its dependencies. The bag's own move/merge code already exists for that click.
 */
export function salvageItems<T extends SlotLike>(slots: (T | null)[]): SalvageResult<T> {
  const changed = new Map<string, SalvageChange>()
  const out = slots.map(s => {
    if (!s) return s
    const to = RETIRED_ITEMS[s.itemId]
    if (!to) return s
    const key = `${s.itemId}→${to}`
    const prev = changed.get(key)
    if (prev) prev.count += s.count
    else changed.set(key, { from: s.itemId, to, count: s.count })
    return { ...s, itemId: to }
  })
  return { slots: out, changed: [...changed.values()] }
}

/** One line for the player, or null when nothing moved. The host decides where to show it. */
export function salvageMessage(changed: SalvageChange[]): string | null {
  if (!changed.length) return null
  return changed.map(c => `${c.count} ${c.from} → ${c.to}`).join(', ')
}
