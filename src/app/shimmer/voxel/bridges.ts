// The story road's bridges — a crossing that knows its own span.
//
// ★ PURE GEOMETRY, MATERIALS PASSED IN. Imports story-path (the spine) and height (where the water
// is) and nothing else. Materials arrive as ARGUMENTS, exactly as `holdVoxelAt` takes its stone and
// its lantern, because depth.ts imports this file and the reverse import would close a cycle.
//
// ── WHY THIS FILE EXISTS (2026-08-22, Alex: "the bridges.. more realistic") ───────────────────
// A bridge used to be three parity tests inside `materialAt`: a flat deck layer at `table + 1`,
// stone wherever `x % 4 === 0 && z % 4 === 0`, and a rail voxel on the corridor edge. Every one of
// those is a statement about a COLUMN, and a bridge is not a column — so the rule had no way to
// know a bridge was even happening. Three consequences, all of them the same bug wearing different
// clothes:
//
//   1. The deck sat ONE block over the water, so it read as a boardwalk skimming the surface.
//      Nothing passes underneath: not a swimmer, not a rinn, not the eye.
//   2. The piers stood on a WORLD grid rather than the bridge's own. Pier spacing therefore had no
//      relationship to the span — they bunch at one end, land a block off the bank, or (a narrow
//      crossing on the wrong parity) fail to appear at all. A 1x1 stick with no footing and no cap.
//   3. A four-block creek and a sixty-block river generated IDENTICALLY. Being shaped by its span
//      is the single loudest thing a real bridge does, and we had none of it.
//
// So a crossing becomes an object, found once per seed, on the `holds.ts` pattern: a spec list, a
// cheap `bridgeAt(x, z)` index, and a `bridgeVoxelAt(...)` that answers the voxel. Once the bridge
// knows its span, the realism levers stop being special cases and become arithmetic.
//
// ── ★★ THE ARCH IS NOT DECORATION — IT IS THE ONLY WAY TO GET CLEARANCE ───────────────────────
// `height.ts`'s approach blend aims river banks at `table + 1` (:368), and that is why the old deck
// sat there. That flush join is worth keeping and it is also the whole constraint. Lift a FLAT deck
// for clearance and it no longer meets the ground at either end, so you owe abutment ramps at both
// banks and a keeper walks up a step to get on the bridge.
//
// ⚠⚠ THIS PARAGRAPH USED TO END "deck and bank met flush by construction, no ramp logic anywhere",
// AND THAT CLAIM WAS FALSE FOR AS LONG AS IT STOOD (corrected 2026-08-30, after Alex found it in
// play). The blend AIMS at `table + 1`; it does not arrive there. Measured across two seeds, banks
// land at the table itself and banks stand above `table + 1`, and a deck that springs at
// `table + 1` regardless put a FULL-BLOCK step — a vault — at 6 of 22 crossing-ends. The ramps this
// paragraph says are not needed are now built; see `ABUT_REACH` and `deckTopAt`. A comment that
// asserts an invariant nothing checks is the shape this file has been bitten by twice.
//
// An arch pays for itself twice: it SPRINGS at the bank (join preserved, exactly as before — at
// `table + 1`, or at the bank's own height where the abutment had to reach for it) and rises over
// the water in the middle (clearance, where the clearance is wanted). The
// short creek keeps its flat plank because its arch rounds to nothing, and the wide river gets a
// real hump. That is item 3 above solving itself out of one formula rather than a span-type switch.
//
// ── ★★ AND THE ARCH MUST CLIMB IN HALF-STEPS, WHICH IS WHY IT IS WALKABLE ─────────────────────
// `locomotion.ts` is unambiguous: `STEP_CAPTURE` 0.55 walks a +0.5 rise with no press, and a full
// +1 "stays out of reach and stays a vault" (:113, :144). A whole-block arch would therefore be a
// row of vaults — a bridge you MANTLE across, which is worse than the flat boardwalk it replaced.
// Slabs are a real material since 2026-08-11 (Alex: "make half blocks an actual item"), so the deck
// climbs in HALF_BIT courses and the existing step capture carries the keeper over without a single
// new line of locomotion. The cap `RISE_PER_4` exists to hold that invariant and nothing else:
// exceed it and the arch starts emitting 1-block risers again, silently, as vaults.

import { STORY_NODES, roadAt } from './story-path'
import type { GenPiece } from './holds'
import {
  columnHeight, riverCarve, waterSurfaceAt, RIVER_DEPTH,
  type HeightConfig, DEFAULT_HEIGHT,
} from './height'

/**
 * ★★ A CROSSING IS ONE OF THREE THINGS, AND THE SPAN DECIDES WHICH (2026-08-22, Alex: *"lets do the
 * span-typed crossings for that viaduct, this one is still a bit crunched together"*).
 *
 * Slice 1 gave every crossing an arch keyed to its span and left the rest span-blind. Two symptoms,
 * one cause. The board read: **every bridge on the map had a bay of 6-7 blocks**, from the 10-block
 * creek to the 149-block river — so the short crossings were a thicket of piers standing shoulder to
 * shoulder ("crunched"), and the long one was twenty identical sticks in a row, which is not a
 * viaduct, it is a fence in water. A constant bay is the same defect as the constant deck height it
 * replaced: **a number that does not know the span it is spanning.**
 *
 * Real crossings hold a roughly constant NUMBER of bays and grow the bay itself. So bay length is
 * derived (`TARGET_BAYS`, clamped) and the span picks a KIND, which sets how high the deck runs, what
 * the piers are made of, and how heavy they are.
 */
export type BridgeKind = 'plank' | 'trestle' | 'viaduct'

/** Below this a crossing is a log laid over a creek: no piers, barely a camber. */
const PLANK_MAX = 14
/** At or above this it is masonry: stone piers, the longest bays, the highest running deck. */
const VIADUCT_MIN = 55

