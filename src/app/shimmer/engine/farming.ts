// Farming system — plant crops, grow over time, harvest for items + XP
// Canon: Gardening is a life skill. Levels 1-10 unlock all content, 11-99 is prestige.
// Mirrors alchemy.ts pattern: canPlantCrop/harvestCrop

import type { Element } from '../spirits/spirit'
import type { Inventory } from './inventory'
import type { SkillSet } from './skills'
import type { ManaPool } from './mana'
import { countItem, removeItems, addItems } from './inventory'
import { addSkillXP } from './skills'
import { drainMana } from './mana'

export interface CropDef {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4
  minFarmingLevel: number
  manaCost: number
  plantXp: number         // small XP on planting
  xpGrant: number         // main XP on harvest
  growthMs: number        // growth duration in ms
  seedItemId: string      // crop seed item ID
  yields: { itemId: string; count: number; chance: number }[]
  yieldBonusPerLevel: number  // extra yield % per level above min (0.02 = 2%)
  /**
   * This crop blooms a SPIRIT rather than items. Only the Mana Seed does.
   *
   * A flag rather than a separate system because everything else about it is farming: it is planted
   * in a pot, it takes time, it is tended, it is read off `plantedCrops`. Only the payout differs,
   * so only the payout branches.
   */
  bloomsSpirit?: boolean
}

export interface PlantedCrop {
  id: string
  cropId: string
  tileX: number
  tileY: number
  zoneId: string
  plantedAt: number       // Date.now()
  growthDuration: number  // ms, copied from CropDef
}

export type CropGrowthPhase = 0 | 1 | 2 | 3  // seed | sprout | growth | ready

// ============================================
// Crop definitions — 10 crops across 4 tiers
// ============================================

/**
 * The ten species a Mana Seed can bloom into, at 1/10 each.
 *
 * ⚠ CANON, NOT A BALANCE KNOB (`CANON/game/shimmer-quests-mainmap.md`): *"Greg gifts a single Mana
 * Seed; it blooms into one of the 10 species at random (1/10 each). The player does not choose."*
 * The flatness is the point — "the spirit chooses you" runs all the way down, so weighting these,
 * or letting the player pick, contradicts the world rather than tuning it. All bloom dialogue is
 * species-neutral for the same reason.
 */
export const BLOOM_SPECIES = [
  'fox', 'axolotl', 'owl', 'frog', 'bat', 'rabbit', 'turtle', 'firefly', 'hummingbird', 'water-bear',
] as const

export type BloomSpecies = (typeof BLOOM_SPECIES)[number]

/** Roll what grows. `rng` is injectable so a test can pin the species. */
export const rollBloomSpecies = (rng: () => number = Math.random): BloomSpecies =>
  BLOOM_SPECIES[Math.min(BLOOM_SPECIES.length - 1, Math.floor(rng() * BLOOM_SPECIES.length))]

/** The seed item Greg gifts, and the id of what it grows. */
export const MANA_SEED_ITEM = 'mana_seed'
export const MANA_BLOOM_CROP = 'manabloom'

