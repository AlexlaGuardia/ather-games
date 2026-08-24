// The crossing OUT — the Ather side of the door to Rune Hold square.
//
// ★ PURE. Reads the shipped zone map and answers questions about it; touches no DOM, no three, no
// react. `VoxelWorld.tsx` owns the act of crossing, this owns whether there is anywhere to cross TO.
//
// ── ★★ THIS IS THE ONE CROSSING THAT LEAVES THE WAKING WORLD, AND IT IS ALSO A ROUTE CHANGE ──
// Canon (`world/gates.md`, ruled 08-12) gives Rune Hold's square a PUBLIC GATE-LANDING and calls
// the far end of every gate an ESTABLISHED crossing. `game/two-lines-two-games.md` rules what the
// player actually feels at it: *"the gate closes on blocks and opens on real ground"* — the Ather's
// quantized ground giving way to continuous terrain, *"worth staging deliberately."*
//
// In this build those two sides are two Next ROUTES: `/shimmer/voxel3d` walks the voxel world,
// `/shimmer/play3d` walks the tile world Rune Hold is built in. So the crossing is not a teleport
// and cannot be one — it is a page boundary, and everything the plot's `enterSpace` autopsy learned
// about a keeper's position not surviving a change of space applies here with a bigger radius.
//
// ── ★★★ THE GATE ASKS THE MAP, AND THAT IS WHY IT NEEDS NO SECOND WIRING PASS ────────────────
// The landing is not painted yet — it is the one pending door in `world/rune-hold-doors.test.ts`,
// waiting on Alex's brush (press B, the map editor). The tempting shape is a `LANDING_BUILT = false`
// constant flipped by hand later. This repo has paid for that exact thing twice in one week: a
// hand-kept "can't do these yet" list still naming ids that had shipped, and a guard exempting a
// skill *"with its reason"* two days after the reason expired. **An exemption must EXPIRE BY
// ITSELF.** So `crossingReady()` asks the shipped map whether a gate labelled THE LANDING exists,
// and the moment the brush touches the square the door works with nothing rewired and no stale
// sentence left behind. If it is ever unpainted again, the refusal comes back on its own too.

import { ALL_ZONES } from '../world/all-zones'
import { getZone, gateFootprint, type Gate, type Zone } from '../world/zones'
import { stageArrival, type Store, type TilePos } from '../engine/crossing'

/** The town the one home-gate opens onto. Canon's *"established crossing"*, not a keeper's choice. */
export const LANDING_ZONE = 'rune-hold'

/** The gate's nametag on the map. The oracle and the map editor both speak in labels. */
export const LANDING_LABEL = 'THE LANDING'

/**
 * One-shot handoff key, read and CLEARED by the arriving side.
 *
 * ★ STORAGE, NOT MODULE STATE, AND THE PRECEDENT IS ALREADY IN THE TREE. `Shimmer3D.tsx` hands the
 * birth rune across the same boundary with `ather:shimmer:justBorn`, and its comment records why:
 * *"page.tsx and this component are separate code-split chunks and do not share module state
 * (measured 2026-08-07 — a `wasJustReset` flag never arrived)."* A route change is that boundary
 * with a page reload on top, so a module flag is not merely unreliable here, it is guaranteed gone.
 *
 * ⚠ ONE-SHOT MATTERS. A key left behind would re-place the keeper at the landing on every later
 * load of the tile world — the self-feeding shape the plot's `space`-less save had, where each load
 * rewrites the state that caused it. The reader clears before it acts.
 */
export const ARRIVAL_KEY = 'ather:shimmer:arriving'

export interface Arrival {
  zone: string
  /** Tile the keeper stands up on — beside the landing, never on it. See `arrivalAt`. */
  x: number
  y: number
  /** Which door they came through, so the far side can say so rather than guessing. */
  via: string
}

/** The landing gate as the shipped map has it, or null while nobody has painted one. */
export function landingGate(zones: Zone[] = ALL_ZONES): Gate | null {
  const town = getZone(zones, LANDING_ZONE)
  const gates: Gate[] = (town as (Zone & { gates?: Gate[] }) | undefined)?.gates ?? []
  return gates.find(g => g.label.toUpperCase() === LANDING_LABEL) ?? null
}

/** Is there anywhere to cross to? Asked of the MAP, never of a constant someone must remember. */
export const crossingReady = (zones: Zone[] = ALL_ZONES): boolean => landingGate(zones) !== null