interface KindSpec {
  /** Crown height above `table + 1`, in HALF-steps. The deck runs flat here between its ramps. */
  rise: number
  /** Half-length of a pier along the span. A 25-block bay under a 3-block pier reads spindly. */
  pierHalf: number
  /** Piers are the road's own timber on a trestle, quarried stone on a viaduct. No new material id
   *  either way — a new id with no atlas slot renders as the magenta checker. */
  stonePiers: boolean
  /**
   * ★★ HOW THE PIER CARRIES THE DECK, AND IT IS A MATERIAL ARGUMENT, NOT A TASTE ONE.
   *
   * `solid` is a masonry pier: quarried stone is strong in compression and is built as a mass, so a
   * viaduct's pier is a filled block and reads correctly as one — helped by the stone contrasting
   * with the timber deck above it.
   *
   * `bent` is a timber trestle: you cannot quarry a 5-wide block of wood. A trestle is POSTS with a
   * cap beam across their heads, and the daylight between the posts is what makes it read as a road
   * being CARRIED rather than as a wall standing in the river. The first cut gave the trestle a
   * solid pier in the DECK'S OWN MATERIAL, so support and roadway merged into one timber mass — a
   * bulkhead 5 cells wide under a 7-cell deck. The viaduct escaped it only because stone ≠ deck.
   */
  pierStyle: 'solid' | 'bent'
  /** ★★ BAY BOUNDS ARE PER KIND BECAUSE THE MATERIAL DECIDES THEM. Timber cannot carry far, so a
   *  trestle stands on short bays; a masonry arch is the opposite and wants long ones. A single
   *  global pair cannot be right for both, and the first cut proved it — a shared MIN_BAY of 12 was
   *  too long for a 20-block trestle and far too short for the viaduct it was written for. */
  minBay: number
  maxBay: number
}

const KINDS: Record<BridgeKind, KindSpec> = {
  // A plank does not arch and stands on nothing. Its clearance is that a creek is shallow, not that
  // the deck is high, and `minBay = PLANK_MAX` is what makes "no piers" fall out of the same
  // arithmetic as everything else instead of needing a branch: no bay fits, so there is one bay.
  plank:   { rise: 2,  pierHalf: 1, stonePiers: false, pierStyle: 'bent',  minBay: PLANK_MAX, maxBay: PLANK_MAX },
  trestle: { rise: 8,  pierHalf: 1, stonePiers: false, pierStyle: 'bent',  minBay: 9,  maxBay: 14 },
  viaduct: { rise: 10, pierHalf: 2, stonePiers: true,  pierStyle: 'solid', minBay: 18, maxBay: 26 },
}

export function kindFor(span: number): BridgeKind {
  return span < PLANK_MAX ? 'plank' : span < VIADUCT_MIN ? 'trestle' : 'viaduct'
}

/** Bays a crossing wants, before the kind's length clamps. Four reads as designed at every scale. */
const TARGET_BAYS = 4
/**
 * ★★★ HALF-WIDTH OF THE DECK RIBBON, AND THE REASON IT IS A RIBBON AT ALL (2026-08-22, Alex:
 * *"still crunched together not leaving much room to walk it"*).
 *
 * The footprint used to be `roadAt ∩ submerged` — the intersection of a WOBBLED road with a RAGGED
 * waterline. So the deck was whatever shape that accident produced: measured across the map, rows
 * ran 1 to 5 cells wide with a **median of 2**, and **152 of 546 rows were a single cell**. Then the
 * rail rule took the outermost cell of each side, which on a 3-cell row leaves ONE walkable block.
 * `thistle-hold-4` had a median walkable width of 1 for its whole length. That is a tightrope with
 * handrails, not a bridge, and it is exactly what "not much room to walk it" means.
 *
 * ⚠ THE PARAPET WAS EATING THE ROADWAY. A real deck is built WIDER than the path it carries so the
 * parapet sits OUTSIDE the traffic; ours was subtracting itself from a road that was already narrow.
 *
 * So the deck stops being an intersection and becomes a **rasterised ribbon of constant width on the
 * crossing's own axis**: 7 cells across, rails on the outer pair, **5 walkable everywhere**. Constant
 * width also kills the raggedness that produced the walled mouths and the 1-cell rows in the first
 * place — those were symptoms of the same accident.
 */
const DECK_HALF = 3
/** Sub-cell step used to rasterise the ribbon. A diagonal axis stepped at 1.0 aliases and leaves
 *  holes in the deck; 0.5 covers every cell the ribbon passes through. */
const RASTER = 0.5
/** Courses above the bed that widen back to full deck width — the footing. */
const FOOTING = 2
/** Perpendicular inset of the pier from the deck edge. A pier flush with the deck is a wall. */
const PIER_INSET = 1
/**
 * ★★ A RAILING IS POSTS AND A TOP RAIL, NOT A KERB (2026-08-22, Alex: *"the railings at least should
 * be added to make it cleaner"*).
 *
 * The parapet was a single solid course sitting directly on the deck edge. That is a KERB: from any
 * distance it reads as the deck being one block thicker, which is why Alex asked for railings on a
 * bridge that already had them. What makes a railing legible is the **daylight under the top rail** —
 * the eye reads posts + a line + gaps as a handrail, and reads a continuous block as a wall.
 *
 * So: a continuous top rail two courses over the deck, standing on posts every `RAIL_POST_EVERY`
 * blocks, and nothing in between. Same total material, opened up.
 */
const RAIL_POST_EVERY = 3

/** Where a trestle's outer posts stand, as |s| from the axis. Inboard of the deck edge so the
 *  parapet overhangs them slightly, which is what stops a bent reading as a wall's top. */
const POST_OFFSET = 2
/** How close a cell's |s| must be to a post's line to BE that post. Half a cell either way: the
 *  ribbon's cells do not land on exact integers, so an equality test would drop posts at random. */
const POST_GRAB = 0.6
/**
 * ★★ A ROW NARROWER THAN THIS CARRIES NO RAIL. **The parapet may never be what makes a row unusable.**
 *
 * This started at 3, from the walled-mouth bug: a rail is the outermost cell of a row, so on a
 * 2-cell row BOTH cells are rail and the row becomes a wall a block high — at the bridge MOUTH
 * specifically, where the ribbon tapers into the bank. Every crossing on both seeds was walled at
 * one end or both.
 *
 * ⚠ 3 was the right SHAPE and the wrong NUMBER, and the difference only showed up once the deck was
 * wide enough for anyone to notice: a 4-cell row still surrenders two cells to rails and leaves TWO
 * to walk on. 5 is the smallest row that can pay for its own parapet and still leave 3 abreast, and
 * that — not the wall — is the property being defended. The end taper now drops its rails instead of
 * pinching the walkway, which is also what a real abutment does as the deck meets the ground.
 */