export const CROP_DEFS: Record<string, CropDef> = {
  // ── The Mana Seed — the start of the whole game ────────────────────────────────────────────
  // "A Mana Seed. It rode the wind in from far off, the way they all do. Plant it, tend it, and
  // something will choose to grow." (Greg, CANON/game/shimmer-quests-mainmap.md)
  //
  // manaCost 0 and minFarmingLevel 1 deliberately: this is a GIFT to someone who has never played,
  // and a first spirit gated behind a resource they do not have yet would strand them at the exact
  // moment the game is supposed to open up. It costs patience, nothing else.
  manabloom: {
    id: MANA_BLOOM_CROP, name: 'Mana Seed', tier: 1,
    minFarmingLevel: 1, manaCost: 0, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: MANA_SEED_ITEM, yieldBonusPerLevel: 0,
    yields: [],            // it pays out a spirit, not items — see `bloomsSpirit`
    bloomsSpirit: true,
  },

  // Tier 1 — Beginner
  shimmerwheat: {
    id: 'shimmerwheat', name: 'Shimmerwheat', tier: 1,
    minFarmingLevel: 1, manaCost: 3, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: 'seed_shimmerwheat', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'shimmerwheat_grain', count: 2, chance: 1.0 }],
  },
  glowroot: {
    id: 'glowroot', name: 'Glowroot', tier: 1,
    minFarmingLevel: 1, manaCost: 3, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: 'seed_glowroot', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'glowroot_bulb', count: 2, chance: 1.0 }],
  },
  sunpetal: {
    id: 'sunpetal', name: 'Sunpetal', tier: 1,
    minFarmingLevel: 3, manaCost: 4, plantXp: 8, xpGrant: 28, growthMs: 6 * 60 * 1000,
    seedItemId: 'seed_sunpetal', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'sunpetal_bloom', count: 1, chance: 1.0 }],
  },

  // Tier 2 — Intermediate
  moonvine: {
    id: 'moonvine', name: 'Moonvine', tier: 2,
    minFarmingLevel: 5, manaCost: 5, plantXp: 12, xpGrant: 40, growthMs: 8 * 60 * 1000,
    seedItemId: 'seed_moonvine', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'moonvine_leaf', count: 2, chance: 1.0 }],
  },
  crystalcap: {
    id: 'crystalcap', name: 'Crystalcap', tier: 2,
    minFarmingLevel: 7, manaCost: 6, plantXp: 15, xpGrant: 50, growthMs: 10 * 60 * 1000,
    seedItemId: 'seed_crystalcap', yieldBonusPerLevel: 0.03,
    yields: [
      { itemId: 'crystalcap_spore', count: 1, chance: 1.0 },
      { itemId: 'pure_mana_core', count: 1, chance: 0.1 },
    ],
  },
  starbean: {
    id: 'starbean', name: 'Starbean', tier: 2,
    minFarmingLevel: 8, manaCost: 5, plantXp: 14, xpGrant: 45, growthMs: 10 * 60 * 1000,
    seedItemId: 'seed_starbean', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'starbean_pod', count: 2, chance: 1.0 }],
  },

  // ── The four element herbs — the ingredient half of the infusion economy ──────────────────
  // CANON (`CANON/game/alchemy.md`, ruled 2026-07-30 · `game/shimmer-skilling.md` › Tier 2):
  // Violetbloom (Mana) · Stormgrass (Storm) · Rootvine (Earth) · Tidepetal (Water) feed the four
  // Infusions, and the Infusions are the ONLY road to an evolved form. Canon owns that these four
  // exist, which element each carries, and their growth times (20/20/25/20 min — Rootvine "anchors
  // deep. Heavy to harvest."). Level gates, mana cost, XP and yield counts are Jin's.
  //
  // ⚠ ALL FOUR SHARE ONE LEVEL, MANA COST AND YIELD ON PURPOSE. The four elements are peers: a
  // keeper who can reach Storm can reach Water on the same day. Make one herb cheaper and you have
  // silently ruled that its element is the default evolution path for every spirit in the game —
  // a balance dial reaching through into forty canon second forms.
  //
  // yields 2 because one canon Infusion recipe costs herb ×2 — one harvest, one infusion.
  violetbloom: {
    id: 'violetbloom', name: 'Violetbloom', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 20 * 60 * 1000,
    seedItemId: 'seed_violetbloom', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'violetbloom_petal', count: 2, chance: 1.0 }],
  },
  stormgrass: {
    id: 'stormgrass', name: 'Stormgrass', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 20 * 60 * 1000,
    seedItemId: 'seed_stormgrass', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'stormgrass_blade', count: 2, chance: 1.0 }],
  },
  rootvine: {
    id: 'rootvine', name: 'Rootvine', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 60, growthMs: 25 * 60 * 1000,
    seedItemId: 'seed_rootvine', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'rootvine_coil', count: 2, chance: 1.0 }],
  },
  tidepetal: {
    id: 'tidepetal', name: 'Tidepetal', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 20 * 60 * 1000,
    seedItemId: 'seed_tidepetal', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'tidepetal_bloom', count: 2, chance: 1.0 }],
  },

  // Tier 3 — Advanced
  dreamroot: {
    id: 'dreamroot', name: 'Dreamroot', tier: 3,
    minFarmingLevel: 12, manaCost: 8, plantXp: 22, xpGrant: 80, growthMs: 14 * 60 * 1000,
    seedItemId: 'seed_dreamroot', yieldBonusPerLevel: 0.04,
    yields: [{ itemId: 'dreamroot_essence', count: 1, chance: 1.0 }],
  },
  shimmerbloom: {
    id: 'shimmerbloom', name: 'Shimmerbloom', tier: 3,
    minFarmingLevel: 15, manaCost: 10, plantXp: 28, xpGrant: 100, growthMs: 16 * 60 * 1000,
    seedItemId: 'seed_shimmerbloom', yieldBonusPerLevel: 0.04,
    yields: [
      { itemId: 'shimmerbloom_petal', count: 1, chance: 1.0 },
      { itemId: 'shimmer_dust', count: 1, chance: 0.15 },
    ],
  },

  // Tier 4 — Master
  atherwheat: {
    id: 'atherwheat', name: 'Atherwheat', tier: 4,
    minFarmingLevel: 20, manaCost: 12, plantXp: 35, xpGrant: 150, growthMs: 18 * 60 * 1000,
    seedItemId: 'seed_atherwheat', yieldBonusPerLevel: 0.05,
    yields: [
      { itemId: 'atherwheat_grain', count: 1, chance: 1.0 },
      { itemId: 'ather_crystal', count: 1, chance: 0.05 },
    ],
  },
  dawncap: {
    id: 'dawncap', name: 'Dawncap', tier: 4,
    minFarmingLevel: 25, manaCost: 14, plantXp: 40, xpGrant: 200, growthMs: 20 * 60 * 1000,
    seedItemId: 'seed_dawncap', yieldBonusPerLevel: 0.05,
    yields: [
      { itemId: 'dawncap_spore', count: 2, chance: 1.0 },
      { itemId: 'crystallized_sap', count: 1, chance: 0.1 },
    ],
  },
}

