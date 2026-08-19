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
import { fbm2 } from './noise'

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
   * A second block PATCHED through the first, and the reason within-biome ground is not flat
   * colour: bare earth showing through a barrens, rock breaking a highland's turf, loam under a
   * wood's litter. 0 disables it.
   */
  accent: number
  /** Target share of columns wearing the accent. See `accentThreshold` — it is a share, not a
   *  per-block probability, and the difference is what stopped the marsh looking like lino. */
  accentP: number

  // ── Slice ② (2026-08-19): what GROWS here ────────────────────────────────────────────────────
  /**
   * Trunk-count multiplier. **0 means no trees, and that is a character rather than an omission** —
   * Alex's ask names it: *"producing a certain tree (or no trees)"*. Bare country is what makes
   * wooded country read as wooded.
   *
   * ⚠ THIS MULTIPLIES THE FOREST MASK, IT DOES NOT REPLACE IT. `forestness` still decides where a
   * forest IS (Alex's standing rule: a forest is a place you enter and leave, not a global
   * density). This says how readily a given land carries trees at all, which is a different
   * question — a tableland can sit inside a forest mask and still be open country.
   */
  treeK: number
  /** Per-species weight multipliers, by species id. Absent = 1. See `speciesFactor`. */
  trees: Readonly<Record<string, number>>
  /** Ground-cover density multiplier — tufts and tall grass together. */
  floraK: number
  /** Flower-share multiplier, applied inside a drift. */
  flowerK: number
  /** Tall-grass share multiplier. High is how a marsh reads as reeds and a dell as deep grass. */
  tallK: number
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
    meadow:    { surface: m.topsoil,  accent: 0,         accentP: 0,
      treeK: 1,    floraK: 1.15, flowerK: 1.35, tallK: 1.0,
      trees: { goldwood: 1.0, shimmeroak: 1.0, starwillow: 0.8, dawnwood: 0.3 } },
    woodland:  { surface: m.topsoil,  accent: m.loam,    accentP: 0.20,
      treeK: 1,    floraK: 0.9,  flowerK: 0.7,  tallK: 1.0,
      trees: { goldwood: 1.0, shimmeroak: 1.4, starwillow: 1.0, dawnwood: 1.0 } },
    deepwood:  { surface: m.loam,     accent: m.topsoil, accentP: 0.12,
      treeK: 1.18, floraK: 0.45, flowerK: 0.30, tallK: 0.8,
      trees: { goldwood: 0.7, shimmeroak: 1.2, starwillow: 1.0, dawnwood: 4.0 } },
    dell:      { surface: m.lush,     accent: m.topsoil, accentP: 0.14,
      treeK: 0.9,  floraK: 1.30, flowerK: 1.0,  tallK: 2.2,
      trees: { goldwood: 0.6, shimmeroak: 1.0, starwillow: 3.5, dawnwood: 0.5 } },
    // ★★ TURF WITH MUD THROUGH IT, NOT MUD WITH TURF THROUGH IT (flipped 2026-08-19, from the
    // render). The first cut made mud the base at 78% and the screenshot named it: that is a
    // MUDFLAT, not a marsh. A marsh is wet ground that GROWS — dense reeds standing in it, bare
    // soft patches between — so the turf is the base and the mud is what shows through. It also
    // makes the rest of the row work: mud is outside TURF, so with mud as the base almost nothing
    // could grow here and `tallK: 3.0` was buying reeds for a fifth of the columns.
    marsh:     { surface: m.lush,     accent: m.mud,     accentP: 0.35,
      treeK: 0.35, floraK: 1.10, flowerK: 0.40, tallK: 3.0,
      trees: { goldwood: 0.3, shimmeroak: 0.5, starwillow: 4.0, dawnwood: 0.2 } },
    tableland: { surface: m.dry,      accent: m.topsoil, accentP: 0.12,
      treeK: 0.45, floraK: 0.70, flowerK: 0.80, tallK: 0.5,
      trees: { goldwood: 1.6, shimmeroak: 0.8, starwillow: 0.3, dawnwood: 0.3 } },
    barrens:   { surface: m.dry,      accent: m.subsoil, accentP: 0.14,
      treeK: 0.15, floraK: 0.30, flowerK: 0.35, tallK: 0.3,
      trees: { goldwood: 1.4, shimmeroak: 0.6, starwillow: 0.2, dawnwood: 0.2 } },
    // ⚠ NEITHER OF THESE MAY ACCENT WITH BARE STONE, and depth.test.ts §5 is what proved it: a
    // STONE surface voxel dithered onto an otherwise gentle column puts rock directly above the
    // soil band, which is a real inversion of the world's layering law, not a cosmetic one. SCREE
    // is the honest material for "rock breaking through turf" — it is a SURFACE, it makes no claim
    // about what is underneath, and on the steep ground where bedrock genuinely does surface, the
    // cliff rule in depth.ts already returns STONE and outranks all of this anyway. So a crag is
    // scree on its shoulders and bare rock on its faces, from two rules that already existed.
    highland:  { surface: m.highland, accent: m.scree,   accentP: 0.09,
      treeK: 0.5,  floraK: 0.65, flowerK: 0.90, tallK: 0.5,
      trees: { goldwood: 2.0, shimmeroak: 0.8, starwillow: 0.2, dawnwood: 0.3 } },
    // ★ THE ONE LAND THAT GROWS NOTHING AT ALL, stated twice on purpose. Its ground is outside
    // TURF so the planter already refuses it; `treeK: 0` says the same thing from the other side,
    // so a future ground change cannot quietly forest a crag by making scree plantable.
    crag:      { surface: m.scree,    accent: 0,         accentP: 0,
      treeK: 0,    floraK: 0.05, flowerK: 0,    tallK: 0,
      trees: {} },
  }
}

