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
// ★ THE ROSTER LIVES IN THE VOXEL CORE (`voxel/crops.ts`) — see that file's header for why. This
// file keeps everything you DO with a crop, because that needs Inventory/SkillSet/ManaPool, which
// are host-side. Imported back and re-exported, so every caller of this module is unchanged and
// there is exactly one definition of each.
import {
  CropDef, CROP_DEFS, CROP_IDS, ELEMENT_HERBS, MANA_SEED_ITEM, MANA_BLOOM_CROP, type HerbElement,
} from '../voxel/crops'
export { CROP_DEFS, CROP_IDS, ELEMENT_HERBS, MANA_SEED_ITEM, MANA_BLOOM_CROP }
export type { CropDef, HerbElement }

/**
 * ★ THE PIN THAT KEEPS THE MOVE HONEST. `voxel/crops.ts` cannot import canon's `Element` (the core
 * may not depend upward), so it declares `HerbElement` itself. This assertion is what stops the two
 * from drifting: it fails to compile the day canon gains or renames an element, which is exactly the
 * failure the old `Record<Exclude<Element, 'base'>, ...>` typing existed to produce. Without it the
 * move would have quietly traded a compile-time guarantee for a comment.
 */
type _HerbElementIsCanon =
  HerbElement extends Exclude<Element, 'base'>
    ? Exclude<Element, 'base'> extends HerbElement ? true
    : ['HerbElement is missing an element canon has', Exclude<Element, 'base'>]
    : ['HerbElement names an element canon does not have', HerbElement]
const _herbElementPin: _HerbElementIsCanon = true
void _herbElementPin


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
