// Scatter — the loose things LYING on a land: stones, fallen wood, mushrooms.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★★ SCATTER IS SHED, NOT GROWN, AND THAT IS THE WHOLE FILE ──────────────────────────────────
// Slice ② asked "what GROWS here" and answered with per-land density dials, which is right for
// grass because grass is a property of the ground. Scatter is not. Every object here FELL OFF
// something that was already standing:
//
//   · deadfall fell off a TREE, so it belongs under a canopy, not on a land that merely scores
//     woodland-ish. A branch lying in open country with no tree in sight is set dressing;
//   · a mushroom needs SHADE OR DAMP, which is why it reads as a wood-floor and marsh thing;
//   · a stone is what bare country has instead of soil cover.
//
// So each kind is `per-land dial × the field that PRODUCED it`, never the dial alone. This is
// exactly slice ②'s `treeK` lesson stated for a second layer: *the dial multiplies the mask, it
// does not replace it*. Get it wrong and you ship deadfall on a bald tableland — which looks like
// a bug even though every density in the table is defensible.
//
// ── ★ MUSHROOMS CLUMP. STONES DO NOT. ──────────────────────────────────────────────────────────
// The flower-drift lesson from flora.ts, applied where it is actually true and withheld where it
// is not. Mushrooms come up in rings and clusters off one mycelium, so they ride a low-frequency
// clump field and are dense INSIDE it — a mushroom patch is a place you find. Stones and fallen
// branches have no such parent; a boulder field is a landform, not a clump of pebbles, and giving
// rocks a drift field would produce tidy circular gravel patches nothing in nature makes.
//
// ── ★★ THIS LAYER MUST NEVER OUTRANK THE FOUR ELEMENT HERBS ────────────────────────────────────
// `plantMaterialAt` asks the herb FIRST, and that ordering is load-bearing well beyond looks: the
// herbs' densities were compensated per-ground against a MEASURED land share (character.ts says so
// at length), so anything that wins their cell moves the rarity of all four infusions — and the
// alchemy economy downstream of them — with nothing looking wrong. Scatter is inserted BELOW the
// herb and ABOVE ordinary grass: a stone displaces a tuft, never a Violetbloom.
//
// ── ★ WHY THE TABLE IS HERE AND NOT IN character.ts ────────────────────────────────────────────
// `SPECIES` lives in trees.ts and character.ts supplies only a per-land FACTOR; this follows that,
// not `floraCharacterAt`'s shape. `LandCharacter` is already eight fields, and the at-a-glance scan
// its own header argues for is the thing three more columns would cost. The drift risk that would
// normally force one table is compiler-enforced away here: both are `Record<LandId, …>`, so a tenth
// land fails to typecheck in BOTH places. There is no way for them to disagree silently.
//
// ── ★ WHY THE DIALS ARRIVE AS A THUNK ──────────────────────────────────────────────────────────
// `dialsAt` is resolved LAZILY, after the ceiling gate. Scatter is rare by design, so the vast
// majority of columns must cost one hash and stop — resolving the land blend up front would put a
// `landMix` (six noise fields) on every column in the world to answer "no" 98% of the time. Same
// ordering flora.ts uses for the same reason; the thunk is what lets the caller decide when that
// cost is paid without this file having to know whether it already has been.
//
// ⚠ TBD-CANON: `rock` / `deadfall` / `mushroom` are generic build vocabulary, like flora's
// tuft/tall/flower and biome.ts's land ids. If the Ather's fungi carry canon names or looks that is
// Magii's to rule — do NOT invent a named species here. What a land SHEDS is mine; what it is
// CALLED is not.

import { value2 } from './noise'
import { canopy, greyness, type BiomeConfig, DEFAULT_BIOME } from './biome'
import { landMix, LAND_IDS, type LandId } from './character'
import { type HeightConfig, DEFAULT_HEIGHT } from './height'

export const SCATTER = {
  NONE: 0,
  ROCK: 1,      // a loose stone — what bare, stony country wears instead of ground cover
  DEADFALL: 2,  // a fallen branch — under and around woods, never in the open
  MUSHROOM: 3,  // a mushroom — shade and damp, in clumps
} as const

export interface ScatterSpot {
  kind: number
  /** 0..1 — per-spot deterministic roll. The renderer maps it to size jitter, turn and variant. */
  variant: number
}

/**
 * The three per-land dials this layer reads. Kept as its own interface so the table can live with
 * the rest of a land's character without this file importing the whole `LandCharacter` shape.
 */
export interface ScatterDials {
  /** Loose stone multiplier. Bare, high and broken country carries it; wet green country does not. */
  rockK: number
  /** Fallen-wood multiplier. ⚠ MULTIPLIES THE CANOPY — see the header. 0 means "no wood falls here". */
  deadfallK: number
  /** Mushroom multiplier. Multiplies shade-or-damp, and rides the clump field on top of that. */
  mushroomK: number
}

