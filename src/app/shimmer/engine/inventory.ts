// Slot-based inventory system — Minecraft-style grid
// Slots 0-14 = storage (3 rows), slots 15-19 = hotbar (bottom row)
// Chests are portable containers: items inside a picked-up chest are inaccessible

import { ITEMS } from '../sprites/items'
import { FURNITURE } from '../sprites/furniture'

// --- Constants ---
export const INVENTORY_COLS = 5
export const INVENTORY_ROWS = 4
export const INVENTORY_SLOTS = 20
export const HOTBAR_START = 15
export const HOTBAR_SIZE = 5
export const CHEST_COLS = 5
export const CHEST_ROWS = 3
export const CHEST_SLOTS = 15
export const MAX_CHESTS = 10  // total chests a player can own (placed + inventory)

// --- Types ---
export interface ItemStack {
  itemId: string
  count: number
  chestData?: ChestStorage  // only when itemId === 'chest', carries contents
}

export type SlotGrid = (ItemStack | null)[]

export interface Inventory {
  slots: SlotGrid  // length = INVENTORY_SLOTS (20)
}

export interface ChestStorage {
  furnitureInstanceId: string
  slots: SlotGrid  // length = CHEST_SLOTS (15)
  label?: string
}

// --- Save types ---
export type InventorySave = (ItemStack | null)[]
export type ChestSave = { furnitureInstanceId: string; slots: (ItemStack | null)[]; label?: string }

// --- Creation ---

export function createInventory(): Inventory {
  return { slots: new Array(INVENTORY_SLOTS).fill(null) }
}

export function createChestStorage(furnitureInstanceId: string, slotCount?: number): ChestStorage {
  return { furnitureInstanceId, slots: new Array(slotCount ?? CHEST_SLOTS).fill(null) }
}

// --- Migration from old Record<string, number> bag ---

export function migrateFromBag(bag: Record<string, number>): Inventory {
  const inv = createInventory()
  // Fill slots in ITEMS definition order (deterministic)
  for (const itemDef of ITEMS) {
    const count = bag[itemDef.id]
    if (!count || count <= 0) continue
    addItems(inv, itemDef.id, count, itemDef.maxStack)
  }
  return inv
}

// --- Helpers ---

/** Check if an item is furniture (belongs in the world, not hotbar). */
export function isFurnitureItem(itemId: string): boolean {
  return FURNITURE.some(f => f.id === itemId)
}

/** Check if an item is a chest-type furniture. */
export function isChestItem(itemId: string): boolean {
  return !!FURNITURE.find(f => f.id === itemId)?.chestSlots
}

/** Count total chests in inventory (not counting placed furniture — caller adds those). */
export function countChestsInInventory(inv: Inventory): number {
  let total = 0
  for (const slot of inv.slots) {
    if (slot && isChestItem(slot.itemId)) total += slot.count
  }
  return total
}

// --- Slot operations ---

function getMaxStack(itemId: string): number {
  return ITEMS.find(i => i.id === itemId)?.maxStack
    ?? FURNITURE.find(f => f.id === itemId)?.maxStack
    ?? 1
}

/** Add items to inventory. Returns leftover count that couldn't fit.
 *  The hotbar (slots 15-19) is a deliberate, player-arranged quick row: auto-add NEVER
 *  drops a new item into an empty hotbar slot (that churn is what made hotbar layouts feel
 *  like they "reset" every time you gathered). Existing hotbar stacks still top up — a
 *  resource you keep in the hotbar keeps growing — but new/other loot only ever fills storage.
 *  Furniture is storage-only in both passes. */
export function addItems(inv: Inventory, itemId: string, count: number, maxStack?: number): number {
  const max = maxStack ?? getMaxStack(itemId)
  const isFurn = isFurnitureItem(itemId)
  // Top-up pass may reach the hotbar for non-furniture; empty-fill pass never does.
  const topUpLimit = isFurn ? HOTBAR_START : inv.slots.length
  const fillLimit = HOTBAR_START  // new items → storage only (0-14)
  let remaining = count

  // First pass: fill existing stacks of same item (incl. a stack the player keeps in the hotbar)
  for (let i = 0; i < topUpLimit && remaining > 0; i++) {
    const slot = inv.slots[i]
    if (slot && slot.itemId === itemId && slot.count < max) {
      const space = max - slot.count
      const add = Math.min(space, remaining)
      slot.count += add
      remaining -= add
    }
  }

  // Second pass: fill empty STORAGE slots only — leave the hotbar layout untouched
  for (let i = 0; i < fillLimit && remaining > 0; i++) {
    if (inv.slots[i] === null) {
      const add = Math.min(max, remaining)
      inv.slots[i] = { itemId, count: add }
      remaining -= add
    }
  }

  return remaining
}

/** Remove count of itemId from inventory. Returns true if successful. */
export function removeItems(inv: Inventory, itemId: string, count: number): boolean {
  // Check we have enough first
  if (countItem(inv, itemId) < count) return false

  let remaining = count
  for (let i = 0; i < inv.slots.length && remaining > 0; i++) {
    const slot = inv.slots[i]
    if (slot && slot.itemId === itemId) {
      const take = Math.min(slot.count, remaining)
      slot.count -= take
      remaining -= take
      if (slot.count <= 0) inv.slots[i] = null
    }
  }
  return true
}

/** Count total of an itemId across all top-level slots (ignores chestData contents). */
export function countItem(inv: Inventory, itemId: string): number {
  let total = 0
  for (const slot of inv.slots) {
    if (slot && slot.itemId === itemId) total += slot.count
  }
  return total
}

