// Meadow flora — what SMALL GREEN grows at a column, as a pure selection field.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ SELECTION ONLY, NEVER SURFACE TRUTH. This file answers "would flora grow HERE?" from the same
// fields everything else reads (richness, zone membership, forest mask). It deliberately does NOT
// check what the ground is made of — the renderer verifies the LIVE voxel (actual topsoil, air
// above) at instance time, which is what keeps tufts off roads, crust, grey dither and player-dug
// holes without this file re-deriving materials. Split matters: selection is testable and cheap
// (one field read most columns); surface truth belongs to whoever holds the real voxels.
//
// ★ FLOWERS GROW IN DRIFTS, and that is the one design idea here. Uniform scatter reads as noise;
// real meadows carry flowers in wandering patches with grass between. So flowers ride their own
// low-frequency field (drifts are PLACES), and inside a drift the individual flowers are dense —
// while tufts stay uniform filler everywhere green. Same shape lesson as the greyfield/river/pool
// fields: what a feature IS at its scale is a design input.
//
// ⚠ TBD-CANON: kinds are generic build vocabulary (tuft/tall/flower), colours are placeholder
// palette. If the Ather's meadow flowers carry canon names or looks, that is Magii's — do not
// invent named species here.

import { value2 } from './noise'
import { greyness, type BiomeId } from './biome'
import { zoneAt } from './zones'
import { floraCharacterAt } from './character'
import { mistAt } from './mist'
import { MAT, LAND_DRESS } from './depth'
import { scatterAt, scatterCharacterAt, SCATTER } from './scatter'
import { CROP_DEFS } from './crops'

export const FLORA = {
  NONE: 0,
  TUFT: 1,     // a short grass tuft — the universal filler
  TALL: 2,     // knee-high grass — occasional, breaks the tuft rhythm
  FLOWER: 3,   // a wildflower — only inside drifts; variant colours the head
  HERB: 4,     // one of canon's four element herbs — only on its own ruled ground

  // ── ★ SCATTER JOINS THIS ENUM, AND IT IS NOT A CLAIM THAT A ROCK IS A PLANT (slice ③) ────────
  // This is the kind space for "what stands on the cell above the ground", which is what the
  // renderer's probe reports and what `flora-mesh` switches on. Scatter occupies exactly that slot
  // (see `plantMaterialAt`), so it has to be expressible here or the probe would need a second,
  // parallel kind space — and two kind spaces over one cell is the three-copies-of-a-truth failure
  // this codebase keeps paying for. The NAME of the enum is historical; its job is the slot.
  //
  // ⚠ THESE ARE NOT DRAWN AS CROSS-QUADS. Tuft/tall/flower/herb are swaying alpha cards; a stone
  // that sways is a bug you cannot unsee. `flora-mesh` gives these three solid geometry and a
  // non-sway material — if you add a fourth, decide which of those two families it joins.
  ROCK: 5,
  DEADFALL: 6,
  MUSHROOM: 7,

  // ★ ONE KIND, SEVEN MATERIALS — the same shape as HERB, for the same reason: the renderer needs
  // to know "a crop stands here", and WHICH crop is a lookup on the ground. A swaying alpha card,
  // so it joins the tuft/tall/flower/herb family, not the solid scatter one.
  CROP: 8,
} as const

export interface FloraSpot {
  kind: number
  /** 0..1 — per-spot deterministic roll. The renderer maps it to height jitter and flower colour. */
  variant: number
}

/** Drift field scale — a flower drift is a place tens of blocks across, not a speckle. */
export const DRIFT_SCALE = 90
// ★ 0.60 → 0.72 (2026-08-11, Alex playtesting: "an unnecessary amount of flowers"). At 0.60 THIRTY
// PERCENT of the garden was drift, so the carpet that is supposed to be a place you FIND was simply
// the ground — 7728 flowers in a 224-block view, each drawn as two alpha quads (stem + head), which
// is also the overdraw profile that swamps a GPU. The fix is rarity, not dilution: a drift you walk
// into should still be a carpet, so `FLOWER_DENSITY` stays high and the FIELD gets pickier. Measured
// on seed 1337: 30% of ground → 9.4% drift.
export const DRIFT_EDGE = 0.72   // drift field above this = flowers allowed
/** Base per-cell densities on healthy open ground (multiplied by zone character below). */
export const TUFT_DENSITY = 0.13
export const TALL_DENSITY = 0.035
export const FLOWER_DENSITY = 0.26   // inside a drift — dense on purpose, drifts are the rarity
/** Fraction of a mist patch's tufts that give way to bloom at full mist. */
export const MIST_TUFT_YIELD = 0.75
/** Flower share mist raises on OPEN ground (outside a drift) — a patch blooms with or without one. */
export const MIST_OPEN_BLOOM = 0.35

