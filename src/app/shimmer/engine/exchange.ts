// Ather Exchange — single-player NPC market maker
// Canon: Athernyx-style market at The Citadel. Instant buy/sell at fluctuating prices.
// Items with tradeable:true can be traded. 5% tax on sales (marks sink).

import type { Inventory } from './inventory'
import { countItem, removeItems, addItems } from './inventory'
import { ITEMS, type ItemDef } from '../sprites/items'

// ============================================
// Types
// ============================================

export interface GEItemConfig {
  itemId: string
  basePrice: number    // starting market price
  minPrice: number     // price floor
  maxPrice: number     // price ceiling
  volatility: number   // 0-1, how fast price drifts
}

export interface GEMarketState {
  prices: Record<string, number>       // current price per item
  history: Record<string, number[]>    // last 20 prices for sparkline
  lastTick: number                     // timestamp of last price drift
}

export const TAX_RATE = 0.05  // 5% tax on sales

// ============================================
// Config derivation — auto-calc from ItemDef
// ============================================

/** Per-item base price overrides set via GEEditor. Takes priority over auto-derive. */
export const GE_BASE_OVERRIDES: Record<string, number> = {}

/** Auto-derive GE base price from item data (without overrides) */
export function deriveDefaultBase(item: ItemDef): number {
  return item.buyPrice ? Math.round(item.buyPrice * 0.7)
    : item.sellPrice ? Math.round(item.sellPrice * 1.3)
    : 10
}

export function deriveGEConfig(item: ItemDef): GEItemConfig {
  const base = GE_BASE_OVERRIDES[item.id] ?? deriveDefaultBase(item)
  return {
    itemId: item.id,
    basePrice: base,
    minPrice: Math.max(1, Math.floor(base * 0.4)),
    maxPrice: Math.ceil(base * 3.0),
    volatility: item.rarity === 'legendary' ? 0.3
      : item.rarity === 'rare' ? 0.2
      : item.rarity === 'uncommon' ? 0.15
      : 0.1,
  }
}

/** All tradeable items with their GE configs */
export const GE_CONFIGS: Record<string, GEItemConfig> = Object.fromEntries(
  ITEMS.filter(i => i.tradeable).map(i => [i.id, deriveGEConfig(i)])
)

export const GE_ITEM_IDS = Object.keys(GE_CONFIGS)

// ============================================
// State management
// ============================================

/** Create initial market state with all items at base price */
export function createGEState(): GEMarketState {
  const prices: Record<string, number> = {}
  const history: Record<string, number[]> = {}
  for (const [id, cfg] of Object.entries(GE_CONFIGS)) {
    prices[id] = cfg.basePrice
    history[id] = [cfg.basePrice]
  }
  return { prices, history, lastTick: Date.now() }
}

/** Get current market price for an item */
export function getMarketPrice(state: GEMarketState, itemId: string): number {
  return state.prices[itemId] ?? GE_CONFIGS[itemId]?.basePrice ?? 0
}

/** Get price history for sparkline display */
export function getPriceHistory(state: GEMarketState, itemId: string): number[] {
  return state.history[itemId] ?? []
}

// ============================================
// Trading operations
// ============================================

export interface GETradeResult {
  success: boolean
  totalMarks: number      // marks spent (buy) or earned after tax (sell)
  tax: number             // tax deducted (sell only)
  newPrice: number        // price after trade
  error?: string
}

/**
 * Buy items from the GE. Spends marks, receives items, price rises.
 * wallet.spend/earn are external (useWallet hook).
 */