/**
 * ── ★★ THIS MODULE DOES NOT CHOOSE WHERE THE KEEPER STANDS UP, AND THAT IS DELIBERATE ────────
 * The first draft derived it — "one tile south of the footprint" — which is precisely the guess
 * the hub refused to make when I asked them for the anchor, and they were right: which tiles are
 * "the square" is Alex's map knowledge, he painted the town, and a derived landing is a wall or a
 * rooftop with a green test beside it. A plausible coordinate is the worst kind of wrong here,
 * because nothing downstream can tell it from a real one.
 *
 * So the tile is a PARAMETER, read off the map once the landing is painted. What this module does
 * own is refusing a tile that cannot work.
 */

/**
 * May the keeper stand up here?
 *
 * ⚠⚠ BESIDE A GATE, NEVER ON ONE. `Gate.toX/toY` carries the warning in the type itself — *"MUST
 * NOT be inside another gate's footprint, or you bounce straight back"* — and a gate tile is
 * exactly what a warp fires on. An arrival placed on any gate is an instant re-warp: the keeper
 * appears and is immediately sent wherever that gate leads, which reads as the crossing being
 * broken rather than as the arrival being one tile off. Checked against EVERY gate in the zone,
 * not just the landing, because the square holds four doors and the trap is the same for all.
 *
 * ★ `gateFootprint` rather than `size ?? 2`: that default was restated in four places, and the
 * landing is the first NON-SQUARE gate on the map (1×2, Alex's, ruled 08-24) — the one case where
 * the old shorthand silently reads the wrong shape.
 */
export function arrivalBlockedBy(x: number, y: number, zones: Zone[] = ALL_ZONES): Gate | null {
  const town = getZone(zones, LANDING_ZONE)
  const gates: Gate[] = (town as (Zone & { gates?: Gate[] }) | undefined)?.gates ?? []
  for (const g of gates) {
    const { w, h } = gateFootprint(g)
    if (x >= g.x && x < g.x + w && y >= g.y && y < g.y + h) return g
  }
  return null
}

/**
 * The payload the departing side writes, for a tile someone else chose. Kept small and explicit —
 * it crosses a page boundary, so every field has to survive a reload with no module state behind it.
 *
 * Returns null rather than a payload when the tile would bounce, so a bad anchor fails at the
 * moment it is offered instead of in the walkthrough.
 */
export function packArrival(
  g: Gate, x: number, y: number, zones: Zone[] = ALL_ZONES,
): Arrival | null {
  if (arrivalBlockedBy(x, y, zones)) return null
  return { zone: LANDING_ZONE, x, y, via: g.label }
}

/**
 * ── ★ THE DEPARTURE, AS ONE CALL ─────────────────────────────────────────────────────────────
 * Everything a keeper stepping into the home-gate needs, so the host does exactly two things:
 * call this, and — if it returns a payload — navigate. Putting the refusals HERE rather than in
 * `VoxelWorld.tsx` is the same inversion `socketMaterial` needed: a rule that lives in a render
 * file is a rule no oracle can reach, and this one has three ways to say no.
 *
 * ⚠⚠ IT WRITES THE ONE-SHOT AND NOTHING ELSE, and that is the contract's *no committed middle*
 * (`engine/crossing.ts`). The tempting symmetry — also parking the keeper at the gate on the Ather
 * side so they "come back where they left" — is precisely the committed middle: a tab that dies
 * between the two writes leaves a keeper whose Ather record has moved for a crossing that never
 * happened. Either the departure has not happened, or the arrival is complete. Nothing between.
 *
 * ★ THE PAYLOAD THAT CROSSES IS `TilePos` AND NOTHING MORE. `via` is returned to the caller for
 * what it says on screen, and deliberately does NOT persist: a field that crosses a page boundary
 * is a field the far side can come to depend on, and the contract's shape is the hub's to widen.
 */
export function depart(
  store: Store, anchor: { x: number; y: number }, zones: Zone[] = ALL_ZONES,
): { staged: TilePos; via: string } | { refused: 'unpainted' | 'blocked' } {
  const g = landingGate(zones)
  if (!g) return { refused: 'unpainted' }
  const packed = packArrival(g, anchor.x, anchor.y, zones)
  if (!packed) return { refused: 'blocked' }
  const staged: TilePos = { zone: packed.zone, x: packed.x, y: packed.y }
  stageArrival(store, staged)
  return { staged, via: packed.via }
}