const RAIL_MIN_WIDTH = 5
/** The steepest the deck may climb per column. `STEP_CAPTURE` is 0.55, so 0.5 is walked with no
 *  press and a full 1.0 is a vault. This is a locomotion fact, not a taste dial. */
const MAX_GRADE = 0.5

/**
 * ★★★ HOW FAR THE DECK MAY REACH PAST ITS OWN SPRINGING TO MEET THE GROUND — the abutment.
 *
 * Measured 2026-08-30 (Alex, from play: *"i found alot of instances where they didnt land on the
 * shore smoothly"*): of 22 crossing-ends, **11 were flush, 5 were a half-step (walkable — see
 * MAX_GRADE), and 6 were a FULL BLOCK, which locomotion treats as a vault.** A bridge you mantle
 * off is the same defect as a bridge you mantle across.
 *
 * ⚠⚠ AND THE DIRECTION IS THE OPPOSITE OF WHAT THIS FILE PREVIOUSLY RECORDED. The board read
 * "18 SHORE HIGHER, up to +2" and framed the fix as a ramp climbing to a higher bank. That number
 * came from an instrument that read `columnHeight` on BOTH sides of the join — and `height.ts`
 * contains no reference to bridges, so it was comparing the terrain under the deck against the
 * terrain beside it and never saw the deck at all. Measured against `deckTopAt` on the actual
 * spine, **5 of the 6 real defects are DROPS and 1 is a step up.** An up-ramp would have fixed one
 * end and missed five. (`scripts/bridge-landings.mts` carries the full post-mortem.)
 *
 * WHY THE FIX LAYS BLOCKS RATHER THAN MOVING GROUND: `holds.ts` can flatten terrain because
 * `height.ts` imports it. This file imports `height.ts`, so the arrow runs the other way and a
 * bridge cannot contribute a height blend without restructuring the module graph. Which is also
 * what Alex proposed independently: *"premake all the blocks from one end of the bridge to the
 * other, including the shore."*
 *
 * ★★ ONE MECHANISM COVERS BOTH DIRECTIONS, AND THE EXISTING SKIP RULE ENDS IT. The ribbon is
 * rasterised past the springing by `ABUT_REACH`; those cells descend toward the landing ground at
 * MAX_GRADE. The survey ALREADY refuses a bank cell whose ground stands at or above the deck
 * (`nearBank && h >= deckTop`), so the apron terminates itself exactly where the ground rises to
 * meet it — no length calculation, no second rule to keep in step with the first.
 */
export const ABUT_REACH = 4

/**
 * ⚠ The most a landing may drag the deck away from `table + 1`, in blocks. A clamp, not a dial:
 * `abut` is a MEASURED ground height, so an unclamped bank could ask the deck to climb any amount
 * and would silently push the crossing through `BRIDGE_REACH` — the caller's y-gate — which slices
 * the top off a deck without erroring. `BRIDGE_REACH` adds this for exactly that reason; the two
 * constants are one decision and must move together.
 */
const ABUT_MAX = 2

/**
 * ★ HOW FAR ABOVE ITS OWN GROUND A BRIDGE CAN REACH — the caller's cheap y-band gate, DERIVED.
 *
 * depth.ts early-outs on `y - h` before it asks anything expensive, and that gate was written for a
 * flat deck at `table + 1`: `RIVER_DEPTH + 4`, i.e. 7. An arch needs 10, so shipping the arch under
 * the old gate would have sliced the top off every crossing in the world — silently, because a
 * clipped deck still looks like a deck from the bank.
 *
 * Derived from the geometry constants rather than measured and pasted, so adding a taller KIND
 * cannot leave the gate behind: rail sits one over the deck, the deck springs one over the table,
 * the crown adds the tallest kind's rise, and the bed can sit RIVER_DEPTH under the table. `bridges.test.ts` walks the real
 * corridor and asserts nothing ever wants a cell above it, so the derivation is checked against
 * worldgen instead of trusted.
 */
/**
 * ★★★ HOW FAR FROM THE SPINE A BRIDGE CELL CAN SIT — the caller's cheap HORIZONTAL gate.
 *
 * depth.ts used to pre-filter with `roadAt`, which was correct while the footprint WAS the road.
 * The ribbon is wider than the road on purpose (that is the whole point — the parapet must sit
 * outside the traffic), so `roadAt` began throwing away the very cells that make it wide:
 * **44% of the ribbon and 93% of every rail**, silently, in the shipped build.
 *
 * ⚠ AND THE ORACLE COULD NOT SEE IT, because it calls `bridgeVoxelAt` directly while the world calls
 * it through `materialAt`'s gate — two paths, one tested. Same shape as the prebuilt-worker trap:
 * both halves internally consistent, disagreeing about what exists. `bridges.test.ts` now asserts
 * through `materialAt` for exactly this reason; do not remove that check.
 */
export const BRIDGE_BAND = DECK_HALF + 2

export const BRIDGE_REACH = Math.max(...Object.values(KINDS).map(k => k.rise)) / 2 + 2 + RIVER_DEPTH + 1 + ABUT_MAX

export interface BridgeSpec {
  id: string
  /** What the span made it. Sets crown height, pier material and pier heft. */
  kind: BridgeKind
  /** Span in blocks, bank anchor to bank anchor along the centreline. */
  span: number
  /** Whole-voxel water table this crossing stands over. The deck springs from `table + 1`. */
  table: number
  /** Lowest generated ground anywhere on the crossing. Reporting/gating only: a pier drops to its
   *  OWN bed (`pierBed`), because on a 149-block span the deepest point can be four blocks under
   *  the shallows and every pier would otherwise start buried in the bank it does not stand on. */
  bed: number
  /** Crown height above `table + 1`, in HALF-steps, after the span's own ramp-fitting clamp. */
  rise: number
  /** Half-length of each pier along the span, from the kind. */
  pierHalf: number
  /** Along-span offsets carrying a pier. Empty for a span too short to need one. */
  piers: number[]
  /** Bed level under each pier, index-parallel to `piers`. ⚠ NOT `spec.bed` — see the note there. */
  pierBed: number[]
  /** ★ Where each pier stands, in world cells. Carried so the oracle can RE-DERIVE `pierBed` from
   *  worldgen instead of range-checking it. A `pierBed[k] >= bed` assert is satisfied by equality,
   *  so it passes cleanly when every pier is collapsed back onto the crossing minimum — which is
   *  the exact regression `pierBed` exists to prevent, and a mutation sweep proved it survived. */
  pierPos: { x: number; z: number }[]
  /**
   * ★★ THE GROUND EACH END ACTUALLY LANDS ON — `[near, far]`, whole blocks, clamped to
   * `table + 1 ± ABUT_MAX`. This is the field that lets `deckTopAt` stay pure.
   *
   * `deckTopAt(spec, t)` has no world position and cannot ask where the bank is. But the SPEC is
   * surveyed — `table` is already a measured world fact sitting one field up — so the landing is
   * measured once, here, and the pure function keeps its exact signature. That is why this is not
   * a parallel abutment pass: a second path would leave the 371-assert oracle running through
   * `deckTopAt` while the world ran through something else, which is the `bridgeVoxelAt`
   * vs `materialAt` split that cost a day on 08-22.
   */
  abut: [number, number]
}

