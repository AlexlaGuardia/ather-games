// Moving stacks between slots.
//
// ★ PURE. The panel owns the clicks; this owns what a move MEANS. Split out because this is the one
// place in the inventory where items can be silently destroyed — a merge that ignores the stack
// ceiling, or a swap that drops one side — and none of that is visible in play until a stack you
// were carrying is simply smaller than it was.

import type { Inventory } from '../engine/inventory'

/**
 * Move or merge slot `from` onto slot `to`, in place.
 *
 * ★ MERGE BEFORE SWAP, and respect the item's own ceiling: dropping 60 stone onto 60 more must
 * leave 99 and 21, never 120 (a stack no other code path could have built, which then breaks every
 * assumption that reads `count <= max`) and never 99 with 21 destroyed. `maxStack` is passed in so
 * this uses the SAME ladder `give` does — a stack assembled by hand cannot differ from one
 * assembled by walking over drops.
 */
export function moveStack(
  inv: Inventory, from: number, to: number, maxStack: (itemId: string) => number,
): void {
  if (from === to) return
  const g = inv.slots
  if (from < 0 || to < 0 || from >= g.length || to >= g.length) return
  const a = g[from]
  if (!a) return                       // lifting nothing is not a move
  const b = g[to]
  if (b && b.itemId === a.itemId) {
    const room = Math.max(0, maxStack(a.itemId) - b.count)
    const move = Math.min(room, a.count)
    b.count += move
    a.count -= move
    // A full target leaves both stacks untouched rather than swapping them — the player asked to
    // combine, and silently reordering their bag instead is a different action than the one taken.
    if (a.count <= 0) g[from] = null
    return
  }
  g[from] = b
  g[to] = a
}
