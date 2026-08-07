// The depth rule — what a column is MADE of, given its surface altitude.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// This is the surviving intent of Minecraft's surface rules with the part we cannot use removed.
// Theirs is a per-column CASCADE that walks downward through blocks, and that shape exists only
// because it is walking a real block column at generation time. We keep the *intent* — an ORDERED
// PREDICATE LIST deciding a voxel's material, first match wins — and drop the walk, because our
// height is already known analytically. `materialAt` is O(1) for any y: it never iterates a column,
// so a chunk builder can fill sections in any order, or fill only the one section it needs.
//
// ⚠ ORE IS NOT HERE, DELIBERATELY. This produces HOST ROCK only. Ores are features placed later
// (post-carve blobs, pre-carve pockets — WORLDGEN-RESEARCH steals #8–#11) and they overwrite what
// this returns. Mixing them would put ore placement on the wrong side of the carver ordering, which
// is the single decision that makes ore appear in cave walls or stay buried.

import { fbm2, value2 } from './noise'
import { columnHeight, riverCarve, waterLevelAt, RIVER_DEPTH, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { greySurfaceAt } from './biome'
import { AIR } from './section'

/**
 * Base materials. Palette indices — the skin (which tile art) is resolved by the registry, not here.
 *
 * ⚠ TBD-CANON: these are generic earth materials named in plain English on purpose. If the Ather's
 * deep rock, its soil, or its stone carry canon names, those belong to Magii and go over as part of
 * the one batched naming question. Do NOT invent Athernyx names for them here — a guess that ships
 * becomes accidental canon.
 */
export const MAT = {
  AIR: AIR,
  BEDROCK: 1,
  DEEP_STONE: 2,
  STONE: 3,
  SUBSOIL: 4,
  TOPSOIL: 5,
  SAND: 6,
  WATER: 7,
  /** Drained ground's surface — TOPSOIL with the mana gone. See biome.ts's richness field. */
  GREY_SOIL: 8,
} as const

export interface DepthConfig {
  /** Basins below this fill with water. Kept BELOW the datum so most of the world is dry land. */
  seaLevel: number
  /** Voxels of soil under the surface block, before stone. Varies by noise. */
  soilDepth: number
  soilVariance: number
  /** Below this altitude, stone becomes deep stone — the tier-3/4 host rock. */
  deepStoneLevel: number
  /** Bedrock floor: solid at y=0, ragged up to this. */
  bedrockTop: number
  /** Surfaces steeper than this (voxels of rise per voxel across) show bare rock, not soil. */
  cliffSlope: number
  /** Sand reaches this far above sea level — the beach band. */
  beachHeight: number
}

export const DEFAULT_DEPTH: DepthConfig = {
  // ★ Sea level sits 20 below the datum, not on it. On it, HALF the world would be underwater by
  // definition (the datum is the median ground height). Measured: 140 puts ~12% of columns under
  // water — lakes and coasts, not an ocean planet.
  seaLevel: 140,
  soilDepth: 4,
  soilVariance: 2,
  deepStoneLevel: 96,
  bedrockTop: 4,
  cliffSlope: 2.2,
  beachHeight: 2,
}

/**
 * Local steepness at a column, in voxels of rise per voxel across.
 *
 * ★ This reads neighbouring COLUMNS, which is safe, and the distinction matters: it evaluates the
 * pure `columnHeight` function at nearby coordinates. It does NOT read a neighbouring chunk's
 * stored state. That is exactly the line research steal #2 draws — a stage may never synchronously
 * generate a missing neighbour, but calling a pure O(1) function at any coordinate is free and
 * order-independent.
 */
export function slopeAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const h = columnHeight(x, z, seed, cfg)
  const dx = Math.abs(columnHeight(x + 1, z, seed, cfg) - h)
  const dz = Math.abs(columnHeight(x, z + 1, seed, cfg) - h)
  const bx = Math.abs(h - columnHeight(x - 1, z, seed, cfg))
  const bz = Math.abs(h - columnHeight(x, z - 1, seed, cfg))
  return Math.max(dx, dz, bx, bz)
}

