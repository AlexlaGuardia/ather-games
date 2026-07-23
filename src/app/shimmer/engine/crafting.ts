// Crafting system — assemble buildables (placeable stations) from gathered materials.
// There is NO canon "crafting" skill (skills are farming/forestry/prospecting/rinning/
// alchemy), so the workbench is skill-less: gated by materials + a small mana cost only.
// Mirrors alchemy.ts (canBrew/brewPotion) → canCraft/craftItem.

import type { Inventory } from './inventory'
import type { ManaPool } from './mana'
import { addItems } from './inventory'
import { drainMana } from './mana'
import { canAfford, spendMaterials, type BankState } from './bank'

export interface RecipeDef {
  id: string          // == the produced item id
  name: string
  tier: 1 | 2 | 3
  manaCost: number
  recipe: { itemId: string; count: number }[]
  resultCount: number
}

export const RECIPE_DEFS: Record<string, RecipeDef> = {
  // Tier 1 — the workbench itself, renewable from cheap forestry mats.
  crafting_table: {
    id: 'crafting_table', name: 'Crafting Table', tier: 1,
    manaCost: 4, resultCount: 1,
    recipe: [{ itemId: 'goldwood_plank', count: 4 }, { itemId: 'goldwood_bark', count: 2 }],
  },

  // Tier 2 — the Alchemy Station: sturdier wood + raw mana to seat the brewing.
  alchemy_station: {
    id: 'alchemy_station', name: 'Alchemy Station', tier: 2,
    manaCost: 8, resultCount: 1,
    recipe: [{ itemId: 'shimmeroak_plank', count: 6 }, { itemId: 'raw_mana_shard', count: 4 }],
  },

  // Tier 1 — Chest: same itemId + recipe as the 2D game's furniture Wooden Chest (sprites/furniture.ts),
  // so the two walkers agree on what it costs to build one.
  chest: {
    id: 'chest', name: 'Chest', tier: 1,
    manaCost: 4, resultCount: 1,
    recipe: [{ itemId: 'goldwood_plank', count: 8 }, { itemId: 'goldwood_bark', count: 4 }],
  },

  // Tier 2 — Exchange Booth: pricier than the Alchemy Station (it's the market itself), sturdier
  // wood + more raw mana to seat the connection to the Ather Exchange.
  exchange_booth: {
    id: 'exchange_booth', name: 'Exchange Booth', tier: 2,
    manaCost: 10, resultCount: 1,
    recipe: [{ itemId: 'shimmeroak_plank', count: 10 }, { itemId: 'raw_mana_shard', count: 6 }],
  },

  // Tier 1 — Farm Planter: cheap and renewable, same spirit as the Crafting Table (farming starts
  // at level 1, so the entry station should be gettable day one).
  farm_planter: {
    id: 'farm_planter', name: 'Farm Planter', tier: 1,
    manaCost: 3, resultCount: 1,
    recipe: [{ itemId: 'goldwood_plank', count: 3 }, { itemId: 'goldwood_bark', count: 2 }],
  },
}

export const RECIPE_IDS = Object.keys(RECIPE_DEFS)

/** Can the player craft this recipe? (has materials + mana) — materials counted across satchel+bank. */
export function canCraft(recipeId: string, inv: Inventory, mana?: ManaPool, bank: BankState | null = null): boolean {
  const def = RECIPE_DEFS[recipeId]
  if (!def) return false
  if (mana && mana.current < def.manaCost) return false
  return canAfford(inv, bank, def.recipe)
}

/** Craft a recipe — consumes materials, drains mana, adds result. Returns false on failure. */
// bank is optional and trailing: omitted (or null) = satchel only, which is exactly the Crucible
// case and the behaviour every pre-bank caller/test already expects. When present, materials come
// from satchel-first then bank (spendMaterials), and the crafted item always lands in the satchel.
export function craftItem(recipeId: string, inv: Inventory, mana: ManaPool, bank: BankState | null = null): boolean {
  const def = RECIPE_DEFS[recipeId]
  if (!def) return false
  if (!canAfford(inv, bank, def.recipe)) return false
  // Mana is checked AFTER affordability but drained only once we know materials exist — mirrors the
  // original order (material check, then drainMana) so a mana-poor attempt never spends materials.
  if (!drainMana(mana, def.manaCost)) return false

  spendMaterials(inv, bank, def.recipe)   // cannot fail: canAfford already passed
  addItems(inv, def.id, def.resultCount)
  return true
}

/** All recipes, ordered for display (cheapest tier first). */
export function getRecipes(): RecipeDef[] {
  return RECIPE_IDS.map(id => RECIPE_DEFS[id]).sort((a, b) => a.tier - b.tier)
}
