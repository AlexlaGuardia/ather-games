// The character layer — what a place WEARS, as a blend over the same fields height already reads.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★ WHY THIS IS A WEIGHT AND NOT A LABEL, WHICH IS THE WHOLE FILE ─────────────────────────────
// `biomeAt` is a CLASSIFIER: hard thresholds, one winner, `if (c >= 0.80) return 'crag'`. Hanging
// the ground's dressing off that answer is the pre-1.18 mistake in its third disguise — the grass
// would change colour along a contour line, and a contour is exactly what nothing in this world is
// allowed to have (see height.ts's one rule, and biome.ts's inheritance of it).
//
// So character does not ask "which biome is this". It asks "HOW MUCH of each biome is this", and
// every consumer blends:
//   · continuous properties (density, rate, amplitude) blend by weighted average — smooth by
//     construction, no seam possible;
//   · discrete properties (which block, which tree, which flower) roll a WEIGHTED DIE against a
//     per-column hash, so a border comes out as ragged interpenetrating patches rather than a line.
// The die is the mechanism `greySurfaceAt` already ships and Alex already judged: drained ground
// guttering out through healthy turf. This is that, generalised.
//
// ── ★★ `biomeAt` NAMES THE REGION. THIS DRESSES THE COLUMN. DO NOT MERGE THEM. ─────────────────
// The obvious "cleanup" is to redefine `biomeAt` as the argmax of these weights. That would be a
// silent gameplay change and it must not be made casually: the four ELEMENT HERBS are an allowlist
// keyed on `biomeAt`'s label (flora.ts, canon-ruled grounds), and their densities are compensated
// per-ground against a MEASURED land share — woodland 13.6%, highland 2.0%, basin 0.9%, shore 0.6%.
// Re-deriving the label from these weights moves every one of those shares, so the four infusions'
// relative rarity moves with it, and nothing would look wrong. The two layers read the SAME fields
// at different granularity, which is the sibling law, not a duplication: the region is what you
// tell someone you are in, the column is what is under your boot. A woodland with a lush valley
// floor is still a woodland and still grows Rootvine.
//
// ⚠ LAND IDS ARE INTERNAL BUILD VOCABULARY, like biome.ts's — plain English, never shown raw to a
// player, no canon owed. What ground EXISTS here is mine; what a place is CALLED is Magii's.

import { heightFields, riverField, peaksValleys, flatnessF, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { forestness, canopy, type BiomeConfig, DEFAULT_BIOME } from './biome'
import { value2 } from './noise'

/** The noise-placed grounds. Water, shore and the greyfield are NOT here — see `surfaceBlockAt`. */
export type LandId = 'meadow' | 'woodland' | 'deepwood' | 'dell' | 'marsh'
  | 'tableland' | 'barrens' | 'highland' | 'crag'

/** Fixed order. Weight arrays are indexed by position here, so this list is append-only in spirit. */
export const LAND_IDS: readonly LandId[] = [
  'meadow', 'woodland', 'deepwood', 'dell', 'marsh', 'tableland', 'barrens', 'highland', 'crag',
]

export interface LandCharacter {
  /** The ground this land wears. */
  surface: number
  /**
   * A second block dithered through the first, and the reason within-biome ground is not flat
   * colour: bare earth showing through a barrens, rock breaking a highland's turf, loam under a
   * wood's litter. 0 disables it.
   */
  accent: number
  accentP: number
}

/**
 * ⚠ MATERIALS ARRIVE AS ARGUMENTS, NEVER AS AN IMPORT — the same inversion `holds.ts` and
 * `story-path.ts` already run, and here it is load-bearing rather than tidy: `depth.ts` owns `MAT`
 * and must import this file to dress its surface, so importing `MAT` back would close a cycle whose
 * failure mode is a module-init read of an undefined enum. Depth builds the table once and hands it
 * down.
 */
export interface GroundMaterials {
  topsoil: number
  loam: number
  lush: number
  mud: number
  dry: number
  highland: number
  scree: number
  subsoil: number
  stone: number
}

/**
 * ★ EVERY LAND READS APART FROM ITS NEIGHBOURS AT A GLANCE, and the accents are what stop each one
 * from being a flat sheet of colour. Pairs are deliberate: woodland and deepwood are the SAME two
 * blocks in opposite proportion, so walking into a forest core is a gradient of litter taking over
 * rather than a new material appearing. Same trick for marsh against dell.
 *
 * ⚠ PLACEHOLDER COLOURS, like every other material in this world — the look call is Alex's on
 * painted tiles. What is being fixed here is that there WAS no call to make: one grass block.
 */
export function landCharacter(m: GroundMaterials): Readonly<Record<LandId, LandCharacter>> {
  return {
    meadow:    { surface: m.topsoil,  accent: 0,         accentP: 0 },
    woodland:  { surface: m.topsoil,  accent: m.loam,    accentP: 0.26 },
    deepwood:  { surface: m.loam,     accent: m.topsoil, accentP: 0.14 },
    dell:      { surface: m.lush,     accent: m.topsoil, accentP: 0.18 },
    marsh:     { surface: m.mud,      accent: m.lush,    accentP: 0.30 },
    tableland: { surface: m.dry,      accent: m.topsoil, accentP: 0.12 },
    barrens:   { surface: m.dry,      accent: m.subsoil, accentP: 0.18 },
    // ⚠ NEITHER OF THESE MAY ACCENT WITH BARE STONE, and depth.test.ts §5 is what proved it: a
    // STONE surface voxel dithered onto an otherwise gentle column puts rock directly above the
    // soil band, which is a real inversion of the world's layering law, not a cosmetic one. SCREE
    // is the honest material for "rock breaking through turf" — it is a SURFACE, it makes no claim
    // about what is underneath, and on the steep ground where bedrock genuinely does surface, the
    // cliff rule in depth.ts already returns STONE and outranks all of this anyway. So a crag is
    // scree on its shoulders and bare rock on its faces, from two rules that already existed.
    highland:  { surface: m.highland, accent: m.scree,   accentP: 0.10 },
    crag:      { surface: m.scree,    accent: 0,         accentP: 0 },
  }
}

const sstep = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c) }
/** Rises from 0 at `at - f` to 1 at `at`. */
const above = (v: number, at: number, f: number): number => sstep((v - at) / f + 1)
/** Falls from 1 at `at` to 0 at `at + f`. */
const below = (v: number, at: number, f: number): number => sstep((at - v) / f + 1)
/** 1 across [lo, hi], easing to 0 across `f` on either side. */
const band = (v: number, lo: number, hi: number, f: number): number => Math.min(above(v, lo, f), below(v, hi, f))