export const CROP_IDS = Object.keys(CROP_DEFS)

/**
 * Which herb carries which element — the canon half of the infusion economy.
 *
 * ⚠ THIS LIVES OUTSIDE `CROP_DEFS` DELIBERATELY, AND THE REASON IS A LIVE TRAP. The Farming
 * editor's save route (`save-map/route.ts`) does not patch `CROP_DEFS`; it REBUILDS the whole block
 * from a fixed list of fields. Any field it does not serialize is deleted the next time somebody
 * saves a tuning change — silently, in a file nobody re-reads. A canon mapping must not sit in a
 * block a tuning editor rewrites.
 *
 * Keyed by element rather than by crop so the type system enforces what the gate also checks:
 * `Record<Exclude<Element, 'base'>, ...>` cannot compile with an element missing, and a missing
 * element is the failure that matters — it makes ten canon second forms unreachable while
 * everything still runs.
 */
export const ELEMENT_HERBS: Record<Exclude<Element, 'base'>, { cropId: string; harvestItemId: string }> = {
  mana:  { cropId: 'violetbloom', harvestItemId: 'violetbloom_petal' },
  storm: { cropId: 'stormgrass',  harvestItemId: 'stormgrass_blade' },
  earth: { cropId: 'rootvine',    harvestItemId: 'rootvine_coil' },
  water: { cropId: 'tidepetal',   harvestItemId: 'tidepetal_bloom' },
}

/** The element an element-herb harvest item carries, or null if it is an ordinary crop. */
export function elementForHerbItem(itemId: string): Exclude<Element, 'base'> | null {
  for (const [el, h] of Object.entries(ELEMENT_HERBS) as [Exclude<Element, 'base'>, { harvestItemId: string }][]) {
    if (h.harvestItemId === itemId) return el
  }
  return null
}

/** Get growth phase of a planted crop (0-3) */
export function getCropGrowthPhase(crop: PlantedCrop): CropGrowthPhase {
  const progress = Math.min(1, (Date.now() - crop.plantedAt) / crop.growthDuration)
  if (progress < 0.25) return 0
  if (progress < 0.5) return 1
  if (progress < 0.75) return 2
  return 3
}

/** Check if a crop is fully grown and ready to harvest */
export function isCropReady(crop: PlantedCrop): boolean {
  return Date.now() - crop.plantedAt >= crop.growthDuration
}

