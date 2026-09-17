// The plot bank — every chest on the keeper's land is one door into one store.
//
// ── ★ WHY ONE POOL AND NOT TEN BOXES (Alex, 2026-09-16) ─────────────────────────────────────────
// *"a unified storage so everything goes into one bank with tabs to organize things by category and
// the cap could be like by slots and each chest placed adds to that cap with a limit of about 10
// chest you can place in the home plot."* The 2D game reached the same conclusion on 07-23
// (`engine/bank.ts`): chests as independent grids made crafting a memory game — which box holds
// the planks — and the shuffling, not the capacity, was what hurt. This is that idea for the voxel
// world, in the voxel world's own units.
//
// ★ THE CAP IS IN SLOTS, AND A SLOT IS A STACK. The 2D bank counted ITEMS (3,240 / 7,500), which
// reads well but makes a stack of 99 rubble cost 99 and a single chest cost 1 — so storage filled
// with the cheapest thing you own. A slot cap is the chest's own arithmetic: a placed chest adds
// exactly what it would have held on its own (`CHEST_SLOTS`, 48, *two bagfuls*), so a keeper who
// counts chests still counts right, and the pool is the same grid the panel already knows how to
// drag across. Ten chests = 480 stacks. The fold's ladder (10 → 13 → 16, `plot.ts › chestCap`) is
// the limit Alex named, and it was already there.
//
// ★ THE POOL *IS* A `Slots` GRID. Not a new container type: the bag panel, `moveBetween`,
// `moveCount`, `quickMove`, `addToGrid` and `takeFromGrid` all speak `Slots`, and every one of
// them carries a conservation argument this file would otherwise have to restate. The bank differs
// from a chest in exactly two ways — its LENGTH is the capacity (which moves when a chest is placed
// or broken), and the panel shows it through category TABS instead of as a fixed grid. Both live
// here; the moves do not.
//
// ★ SCOPE = THE PLOT. `Space === 'plot'` and nothing else: a chest in the Wilds or on Moonwell's
// island keeps its own grid (a cache is a cache), and the Crucible has no chests at all. The pool
// lives in the keeper's record (`PlayerSave.bank`), not in a column — same argument the waymark
// network makes: it must be readable from ANY chest on the plot, and a column record is invisible
// until you walk to it.
//
// ★ OVER-CAP IS TOLERATED, NEVER CORRECTED. Break a chest and the cap drops by 48; whatever is in
// the pool stays. The honest response to "more than fits" is to refuse further deposits until it
// drains — never to delete a keeper's materials to satisfy a number that just changed. `fitBank`
// is the only place the length moves and it can only ever LOSE EMPTY slots.
//
// ⚠ PURE. No react/three/DOM/IndexedDB — the host owns the census and the saving, the panel owns
// the clicks.

import type { ItemStack } from '../engine/inventory'
import { TOOL_DEFS } from '../engine/tools'
import { POTION_DEFS } from '../engine/alchemy'
import { pieceForItem } from '../voxel/pieces'
import { materialForItem } from '../voxel/registry'
import { CROP_DEFS } from '../voxel/crops'
import { ALCHEMY_INTERMEDIATES, COOKED } from './alchemy-chain'
import { FROM_FARMING, FROM_RINNING } from './obtainable'
import { FOOD } from './consume'
import { CHEST_SLOTS, addToGrid, type Slots } from './chest'

/** What one placed chest adds. The chest's own size, so "ten chests" means what it always meant. */
export const SLOTS_PER_CHEST = CHEST_SLOTS

/** Slots the pool may hold for this many placed chests. Zero chests, zero bank — the door IS the chest. */
export const bankCapacity = (placedChests: number): number => Math.max(0, placedChests) * SLOTS_PER_CHEST

/** Stacks in the pool. Nulls are free slots and do not count. */
export const bankUsed = (bank: Slots): number => bank.reduce((n, s) => n + (s && s.count > 0 ? 1 : 0), 0)

/** Free slots at this capacity. Negative when over-cap — the caller reads that as "refuse deposits". */
export const bankFree = (bank: Slots, capacity: number): number => capacity - bankUsed(bank)

