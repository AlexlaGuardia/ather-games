// Rinning water — WHERE a keeper can cast, as a pure selection field.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ SELECTION ONLY, NEVER SURFACE TRUTH — the same split flora.ts draws, for the same reason. This
// file answers "is this water, which water is it, and is this stretch alive?" from the fields
// everything else reads (the river field, the water table, sea level). It deliberately does NOT check that the voxel is water: the
// renderer verifies the LIVE voxel at instance time, which is what keeps spots out of player-dug
// holes, off bridge decks and out of a fold's plot without this file re-deriving materials.
//
// ★★ AND THAT SPLIT IS WHY THIS ASKS THE RIVER FIELD RATHER THAN THE GROUND (hub lane, 2026-08-19).
// The obvious shoreline test is "what material is the bank" — and it is the trap that had just been
// removed from four call sites. Ground DRESSING is a live design surface: the shoreline read as
// TOPSOIL/SAND yesterday and reads as MARSH_MUD/LUSH_TURF/SAND today, so a placement rule written
// against materials is re-decided by every future dressing pass, silently. The river field is the
// thing the shoreline is DERIVED from, and it cannot drift out from under us.
//
// ⚠ `TURF` IS NOT A SHORELINE PREDICATE and must not be stretched into one. It answers "can a plant
// stand here", which is a different question — MARSH_MUD is deliberately outside it (mud grows
// nothing, and that is what makes a marsh read as a marsh rather than a lawn with a colour change,
// asserted with its reason in character.test.ts §6). A marsh is prime rinning water and grows
// nothing at all; the two predicates disagree there ON PURPOSE.
//
// ★★ A FISHING SPOT IS A PLACE, NOT A SPECKLE — and this is written in BEFORE the screenshot says
// so. Two lessons converge on it: flora.ts's drifts (*"uniform scatter reads as noise; real meadows
// carry flowers in wandering patches"*) and the slice-② accent bug the same afternoon, where a
// per-column roll rendered the marsh as a lino floor and every assert measured HOW MUCH while none
// measured WHAT SHAPE. A per-column spot roll would scatter one castable cell per pond and read as
// static on the water. So spots ride their own low-frequency field: a stretch of water either holds
// a spot or it doesn't, and inside one the spot is the whole stretch.
//
// ⚠ TBD-CANON: the three spot KINDS below are canon's own (`game/shimmer-skilling.md` › Fishing
// Spots — small pond / stream / lake edge, with canon's level gates and depletion counts). Which
// water in the Wilds IS which is NOT ruled and is a build reading — see RIN_KIND. Nothing here
// invents a named place, a rinn or a catch.

import { value2 } from './noise'
import { riverCarve, riverField, waterSurfaceAt, RIVER_FULL, RIVER_DEPTH, columnHeight } from './height'
import { DEFAULT_DEPTH } from './depth'

export const RIN_NONE = 0
export const RIN_POND = 1   // canon: "small pond" — level 1, 3 catches, 5 min
export const RIN_STREAM = 2 // canon: "stream"     — level 4, 5 catches, 8 min
export const RIN_LAKE = 3   // canon: "lake edge"  — level 7, 8 catches, 12 min

export type RinKind = typeof RIN_NONE | typeof RIN_POND | typeof RIN_STREAM | typeof RIN_LAKE

/**
 * ── ★★ ALL WATER IS CASTABLE. THE FIELD MARKS WHICH WATER IS ALIVE (Alex, 2026-08-19) ───────────
 * The first cut gated castability on this field, so ~30% of water held a spot. That was a SECOND
 * scarcity axis, and canon had already chosen its first: **depletion** — 3 / 5 / 8 catches by spot
 * type, then a respawn timer. Canon's own line is *"water features in your domain serve as fishing
 * spots"*, which reads as *any* water, and Minecraft (the reference Alex named) lets you fish
 * anywhere at all. Two scarcity mechanisms stacked is how a keeper ends up walking a shoreline
 * that refuses them for reasons the game never explains.
 *
 * So the gate is gone and the field survives with a better job: **liveliness**. Every water column
 * can be fished; the field says which stretches are visibly ALIVE — where rise-marks dimple the
 * surface and (the host's call) where the table leans richer. Water still has good places and quiet
 * places, which is what the field was really for; it just no longer says no.
 *
 * ★ The shape rule is unchanged and is the reason this is a field at all: liveliness is a PLACE,
 * tens of blocks across. A per-column roll would speckle rise-marks over the whole surface and read
 * as static rather than as a stretch of water worth standing at.
 */
export const SPOT_SCALE = 120
/** Liveliness field above this = a lively stretch. NOT a gate on fishing — see above. */
export const LIVELY_EDGE = 0.62

/**
 * ── ★ THE CHEAP GATE, AND IT IS THE SAME ONE THE WATER TABLE USES ───────────────────────────────
 * `riverCarve > 0` rejects the overwhelming majority of columns on one field read, which is why the
 * water table can afford to exist on the hot path at all. Rinning asks the same question first and
 * only pays for the rest on survivors. A basin (sea-level water) is the one case that is NOT a
 * river, so it gets its own cheap test — a height compare, no noise at all.
 *
 * Conservative in the same direction as flora's gate: this may admit a column the full read then
 * rejects; it may never reject one the full read would have kept.
 */
export function isWaterColumn(x: number, z: number, seed: number): boolean {
  if (columnHeight(x, z, seed) <= DEFAULT_DEPTH.seaLevel) return true   // basin — the lake case
  return riverCarve(x, z, seed) >= 1                                    // in a carved channel
}

