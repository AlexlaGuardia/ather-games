// Chest oracle. Run: npx tsx src/app/shimmer/voxel3d/chest.test.ts
//
// A container is the second place in this game where items can be silently DESTROYED, and it is
// worse than the bag: what is in a chest is out of sight, so a loss is not noticed at the moment it
// happens but hours later, as a stack that "should have been in there". Everything below is
// therefore a CONSERVATION assert first and a behaviour assert second.
//
// The other half is the one the type system cannot see: a chest's contents are keyed by world
// position, so a record that outlives its block hands the next chest built on that spot somebody
// else's items. Those asserts are at the end, against the same key format the host uses.

import { createChest, moveBetween, quickMove, addToGrid, spill, isEmpty, countIn, chestKey, CHEST_SLOTS, type Slots } from './chest'
import { createInventory, isFurnitureItem } from '../engine/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const MAX = (id: string) => (id === 'mana_seed' ? 4 : 99)
const put = (g: Slots, at: number, itemId: string, count: number) => { g[at] = { itemId, count }; return g }
const totalOf = (id: string, ...gs: Slots[]) => gs.reduce((n, g) => n + countIn(g, id), 0)

// ── 1. the shape ────────────────────────────────────────────────────────────────────────────────
{
  const c = createChest()
  ok(c.length === CHEST_SLOTS && CHEST_SLOTS === 24, 'a chest is 24 slots — a bagful')
  ok(c.every(s => s === null), 'and starts empty, with real nulls rather than a short array')
  ok(isEmpty(c), 'isEmpty agrees')
}

// ── 2. bag → chest, the plain move ──────────────────────────────────────────────────────────────
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 40)
  moveBetween(inv.slots, 0, c, 5, MAX)
  ok(inv.slots[0] === null && c[5]?.count === 40, 'the stack crosses and the source empties')
  ok(totalOf('block_stone', inv.slots, c) === 40, 'nothing was created or destroyed crossing over')
}

// ── 3. ★ THE CEILING HOLDS ACROSS GRIDS, NOT JUST WITHIN ONE ────────────────────────────────────
// The bug this exists to catch is a bag→chest merge written separately from the bag→bag one, with
// the ceiling forgotten on the copy: 120 in a slot breaks every reader that assumes count <= max.
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 60); put(c, 0, 'block_stone', 60)
  moveBetween(inv.slots, 0, c, 0, MAX)
  ok(c[0]?.count === 99, '★ the chest slot fills to the ceiling, never past it')
  ok(inv.slots[0]?.count === 21, '★ and the remainder stays in the bag')
  ok(totalOf('block_stone', inv.slots, c) === 120, '★ 120 stone still exist')
}

// ── 4. the item's OWN ceiling crosses too ───────────────────────────────────────────────────────
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'mana_seed', 3); put(c, 0, 'mana_seed', 3)
  moveBetween(inv.slots, 0, c, 0, MAX)
  ok(c[0]?.count === 4, '★ a mana seed stacks to 4 inside a chest as well')
  ok(totalOf('mana_seed', inv.slots, c) === 6, 'and the sixth is not eaten')
}

// ── 5. swap across grids ────────────────────────────────────────────────────────────────────────
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 5); put(c, 3, 'block_topsoil', 7)
  moveBetween(inv.slots, 0, c, 3, MAX)
  ok(inv.slots[0]?.itemId === 'block_topsoil' && inv.slots[0]?.count === 7, 'the chest stack comes back')
  ok(c[3]?.itemId === 'block_stone' && c[3]?.count === 5, 'and the bag stack goes over')
}

// ── 6. a FULL chest slot leaves both alone ──────────────────────────────────────────────────────
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 5); put(c, 0, 'block_stone', 99)
  moveBetween(inv.slots, 0, c, 0, MAX)
  ok(c[0]?.count === 99 && inv.slots[0]?.count === 5,
    '★ combine is not swap — a full target does not silently reorder your bag')
}

// ── 7. ★ ONE ARRAY PASSED TWICE IS A BAG MOVE ───────────────────────────────────────────────────
// This is why there is no second implementation for the satchel: the same-grid case has to behave
// identically, aliasing and all. (satchel.test.ts asserts the bag's contract through exactly this
// call, in the bag's own words.)
{
  const a = createInventory()
  put(a.slots, 0, 'block_stone', 60); put(a.slots, 9, 'block_stone', 60)
  moveBetween(a.slots, 0, a.slots, 9, MAX)
  ok(a.slots[9]?.count === 99 && a.slots[0]?.count === 21,
    '★ a move onto the same array merges to the ceiling and keeps the remainder')
  ok(countIn(a.slots, 'block_stone') === 120, 'and aliasing neither doubled nor ate anything')
}

// ── 8. quickMove — merge first, then empties ────────────────────────────────────────────────────
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 50)
  put(c, 2, 'block_stone', 90); put(c, 7, 'block_stone', 10)
  ok(quickMove(inv.slots, 0, c, MAX), 'it reports that something moved')
  ok(c[2]?.count === 99 && c[7]?.count === 51, '★ existing stacks fill before an empty slot is taken')
  ok(inv.slots[0] === null, 'and the source is emptied when it all fits')
  ok(totalOf('block_stone', inv.slots, c) === 150, 'totals conserved')
}
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 30)
  ok(quickMove(inv.slots, 0, c, MAX), 'into an empty chest it takes the first free slot')
  ok(c[0]?.count === 30 && inv.slots[0] === null, 'landing whole')
}