/** What a bridge column knows about itself: which bridge, and where it stands on it. */
export interface BridgeCell {
  /** Index into the seed's spec list. */
  i: number
  /** Distance along the span, in blocks, from the near bank. */
  t: number
  /** Perpendicular offset from the centreline, in blocks. Negative is one side, positive the other. */
  s: number
  /** ★ Outermost cell of the band at this `t` — MEASURED in the survey, never derived from a
   *  constant half-width. The road is wobbled (`ROAD_WOBBLE` 1.4), so its edge moves by up to three
   *  cells along a single crossing; a fixed threshold puts rails on some rows and not others and
   *  leaves gaps a keeper walks straight through. */
  edge: boolean
  /** Band half-width at this `t`. The pier reads it so a pier is never wider than its own deck. */
  half: number
  /**
   * ★★ RANK OF THIS CELL ACROSS ITS ROW, 0 = one flank, `n - 1` = the other, and everything that
   * places geometry ACROSS the deck now uses this instead of `s`.
   *
   * `s` is a continuous projection, and the ribbon is rasterised, so the cells of one row land on
   * uneven offsets — a row can be s = -3.1, -2.2, -1.4, -0.5, 0.4, 1.2, 2.1. Matching a post to a
   * band of `|s|` therefore hits two cells on one flank and none on the other: the first cut of the
   * timber bent came out `.D.DDD.` where it should be `.D.D.D.`, and the masonry pier sat visibly
   * off-centre. An INDEX is symmetric by construction and does not care how the raster fell.
   */
  idx: number
  /** How many cells this row has. `idx` is meaningless without it. */
  n: number
  /**
   * ★ The generated ground height at this column, measured in the survey (it already samples it to
   * decide whether the cell belongs to the ribbon at all). An apron cell must be filled SOLID from
   * the ground up, or it is a slab floating over the bank — and `bridgeVoxelAt` has no world
   * position with which to ask. Mid-span cells carry it too and never use it: the fill is scoped to
   * `t` outside the span, because a fill mid-span would wall in the river.
   */
  g: number
}

interface BridgeIndex {
  specs: BridgeSpec[]
  cells: Map<string, BridgeCell>
  /** Railing pieces for the whole seed, built once with the survey. */
  rails: GenPiece[]
}

const CACHE = new Map<string, BridgeIndex>()

/** Is this centreline column standing over open water? The survey's one question. */
function submerged(x: number, z: number, seed: number, cfg: HeightConfig): number | null {
  if (riverCarve(x, z, seed, cfg) < 1) return null
  const table = Math.floor(waterSurfaceAt(x, z, seed, cfg))
  return columnHeight(x, z, seed, cfg) <= table ? table : null
}

/**
 * Survey the spine once and find every crossing.
 *
 * ⚠ The footprint is deliberately the SAME set of columns the old parity rule fired on: a road cell
 * whose own ground is at or under the table. This pass changes where the deck sits and where the
 * piers stand; it does not move a single bridge or invent a new one. `bridge-deck.test.ts` asserts
 * the spine still has bridges and that they are built of deck, and it should stay green without
 * being touched — if it goes red, this survey has drifted from the generator and that is the bug,
 * not the test.
 */
