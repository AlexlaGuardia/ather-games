// What a breaking block THROWS — the pure half of the block-break effect.
//
// ★ NO THREE, NO DOM, NO REACT. A recipe is a rule about a material, not a rendering concern, so it
// lives here and is testable without a browser — the same split `voxel/mine.ts` draws between what
// mining IS and what draws it. `break-fx.ts` owns the GPU side and imports this; nothing here knows
// that particles exist.
//
// ── ★★★ EVERY CLASSIFICATION BELOW IS DERIVED, AND THAT IS THE WHOLE DESIGN ───────────────────
// The tempting shape is a table: material id → how it shatters. This repo has paid for that twice
// in a week — a hand-kept "can't do these yet" list still naming ids that had shipped, and a test
// mirroring a host's private set until the copy and its source agreed perfectly and were both
// wrong. So a bucket is read off facts the build already maintains for other reasons:
// `blockDef().skill` (the tool-gating vocabulary: prospecting / forestry / farming) and the range
// predicates in `voxel/`. **A material added next month lands in a bucket without anyone
// remembering this file exists**, and `break-fx-spec.test.ts` fails if one lands nowhere.
//
// ── ★★ COLOUR COMES FROM `MATERIAL_COLOR`, WHICH IS UPSTREAM OF THE ART, NOT BESIDE IT ────────
// `attrs.ts`'s `MATERIAL_COLOR` is what the flat path renders as vertex colour AND what every
// procedural painter in `tex/atlas.ts` takes as its base tone before it speckles and veins. So
// reading it here is reading the same value the world reads, one step earlier. ⚠ The alternative —
// sampling the atlas — would be a SECOND derivation of the same fact, and two consumers deriving
// from one source can still disagree about a property the source does not carry. That is exactly
// how a sapling's icon came to be a cube while the world drew a cross.

import { MAT, baseOf, isPlant, isSapling } from '../voxel/depth'
import { isOre } from '../voxel/ore'
import { isLogMat, isLeafMat } from '../voxel/trees'
import { blockDef } from '../voxel/registry'
import { MATERIAL_COLOR } from './attrs'

/**
 * How a material comes apart. Six kinds, because six is how many distinct MOTIONS there are —
 * not how many materials there are.
 *
 * ⚠ There is no `ice`, `glass` or `gravel` bucket because this world has no such blocks. I pitched
 * all three to Alex from Minecraft habit and `depth.ts` says otherwise. If one is ever added it
 * arrives through `blockDef().skill` like everything else, and the guard will say so.
 */
export type BreakBucket = 'stone' | 'ore' | 'wood' | 'leaf' | 'plant' | 'sand'

/**
 * Which bucket a material breaks into.
 *
 * ★ ORDER IS LOAD-BEARING AND IS NOT ALPHABETICAL. Ore's skill is `prospecting`, so a plain
 * `skill === 'prospecting'` test would swallow it; leaves and logs share one id range and are told
 * apart only by parity. Each branch below is therefore the NARROWEST claim that is still true, and
 * they run narrowest-first. The last branch is the widest and is the one to be suspicious of.
 */
export function bucketOf(material: number): BreakBucket | null {
  const m = baseOf(material)
  if (m === MAT.AIR) return null
  if (isLeafMat(m)) return 'leaf'
  if (isLogMat(m)) return 'wood'
  if (isSapling(m) || isPlant(m)) return 'plant'
  if (isOre(m)) return 'ore'
  if (m === MAT.SAND) return 'sand'
  const def = blockDef(m)
  if (!def) return null
  // Everything else that a keeper can strike is treated as masonry. `forestry` here means a wooden
  // BUILT thing (a plank floor, a bench) rather than a living log — it still splinters, so it takes
  // the wood motion; `farming` means soil, which crumbles like soft stone rather than scattering
  // like a plant. Both are deliberate widenings of a narrow bucket, not defaults.
  if (def.skill === 'forestry') return 'wood'
  return 'stone'
}

/** One material's worth of thrown matter. Distances are blocks, times are seconds. */
export interface ChipRecipe {
  /** Chips thrown by a completed break. */
  burst: number
  /** Chips per second while a keeper is mid-swing at full progress. */
  swingRate: number
  /** Initial speed along the struck face's normal, blocks/sec. */
  speed: number
  /** How far off that normal a chip may wander, 0 = a perfect jet, 1 = a hemisphere. */
  spread: number
  /** Blocks/sec². Negative RISES — nothing uses that yet and the canon gap is why (see below). */
  gravity: number
  /** Velocity retained per second. 1 = frictionless, 0.1 = thick air. */
  drag: number
  /** Seconds a chip lives. */
  life: number
  /**
   * Chip size in BLOCKS, not pixels.
   *
   * ⚠ IT WAS PIXELS IN THE FIRST DRAFT AND THE JUDGING PAGE KILLED IT ON SIGHT: a fixed pixel size
   * makes a chip the size of the block it came off when you stand near it and confetti when you
   * stand back. A fragment has a real size in the world; the shader converts. Every test was green.
   */
  size: number
}