/**
 * Make the pool's length match its capacity — IN PLACE, because the panel and the host share the
 * one array and a fresh array would strand whichever side still held the old one.
 *
 * Grow: append empties. Shrink: compact (stacks keep their order, gaps close) and cut only the
 * empty tail; a pool holding more stacks than the new cap keeps every one of them and simply has no
 * free slot until it drains. ★ THIS FUNCTION CAN ONLY EVER REMOVE `null`s. That is the whole
 * over-cap contract, and it is enforced by shape rather than by a check.
 */
export function fitBank(bank: Slots, capacity: number): Slots {
  const cap = Math.max(0, Math.floor(capacity))
  if (bank.length < cap) {
    while (bank.length < cap) bank.push(null)
    return bank
  }
  if (bank.length === cap) return bank
  const kept = bank.filter((s): s is ItemStack => !!s && s.count > 0)
  bank.length = 0
  for (const s of kept) bank.push(s)
  while (bank.length < cap) bank.push(null)
  return bank
}

/**
 * Pour a chest's grid into the pool — the one-way migration from per-block chests.
 *
 * ★ FORCED, OVER-CAP TOLERATED, NEVER LOSSY. Merges into existing stacks first (the pickup rule),
 * then takes free slots, then — when there is no room — APPENDS beyond the cap. A keeper who built
 * ten full chests before this shipped has 480 stacks of things they earned; a migration that
 * dropped the 481st to fit a number invented after they earned it is a bug report that reads "my
 * chest was empty". Returns how many ITEMS moved so the host can say so out loud; a silent move of
 * someone's storage is the other way to get that bug report. The source grid is emptied.
 */
export function pourInto(bank: Slots, from: Slots, maxStack: (itemId: string) => number): number {
  let moved = 0
  for (let i = 0; i < from.length; i++) {
    const s = from[i]
    if (!s || !(s.count > 0)) { from[i] = null; continue }
    let left = addToGrid(bank, s.itemId, s.count, maxStack)
    // Past the cap: whole stacks at the item's own ceiling, never one oversized stack — a stack no
    // other path could build breaks everything downstream that assumes `count <= max`.
    const max = Math.max(1, maxStack(s.itemId))
    while (left > 0) { const n = Math.min(max, left); bank.push({ ...s, count: n }); left -= n }
    moved += s.count
    from[i] = null
  }
  return moved
}

// ── The tabs ────────────────────────────────────────────────────────────────────────────────────
//
// ★ A TAB IS A VIEW, NOT A POCKET. The pool is one grid; a tab filters which of its stacks are drawn.
// Separate per-category pools would mean per-category caps, and a keeper with 400 blocks and no
// brews would have a full bank and an empty one at once. One cap, six lenses.
//
// The category is DERIVED from the tables that already say what an item is — a tool is in
// `TOOL_DEFS`, a piece answers `pieceForItem`, a brew is in `POTION_DEFS` — never from a hand-kept
// list of ids. `item-universe.ts` counts seven times a hand-kept list of items went stale in this
// tree; an eighth would sort every new item into "materials" silently, which is a tab that lies.
// Order matters: a log is a block AND a felling drop, a spore is a crop yield AND a block drop, and
// the first rule to claim an item wins. Blocks are asked LAST among the concrete kinds so that a
// seed (`seed_dawncap` drops from the Dawncap block) reads as garden, not as a block.

export type BankTab = 'all' | 'blocks' | 'pieces' | 'materials' | 'garden' | 'brews' | 'tools'
export type BankCategory = Exclude<BankTab, 'all'>

export const BANK_TABS: readonly { id: BankTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'pieces', label: 'Pieces' },
  { id: 'materials', label: 'Materials' },
  { id: 'garden', label: 'Garden' },
  { id: 'brews', label: 'Brews' },
  { id: 'tools', label: 'Tools' },
]

/** Display order inside the All tab — the same order as the rail, so the two agree. */
const CATEGORY_RANK: Readonly<Record<BankCategory, number>> = {
  blocks: 0, pieces: 1, materials: 2, garden: 3, brews: 4, tools: 5,
}