export function buyFromGE(
  state: GEMarketState,
  walletMarks: number,
  inv: Inventory,
  itemId: string,
  qty: number,
): GETradeResult {
  const cfg = GE_CONFIGS[itemId]
  if (!cfg) return { success: false, totalMarks: 0, tax: 0, newPrice: 0, error: 'Item not tradeable' }

  const price = getMarketPrice(state, itemId)
  const totalCost = Math.ceil(price * qty)

  if (walletMarks < totalCost) {
    return { success: false, totalMarks: totalCost, tax: 0, newPrice: price, error: 'Not enough marks' }
  }

  // Add items to inventory
  addItems(inv, itemId, qty)

  // Price rises after buy — more demand
  const priceShift = 1 + (0.02 * qty * cfg.volatility)
  state.prices[itemId] = Math.min(cfg.maxPrice, Math.round(price * priceShift))

  // Record to sparkline history
  if (!state.history[itemId]) state.history[itemId] = []
  state.history[itemId].push(state.prices[itemId])
  if (state.history[itemId].length > 20) state.history[itemId].shift()

  return { success: true, totalMarks: totalCost, tax: 0, newPrice: state.prices[itemId] }
}

/**
 * Sell items to the GE. Gives items, receives marks minus tax, price drops.
 */
export function sellToGE(
  state: GEMarketState,
  inv: Inventory,
  itemId: string,
  qty: number,
): GETradeResult {
  const cfg = GE_CONFIGS[itemId]
  if (!cfg) return { success: false, totalMarks: 0, tax: 0, newPrice: 0, error: 'Item not tradeable' }
  if (countItem(inv, itemId) < qty) {
    return { success: false, totalMarks: 0, tax: 0, newPrice: getMarketPrice(state, itemId), error: 'Not enough items' }
  }

  const price = getMarketPrice(state, itemId)
  const gross = Math.floor(price * qty)
  const tax = Math.ceil(gross * TAX_RATE)
  const net = gross - tax

  // Remove items
  removeItems(inv, itemId, qty)

  // Price drops after sell — more supply
  const priceShift = 1 - (0.015 * qty * cfg.volatility)
  state.prices[itemId] = Math.max(cfg.minPrice, Math.round(price * priceShift))

  // Record to sparkline history
  if (!state.history[itemId]) state.history[itemId] = []
  state.history[itemId].push(state.prices[itemId])
  if (state.history[itemId].length > 20) state.history[itemId].shift()

  return { success: true, totalMarks: net, tax, newPrice: state.prices[itemId] }
}

// ============================================
// Price drift — call periodically
// ============================================

const DRIFT_INTERVAL = 30_000  // drift prices every 30 seconds

/** Drift all prices toward base. Call from game tick. */
export function tickPriceDrift(state: GEMarketState): boolean {
  const now = Date.now()
  if (now - state.lastTick < DRIFT_INTERVAL) return false

  state.lastTick = now

  for (const [id, cfg] of Object.entries(GE_CONFIGS)) {
    const current = state.prices[id] ?? cfg.basePrice
    if (current === cfg.basePrice) continue

    // Move 2-8% toward base (scaled by volatility)
    const driftRate = 0.02 + cfg.volatility * 0.06
    const diff = cfg.basePrice - current
    const drift = Math.round(diff * driftRate)

    if (drift === 0) {
      // Snap to base if very close
      state.prices[id] = cfg.basePrice
    } else {
      state.prices[id] = current + drift
    }

    // Record history (keep last 20)
    if (!state.history[id]) state.history[id] = []
    state.history[id].push(state.prices[id])
    if (state.history[id].length > 20) state.history[id].shift()
  }

  return true
}

// ============================================
// Save/load
// ============================================

export interface GESave {
  prices: Record<string, number>
  history: Record<string, number[]>
  lastTick: number
}

export function geToSave(state: GEMarketState): GESave {
  return {
    prices: { ...state.prices },
    history: Object.fromEntries(
      Object.entries(state.history).map(([k, v]) => [k, [...v]])
    ),
    lastTick: state.lastTick,
  }
}

export function geFromSave(saved: GESave): GEMarketState {
  // Merge saved prices with current configs (handles new items)
  const state = createGEState()
  for (const [id, price] of Object.entries(saved.prices)) {
    if (state.prices[id] !== undefined) {
      state.prices[id] = price
    }
  }
  for (const [id, hist] of Object.entries(saved.history)) {
    if (state.history[id] !== undefined) {
      state.history[id] = hist
    }
  }
  state.lastTick = saved.lastTick ?? Date.now()
  return state
}
