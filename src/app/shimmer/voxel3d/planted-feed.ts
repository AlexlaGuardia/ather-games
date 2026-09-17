// The planted feed — what the flora renderer draws ABOVE a garden bed, and when it changes.
//
// ★ PURE. No react/three/DOM. `flora-mesh.ts`'s CROP_HEAD header promised this file on 2026-08-22:
// *"the two feeds differ only in where the instances come from — a selection field for the wild, a
// bed Map for the planted."* The wild feed shipped that day. This one did not, and for 26 days a
// keeper who put a seed in a bed saw a flat dark-earth block until the text said "ready" — the
// growth was tracked, reported, and INVISIBLE. `FLORA_PARTS[CROP]`'s comment even described "the
// planted feed scales it per growth phase" as if it existed. A note about a thing that is not there.
//
// ── ★ WHAT A STAGE IS, AND WHY THERE ARE FIVE WHEN CANON LISTS FOUR ─────────────────────────────
// `game/shimmer-skilling.md` › Farming: *Planted (mound) · Sprout · Growing · Ready (full crop,
// sparkle hints)*, at 0 / 25 / 50 / 100%. The engine's `getCropGrowthPhase` cuts at 25 / 50 / 75 and
// calls its last phase 3 — but `isCropReady` is progress ≥ 100%, so engine phase 3 spans a quarter
// of the growth in which the crop is FULL-SIZED AND NOT READY. Drawing the ripe head there would
// send a keeper to a bed that refuses them ("not ready") for the last quarter of every crop. So the
// feed has one more stage than canon's table: `grown` (phase 3, no head) and `ripe` (ready — the
// head and the glint). The head IS the ripeness signal; CROP_HEAD's header says so.
//
// ── ★ ONE LOOK TABLE FOR FIFTEEN CROPS, DERIVED WHERE IT CAN BE ────────────────────────────────
// Eleven crops already have a wild material (seven crops, four element herbs) and their colours
// live in ONE place each (`MATERIAL_COLOR`, CROP_HEAD / HERB_TIP) — the feed hands the renderer
// the MATERIAL and lets it look the tint up exactly as it does for the wild plant, so a planted
// Atherwheat and a wild one cannot drift apart. Three crops (shimmerwheat, glowroot, sunpetal —
// the front-door seeds a tuft drops) have NO material anywhere: nothing wild grows them. Those get
// an explicit body/head pair here, off their item descriptions. Manabloom is the pot's, not a
// bed's, and is deliberately absent — `plantedLook` returns null and the guard test pins which.
import { CROP_DEFS, CROP_IDS, MANA_BLOOM_CROP } from '../voxel/crops'
import { CROP_ID_OF_MAT } from '../voxel/flora'
import { MAT } from '../voxel/depth'
import { getCropGrowthPhase, isCropReady, type PlantedCrop } from '../engine/farming'
import type { PlantedBeds } from './planting'

/** mound · sprout · growing · grown · ripe. See the header for why five. */
export type PlantedStage = 0 | 1 | 2 | 3 | 4
export const STAGE_RIPE: PlantedStage = 4

/**
 * Height scale per stage, applied to the unit-height crop / herb geometry. The mound is a nub —
 * enough that a planted bed reads as OCCUPIED from a few blocks off, not enough to look like a
 * plant. Monotonic, and the ripe crop is the grown crop's size: ripeness adds the head, not height.
 */
export const STAGE_GROW: Readonly<Record<PlantedStage, number>> = { 0: 0.16, 1: 0.4, 2: 0.7, 3: 1.0, 4: 1.0 }

/** Which instanced pool draws the crop, and where its tints come from. */
export interface PlantedLook {
  pool: 'crop' | 'herb'
  /** The wild material whose tints the renderer already knows; 0 for a crop nothing wild grows. */
  mat: number
  /** Explicit tints, only for the mat-less three. */
  body?: number
  head?: number
}