function survey(seed: number, cfg: HeightConfig): BridgeIndex {
  const specs: BridgeSpec[] = []
  const cells = new Map<string, BridgeCell>()

  for (let n = 0; n < STORY_NODES.length - 1; n++) {
    const a = STORY_NODES[n], b = STORY_NODES[n + 1]
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len, uz = dz / len

    // Walk the centreline a block at a time, collecting contiguous runs of wet road.
    let runStart = -1
    for (let d = 0; d <= len; d++) {
      const cx = Math.floor(a.x + ux * d), cz = Math.floor(a.z + uz * d)
      const table = submerged(cx, cz, seed, cfg)
      if (table !== null && runStart < 0) runStart = d
      if (table === null && runStart >= 0) {
        emit(runStart, d - 1)
        runStart = -1
      }
    }
    if (runStart >= 0) emit(runStart, Math.floor(len))

    function emit(d0: number, d1: number): void {
      const span = d1 - d0 + 1
      if (span < 1) return
      const i = specs.length
      const id = `${STORY_NODES[n].id}-${i}`

      // The crossing's own frame: origin at the near bank, +u along the span.
      const ox = a.x + ux * d0, oz = a.z + uz * d0

      // ★ The kind, the crown and the table have to be known BEFORE the ribbon is rasterised,
      // because the ribbon's own "am I above the ground here" test needs the deck profile.
      const kind = kindFor(span)
      const k = KINDS[kind]
      const riseFor = Math.max(0, Math.min(k.rise, Math.floor(span / 2)))
      const tbl = Math.floor(waterSurfaceAt(Math.floor(ox + ux * (span / 2)), Math.floor(oz + uz * (span / 2)), seed, cfg))

      // ★★ RASTERISE THE RIBBON, DO NOT FILTER A BBOX. Walk the crossing's own (t, s) frame at
      // sub-cell resolution and stamp whatever world cell each sample lands in. This is what makes
      // the width CONSTANT: every row gets the same 7 cells regardless of where the road wobbled or
      // where the waterline happens to cut. `roadAt` no longer decides the shape — a bridge is a
      // structure, not a terrain feature, and asking the road for its outline is what produced a
      // deck one block wide.
      // ★★ THE GROUND EACH END LANDS ON — measured on the centreline, once, before the ribbon is
      // rasterised (the raster needs the deck profile, and the deck profile now needs this).
      // "Dry" is asked of `submerged`, the survey's own question, rather than re-derived: a column
      // can sit below the water TABLE and carry no water at all when it is outside the channel, so
      // `h <= table` is a different question and answers it wrongly on exactly these bank cells.
      const landingAt = (t0: number, step: number): number => {
        for (let k = 1; k <= ABUT_REACH + 6; k++) {
          const t = t0 + step * k
          const lx = Math.floor(ox + ux * t), lz = Math.floor(oz + uz * t)
          if (submerged(lx, lz, seed, cfg) !== null) continue       // still over the water
          // ⚠⚠⚠ `+ 1` IS THE WHOLE FIX, AND ITS ABSENCE MADE THE FIRST ABUTMENT INERT.
          // `columnHeight` returns the index of the TOP SOLID CELL — `depth.ts` fills the surface
          // voxel at `depth === 0`, i.e. AT `y === h` — so a keeper stands at `h + 1`. `deckTopAt`
          // returns the STANDING SURFACE (`table + 1` springs one above the waterline). Feeding a
          // top-solid index into a function that speaks surfaces is a silent off-by-one, and it
          // aimed every abutment exactly one block low: measured against the true walking surface
          // on both sides, the first cut moved 12 vaults to 13 — no improvement at all, while a
          // probe comparing `deckTopAt` against `columnHeight` reported it fixed. **Two quantities
          // one block apart, both honest, both named like heights.**
          const h = columnHeight(lx, lz, seed, cfg) + 1
          return Math.max(tbl + 1 - ABUT_MAX, Math.min(tbl + 1 + ABUT_MAX, h))
        }
        return tbl + 1        // never reached dry ground inside the probe — leave the deck alone
      }
      const abut: [number, number] = [landingAt(0, -1), landingAt(span, +1)]

      // ★ THE RIBBON ASKS `deckTopAt`, IT DOES NOT RESTATE IT. This loop used to carry its own copy
      // of the arch formula, which was correct while there was only an arch; the abutment gives the
      // two a way to disagree, and a copy that agrees with its original is not evidence about
      // either of them. A provisional spec costs one object and removes the mirror entirely.
      const profile = { table: tbl, span, rise: riseFor, abut } as BridgeSpec

      // ⚠ `ABUT_REACH` IS A BOUND, NOT A LENGTH. How far the apron actually runs is decided by the
      // descending ramp meeting the ground (`h >= deckTop`, below) — see the two bugs written up
      // on `deckTopAt`. This only says how far out it is worth asking.
      //
      // ★★★ AND AN APRON IS ONLY EVER BUILT TOWARD A BANK THAT SITS BELOW THE SPRINGING. It exists
      // to reach DOWN to low ground; against a RISING bank the ramp descends while the terrain
      // climbs, so the two cross and the join lands mid-slope. `moonwell-glade-0 far` on seed 1 is
      // that case exactly — bank going 123 → 124 → 125 → 126 while the apron walked out on top of
      // it — and it was the last full-block step left in either seed. Where the bank is at or above
      // the springing the deck climbs to meet it INSIDE the span (see `deckTopAt`) and the ribbon
      // ends where it always did.
      const apronReach = (land: number): number => land < tbl + 1 ? ABUT_REACH : 0
      const apronNear = apronReach(abut[0]), apronFar = apronReach(abut[1])

      let table = -Infinity, bed = Infinity, found = 0
      const mine: { key: string; t: number; s: number; g: number }[] = []
      const claimed = new Map<string, number>()   // world cell -> |s| that claimed it
      for (let t = -apronNear; t <= span + apronFar; t += RASTER) {
        for (let so = -DECK_HALF; so <= DECK_HALF; so += RASTER) {
          const x = Math.floor(ox + ux * t - uz * so)
          const z = Math.floor(oz + uz * t + ux * so)
          const key = `${x},${z}`
          if (cells.has(key)) continue          // another crossing already owns it
          const h = columnHeight(x, z, seed, cfg)
          // The ground test's job is to stop the ribbon burying itself in a hillside where it meets
          // the bank, so it is scoped to the abutment: a bridge SPANS a shoal rather than opening a
          // notch over it, and only the ends taper.
          // ⚠ HONESTLY LABELLED: this scoping makes no measured difference on either seed. Removing
          // it — applying the ground rule along the whole span — leaves the oracle fully green,
          // because a cell skipped over a shoal has solid ground at deck height and is walkable
          // anyway. It is kept because it is the right description of a bridge, NOT because it fixes
          // anything today, and it must not be cited as load-bearing. (I first wrote it up as the fix
          // for three deck holes; those holes were the assert's own false positive at the springing,
          // where the bank sits flush with the deck.)
          const deckTop = deckTopAt(profile, t)
          // ★★ THIS IS ALSO WHAT ENDS THE APRON. Outside the span every cell is "near bank", so the
          // apron is laid only while the ground still stands below the descending deck and stops
          // itself the moment the bank rises to meet it. No apron length is computed anywhere.
          const nearBank = t < 2 || t > span - 2
          if (nearBank && h >= deckTop) continue
          if (claimed.has(key)) continue
          claimed.set(key, 1)
          // ⚠ THE CELL'S OFFSET IS ITS OWN, NOT THE SAMPLE'S. A world cell is hit by several (t, s)
          // samples, and recording the SAMPLE's `s` (keeping whichever landed nearest the axis)
          // systematically pulls every cell's offset inward — which erases the edge flag and
          // silently unrails 118 of 545 rows. Project the cell CENTRE back onto the crossing frame
          // instead: one true answer per cell, independent of which sample happened to find it.
          const px = x + 0.5 - ox, pz = z + 0.5 - oz
          mine.push({ key, t: px * ux + pz * uz, s: -px * uz + pz * ux, g: h })
          found++
          table = Math.max(table, tbl)
          bed = Math.min(bed, h)
        }
      }

      if (found === 0) return

      // ★ THE BAND'S EDGE IS MEASURED, ONE ROW AT A TIME. Group the crossing's cells by whole `t`
      // and flag the extreme `s` in each row. This is the same reasoning that took the rail off a
      // neighbour probe: `roadAt` is wobbled, so the outermost cell of row 12 and the outermost of
      // row 13 can sit three blocks apart, and any constant threshold rails one and not the other.
      const rows = new Map<number, { lo: number; hi: number; n: number }>()
      for (const c of mine) {
        const r = Math.round(c.t)
        const cur = rows.get(r)
        if (!cur) rows.set(r, { lo: c.s, hi: c.s, n: 1 })
        else { if (c.s < cur.lo) cur.lo = c.s; if (c.s > cur.hi) cur.hi = c.s; cur.n++ }
      }

      // ★★ RISE IS CLAMPED BY THE RAMPS, NOT BY A GLOBAL CEILING. The deck climbs at MAX_GRADE and
      // no faster (locomotion, not taste), so a crown of `rise` half-steps needs `rise` columns of
      // ramp at EACH end. A span too short for two ramps cannot reach its kind's crown, and it gets
      // the crown it can actually fit rather than a steeper climb — the one thing that would turn
      // the deck back into a row of vaults. (Computed as `riseFor` above, where the ribbon needs it.)
      const rise = riseFor

      // ★★ BAY LENGTH IS DERIVED; BAY COUNT IS WHAT STAYS ROUGHLY CONSTANT. The rule this replaces
      // put a pier every 7 blocks at every scale, which is why a 26-block crossing wore three of
      // them and the 149-block river wore twenty. Piers now divide the span EVENLY, so no pier can
      // land against a bank and the bays are all the same length by construction.
      // ⚠ THE COUNT IS CAPPED BY THE FLOOR, NOT JUST GUIDED BY IT. Rounding the bay COUNT up can
      // push the resulting bay BELOW the minimum — the first cut did exactly that and produced
      // 10.0- and 10.3-block bays under a stated floor of 12. A constant that names a floor it does
      // not enforce is the lying-name defect this file already fixed once, so `floor(span/minBay)`
      // is the hard ceiling on the count and the bay is guaranteed to clear its kind's minimum.
      const bayLen = Math.max(k.minBay, Math.min(k.maxBay, span / TARGET_BAYS))
      const bays = Math.max(1, Math.min(Math.round(span / bayLen), Math.floor(span / k.minBay)))

      const piers: number[] = []
      const pierBed: number[] = []
      const pierPos: { x: number; z: number }[] = []
      for (let b = 1; b < bays; b++) {
        const pt = (span * b) / bays
        // Each pier drops to the bed IT stands on, sampled on the centreline at its own offset.
        const bx = Math.floor(ox + ux * pt), bz = Math.floor(oz + uz * pt)
        piers.push(pt)
        pierPos.push({ x: bx, z: bz })
        pierBed.push(columnHeight(bx, bz, seed, cfg))
      }

      specs.push({ id, kind, span, table, bed, rise, pierHalf: k.pierHalf, piers, pierBed, pierPos, abut })
      // Rank each row's cells across the deck once, so geometry can be placed by INDEX.
      const ranked = new Map<number, { key: string; s: number }[]>()
      for (const c of mine) {
        const r = Math.round(c.t)
        if (!ranked.has(r)) ranked.set(r, [])
        ranked.get(r)!.push({ key: c.key, s: c.s })
      }
      for (const list of ranked.values()) list.sort((a, b) => a.s - b.s)
      const rankOf = new Map<string, number>()
      for (const list of ranked.values()) list.forEach((c, i) => rankOf.set(c.key, i))

      for (const c of mine) {
        const row = rows.get(Math.round(c.t))!
        cells.set(c.key, {
          i, t: c.t, s: c.s,
          // ★ The rail is the row's OUTER PAIR — and with a constant-width ribbon that is finally
          // the right test. It was wrong before only because the ragged `road ∩ waterline` footprint
          // made "outermost" mean "whatever the accident left", which on a 3-cell row is the entire
          // roadway. A fixed |s| threshold does NOT work here: the raster floors each sample to a
          // cell, so an outer cell's CENTRE can project back to less than the cutoff and the rail
          // silently vanishes for that row (83 of 550 when tried that way).
          edge: row.n >= RAIL_MIN_WIDTH && (c.s === row.lo || c.s === row.hi),
          half: DECK_HALF,
          idx: rankOf.get(c.key)!,
          n: row.n,
          g: c.g,
        })
      }
    }
  }
  return { specs, cells, rails: railPiecesFor(specs, cells) }
}