/** Find first slot index containing itemId. Returns null if not found. */
export function findItem(inv: Inventory, itemId: string): number | null {
  for (let i = 0; i < inv.slots.length; i++) {
    if (inv.slots[i]?.itemId === itemId) return i
  }
  return null
}

/** Move/swap/merge between two slots in the same grid.
 *  If grid is an inventory (length 20), furniture can't move to hotbar slots. */
export function moveSlot(grid: SlotGrid, fromIdx: number, toIdx: number): void {
  const from = grid[fromIdx]
  const to = grid[toIdx]

  if (!from) return

  // Block furniture from entering hotbar (slots 15-19 in a 20-slot inventory)
  if (grid.length === INVENTORY_SLOTS && toIdx >= HOTBAR_START && isFurnitureItem(from.itemId)) return
  // Block swapping furniture INTO hotbar when swapping different items
  if (grid.length === INVENTORY_SLOTS && fromIdx >= HOTBAR_START && to && isFurnitureItem(to.itemId)) return

  // Target empty → just move
  if (!to) {
    grid[toIdx] = from
    grid[fromIdx] = null
    return
  }

  // Same item → merge up to maxStack
  if (from.itemId === to.itemId) {
    const max = getMaxStack(from.itemId)
    const space = max - to.count
    if (space >= from.count) {
      // Full merge
      to.count += from.count
      grid[fromIdx] = null
    } else if (space > 0) {
      // Partial merge
      to.count = max
      from.count -= space
    }
    // else: both full, do nothing (no swap for same item)
    return
  }

  // Different items → swap
  grid[toIdx] = from
  grid[fromIdx] = to
}

/** Split count items from a slot to the first empty slot. Returns false if no space. */
export function splitStack(grid: SlotGrid, slotIdx: number, count?: number): boolean {
  const slot = grid[slotIdx]
  if (!slot || slot.count <= 1) return false

  const splitCount = count ?? Math.floor(slot.count / 2)
  if (splitCount <= 0 || splitCount >= slot.count) return false

  // Find first empty slot
  const emptyIdx = grid.findIndex(s => s === null)
  if (emptyIdx === -1) return false

  grid[emptyIdx] = { itemId: slot.itemId, count: splitCount }
  slot.count -= splitCount
  return true
}

/** Get hotbar slots (15-19). */
export function getHotbarSlots(inv: Inventory): (ItemStack | null)[] {
  return inv.slots.slice(HOTBAR_START, HOTBAR_START + HOTBAR_SIZE)
}

/** Transfer an item between any two slot grids (inventory <-> chest, inventory <-> GE).
 *  Respects hotbar restriction: furniture can't land in hotbar slots of a 20-slot inventory. */
export function transferItem(
  source: SlotGrid, sourceIdx: number,
  dest: SlotGrid, destIdx: number,
): void {
  const srcItem = source[sourceIdx]
  const dstItem = dest[destIdx]

  if (!srcItem) return

  // Block furniture from entering hotbar slots in inventory
  if (dest.length === INVENTORY_SLOTS && destIdx >= HOTBAR_START && isFurnitureItem(srcItem.itemId)) return
  // Block swap that would put furniture in source hotbar
  if (source.length === INVENTORY_SLOTS && sourceIdx >= HOTBAR_START && dstItem && isFurnitureItem(dstItem.itemId)) return

  // Dest empty → move
  if (!dstItem) {
    dest[destIdx] = srcItem
    source[sourceIdx] = null
    return
  }

  // Same item → merge
  if (srcItem.itemId === dstItem.itemId) {
    const max = getMaxStack(srcItem.itemId)
    const space = max - dstItem.count
    if (space >= srcItem.count) {
      dstItem.count += srcItem.count
      source[sourceIdx] = null
    } else if (space > 0) {
      dstItem.count = max
      srcItem.count -= space
    }
    return
  }

  // Different items → swap
  dest[destIdx] = srcItem
  source[sourceIdx] = dstItem
}

// --- Save/Load ---

export function inventoryToSave(inv: Inventory): InventorySave {
  return inv.slots.map(s => s ? { ...s } : null)
}

export function inventoryFromSave(saved: InventorySave): Inventory {
  const slots: SlotGrid = new Array(INVENTORY_SLOTS).fill(null)
  for (let i = 0; i < Math.min(saved.length, INVENTORY_SLOTS); i++) {
    slots[i] = saved[i] ? { ...saved[i]! } : null
  }
  return { slots }
}

export function chestToSave(chest: ChestStorage): ChestSave {
  return {
    furnitureInstanceId: chest.furnitureInstanceId,
    slots: chest.slots.map(s => s ? { ...s } : null),
    label: chest.label,
  }
}

export function chestFromSave(saved: ChestSave): ChestStorage {
  // Preserve original slot count (iron=20, ornate=25, etc.)
  const slotCount = saved.slots.length || CHEST_SLOTS
  const slots: SlotGrid = new Array(slotCount).fill(null)
  for (let i = 0; i < slotCount; i++) {
    slots[i] = saved.slots[i] ? { ...saved.slots[i]! } : null
  }
  return { furnitureInstanceId: saved.furnitureInstanceId, slots, label: saved.label }
}

/** Check if an inventory has any empty slots. */
export function hasSpace(inv: Inventory): boolean {
  return inv.slots.some(s => s === null)
}

/** Count empty slots. */
export function emptySlotCount(inv: Inventory): number {
  return inv.slots.filter(s => s === null).length
}
