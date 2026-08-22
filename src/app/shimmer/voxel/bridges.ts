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

/** Along-span blocks per half-step of rise. 4 keeps the steepest parabola gradient at 0.5/block —
 *  the exact ceiling `STEP_CAPTURE` walks. Raising this flattens arches; LOWERING it makes vaults. */
const RISE_PER_4 = 4
/** Ceiling on the arch, in half-steps. 8 = +4 blocks at midspan, i.e. 5 blocks of clearance over
 *  the table. Past that a bridge stops reading as a bridge and starts reading as a hill. */
const MAX_RISE = 8
/** A pier every this many blocks of span. Bays, not a world grid. */
const PIER_EVERY = 7
/** No pier within this of either bank — a pier in the shallows is a pier holding nothing up. */
const PIER_MARGIN = 3
/** Half-length of a pier along the span: 1 gives a 3-block pier with a pointed cell at each end. */
const PIER_HALF = 1
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

/**
 * ★ HOW FAR ABOVE ITS OWN GROUND A BRIDGE CAN REACH — the caller's cheap y-band gate, DERIVED.
 *
 * depth.ts early-outs on `y - h` before it asks anything expensive, and that gate was written for a
 * flat deck at `table + 1`: `RIVER_DEPTH + 4`, i.e. 7. An arch needs 10, so shipping the arch under
 * the old gate would have sliced the top off every crossing in the world — silently, because a
 * clipped deck still looks like a deck from the bank.
 *
 * Derived from the geometry constants rather than measured and pasted, so raising MAX_RISE cannot
 * leave the gate behind: rail sits one over the deck, the deck springs one over the table, the arch
 * adds MAX_RISE/2, and the bed can sit RIVER_DEPTH under the table. `bridges.test.ts` walks the real
 * corridor and asserts nothing ever wants a cell above it, so the derivation is checked against
 * worldgen instead of trusted.
 */
export const BRIDGE_REACH = MAX_RISE / 2 + 2 + RIVER_DEPTH + 1

export interface BridgeSpec {
  id: string
  /** Span in blocks, bank anchor to bank anchor along the centreline. */
  span: number
  /** Whole-voxel water table this crossing stands over. The deck springs from `table + 1`. */
  table: number
  /** Lowest generated ground anywhere on the crossing. Reporting/gating only: a pier drops to its
   *  OWN bed (`pierBed`), because on a 149-block span the deepest point can be four blocks under
   *  the shallows and every pier would otherwise start buried in the bank it does not stand on. */
  bed: number
  /** Arch height at midspan, in HALF-steps. 0 = a flat plank, which is correct for a creek. */
  rise: number
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

      // ★ RISE IS CAPPED BY THE SPAN, NOT CHOSEN. See RISE_PER_4 — this is the walkability
      // invariant in one line, and the reason a creek stays flat with no span-type branch anywhere.
      const rise = Math.max(0, Math.min(MAX_RISE, Math.floor(span / RISE_PER_4)))

      const piers: number[] = []
      const pierBed: number[] = []
      const pierPos: { x: number; z: number }[] = []
      for (let p = PIER_EVERY; p <= span - PIER_MARGIN; p += PIER_EVERY) {
        if (p < PIER_MARGIN) continue
        // Each pier drops to the bed IT stands on, sampled on the centreline at its own offset.
        const bx = Math.floor(ox + ux * p), bz = Math.floor(oz + uz * p)
        piers.push(p)
        pierPos.push({ x: bx, z: bz })
        pierBed.push(columnHeight(bx, bz, seed, cfg))
      }

      specs.push({ id, span, table, bed, rise, piers, pierBed, pierPos })
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
 * The deck's walking surface at `t`, in blocks. Always a multiple of 0.5 — see the half-step note
 * at the head of this file; a value between the halves is a vault waiting to happen.
 *
 * A parabola, springing from `table + 1` at both banks and peaking at midspan. Not a circular arc:
 * the parabola's gradient is steepest exactly at the springing, which is where the walkability cap
 * has to hold, so bounding THAT bounds the whole curve.
 */
export function deckTopAt(spec: BridgeSpec, t: number): number {
  const base = spec.table + 1
  if (spec.rise <= 0 || spec.span <= 1) return base
  const u = Math.max(0, Math.min(1, t / spec.span))
  const halves = Math.round(spec.rise * 4 * u * (1 - u))
  return base + halves / 2
}

/** The pier standing at this along-span offset: its index and the distance to its centre. */
function pierAt(spec: BridgeSpec, t: number): { k: number; d: number } | null {
  for (let k = 0; k < spec.piers.length; k++) {
    const d = Math.abs(t - spec.piers[k])
    if (d <= PIER_HALF + 0.5) return { k, d }
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
    const inset = PIER_INSET + (d > 0.5 ? 1 : 0)
    const widen = (y - spec.pierBed[p.k]) < FOOTING ? 1 : 0
    if (Math.abs(cell.s) <= cell.half - inset + widen) return stone
  }
  return 0
}

/** Test seam: the survey is cached per seed, and a test that mutates config needs it cleared. */
export function __clearBridgeCache(): void { CACHE.clear() }
