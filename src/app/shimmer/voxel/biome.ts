// The biome layer — WHERE a column is, as a label over the same fields height already reads.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ TWO INHERITED RULES, and everything here is shaped by them:
//   1. Biome never feeds height (height.ts's one rule, enforced there by signature).
//   2. Material never derives from a biome ID (VOXEL-WORLD-MODEL § 4 — the pre-1.18 mistake in its
//      second disguise). So this file exports BANDS OVER FIELDS, not a biome→stuff table: depth.ts
//      reads the grey band to pick a surface block, treeStartsAt reads the same bands to weight a
//      species, and `biomeAt` reads them to NAME the place for consumers that want a label
//      (ambience, spawns, the HUD). Siblings of one source; none derives from another, so they
//      cannot disagree.
//
// ★ NO TEMPERATURE, NO HUMIDITY — the Ather's one climate axis is MANA. Minecraft's climate axes
// exist to make Earth. Here the axis is RICHNESS (tended ⇄ drained), whose geography canon already
// rules: the greying desaturates the frayed edges, the night tide gives standing grey its range,
// and a Hollow "forms only where the ground was already drained" (CANON/game/shimmer-geography.md
// › The night tide, The Hollows). The drained band this field carves is the ground that whole
// later spawn layer stands on — infrastructure, not decoration. The band placement (where, how
// much, how big) is build tuning and is mine; that drained ground EXISTS is the canon underneath.
//
// ⚠ Biome ids are INTERNAL BUILD VOCABULARY (meadow/woodland/greyfield…), deliberately plain
// English, never shown raw to the player. If a region ever needs a canon NAME, that is Magii's —
// same TBD-CANON discipline as the material names in depth.ts.

import { value2, warped2 } from './noise'
import { heightFields, type HeightConfig, DEFAULT_HEIGHT } from './height'

export interface BiomeConfig {
  /**
   * ── The woodland mask (moved here from trees.ts 2026-08-07) ──────────────────────────────────
   * Forests are PLACES (Alex: "a forest is okay but a forest everywhere is overkill"). Sampled per
   * COLUMN, not per block — the frequency is chosen against column coordinates. It lives in this
   * file because "am I in a forest" is a biome question, and the planter is just one consumer.
   */
  forestScale: number      // noise frequency per column — smaller = larger forests and clearings
  forestThreshold: number  // mask below this = meadow
  forestFull: number       // mask above this = forest core; between the two is the thinning edge
  /**
   * ── The mana field ───────────────────────────────────────────────────────────────────────────
   * World units per noise unit. LARGE on purpose: a greyfield is country you cross, not a stain —
   * patches would read as texture noise, and the later Hollow layer needs room to be a place.
   */
  richnessScale: number
  /** Richness below this is fully drained — the greyfield core. */
  greyCore: number
  /** Richness below this begins to gutter — the dithered fringe runs from here down to the core. */
  greyEdge: number
  /** Continentalness bands for the upland labels. Same field, same values, height already reads. */
  highlandC: number
  cragC: number
}

export const DEFAULT_BIOME: BiomeConfig = {
  forestScale: 0.14,       // unchanged from trees.ts — features span ~7 columns ≈ 110 blocks
  forestThreshold: 0.52,
  forestFull: 0.68,
  // ★ Tuned by measuring, then by rendering the map (scripts/terrain-profile.mts — LOOK at it).
  // Measured over 90k land columns: this band puts ~8% of land under grey surface, in large fields
  // rather than freckles (edge 0.42/core 0.34 measured 21% — a plague, not an exception). Bands sit
  // on the LOW side of the richness distribution because the world's thesis is: mostly alive.
  richnessScale: 620,
  greyCore: 0.26,
  greyEdge: 0.34,
  // CONTINENT_SPLINE's own knees: 0.66 is "rolling inland" → uplands begin; 0.80 is uplands proper.
  highlandC: 0.66,
  cragC: 0.80,
}

/**
 * How wooded is this column, 0 (meadow) .. 1 (forest core)? Fractional coordinates are fine — the
 * planter samples at integer column coords, the labeler at x/16 — both read the same boundary.
 */
