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
import { isOre, ORE } from '../voxel/ore'
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
export type BreakBucket = 'stone' | 'crystal' | 'rawmana' | 'wood' | 'leaf' | 'plant' | 'sand'

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
  // ── ★★ THE LATTICE SPLITS THE PROSPECTING LADDER IN TWO, AND CANON DREW THE LINE ────────────
  // `world/mother.md` › *What a broken mana block does* (RULED 2026-08-28): **the lattice is what
  // holds mana still. Break the lattice and it stops holding — exactly at the break, and only
  // there.** So crystal shards are STILL lattice and still hold (they fall lit, and only the new
  // fracture faces breathe), while raw mana never had a lattice and has nothing keeping it, so it
  // breathes out almost entirely and what falls is dull spent stone.
  // ⚠ RAW_MANA MUST BE TESTED BEFORE `isOre`, which spans the whole ladder RAW_MANA..ATHER_CRYSTAL
  // and would otherwise swallow it — the same narrowest-first rule the header states, now with a
  // case where getting it backwards is silent: every seam would simply read as crystal.
  if (m === ORE.RAW_MANA) return 'rawmana'
  if (isOre(m)) return 'crystal'
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
   * Brightness multiplier on the fragment's own colour. **1 = ordinary matter**, reflecting the
   * world and nothing more. **>1 = still lit from within** — canon's crystal, whose shards keep
   * their lattice. **<1 = spent**, the light has left it: raw mana's *"dull spent stone"*.
   *
   * ⚠ THIS IS A CANON FACT WEARING A NUMBER, not a look I chose. `shimmer-resources.md` › *the
   * light law now covers the BREAK*: crystal shards *"stay lit from within"*, raw mana *"leaves
   * dull spent stone"*. The DECIMALS are mine (feel is the build's); the ORDERING is not, and
   * `break-fx-spec.test.ts` asserts the ordering rather than the values.
   */
  glow: number
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
  stone:   { burst: 14, swingRate: 9,  speed: 3.0, spread: 0.45, gravity: 11,  drag: 0.35, life: 0.55, glow: 1,    size: 0.075 },
  // ★ Crystal falls LIT. The shards are still lattice, so they still hold their own light — the one
  // bucket whose fragments are brighter than the block they came off, because a fracture face is
  // fresh where the weathered outside was not.
  crystal: { burst: 16, swingRate: 10, speed: 3.4, spread: 0.5,  gravity: 11,  drag: 0.35, life: 0.65, glow: 1.45, size: 0.085 },
  // ★ Raw mana falls DULL. Same motion as any other seam — canon is explicit that the substance
  // behaves like matter — but the light has already left it by the time it lands.
  rawmana: { burst: 16, swingRate: 10, speed: 3.3, spread: 0.5,  gravity: 11,  drag: 0.35, life: 0.65, glow: 0.5,  size: 0.085 },
  wood:    { burst: 10, swingRate: 6,  speed: 2.3, spread: 0.35, gravity: 8,   drag: 0.5,  life: 0.8,  glow: 1,    size: 0.13 },
  leaf:    { burst: 12, swingRate: 5,  speed: 0.9, spread: 0.85, gravity: 0.7, drag: 0.8,  life: 1.6,  glow: 1,    size: 0.14 },
  plant:   { burst: 8,  swingRate: 5,  speed: 1.3, spread: 0.7,  gravity: 5,   drag: 0.6,  life: 0.7,  glow: 1,    size: 0.10 },
  // ★ Sand is the one bucket whose CHARACTER is an absence: almost no outward speed and the
  // heaviest fall, so it reads as a face collapsing rather than a block shattering.
  sand:    { burst: 16, swingRate: 8,  speed: 0.5, spread: 0.25, gravity: 15,  drag: 0.2,  life: 0.45, glow: 1,    size: 0.055 },
}

