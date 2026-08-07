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
  /** The river field's scale — large, because a river is RARE; see the rivers block below. */
  riverScale: number
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
  // ★ 150 → 340 (2026-08-07 late, Alex: "still feeling like we are compressing the map into
  // hills and valleys... this water is at the base of surrounding hills"). The diagnosis was
  // WAVELENGTH vs VIEW: ridges every ~150 blocks against a ~96-block view radius means the player
  // is always standing INSIDE one fold — everywhere reads as a bowl ringed by hills, and every
  // water line ends up hill-rimmed. At 340 a hill is a landform you approach and walk around.
  // Measured with a bowl metric (ringed >8 voxels in all 4 directions within 96): 12.5% → 7.7%.
  weirdnessScale: 340,
  flatScale: 900,
  riverScale: 650,
  // Raised with the stretch: fewer ridges deserve more presence, and the worn erosion spline
  // keeps them gathered into ranges. Vertical range measured 98 → 121.
  ridgeAmplitude: 84,
}

/**
 * Calibration so `datum` MEANS "average ground level" rather than merely being a reference plane.
 * The uncalibrated fields land their median ~10 voxels low (fBm clusters near 0.5, and the
 * continent spline is deliberately gentle there). Measured once over 40k columns and applied as a
 * constant — it is a property of the splines, not of the seed, so it does not need re-deriving.
 * ⚠ Re-measure this if CONTINENT_SPLINE or ridgeAmplitude changes, or the datum quietly lies again.
 * Re-measured 2026-08-07 after the valley-floor shaping (shallower valleys raised the median 6.5):
 * was 10. Re-measured 2026-08-07 eve after the plains pass (benching + the wider valley floor
 * raised the median another 3): was 3.5. Re-measured after the open-country retune (weirdness
 * 340 / amp 84 / worn erosion): median landed dead on the datum — unchanged.
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

/** Erosion → relief multiplier. Worn country is flat country; young country keeps its edges.
 *  Steepened 2026-08-07 late with the weirdness stretch: ordinary (mid-erosion) country calms to
 *  a quarter-relief so hills GATHER into low-erosion ranges instead of being sprinkled — the
 *  other half of the "everything is hills and valleys" fix. */