/**
 * Base per-cell densities on the ground each kind most belongs on, before any dial or mask.
 *
 * ★ MUSHROOM WENT 0.008 → 0.018 FROM LOOKING, NOT FROM ARGUING. At 0.008 the measured rate in
 * deepwood — the land the table says carries the MOST fungus — was 0.22% of columns, one mushroom
 * per ~450 blocks. I flew to the site and could not find one. A thing meant to be a land's
 * character has to be findable in that land, and "I went there and it wasn't there" is the only
 * evidence that settles a density. The shape asserts are ratios, so they do not pin this number;
 * that is deliberate, and it means ⚠ THIS IS A LOOK CALL AND IT IS ALEX'S, not something the suite
 * can defend. Rock (1.91% in crag) and deadfall (0.86% in deepwood) both read on screen already.
 */
export const ROCK_DENSITY = 0.010
export const DEADFALL_DENSITY = 0.006
export const MUSHROOM_DENSITY = 0.018

/**
 * Ceiling values of each dial across the whole table — the cheap gate's upper bound.
 *
 * ⚠ THESE MUST TRACK THE TABLE. A dial raised above its ceiling would be silently CLIPPED by the
 * gate rather than taking effect, which is the worst kind of tuning bug: the number in the table
 * stops being the number in the world and nothing errors. `scatter.test.ts` derives the real maxima
 * from the table and asserts these match, so the test fails the day someone edits one and not the
 * other.
 */
export const MAX_ROCK_K = 3.0      // crag
export const MAX_DEADFALL_K = 2.2  // deepwood
export const MAX_MUSHROOM_K = 2.4  // deepwood

/**
 * The cheap gate's upper bound — the loosest sum the per-cell ladder can ever reach.
 *
 * ⚠ EXPORTED SO IT CAN BE ASSERTED AGAINST THE LADDER DIRECTLY. Inferring a too-tight gate from a
 * coverage measurement is unreliable: a gate 50% too tight clips rock coverage by only ~18%, which
 * sits inside any tolerance loose enough to survive sampling noise. `scatter.test.ts` compares this
 * against the ladder's own maximum instead, which catches any tightening exactly.
 */
export const SCATTER_CEIL_GATE = ROCK_DENSITY * MAX_ROCK_K + MUSHROOM_DENSITY * MAX_MUSHROOM_K

/** Mushroom clump field scale — a patch is tens of blocks across, like a flower drift. */
export const CLUMP_SCALE = 46
/** Clump field above this = mushrooms allowed at all. */
export const CLUMP_EDGE = 0.62
/** Share of a mushroom's density that survives OUTSIDE a clump — the lone mushroom, not zero. */
export const CLUMP_OUTSIDE = 0.12

/**
 * Shade floor for deadfall and mushrooms. `canopy` is chunk-granular and saturates inside a wood,
 * so this is "is there anything overhead at all", not a fine gradient.
 *
 * ★ NOT ZERO, AND THAT IS DELIBERATE FOR EACH OF THE TWO. A hard `canopy > 0` cut would put a
 * dead line at the forest edge — the contour mistake this whole layer of the world is built to
 * avoid. Both kinds keep a floor share in the open so the edge of a wood thins out instead of
 * stopping, and a dell can carry a few mushrooms on damp ground with no trees at all.
 */
export const OPEN_SHADE = 0.25

/**
 * The mushroom clump field at (x, z) — the mycelium, not the mushroom.
 *
 * ★ EXPORTED FOR THE ORACLE, AND THE REASON IS A MUTATION THAT SURVIVED. The obvious test for
 * "mushrooms clump" is to measure their spatial dispersion against a kind that does not clump. It
 * passes whether or not this field exists — mushrooms also multiply SHADE and LIFE, both of which
 * vary spatially, so canopy alone overdisperses them enough to satisfy the assert. The test has to
 * bucket cells by this field directly and compare density inside against outside; anything less is
 * measuring the forest and calling it fungus.
 */
export function clumpAt(x: number, z: number, seed: number): number {
  return value2(x / CLUMP_SCALE, z / CLUMP_SCALE, seed ^ 0x5b0c)
}

const hash01 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Per-land scatter dials.
 *
 * ★ THE ZEROES ARE THE DESIGN, not gaps waiting to be filled. A crag sheds no wood and grows no
 * fungus because nothing stands on it to shed and nothing lives on it to rot — the same statement
 * `treeK: 0` makes there, from the other side. Bare country reading as bare is what makes a
 * mushroom-thick deepwood floor read as thick.
 *
 * Pairs are deliberate, as in the ground table: woodland and deepwood are the same two kinds in
 * opposite proportion, so walking into a forest core is the wood floor deepening rather than a new
 * object appearing. Marsh takes deepwood's mushrooms without its rocks; barrens and crag take the
 * rocks without either.
 */