/**
 * A character dial, BLENDED across the lands at this column rather than rolled.
 *
 * ★★ THIS IS THE HALF OF THE SIBLING LAW THAT THE GROUND ROLL IS NOT. A block is discrete — you
 * cannot lay down 0.6 of a turf — so `surfaceBlockAt` rolls and lets the dither carry the border.
 * A DENSITY is continuous, so it blends, and blending is strictly better wherever it is available:
 * the tree count easing from 1.18 in a wood core to 0.15 in a barrens has no border at all, not
 * even a dithered one. Rolling a density would quantise a smooth quantity for no reason and put a
 * visible seam back into the one place we could have had none.
 */
function blend(w: number[], dress: Readonly<Record<LandId, LandCharacter>>, pick: (c: LandCharacter) => number): number {
  let v = 0
  for (let i = 0; i < w.length; i++) v += w[i] * pick(dress[LAND_IDS[i]])
  return v
}

/** Trunk-count multiplier at this column, 0 (bare) .. ~1.2 (forest core). Blended. */
export function treeDensityAt(
  x: number, z: number, seed: number, dress: Readonly<Record<LandId, LandCharacter>>,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  return blend(landMix(x, z, seed, cfg, hcfg), dress, c => c.treeK)
}

/**
 * How much this place favours a species, as a multiplier on its base weight.
 *
 * ★ MOVED HERE FROM biome.ts 2026-08-19, and the move is forced rather than tidy: species
 * preference is land CHARACTER, and reading it from the land weights means the woods change with
 * the country instead of against a second, private opinion about altitude. biome.ts could not host
 * it — it would have to import character.ts, which imports biome.ts.
 *
 * ★ WEIGHTS STAY WEIGHTS (trees.ts's own rarity rule): a species is never placed by its own pass,
 * it just gets heavier where it belongs. Species NAMES and drop tables are canon; where each one
 * likes to grow is build tuning and is mine.
 */
export function speciesFactor(
  id: string, seed: number, cx: number, cz: number,
  dress: Readonly<Record<LandId, LandCharacter>>,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  return blend(landMix(cx * 16 + 8, cz * 16 + 8, seed, cfg, hcfg), dress, c => c.trees[id] ?? 1)
}