/**
 * ── ★ THESE NUMBERS ARE A FIRST GUESS AND ARE MEANT TO BE ARGUED WITH ─────────────────────────
 * They were tuned by eye in `/shimmer/dev/break`, on a desktop, in one sitting. Feel is Alex's call
 * and the judging page exists so it can be HIS call rather than mine. What is NOT a guess is the
 * relative shape between buckets: stone throws fast and dies quickly, wood throws fewer and larger
 * and slower, a leaf barely falls at all, sand does not throw — it slumps. That shape is the
 * feature; the decimals are decoration.
 */
const RECIPES: Record<BreakBucket, ChipRecipe> = {
  stone: { burst: 14, swingRate: 9,  speed: 3.0, spread: 0.45, gravity: 11, drag: 0.35, life: 0.55, size: 0.075 },
  ore:   { burst: 16, swingRate: 10, speed: 3.4, spread: 0.5,  gravity: 11, drag: 0.35, life: 0.65, size: 0.085 },
  wood:  { burst: 10, swingRate: 6,  speed: 2.3, spread: 0.35, gravity: 8,  drag: 0.5,  life: 0.8,  size: 0.13 },
  leaf:  { burst: 12, swingRate: 5,  speed: 0.9, spread: 0.85, gravity: 0.7, drag: 0.8, life: 1.6,  size: 0.14 },
  plant: { burst: 8,  swingRate: 5,  speed: 1.3, spread: 0.7,  gravity: 5,  drag: 0.6,  life: 0.7,  size: 0.10 },
  // ★ Sand is the one bucket whose CHARACTER is an absence: almost no outward speed and the
  // heaviest fall, so it reads as a face collapsing rather than a block shattering.
  sand:  { burst: 16, swingRate: 8,  speed: 0.5, spread: 0.25, gravity: 15, drag: 0.2,  life: 0.45, size: 0.055 },
}

export const recipeFor = (bucket: BreakBucket): ChipRecipe => RECIPES[bucket]

/** Every bucket that has a recipe — the guard counts against this rather than a literal. */
export const ALL_BUCKETS = Object.keys(RECIPES) as BreakBucket[]

/**
 * The colour a chip of this material carries.
 *
 * ⚠ RETURNS THE MESHER'S OWN VALUE OR A LOUD MAGENTA — never a quiet grey. An unmapped material
 * should look wrong on screen the moment it is struck, the way `tiles.ts` answers an unmapped tile
 * with `FALLBACK_LAYER`. A plausible grey chip off an unmapped block is a bug nobody reports.
 */
export const FALLBACK_COLOR = 0xff00ff
export const chipColor = (material: number): number =>
  MATERIAL_COLOR[baseOf(material)] ?? FALLBACK_COLOR

/**
 * How many chips a swing throws this frame.
 *
 * ★ IT TAKES THE PROGRESS FRACTION, NOT THE ELAPSED TIME, so a tough block and a soft one look the
 * same at the same point in their break rather than the tough one raining chips for ten seconds.
 * The ramp is deliberately shallow at the start: the first tap should say "this is going to take a
 * while", not spray.
 *
 * Returns a FRACTIONAL count. The caller accumulates it — rounding here would emit zero forever at
 * any rate below one per frame, which at 60fps is every rate this file uses.
 */
export function swingChips(bucket: BreakBucket, progress01: number, dt: number): number {
  const p = progress01 < 0 ? 0 : progress01 > 1 ? 1 : progress01
  // 0.35 at the first contact, 1.0 as the block gives — a curve, so the ramp is felt, not counted.
  const ramp = 0.35 + 0.65 * p * p
  return RECIPES[bucket].swingRate * ramp * dt
}

/**
 * ── ⛔ WHAT IS DELIBERATELY MISSING, AND WHY IT IS NOT AN OVERSIGHT ────────────────────────────
 * Raw mana and ather crystal take the `ore` recipe above: they FALL, like rubble. That is not a
 * decision about mana, it is the absence of one. Whether freed mana rises is a claim about what
 * mana IS, and by the 2026-07-21 garden ruling — *"hue identity + meaning = canon; exact
 * fog/particle/shader tuning = Jin's build"* — that half belongs to the Magii seat. Filed as an
 * open gap 2026-08-28.
 *
 * ⚠ AND THE WORD FOR IT IS NOT "MOTES". Canon ruled that noun on 2026-07-21 for the Anemonyx's
 * wind-borne seeds, and reusing it here would put seeds in the air every time a keeper hit a rock.
 * `ChipRecipe.gravity` accepts a negative value so the ruling can land as one number, but nothing
 * passes one today. **A rock that behaves like a rock invents nothing** — that is the fail-quiet
 * direction, and it is why this ships without the answer.
 */