/**
 * The ordered predicate list. First match wins; the order IS the rule, so it is written to be read
 * top to bottom rather than optimised into a lookup.
 *
 * `h` (the column's surface altitude) is passed in rather than recomputed, because a chunk builder
 * already has it for the whole column and recomputing it per voxel would be 256 redundant noise
 * evaluations per column — the difference between a fast generator and a slow one.
 */
export function materialAt(
  x: number, y: number, z: number, seed: number, h: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  // 1. An unbreakable floor. Ragged rather than flat, so the bottom of the world reads as rock
  //    rather than as a rendering plane — Minecraft's own trick, and it costs one noise sample.
  if (y <= 0) return MAT.BEDROCK
  if (y < cfg.bedrockTop && value2(x * 0.7, z * 0.7, seed ^ 0xbed0) > y / cfg.bedrockTop) return MAT.BEDROCK

  // 2. Above the surface: water if we are in a basin — or in a river channel, filled to the WATER
  //    TABLE (height.ts waterLevelAt: a body of water has ONE level; per-column banks−1 was "highs
  //    and lows in a pond"). Guarded twice: only the few voxels just above the surface run the
  //    cheap riverCarve read, and only carved columns pay for the four-sample table.
  if (y > h) {
    if (y <= cfg.seaLevel) return MAT.WATER
    // +9 headroom over the carve: a local pit inside the band floods to the table, and truncating
    // the fill at the old carve bound would put an air gap above pond water in exactly those pits.
    if (y - h <= RIVER_DEPTH + 9) {
      const carve = riverCarve(x, z, seed, hcfg)
      if (carve >= 1 && y <= waterLevelAt(x, z, seed, hcfg)) return MAT.WATER
    }
    return MAT.AIR
  }

  const depth = h - y

  // 3. The surface voxel itself — the only place where slope and water change the answer.
  if (depth === 0) {
    if (h <= cfg.seaLevel) return MAT.SAND                              // lake / sea bed
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND            // beach band
    if (riverCarve(x, z, seed, hcfg) >= 1) return MAT.SAND              // river bed and its shoulders
    if (slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope) return MAT.STONE   // cliff faces show rock
    if (greySurfaceAt(x, z, seed)) return MAT.GREY_SOIL                 // drained ground wears grey
    return MAT.TOPSOIL
  }

  // 4. Soil under the surface, thinning on slopes so a cliff does not wear a soil stripe.
  //    The variance is noise, not randomness — same coordinate, same depth, forever.
  const soil = cfg.soilDepth + Math.round((fbm2(x * 0.08, z * 0.08, seed ^ 0x501, 2) - 0.5) * 2 * cfg.soilVariance)
  if (depth <= Math.max(1, soil)) {
    if (h <= cfg.seaLevel + cfg.beachHeight) return MAT.SAND
    return slopeAt(x, z, seed, hcfg) >= cfg.cliffSlope ? MAT.STONE : MAT.SUBSOIL
  }

  // 5. Host rock. The deep/shallow split is what steals #11's `targets` rule-test keys on later:
  //    ONE ore feature places its stone-host or deep-host variant depending on what it replaced.
  return y < cfg.deepStoneLevel ? MAT.DEEP_STONE : MAT.STONE
}

/**
 * Fill one column segment. This is the shape a chunk builder actually wants: surface altitude
 * computed once, then a straight run down the column with no per-voxel height recomputation.
 * Writes into a caller-owned array — allocation-free, per port rule 3.
 */
export function fillColumn(
  out: Uint16Array, offset: number, stride: number,
  x: number, z: number, yFrom: number, yTo: number, seed: number,
  cfg: DepthConfig = DEFAULT_DEPTH, hcfg: HeightConfig = DEFAULT_HEIGHT,
): void {
  const h = columnHeight(x, z, seed, hcfg)
  for (let y = yFrom, i = offset; y < yTo; y++, i += stride) {
    out[i] = materialAt(x, y, z, seed, h, cfg, hcfg)
  }
}