/** The four element herbs' materials by crop id — `flora.ts` keys them by GROUND, not by crop. */
export const HERB_MAT_OF_CROP: Readonly<Record<string, number>> = {
  violetbloom: MAT.VIOLETBLOOM,
  stormgrass: MAT.STORMGRASS,
  rootvine: MAT.ROOTVINE,
  tidepetal: MAT.TIDEPETAL,
}

/** The inverse of `CROP_ID_OF_MAT`, derived. */
export const WILD_MAT_OF_CROP: Readonly<Record<string, number>> =
  Object.fromEntries(Object.entries(CROP_ID_OF_MAT).map(([m, id]) => [id, Number(m)]))

/**
 * The three seed-only crops. Colours off `sprites/items.ts`'s own words: *"warm golden"* grain,
 * a *"soft-glowing root bulb"*, a *"golden petal"*. Build calls, not canon — canon names no hue.
 */
export const SEED_CROP_LOOK: Readonly<Record<string, { body: number; head: number }>> = {
  shimmerwheat: { body: 0xa8b86a, head: 0xf6e2a0 },   // paler, silvered grain beside atherwheat's
  glowroot:     { body: 0x6f9a4a, head: 0xd6ffb0 },   // the bulb's glow shows at the crown
  sunpetal:     { body: 0x6d8f48, head: 0xffb347 },   // sun-gold petal
  goldleaf:     { body: 0xb9b44e, head: 0xf2dc78 },   // MATERIAL_COLOR[GOLDLEAF] + HERB_TIP, the wild plant's own two (09-17)
}

export function plantedLook(cropId: string): PlantedLook | null {
  if (cropId === MANA_BLOOM_CROP) return null
  const herb = HERB_MAT_OF_CROP[cropId]
  if (herb !== undefined) return { pool: 'herb', mat: herb }
  const wild = WILD_MAT_OF_CROP[cropId]
  if (wild !== undefined) return { pool: 'crop', mat: wild }
  const seed = SEED_CROP_LOOK[cropId]
  if (seed) return { pool: 'crop', mat: 0, body: seed.body, head: seed.head }
  return null
}

/** Every crop a bed can hold — the roster minus the pot's. The guard test walks this. */
export const BED_CROP_IDS: ReadonlyArray<string> = CROP_IDS.filter(id => !CROP_DEFS[id].bloomsSpirit)

export function plantedStage(crop: PlantedCrop): PlantedStage {
  if (isCropReady(crop)) return STAGE_RIPE
  return getCropGrowthPhase(crop)
}

export interface PlantedSpot {
  x: number; y: number; z: number
  cropId: string
  stage: PlantedStage
  /** [0,1), position-pure — the turn a crop stands at. Same bed, same turn, forever. */
  variant: number
}

/** A cheap hash of the bed's cell for the turn; no store, no seed (a bed is placed, not generated). */
export const bedVariant = (x: number, y: number, z: number): number => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * The beds as the renderer wants them. `bedKey` is `x,y,z` (planting.ts) — the crop's `id` carries
 * the same triple, but the KEY is what the map is addressed by, so the key is what is parsed.
 */
export function plantedSpots(beds: PlantedBeds): PlantedSpot[] {
  const out: PlantedSpot[] = []
  for (const [k, crop] of beds) {
    const [x, y, z] = k.split(',').map(Number)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    out.push({ x, y, z, cropId: crop.cropId, stage: plantedStage(crop), variant: bedVariant(x, y, z) })
  }
  return out
}

/**
 * What the picture depends on, as one string. The host compares this on a slow beat and asks for a
 * flora rebuild ONLY when it moves — a stage change is minutes apart, a full flora sync is
 * milliseconds, and neither should be paid per frame. Order-independent (sorted), so two maps that
 * hold the same beds in a different insertion order do not trigger a rebuild between them.
 */
export function plantedSignature(spots: ReadonlyArray<PlantedSpot>): string {
  return spots.map(s => `${s.x},${s.y},${s.z}:${s.cropId}:${s.stage}`).sort().join('|')
}