export const EROSION_SPLINE: SplinePoint[] = [
  { at: 0.00, val: 1.00 },
  { at: 0.30, val: 0.62 },
  { at: 0.50, val: 0.30 },
  { at: 0.68, val: 0.14 },
  { at: 0.85, val: 0.07 },
  { at: 1.00, val: 0.04 },
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

/**
 * ── ★ RIVERS ARE A ZERO-LINE, AND THE FIELD MUST BE ITS OWN (2026-08-07 late) ────────────────
 * A river is the zero-line of a signed field (Minecraft 1.18's trick: rivers live where their
 * noise ≈ 0 — a line is exactly what a signed field's zero-set is). The FIRST version reused the
 * weirdness field for this, which sounds elegant — the zero-line is the valley centre, water in
 * the valleys for free — and the rendered map killed it on sight: at ridge scale (150) the
 * zero-set is a DENSE CAPILLARY TANGLE, loops every couple hundred blocks, the whole country
 * marbled with water. A ridge field's job is to oscillate often; a river's job is to be RARE.
 * Same class of lesson as the greyfield smear and the 420-unit sample: the field's SHAPE at its
 * scale is a design input, and the map is where it shows. So rivers get their own large-scale,
 * gently-meandering signed field, and the zero-line count drops from everywhere to a few real
 * rivers per rendered frame. (What was lost: automatic valley alignment. A river can now cross a
 * ridge — it notches a 3-deep water gap through the saddle, which reads as a gorge stream, fine.)
 *
 * Water steps where the line crosses a bench edge: a small waterfall, and it reads as one.
 * Consumers get rivers for free through the carved surface: trees refuse the bed (sand is not
 * PLANTABLE), site pads reject channels (the span check reads carved heights), collision wades
 * (water is non-solid). The only deliberate hook is depth.ts filling the water.
 */
export const RIVER_FULL = 0.012   // |river field| below this = full channel depth
export const RIVER_EDGE = 0.035   // channel fades to nothing here — the banks
export const RIVER_DEPTH = 3      // voxels carved at full riverness

/** The river field, signed. Its own scale (HeightConfig.riverScale) and salt — see the block above. */
export function riverField(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  return signed2(x / cfg.riverScale, z / cfg.riverScale, seed ^ 0x11f3a7, 3)
}

/** How much river is at this field value, 0 (dry land) .. 1 (mid-channel). */
export function riverness(w: number): number {
  const t = (RIVER_EDGE - Math.abs(w)) / (RIVER_EDGE - RIVER_FULL)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

/**
 * The channel's depth below the WATER TABLE at (x, z) — 0 outside the water region. Pure; one
 * field read on the fast path. Consumers use it as "is there channel here" (sand beds, site-pad
 * rejection, tests); the depth itself is anchored to the table, not the local surface — see the
 * land-generates-around-the-water block below.
 */
export function riverCarve(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const rn = riverness(riverField(x, z, seed, cfg))
  if (rn < 0.35) return 0   // SHORE_RN — literal here because the const is declared below
  const t = (rn - 0.35) / (1 - 0.35)
  return Math.max(1, Math.round(RIVER_DEPTH * t * t * (3 - 2 * t)))
}

/** The three fields at a column. Exposed so biome selection can read the SAME values, not re-roll them. */
export function heightFields(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT) {
  // ★ Warp 4 → 1.2 on continentalness, 3 → 1.2 on erosion (2026-08-07 late, Alex: "the further
  // out you go the sharper the terrain gets, turning into slices"). Heavy domain warp FOLDS a
  // field's level-sets into thin parallel bands, and the continental base — which erosion never
  // damps, by design — cliffed along every fold line: measured, warp 4 put a ≥1.5-voxel base
  // cliff on 2.9% of single-block steps (one wall every ~35 blocks of walking); warp 1.2 → 0.05%.
  // The erosion field had the same disease: its low tail (= full relief) ran in warp filaments,
  // so mountain country came out as thin slice-walls instead of masses. Third appearance of the
  // same lesson (greyfield smear, river tangle): a field's SHAPE at its scale is a design input.
  const continentalness = warped2(x / cfg.continentScale, z / cfg.continentScale, seed ^ 0x9e3779b9, 1.2)
  const erosion = warped2(x / cfg.erosionScale, z / cfg.erosionScale, seed ^ 0x85ebca6b, 1.2)
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
/** The UNCARVED, unrounded terrain — what the ground would be if no river cut it. Internal to the
 *  height stack; exists so the water table can ask "what does the land around here sit at" without
 *  the river's own channel biasing the answer downward. */
function rawTerrain(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
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
  return cfg.datum + DATUM_CALIBRATION + shaped + pv * cfg.ridgeAmplitude * relief * (1 - flat)
}

export function columnHeight(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const rn = riverness(riverField(x, z, seed, cfg))
  let h: number
  if (rn <= 0) {
    h = rawTerrain(x, z, seed, cfg)
  } else {
    // Inside the river band the terrain anchors to the WATER TABLE (see the model-3 block above):
    // the approach fringe blends the countryside to the waterline — building levees through low
    // country, cutting gorges through high — and the channel hangs below it. Water then fills to
    // the table and is flat and contained by construction.
    const table = waterLevelAt(x, z, seed, cfg)
    if (rn >= 0.35) {                                     // SHORE_RN — the channel
      // Identical formula to riverCarve, so bed and depth can never drift apart.
      const t = (rn - 0.35) / (1 - 0.35)
      h = table - Math.max(1, Math.round(RIVER_DEPTH * (t * t * (3 - 2 * t))))
    } else {                                              // the approach — banks, levees, gorges
      // Ends exactly at table+1 so the bank meets the waterline as ground, never as a lip or a
      // face. sm01 is declared below; only evaluated at call time, never during module init.
      const raw = rawTerrain(x, z, seed, cfg)
      h = raw + ((table + 1) - raw) * sm01(rn / 0.35)
    }
  }
  const min = 1
  const max = cfg.worldHeight - 2
  return h < min ? min : h > max ? max : Math.round(h)
}

/**
 * ── ★ THE WATER TABLE — a body of water has ONE level (2026-08-07 late, Alex: "there shouldn't
 * be highs and lows in a pond") ────────────────────────────────────────────────────────────────
 * The first water fill set each column's surface at its OWN banks − 1, so a pond lying across
 * undulating ground undulated with it — per-column water is what "highs and lows in a pond" IS.
 * A body of water needs a level that is a property of the PLACE, not of the column. With no
 * connectivity analysis available to a pure per-column generator, the level comes from a coarse
 * WATER TABLE instead: the uncarved terrain, sampled on a 96-block lattice and bilinearly
 * interpolated. Across any one pond (a few dozen blocks) the table moves at most a voxel, so
 * ponds sit flat; down a long river the table follows the country gently instead of stepping at
 * every bench. Water then FILLS ITS BASIN: everywhere inside the river band below the table is
 * water — low ground floods to the shoreline, high spots poke out as sandbars, which is how a
 * pond actually meets terrain.
 *
 * ⚠ EXPENSIVE-ISH (four rawTerrain evaluations) — callers must gate it behind `riverCarve > 0`,
 * which kills ~97% of columns with one cheap field read.
 */
export const WATER_LATTICE = 96

/**
 * One lattice corner of the table: the MEAN of rawTerrain over the corner's 5×5 lattice
 * neighbourhood. The smoothing is load-bearing, not cosmetic — a raw corner near a range gives the
 * bilerp a gradient steep enough to put a visible shelf across a pond (measured: 11/25 pools flat
 * raw, 18/25 at 3×3, 25/25 at 5×5). Cached per (seed, corner): the 25 rawTerrain evaluations run
 * once per cell ever, so per-voxel fills pay a Map hit. The cache is a pure memo of a pure
 * function — determinism is untouched — and it is capped so a long walk cannot grow it forever.
 * ⚠ Keyed on (seed, corner) only: a non-default HeightConfig would read stale values. Every live
 * caller uses the default config; revisit the key if that ever changes.
 */
const tableCache = new Map<string, number>()

function tableCorner(gx: number, gz: number, seed: number, cfg: HeightConfig): number {
  const k = `${seed}:${gx},${gz}`
  const hit = tableCache.get(k)
  if (hit !== undefined) return hit
  let sum = 0
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    sum += rawTerrain((gx + dx) * WATER_LATTICE + WATER_LATTICE / 2, (gz + dz) * WATER_LATTICE + WATER_LATTICE / 2, seed, cfg)
  const v = sum / 25
  if (tableCache.size > 4096) tableCache.clear()
  tableCache.set(k, v)
  return v
}

export function waterLevelAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const gx = Math.floor(x / WATER_LATTICE), gz = Math.floor(z / WATER_LATTICE)
  const fx = x / WATER_LATTICE - gx, fz = z / WATER_LATTICE - gz
  const a = tableCorner(gx, gz, seed, cfg), b = tableCorner(gx + 1, gz, seed, cfg)
  const c = tableCorner(gx, gz + 1, seed, cfg), d = tableCorner(gx + 1, gz + 1, seed, cfg)
  const level = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz
  return Math.floor(level - 1)
}

/**
 * ── ★ THE LAND GENERATES AROUND THE WATER (2026-08-07 late — the third water model, and the one
 * that holds) ──────────────────────────────────────────────────────────────────────────────────
 * History, because each model failed for a reason worth keeping:
 *   1. banks−1 per column → "highs and lows in a pond" (water copied the ground's undulation).
 *   2. fill to the smoothed table → flat ponds, but a 10-voxel WALL where the table towered over
 *      low country; then a rim clamp → no walls, but the clamp RAMPED the surface toward shores:
 *      "a hill of blue jello". Clamping water to terrain and keeping it flat are irreconcilable.
 *   3. THIS: invert the dependency — Alex's own read ("maybe it has something to do with the
 *      surrounding land that generates around it"). Inside the river band the TERRAIN anchors to
 *      the water table: the approach fringe blends the countryside to the waterline, the bed
 *      hangs below it, and water just fills to the table — dead flat, contained by construction.
 *      Where the band crosses low country the blend BUILDS the banks (natural levees); where it
 *      crosses a ridge it cuts a gorge. Rivers shape their valleys; that is what rivers do.
 *
 * SHORE_RN splits the band: outside it the ground blends raw→table (the banks), inside it the
 * bed drops table→table−RIVER_DEPTH (the channel). Water exists exactly where rn ≥ SHORE_RN,
 * at depth 0 at the shoreline — so the water's edge is always ground-at-waterline, never a face.
 */
export const SHORE_RN = 0.35

const sm01 = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c) }

