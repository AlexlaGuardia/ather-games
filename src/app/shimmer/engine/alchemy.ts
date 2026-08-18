// Alchemy system — brew potions from gathered resources
// Canon: alchemy skill levels 1-25 unlock 4 tiers of potions
// Mirrors tools.ts pattern: canBrew/brewPotion

import type { Element, Spirit } from '../spirits/spirit'
import { addInfusion, infusionTotal, MAX_INFUSIONS_TOTAL, MAX_INFUSIONS_PER_ELEMENT } from '../spirits/spirit'
import type { Inventory } from './inventory'
import type { SkillSet } from './skills'
import type { ManaPool } from './mana'
import { addItems, countItem, removeItems } from './inventory'
import { addSkillXP } from './skills'
import { drainMana } from './mana'
import { canAfford, spendMaterials, type BankState } from './bank'

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
  mana_infusion: {
    id: 'mana_infusion', name: 'Mana Infusion', tier: 2,
    minAlchemyLevel: 10, manaCost: 25, xpGrant: 60, resultCount: 1,
    recipe: [{ itemId: 'violet_crystal', count: 1 }, { itemId: 'violetbloom_petal', count: 2 }, { itemId: 'amber_sap', count: 1 }],
  },
  storm_infusion: {
    id: 'storm_infusion', name: 'Storm Infusion', tier: 2,
    minAlchemyLevel: 10, manaCost: 25, xpGrant: 60, resultCount: 1,
    recipe: [{ itemId: 'storm_crystal', count: 1 }, { itemId: 'stormgrass_blade', count: 2 }, { itemId: 'amber_sap', count: 1 }],
  },
  earth_infusion: {
    id: 'earth_infusion', name: 'Earth Infusion', tier: 2,
    minAlchemyLevel: 10, manaCost: 25, xpGrant: 60, resultCount: 1,
    recipe: [{ itemId: 'earth_crystal', count: 1 }, { itemId: 'rootvine_coil', count: 2 }, { itemId: 'amber_sap', count: 1 }],
  },
  water_infusion: {
    id: 'water_infusion', name: 'Water Infusion', tier: 2,
    minAlchemyLevel: 10, manaCost: 25, xpGrant: 60, resultCount: 1,
    recipe: [{ itemId: 'water_crystal', count: 1 }, { itemId: 'tidepetal_bloom', count: 2 }, { itemId: 'amber_sap', count: 1 }],
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

/**
 * ── ★ THE FOUR ELEMENTAL INFUSIONS — WHICH BREW CARRIES WHICH ELEMENT ─────────────────────────
 *
 * Canon (`game/alchemy.md`, RULED 2026-07-30) makes the Infusions the spine of alchemy: four
 * first-class brews, one per element, fed by the four element herbs, and **the only road to an
 * evolved form** — a spirit's second form is set at level 34 by its dominant infusion, so these
 * four recipes are the gate in front of all forty ruled second forms. `game/shimmer-skilling.md`
 * names each element's **catalyst crystal** (Violet/Storm/Earth/Water) and Amber Sap as the key
 * infusion ingredient. Canon owns THAT they exist, which element each carries, and what feeds
 * them; the counts, level gate, mana and XP below are Jin's.
 *
 * ★★ AND IT LIVES OUT HERE FOR THE REASON SLICE ① LEARNED THE HARD WAY. `save-map/route.ts` does
 * not patch `POTION_DEFS` — it **rebuilds the whole block** from a fixed field list
 * (id/name/tier/minAlchemyLevel/manaCost/xpGrant/resultCount/recipe) and regenerates its comments
 * from a tier table. An `infusionElement` field hung on `PotionDef` would be **deleted by the first
 * save from the Alchemy editor**, silently, with no error — which is exactly how `bloomsSpirit`
 * nearly took the opening of the game with it. A canon mapping must never sit inside a block a
 * tuning editor rewrites. Same answer as `ELEMENT_HERBS` living outside `CROP_DEFS`.
 *
 * ★ KEYED BY ELEMENT, not by potion id, so `Record<Exclude<Element, 'base'>, …>` cannot compile
 * with one missing. A missing element is the failure that matters and it is silent: nothing grants
 * that element, `dominantInfusion()` never returns it, and the ten second forms behind it are
 * unreachable while the other three work perfectly. A keeper reads that as *"Earth spirits just
 * don't seem to evolve."*
 *
 * ⚠ ALL FOUR ARE PEERS ON PURPOSE — same level, mana, XP, yield and recipe shape, exactly like the
 * herbs that feed them. A cheaper infusion would be a cheaper ELEMENT, and the element decides
 * which of four ruled second forms a spirit becomes. Pricing them differently is a tuning dial
 * reaching through into forty canon forms.
 *
 * ⚠ POTENCY IS NOT BUILT. Canon rules ingredient quality → potency → evolution speed; there is no
 * ingredient-quality axis in the build yet, so these ship as one grade each. That is scope, not a
 * contradiction — the quality tier is additive when it comes.
 */
export const INFUSION_BREWS: Record<Exclude<Element, 'base'>, string> = {
  mana:  'mana_infusion',
  storm: 'storm_infusion',
  earth: 'earth_infusion',
  water: 'water_infusion',
}

/**
 * The element an infusion brew grants, or null for an ordinary potion.
 *
 * ⚠ Asked of `INFUSION_BREWS`, never of the id's spelling. `ather_infusion` is a tier-4 player buff
 * that has nothing to do with the elemental spine, and any rule that reads "…_infusion" would sweep
 * it in and hand spirits an element canon never ruled.
 */
export function elementForInfusion(potionId: string): Exclude<Element, 'base'> | null {
  for (const [el, id] of Object.entries(INFUSION_BREWS) as [Exclude<Element, 'base'>, string][]) {
    if (id === potionId) return el
  }
  return null
}

/**
 * ── ★★ THE APPLICATION SITE — #262 slice ③, 2026-08-18 ──────────────────────────────────────────
 *
 * Pouring one infusion into one spirit. Until this function existed `addInfusion()` had **zero
 * callers**, which `game/alchemy.md` (RULED 2026-07-30) identified as the reason **no spirit in the
 * game could evolve**: a spirit's second form is set at level 34 by its DOMINANT infusion, `element`
 * was written `'base'` at creation and never written again, so `dominantInfusion()` returned null
 * forever and all forty ruled second forms were unreachable. The brews existed (slice ②), the herbs
 * existed (slice ①), and the middle was missing.
 *
 * ★★ THE ORDER IS THE WHOLE FUNCTION: ASK FIRST, SPEND SECOND. `addInfusion` refuses at the caps
 * (11 total, 9 per element) and returns false. Consuming the bottle and *then* discovering the
 * refusal destroys a tier-2 brew — four gathered ingredients and a farming cycle — for nothing, and
 * it would look exactly like a UI that "sometimes doesn't register". Nothing is removed from the
 * bag on any path that does not also add a point.
 *
 * ⚠ NO LEVEL GATE, AND THAT IS THE DESIGN. Infusing is how a keeper STEERS which of four ruled
 * forms their spirit becomes; the level-34 threshold is when the world reads the ledger, not when
 * you may write to it. Gating application behind 34 would mean the choice is made after it is
 * announced — which is the same inversion `EvolutionOverlay` currently embodies and slice ④ fixes.
 *
 * ⚠ NAMED `applyInfusion`, NOT `useInfusion`. In a React tree a `useX` free function reads as a
 * hook to every human and to the rules-of-hooks lint, and this one is called from an event handler
 * inside a component — the exact shape the rule exists to forbid. The verb was never worth the
 * ambiguity.
 *
 * ⚠ THE REFUSALS ARE TYPED, NOT A BARE BOOLEAN, because the four mean genuinely different things to
 * a keeper — "you have none", "this one is full of storm", "this one has taken all it can hold" and
 * "that is not an infusion" are four different sentences, and a false that means all of them is how
 * a panel ends up saying nothing at all.
 */
export type InfusionResult =
  | { ok: true; element: Exclude<Element, 'base'>; total: number; inElement: number }
  | { ok: false; reason: 'not-an-infusion' | 'none-in-bag' | 'element-full' | 'spirit-full' }

export function applyInfusion(inv: Inventory, spirit: Spirit, potionId: string): InfusionResult {
  const element = elementForInfusion(potionId)
  if (!element) return { ok: false, reason: 'not-an-infusion' }
  if (countItem(inv, potionId) < 1) return { ok: false, reason: 'none-in-bag' }
  // ⚠ Asked BEFORE the bottle is spent — see the header. The two caps are distinguished here rather
  // than inside `addInfusion` because only the caller knows which element was aimed at.
  if (spirit.infusions[element] >= MAX_INFUSIONS_PER_ELEMENT) return { ok: false, reason: 'element-full' }
  if (infusionTotal(spirit.infusions) >= MAX_INFUSIONS_TOTAL) return { ok: false, reason: 'spirit-full' }
  if (!addInfusion(spirit.infusions, element)) return { ok: false, reason: 'spirit-full' }
  removeItems(inv, potionId, 1)
  return { ok: true, element, total: infusionTotal(spirit.infusions), inElement: spirit.infusions[element] }
}

/** Check if player can brew a potion (has materials, level, mana) */
export function canBrew(potionId: string, inv: Inventory, alchemyLevel: number, mana?: ManaPool, bank: BankState | null = null): boolean {
  const def = POTION_DEFS[potionId]
  if (!def) return false
  if (alchemyLevel < def.minAlchemyLevel) return false
  if (mana && mana.current < def.manaCost) return false
  return canAfford(inv, bank, def.recipe)
}

/** Brew a potion — consumes materials, drains mana, adds result, grants XP. Returns false on failure. */
/**
 * bonusYieldChance: the companion Sporebloom perk (Sporeling @15) — a chance for one extra draught.
 * Mirrors farming's bonusFindChance. 0 when no Alchemy companion is active.
 */
export function brewPotion(
  potionId: string,
  inv: Inventory,
  skills: SkillSet,
  mana: ManaPool,
  bonusYieldChance = 0,
  bank: BankState | null = null,   // trailing + optional: omitted = satchel only (Crucible / old callers)
): boolean {
  const def = POTION_DEFS[potionId]
  if (!def) return false
  if (skills.alchemy.level < def.minAlchemyLevel) return false
  // Affordability BEFORE draining mana, so a materials-short brew doesn't burn mana (the original
  // drained first; checking materials first is strictly friendlier and matches craftItem's order).
  if (!canAfford(inv, bank, def.recipe)) return false
  if (!drainMana(mana, def.manaCost)) return false

  spendMaterials(inv, bank, def.recipe)   // satchel-first then bank; cannot fail past canAfford
  let count = def.resultCount
  // Companion perk (Sporebloom @15) — the Sporeling's fungal read turns up one more draught.
  if (bonusYieldChance > 0 && Math.random() < bonusYieldChance) count += 1
  addItems(inv, potionId, count)
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
