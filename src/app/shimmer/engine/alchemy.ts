// Alchemy system — brew potions from gathered resources
// Canon: alchemy skill levels 1-25 unlock 4 tiers of potions
// Mirrors tools.ts pattern: canBrew/brewPotion

import type { Inventory } from './inventory'
import type { SkillSet } from './skills'
import type { ManaPool } from './mana'
import { countItem, removeItems, addItems } from './inventory'
import { addSkillXP } from './skills'
import { drainMana } from './mana'

export interface PotionDef {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4
  minAlchemyLevel: number
  manaCost: number
  xpGrant: number
  recipe: { itemId: string; count: number }[]
  resultCount: number
}

export const POTION_DEFS: Record<string, PotionDef> = {
  // Tier 1 — Beginner
  mana_draught: {
    id: 'mana_draught', name: 'Mana Draught', tier: 1,
    minAlchemyLevel: 1, manaCost: 5, xpGrant: 15, resultCount: 2,
    recipe: [{ itemId: 'raw_mana_shard', count: 5 }],
  },
  shard_tonic: {
    id: 'shard_tonic', name: 'Shard Tonic', tier: 1,
    minAlchemyLevel: 1, manaCost: 8, xpGrant: 20, resultCount: 1,
    recipe: [{ itemId: 'raw_mana_shard', count: 3 }, { itemId: 'goldwood_bark', count: 2 }],
  },
  shimmer_salve: {
    id: 'shimmer_salve', name: 'Shimmer Salve', tier: 1,
    minAlchemyLevel: 3, manaCost: 10, xpGrant: 25, resultCount: 1,
    recipe: [{ itemId: 'shimmerscale', count: 4 }, { itemId: 'sunfruit', count: 2 }],
  },

  // Tier 2 — Intermediate
  glowfin_brew: {
    id: 'glowfin_brew', name: 'Glowfin Brew', tier: 2,
    minAlchemyLevel: 5, manaCost: 15, xpGrant: 40, resultCount: 1,
    recipe: [{ itemId: 'glowfin', count: 3 }, { itemId: 'ribboneel', count: 2 }, { itemId: 'raw_mana_shard', count: 3 }],
  },
  crystal_elixir: {
    id: 'crystal_elixir', name: 'Crystal Elixir', tier: 2,
    minAlchemyLevel: 7, manaCost: 20, xpGrant: 50, resultCount: 1,
    recipe: [{ itemId: 'violet_crystal', count: 2 }, { itemId: 'water_crystal', count: 2 }, { itemId: 'amber_sap', count: 3 }],
  },
  bond_philter: {
    id: 'bond_philter', name: 'Bond Philter', tier: 2,
    minAlchemyLevel: 8, manaCost: 18, xpGrant: 45, resultCount: 1,
    recipe: [{ itemId: 'ribboneel', count: 3 }, { itemId: 'moonberry', count: 3 }, { itemId: 'amber_sap', count: 2 }],
  },

  // Tier 3 — Advanced
  starlight_tincture: {
    id: 'starlight_tincture', name: 'Starlight Tincture', tier: 3,
    minAlchemyLevel: 12, manaCost: 30, xpGrant: 80, resultCount: 1,
    recipe: [{ itemId: 'starwillow_sap', count: 3 }, { itemId: 'pure_mana_core', count: 2 }, { itemId: 'glowfin', count: 2 }],
  },
  deep_essence: {
    id: 'deep_essence', name: 'Deep Essence', tier: 3,
    minAlchemyLevel: 15, manaCost: 35, xpGrant: 100, resultCount: 1,
    recipe: [{ itemId: 'moonkoi', count: 2 }, { itemId: 'pearlshell', count: 2 }, { itemId: 'starwillow_branch', count: 3 }],
  },

  // Tier 4 — Master
  ather_infusion: {
    id: 'ather_infusion', name: 'Ather Infusion', tier: 4,
    minAlchemyLevel: 20, manaCost: 50, xpGrant: 150, resultCount: 1,
    recipe: [{ itemId: 'ather_crystal', count: 1 }, { itemId: 'crystallized_sap', count: 2 }, { itemId: 'pure_mana_core', count: 3 }],
  },
  dawn_cordial: {
    id: 'dawn_cordial', name: 'Dawn Cordial', tier: 4,
    minAlchemyLevel: 25, manaCost: 60, xpGrant: 200, resultCount: 1,
    recipe: [{ itemId: 'dawnwood_plank', count: 2 }, { itemId: 'crystal_rinn', count: 1 }, { itemId: 'crystallized_sap', count: 2 }],
  },

  // Crop-based potions (farming → alchemy pipeline)
  harvest_brew: {
    id: 'harvest_brew', name: 'Harvest Brew', tier: 1,
    minAlchemyLevel: 2, manaCost: 6, xpGrant: 18, resultCount: 2,
    recipe: [{ itemId: 'shimmerwheat_grain', count: 5 }, { itemId: 'glowroot_bulb', count: 3 }],
  },
  moonvine_tonic: {
    id: 'moonvine_tonic', name: 'Moonvine Tonic', tier: 2,
    minAlchemyLevel: 6, manaCost: 12, xpGrant: 35, resultCount: 1,
    recipe: [{ itemId: 'moonvine_leaf', count: 4 }, { itemId: 'sunpetal_bloom', count: 2 }],
  },
  dreamroot_elixir: {
    id: 'dreamroot_elixir', name: 'Dreamroot Elixir', tier: 3,
    minAlchemyLevel: 14, manaCost: 28, xpGrant: 85, resultCount: 1,
    recipe: [{ itemId: 'dreamroot_essence', count: 3 }, { itemId: 'crystalcap_spore', count: 2 }],
  },
}

export const POTION_IDS = Object.keys(POTION_DEFS)

/** Check if player can brew a potion (has materials, level, mana) */
export function canBrew(potionId: string, inv: Inventory, alchemyLevel: number, mana?: ManaPool): boolean {
  const def = POTION_DEFS[potionId]
  if (!def) return false
  if (alchemyLevel < def.minAlchemyLevel) return false
  if (mana && mana.current < def.manaCost) return false
  return def.recipe.every(r => countItem(inv, r.itemId) >= r.count)
}

/** Brew a potion — consumes materials, drains mana, adds result, grants XP. Returns false on failure. */
export function brewPotion(potionId: string, inv: Inventory, skills: SkillSet, mana: ManaPool): boolean {
  const def = POTION_DEFS[potionId]
  if (!def) return false
  if (skills.alchemy.level < def.minAlchemyLevel) return false
  if (!drainMana(mana, def.manaCost)) return false
  if (!def.recipe.every(r => countItem(inv, r.itemId) >= r.count)) return false

  for (const r of def.recipe) {
    removeItems(inv, r.itemId, r.count)
  }
  addItems(inv, potionId, def.resultCount)
  addSkillXP(skills.alchemy, def.xpGrant)
  return true
}

/** Get potions visible to the player (within 3 levels of their alchemy level) */
export function getVisiblePotions(alchemyLevel: number): PotionDef[] {
  return POTION_IDS
    .map(id => POTION_DEFS[id])
    .filter(def => def.minAlchemyLevel <= alchemyLevel + 3)
    .sort((a, b) => a.minAlchemyLevel - b.minAlchemyLevel || a.tier - b.tier)
}