/**
 * ── ★ THE CONSERVATIVE GATE (slice ②, 2026-08-19) ───────────────────────────────────────────────
 * `floraAt` costs one hash for most columns, and that early-out is the reason ground cover is free
 * on the world's hot path. Land character would destroy it: reading it before the gate puts a
 * `landWeights` call — four noise fields — on every column in the world to answer "no" for ~85% of
 * them.
 *
 * So the gate runs first at the LARGEST multiplier any land can ask for, and only survivors pay for
 * the real one. A conservative gate can let a cell through that the true dials then reject; it can
 * never reject one the true dials would have grown, which is the only direction that would be a
 * bug. Same shape as `herbAt`'s "cheap roll first, field second" and as the `riverCarve > 0` guard
 * in front of the water table.
 *
 * ⚠ THESE ARE THE MAXIMA OVER `LAND_CHARACTER`, and they are asserted against it in flora.test.ts
 * rather than trusted — a land tuned past one of them silently loses the flora it was tuned to get.
 */
export const MAX_FLORA_K = 1.30   // dell
export const MAX_FLOWER_K = 1.35  // meadow
export const MAX_TALL_K = 3.0     // marsh

const hash01 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// ── ★★ THE FOUR ELEMENT HERBS — CANON'S GROUND, TRANSCRIBED (ruled 2026-08-18, /magii) ──────────
// `game/shimmer-geography.md` › *★ WHERE THE FOUR ELEMENT HERBS GROW* — and the ruling's own
// heading is the warning label: **read the ground, not the element.** The obvious table (Earth herb
// → crag, because rock) is the one canon explicitly refuses, and it names Rootvine as the test case:
// *"the lookup would have put the Earth herb on rock. Rock has no depth."*
//
//   Violetbloom (Mana)  → basin     — it HUMS, and a sound needs stillness; mana pools deepest in
//                                     the ground everything drains into and nothing leaves.
//   Stormgrass  (Storm) → highland  — it crackles IN STILL AIR, so the charge is its own; it wants
//                                     unbroken sky, not weather. Not the crag: bare rock grows no grass.
//   Rootvine    (Earth) → woodland  — *anchors deep*; the deepest ground here is old forest floor,
//                                     where the Network's roots break surface.
//   Tidepetal   (Water) → shore     — *beaded with moisture* is water taken from the AIR. A river
//                                     scours and would strip it; a shore is wetted and never scoured.
//
// ⚠ THE OTHER FOUR GROUNDS CARRY NONE, AND THAT IS THE DESIGN, not an omission: river scours, crag
// is the prospector's business, meadow is what a farm is made of, and **a greyfield grows nothing at
// all — canon, not a dial** (*"No forage of any kind in a greyfield, ever, before the freeing"*).
// Half the country carrying none is what makes a herb a reason to travel.
//
// ★ IT IS AN ALLOWLIST KEYED ON THE BIOME ID, which gets the greyfield refusal for free — and it
// also means a RULED ZONE (Spirit Meadows, the Springs, Gloview) grows none of them, because
// `biomeAt` answers with the zone's id there and no zone is in this table. **That is my call, not
// canon's** (canon ruled the eight generic grounds and said nothing about tended zones), and it is
// the fail-closed direction: the herbs are a thing you find in wild country, and a zone that should
// grow one can be added the day canon says so. The reverse — a denylist admitting every id it does
// not recognise — is how the greyfield would quietly start growing herbs.
export const HERB_GROUND: Readonly<Record<string, BiomeId>> = {
  [MAT.VIOLETBLOOM]: 'basin',
  [MAT.STORMGRASS]: 'highland',
  [MAT.ROOTVINE]: 'woodland',
  [MAT.TIDEPETAL]: 'shore',
}
/** The herb that grows on a ground, or 0. The one lookup — everything asks this. */
export const HERB_OF_GROUND: Readonly<Record<string, number>> = {
  basin: MAT.VIOLETBLOOM,
  highland: MAT.STORMGRASS,
  woodland: MAT.ROOTVINE,
  shore: MAT.TIDEPETAL,
}

// ★ HERBS GROW IN PATCHES, for the same reason flowers grow in drifts — and RARER, because canon
// made them *"a reason to travel"*. Their own field at its own scale, so a herb patch is a place you
// find rather than a speckle you walk past: a wider field than the flower drift (140 vs 90) that
// opens less often (0.80 vs 0.72). Inside one they are worth stopping for.
//
// ⚠ THE NUMBERS ARE MINE AND ARE UNPLAYTESTED — canon fixed the GROUND and left *"rarity, patch
// density, yield per pick, respawn"* to me by name. One infusion costs 2 petals, so a patch must be
// worth a walk; if it plays thin, this is the dial and nothing canon moves.
export const HERB_SCALE = 140
export const HERB_EDGE = 0.80
export const HERB_DENSITY = 0.11

