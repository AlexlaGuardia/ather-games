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

import { createChest, adoptChest, moveBetween, moveCount, halfOf, quickMove, addToGrid, takeFromGrid, attachedChests, spill, isEmpty, countIn, chestKey, CHEST_SLOTS, CHEST_BAGFULS, type Slots } from './chest'
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
  ok(c.length === CHEST_SLOTS && CHEST_SLOTS === 48, 'a chest is 48 slots')
  ok(CHEST_BAGFULS === 2, '★ which is TWO BAGFULS — the sentence the number exists to keep')
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
// ── 14. ★ THE SPLIT — the one move that must never swap ─────────────────────────────────────────
// Halving is where a conservation bug is least likely to be noticed: both slots still hold the
// thing, just in the wrong proportions, and nobody counts a bag.
{
  ok(halfOf(7) === 4 && halfOf(1) === 1 && halfOf(2) === 1 && halfOf(0) === 0,
    '★ half rounds UP — a stack of 1 splits to itself rather than being a dead click')
}
{
  const c = createChest()
  put(c, 0, 'block_stone', 7)
  ok(moveCount(c, 0, c, 5, halfOf(7), MAX) === 4, 'half of 7 is 4 moved')
  ok(c[0]?.count === 3 && c[5]?.count === 4, 'and 3 stay behind')
  ok(countIn(c, 'block_stone') === 7, 'totals conserved')
}
{
  const c = createChest()
  put(c, 0, 'block_stone', 1)
  ok(moveCount(c, 0, c, 5, halfOf(1), MAX) === 1, 'a lone item moves whole')
  ok(c[0] === null, '★ and the source slot becomes a real null, not a zero-count ghost')
}
{
  // ★ THE SWAP REFUSAL. A partial stack onto a different item has no honest outcome, so nothing
  // moves and the caller is told — this is what keeps the lift alive instead of the click vanishing.
  const c = createChest()
  put(c, 0, 'block_stone', 8); put(c, 1, 'block_dirt', 2)
  ok(moveCount(c, 0, c, 1, 4, MAX) === 0, '★ a split onto a DIFFERENT item moves nothing')
  ok(c[0]?.count === 8 && c[1]?.itemId === 'block_dirt' && c[1]?.count === 2,
    '★ and swaps nothing — both stacks are exactly as they were')
}
{
  // The item's own ceiling binds a split exactly as it binds a merge.
  const c = createChest()
  put(c, 0, 'mana_seed', 4); put(c, 1, 'mana_seed', 3)
  ok(moveCount(c, 0, c, 1, 2, MAX) === 1, '★ only what fits under the ceiling moves')
  ok(c[1]?.count === 4 && c[0]?.count === 3, 'the target stops at max')
  ok(countIn(c, 'mana_seed') === 7, 'totals conserved')
  ok(moveCount(c, 0, c, 1, 2, MAX) === 0, 'a full target takes nothing more')
}
{
  // ★ `want` IS CLAMPED. Both callers derive it from a count read a moment earlier, off a live array.
  const c = createChest()
  put(c, 0, 'block_stone', 3)
  ok(moveCount(c, 0, c, 4, 99, MAX) === 3, '★ asking for more than is there moves what is there')
  ok(countIn(c, 'block_stone') === 3, 'and invents nothing')
  put(c, 6, 'block_stone', 5)
  ok(moveCount(c, 6, c, 7, 0, MAX) === 0, 'asking for none moves none')
  ok(moveCount(c, 6, c, 7, -3, MAX) === 0, '★ and a negative want cannot run the move backwards')
  ok(c[6]?.count === 5 && c[7] === null, 'nothing touched either way')
}
{
  // Bag → chest, the same function across two grids.
  const inv = createInventory()
  const c = createChest()
  inv.slots[2] = { itemId: 'block_stone', count: 9 }
  ok(moveCount(inv.slots, 2, c, 0, halfOf(9), MAX) === 5, 'half crosses into the chest')
  ok(totalOf('block_stone', inv.slots, c) === 9, '★ conserved ACROSS the two grids')
  ok(moveCount(c, 0, c, 0, 3, MAX) === 0, 'a slot cannot split onto itself')
  ok(moveCount(c, 0, c, 99, 3, MAX) === 0, 'and an out-of-range target moves nothing')
  ok(totalOf('block_stone', inv.slots, c) === 9, 'still conserved after both refusals')
}
{
  // Dropping ONE at a time, the right-click-while-lifted path, until the source runs dry.
  const c = createChest()
  put(c, 0, 'block_stone', 3)
  let moved = 0
  for (let k = 0; k < 5; k++) moved += moveCount(c, 0, c, 1, 1, MAX)
  ok(moved === 3, '★ ones keep landing until the source is empty, then stop')
  ok(c[0] === null && c[1]?.count === 3, 'all three arrived, none doubled')
}