const GARDEN = new Set<string>([
  ...Object.values(CROP_DEFS).map(c => c.seedItemId),
  ...FROM_FARMING,
  ...FROM_RINNING,
  ...COOKED,
  ...Object.keys(FOOD),
])
const BREWS = new Set<string>([...Object.keys(POTION_DEFS), ...ALCHEMY_INTERMEDIATES])
const TOOLS = new Set<string>(Object.keys(TOOL_DEFS))

export function bankCategory(itemId: string): BankCategory {
  if (TOOLS.has(itemId) || itemId.startsWith('vessel_')) return 'tools'
  if (pieceForItem(itemId)) return 'pieces'
  if (BREWS.has(itemId) || itemId.startsWith('stage_')) return 'brews'
  if (GARDEN.has(itemId)) return 'garden'
  if (materialForItem(itemId) !== undefined) return 'blocks'
  return 'materials'
}

/**
 * Which pool indices a tab draws, in display order.
 *
 * ★ INDICES, NOT STACKS. The panel's whole drag machine addresses a slot by `{ g, i }` and the host
 * resolves `i` against the live array; handing the panel a sorted COPY of the stacks would break
 * that contract — a drop onto "the third stack in the Blocks tab" must land on the pool index that
 * stack actually occupies. So the view is a permutation of indices and the array is untouched.
 *
 * Sorted by category rank, then label, then index — so the All tab reads as the rail does, and the
 * same item always stands in the same place across opens. Stability by index last keeps two
 * partial stacks of one item in a fixed order rather than swapping under the pointer.
 */
export function bankView(bank: Slots, tab: BankTab, label: (itemId: string) => string): number[] {
  const out: number[] = []
  for (let i = 0; i < bank.length; i++) {
    const s = bank[i]
    if (!s || s.count <= 0) continue
    if (tab !== 'all' && bankCategory(s.itemId) !== tab) continue
    out.push(i)
  }
  const key = (i: number) => {
    const s = bank[i]!
    return [CATEGORY_RANK[bankCategory(s.itemId)], label(s.itemId).toLowerCase()] as const
  }
  return out.sort((a, b) => {
    const ka = key(a), kb = key(b)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1
    return a - b
  })
}

/**
 * The empty slots a tab offers as drop targets — the FIRST few free indices, so a drop lands where
 * `addToGrid` would have put it. A tab shows at most one row of them: the free count is a number on
 * the header, not four hundred grey squares to scroll past.
 */
export function bankFreeSlots(bank: Slots, limit: number): number[] {
  const out: number[] = []
  for (let i = 0; i < bank.length && out.length < limit; i++) if (!bank[i]) out.push(i)
  return out
}

/** Count of one item across the pool. */
export const bankCount = (bank: Slots, itemId: string): number =>
  bank.reduce((n, s) => n + (s && s.itemId === itemId ? s.count : 0), 0)

// ── Save shape ──────────────────────────────────────────────────────────────────────────────────
// Compact on disk: only the stacks, in order. The length is not stored — capacity is a fact about
// the chests standing on the plot, and storing it here would be the hand-kept copy that disagrees
// the day a chest breaks while the tab is shut.

export type BankSave = ItemStack[]

export const bankToSave = (bank: Slots): BankSave =>
  bank.filter((s): s is ItemStack => !!s && s.count > 0).map(s => ({ ...s }))

/**
 * Off disk. Anything that is not a plausible stack is dropped rather than trusted — this is data
 * a console can write to, and one malformed slot would crash the panel drawing it. The result has
 * NO free slots; `fitBank` adds them once the host knows the chest census.
 */
export function bankFromSave(saved: unknown): Slots {
  const out: Slots = []
  if (!Array.isArray(saved)) return out
  for (const s of saved as unknown[]) {
    const st = s as Partial<ItemStack> | null
    if (!st || typeof st.itemId !== 'string' || typeof st.count !== 'number' || !isFinite(st.count) || st.count <= 0) continue
    out.push({ ...(st as ItemStack), count: Math.floor(st.count) })
  }
  return out
}
