// Chests — a container that stands in the world.
//
// ★ PURE. No react/three/DOM: the panel owns the clicks, the host owns the voxels and the saving,
// this owns what a container IS and what moving a stack MEANS. Same split as `satchel.ts`, and in
// fact `satchel.ts` now delegates here — see the note on `moveBetween` below.
//
// ── ★ ONE MOVE FUNCTION, NOT TWO ───────────────────────────────────────────────────────────────
// A bag→bag move and a bag→chest move differ in exactly nothing: both merge before they swap, both
// respect the item's own ceiling, both must conserve totals. Written twice they agree today and
// drift the first time one of them is fixed — and the failure mode is silent, because a stack that
// is quietly smaller than it was looks like a stack. So the grid-to-grid form is the only
// implementation and the same-grid case is that function called with one array twice.
//
// ★ `moveCount` (the split, 2026-08-11) is a SECOND function on purpose, not a duplicate: it is the
// one move that must NEVER swap, because a partial stack landing on a different item has no honest
// outcome. Folding it into `moveBetween` as a `want` parameter would mean one function whose swap
// branch is live for some argument values and forbidden for others — exactly the `X && useX()` shape
// that hid the dead chest click. Two functions, each total over its own inputs.
//
// ── ★ WHERE THE CONTENTS LIVE (host side, stated here because this file is where you'll look) ──
// In the COLUMN's save record, beside its block edits and pieces — not in a global sidecar like the
// pot clock. A chest is a thing you built at a place: its block and its contents have to arrive and
// leave together, or a refresh lands between the two loads and a break in that window destroys what
// was inside. That is the same argument `ColumnSave`'s own header makes for blocks and pieces
// sharing one record. It also means a hundred chests across the world cost nothing until you walk
// to them.

import type { ItemStack } from '../engine/inventory'

/** A container's contents. Fixed length, `null` = empty slot — a gap is a place, not a shorter list. */
export type Slots = (ItemStack | null)[]

/**
 * 8 wide because the satchel is 8 wide, and the two are drawn one above the other in the same
 * panel: a chest row that did not line up with a bag row would read as a different kind of thing.
 *
 * ★ SIX ROWS = 48 = TWO BAGFULS (2026-08-15). It was three rows, and three rows was chosen because
 * 24 is the bag's size and *"a chest holds a bagful"* is a sentence a player can feel. Growing it
 * had to keep that sentence rather than spend it: **36 would have bought half a row and killed the
 * only phrase the number had**, while 48 buys a whole doubling and the sentence survives intact —
 * a chest holds two bagfuls. Any future change to this number should have to answer the same
 * question: what does the new number SAY?
 */
export const CHEST_COLS = 8
export const CHEST_ROWS = 6
export const CHEST_SLOTS = CHEST_COLS * CHEST_ROWS

/** How many bagfuls a chest holds, for prose. Derived so the sentence cannot drift from the grid. */
export const CHEST_BAGFULS = CHEST_SLOTS / 24

export const createChest = (): Slots => new Array(CHEST_SLOTS).fill(null)

/**
 * Take a grid off disk and make it the size this build uses.
 *
 * ★ THE MIGRATION IS THE WHOLE REASON THIS EXISTS, AND IT NEVER TRUNCATES. Every chest saved before
 * 2026-08-15 is 24 long; a loader that trusted the stored length would hand the panel a grid whose
 * back half does not exist, and one that sliced to `CHEST_SLOTS` would silently delete items the
 * day the number ever goes DOWN. So: short grids gain empty slots at the end (a chest that grew
 * keeps every stack exactly where the player left it), and a grid that is somehow LONGER is
 * COMPACTED rather than cut — the overflow moves forward into whatever room the front has, and only
 * what genuinely cannot fit is dropped. Losing a stack to a config change is the one outcome worth
 * writing code to avoid.
 *
 * Anything that is not a plausible stack is discarded rather than trusted: this is data off a disk
 * a console can write to, and a malformed slot would crash the panel that renders it.
 */
export function adoptChest(saved: unknown): Slots {
  const g = createChest()
  if (!Array.isArray(saved)) return g
  const spare: ItemStack[] = []
  for (let i = 0; i < saved.length; i++) {
    const s = saved[i] as ItemStack | null
    if (!s || typeof s.itemId !== 'string' || !(s.count > 0)) continue
    const stack: ItemStack = { itemId: s.itemId, count: s.count }
    if (i < CHEST_SLOTS) g[i] = stack
    else spare.push(stack)
  }
  // Only reachable when the grid shrank under a save. Front-fill, in order, so the result is
  // deterministic and the player's own arrangement survives as far as it can.
  for (const s of spare) {
    const free = g.indexOf(null)
    if (free < 0) break
    g[free] = s
  }
  return g
}

/** World position → record key. Same format as `potKey`: one key shape for everything positional. */
export const chestKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