function indexFor(seed: number, cfg: HeightConfig): BridgeIndex {
  const key = `${seed}:${cfg.datum}:${cfg.riverScale}`
  let idx = CACHE.get(key)
  if (!idx) { idx = survey(seed, cfg); CACHE.set(key, idx) }
  return idx
}

/** Every crossing on the spine for this seed. */
export function bridgeSpecs(seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): BridgeSpec[] {
  return indexFor(seed, cfg).specs
}

/** Which bridge stands here, and where on it — or null for the overwhelming majority of the world. */
export function bridgeAt(x: number, z: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT): BridgeCell | null {
  return indexFor(seed, cfg).cells.get(`${x},${z}`) ?? null
}

/**
 * The deck's walking surface at `t`, in blocks. Always a multiple of 0.5 — see the half-step note at
 * the head of this file; a value between the halves is a vault waiting to happen.
 *
 * ★★ A TRAPEZOID, NOT A PARABOLA (2026-08-22). The curve springs from `table + 1` at both banks,
 * climbs at exactly MAX_GRADE, and then RUNS FLAT at its crown until it has to come back down. One
 * formula, three silhouettes, and each is the right one for its span:
 *
 *   · a plank barely lifts, because its crown is 2 half-steps and it is over in four columns;
 *   · a trestle's two ramps nearly meet, so it reads as an arch — which is what a 26-block timber
 *     crossing should look like;
 *   · a viaduct's ramps are a small fraction of its length, so it reads as a LEVEL ROAD carried high
 *     over the water. That is what a viaduct is, and it is the thing a parabola cannot draw: stretch
 *     an arch over 149 blocks and the curvature vanishes into an imperceptible sag.
 *
 * The parabola this replaces was smooth but wrong at both ends of the scale — steepest exactly at
 * the springing (where the walkability cap has to hold) and flattest in the middle (where the
 * clearance is wanted). The trapezoid is the same shape a real approach embankment makes.
 */
