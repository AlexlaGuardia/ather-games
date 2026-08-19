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
  const salt = kind === FLORA.HERB ? 0x4e2b
    : kind === FLORA.FLOWER ? 0x77e : kind === FLORA.TUFT ? 0x3b1 : 0x9c5
  return hash01(x, z, seed ^ salt)
}