export const SCATTER_DRESS: Readonly<Record<LandId, ScatterDials>> = {
  meadow:    { rockK: 0.15, deadfallK: 0.10, mushroomK: 0.15 },
  woodland:  { rockK: 0.30, deadfallK: 1.00, mushroomK: 0.90 },
  deepwood:  { rockK: 0.35, deadfallK: 2.20, mushroomK: 2.40 },
  dell:      { rockK: 0.20, deadfallK: 0.60, mushroomK: 1.60 },
  marsh:     { rockK: 0.10, deadfallK: 0.80, mushroomK: 2.00 },
  tableland: { rockK: 1.10, deadfallK: 0.20, mushroomK: 0.10 },
  barrens:   { rockK: 1.60, deadfallK: 0.25, mushroomK: 0.05 },
  highland:  { rockK: 2.00, deadfallK: 0.15, mushroomK: 0.20 },
  crag:      { rockK: 3.00, deadfallK: 0,    mushroomK: 0 },
}

/**
 * The blended scatter dials at a column.
 *
 * ★ BLENDED, NEVER ROLLED — the half of the sibling law that applies to a density. A count eases
 * across a border with no seam at all; rolling it would quantise a smooth quantity and put back
 * the one contour we can have for free. (The discrete half — WHICH kind lands on a given cell — is
 * settled by the weighted ladder at the bottom of `scatterAt`, per cell, so a border interleaves.)
 */
export function scatterCharacterAt(
  x: number, z: number, seed: number,
  dress: Readonly<Record<LandId, ScatterDials>> = SCATTER_DRESS,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): ScatterDials {
  const w = landMix(x, z, seed, cfg, hcfg)
  let rockK = 0, deadfallK = 0, mushroomK = 0
  for (let i = 0; i < w.length; i++) {
    const d = dress[LAND_IDS[i]]
    rockK += w[i] * d.rockK
    deadfallK += w[i] * d.deadfallK
    mushroomK += w[i] * d.mushroomK
  }
  return { rockK, deadfallK, mushroomK }
}

/**
 * ── ★★ A FALLEN LOG IS A RUN, NOT A CELL, AND A DENSITY ASSERT CANNOT TELL YOU THAT ────────────
 * Every other thing in this file is genuinely one cell big: a stone's real grain IS a single block,
 * so a per-cell roll places it correctly. Deadfall is the exception and it is the one that would
 * have shipped wrong. A per-cell roll puts single isolated blocks on the ground — a floating
 * pebble wearing a log's name — and it passes EVERY density assert while doing it, because the
 * count is right and only the SHAPE is wrong. That is the accent-chessboard failure exactly: 225
 * green asserts shipped a marsh that looked like a lino floor because every assert measured *how
 * much* and none measured *what shape*.
 *
 * So the oracle for this is MEAN RUN LENGTH, which is the chessboard stated as a number: a
 * per-cell roll scores ~1.28 no matter what the density is, and a log has to score near its own
 * length. `scatter.test.ts` asserts it, and that assert is the only thing standing between this
 * and a pebble.
 *
 * The mechanism: a log has an ANCHOR (its butt end), a length and an axis, all from the anchor's
 * own hash. A cell asks "is there an anchor within one log-length behind me, on my axis, long
 * enough to reach me". Axis-aligned rather than free-angle because a voxel log at 30° is a
 * staircase of single blocks, which is the pebble again with extra steps.
 */
export const DEADFALL_MIN_LEN = 3
export const DEADFALL_MAX_LEN = 5
/** Anchors are rarer than cells by this factor — a log of mean length L covers L cells per anchor. */
export const DEADFALL_MEAN_LEN = (DEADFALL_MIN_LEN + DEADFALL_MAX_LEN) / 2

/** The log anchored at (ax, az), or null. `p` is the ANCHOR rate, not the cell coverage. */
function logAt(ax: number, az: number, seed: number, p: number): { len: number; alongX: boolean } | null {
  // ★ ONE HASH IN THE COMMON CASE. This runs up to 10 times per column world-wide, so the early
  // return has to come before the length and axis rolls, not after.
  if (hash01(ax, az, seed ^ 0xdeadf) >= p) return null
  const h = hash01(ax, az, seed ^ 0x10f7)
  return {
    len: DEADFALL_MIN_LEN + Math.floor(h * (DEADFALL_MAX_LEN - DEADFALL_MIN_LEN + 1)),
    alongX: hash01(ax, az, seed ^ 0x2a71) < 0.5,
  }
}

