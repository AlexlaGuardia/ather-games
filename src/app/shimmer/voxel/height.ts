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
  /** The plains field's scale — largest of all, because a plain is a REGION, not a clearing. */
  flatScale: number
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
  flatScale: 900,
  ridgeAmplitude: 62,
}

/**
 * Calibration so `datum` MEANS "average ground level" rather than merely being a reference plane.
 * The uncalibrated fields land their median ~10 voxels low (fBm clusters near 0.5, and the
 * continent spline is deliberately gentle there). Measured once over 40k columns and applied as a
 * constant — it is a property of the splines, not of the seed, so it does not need re-deriving.
 * ⚠ Re-measure this if CONTINENT_SPLINE or ridgeAmplitude changes, or the datum quietly lies again.
 * Re-measured 2026-08-07 after the valley-floor shaping (shallower valleys raised the median 6.5):
 * was 10. Re-measured 2026-08-07 eve after the plains pass (benching + the wider valley floor
 * raised the median another 3): was 3.5.
 */
export const DATUM_CALIBRATION = 0.5

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

/**
 * ── ★ VALLEY FLOORS ARE FLAT (2026-08-07, Alex: "more flat areas to travel, like paths") ─────
 * Raw PV runs linearly down to −1, so a valley is a V: it has a lowest LINE, not a floor, and
 * walking anywhere in this world meant stairs (measured before this change: 19.6% of columns flat,
 * mean |dh| per step 1.13 — you were climbing on more than half of all steps).
 *
 * Everything below `VALLEY_FLOOR` is compressed nearly flat instead. That turns the trough of every
 * valley into a broad LEVEL corridor that follows the valley's own winding line — travel paths the
 * terrain already owns, not paths drawn on top of it. The corridor still drifts gently with
 * continentalness (a valley floor is flat ACROSS, not pool-table dead), and ridges are untouched:
 * the flat share of the world comes out of the bottom of the V, never out of the mountains.
 * `VALLEY_SQUASH` is deliberately not 0 — a mathematically perfect plane reads as a render bug the
 * moment it meets un-flat light, and the residual keeps the floor from banding at spline knees.
 */
export const VALLEY_FLOOR = -0.22   // was -0.35; raised 2026-08-07 eve with the plains pass — wider floors
export const VALLEY_SQUASH = 0.06

export function shapedPV(weirdness: number): number {
  const pv = peaksValleys(weirdness)
  return pv > VALLEY_FLOOR ? pv : VALLEY_FLOOR + (pv - VALLEY_FLOOR) * VALLEY_SQUASH
}

/**
 * ── ★ PLAINS ARE A FIELD, AND BENCHES ARE THE MECHANISM (2026-08-07 eve, Alex: "still too many
 * valleys and hills, it needs flat areas too and more often — or structures will look sloppy and
 * fragmented") ─────────────────────────────────────────────────────────────────────────────────
 *
 * The metric that matters for structures is not "flat share" but PADS: 12×12 windows spanning ≤1
 * voxel. The shipped terrain measured 1.0% pads over a 1200-unit country — no ground to seat a
 * building on. Two approaches failed before this one, and both failures are worth keeping:
 *   - Deepening EROSION_SPLINE's damping (even to zero) barely moved pads, because the CONTINENTAL
 *     BASE drifts a voxel every ~15 units — dead ridges on a drifting base still break every pad.
 *   - Hanging flatness off the erosion field's high tail put it on ~6% of country in stringy
 *     warp-filaments with no interior (same shape failure as the greyfield smear — a heavily
 *     warped field's level-sets are ribbons, not regions).
 * So plains get their OWN gently-warped large-scale field (blobby regions by construction), and
 * inside its band two things happen at once: the ridge term dies (× (1−flatF)) and the base snaps
 * to BENCHES — quantized steps with smoothed riser ramps. Benching preserves ALTITUDE: a high
 * plain stays high (a mesa), nothing melts toward the sea, and bench interiors are genuinely
 * level, which is the whole point. Measured at these values over 1200²: flat 46%, pads 7.6%
 * (12×12≤1) / 4.3% (20×20≤2), mean |dh| 0.44, sheer steps 0.97% — against 33% / 1.0% / 0.5% /
 * 0.54 / 0.49% before.
 *
 * ⚠ MEASURE OVER REAL COUNTRY. The first three tuning rounds sampled a 420-unit square — smaller
 * than ONE feature of a 700-scale field — and produced numbers that were noise about a single
 * blob's fringe. Any future retune of these constants must measure ≥1200 units on a side.
 */
export const FLAT_EDGE = 0.46    // flatness below this = untouched terrain
export const FLAT_CORE = 0.58    // flatness above this = full plains; between = blending fringe
export const BENCH_STEP = 8      // voxels of base per bench
export const BENCH_RISER = 0.45  // fraction of each step spent ramping — the rest is level bench

const sstep = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c) }

/** How much this ground belongs to a plain, 0 (untouched) .. 1 (benched, ridgeless). */
export function flatnessF(flatness: number): number {
  return sstep((flatness - FLAT_EDGE) / (FLAT_CORE - FLAT_EDGE))
}

/** Snap a base elevation to its bench: level steps joined by smoothed ramps. */
export function benched(base: number): number {
  const t = base / BENCH_STEP
  const s = t - Math.floor(t)
  return (Math.floor(t) + (s < 1 - BENCH_RISER ? 0 : sstep((s - (1 - BENCH_RISER)) / BENCH_RISER))) * BENCH_STEP
}

/** The three fields at a column. Exposed so biome selection can read the SAME values, not re-roll them. */
export function heightFields(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT) {
  const continentalness = warped2(x / cfg.continentScale, z / cfg.continentScale, seed ^ 0x9e3779b9, 4)
  const erosion = warped2(x / cfg.erosionScale, z / cfg.erosionScale, seed ^ 0x85ebca6b, 3)
  const weirdness = signed2(x / cfg.weirdnessScale, z / cfg.weirdnessScale, seed ^ 0xc2b2ae35, 3)
  // Gently warped ON PURPOSE (0.6, vs continentalness's 4): a plain must be a blobby REGION. A
  // heavily warped field's level-sets are ribbons, and ribbon plains have no interior for pads.
  const flatness = warped2(x / cfg.flatScale, z / cfg.flatScale, seed ^ 0x51a7e5, 0.6, 3)
  return { continentalness, erosion, weirdness, flatness }
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
  const { continentalness, erosion, weirdness, flatness } = heightFields(x, z, seed, cfg)

  const base = spline(CONTINENT_SPLINE, continentalness)
  const relief = spline(EROSION_SPLINE, erosion)
  const pv = shapedPV(weirdness)
  const flat = flatnessF(flatness)

  // Erosion damps the RIDGES, not the continental base: a worn upland is still an upland, it just
  // stops being jagged. Damping the base instead would sink mountains into the sea as they erode,
  // which is geologically silly and reads as the terrain melting. The plains band follows the same
  // law from the other side: it BENCHES the base (altitude preserved, interiors level) and kills
  // the ridge term — see the PLAINS block above for why both must happen together.
  const shaped = base + (benched(base) - base) * flat
  const h = cfg.datum + DATUM_CALIBRATION + shaped + pv * cfg.ridgeAmplitude * relief * (1 - flat)

  const min = 1
  const max = cfg.worldHeight - 2
  return h < min ? min : h > max ? max : Math.round(h)
}