export function deckTopAt(spec: BridgeSpec, t: number): number {
  const base = spec.table + 1

  // ── the abutment, per end ───────────────────────────────────────────────────────────────────
  // The springing is the height of the land that end actually lands on, never below the waterline:
  // the deck may CLIMB to meet a high bank (it cannot cut one down) but may never drop into its own
  // river. `abut` is already clamped to `base ± ABUT_MAX` by the survey.
  const endAt = (land: number): number => Math.max(base, land)
  const nearEnd = endAt(spec.abut[0]), farEnd = endAt(spec.abut[1])

  // ⚠⚠ THE COLUMN COUNT IS FLOORED, EXACTLY AS THE ARCH FLOORS `u`. `t` is a continuous
  // projection, so scaling it by MAX_GRADE directly yields tops like `113.655`, and this file's
  // contract is that a deck top is ALWAYS a multiple of 0.5 — a value between the halves is the
  // vault the whole half-step scheme exists to prevent. Measured before the floor went in: 4 of 22
  // ends landed on a fraction. `abut` is a whole block, so flooring the count keeps every result on
  // the half-grid.
  //
  // ★★★ OUTSIDE THE SPAN THE APRON DESCENDS, AND IT MUST DESCEND RATHER THAN RUN FLAT. Two bugs
  // were found by building it the other way round, and they pull in opposite directions:
  //
  //   · A FLAT apron at the springing walks straight out over ground that falls away behind a bank
  //     crest. `moonwell-glade-0 far` lands on such a crest, needs no abutment at all, and a flat
  //     four-cell extension turned a walkable -0.5 into a full-block vault by moving the cliff
  //     further out. ⚠ The skip rule is evaluated PER CELL, so it also produced a NON-CONTIGUOUS
  //     apron: three cells skipped at the crest, then one laid in the air beyond it.
  //   · Deriving the apron's LENGTH from `abut` instead fixed that and left a different hole —
  //     `gloview-village-1 near` on seed 1 meets its bank flush at 122 with a one-cell trench two
  //     deep sitting in the join, and a length of zero bridges nothing.
  //
  // A ramp that descends at MAX_GRADE and stops where the ground rises to meet it answers both,
  // and needs no length at all: against a falling bank it stays under the terrain and lays nothing;
  // over a trench it lays the one cell that spans it.
  const apron = (end: number, d: number): number => end - Math.floor(d) * MAX_GRADE

  // ★ AND THE ARCH MUST NOT PARTICIPATE OUT HERE. `u` clamps to the span, so the arch term reads
  // `base` on every apron cell — above every descending apron value — and a blanket
  // `Math.max(arch, ...)` would pin the apron flat and silently restore the first bug above.
  if (t < 0) return apron(nearEnd, -t)
  if (t > spec.span) return apron(farEnd, t - spec.span)

  const u = Math.max(0, Math.min(spec.span, t))
  const arch = (spec.rise <= 0 || spec.span <= 1)
    ? base
    // Climb from whichever bank is nearer, and stop at the crown.
    : base + Math.min(spec.rise, Math.floor(u), Math.floor(spec.span - u)) * MAX_GRADE
  // Inside the span, an end that had to climb eases back to the arch at the same grade.
  const riseNear = Math.max(base, nearEnd - Math.floor(u) * MAX_GRADE)
  const riseFar = Math.max(base, farEnd - Math.floor(spec.span - u) * MAX_GRADE)
  return Math.max(arch, riseNear, riseFar)
}

/** The pier standing at this along-span offset: its index and the distance to its centre. */
function pierAt(spec: BridgeSpec, t: number): { k: number; d: number } | null {
  for (let k = 0; k < spec.piers.length; k++) {
    const d = Math.abs(t - spec.piers[k])
    if (d <= spec.pierHalf + 0.5) return { k, d }
  }
  return null
}

/**
 * The bridge's voxel at (x, y, z), or 0 for air.
 *
 * Materials arrive as arguments so this file never imports depth.ts — `deck` is the full block,
 * `deckHalf` the same id carrying HALF_BIT, `stone` the pier. Mirrors `holdVoxelAt`'s signature for
 * the same reason.
 */