/**
 * The water surface at (x, z): the table where there is water, -Infinity where there is none.
 *
 * ★ ONE EDGE RULE remains: a PERIMETER water column (one with a dry 4-neighbour) clamps to that
 * neighbour's ground. The approach blend pins most banks at table+1, but where the band's own
 * gradient is locally steep the blend gets squeezed and a dry neighbour can sit below the table —
 * without this clamp that is a standing water face (measured up to 6 voxels). The clamp is one
 * column wide, so it reads as a shoreline step, never as the rim-clamp's jello dome. Memoised —
 * it can cost four neighbour columnHeights.
 */
const wsCache = new Map<string, number>()

export function waterSurfaceAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): number {
  const k = `${seed}:${x},${z}`
  const hit = wsCache.get(k)
  if (hit !== undefined) return hit
  const rn = riverness(riverField(x, z, seed, cfg))
  let lvl: number
  if (rn < SHORE_RN) {
    lvl = -Infinity
  } else {
    lvl = waterLevelAt(x, z, seed, cfg)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (riverness(riverField(x + dx, z + dz, seed, cfg)) < SHORE_RN) {
        const g = columnHeight(x + dx, z + dz, seed, cfg)
        if (g < lvl) lvl = g
      }
    }
  }
  if (wsCache.size > 16384) wsCache.clear()
  wsCache.set(k, lvl)
  return lvl
}