/**
 * ── ★★ PER-GROUND COMPENSATION — because the four grounds are NOT the same size ────────────────
 * Measured on seed 1337 over a 1600×1600 sample around spawn, and this is the number that forced
 * this table to exist: **woodland 13.6% of land · highland 2.0% · basin 0.9% · shore 0.6%.**
 * At one flat density that made Rootvine **187× more common than Tidepetal** — an accident of
 * terrain frequency, not a design, and it would have read to a player as "the Water Infusion is the
 * rare one" when canon says nothing of the sort. All four are the same tier at the same cost.
 *
 * ★ SO THE DIAL COMPENSATES FOR THE GROUND, NEVER FOR THE HERB'S VALUE. A rarer ground opens its
 * patches more often and packs them tighter, which is also the honest reading: a plant that only
 * lives on a thin coastal ribbon grows in the good spots of that ribbon *densely*, because that is
 * all the ground it has. `shore` needs the most help twice over — it is the smallest share AND it is
 * a ribbon, so a wide patch field mostly falls in the sea or inland.
 *
 * ⚠ THESE ARE MINE AND THEY ARE TUNING, NOT CANON. Canon fixed the ground and handed me *"rarity,
 * patch density, yield per pick, respawn"* by name. Re-measure before changing them — the whole
 * point is the RATIO between the four, and a change to terrain generation moves it without touching
 * this file. `herbs.test.ts` § 11 holds the ratio, not the numbers.
 *
 * ⚠ MEASURED THROUGH `generatedAt`, NEVER THROUGH THE FIELD — the waterline gate sits between them
 * and it eats 82% of the basin. Tuning against `herbAt` alone balanced Violetbloom against plants
 * standing on a lake bed that no player will ever pick. Latest sweep (seed 1337, 1600×1600, step 4,
 * through the generator): violetbloom 70 · stormgrass 108 · rootvine 109 · tidepetal 117 — 1.7×.
 */
export const HERB_TUNE: Readonly<Record<string, { edge: number; density: number }>> = {
  woodland: { edge: 0.85, density: 0.075 },   // the common ground — pulled DOWN toward the others
  highland: { edge: 0.74, density: 0.19 },
  basin: { edge: 0.38, density: 0.80 },
  shore: { edge: 0.52, density: 0.52 },
}

/**
 * The element herb standing at (x, z) on `ground`, or 0.
 *
 * ★ ITS OWN FIELD, NOT A FIFTH BRANCH OF `floraAt`. That function is the meadow's cover — one hash
 * for most columns, tuned against grass — and a herb is a different kind of thing: it is selected by
 * GROUND, which `floraAt` cannot see (it deliberately reads no materials and takes no height). Kept
 * apart, each stays testable on its own terms and the grass field's hot path is untouched.
 *
 * ⚠ A HERB OUTRANKS GRASS ON ITS OWN CELL (see `plantMaterialAt`) — otherwise a herb patch in
 * meadow-grade country would be mostly tufts wearing the patch's name.
 */
export function herbAt(x: number, z: number, seed: number, ground: BiomeId): number {
  const herb = HERB_OF_GROUND[ground]
  if (!herb) return 0
  // Same order as `floraAt`: cheap roll first, field second. Most cells on a herb's own ground still
  // fail here, which is what keeps this off the per-column budget.
  const tune = HERB_TUNE[ground] ?? { edge: HERB_EDGE, density: HERB_DENSITY }
  const roll = hash01(x, z, seed ^ 0x4e2b)
  if (roll > tune.density) return 0
  // Drained ground grows none — belt and braces beside the biome allowlist, which already refuses a
  // greyfield. The fringe greys before the label flips, and canon's "no forage of any kind" should
  // start where the ground starts failing, not where the name changes.
  if (greyness(x, z, seed) >= 0.35) return 0
  const patch = value2(x / HERB_SCALE, z / HERB_SCALE, seed ^ 0x8be31)
  return patch > tune.edge ? herb : 0
}

// ── ★★ THE SEVEN TIER-2+ CROPS AND THEIR GROUND (ruled 2026-08-22, /magii + Alex) ──────────────
// `game/shimmer-geography.md` › *★ WHERE THE TIER 2+ CROPS GROW WILD*, and the ruling's own subtitle
// is the mechanism: **the seed is the meadow's, the plant is the ground's.** A grass tuft yields a
// common crop SEED — level-1 stock, unchanged by any of this — while the other seven are MET as
// plants where they grow, exactly as the four element herbs already were. You pick a Violetbloom
// where Violetbloom grows; you do not get its seed out of grass. That distinction had been
// load-bearing since 08-18 and nobody had written it down, which is why the gap arrived as a false
// either/or (*"tier 1, or all ten?"* — all ten puts Dawncap in a grass tuft).
//
//   Moonvine     → basin     cool to the touch even in sunlight; cold keeps where nothing moves
//   Starbean     → river     the herb ruling excluded river because a river SCOURS — and a dense
//                            pod is exactly what survives it. What kills a petal delivers a seed.
//   Crystalcap   → crag      translucent, refracts light; a prism wants the mineral face
//   Dreamroot    → woodland  a root, and the deepest ground here is old forest floor
//   Shimmerbloom → shore     iridescence is what light does on a wet surface
//   Dawncap      → highland  unbroken sky, and the highland takes first light
//   Atherwheat   → meadow    it is wheat. ⚠ THE RAREST THING IN THE COMMON GROUND — you meet the
//                            PLANT there; the tuft still yields only level-1 seed. This is the one
//                            place the seed/plant split can be confused, so it is where it works.
//
// ⚠ A GREYFIELD GROWS NONE OF THEM — canon, not a dial, same as the herbs. Falls out for free from
// the allowlist below being keyed on the biome id.

