// The Garden Bank — one shared material pool for the whole homeplot.
//
// WHY THIS REPLACES TEN SEPARATE BOXES (Alex, 2026-07-23):
// Chests were ten independent slot grids, and `craftItem` only ever read the player's satchel. So
// crafting meant remembering which box held the goldwood planks, opening it, ferrying stacks into
// the satchel, then walking to a station. Capacity was never the problem — the SHUFFLING was. The
// bank kills it: every placed chest contributes capacity to one pool, and stations draw straight
// from that pool.
//
// SCOPE = THE GARDEN, and that line already existed (Alex's call). Zones carry
// `realm?: 'ather' | 'outside'`, defaulting to 'ather', and exactly one zone is 'outside' — the
// Crucible. So the bank reaches all 33 Ather zones and stops at the Crucible gate. The same flag
// that already decides weapons-vs-spirits now decides bank-vs-satchel, which means the two realms
// differ along ONE consistent axis instead of two unrelated ones. It also finally gives the satchel
// a job: it is your Crucible loadout, the thing you commit to before going outside.
//
// The pool is a COUNT cap, not a slot grid, deliberately. A slot grid would just be Tetris with
// extra steps; "3,240 / 7,500" is a number a player can read at a glance and reason about.

import { ITEMS } from '../sprites/items'
import { FURNITURE } from '../sprites/furniture'
import { removeItems } from './inventory'
import type { Inventory } from './inventory'

/** Capacity each placed chest contributes. Tiered so upgrading a chest still means something —
 *  a flat rate would make the iron/ornate recipes pure decoration. Feel numbers: tune freely. */
export const CHEST_CAPACITY: Record<string, number> = {
  chest: 500,
  iron_chest: 750,
  ornate_chest: 1000,
  // Dungeon chests are found decorations (price 0, not craftable). They still hold their own, but
  // at the base rate — they are a souvenir that happens to be useful, not a capacity strategy.
  moss_chest: 500,
  crystal_chest: 500,
  shadow_chest: 500,
}

/** Capacity with zero chests placed. Small on purpose: the first chest should feel like relief. */
export const BASE_CAPACITY = 250

export interface BankState {
  /** itemId → count. Absent key means none; a count is never stored at 0. */
  items: Record<string, number>
}

export type BankSave = Record<string, number>

export function createBank(): BankState {
  return { items: {} }
}

/** Is this zone on the player's land? The Crucible is not. Everything else in the Ather is. */
export function bankReachable(realm: 'ather' | 'outside' | undefined): boolean {
  return realm !== 'outside'
}

/** Total items currently banked. */
export function bankUsed(bank: BankState): number {
  let n = 0
  for (const k in bank.items) n += bank.items[k]
  return n
}

/**
 * Capacity from the chests the player has PLACED. Carried chests contribute nothing — a chest in
 * your pocket is not storage, which is also the rule the old model implied by making a picked-up
 * chest's contents unreachable.
 */
export function bankCapacity(placedChestItemIds: string[]): number {
  let cap = BASE_CAPACITY
  for (const id of placedChestItemIds) cap += CHEST_CAPACITY[id] ?? 0
  return cap
}

/** True if this furniture id is a chest — i.e. contributes capacity. */
export function isChestFurniture(itemId: string): boolean {
  return !!FURNITURE.find(f => f.id === itemId)?.chestSlots
}

export function bankCount(bank: BankState, itemId: string): number {
  return bank.items[itemId] ?? 0
}

/**
 * Deposit up to `count`, stopping at the cap. Returns how many actually landed, so the caller can
 * report a partial ("banked 40 of 60") rather than silently eating the remainder.
 *
 * Over-cap states are TOLERATED rather than corrected: a save migrated from the old chests can
 * legitimately start above its cap, and the honest response is to block further deposits until it
 * drains, never to delete a player's materials to fit a number we just invented.
 */
export function bankDeposit(bank: BankState, itemId: string, count: number, capacity: number): number {
  if (count <= 0) return 0
  const room = capacity - bankUsed(bank)
  if (room <= 0) return 0
  const n = Math.min(count, room)
  bank.items[itemId] = (bank.items[itemId] ?? 0) + n
  return n
}

