// Spirit held items — equipment that modifies battle behavior
// Each spirit holds 1 item. Berries are consumed on trigger, gems/charms are passive.
// Pure functions — no side effects.

import type { CombatStats } from './battle'
import type { CombatStat } from './moves'

// ============================================
// Types
// ============================================

export type HeldItemCategory = 'berry' | 'gem' | 'charm'

export interface HeldItemDef {
  id: string
  name: string
  category: HeldItemCategory
  description: string
  // Berry: auto-trigger at HP threshold
  triggerHpPercent?: number
  healPercent?: number
  cureStatus?: boolean
  statBoostOnTrigger?: { stat: CombatStat; stages: number }
  // Gem: flat stat modifier at battle start
  statModifier?: { stat: CombatStat; percent: number }
  // Charm: passive battle effects
  stabBonus?: number
  endureBoost?: number
  accuracyBonus?: number
}

export interface HeldItemTriggerResult {
  consumed: boolean
  healPercent?: number
  cureStatus?: boolean
  statBoost?: { stat: CombatStat; stages: number }
  message: string
}

// ============================================
// Item Definitions
// ============================================

export const HELD_ITEMS: Record<string, HeldItemDef> = {
  // --- Berries (consumable, one-use in battle) ---
  mending_berry: {
    id: 'mending_berry',
    name: 'Mending Berry',
    category: 'berry',
    description: 'Restores 25% HP when health drops below 30%.',
    triggerHpPercent: 0.3,
    healPercent: 0.25,
  },
  vigor_berry: {
    id: 'vigor_berry',
    name: 'Vigor Berry',
    category: 'berry',
    description: 'Cures status effects when afflicted.',
    triggerHpPercent: 1.0, // triggers on any status infliction (checked separately)
    cureStatus: true,
  },
  rush_berry: {
    id: 'rush_berry',
    name: 'Rush Berry',
    category: 'berry',
    description: 'Boosts Agility when health drops below 50%.',
    triggerHpPercent: 0.5,
    statBoostOnTrigger: { stat: 'agi', stages: 1 },
  },

  // --- Gems (passive stat boost at battle start) ---
  power_gem: {
    id: 'power_gem',
    name: 'Power Gem',
    category: 'gem',
    description: 'Increases Power by 10% in battle.',
    statModifier: { stat: 'pwr', percent: 0.10 },
  },
  guard_gem: {
    id: 'guard_gem',
    name: 'Guard Gem',
    category: 'gem',
    description: 'Increases Guard by 10% in battle.',
    statModifier: { stat: 'grd', percent: 0.10 },
  },
  agility_gem: {
    id: 'agility_gem',
    name: 'Agility Gem',
    category: 'gem',
    description: 'Increases Agility by 10% in battle.',
    statModifier: { stat: 'agi', percent: 0.10 },
  },

  // --- Charms (passive battle effects) ---
  element_charm: {
    id: 'element_charm',
    name: 'Element Charm',
    category: 'charm',
    description: 'Boosts same-type attack bonus from 1.25x to 1.40x.',
    stabBonus: 0.15,
  },
  endurance_charm: {
    id: 'endurance_charm',
    name: 'Endurance Charm',
    category: 'charm',
    description: 'Doubles the chance to endure a lethal hit.',
    endureBoost: 0.15, // 15% → 30%
  },
  focus_charm: {
    id: 'focus_charm',
    name: 'Focus Charm',
    category: 'charm',
    description: 'Increases move accuracy by 10.',
    accuracyBonus: 10,
  },
}

// ============================================
// Battle Integration Functions
// ============================================

/** Apply passive gem stat modifiers at battle start. Returns modified stats. */
export function applyPassiveHeldItem(stats: CombatStats, heldItemId: string | undefined): CombatStats {
  if (!heldItemId) return stats
  const item = HELD_ITEMS[heldItemId]
  if (!item?.statModifier) return stats

  const { stat, percent } = item.statModifier
  return {
    ...stats,
    [stat]: Math.round(stats[stat] * (1 + percent)),
  }
}

/** Check if a berry should trigger after damage. Returns null if no trigger. */
export function checkBerryTrigger(
  heldItemId: string | undefined,
  consumed: boolean,
  currentHp: number,
  maxHp: number,
): HeldItemTriggerResult | null {
  if (!heldItemId || consumed) return null
  const item = HELD_ITEMS[heldItemId]
  if (!item || item.category !== 'berry') return null

  // Vigor berry triggers on status infliction, not HP (handled separately)
  if (item.cureStatus) return null

  // HP threshold check
  if (!item.triggerHpPercent) return null
  if (currentHp / maxHp > item.triggerHpPercent) return null

  const result: HeldItemTriggerResult = {
    consumed: true,
    message: `${item.name} activated!`,
  }

  if (item.healPercent) result.healPercent = item.healPercent
  if (item.statBoostOnTrigger) result.statBoost = item.statBoostOnTrigger

  return result
}

/** Check if vigor berry should trigger on status infliction. */
export function checkStatusCureTrigger(
  heldItemId: string | undefined,
  consumed: boolean,
): HeldItemTriggerResult | null {
  if (!heldItemId || consumed) return null
  const item = HELD_ITEMS[heldItemId]
  if (!item || !item.cureStatus) return null

  return {
    consumed: true,
    cureStatus: true,
    message: `${item.name} cured the status!`,
  }
}

/** Get STAB bonus from Element Charm (added to base 1.25). Returns 0 if no charm. */
export function getCharmSTABBonus(heldItemId: string | undefined): number {
  if (!heldItemId) return 0
  return HELD_ITEMS[heldItemId]?.stabBonus ?? 0
}

/** Get endure chance boost from Endurance Charm. Returns 0 if no charm. */
export function getCharmEndureBoost(heldItemId: string | undefined): number {
  if (!heldItemId) return 0
  return HELD_ITEMS[heldItemId]?.endureBoost ?? 0
}

/** Get accuracy bonus from Focus Charm. Returns 0 if no charm. */
export function getCharmAccuracyBonus(heldItemId: string | undefined): number {
  if (!heldItemId) return 0
  return HELD_ITEMS[heldItemId]?.accuracyBonus ?? 0
}

/** Get all held item IDs (for inventory/shop listing) */
export function getAllHeldItemIds(): string[] {
  return Object.keys(HELD_ITEMS)
}

/** Get a held item definition by ID */
export function getHeldItem(id: string): HeldItemDef | undefined {
  return HELD_ITEMS[id]
}