/**
 * ★★ ONE ROW PER CROP, AND EVERY TABLE BELOW IS A PROJECTION OF IT — deliberately NOT the herbs'
 * shape. `HERB_GROUND` and `HERB_OF_GROUND` are two hand-kept tables that have to agree, which is
 * the mirror: a copy and its source go stale together and **agree perfectly while both are wrong**,
 * and the agreement reads as corroboration. Nothing here is written twice, so nothing here can
 * disagree. If a crop moves ground, one line moves.
 *
 * ⚠ The crop id is the key into `CROP_DEFS`, so TIER IS NEVER WRITTEN HERE. Re-tier a crop in
 * `crops.ts` and its wild rarity follows on its own — see `wildDensity`.
 */
const WILD_CROPS = [
  { crop: 'moonvine',     ground: 'basin',    mat: MAT.MOONVINE },
  { crop: 'starbean',     ground: 'river',    mat: MAT.STARBEAN },
  { crop: 'crystalcap',   ground: 'crag',     mat: MAT.CRYSTALCAP },
  { crop: 'dreamroot',    ground: 'woodland', mat: MAT.DREAMROOT },
  { crop: 'shimmerbloom', ground: 'shore',    mat: MAT.SHIMMERBLOOM },
  { crop: 'dawncap',      ground: 'highland', mat: MAT.DAWNCAP },
  { crop: 'atherwheat',   ground: 'meadow',   mat: MAT.ATHERWHEAT },
] as const

/** The wild crop a ground grows, or 0. The one lookup — everything asks this. */
export const CROP_OF_GROUND: Readonly<Record<string, number>> =
  Object.fromEntries(WILD_CROPS.map(w => [w.ground, w.mat]))

/** The inverse, DERIVED. Both directions exist; only one is authored. */
export const GROUND_OF_CROP: Readonly<Record<number, string>> =
  Object.fromEntries(WILD_CROPS.map(w => [w.mat, w.ground]))

/** The crop id a wild plant material belongs to — the way back into `CROP_DEFS`. */
export const CROP_ID_OF_MAT: Readonly<Record<number, string>> =
  Object.fromEntries(WILD_CROPS.map(w => [w.mat, w.crop]))

export const isWildCrop = (m: number): boolean => m in GROUND_OF_CROP

/**
 * ── ★★★ THE TERRAIN IS ORDERED BACKWARDS FROM THE LADDER, AND THAT IS WHY THIS IS DERIVED ──────
 * Measured through `generatedAt` on the herbs' own sweep (seed 1337, 1600², step 4), counting cells
 * where a crop can ACTUALLY land — on its ground, not taken by the herb that outranks it, not grey,
 * and not under water. Verified as the true ceiling by re-running the sweep at density 1.0, which
 * reproduces these to within one cell:
 *
 *   meadow 53,347 · woodland 20,283 · river 4,274 · highland 2,711 · crag 1,392 · shore 625 · basin 105
 *
 * **A 508× spread, and the tier-4 crop sits on the biggest ground while the tier-2 sits on the
 * smallest.** At one flat density Atherwheat would be the commonest plant in the world and Moonvine
 * the rarest — the ladder inverted, and read by a keeper as design. That is `HERB_TUNE`'s 187× bug
 * wearing this feature's hat, except the herbs only needed PARITY (canon makes the four peers) and
 * this needs an ORDERING, which terrain hands us upside down.
 *
 * ⚠⚠ THE FIRST DENOMINATOR WAS WRONG AND THE SWEEP CAUGHT IT. I counted "dry" cells, which silently
 * assumed the roll happens only on cells a plant can occupy. It happens on EVERY cell and the losses
 * come after: on the basin, 61% of rolls go to the Violetbloom that outranks the crop and another
 * 35% drown at the waterline, so a density computed for 90 plants delivered **10**. The number was
 * measured, was comparable to the herbs', and still meant something other than what the formula
 * needed. **A denominator has to count what SURVIVES, not what was sampled.**
 *
 * ⚠⚠⚠ AND THERE WAS A SATURATION CAP HERE, JUSTIFIED BY ARITHMETIC I NEVER MEASURED. It existed to
 * stop the basin — 0.9% of the land, 71% lake bed, the densest element herb on what remains — from
 * becoming wall-to-wall Moonvine, and its comment said removing it would put a crop on *"86% of
 * every free basin cell… not a plant you find, it is a carpet."* **Then the mutation sweep could not
 * make removing it fail anything, so I measured instead of arguing: without the cap the basin lands
 * at 27.6% occupancy, with it 18.1%.** Neither is a carpet. The 86% came from `target / free`, which
 * assumes every roll lands on a free cell — the same mistake as the first denominator, one level up,
 * committed while writing the warning about it.
 *
 * ★ SO THE CAP IS GONE RATHER THAN RE-TUNED. A dial that changes almost nothing, defended by a
 * number nobody checked, is worse than no dial: it is a knob that quietly promises someone is
 * watching saturation. The real protection is the measured-occupancy assert in the oracle, which
 * asks the sweep what a keeper meets instead of asking a constant about itself.
 *
 * ⚠ WHAT REMAINS TRUE AND IS WORTH KNOWING: the basin under-delivers against its tier target (29
 * against 60) because only 7.3% of it is free, and no density ≤ 1 can fix that — the ground's whole
 * ceiling is 105 cells. Moonvine is simply the thinnest tier-2 crop. The oracle checks that the
 * tier band still holds (the spread lands at 2.2×, inside the 4× the herbs use), so this is a
 * reported fact rather than a hidden one.
 *
 * ⚠ `GROUND_FREE_CELLS` IS A MEASUREMENT AND IT WILL GO STALE — terrain moves it, and so does any
 * change to `HERB_TUNE`, since the herb takes its cells first. That is survivable **only** because
 * the oracle asserts the resulting ORDER and the measured occupancy rather than these numbers, so
 * drift shows up as the ladder inverting rather than as a silently wrong constant. Re-measure before
 * editing; never edit one of these to make a test pass.
 */
