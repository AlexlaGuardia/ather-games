// Terrain height — the surface altitude of a column, as a pure function of (seed, x, z).
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ THE ONE RULE THIS FILE EXISTS TO OBEY: height is a spline over CONTINUOUS FIELDS, never a
// function of a biome id. That is the pre-1.18 Minecraft mistake — per-biome base-height constants
// are what forced "Hills" variant biomes to exist and produced hard elevation seams at every biome
// edge, and it is why 1.18 has no per-edge blend pass: nothing steps, because nothing is keyed on a
// category. Biome is a SIBLING read of the same fields, computed elsewhere. There is deliberately
// no biome parameter below — the rule is enforced by the signature, not by discipline.
//
// Three fields, following the shape 1.18 uses (we copy the decision, none of their constants):
//   continentalness — the large-scale question: seabed, shore, inland, or upland?
//   erosion         — how WORN this country is. High erosion flattens whatever the others propose.
//   weirdness       — signed; drives peaks-and-valleys, so ridges and troughs come from one field.

import { signed2, spline, warped2, type SplinePoint } from './noise'

export interface HeightConfig {
  /** Total world height in voxels. Ruled 2026-08-06: 256. */
  worldHeight: number
  /** Average ground level. Everything below is rock to mine, everything above is sky to build in. */
  datum: number
  /** World units per noise unit — larger means broader country. */
  continentScale: number
  erosionScale: number
  weirdnessScale: number
  /** Ceiling on ridge relief before erosion damping. */
  ridgeAmplitude: number
}

export const DEFAULT_HEIGHT: HeightConfig = {
  worldHeight: 256,
  datum: 160,
  // ★ Tuned by rendering, not by argument (WORLDGEN-RESEARCH's own lesson: the 2D generator's 27
  // asserts were green over a map of ruler-straight highways, and looking at it is what caught it).
  // A first pass at continentScale 900 / ridge 46 measured 17.3 voxels of relief across one view
  // distance — technically varied, visually a gentle swell, because a mountain 900 tiles wide seen
  // through a 182-unit view is just a slope. Tightening the scales put a visible peak in frame.
  continentScale: 480,
  erosionScale: 420,
  weirdnessScale: 150,
  ridgeAmplitude: 62,
}

/**
 * Calibration so `datum` MEANS "average ground level" rather than merely being a reference plane.
 * The uncalibrated fields land their median ~10 voxels low (fBm clusters near 0.5, and the
 * continent spline is deliberately gentle there). Measured once over 40k columns and applied as a
 * constant — it is a property of the splines, not of the seed, so it does not need re-deriving.
 * ⚠ Re-measure this if CONTINENT_SPLINE or ridgeAmplitude changes, or the datum quietly lies again.
 */
export const DATUM_CALIBRATION = 10

/**
 * Continentalness → elevation offset from the datum.
 *
 * The control points ARE the world's character, so they are written to be read: most of the domain
 * sits in the gentle middle, because most country should be walkable. The steep end past 0.80 is
 * what makes mountains rare rather than average — a linear ramp here gives you a world of uniform
 * lumps, which is the classic "procedural terrain looks the same everywhere" failure.
 */
export const CONTINENT_SPLINE: SplinePoint[] = [
  { at: 0.00, val: -34 },   // deep basin
  { at: 0.28, val: -14 },   // shallows
  { at: 0.42, val: -2 },    // shore
  { at: 0.52, val: 4 },     // lowland — the common case
  { at: 0.66, val: 11 },    // rolling inland
  { at: 0.80, val: 26 },    // uplands
  { at: 0.91, val: 48 },    // highlands
  { at: 1.00, val: 70 },    // peaks — rare by construction
]

/** Erosion → relief multiplier. Worn country is flat country; young country keeps its edges. */
export const EROSION_SPLINE: SplinePoint[] = [
  { at: 0.00, val: 1.00 },
  { at: 0.35, val: 0.78 },
  { at: 0.60, val: 0.44 },
  { at: 0.82, val: 0.20 },
  { at: 1.00, val: 0.10 },
]

/**
 * Peaks-and-valleys from weirdness. `PV = 1 − |3·|w| − 2|` is confirmed verbatim off Minecraft's
 * own debug screen (WORLDGEN-RESEARCH § What Mojang actually does) and it is worth understanding
 * rather than copying: it folds a single signed field into a ridge profile, so ridgelines and the
 * valleys beside them are the SAME feature read at different offsets — which is why real ridges
 * have valleys hugging them instead of appearing independently.
 */
export function peaksValleys(weirdness: number): number {
  return 1 - Math.abs(3 * Math.abs(weirdness) - 2)
}

/** The three fields at a column. Exposed so biome selection can read the SAME values, not re-roll them. */
export function heightFields(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT) {
  const continentalness = warped2(x / cfg.continentScale, z / cfg.continentScale, seed ^ 0x9e3779b9, 4)
  const erosion = warped2(x / cfg.erosionScale, z / cfg.erosionScale, seed ^ 0x85ebca6b, 3)
  const weirdness = signed2(x / cfg.weirdnessScale, z / cfg.weirdnessScale, seed ^ 0xc2b2ae35, 3)
  return { continentalness, erosion, weirdness }
}

/**
 * Surface altitude for the column at (x, z). Integer, clamped to [1, worldHeight-2] so y=0 can be
 * an unbreakable floor and the top voxel is never the surface.
 *
 * Pure and allocation-free: no arrays, no closures, no neighbour reads. Two adjacent columns can be
 * generated in any order, on any thread, in either engine, and agree — which is the property the
 * whole chunk pipeline rests on (research steal #2: never let a stage synchronously generate a
 * missing neighbour).
 */
export function columnHeight(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const { continentalness, erosion, weirdness } = heightFields(x, z, seed, cfg)

  const base = spline(CONTINENT_SPLINE, continentalness)
  const relief = spline(EROSION_SPLINE, erosion)
  const pv = peaksValleys(weirdness)

  // Erosion damps the RIDGES, not the continental base: a worn upland is still an upland, it just
  // stops being jagged. Damping the base instead would sink mountains into the sea as they erode,
  // which is geologically silly and reads as the terrain melting.
  const h = cfg.datum + DATUM_CALIBRATION + base + pv * cfg.ridgeAmplitude * relief

  const min = 1
  const max = cfg.worldHeight - 2
  return h < min ? min : h > max ? max : Math.round(h)
}