// ── the migration: a grid off disk becomes this build's size, and NEVER loses a stack ───────────
{
  // Every chest saved before 2026-08-15 is 24 long. The failure this guards is silent: a short grid
  // handed straight to the panel has `undefined` where its back rows should be.
  const old24: (unknown)[] = new Array(24).fill(null)
  old24[0] = { itemId: 'block_stone', count: 40 }
  old24[23] = { itemId: 'goldwood_log', count: 7 }
  const g = adoptChest(old24)
  ok(g.length === CHEST_SLOTS, '★ a 24-slot save loads as a 48-slot chest')
  ok(g.every(s => s === null || (typeof s.itemId === 'string' && s.count > 0)), 'with real nulls, no holes')
  ok(g[0]?.count === 40 && g[23]?.count === 7, '★ and every stack stays in the slot the player left it in')
  ok(countIn(g, 'block_stone') === 40 && countIn(g, 'goldwood_log') === 7, 'nothing invented, nothing lost')
}
{
  // ★ THE SHRINK CASE. It cannot happen today and it is the one worth writing code for: a config
  // change must never be able to delete a keeper's stack.
  const big: unknown[] = new Array(CHEST_SLOTS + 3).fill(null)
  big[CHEST_SLOTS] = { itemId: 'block_stone', count: 5 }
  big[CHEST_SLOTS + 2] = { itemId: 'goldwood_log', count: 2 }
  const g = adoptChest(big)
  ok(g.length === CHEST_SLOTS, 'an oversized save is cut to size')
  ok(countIn(g, 'block_stone') === 5 && countIn(g, 'goldwood_log') === 2,
     '★ but the overflow is COMPACTED forward, not truncated into the void')
}
{
  // Disk data is not trusted: a console can write this store, and a malformed slot would crash the
  // panel that renders it.
  const junk: unknown[] = [null, { itemId: 'block_stone', count: 0 }, { count: 4 }, 'nonsense', { itemId: 'x', count: 3 }]
  const g = adoptChest(junk)
  ok(g.length === CHEST_SLOTS, 'junk still yields a well-formed chest')
  ok(countIn(g, 'x') === 3, 'the one real stack survives')
  ok(g.filter(s => s !== null).length === 1, '★ and nothing malformed is kept as a slot')
  ok(adoptChest(undefined).length === CHEST_SLOTS && isEmpty(adoptChest(undefined)), 'a missing record is an empty chest')
}

// ── taking OUT: the mirror of addToGrid, and the half the station spends through ────────────────
{
  const g = createChest()
  put(g, 0, 'block_stone', 30); put(g, 5, 'block_stone', 12); put(g, 9, 'goldwood_log', 4)
  ok(takeFromGrid(g, 'block_stone', 35) === 0, 'a take that is covered reports nothing owed')
  ok(countIn(g, 'block_stone') === 7, '★ and takes it across as many stacks as it needs')
  ok(g[0] === null, 'an emptied slot becomes a real null, not a zero stack')
  ok(countIn(g, 'goldwood_log') === 4, 'and leaves everything else alone')
  ok(takeFromGrid(g, 'block_stone', 99) === 92, '★ a short take reports the SHORTFALL, which is what chains across grids')
  ok(countIn(g, 'block_stone') === 0, 'having emptied what there was — a partial take is a real outcome')
  ok(takeFromGrid(g, 'nothing_here', 4) === 4, 'taking what is absent owes all of it')
}
{
  // The station's own path: bag first, then the chests beside it. Conservation across three grids.
  const bag = createChest(), a = createChest(), b = createChest()
  put(bag, 0, 'goldwood_log', 5); put(a, 0, 'goldwood_log', 10); put(b, 3, 'goldwood_log', 10)
  let left = takeFromGrid(bag, 'goldwood_log', 22)
  for (const g of [a, b]) { if (left <= 0) break; left = takeFromGrid(g, 'goldwood_log', left) }
  ok(left === 0, '★ a job spends across the bag and both chests')
  ok(totalOf('goldwood_log', bag, a, b) === 3, 'and exactly the cost left the world')
  ok(countIn(bag, 'goldwood_log') === 0 && countIn(a, 'goldwood_log') === 0,
     '★ BAG FIRST — what is in your hand is what you meant to use')
  ok(countIn(b, 'goldwood_log') === 3, 'the far chest is the last touched')
}

// ── which chests a bench reaches ────────────────────────────────────────────────────────────────
{
  // A cross of chests around a bench at the origin, plus one above and one below.
  const chests = new Set(['1,0,0', '-1,0,0', '0,0,1', '0,0,-1', '0,1,0', '0,-1,0'])
  const isChest = (x: number, y: number, z: number) => chests.has(`${x},${y},${z}`)
  const got = attachedChests(0, 0, 0, isChest)
  ok(got.length === 4, '★ four horizontal neighbours, and NOT the ones above and below')
  ok(got.every(c => c.y === 0), 'every one of them at the bench\'s own height')
  ok(new Set(got.map(c => `${c.x},${c.y},${c.z}`)).size === 4, 'and no position reported twice')
  ok(attachedChests(0, 0, 0, () => false).length === 0, 'a bench with nothing beside it reaches nothing')
  ok(attachedChests(50, 7, -3, (x, y, z) => x === 51 && y === 7 && z === -3).length === 1,
     'the rule travels — it is relative, not anchored at the origin')
}

console.log(`\nchest: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