/**
 * Move or merge slot `fi` of `from` onto slot `ti` of `to`, in place. The two grids may be the same
 * array (that is what a satchel move is).
 *
 * ★ MERGE BEFORE SWAP, RESPECTING THE ITEM'S OWN CEILING: 60 stone onto 60 leaves 99 and 21, never
 * 120 (a stack no other path could build, which breaks everything that assumes `count <= max`) and
 * never 99 with 21 destroyed. A FULL target is left alone rather than swapped — the player asked to
 * combine, and silently reordering their bag is a different action than the one they took.
 *
 * `maxStack` is passed in so this uses the SAME ladder `give` does; a stack assembled by hand can
 * never differ from one assembled by walking over drops.
 */
export function moveBetween(
  from: Slots, fi: number, to: Slots, ti: number, maxStack: (itemId: string) => number,
): void {
  if (from === to && fi === ti) return
  if (fi < 0 || ti < 0 || fi >= from.length || ti >= to.length) return
  const a = from[fi]
  if (!a) return                       // lifting nothing is not a move
  const b = to[ti]
  if (b && b.itemId === a.itemId) {
    const room = Math.max(0, maxStack(a.itemId) - b.count)
    const move = Math.min(room, a.count)
    b.count += move
    a.count -= move
    if (a.count <= 0) from[fi] = null
    return
  }
  from[fi] = b
  to[ti] = a
}

/**
 * How many a right-click lifts. Ceiling, so a stack of 1 moves the one — the alternative is a
 * right-click that does nothing on the most ordinary stack in the bag, and a dead click is the least
 * visible thing this game can ship (the chest that would not open, same day).
 */
export const halfOf = (count: number): number => Math.ceil(count / 2)

/**
 * Move UP TO `want` of slot `fi` onto slot `ti`. Returns how many actually moved.
 *
 * ★ THIS IS THE SPLIT, AND IT IS A MOVE THAT NEVER SWAPS. `moveBetween` may swap because it carries
 * a whole stack: if the target holds something else, putting one where the other was is the only
 * sensible reading. A partial move has no such reading — half a stack onto a different item would
 * have to either destroy the target or invent a second carried stack, so it moves NOTHING and says
 * so with a 0. The caller keeps the lift alive on a 0, which is what makes the refusal visible: the
 * slot stays lit rather than the click evaporating.
 *
 * ★ `want` IS CLAMPED, NOT TRUSTED. Both callers derive it from a count they read a moment earlier,
 * and the grid is a live array a pickup can grow. Clamping to what is actually there is what keeps
 * "half of 7" from becoming "4 out of a stack that is now 3" — i.e. conservation is enforced here,
 * at the only place that can see both sides, not asked of every caller.
 *
 * The item's own ceiling still applies, same ladder as `give` — a split can no more build a stack of
 * 120 than a merge can.
 */
export function moveCount(
  from: Slots, fi: number, to: Slots, ti: number, want: number, maxStack: (itemId: string) => number,
): number {
  if (from === to && fi === ti) return 0
  if (fi < 0 || ti < 0 || fi >= from.length || ti >= to.length) return 0
  const a = from[fi]
  if (!a || a.count <= 0) return 0
  const max = maxStack(a.itemId)
  const b = to[ti]
  if (b && b.itemId !== a.itemId) return 0   // no swap — see above
  const room = b ? Math.max(0, max - b.count) : max
  const n = Math.min(Math.max(0, Math.floor(want)), a.count, room)
  if (n <= 0) return 0
  if (b) b.count += n
  else to[ti] = { itemId: a.itemId, count: n }
  a.count -= n
  if (a.count <= 0) from[fi] = null
  return n
}

/**
 * Send a whole stack across to the other grid — the shift-click move.
 *
 * ★ THIS IS WHAT MAKES A CHEST WORTH HAVING. Emptying a bag one click-lift at a time is twenty-four
 * pairs of clicks, and a container that is that much work to fill is one nobody fills. Merge into
 * existing stacks first, then spill into empty slots, exactly like `addItems` does for a pickup —
 * so putting things away by hand and having them land there by walking behave the same.
 *
 * A PARTIAL move is a real outcome and is kept: if only 30 of 99 fit, 30 go and 69 stay where they
 * were. All-or-nothing here would mean a nearly-full chest silently refuses everything.
 * Returns true if anything moved.
 */
export function quickMove(
  from: Slots, fi: number, to: Slots, maxStack: (itemId: string) => number,
): boolean {
  const a = from[fi]
  if (!a) return false
  // Same fill rule a pickup uses, and literally the same function — a stack put away by hand and
  // one that landed by walking over it must end up in the same slot.
  const left = addToGrid(to, a.itemId, a.count, maxStack)
  if (left === a.count) return false
  a.count = left
  if (a.count <= 0) from[fi] = null
  return true
}

