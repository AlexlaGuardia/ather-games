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
import { isPrimeSeed, baseSeedId, primeSeedId, primeSeedChance, primeSeedsBack, primeYield } from './seed-quality'
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
  /**
   * Grown from a PRIME seed (`seed-quality.ts`). Optional so every save written before the prime
   * line existed loads unchanged and reads as an ordinary planting, which it was.
   */
  prime?: boolean
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
  /** Which seed to spend — a prime one or the ordinary one. Defaults to the crop's ordinary seed,
   *  so every existing caller keeps its exact behaviour. */
  usedSeedItemId?: string,
): PlantedCrop | null {
  const def = CROP_DEFS[cropId]
  if (!def) return null
  if (skills.farming.level < def.minFarmingLevel) return null
  if (!drainMana(mana, def.manaCost)) return null
  // ★ THE SEED THE KEEPER CHOSE, not the crop's default — a prime seed and an ordinary one plant
  // the same crop, and which was spent is the whole difference in what the bed pays back.
  const seedId = usedSeedItemId ?? def.seedItemId
  if (baseSeedId(seedId) !== def.seedItemId) return null
  if (countItem(inv, seedId) < 1) return null

  removeItems(inv, seedId, 1)
  addSkillXP(skills.farming, def.plantXp)

  return {
    id: `crop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cropId,
    tileX, tileY, zoneId,
    ...(isPrimeSeed(seedId) ? { prime: true } : {}),
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

// ── ★ THE SEED COMES BACK (2026-09-18, Alex: "how the player can go about getting more seeds") ──
// Before this a keeper's own harvest returned NO seed: every planting spent one and the bed paid
// out produce only, so a farm was a seed SINK fed by cutting grass (1/12 a tuft, tier 1 only) and
// by finding wild plants (25%). The loop could not close on itself — and the sown-bed sign made it
// visible: you could see exactly which seed you were about to lose.
//
// Canon's own reason says the fix: all Ather plant life is one fungal body (`world/flora.md`), and
// a tuft handing over a wheat seed is *"one body fruiting twice"* (`meadow-seed.ts`). A ripe crop
// fruiting its own seed again is the same fact one step closer. So: ONE seed back, always — the
// loop never dies on a bad roll — and a chance of a SECOND that grows with farming level past the
// crop's own, so a practised keeper's field expands and a novice's merely holds. Never for the
// Mana Bloom (it pays a spirit; canon mints those ceremonially). The wider question — a seed seller,
// a spirit that drops them — stays canon's open item (`shimmer-skilling.md` › Open Questions).
export const SEED_BACK_BASE = 1
/** Chance of the second seed at the crop's own level; +2% a level above it, capped. */
export const SEED_BACK_BONUS = 0.25
export const SEED_BACK_BONUS_PER_LEVEL = 0.02
export const SEED_BACK_BONUS_CAP = 0.6
export const seedBackBonusChance = (levelAboveMin: number): number =>
  Math.min(SEED_BACK_BONUS_CAP, SEED_BACK_BONUS + Math.max(0, levelAboveMin) * SEED_BACK_BONUS_PER_LEVEL)

/**
 * Harvest a ready crop — rolls yields with level bonus, adds items, grants farming XP, and hands
 * the crop's own seed back (see above). `roll` is injectable so the oracle can pin both branches.
 * bonusFindChance: companion Tuberfind perk (Dustwhisker @15) — a chance for one bonus crop.
 */
export function harvestCrop(
  crop: PlantedCrop, inv: Inventory, skills: SkillSet, bonusFindChance = 0, xpMult = 1,
  roll: () => number = Math.random,
  /** Was the bed FED when this was taken (`watering.ts`)? The prime line's only input — trailing
   *  and defaulting false so every existing caller and test keeps its behaviour exactly. */
  fed = false,
): HarvestCropResult {
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
    if (roll() < y.chance) {
      let count = Math.max(1, Math.round(y.count * yieldMult))
      // ★ A PRIME PLANTING IS FELT AS ABUNDANCE, not as a different item — see `PRIME_YIELD_MULT`
      // for why premium PRODUCE waits on the ingredient checks learning to accept it.
      if (crop.prime) count = primeYield(count)
      // Companion perk (Tuberfind @15) — a chance for a bonus crop on top.
      if (bonusFindChance > 0 && roll() < bonusFindChance) count += 1
      addItems(inv, y.itemId, count)
      items.push({ itemId: y.itemId, count })
    }
  }
  // The seed back — after the produce so the toast reads "2× goldleaf, 1× goldleaf seed".
  if (crop.prime) {
    // ── ★ A PRIME LINE BREEDS TRUE, AND ONLY GROWS IF IT IS FED (`seed-quality.ts`) ───────────
    // The kind is guaranteed (a line can never be lost to bad luck) and the COUNT is what tending
    // buys: unfed returns 1 and the line stays flat for ever, fed returns 2 and it multiplies.
    // Without that split, one prime seed would be prime for ever and tending would stop mattering.
    const primeId = primeSeedId(def.seedItemId)
    const n = primeSeedsBack(fed)
    addItems(inv, primeId, n)
    items.push({ itemId: primeId, count: n })
  } else {
    const seeds = SEED_BACK_BASE + (roll() < seedBackBonusChance(levelAboveMin) ? 1 : 0)
    addItems(inv, def.seedItemId, seeds)
    items.push({ itemId: def.seedItemId, count: seeds })
    // ★ AND THE LINE CAN BEGIN HERE: a FED ordinary crop may hand back a prime seed on top. Keyed
    // to feeding rather than to "how well tended" because a care fraction has no gradient in this
    // game — one pour covers a 5–16 minute crop's whole life. See `seed-quality.ts`'s header.
    if (roll() < primeSeedChance(fed, levelAboveMin)) {
      const primeId = primeSeedId(def.seedItemId)
      addItems(inv, primeId, 1)
      items.push({ itemId: primeId, count: 1 })
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
  // ★ A PRIME SEED PLANTS THE SAME CROP, so it resolves through its base. Every caller of this —
  // the sow intent, the seed check, the hotbar — then accepts a prime seed for free, which is the
  // point of carrying quality in the id rather than in a parallel table.
  const base = baseSeedId(seedItemId)
  for (const def of Object.values(CROP_DEFS)) {
    if (def.seedItemId === base) return def.id
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