/**
 * Does a log cover (x, z)? Scans back along both axes as far as the longest log can reach.
 *
 * ⚠ THE ANCHOR RATE IS EVALUATED WITH THE DIALS AT THE *ASKING* CELL, not at the anchor's. Over
 * five blocks the land blend is effectively constant (it eases over hundreds), so this is invisible
 * — but it does mean a log straddling a sharp dial change is decided by whichever end you ask
 * about, and could in principle be seen from one end and not the other. Resolving `landMix` at ten
 * neighbour columns to close that would put six noise fields × 10 on the world's hot path to fix
 * something no player can perceive. Stated here so it is a known cost, not a lurking bug.
 */
function deadfallCovers(x: number, z: number, seed: number, pAnchor: number): boolean {
  if (pAnchor <= 0) return false
  for (let d = 0; d < DEADFALL_MAX_LEN; d++) {
    const ax = logAt(x - d, z, seed, pAnchor)
    if (ax && ax.alongX && ax.len > d) return true
    const az = logAt(x, z - d, seed, pAnchor)
    if (az && !az.alongX && az.len > d) return true
  }
  return false
}

/**
 * The scatter at (x, z), or null. Deterministic; the common case is one hash plus the log scan's
 * ten, and no noise field at all.
 *
 * `dialsAt` is a thunk on purpose — see the header. Callers that already hold the blend can pass
 * `() => dials`; the generator passes `() => scatterCharacterAt(x, z, seed)`.
 */
export function scatterAt(
  x: number, z: number, seed: number,
  dialsAt: () => ScatterDials,
  cfg: BiomeConfig = DEFAULT_BIOME,
): ScatterSpot | null {
  const roll = hash01(x, z, seed ^ 0x5ca7)

  // ── Cheap gate first (SCATTER_CEIL_GATE): the loosest possible bound, so no real column is
  // ever rejected. Deliberately loose — a gate that is too tight silently deletes scatter from the
  // exact lands the table says should carry the most, and nothing would look wrong.
  // The log scan is its own gate and cannot share the roll — a covered cell is chosen by a
  // NEIGHBOUR's hash, so its own roll says nothing about it. Run at the ceiling anchor rate first;
  // the real rate is a strictly smaller threshold on the same hash, so a hit here is a superset.
  const maybeLog = deadfallCovers(x, z, seed, DEADFALL_DENSITY * MAX_DEADFALL_K / DEADFALL_MEAN_LEN)
  if (!maybeLog && roll > SCATTER_CEIL_GATE) return null

  // Survivor: now the real dials and the parent fields.
  const d = dialsAt()

  // Shade: chunk-granular, floored so a forest edge thins instead of stopping (see OPEN_SHADE).
  const shade = OPEN_SHADE + (1 - OPEN_SHADE) * canopy(seed, x >> 4, z >> 4, cfg)

  // ★ DEAD THINGS SURVIVE THE GREYING; LIVING ONES DO NOT. Canon's drained ground is drained LIFE,
  // so a greyfield keeps its stones and its fallen wood and loses its mushrooms. This is the one
  // thing scatter can say that flora cannot: where the grass has guttered out, the rocks and the
  // deadfall are still lying there — which is what makes a greyfield read as a place that USED to
  // be a wood, rather than a place that was always bare.
  const life = 1 - greyness(x, z, seed, cfg)

  // ── Deadfall first: it is placed by its own mechanism, so it cannot sit on the ladder ─────────
  // A log lying across the ground displaces the pebble under it, which is also the right order
  // physically. Its coverage is ~1%, so what this costs the other two is far below their tuning.
  if (maybeLog && deadfallCovers(x, z, seed, DEADFALL_DENSITY * d.deadfallK * shade / DEADFALL_MEAN_LEN)) {
    return { kind: SCATTER.DEADFALL, variant: hash01(x, z, seed ^ 0x8d4) }
  }

  // Mushrooms: shade-or-damp, then the clump field on top. `CLUMP_OUTSIDE` keeps the lone mushroom.
  const clump = clumpAt(x, z, seed)
  const mushroomP = MUSHROOM_DENSITY * d.mushroomK * shade * (clump > CLUMP_EDGE ? 1 : CLUMP_OUTSIDE) * life
  const rockP = ROCK_DENSITY * d.rockK

  // ── The ladder, rarest band first, each band its own probability rather than a share of a total
  // — the same shape flora.ts uses, and the reason a land can carry rocks AND mushrooms without
  // either diluting the other's tuned number.
  if (roll < mushroomP) return { kind: SCATTER.MUSHROOM, variant: hash01(x, z, seed ^ 0x21f) }
  if (roll < mushroomP + rockP) return { kind: SCATTER.ROCK, variant: hash01(x, z, seed ^ 0xc73) }
  return null
}
