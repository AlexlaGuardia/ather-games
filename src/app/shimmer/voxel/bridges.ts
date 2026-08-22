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
// `height.ts`'s approach blend pins river banks at `table + 1` (:368), and that is why the old deck
// sat there: deck and bank met flush by construction, no ramp logic anywhere. That flush join is
// worth keeping and it is also the whole constraint. Lift a FLAT deck for clearance and it no longer
// meets the ground at either end, so you owe abutment ramps at both banks and a keeper walks up a
// step to get on the bridge.
//
// An arch pays for itself twice: it SPRINGS from `table + 1` at both banks (join preserved, exactly
// as before) and rises over the water in the middle (clearance, where the clearance is wanted). The
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
  plank:   { rise: 2,  pierHalf: 1, stonePiers: false, minBay: PLANK_MAX, maxBay: PLANK_MAX },
  trestle: { rise: 8,  pierHalf: 1, stonePiers: false, minBay: 9,  maxBay: 14 },
  viaduct: { rise: 10, pierHalf: 2, stonePiers: true,  minBay: 18, maxBay: 26 },
}

export function kindFor(span: number): BridgeKind {
  return span < PLANK_MAX ? 'plank' : span < VIADUCT_MIN ? 'trestle' : 'viaduct'
}

/** Bays a crossing wants, before the kind's length clamps. Four reads as designed at every scale. */
const TARGET_BAYS = 4
/** Courses above the bed that widen back to full deck width — the footing. */
const FOOTING = 2
/** Perpendicular inset of the pier from the deck edge. A pier flush with the deck is a wall. */
const PIER_INSET = 1
/** ★ A row narrower than this carries NO rail, and the reason is a bug the oracle caught rather
 *  than a taste call. A rail is the outermost cell of a row, so on a 2-cell row BOTH cells are rail
 *  and the row becomes a wall a block high — across the bridge MOUTH specifically, because the
 *  waterline cuts the road diagonally and the first and last rows of a crossing are exactly the
 *  narrow ones. Every crossing on both test seeds was walled at one end or both. A rail protects a
 *  roadway; where there is no roadway left to protect there is nothing to rail. */
const RAIL_MIN_WIDTH = 3
/** The steepest the deck may climb per column. `STEP_CAPTURE` is 0.55, so 0.5 is walked with no
 *  press and a full 1.0 is a vault. This is a locomotion fact, not a taste dial. */
const MAX_GRADE = 0.5

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
export const BRIDGE_REACH = Math.max(...Object.values(KINDS).map(k => k.rise)) / 2 + 2 + RIVER_DEPTH + 1

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
}

interface BridgeIndex {
  specs: BridgeSpec[]
  cells: Map<string, BridgeCell>
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

      // Scan a generous bbox and keep the road cells whose ground is under the table. `roadAt` is
      // wobbled, so the band cannot be derived from ROAD_HALF alone — it has to be asked.
      const pad = 6
      const x0 = Math.floor(Math.min(ox, ox + ux * span)) - pad
      const x1 = Math.ceil(Math.max(ox, ox + ux * span)) + pad
      const z0 = Math.floor(Math.min(oz, oz + uz * span)) - pad
      const z1 = Math.ceil(Math.max(oz, oz + uz * span)) + pad

      let table = -Infinity, bed = Infinity, found = 0
      const mine: { key: string; t: number; s: number }[] = []
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (!roadAt(x, z, seed)) continue
          const tw = submerged(x, z, seed, cfg)
          if (tw === null) continue
          // Project onto the crossing's axis. `t` along, `s` perpendicular.
          const px = x - ox, pz = z - oz
          const t = px * ux + pz * uz
          const s = -px * uz + pz * ux
          if (t < -1 || t > span) continue          // belongs to a different run on this segment
          const key = `${x},${z}`
          if (cells.has(key)) continue              // a shared cell belongs to whoever found it first
          mine.push({ key, t, s })
          table = Math.max(table, tw)
          bed = Math.min(bed, columnHeight(x, z, seed, cfg))
          found++
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

      // ★ THE SPAN PICKS THE KIND, AND THE KIND PICKS EVERYTHING ELSE.
      const kind = kindFor(span)
      const k = KINDS[kind]

      // ★★ RISE IS CLAMPED BY THE RAMPS, NOT BY A GLOBAL CEILING. The deck climbs at MAX_GRADE and
      // no faster (locomotion, not taste), so a crown of `rise` half-steps needs `rise` columns of
      // ramp at EACH end. A span too short for two ramps cannot reach its kind's crown, and it gets
      // the crown it can actually fit rather than a steeper climb — the one thing that would turn
      // the deck back into a row of vaults.
      const rise = Math.max(0, Math.min(k.rise, Math.floor(span / 2)))

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

      specs.push({ id, kind, span, table, bed, rise, pierHalf: k.pierHalf, piers, pierBed, pierPos })
      for (const c of mine) {
        const row = rows.get(Math.round(c.t))!
        cells.set(c.key, {
          i, t: c.t, s: c.s,
          edge: row.n >= RAIL_MIN_WIDTH && (c.s === row.lo || c.s === row.hi),
          half: Math.max(Math.abs(row.lo), Math.abs(row.hi)),
        })
      }
    }
  }
  return { specs, cells }
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
  if (spec.rise <= 0 || spec.span <= 1) return base
  const u = Math.max(0, Math.min(spec.span, t))
  // Climb from whichever bank is nearer, and stop at the crown.
  const halves = Math.min(spec.rise, Math.floor(u), Math.floor(spec.span - u))
  return base + halves * MAX_GRADE
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
  if (y === yc) return (top - yc >= 1) ? deck : deckHalf

  // ── the rail: one course up, on the outermost cells of the band, following the arch ───────
  // Edge is decided by the PERPENDICULAR offset, never by a neighbour probe. The old rule asked
  // `!roadAt(x+1,z)` and friends, which cannot tell the bridge's edge from the road's own wobble.
  if (y === yc + 1 && cell.edge) return deck

  // ── the piers ─────────────────────────────────────────────────────────────────────────────
  const p = pierAt(spec, cell.t)
  if (p !== null && y >= spec.pierBed[p.k] && y < yc) {
    const d = p.d
    // A lens in plan: full width through the middle, drawn in by one cell at each pointed end.
    // Cheap, symmetric, and it does not need to know which way the water runs — flow direction is
    // a `rin-water` question and a cutwater that guesses it wrong is worse than one that does not.
    // A lens in plan, drawn in by one cell at each pointed end. On a viaduct the pier is longer
    // along the span, so the taper starts at its outer third rather than at its single end cell.
    const inset = PIER_INSET + (d > spec.pierHalf - 0.5 ? 1 : 0)
    const widen = (y - spec.pierBed[p.k]) < FOOTING ? 1 : 0
    if (Math.abs(cell.s) <= cell.half - inset + widen) {
      return KINDS[spec.kind].stonePiers ? stone : deck
    }
  }
  return 0
}

/** Test seam: the survey is cached per seed, and a test that mutates config needs it cleared. */
export function __clearBridgeCache(): void { CACHE.clear() }
