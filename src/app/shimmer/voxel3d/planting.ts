// Putting a seed in a bed, and taking the crop back out. The voxel world's half of farming.
//
// ★ PURE. No react/three/DOM. `engine/farming.ts` owns what a crop IS — canon's ten-crop roster,
// growth durations, yields, the XP — and already does the planting and harvesting. This file owns
// the one question the voxel world has to answer at the block: *given this bed, this bag and this
// keeper, what does pressing plant do, and if nothing, what sentence does the panel say?*
//
// Same split as `voxel3d/brew.ts` over `engine/alchemy.ts`, for the same reason: the engine is
// shared with play3d, which has tilled soil, a farm zone and an Exchange Booth. This world has beds
// a keeper crafted and put down. The engine should not learn the difference.
//
// ── ★★ A CROP IS KEYED TO A VOXEL, AND THE ENGINE'S KEY DOES NOT FIT ───────────────────────────
// `PlantedCrop` carries `tileX`/`tileY`/`zoneId`, which is play3d's flat tile grid. A voxel bed has
// three coordinates and a keeper can stack beds on a terrace, so `tileX`/`tileY` alone would collide
// two beds at the same x/z on different levels — silently, by overwriting one crop with another.
//
// ⚠ THE MAPPING IS DELIBERATELY LOSSLESS AND IT LIVES HERE, NOT IN THE ENGINE. `y` goes into
// `zoneId` as `bed:<y>`, so every field keeps a real value and nothing downstream has to know. The
// alternative — widening `PlantedCrop` with a `z` — would edit a type play3d relies on to buy
// nothing that this file cannot do on its own.
import {
  CROP_DEFS, harvestCrop, getCropGrowthPhase, isCropReady, cropForSeed,
  type PlantedCrop, type CropGrowthPhase, type HarvestCropResult,
} from '../engine/farming'
import type { Inventory } from '../engine/inventory'
import { countItem } from '../engine/inventory'
import { addSkillXP, type SkillSet } from '../engine/skills'
import { removeItems } from '../engine/inventory'

/** One bed's address. The only key anything here uses. */
export const bedKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

/** Every crop a keeper has in the ground, by bed. */
export type PlantedBeds = Map<string, PlantedCrop>

/** The zone id a voxel bed's crop carries — see the header for why `y` rides here. */
export const bedZoneId = (y: number): string => `bed:${y}`

/**
 * Why a seed will not go in, or `'ok'`.
 *
 * ⚠ TYPED, NOT BOOLEAN — the fourth time this build has needed the lesson (`applyInfusion`,
 * `brewBlocker`, `evolutionBlocker`, `placeBedBlocker`). "that bed is taken", "you are not holding a
 * seed" and "farming 12 grows dreamroot" are three different things to do next, and a `false` that
 * means all three is how a keeper decides the bed is broken.
 */
export type PlantRefusal = 'ok' | 'occupied' | 'not-a-seed' | 'none-in-bag' | 'level' | 'mana'

export function plantBlocker(
  beds: PlantedBeds, x: number, y: number, z: number,
  seedItemId: string, inv: Inventory, skills: SkillSet, manaCur: number,
): PlantRefusal {
  if (beds.has(bedKey(x, y, z))) return 'occupied'
  const cropId = cropForSeed(seedItemId)
  if (!cropId) return 'not-a-seed'
  if (countItem(inv, seedItemId) < 1) return 'none-in-bag'
  const def = CROP_DEFS[cropId]
  if (skills.farming.level < def.minFarmingLevel) return 'level'
  // ⚠⚠ A PLAIN NUMBER, NOT A POOL — and this is the second correction on this one line. It first
  // read `mana.cur`, which is not a field on the engine's `ManaPool` (`undefined < 3` is false, so
  // the gate never refused). Fixing it to `mana.current` then failed to compile against the HOST,
  // which keeps its own `{ cur, max, regen }` and is not the engine's pool at all.
  //
  // ★ TWO MANA MODELS EXIST AND NEITHER IS WRONG, so this file refuses to pick one: it takes the
  // number. `doBrew` reached the same conclusion first and says so — it deliberately does NOT call
  // `engine/alchemy.brewPotion`, because the host owns the spend and the engine owns the
  // definitions. Following that precedent rather than inventing a second bridge.
  if (manaCur < def.manaCost) return 'mana'
  return 'ok'
}

/**
 * One sentence for the keeper, kept beside the refusal so a new refusal cannot ship without one.
 *
 * ⚠ `potionEffectLine` returned `null` for four brews and a template literal rendered it as the
 * literal word "null" in the hotbar. Every branch here returns a string.
 */
export function plantRefusalLine(why: PlantRefusal, seedItemId: string, skills: SkillSet): string {
  const def = CROP_DEFS[cropForSeed(seedItemId) ?? '']
  switch (why) {
    case 'ok': return ''
    case 'occupied': return 'something is already growing there'
    case 'not-a-seed': return 'that is not a seed'
    case 'none-in-bag': return 'no seed of that kind in your bag'
    case 'level': return `${def?.name ?? 'that crop'} wants farming ${def?.minFarmingLevel} — you are ${skills.farming.level}`
    case 'mana': return `not enough mana to coax it — ${def?.manaCost ?? '?'} needed`
  }
}