export function bridgeVoxelAt(
  y: number,
  cell: BridgeCell,
  spec: BridgeSpec,
  deck: number,
  deckHalf: number,
  stone: number,
): number {
  const top = deckTopAt(spec, cell.t)
  const yc = Math.ceil(top) - 1          // the cell the walking surface lives in

  // ── the deck ──────────────────────────────────────────────────────────────────────────────
  // ★★ THE EDGE CELLS ARE ALWAYS FULL HEIGHT, AND THAT IS WHAT LETS A RAILING STAND ON THEM.
  // The arch climbs in HALF steps because `STEP_CAPTURE` demands it (a whole-block riser is a
  // vault). Pieces live on the INTEGER grid. So on every half-slab cell the fence post placed at
  // `yc + 1` began half a block ABOVE the surface — measured: 8 of 25 posts on one railing line
  // floating, which is exactly the "distorted" Alex saw. Rounding the two flank cells up to full
  // height costs the walkway nothing (the flanks are parapet, never walked) and gives the railing
  // an integer surface to sit on the whole way across. It also reads correctly: a raised kerb under
  // a parapet is what a real deck has.
  if (y === yc) return (top - yc >= 1 || cell.edge) ? deck : deckHalf

  // ── the abutment's fill ─────────────────────────────────────────────────────────────────────
  // ★★ AN APRON MUST BE SOLID OR IT IS A SLAB FLOATING OVER THE BANK. The deck descends toward the
  // landing at MAX_GRADE while the ground beneath it does whatever the terrain does, so the gap
  // between them has to be packed. `cell.g` carries that ground because this function has no world
  // position to ask with.
  //
  // ⚠ SCOPED TO THE APRON ON PURPOSE, AND THE SCOPE IS THE SAFETY PROPERTY. Mid-span cells stand
  // over the channel, where `g` is the river BED — filling those would pack the river solid from
  // the bed to the deck and dam the crossing shut. `t` outside `[0, span]` is exactly the abutment
  // and nothing else.
  if ((cell.t < 0 || cell.t > spec.span) && y < yc && y >= cell.g) return stone

  // ── the railing is NOT voxels ─────────────────────────────────────────────────────────────
  // It was: a solid course on the deck edge (a kerb), then posts + a top rail out of whole blocks.
  // Both were the same mistake — **a railing built out of the wrong vocabulary**. Alex: *"we are
  // still trying to use whole blocks on the railings when it should actually be more like the
  // fences."* He is right, and the thing he wants already exists: `pieces.ts` › `fence` is a 0.18
  // centre post whose ARMS are derived per connected side at sync, and `holds.ts` already emits it
  // as a generated wall-top parapet. It also occupies its full cell for COLLISION while drawing
  // thin, which is exactly a bridge railing: it stops you walking off and does not read as a wall.
  // So the railing left the voxel grid entirely — see `bridgeGenPieces` below. Nothing is emitted
  // above the deck here, deliberately; a block put back at `yc + 1` is the kerb returning.

  // ── the piers ─────────────────────────────────────────────────────────────────────────────
  const p = pierAt(spec, cell.t)
  if (p !== null && y >= spec.pierBed[p.k] && y < yc) {
    const d = p.d
    const style = KINDS[spec.kind].pierStyle
    const mat = KINDS[spec.kind].stonePiers ? stone : deck

    if (style === 'bent') {
      // ★ A TIMBER BENT: posts, and a cap beam across their heads. The gaps are the feature — they
      // are what separates "a road carried on legs" from "a wall with a road on top", and they cost
      // nothing but the restraint to leave them empty.
      // The cap sits in the course directly under the deck and spans the pier, tying the posts
      // together; without it three lone posts read as scaffolding rather than structure.
      const inboard = cell.idx >= 1 && cell.idx <= cell.n - 2
      if (y === yc - 1 && inboard) return mat
      // ⚠ THE POST COURSE IS CHOSEN BY ROW, NOT BY PER-CELL DISTANCE. `d <= 0.5` looks equivalent
      // and is not: cells sharing a visual row carry slightly different `t`, so the test passes for
      // some and fails for their mirrors — one bent came out `.#.....`, a single lonely post. Same
      // defect as matching posts by `|s|`, rotated onto the other axis. Round to the row.
      if (Math.round(cell.t) !== Math.round(spec.piers[p.k])) return 0
      // Posts BY INDEX, not by offset — symmetric however the raster fell. Outer pair one cell in
      // from the flanks (so the parapet overhangs them), plus one on the centre line.
      // ⚠ A CENTRE POST CANNOT BE CENTRED ON AN EVEN ROW. `(n-1)>>1` put it at 3 of 8, whose mirror
      // is 4 — asymmetric by construction, and the symmetry assert caught it. Two posts, mirrored,
      // is both correct at every width and MORE open, which is the read we are after: a road on
      // legs. A centre pair only earns its place once the row is wide enough to still show daylight.
      const mid1 = (cell.n - 1) >> 1, mid2 = cell.n >> 1
      const onPost = cell.idx === 1 || cell.idx === cell.n - 2
        || (cell.n >= 9 && (cell.idx === mid1 || cell.idx === mid2))
      if (!onPost) return 0
      // A sill spreads the posts' load at the bed — the timber equivalent of a footing, and it
      // stops three thin legs terminating in three lonely dots on the river floor.
      if ((y - spec.pierBed[p.k]) < 1 && inboard) return mat
      return mat
    }

    // `solid` — a masonry mass. Drawn in by one cell at each pointed end along the span, so it does
    // not need to know which way the water runs: a cutwater that guesses the flow wrong is worse
    // than one that does not exist (that is a `rin-water` question, deferred on purpose).
    const taper = d > spec.pierHalf - 0.5 ? 1 : 0
    const widen = (y - spec.pierBed[p.k]) < FOOTING ? 0 : 1
    const in2 = PIER_INSET + taper + widen - 1
    if (cell.idx >= in2 && cell.idx <= cell.n - 1 - in2) return mat
  }
  return 0
}

/**
 * ★★ THE RAILING, AS THE PLAYER'S OWN BUILDING VOCABULARY.
 *
 * A fence post in every edge cell, standing on the deck. Every cell and not every third, because
 * fence ARMS are derived from ADJACENCY — two posts three blocks apart are not neighbours, so they
 * grow no rail between them and you get a row of lonely stakes. A continuous run gives post-arm-post,
 * which is what a railing is.
 *
 * ⚠ Deterministic `gen` ids: these are never saved, only their ABSENCE is (the host's tombstone
 * list). Break a railing post and it must stay broken across a reload, which only works if the id
 * regenerates identically — so it is keyed on the crossing and the world cell, nothing else.
 *
 * The holds' argument applies here with more force than it does to a hold: a bridge *"reads as
 * something a builder could have made, because it literally is made of the same catalogue."*
 * Inventing a bespoke railing part would make bridges the one structure in the world assembled from
 * pieces nobody can hold.
 */
function railPiecesFor(specs: BridgeSpec[], cells: Map<string, BridgeCell>): GenPiece[] {
  const out: GenPiece[] = []
  for (const [key, c] of cells) {
    if (!c.edge) continue
    const [x, z] = key.split(',').map(Number)
    const spec = specs[c.i]
    const yc = Math.ceil(deckTopAt(spec, c.t)) - 1
    out.push({ gen: `${spec.id}:rail:${x},${z}`, pieceId: 'fence', x, y: yc + 1, z, rot: 0 })
  }
  return out
}

/**
 * The railing pieces whose column is (cx, cz) — what the host applies when that column is adopted.
 * Mirrors `holdGenPiecesForCol`, which is the proven path for worldgen-emitted pieces.
 *
 * ⚠ THE HOST MUST CONCATENATE THIS **ABOVE** ITS `if (!gen.length) return` EARLY-OUT. Nearly every
 * bridge column has no HOLD pieces in it (bridges cross open country; the holds are elsewhere), so
 * a concat placed after that guard drops every railing in the world and looks exactly like this
 * function returning nothing.
 */
export function bridgeGenPiecesForCol(
  cx: number, cz: number, size: number, seed: number, cfg: HeightConfig = DEFAULT_HEIGHT,
): GenPiece[] {
  const idx = indexFor(seed, cfg)
  const x0 = cx * size, z0 = cz * size
  const out: GenPiece[] = []
  for (const g of idx.rails) {
    if (g.x >= x0 && g.x < x0 + size && g.z >= z0 && g.z < z0 + size) out.push(g)
  }
  return out
}

/** Test seam: the survey is cached per seed, and a test that mutates config needs it cleared. */
export function __clearBridgeCache(): void { CACHE.clear() }