// ── 9. ★ A PARTIAL QUICK-MOVE IS KEPT, NOT REFUSED ──────────────────────────────────────────────
// All-or-nothing here would make a nearly-full chest silently refuse everything you shift-click.
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 99)
  for (let i = 0; i < CHEST_SLOTS; i++) put(c, i, 'block_topsoil', 99)
  c[0] = { itemId: 'block_stone', count: 70 }          // one slot with 29 of room
  ok(quickMove(inv.slots, 0, c, MAX), 'a partial move still counts as a move')
  ok(c[0]?.count === 99, '★ it fills what room there was')
  ok(inv.slots[0]?.count === 70, '★ and the other 70 stay in the bag rather than vanishing')
  ok(totalOf('block_stone', inv.slots, c) === 169, 'totals conserved on the partial path')
}
{
  const inv = createInventory(); const c = createChest()
  put(inv.slots, 0, 'block_stone', 10)
  for (let i = 0; i < CHEST_SLOTS; i++) put(c, i, 'block_topsoil', 99)
  ok(quickMove(inv.slots, 0, c, MAX) === false, 'a full chest of other items accepts nothing')
  ok(inv.slots[0]?.count === 10, 'and the stack is untouched, not consumed')
  ok(quickMove(inv.slots, 4, c, MAX) === false, 'shift-clicking an empty slot is not a move')
}

// ── 10. ★ BREAKING SPILLS EVERYTHING, EXACTLY ONCE ──────────────────────────────────────────────
{
  const c = createChest()
  put(c, 0, 'block_stone', 99); put(c, 4, 'mana_seed', 2); put(c, 23, 'block_topsoil', 7)
  const out = spill(c)
  ok(out.length === 3, 'one entry per occupied slot, empties skipped')
  ok(out.reduce((n, d) => n + d.count, 0) === 108, '★ every item comes out, none twice')
  ok(spill(createChest()).length === 0, 'an empty chest spills nothing')
}

// ── 11. ★ THE RECORD MUST NOT OUTLIVE THE BLOCK ─────────────────────────────────────────────────
// The nastiest failure a positional container has: break a full chest, build a new one on the same
// cell, and it opens holding the old contents — free items, and a save that grows keys forever.
// The host deletes on the block leaving; this pins the key format that makes that possible.
{
  ok(chestKey(12, 70, -5) === '12,70,-5', 'the key is plain world coordinates')
  ok(chestKey(1, 2, 3) !== chestKey(1, 3, 2), 'and it is not order-blind')
  const store: Record<string, Slots> = {}
  store[chestKey(4, 66, 8)] = put(createChest(), 0, 'block_stone', 9)
  // what the host does on break: spill, then delete
  const spilled = spill(store[chestKey(4, 66, 8)])
  delete store[chestKey(4, 66, 8)]
  ok(spilled.length === 1 && store[chestKey(4, 66, 8)] === undefined, 'break spills and forgets')
  const rebuilt = store[chestKey(4, 66, 8)] ?? createChest()
  ok(isEmpty(rebuilt), '★ a chest built on the same cell opens EMPTY')
}

// ── 12. ★ THE 2D GAME'S RULES DO NOT REACH THIS BAG ─────────────────────────────────────────────
// `chest` is ALSO an id in the 2D FURNITURE table, and `engine/inventory.addItems` refuses to put
// furniture past slot 15. `roomFor` never knew that rule, so it reported space the add then
// refused — and `tickDrops` had already consumed the drop. A chest walked over with the low slots
// full was DESTROYED while the HUD said "bag full". Asserted by name so it cannot come back.
{
  ok(isFurnitureItem('chest'), 'the 2D game really does claim this id — this is not a hypothetical')
  const inv = createInventory()
  for (let i = 0; i < 15; i++) inv.slots[i] = { itemId: 'block_topsoil', count: 99 }
  const left = addToGrid(inv.slots, 'chest', 1, MAX)
  ok(left === 0, '★ a chest still fits while ANY slot is free, whatever the 2D table calls it')
  ok(inv.slots[15]?.itemId === 'chest', 'and it lands in the first free slot, not nowhere')
}
{
  const inv = createInventory()
  for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = { itemId: 'block_topsoil', count: 99 }
  ok(addToGrid(inv.slots, 'chest', 1, MAX) === 1, 'a genuinely full bag still reports the leftover')
}
// ── 13. the fill order pickups depend on ────────────────────────────────────────────────────────
{
  const inv = createInventory()
  inv.slots[3] = { itemId: 'block_stone', count: 90 }
  ok(addToGrid(inv.slots, 'block_stone', 20, MAX) === 0, 'a 20-stack fits across two slots')
  ok(inv.slots[3]?.count === 99, '★ the existing stack fills first')
  ok(inv.slots[0]?.count === 11, '★ then the LOWEST free slot — pickups reach the bar before the satchel')
  ok(countIn(inv.slots, 'block_stone') === 110, 'totals conserved')
}

console.log(`\nchest: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