/** Check if player can plant a crop (has seed, level, mana) */
export function canPlantCrop(cropId: string, inv: Inventory, farmingLevel: number, mana?: ManaPool): boolean {
  const def = CROP_DEFS[cropId]
  if (!def) return false
  if (farmingLevel < def.minFarmingLevel) return false
  if (mana && mana.current < def.manaCost) return false
  return countItem(inv, def.seedItemId) > 0
}

/** Plant a crop — consumes seed + mana, grants small planting XP. Returns PlantedCrop or null. */
export function plantCrop(
  cropId: string, inv: Inventory, skills: SkillSet, mana: ManaPool,
  tileX: number, tileY: number, zoneId: string,
): PlantedCrop | null {
  const def = CROP_DEFS[cropId]
  if (!def) return null
  if (skills.farming.level < def.minFarmingLevel) return null
  if (!drainMana(mana, def.manaCost)) return null
  if (countItem(inv, def.seedItemId) < 1) return null

  removeItems(inv, def.seedItemId, 1)
  addSkillXP(skills.farming, def.plantXp)

  return {
    id: `crop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cropId,
    tileX, tileY, zoneId,
    plantedAt: Date.now(),
    growthDuration: def.growthMs,
  }
}

export interface HarvestCropResult {
  items: { itemId: string; count: number }[]
  xpGained: number
  /**
   * Set when a Mana Seed bloomed — the species that chose the keeper.
   *
   * The engine decides WHAT grew and stops there; adding it to the party is the caller's job,
   * because a party is game state and this module is pure. Same boundary as everything else here.
   */
  bloomed?: BloomSpecies
}

/**
 * Harvest a ready crop — rolls yields with level bonus, adds items, grants farming XP.
 * bonusFindChance: companion Tuberfind perk (Dustwhisker @15) — a chance for one bonus crop.
 */
export function harvestCrop(crop: PlantedCrop, inv: Inventory, skills: SkillSet, bonusFindChance = 0, xpMult = 1): HarvestCropResult {
  const def = CROP_DEFS[crop.cropId]
  if (!def) return { items: [], xpGained: 0 }

  // A Mana Seed pays out a spirit. It takes the same farming XP as any tier-1 crop — tending it was
  // still tending — but yields nothing to a satchel, so it returns before the roll loop.
  if (def.bloomsSpirit) {
    const xpBloom = Math.round(def.xpGrant * xpMult)
    addSkillXP(skills.farming, xpBloom)
    return { items: [], xpGained: xpBloom, bloomed: rollBloomSpecies() }
  }

  const levelAboveMin = Math.max(0, skills.farming.level - def.minFarmingLevel)
  const yieldMult = 1 + levelAboveMin * def.yieldBonusPerLevel

  const items: { itemId: string; count: number }[] = []
  for (const y of def.yields) {
    if (Math.random() < y.chance) {
      let count = Math.max(1, Math.round(y.count * yieldMult))
      // Companion perk (Tuberfind @15) — a chance for a bonus crop on top.
      if (bonusFindChance > 0 && Math.random() < bonusFindChance) count += 1
      addItems(inv, y.itemId, count)
      items.push({ itemId: y.itemId, count })
    }
  }

  const xp = Math.round(def.xpGrant * xpMult)
  addSkillXP(skills.farming, xp)
  return { items, xpGained: xp }
}

/** Get crops visible to the player (within 3 levels of farming level) */
export function getVisibleCrops(farmingLevel: number): CropDef[] {
  return CROP_IDS
    .map(id => CROP_DEFS[id])
    .filter(def => def.minFarmingLevel <= farmingLevel + 3)
    .sort((a, b) => a.minFarmingLevel - b.minFarmingLevel || a.tier - b.tier)
}

/** Find which cropId a seed item plants */
export function cropForSeed(seedItemId: string): string | null {
  for (const def of Object.values(CROP_DEFS)) {
    if (def.seedItemId === seedItemId) return def.id
  }
  return null
}

// Save/load
export function plantedCropsToSave(crops: PlantedCrop[]): PlantedCrop[] {
  return crops.map(c => ({ ...c }))
}

export function plantedCropsFromSave(saved: PlantedCrop[]): PlantedCrop[] {
  return saved.map(c => ({ ...c }))
}