export const WILD_TARGET_BY_TIER: Readonly<Record<number, number>> = { 2: 60, 3: 30, 4: 15 }
export const GROUND_FREE_CELLS: Readonly<Record<string, number>> = {
  basin: 105, river: 4274, crag: 1392, woodland: 20283, shore: 625, highland: 2711, meadow: 53347,
}

/**
 * Chance per cell on a crop's own ground. Exported with its inputs as parameters so the oracle can
 * falsify it with synthetic tables rather than asserting the seven numbers it produces today.
 */
export const wildDensity = (
  ground: string, tier: number,
  free: Readonly<Record<string, number>> = GROUND_FREE_CELLS,
  target: Readonly<Record<number, number>> = WILD_TARGET_BY_TIER,
): number => Math.min(1, (target[tier] ?? 0) / Math.max(1, free[ground] ?? Infinity))

export const CROP_DENSITY: Readonly<Record<string, number>> = Object.fromEntries(
  WILD_CROPS.map(w => [w.ground, wildDensity(w.ground, CROP_DEFS[w.crop].tier)]))

/**
 * The wild crop standing at (x, z) on `ground`, or 0.
 *
 * ★ SOLITARY, NOT PATCHED, AND THAT IS THE DESIGN RATHER THAN A SIMPLIFICATION. A herb grows in
 * patches because canon made it *"a reason to travel"* and a patch is a destination — something you
 * walk to and stop at. A wild crop is a **find**: one plant, noticed. Giving it a patch field would
 * make seven more destinations competing with the four canon actually ruled, and it would make the
 * ladder's top tiers arrive in handfuls. One dial instead of two, and the thing it produces reads
 * differently on the ground.
 *
 * ⚠ ITS OWN SALT. Sharing the herb's `0x4e2b` would correlate the two fields, so on the four grounds
 * that carry both, a crop would turn up at exactly the cells a herb wanted — and the herb wins, so
 * the crop would be invisible in proportion to how well the herb was doing.
 */
export function cropAt(x: number, z: number, seed: number, ground: BiomeId): number {
  const crop = CROP_OF_GROUND[ground]
  if (!crop) return 0
  if (hash01(x, z, seed ^ 0x2c19) > (CROP_DENSITY[ground] ?? 0)) return 0
  // Same grey refusal as the herbs, and for canon's reason: no forage of any kind in a greyfield,
  // and the fringe greys before the label flips.
  if (greyness(x, z, seed) >= 0.35) return 0
  return crop
}

/**
 * The flora at (x, z), or null. Deterministic; costs one hash for most columns (the early outs are
 * ordered by how much of the world they cover). Grey ground grows nothing — the greying is drained
 * LIFE, and flora is the most literal life there is; the renderer's topsoil check would catch the
 * dithered grey cells anyway, but a drained fringe should thin BEFORE the dither line, which only
 * the field can do.
 */