/**
 * Put a seed in. Returns the crop, or null if anything refused.
 *
 * ★★ ASK FIRST, SPEND SECOND — the rule `applyInfusion` paid for. `plantCrop` drains mana BEFORE it
 * checks the seed is in the bag, so calling it on a bad plant burns mana for nothing and reads as
 * *"the bed sometimes doesn't work"*. Asking `plantBlocker` first means nothing leaves the keeper on
 * any path that does not also put a crop in the ground.
 *
 * ⚠ ASKED THROUGH `plantBlocker`, never re-deriving the conditions. Two copies of "may this happen"
 * is how a UI offers what the engine then refuses — and this build has now made that mistake twice
 * in one day, once in a comment warning against it.
 */
export function plantInBed(
  beds: PlantedBeds, x: number, y: number, z: number,
  seedItemId: string, inv: Inventory, skills: SkillSet, manaCur: number,
  drain: (cost: number) => void, now: () => number = Date.now,
): PlantedCrop | null {
  if (plantBlocker(beds, x, y, z, seedItemId, inv, skills, manaCur) !== 'ok') return null
  const def = CROP_DEFS[cropForSeed(seedItemId)!]

  // ★★ THE SPEND IS ATOMIC AND IT HAPPENS HERE, AFTER THE ONLY GATE. `engine/farming.plantCrop`
  // drains mana on its third line and checks the bag on its fourth, so a plant it refuses has
  // already cost the keeper — which reads as *"the bed sometimes doesn't work"*. `doBrew` declined
  // to call the engine's equivalent for the same reason and wrote down why.
  //
  // ⚠ `drain` IS A CALLBACK RATHER THAN A POOL because the host's mana is `{ cur, max, regen }` and
  // the engine's is `{ current, channeling, manaSpent }`. A callback lets the spend stay inside this
  // function — where it cannot be forgotten — without this file having to know which model it is
  // talking to, or a caller having to remember to deduct afterwards.
  removeItems(inv, seedItemId, 1)
  drain(def.manaCost)
  addSkillXP(skills.farming, def.plantXp)

  const crop: PlantedCrop = {
    id: `bed-${x},${y},${z}`,
    cropId: def.id,
    tileX: x, tileY: z, zoneId: bedZoneId(y),
    plantedAt: now(),
    growthDuration: def.growthMs,
  }
  beds.set(bedKey(x, y, z), crop)
  return crop
}

/** What is growing in this bed, if anything. */
export const cropAt = (beds: PlantedBeds, x: number, y: number, z: number): PlantedCrop | undefined =>
  beds.get(bedKey(x, y, z))

/** 0 seed · 1 sprout · 2 growth · 3 ready. `null` for an empty bed. */
export function phaseAt(beds: PlantedBeds, x: number, y: number, z: number): CropGrowthPhase | null {
  const crop = cropAt(beds, x, y, z)
  return crop ? getCropGrowthPhase(crop) : null
}

/** Whether this bed is ready to pick. */
export function readyAt(beds: PlantedBeds, x: number, y: number, z: number): boolean {
  const crop = cropAt(beds, x, y, z)
  return crop ? isCropReady(crop) : false
}

/**
 * Take the crop. Returns what was gained, or null if there was nothing ready.
 *
 * ★ THE BED EMPTIES ONLY ON A SUCCESSFUL HARVEST. An unripe pick must leave the crop exactly where
 * it was — the failure that would otherwise destroy a keeper's twenty-five minute dawncap with one
 * mistimed click, silently, with no way to tell it apart from a harvest that yielded nothing.
 */
export function harvestBed(
  beds: PlantedBeds, x: number, y: number, z: number, inv: Inventory, skills: SkillSet,
): HarvestCropResult | null {
  const key = bedKey(x, y, z)
  const crop = beds.get(key)
  if (!crop || !isCropReady(crop)) return null
  const result = harvestCrop(crop, inv, skills)
  beds.delete(key)
  return result
}

/**
 * Forget a bed's crop — the bed itself was destroyed.
 *
 * ⚠ THE HOST MUST CALL THIS, AND FORGETTING TO IS A LEAK THAT LOOKS LIKE A BUG LATER. A crop record
 * outliving its bed means the key is occupied forever: place a new bed on the same voxel and it
 * refuses every seed with *"something is already growing there"*, pointing at nothing. Returns
 * whether anything was actually cleared so a caller can be tested for it.
 */
export const clearBed = (beds: PlantedBeds, x: number, y: number, z: number): boolean =>
  beds.delete(bedKey(x, y, z))

// ── serialisation ────────────────────────────────────────────────────────────────────────────
/**
 * ★ SAVED AS A PLAIN ARRAY, KEY REBUILT ON LOAD. A Map does not survive JSON, and storing the key as
 * a string alongside the crop would make the same fact true in two places — the crop already knows
 * its own x/z/zone, so the key is derivable and a stored one could disagree with it.
 */
export const bedsToSave = (beds: PlantedBeds): PlantedCrop[] => [...beds.values()]

export function bedsFromSave(saved: PlantedCrop[] | undefined | null): PlantedBeds {
  const beds: PlantedBeds = new Map()
  for (const crop of saved ?? []) {
    // ⚠ A SAVE FROM A DIFFERENT SURFACE MUST NOT LAND HERE. play3d writes crops with real zone ids
    // ("r-home-plot"); a voxel bed's zone is always `bed:<y>`. Without this a shared save would put
    // farm-zone crops into voxel beds at coordinates that mean something else entirely.
    const y = Number(crop.zoneId?.startsWith('bed:') ? crop.zoneId.slice(4) : NaN)
    if (!Number.isFinite(y)) continue
    beds.set(bedKey(crop.tileX, y, crop.tileY), crop)
  }
  return beds
}