const hash01 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * How much of each land is at this column, normalised to sum 1, indexed by `LAND_IDS`.
 *
 * ★ THE SCORES ARE PRODUCTS OF SOFT BANDS OVER THE EXISTING FIELDS, and there is deliberately no
 * new noise field among them: canon rules the Ather's one climate axis is MANA, not temperature, so
 * a new land has to be earned out of continentalness / erosion / weirdness / flatness / forest /
 * rivers or it does not exist. Every land below is a COMBINATION, which is also why they compose
 * instead of tiling — a high flat place is tableland, a high steep place is crag, and the ground
 * between them is genuinely both.
 *
 * `meadow` carries a floor term so the sum can never approach zero: open grass is what this world
 * is when it is not being anything else, and a normalisation that can divide by ~0 is a NaN waiting
 * for the one column where every band happens to miss.
 */
export function landWeights(
  x: number, z: number, seed: number,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number[] {
  const { continentalness: c, erosion: e, weirdness: w, flatness } = heightFields(x, z, seed, hcfg)
  // ⚠ RAW `peaksValleys`, NEVER `shapedPV`, and the first cut got this wrong at a cost of 44% of
  // the world. `shapedPV` COMPRESSES everything below VALLEY_FLOOR into a 0.05-wide sliver — that
  // is its entire job, it is what makes valley floors walkable — so every trough in the world comes
  // out at the same value and a threshold on it cannot tell a shallow dip from a deep glen. The
  // shaped value is for HEIGHT; the raw one is the only one that still carries how deep this is.
  const pv = peaksValleys(w)
  const flat = flatnessF(flatness)
  const forest = forestness(seed, x / 16, z / 16, cfg)
  // ── ★ MARSH IS MEASURED IN FIELD SPACE, NOT IN `riverness` ────────────────────────────────
  // `riverness` spans |w| 0.012..0.035 — the channel and its sand shoulders — and a band inside it
  // is a two-block ribbon that measured 1.3% of land: a fringe, not a place. `RIVER_APPROACH` (0.10)
  // is the width height.ts already treats as river COUNTRY, ~7x wider in field space, and that is
  // the ground a marsh actually occupies: outside the water and its beach, inside the valley the
  // water made. Same lesson the river field itself learned — the field's shape at its scale is a
  // design input, so read it at the scale of the thing you are describing.
  const aw = Math.abs(riverField(x, z, seed, hcfg))
  const wet = band(aw, 0.036, 0.088, 0.028)

  // See biome.ts's `canopy`: `forestness` saturates across a whole wood, so it cannot separate
  // a wood's edge from its heart. This can, and the two lands split the same country between them.
  const deep = above(canopy(seed, x / 16, z / 16, cfg), 0.62, 0.20)
  const wood = forest * (1 - deep)

  const out = [
    1.00 * (1 - forest) * (1 - 0.45 * flat),                              // meadow — the default
    1.05 * wood,                                                          // woodland
    1.05 * deep,                                                          // deepwood
    0.75 * below(pv, -0.62, 0.30) * (1 - 0.6 * deep),                     // dell — deep valley floors
    0.80 * wet * (1 - deep) * below(c, 0.62, 0.18),                       // marsh — the river's flats
    1.05 * flat * above(c, 0.58, 0.16) * (1 - forest),                    // tableland — high plains
    1.05 * above(e, 0.68, 0.19) * below(c, 0.74, 0.18) * (1 - forest),    // barrens — worn country
    1.00 * band(c, 0.66, 0.82, 0.11) * (1 - 0.6 * forest),                // highland
    1.50 * above(c, 0.80, 0.11),                                          // crag
  ]
  let sum = 0
  for (let i = 0; i < out.length; i++) sum += out[i]
  for (let i = 0; i < out.length; i++) out[i] /= sum
  return out
}

/**
 * ★ SHARPENING IS WHAT SEPARATES VARIETY FROM SPECKLE. Rolling the raw weights would dress a
 * 70/30 column as 70/30 confetti — every meadow permanently freckled with crag. Raising each
 * weight to a power before the roll leaves an interior effectively pure (0.90 vs 0.05 becomes
 * 0.9993 vs 0.0000004) while a genuine border, where two weights are close, still dithers. The
 * exponent is the one dial between "hard edges" and "static", and it is set by LOOKING at the map,
 * not by argument — the same way every other shape call in this stack was made.
 */
export const CHARACTER_SHARP = 4

/** The dominant land at this column, and how strongly it dominates (0..1). For labels and tests. */
export function dominantLand(w: number[]): { id: LandId; t: number } {
  let best = 0
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i
  return { id: LAND_IDS[best], t: w[best] }
}

/**
 * The land whose ground this column wears — the sharpened weighted roll.
 *
 * Deterministic: same coordinate, same seed, same answer, forever. Pure, and it never reads a
 * material, so it cannot disagree with the world it is dressing.
 */
export function landRollAt(
  x: number, z: number, seed: number,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): LandId {
  const w = landWeights(x, z, seed, cfg, hcfg)
  let sum = 0
  for (let i = 0; i < w.length; i++) { w[i] = Math.pow(w[i], CHARACTER_SHARP); sum += w[i] }
  const r = hash01(x, z, seed ^ 0x5b1f27) * sum
  let acc = 0
  for (let i = 0; i < w.length; i++) { acc += w[i]; if (r < acc) return LAND_IDS[i] }
  return 'meadow'
}

/**
 * The surface block for a column of open ground.
 *
 * ⚠ CALLED ONLY AFTER depth.ts's OWN SURFACE RULES HAVE PASSED — sea bed, beach, river bed, road,
 * courtyard, spring crust, cliff face and the GREYFIELD all win over land character and are
 * resolved before this is reached. That ordering is not an accident of where the call sits: the
 * greying is canon-load-bearing and its dither is tuned against `greyness`, so folding it into this
 * roll would change how the world's drained country reads in order to save one branch.
 */
export function surfaceBlockAt(
  x: number, z: number, seed: number, dress: Readonly<Record<LandId, LandCharacter>>,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  const ch = dress[landRollAt(x, z, seed, cfg, hcfg)]
  // ── ★ ACCENTS CLUMP. A FLAT PER-COLUMN HASH IS STATIC, NOT GROUND ──────────────────────────
  // The first cut rolled the accent on the hash alone, which is spatially independent by
  // construction — and independent noise at block scale is what television snow is. On the map it
  // read as a hiss laid over the barrens rather than as bare earth showing through. Modulating the
  // threshold by a small-scale field gathers it into patches instead, which is the same move
  // `flora.ts` already makes for flower drifts and for the same reason: real ground varies in
  // PLACES. The field's mean is 0.5, so `0.25 + 1.5f` averages 1 and the overall accent rate stays
  // exactly `accentP` — this changes where the accent lands, never how much of it there is.
  if (ch.accent) {
    const f = value2(x / 11, z / 11, seed ^ 0x7e2a1)
    if (hash01(x, z, seed ^ 0xa11e63) < ch.accentP * (0.25 + 1.5 * f)) return ch.accent
  }
  return ch.surface
}