/** Ground-cover dials at this column: overall density, flower share, tall-grass share. Blended. */
export function floraCharacterAt(
  x: number, z: number, seed: number, dress: Readonly<Record<LandId, LandCharacter>>,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): { floraK: number; flowerK: number; tallK: number } {
  const w = landMix(x, z, seed, cfg, hcfg)
  return {
    floraK: blend(w, dress, c => c.floraK),
    flowerK: blend(w, dress, c => c.flowerK),
    tallK: blend(w, dress, c => c.tallK),
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

/**
 * The weights, sharpened and renormalised — **the distribution every consumer actually reads.**
 *
 * ★★ ONE DISTRIBUTION, READ TWO WAYS, and unifying this fixed a real dilution rather than tidying
 * anything. The roll sharpened; the blend did not. So a dell — whose raw weight peaks around 0.5,
 * because the meadow floor term and the overlapping bands never let the specialised lands run away
 * with a column — got its GROUND from a sharpened roll and only half its CHARACTER from an
 * unsharpened blend. Its `tallK` of 3.0 arrived on the ground as about 1.6, and a marsh that is
 * supposed to read as reeds read as slightly long grass. Measured: with dominance taken on raw
 * weights, dell, marsh, highland and crag NEVER cleared 0.62 anywhere in a 240×240-chunk window.
 *
 * ★ AND SHARPENING COSTS THE BLEND NOTHING, which is why this is safe. `wᵏ / Σwᵏ` is smooth in w —
 * continuity is preserved exactly, so the no-seam property the blend exists for is untouched. The
 * only thing that changes is how confidently a land speaks for its own interior.
 */
export function sharpenWeights(w: number[]): number[] {
  let sum = 0
  for (let i = 0; i < w.length; i++) { w[i] = Math.pow(w[i], CHARACTER_SHARP); sum += w[i] }
  for (let i = 0; i < w.length; i++) w[i] /= sum
  return w
}

/** The sharpened distribution at a column — what the roll and every dial read. */
export function landMix(
  x: number, z: number, seed: number,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number[] {
  return sharpenWeights(landWeights(x, z, seed, cfg, hcfg))
}

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
  const w = landMix(x, z, seed, cfg, hcfg)
  const r = hash01(x, z, seed ^ 0x5b1f27)
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
  if (ch.accent && accentAt(x, z, seed, ch.accentP)) return ch.accent
  return ch.surface
}


/**
 * ── ★★ ACCENTS ARE PATCHES, NOT SPECKLE, AND THIS WAS LEARNED FROM A SCREENSHOT ────────────────
 * Two earlier cuts both failed, and both failed for the same reason wearing different clothes:
 *
 *   1. a flat per-column hash — spatially independent by construction, which at block scale is
 *      television snow;
 *   2. a hash whose PROBABILITY was modulated by a small field — which gathers the accent into
 *      regions but still decides every block independently inside one, so the result is a
 *      dense scatter of ISOLATED single blocks. In the world that read as a chessboard: the marsh
 *      came out as alternating mud and turf tiles, a lino floor rather than wet ground, and the
 *      barrens the same in brown. **The oracles were all green — the render is what caught it.**
 *
 * The requirement neither cut satisfied is CONTIGUITY. Ground does not vary block by block; it
 * varies in patches several blocks across. Only a threshold on a smooth field gives that, because
 * neighbouring columns then share the field value that decided them. So the field decides, and the
 * hash is demoted to fraying the boundary — which is exactly the division of labour `greySurfaceAt`
 * uses, and the reason the greyfield has always read as guttering rather than as dither.
 */
const ACCENT_SCALE = 6.5
/** Field-space width of the ragged boundary. Wider reads as speckle again; 0 reads as cut vinyl. */
const ACCENT_FRAY = 0.022

/**
 * Field threshold for a target share, fitted to `fbm2`'s own distribution.
 *
 * ⚠ `accentP` IS A SHARE AND THE FIELD IS NOT UNIFORM, so it cannot be used as a threshold
 * directly — fbm2 clusters hard around 0.5 (measured over 400k samples: q50 0.502, q80 0.647,
 * q90 0.711), so a naive `f > 1 - p` would put the accent on a fraction of a percent of the world
 * instead of the fifth the table asks for. This quadratic is a least-squares fit through the
 * measured quantiles over the range the table actually uses (p from 0.05 to 0.35) and is accurate
 * to about a point of share across it. `character.test.ts` asserts the REALIZED share against the
 * table, so this approximation cannot drift out of agreement with the numbers it is fitted to.
 */
export function accentThreshold(p: number): number {
  return 0.8043 - 0.9715 * p + 0.9127 * p * p
}

/** Is this column one of its land's accent patches? */
export function accentAt(x: number, z: number, seed: number, accentP: number): boolean {
  if (accentP <= 0) return false
  const f = fbm2(x / ACCENT_SCALE, z / ACCENT_SCALE, seed ^ 0x7e2a1, 2)
  const t = accentThreshold(accentP)
  const d = f - t
  if (d > ACCENT_FRAY) return true
  if (d < -ACCENT_FRAY) return false
  // The boundary, frayed: inside the band the hash decides, so a patch edge is ragged rather than
  // a contour. Weighted by how far across the band we are, so the fray has no hard side.
  return hash01(x, z, seed ^ 0xa11e63) < (d + ACCENT_FRAY) / (2 * ACCENT_FRAY)
}

/**
 * ── ★ FINDING A LAND, because 6,000 blocks of country is not a browsable index ──────────────────
 * Alex, 2026-08-19: *"is it possible to set up test maps to see the biome gen in action without
 * wandering for 30 min looking for one?"* — and he is describing a real property of the thing we
 * built, not a missing convenience. Highland is 4% of the world and crag 2%, so the two most
 * visually distinct grounds are the two you are least likely to walk into. A generator you cannot
 * review is a generator that gets tuned by argument.
 *
 * ★ ONE DEFINITION, TWO CONSUMERS — the `/land` console command a keeper types and the headless
 * contact sheet (`scripts/land-tour.mts`). If they searched separately they would disagree about
 * where a dell is, and the picture would stop being evidence for the place you can walk to.
 *
 * Returns a site in the INTERIOR of each land — near, but interior first. A near-perfect dell four
 * thousand blocks away is still a worse answer than a good one over the hill (the point is to stand
 * in it), so distance is a cost rather than the sort key.
 *
 * ── ★★ AND "NEAREST ABOVE A FLOOR" WAS THE WRONG SORT KEY, WHICH TOOK A SCREENSHOT TO SEE ───────
 * The first cut took the nearest column clearing `minT`. That reads as obviously right and it is
 * obviously wrong the moment anything is excluded: **a nearest-search against a hard exclusion
 * always answers on its boundary.** `maxShellRadius(WILDS_BUBBLE)` is 515, the tour passes a 220
 * clearance margin, and the contact sheet came back with EIGHT OF NINE SITES AT 735-738 BLOCKS —
 * nine compass bearings on one ring, every one of them the fringe of its land rather than its
 * interior. The clearance margin had not fixed the pile-up against the cloud wall; it had moved it
 * one radius out and bought a picture of the ring instead.
 *
 * ★★ AND NEITHER ASSERT COULD SEE IT. `!exclude(x,z)` passes on a ring site and `t >= 0.62` passes
 * on a ring site; the suite measured HOW MUCH land was at the point and nothing measured WHAT WAS
 * AROUND IT. Same family as the accent chessboard one screen up — 225 green asserts shipped a marsh
 * that looked like lino, because every one of them counted and none of them looked at shape.
 *
 * ★ SO THE SCORE IS THE NEIGHBOURHOOD, NOT THE POINT. `interiorAt` samples two rings around a
 * candidate and asks how much of them is still the same land, counting an EXCLUDED probe as not
 * interior — which is what drags a site off the boundary without the search knowing anything about
 * what the exclusion means. Distance is then a mild subtraction, so a clearly better interior can
 * pull you further out and a tie goes to the nearer.
 *
 * ⚠ THE EXAMINED SET MUST SPAN THE RADIUS, and scoring the nearest N would have re-created the very
 * bug it fixes: for a common land the nearest N candidates are all on the same fringe, so the best
 * of them is still a fringe. The pool is sampled by rank as well as taken from the front.
 *
 * ⚠ PASS `exclude`. THE FIRST RUN WITHOUT ONE PRODUCED NINE SITES AND EIGHT IDENTICAL PICTURES.
 * "Nearest" from spawn means inside the fold's bubble, where there is no ground at any altitude, so
 * every teleport silently failed and the contact sheet was eight copies of the spawn view — which
 * reads as *"the biome layer does nothing"*, not as *"the tour is broken"*. `column.ts` exports
 * `wildsSwallows` for exactly this and both callers pass it. This module cannot import it directly:
 * column → depth → character, and the cycle would be real.
 */
export interface LandSite { id: LandId; x: number; z: number; t: number; dist: number; interior: number }

/**
 * How much of a candidate's SURROUNDINGS is the same land. Two rings rather than one because a
 * single radius can sit neatly inside a lobe of a border and report an interior that isn't there;
 * the outer ring is offset by half a step so the spokes do not line up into a star whose arms can
 * slip either side of the same boundary.
 *
 * ⚠ AN EXCLUDED PROBE COUNTS AS NOT-INTERIOR — it stays in the denominator. A site on the ring has
 * half its neighbourhood inside the excluded disc, so it cannot score above ~0.5. The search never
 * has to know what the exclusion MEANS, only that you cannot stand there, which is what the
 * predicate already says.
 *
 * ★ BUT BE HONEST ABOUT WHAT THAT LINE IS WORTH: it is a GUARD, not the mechanism. Mutating it to
 * drop excluded probes from the denominator instead leaves the whole suite green, because what
 * actually unpins the search is scoring the neighbourhood at all, plus spreading the examined
 * sample across the pool. So it is pinned directly, on `interiorAt` itself (§15e), rather than left
 * to a site-selection assert that would pass either way — a comment claiming a mechanism no test
 * can feel is the kind of decoration this file keeps having to delete.
 */
const INTERIOR_RINGS = [40, 96] as const
const INTERIOR_SPOKES = 6

export function interiorAt(
  x: number, z: number, id: LandId, seed: number,
  exclude?: (x: number, z: number) => boolean,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  let hit = 0, n = 0
  for (let r = 0; r < INTERIOR_RINGS.length; r++) {
    const rad = INTERIOR_RINGS[r]
    const phase = (r % 2) * (Math.PI / INTERIOR_SPOKES)
    for (let s = 0; s < INTERIOR_SPOKES; s++) {
      const a = phase + (s * 2 * Math.PI) / INTERIOR_SPOKES
      const px = Math.round(x + rad * Math.cos(a)), pz = Math.round(z + rad * Math.sin(a))
      n++
      if (exclude?.(px, pz)) continue
      if (dominantLand(landMix(px, pz, seed, cfg, hcfg)).id === id) hit++
    }
  }
  return hit / n
}

export function findLands(
  fromX: number, fromZ: number, seed: number,
  opts: {
    radius?: number; stride?: number; minT?: number
    exclude?: (x: number, z: number) => boolean
    /** How far a better interior is allowed to pull the answer out. 0 = pure nearest (the old bug). */
    distCost?: number
    /**
     * Candidates actually scored per land, taken from the front AND spread across the pool.
     * ⚠ MEASURED, NOT PICKED: at 40 the worst site scored 58% interior and at 400 it scores 83%,
     * for the SAME ~310ms — the cost here is phase 1's grid scan, and phase 2 disappears into it
     * (800 is where it starts to show, at 494ms). A budget that looks generous is free; the one
     * that looked frugal was buying a fringe woodland at full price.
     */
    examine?: number
  } = {},
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): LandSite[] {
  const radius = opts.radius ?? 2600
  const stride = opts.stride ?? 24
  const minT = opts.minT ?? 0.62
  const distCost = opts.distCost ?? 0.35
  const examine = opts.examine ?? 400

  // ── phase 1: clearing the floor makes a column a CANDIDATE, never an answer ───────────────────
  const pool = new Map<LandId, LandSite[]>()
  for (let dz = -radius; dz <= radius; dz += stride) {
    for (let dx = -radius; dx <= radius; dx += stride) {
      const x = fromX + dx, z = fromZ + dz
      if (opts.exclude?.(x, z)) continue
      const { id, t } = dominantLand(landMix(x, z, seed, cfg, hcfg))
      if (t < minT) continue
      const arr = pool.get(id)
      const site: LandSite = { id, x, z, t, dist: Math.hypot(dx, dz), interior: 0 }
      if (arr) arr.push(site); else pool.set(id, [site])
    }
  }

  // ── phase 2: score the neighbourhood of a spread sample, not the point of the nearest ─────────
  const out: LandSite[] = []
  for (const id of LAND_IDS) {
    const arr = pool.get(id)
    if (!arr) continue
    arr.sort((a, b) => a.dist - b.dist)
    // The front of the list is where the nearest answer lives; the stride across the whole list is
    // what stops a common land from being judged entirely on its fringe. Both, deduped by index.
    const step = Math.max(1, Math.floor(arr.length / examine))
    const idx = new Set<number>()
    for (let i = 0; i < Math.min(examine, arr.length); i++) idx.add(i)
    for (let i = 0; i < arr.length; i += step) idx.add(i)

    let best: LandSite | undefined
    let bestScore = -Infinity
    for (const i of idx) {
      const c = arr[i]
      const interior = interiorAt(c.x, c.z, id, seed, opts.exclude, cfg, hcfg)
      const score = interior - distCost * (c.dist / radius)
      if (score > bestScore) { bestScore = score; best = { ...c, interior } }
    }
    if (best) out.push(best)
  }
  // Stable order: the table's order, so two runs read the same way down the page.
  const byId = new Map(out.map(s => [s.id, s]))
  return LAND_IDS.map(id => byId.get(id)).filter((s): s is LandSite => !!s)
}