/** Withdraw up to `count`. Returns how many came out. Keys are deleted at 0 so the pool stays tidy. */
export function bankWithdraw(bank: BankState, itemId: string, count: number): number {
  const have = bank.items[itemId] ?? 0
  const n = Math.min(have, Math.max(0, count))
  if (n <= 0) return 0
  if (have - n <= 0) delete bank.items[itemId]
  else bank.items[itemId] = have - n
  return n
}

/**
 * Force items in regardless of capacity. ONLY for migration and for returning items the bank just
 * failed to give back — never for normal deposits, or the cap stops meaning anything.
 */
export function bankForceDeposit(bank: BankState, itemId: string, count: number): void {
  if (count <= 0) return
  bank.items[itemId] = (bank.items[itemId] ?? 0) + count
}

/** What a recipe can see: the satchel and the bank together (bank only when on your land). */
export function availableCount(inv: Inventory, bank: BankState | null, itemId: string): number {
  let n = 0
  for (const s of inv.slots) if (s?.itemId === itemId) n += s.count
  return n + (bank ? bankCount(bank, itemId) : 0)
}

/** A recipe requirement — every consuming action (craft/brew/tool/repair) speaks this shape. */
export type Requirement = { itemId: string; count: number }

/** Can every requirement be met from satchel + bank combined? Pass bank=null in the Crucible. */
export function canAfford(inv: Inventory, bank: BankState | null, recipe: Requirement[]): boolean {
  return recipe.every(r => availableCount(inv, bank, r.itemId) >= r.count)
}

/**
 * Consume a recipe's materials: INVENTORY FIRST, then the bank for any shortfall (Alex's rule —
 * crafted output lands in the satchel, so spending the satchel first keeps a material's whole
 * lifecycle in one place and leaves the bank as the deep reserve). Returns false and touches
 * NOTHING if the full recipe cannot be paid — callers rely on this being all-or-nothing so a
 * failed craft never half-eats a player's materials.
 *
 * bank=null models the Crucible (satchel only), where this degrades to plain inventory removal.
 */
export function spendMaterials(inv: Inventory, bank: BankState | null, recipe: Requirement[]): boolean {
  if (!canAfford(inv, bank, recipe)) return false
  for (const r of recipe) {
    const fromSatchel = Math.min(countInventory(inv, r.itemId), r.count)
    if (fromSatchel > 0) removeItems(inv, r.itemId, fromSatchel)
    const remainder = r.count - fromSatchel
    if (remainder > 0 && bank) bankWithdraw(bank, r.itemId, remainder)
  }
  return true
}

function countInventory(inv: Inventory, itemId: string): number {
  let n = 0
  for (const s of inv.slots) if (s?.itemId === itemId) n += s.count
  return n
}

/**
 * One-way migration from the old per-chest grids into the pool.
 *
 * Rules, all chosen so a live save cannot lose materials:
 *  - Uses bankForceDeposit, so an existing hoard larger than its new capacity survives intact and
 *    simply sits over-cap until it drains. Trimming to fit would delete a player's work to satisfy
 *    a number invented after they earned it.
 *  - Also drains chests CARRIED in the satchel (`chestData`). Those contents were unreachable in
 *    the old model until the chest was re-placed, so banking them hands back items the player had
 *    effectively lost. Strictly generous, never lossy.
 *  - Returns the item total moved so the caller can show the player what happened. A silent
 *    migration of someone's storage is how you get a bug report that reads "my chests are empty".
 */
export function migrateChestsToBank(
  bank: BankState,
  chestSlotGrids: ({ itemId: string; count: number } | null)[][],
): number {
  let moved = 0
  for (const grid of chestSlotGrids) {
    for (const slot of grid) {
      if (!slot || !slot.itemId || !(slot.count > 0)) continue
      bankForceDeposit(bank, slot.itemId, slot.count)
      moved += slot.count
    }
  }
  return moved
}

export function bankToSave(bank: BankState): BankSave {
  return { ...bank.items }
}

export function bankFromSave(saved: BankSave | undefined | null): BankState {
  const b = createBank()
  if (!saved) return b
  for (const k in saved) {
    // Defend against a hand-edited or half-written save: drop unknown ids and non-positive counts
    // rather than carrying a NaN into arithmetic that then poisons the whole pool total.
    const v = saved[k]
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) continue
    if (!ITEMS.find(i => i.id === k)) continue
    b.items[k] = Math.floor(v)
  }
  return b
}