/**
 * ── ★ WHICH WATER IS WHICH — a build reading of canon's three spot types, stated as one ──────────
 * Canon names small pond / stream / lake edge and rules their level gates, catch counts and respawn
 * times. It does NOT say which water in the Wilds is which, because canon described a garden with
 * water features, not a generated continent. This is the mapping, and the reasoning is here so it
 * can be argued with rather than guessed at again:
 *
 *   LAKE   — a basin, water lying below sea level. The biggest bodies in the world; canon's lake
 *            edge is the highest gate (7) and the richest table, and a basin is the only water here
 *            you cannot see across. Cheapest test of the three, which is a happy accident.
 *   POND   — the FULL-DEPTH middle of a channel, where rivers.test.ts already finds "wide full-
 *            channel pools". Still, deep, and enclosed by its own banks: a pond in everything but
 *            provenance. Canon's entry gate (1), so this is the water a new keeper meets.
 *   STREAM — anything shallower in the channel: the running edges. Gate 4.
 *
 * ⚠ THE ORDER IS CANON'S AND IT IS NOT THE OBVIOUS ONE. A stream gates HIGHER than a pond (4 vs 1)
 * even though streams are more common, so the first water a keeper can fish is the deep middle
 * rather than the near edge. Do not "fix" that into ascending rarity — canon set those gates
 * against its own catch tables, and the tiers they unlock are what the numbers are really ordering.
 */
export function rinKindAt(x: number, z: number, seed: number): RinKind {
  if (columnHeight(x, z, seed) <= DEFAULT_DEPTH.seaLevel) return RIN_LAKE
  const carve = riverCarve(x, z, seed)
  if (carve < 1) return RIN_NONE
  return Math.abs(riverField(x, z, seed)) < RIVER_FULL && carve >= RIVER_DEPTH ? RIN_POND : RIN_STREAM
}

export interface RinSpot {
  kind: RinKind
  /** 0..1 deterministic per-column roll — the host maps it to bob phase so a shore isn't in lockstep. */
  variant: number
  /**
   * Is this stretch of water visibly alive? Drives rise-marks, and the host may lean the catch
   * table with it. NEVER a gate on casting — quiet water is fishable water, it is just quiet.
   */
  lively: boolean
  /** The water surface this spot sits on. The host puts the float here; it never guesses a y. */
  surfaceY: number
}

/**
 * The one lookup — everything asks this. Null for the ~97% of the world that is not water, on one
 * field read, before anything else is computed.
 *
 * ★ THE SPOT FIELD IS SAMPLED IN WORLD SPACE, NOT ALONG THE CHANNEL, and that is deliberate: a
 * river crossing a spot region carries a spot for that whole stretch and goes quiet after it, which
 * is what makes one bend of a river worth walking to and the next one not. Sampling per-column
 * would give every bend the same answer, which is the speckle failure wearing a different hat.
 */
export function rinSpotAt(x: number, z: number, seed: number): RinSpot | null {
  const kind = rinKindAt(x, z, seed)
  if (kind === RIN_NONE) return null
  return {
    kind,
    variant: hash01(x, z, seed ^ 0x9e37),
    lively: livelyAt(x, z, seed),
    surfaceY: surfaceFor(kind, x, z, seed),
  }
}

/**
 * The water surface for a spot — and the two kinds of water have two different answers.
 *
 * ── ⚠⚠ `waterSurfaceAt` ONLY ANSWERS FOR RIVERS, AND RETURNS `-Infinity` FOR EVERYTHING ELSE ────
 * Found 2026-08-20 by sweeping depth per spot kind before building the catch table. `waterSurfaceAt`
 * (`height.ts:554`) opens with a riverness gate and returns **`-Infinity`** below it — a documented
 * "no river water here" sentinel, entirely correct for its own callers. But `rinKindAt` classifies
 * **RIN_LAKE** off `columnHeight <= seaLevel`, which is the SEA, and the sea is not a river. So
 * `rinSpotAt` was handing the host `{ kind: RIN_LAKE, surfaceY: -Infinity }` for **4,080 of 18,200
 * water columns — 22% of all the water in the world.**
 *
 * ★ AND THE FIELD'S OWN DOC IS WHY THAT MATTERS: *"The host puts the float here; it never guesses a
 * y."* So the first host to wire a cast would have put the bobber at negative infinity on nearly a
 * quarter of the world's water, on the one spot kind that carries the best catches. It never fired
 * because nothing consumes this file yet — **a bug parked in unconsumed code, waiting for its first
 * caller**, which was going to be today.
 *
 * The sea's surface is not a mystery: `depth.ts:584` fills `MAT.WATER` for every `y <= seaLevel`,
 * so sea level IS the surface, flat by construction. Rivers keep the table lookup they need.
 */
function surfaceFor(kind: RinKind, x: number, z: number, seed: number): number {
  if (kind === RIN_LAKE) return DEFAULT_DEPTH.seaLevel
  return waterSurfaceAt(x, z, seed)
}

/** Is this stretch of water visibly alive? Pure, field-driven, and a PLACE rather than a speckle. */
export function livelyAt(x: number, z: number, seed: number): boolean {
  return value2(x / SPOT_SCALE, z / SPOT_SCALE, seed ^ 0x51ff) >= LIVELY_EDGE
}

const hash01 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