/**
 * Put `count` of an item into a grid — merge into existing stacks, then take empty slots. Returns
 * what did NOT fit.
 *
 * ── ★ WHY THIS EXISTS RATHER THAN `engine/inventory.addItems` (2026-08-11) ─────────────────────
 * That function carries the 2D game's rules, and they are not this world's. Two of them bite:
 * `getMaxStack` reads the 2D ITEMS/FURNITURE tables and answers **1** for every block in this
 * world (the bug that filled the bag at 24 items and destroyed everything after), and
 * `isFurnitureItem` refuses to put furniture in the 2D hotbar band — a rule that exists because in
 * that game furniture is placed through a different screen entirely.
 *
 * ★ THE CHEST IS WHAT MADE THE SECOND ONE URGENT: `chest` is ALREADY an id in the 2D FURNITURE
 * table, so a crafted chest silently inherited "storage slots only". `roomFor` does not know that
 * rule, so it reported space the add then refused — and `tickDrops` had already consumed the drop.
 * A chest walked over with those slots full was DESTROYED, and the HUD said "bag full" as if the
 * bag were full. Ids collide across two games; rules must not.
 *
 * Same fill order as before (lowest free slot first), so pickups still land in the bar before the
 * satchel. `maxStack` is the caller's ladder, which is what keeps a stack built by walking over
 * drops identical to one built by hand.
 */
export function addToGrid(
  g: Slots, itemId: string, count: number, maxStack: (itemId: string) => number,
): number {
  const max = maxStack(itemId)
  let left = count
  for (let i = 0; i < g.length && left > 0; i++) {
    const s = g[i]
    if (!s || s.itemId !== itemId || s.count >= max) continue
    const n = Math.min(max - s.count, left)
    s.count += n; left -= n
  }
  for (let i = 0; i < g.length && left > 0; i++) {
    if (g[i] !== null) continue
    const n = Math.min(max, left)
    g[i] = { itemId, count: n }
    left -= n
  }
  return left
}

/**
 * Take `count` of an item out of a grid. Returns what could NOT be taken.
 *
 * ★ THE MIRROR OF `addToGrid`, AND IT RETURNS THE SHORTFALL FOR THE SAME REASON that one returns
 * the overflow: the caller is usually spending across SEVERAL grids (a bag and the chests standing
 * against a bench), and threading "how much is still owed" through the chain is the only way the
 * arithmetic stays in one place. A boolean would force every caller to count first and take second,
 * which is two passes that can disagree the moment anything else touches the grid between them.
 *
 * ⚠ PARTIAL TAKES ARE REAL AND ARE KEPT. It empties what it can and reports the rest; it does not
 * roll back. The caller checked affordability across every grid before it started — see the
 * station panel's `spend` — and a take that undid itself halfway would need a transaction log for
 * a case that cannot happen.
 */
export function takeFromGrid(g: Slots, itemId: string, count: number): number {
  let left = count
  for (let i = 0; i < g.length && left > 0; i++) {
    const s = g[i]
    if (!s || s.itemId !== itemId) continue
    const n = Math.min(s.count, left)
    s.count -= n; left -= n
    if (s.count <= 0) g[i] = null
  }
  return left
}

/**
 * ── ★ THE CHEST THAT STANDS AGAINST A BENCH (2026-08-15) ────────────────────────────────────────
 * Where a station looks for material besides the keeper's bag.
 *
 * **The four horizontal neighbours, and deliberately not six.** A chest ABOVE a bench is a chest on
 * a shelf and a chest BELOW it is a chest in the floor; neither is a thing a player builds on
 * purpose, and both would attach silently — you would find a bench eating out of storage you never
 * meant to connect, which is the worst version of an invisible rule. Beside it is the arrangement
 * anyone would build anyway, and it is legible from across the garden: **the workshop is the bench
 * and the chests you set around it.**
 *
 * ⚠ POSITIONS, NOT CONTENTS. This file cannot see the world; `isChest` is the host's own voxel read,
 * so there is exactly one definition of "is there a chest here" and this cannot drift from it.
 */
export const ATTACH_SIDES: readonly (readonly [number, number])[] =
  [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

export function attachedChests(
  x: number, y: number, z: number, isChest: (x: number, y: number, z: number) => boolean,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (const [dx, dz] of ATTACH_SIDES) {
    if (isChest(x + dx, y, z + dz)) out.push({ x: x + dx, y, z: z + dz })
  }
  return out
}

export const isEmpty = (g: Slots): boolean => g.every(s => !s || s.count <= 0)

/**
 * What a broken chest puts on the ground.
 *
 * ★ IT SPILLS, IT DOES NOT SWALLOW. The alternative — refusing to break a chest that holds
 * anything — never loses an item, but it also makes the block a trap you cannot undo without
 * emptying it by hand first. Spilling is the expected verb, and it is VISIBLE: the pile is right
 * there, and `tickDrops`' capacity gate already leaves what will not fit lying on the ground
 * instead of eating it. One list, so the caller cannot spill half and forget the rest.
 */
export const spill = (g: Slots): { itemId: string; count: number }[] =>
  g.filter((s): s is ItemStack => !!s && s.count > 0).map(s => ({ itemId: s.itemId, count: s.count }))

/** Total of one item across a grid. For oracles and HUD counts — never a source of truth. */
export const countIn = (g: Slots, itemId: string): number =>
  g.reduce((n, s) => n + (s && s.itemId === itemId ? s.count : 0), 0)
