// Satchel oracle — the BAG's half of the move contract.
// Run: npx tsx src/app/shimmer/voxel3d/satchel.test.ts
//
// Moving stacks is the one inventory action that can silently DESTROY items, and none of its
// failure modes are visible in play — a stack you were carrying is just smaller than it was.
//
// ⚠ The rules moved into `chest.ts` (2026-08-11): a bag→bag move and a bag→chest move differ in
// nothing, so there is ONE implementation and the bag case is that function called with one array
// twice — `satchel.ts` was deleted rather than left as a wrapper nobody calls. This oracle stays
// because the bag's contract is worth asserting in the bag's own words: if a chest-side change ever
// breaks the satchel, this is the file that says so by name.

import type { Inventory } from '../engine/inventory'
import { createInventory } from '../engine/inventory'
import { moveBetween } from './chest'

const moveStack = (inv: Inventory, from: number, to: number, max: (id: string) => number) =>
  moveBetween(inv.slots, from, inv.slots, to, max)

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const MAX = (id: string) => (id === 'mana_seed' ? 4 : 99)
const inv = () => createInventory()
const put = (i: ReturnType<typeof inv>, at: number, itemId: string, count: number) => {
  i.slots[at] = { itemId, count }
  return i
}
const total = (i: ReturnType<typeof inv>, itemId: string) =>
  i.slots.reduce((n, s) => n + (s && s.itemId === itemId ? s.count : 0), 0)

// ── 1. a plain move into an empty slot ──────────────────────────────────────────────────────────
{
  const i = put(inv(), 0, 'block_stone', 12)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[0] === null, 'the source empties')
  ok(i.slots[9]?.count === 12, 'and the whole stack lands')
}

// ── 2. swapping two different items ─────────────────────────────────────────────────────────────
{
  const i = put(put(inv(), 0, 'block_stone', 5), 9, 'block_topsoil', 7)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[0]?.itemId === 'block_topsoil' && i.slots[0]?.count === 7, 'the target comes back')
  ok(i.slots[9]?.itemId === 'block_stone' && i.slots[9]?.count === 5, 'and the source goes over')
}

// ── 3. ★ MERGING RESPECTS THE CEILING, AND LOSES NOTHING ────────────────────────────────────────
{
  const i = put(put(inv(), 0, 'block_stone', 60), 9, 'block_stone', 60)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[9]?.count === 99, '★ the target fills to its ceiling, never past it')
  ok(i.slots[0]?.count === 21, '★ and the remainder stays put — 21 stone still exist')
  ok(total(i, 'block_stone') === 120, '★ nothing was destroyed by the merge')
}

// ── 4. a merge that fits entirely ───────────────────────────────────────────────────────────────
{
  const i = put(put(inv(), 0, 'block_stone', 10), 9, 'block_stone', 5)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[0] === null && i.slots[9]?.count === 15, 'a fitting merge empties the source')
}

// ── 5. the item's OWN ceiling, not a global one ─────────────────────────────────────────────────
{
  const i = put(put(inv(), 0, 'mana_seed', 3), 9, 'mana_seed', 3)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[9]?.count === 4, '★ a mana seed stacks to 4, not 99')
  ok(i.slots[0]?.count === 2, 'and its remainder survives')
  ok(total(i, 'mana_seed') === 6, 'nothing lost')
}

// ── 6. a FULL target must not silently reorder the bag ──────────────────────────────────────────
{
  const i = put(put(inv(), 0, 'block_stone', 5), 9, 'block_stone', 99)
  moveStack(i, 0, 9, MAX)
  ok(i.slots[9]?.count === 99 && i.slots[0]?.count === 5,
    '★ a full target leaves both stacks alone — combine is not swap')
}

// ── 7. the no-ops ───────────────────────────────────────────────────────────────────────────────
{
  const i = put(inv(), 0, 'block_stone', 5)
  moveStack(i, 0, 0, MAX)
  ok(i.slots[0]?.count === 5, 'moving a slot onto itself changes nothing')
  moveStack(i, 3, 9, MAX)
  ok(i.slots[9] === null, 'lifting an empty slot places nothing')
  moveStack(i, 0, 999, MAX)
  ok(i.slots[0]?.count === 5, 'an out-of-range target is refused, not thrown')
  moveStack(i, -1, 9, MAX)
  ok(i.slots[9] === null, 'and so is an out-of-range source')
}

console.log(`\nsatchel: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