export function floraAt(x: number, z: number, seed: number): FloraSpot | null {
  const roll = hash01(x, z, seed ^ 0xf10a)
  // Zone character: the Meadows are THE flower country (their whole ruling is "rolling hills,
  // sparse lone trees" — the ground cover carries the zone), the Thicket floor is dim and sparse,
  // everywhere else is ordinary. Springs terraces stay lightly dressed so the crust reads.
  const zn = zoneAt(x, z, seed)
  const zid = zn.zone?.id
  const boost = zid === 'spirit-meadow' ? 1 + 0.9 * zn.t
    : zid === 'twilight-thicket' ? 1 - 0.72 * zn.t
    : zid === 'mana-springs' ? 1 - 0.45 * zn.t
    : 1
  // ── Cheap gate first: most cells fail the roll before any field is read (see MAX_FLORA_K) ────
  const ceilGate = (TUFT_DENSITY * boost * MAX_FLORA_K + TALL_DENSITY * boost * MAX_FLORA_K * MAX_TALL_K) * 1.6
    + FLOWER_DENSITY * MAX_FLOWER_K
  if (roll > ceilGate) return null

  // Survivor: now the land's real dials. Slice ② — a dell is deep grass, a barrens is nearly bare,
  // a marsh is reeds, a wood core is a dim floor. Blended across the lands, so density has no seam.
  const lc = floraCharacterAt(x, z, seed, LAND_DRESS)
  const tuftP = TUFT_DENSITY * boost * lc.floraK
  const tallP = TALL_DENSITY * boost * lc.floraK * lc.tallK
  // Hoisted into a const because the mist bloom below must fit INSIDE it — see there.
  const gate = (tuftP + tallP) * 1.6 + FLOWER_DENSITY * lc.flowerK
  if (roll > gate) return null
  // Drained ground thins to nothing across the grey fringe — and dies BEFORE the core (0.85, not
  // 1.0): grass giving out while the soil still holds a little colour is the right order for the
  // guttering to read; ground that greys first and loses its grass after would read backwards.
  const life = 1 - greyness(x, z, seed)
  if (life <= 0.15) return null
  const drift = value2(x / DRIFT_SCALE, z / DRIFT_SCALE, seed ^ 0xd21f7)
  const inDrift = drift > DRIFT_EDGE
  const flowerBase = inDrift ? FLOWER_DENSITY * lc.flowerK * (zid === 'spirit-meadow' ? 1 + 0.6 * zn.t : 1) : 0

  // ★ MIST BLOOMS WHAT IS ALREADY THERE — it does not add. Inside a patch (mist.ts) the flower
  // share climbs and the tufts give way to it, so charged ground reads as charged without the
  // flora budget moving an inch. Adding density instead would have been the obvious move and the
  // wrong one: it puts MORE geometry exactly where the mist pass, the fog pull and the resident
  // are already spending frame budget, so the one place guaranteed to be busy would also be the
  // one place the renderer is asked to draw the most grass.
  //
  // Read AFTER both early-outs, so the cost lands only on cells that already survived the roll and
  // the grey test — and `mistAt` is a memoised single-cell lookup, which is what makes it safe to
  // call from a per-column field at all.
  const m = mistAt(x, z, seed)
  const tuftAdj = tuftP * (1 - MIST_TUFT_YIELD * m)
  // Clamped against the same `gate` the early-out used: the gate rejects rolls before this line
  // runs, so a bloom that reached past it would be silently truncated by a threshold upstream —
  // flowers that thin out at exactly the wrong moment, for a reason invisible from here.
  const flowerP = Math.min(
    flowerBase + m * (tuftP * MIST_TUFT_YIELD + (inDrift ? 0 : FLOWER_DENSITY * lc.flowerK * MIST_OPEN_BLOOM)),
    gate - tuftAdj - tallP,
  )

  const r = roll / life   // thinning: on half-drained ground a roll must be twice as lucky
  if (r < flowerP) return { kind: FLORA.FLOWER, variant: hash01(x, z, seed ^ 0x77e) }
  if (r < flowerP + tuftAdj) return { kind: FLORA.TUFT, variant: hash01(x, z, seed ^ 0x3b1) }
  if (r < flowerP + tuftAdj + tallP) return { kind: FLORA.TALL, variant: hash01(x, z, seed ^ 0x9c5) }
  return null
}

/**
 * ── ★ THE VOXEL SAYS WHETHER A PLANT IS THERE; THIS FILE SAYS WHAT IT LOOKS LIKE ────────────────
 * The material a plant cell holds at (x, z), or AIR for bare ground. `column.ts` writes this one
 * voxel above the surface, which is what makes ground cover breakable, droppable and SAVED — see
 * the plants block in depth.ts for why that had to stop being a renderer-only fiction.
 *
 * The split matters and is worth keeping: EXISTENCE is voxel data (the player can remove it, and
 * the save records that), while the LOOK — height jitter, turn, flower colour — stays a pure
 * function of position via `FloraSpot.variant`. So picking one flower cannot change how its
 * neighbour looks, and no per-plant appearance state is ever stored.
 *
 * ⚠ depth.ts may not import this file (mist.ts imports depth, so flora → depth is fine but the
 * reverse would close a cycle). That is why the write lives in the assembly layer, not the depth
 * rule, even though "what material is at this cell" is otherwise depth's job.
 */