export function forestness(seed: number, cx: number, cz: number, cfg: BiomeConfig = DEFAULT_BIOME): number {
  const f = value2(cx * cfg.forestScale, cz * cfg.forestScale, seed ^ 0xf07e57)
  const t = (f - cfg.forestThreshold) / (cfg.forestFull - cfg.forestThreshold)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

/**
 * The mana field, raw: ~0 drained .. ~1 rich. GENTLY warped, and the number is a shape call made
 * off the rendered map: at warp 4 (what continentalness runs — ⚠ warped2's 4th arg is WARP, not
 * octaves) the drained band came out as long curled SMEARS chasing the flow lines, which reads as
 * brushwork. At 0.6 the fields are broad wandering blobs — country you cross, edges that gutter.
 */
export function richness(x: number, z: number, seed: number, cfg: BiomeConfig = DEFAULT_BIOME): number {
  return warped2(x / cfg.richnessScale, z / cfg.richnessScale, seed ^ 0x6d4a11, 0.6, 3)
}

/**
 * How DRAINED this ground is, 0 (healthy) .. 1 (greyfield core) — the band consumers actually read.
 * Smoothstepped between the edge and the core, so the fringe width in world units comes from the
 * field's own gradient rather than from a second tuning knob.
 */
export function greyness(x: number, z: number, seed: number, cfg: BiomeConfig = DEFAULT_BIOME): number {
  const r = richness(x, z, seed, cfg)
  const t = (cfg.greyEdge - r) / (cfg.greyEdge - cfg.greyCore)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

/**
 * Should the surface voxel at (x, z) wear grey? The fringe is DITHERED against high-frequency
 * noise rather than cut at a line: drained ground guttering out through healthy turf in ragged
 * patches is the canon look ("guttering at its edges"), and a hard contour would read as paint.
 * Deterministic — same coordinate, same answer, forever.
 */
export function greySurfaceAt(x: number, z: number, seed: number, cfg: BiomeConfig = DEFAULT_BIOME): boolean {
  const gy = greyness(x, z, seed, cfg)
  if (gy <= 0) return false
  if (gy >= 1) return true
  return value2(x * 0.31, z * 0.31, seed ^ 0x9e447) < gy
}

/** The label vocabulary. Order is meaningless; the classifier's precedence is what rules. */
export type BiomeId = 'basin' | 'shore' | 'greyfield' | 'crag' | 'highland' | 'woodland' | 'meadow'

/**
 * Name the place at (x, z). `h` and `seaLevel` are passed in rather than imported — depth.ts owns
 * the water constants and importing them here would cycle the graph (depth reads this file's grey
 * band). Precedence is written to be read: water beats everything, drained beats alive, relief
 * beats cover.
 */
export function biomeAt(
  x: number, z: number, seed: number, h: number, seaLevel: number,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): BiomeId {
  if (h <= seaLevel) return 'basin'
  if (h <= seaLevel + 2) return 'shore'
  if (greyness(x, z, seed, cfg) >= 0.5) return 'greyfield'
  const { continentalness } = heightFields(x, z, seed, hcfg)
  if (continentalness >= cfg.cragC) return 'crag'
  if (continentalness >= cfg.highlandC) return 'highland'
  if (forestness(seed, x / 16, z / 16, cfg) >= 0.5) return 'woodland'
  return 'meadow'
}

/**
 * Per-place species weight multiplier — how the same four ruled trees make DIFFERENT woods.
 *
 * ★ Weights stay weights (trees.ts's own rarity rule): a species is never placed by its own pass,
 * it just gets heavier where it belongs. Species NAMES and drop tables are canon; where each one
 * likes to grow is build tuning and is mine. The shape: starwillow crowds the low wet ground,
 * goldwood takes the hills, dawnwood concentrates in deep forest cores (rare stays rare, but you
 * now know where to LOOK — a rare tree scattered uniformly is just litter with a low weight).
 */
export function speciesFactor(
  id: string, seed: number, cx: number, cz: number,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  const x = cx * 16 + 8, z = cz * 16 + 8
  const { continentalness } = heightFields(x, z, seed, hcfg)
  switch (id) {
    case 'starwillow':
      return continentalness <= 0.45 ? 3.0 : continentalness >= cfg.highlandC ? 0.3 : 1.0
    case 'goldwood':
      return continentalness >= cfg.highlandC ? 1.8 : 1.0
    case 'dawnwood':
      return forestness(seed, cx, cz, cfg) >= 0.85 ? 3.5 : 0.6
    default:
      return 1.0
  }
}