/**
 * ── ★★★ THE BREATH — what a broken mana block gives up, RULED 2026-08-28 ──────────────────────
 * `design-briefs/shimmer-resources.md` › *the light law now covers the BREAK*, authority in
 * `world/mother.md` › *What a broken mana block does*:
 *
 *   **The substance falls. The freed light rises, outward, and fades. It is never collectable.**
 *   **The canon word for it is `breath` — the block breathes out.**
 *
 * ⛔ **NOT `motes`.** That noun is ruled (2026-07-21) and means the Anemonyx's wind-borne seeds.
 * Reusing it here would put seeds in the air every time a keeper hit a rock. The guard asserts the
 * word `motes` appears nowhere in this module, because the cheapest way to reintroduce it is for
 * someone who never read the ruling to reach for the obvious English word.
 *
 * ★ A BREATH IS A `ChipRecipe` WITH NEGATIVE GRAVITY, and that is not a shortcut — the field's own
 * doc has said *"negative RISES"* since the first draft, written the day the gap was filed, against
 * the day the ruling would land. Nothing new was needed to express it.
 *
 * ⛔ ONLY MANA BREATHES — A FELLED TREE DOES NOT. **RULED 2026-08-28 (`828fe74`), raised from this
 * module.** The light law's older half says mana lives in *living* matter and working it releases
 * the mana, which reads as though timber should breathe too. It does not, and canon rules it out
 * with a POSITIVE statement rather than a silence: the resource table files *"raw but cut"* as
 * *"faint, at the edges only — a fresh branch."* **If the cut released the mana, a fresh branch
 * would be DULL. Canon says it is not**, so nothing left at the cut and there was never a breath.
 *
 * ★★ THE RECONCILIATION IS A TIMESCALE, AND THE LATTICE SETS IT — the same lattice that splits the
 * ladder above. A breath is what a lattice failing **at once** looks like; a fracture is a single
 * event, so the release is a single event. Living matter has no lattice — it holds mana in tissue
 * and gives it up **gradually, across the working and the drying**. Standing tree → cut branch
 * (faint at the edges) → plank (dull) IS that release, already written out. **The light law is the
 * slow version of this file; the breath is the fast one.** Both halves were always true.
 *
 * ⚠⚠ AND DO **NOT** WIDEN THE GUARD TO *"matter that was never alive does not breathe"* — I offered
 * exactly that generalisation when I handed the question back, and canon refused it: **the true
 * rule is narrower, not broader.** Nothing breathes but mana. A guard that says so is finished.
 *
 * ── ⚠⚠ THE DIALS ARE HEAVY DRAG AND A NEARLY-FLAT LIFT, AND THAT IS NOT A TASTE ─────────────
 * A negative gravity does not make a thing "float", it makes it ACCELERATE UPWARD FOREVER, toward a
 * terminal rise of `-gravity / -ln(drag)`. My first pass shipped -1.5 against drag 0.66, which is a
 * **3.6 blocks/sec** terminal climb: a raw mana breath rose **2.7 blocks typically and 4.0 at the
 * tail**, a plume taller than the keeper watching it. **That is a mana-well**, and canon rules in
 * the same breath that *"the mana-well is the fountain, a break is a leak — keep them different on
 * sight."* Every assert was green, because "gravity is negative" answers WHICH WAY and never HOW
 * FAR. So the lift is small and the drag is heavy: the breath leaves the block, stalls, and fades
 * where it stalled. § 8b flies the real integrator and holds it under a block.
 *
 * **What is canon:** direction (outward/up), impermanence, which materials hold vs release, the
 * word. **What is mine:** count, speed, brightness, ramp, budget. The COUNTS below therefore
 * encode canon's relation — crystal gives *"only a thin breath off the new faces"*, raw mana
 * *"breathes out almost entirely"* — and the guard asserts that ordering, never the decimals.
 */
const BREATHS: Partial<Record<BreakBucket, ChipRecipe>> = {
  // A thin exhalation off the fracture faces: the shards kept nearly all of it.
  crystal: { burst: 4,  swingRate: 0, speed: 0.5,  spread: 0.7, gravity: -0.18, drag: 0.25, life: 1.1, glow: 1.6, size: 0.055 },
  // Nearly the whole block's worth, because nothing was holding it.
  rawmana: { burst: 18, swingRate: 0, speed: 0.65, spread: 0.8, gravity: -0.28, drag: 0.30, life: 1.4, glow: 1.6, size: 0.07 },
}

/**
 * The breath a broken block gives up, or `null` for everything that has none.
 *
 * ⚠ NULL IS THE ANSWER FOR MOST OF THE WORLD and it is load-bearing: a stone that breathed would
 * say the wrong thing about stone. Canon also rules that **a mana-well is a fountain and a break is
 * a leak** — they must not read alike — so this is small, brief, and stops. It is never a jet.
 */
/**
 * One integration step for one velocity axis. **The world and the oracle share this**, which is the
 * entire point of it existing.
 *
 * ⚠ IT WAS INLINE IN `break-fx.ts`'s `tick()` UNTIL A GUARD NEEDED TO ASK WHAT A PARTICLE ACTUALLY
 * DOES. Re-typing the physics into the test would have been the hand-kept mirror this repo has paid
 * for repeatedly — a copy that agrees with its original right up until it does not, and which then
 * proves a trajectory nothing in the game flies. `break-fx.ts` imports THREE, so a pure oracle
 * cannot reach into it; the fix is to move the arithmetic DOWN here rather than copy it sideways.
 *
 * `drag` is the fraction of speed kept per SECOND, so the per-frame factor is `drag^dt` and the
 * result is framerate-correct. `gravity` is positive DOWN, so a negative gravity accelerates upward.
 */
export const stepVelocity = (v: number, gravity: number, drag: number, dt: number): number =>
  v * Math.pow(drag, dt) - gravity * dt

export const breathFor = (bucket: BreakBucket): ChipRecipe | null => BREATHS[bucket] ?? null

/** Buckets that breathe. Derived from `BREATHS`, so the guard cannot drift from the table. */
export const BREATHING_BUCKETS = Object.keys(BREATHS) as BreakBucket[]

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
 * ── ✅ THE GAP THAT USED TO BE HERE IS CLOSED ─────────────────────────────────────────────────
 * This file shipped on 2026-08-28 with a footer explaining that raw mana and ather crystal took the
 * `ore` recipe and FELL like rubble, because whether freed mana rises is a claim about what mana IS
 * and belonged to the Magii seat. That gap was filed the same day and RULED the same day
 * (`CANON_GAPS.md` › *What does raw mana DO when a keeper breaks it out of the ground?*, landed in
 * `world/mother.md` + `design-briefs/shimmer-resources.md`, commit `2ca6c9e`).
 *
 * ★ THE RULING WAS A RATIFICATION — canon had answered it twice already and the answer only needed
 * assembling from three files. **The build shipped the fail-quiet version and waited**, which is
 * why the ruling landed as a diff rather than as a design session. A rock that behaved like a rock
 * invented nothing in the meantime, and nothing had to be un-shipped.
 *
 * ⚠ AND IT WAS BUILT ONLY ONCE THE RULING WAS IN GIT. The `[RULED]` text sat in an uncommitted
 * working tree for fifty minutes; building against it then would have been building against a
 * draft, which is how a guess becomes accidental canon. Verified at `HEAD:CANON/CANON_GAPS.md`
 * before a line of this was written.
 */