export function plantMaterialAt(x: number, z: number, seed: number, ground?: BiomeId): number {
  // ★ THE HERB IS ASKED FIRST, and that is the whole of its priority rule. Its ground is ordinary
  // living country (a basin is grass), so under the grass field a patch would come up mostly tufts
  // with a herb here and there — the patch would exist in the field and not on the ground.
  //
  // ⚠ `ground` IS OPTIONAL AND ITS ABSENCE MEANS "NO HERBS", not "unknown, guess". The only caller
  // that can answer it is the generator (it holds the column's height, which `biomeAt` needs); the
  // pot, the tests and any future field reader get grass exactly as before. A default of "assume
  // meadow" would have been the same trap as a denylist — quietly right until it is quietly wrong.
  if (ground) {
    const herb = herbAt(x, z, seed, ground)
    if (herb) return herb

    // ── ★★ THE WILD CROP SITS BELOW THE HERB AND ABOVE SCATTER (2026-08-22) ────────────────────
    // BELOW THE HERB, and the reason is written three paragraphs down for the stone: the four
    // herbs' densities were compensated per-ground against a MEASURED land share, so anything that
    // wins their cell moves the rarity of all four infusions — and the alchemy economy under them —
    // with nothing looking wrong. **Four of the seven crops share a ground with a herb** (basin,
    // woodland, shore, highland), so this is not a hypothetical here the way it was for scatter: a
    // crop that outranked the herb would silently re-tune the Infusions the day it shipped. A crop
    // displaces a tuft, never a Violetbloom.
    //
    // ABOVE SCATTER, and that is a real decision rather than the leftover slot. A crop IS a plant
    // that grew; a stone LIES on the ground. But the argument that settles it is the same one that
    // put scatter under the herb: a crop is economically load-bearing (it is an alchemy input and
    // the bootstrap for a whole farmed line) and scatter is not — rock, deadfall and mushroom cost
    // nothing downstream if one is displaced. **Order by what breaks when the cell is lost.**
    const crop = cropAt(x, z, seed, ground)
    if (crop) return crop

  // ── ★★ SCATTER SITS BELOW THE HERB AND ABOVE THE GRASS (2026-08-19, slice ③) ─────────────────
  // BELOW the herb, and that ordering is load-bearing far past looks: the four element herbs'
  // densities were compensated per-ground against a MEASURED land share, so anything that wins
  // their cell moves the rarity of all four infusions — and the alchemy economy downstream of them
  // — with nothing looking wrong. A stone displaces a tuft, never a Violetbloom.
  //
  // ABOVE the grass because a stone lying on the ground has grass growing AROUND it, not through
  // it. Scatter runs at ~1-3% against grass's ~13%, so what this costs the flora budget is far
  // below its own tuning.
  //
  // ⚠ INSIDE THE `ground` GUARD FOR THE SAME REASON THE HERB IS, and `herbs.test.ts` is what said
  // so: *"without a ground, plantMaterialAt is exactly the grass field it always was"*. `ground`'s
  // presence is the GENERATOR'S SIGNATURE — it is the only caller that can answer it. The pot, the
  // tests and any field reader must keep getting plain grass, or a mushroom comes up in a seed pot.
  //
  // ⚠ SCATTER DOES NOT ASK `TURF`, AND THAT IS A DECISION RATHER THAN AN OMISSION. `TURF` answers
  // "can a plant GROW here" — it gates the tree planter and the sapling rule, and marsh mud is
  // outside it on purpose. But scatter is not planted: a stone and a fallen branch LIE on whatever
  // is under them, and a mushroom comes up on rot and wet mud as readily as on turf. Gating this on
  // TURF would strip mushrooms from ~a third of the marsh, which is the second land they most
  // belong to. This is the deliberate second predicate, not a widening of TURF — do not "fix" it by
  // adding one, and do not add these materials to TURF either (they are not grounds at all).
  //
  // ★ RESOLVED HERE RATHER THAN IN column.ts SO THERE IS EXACTLY ONE h+1 RESOLVER. Three copies of
  // "what stands on this cell" is three chances to disagree, which is the sprite frame-map lesson
  // and the isHalfCell lesson wearing a third face. The generator already calls this function and
  // needs no change at all.
  const sc = scatterAt(x, z, seed, () => scatterCharacterAt(x, z, seed))
  if (sc) {
    return sc.kind === SCATTER.ROCK ? MAT.LOOSE_ROCK
      : sc.kind === SCATTER.DEADFALL ? MAT.DEADFALL
      : MAT.MUSHROOM
  }
  }

  const f = floraAt(x, z, seed)
  if (!f) return 0
  return f.kind === FLORA.TUFT ? MAT.TUFT : f.kind === FLORA.TALL ? MAT.TALL_GRASS : MAT.FLOWER
}

/**
 * The LOOK roll for a plant at (x, z) — height jitter, turn and flower colour.
 *
 * Split out so the renderer can derive appearance from position alone once EXISTENCE became voxel
 * data (see `plantMaterialAt`). The per-kind salts are the ones `floraAt` uses, kept identical on
 * purpose: a plant must not change how it looks the moment its existence starts coming from the
 * world instead of from the field. A plant the PLAYER placed has no `floraAt` roll at all and
 * still gets a stable variant here, which is the other half of why this takes `kind` rather than
 * re-running the selection.
 */
export function plantVariant(x: number, z: number, seed: number, kind: number): number {
  // ⚠ CROP GETS ITS OWN SALT RATHER THAN FALLING THROUGH TO TALL'S. The chain's tail is a default,
  // not a case, so a new kind silently inherits `0x9c5` and every wild crop would take the same
  // look-roll as the tall grass on its own cell — correlated jitter and turn, which reads as the
  // two plants having been placed by one hand. Cosmetic, invisible in a test, and free to prevent.
  const salt = kind === FLORA.HERB ? 0x4e2b
    : kind === FLORA.CROP ? 0x2c19
    : kind === FLORA.FLOWER ? 0x77e : kind === FLORA.TUFT ? 0x3b1 : 0x9c5
  return hash01(x, z, seed ^ salt)
}

/**
 * Every material the FLORA RENDERER draws, and therefore every material that legitimately has no
 * slot in the block atlas.
 *
 * ★ WHY THIS EXISTS (2026-08-22): ground cover and terrain are two different pipelines — flora is
 * instanced geometry with its own textures, terrain is the chunk mesh sampling `tex/tiles.ts`. A
 * check that walks the registry looking for materials with no tile slot will therefore find all of
 * these and be RIGHT that they have none, and WRONG that it matters. That check is real
 * (`render-audit.test.ts`) and it caught three blocks shipping as the magenta checkerboard — the
 * garden bed, the four saplings and conjured matter. This set is the exemption it needs, and an
 * exemption is a silent promise that someone is watching that corner, so it is derived and counted
 * rather than hand-listed.
 *
 * ⚠ THE COUNT GUARD BELOW IS THE POINT. A new flora kind added to the enums above without a line
 * here would silently widen the exemption — the exact failure mode this codebase spent 2026-08-22
 * learning. Growing the enum breaks the count, and breaking the count is how you find out.
 */
export const FLORA_MATERIALS: ReadonlySet<number> = new Set<number>([
  MAT.TUFT, MAT.TALL_GRASS, MAT.FLOWER,          // FLORA.TUFT / TALL / FLOWER — the swaying cards
  ...Object.values(HERB_OF_GROUND),              // FLORA.HERB — derived, one per ruled ground
  ...Object.values(CROP_OF_GROUND),              // FLORA.CROP — derived, one per crop's ruled ground
  MAT.LOOSE_ROCK, MAT.DEADFALL, MAT.MUSHROOM,    // SCATTER.ROCK / DEADFALL / MUSHROOM — solid
])

/**
 * What `FLORA_MATERIALS` SHOULD hold, derived from the kind enums rather than from the set.
 *
 * ⚠ TWO DERIVATIONS COMPARED, NOT A VALUE COMPARED TO A COPY OF ITSELF. `FLORA_MATERIALS` is a hand
 * list of literals because the kind→material mapping lives inside `plantMaterialAt` as branches;
 * this counts the same thing from the enums, so the day the enums grow the two stop agreeing. That
 * is the check the 08-22 mirror lesson asks for: compare the derivations, and fail on the EVENT
 * (a kind was added) rather than on the symptom (something rendered wrong).
 */
export const FLORA_KIND_COUNT =
  (Object.keys(FLORA).length - 3)            // every FLORA kind except NONE, HERB and CROP...
  + Object.keys(HERB_OF_GROUND).length       // ...HERB expands to one material per ruled ground
  + Object.keys(CROP_OF_GROUND).length       // ...and CROP to one per crop's ground (2026-08-22)

// ⚠ SCATTER IS NOT ADDED, AND THE FIRST CUT OF THIS ADDED IT AND WAS RED (13 against a set of 10).
// `FLORA` already absorbs the scatter kinds into its own slot space — that is exactly what the
// comment on `FLORA.ROCK` says it is for, so ROCK/DEADFALL/MUSHROOM are members of BOTH enums and
// adding both counts each of them twice. Asserted rather than left as a comment: the two enums must
// keep agreeing about the shared slots, or one of them grew alone.
export const SCATTER_SLOTS_SHARED: boolean =
  (['ROCK', 'DEADFALL', 'MUSHROOM'] as const).every(k => k in FLORA && k in SCATTER)
