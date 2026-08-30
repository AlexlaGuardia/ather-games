// THE GREEN, AS GROUND — the bowl dug into it and the rows banked around it, as terrain.
//
// ★ THIS IS THE REALIZATION LAYER for `hold-rows.ts` and `ring-floor.ts`. Those two are pure
// placement and answer *where*; this answers *what the ground does there*. Nothing here decides
// where a seat is or how worn a cell is — it asks them, so a dial moved in either file moves the
// ground and nothing needs re-deriving.
//
// ── ★★ MATERIALS ARE PASSED IN, AND THAT IS A HARD CONTRACT, NOT A STYLE ──────────────────────
// `depth.ts` and `attrs.ts` are a module cycle, so a file on this side may never import `MAT` —
// `depth.ts` says so at its bridge call and `holdVoxelAt` takes its stone and its lantern as
// arguments for the same reason. Break it and the cycle closes at import time, which fails as a
// blank world rather than as a compile error anybody can read.
//
// ── ★★★ ONE PROFILE, BECAUSE A BOWL WITH TIERS AROUND IT IS ONE SHAPE ─────────────────────────
// Bonn #3: *"the ground **dipped** into a wide shallow bowl… and around the rim of it, in tidy
// curving **rows**, sat the audience."* The dip and the banks are the same surface seen at two
// radii, so they are one function of distance from the middle: negative in the bowl, stepping
// positive on the rows, zero once the green resumes. Two functions would need a seam between them
// and the seam is exactly where a rim goes wrong.
//
// ⚠ THE PROFILE IS DOCTRINE-FREE. `ring-floor.ts` records why at length: freeing the hold takes the
// colour back and does NOT un-dig the hollow. Only `greenSurfaceAt` below knows who owns the hill.
import { holdRows, bowlCentre, DEFAULT_ROWS, type RowDials } from './hold-rows'
import { bowlAt, floorSurface, DEFAULT_FLOOR, type FloorDials } from './ring-floor'
import type { Box } from './jigsaw'

/** The materials the green is made of. Supplied by the caller — see the contract note above. */
export interface GreenMats {
  /** The green's own turf, where nothing has worn it. */
  grass: number
  /** Trodden bare earth — the middle of the bowl, and a free town's own gathering ground. */
  bare: number
  /** Dragged-over and burnt. Only ever appears on a taken green. */
  scorch: number
  /** What a seating bank is made of. */
  tier: number
}

/**
 * How far the ground moves at this cell, relative to the green's own level.
 *
 * **Negative dips, positive banks up, 0 leaves the green alone.** Feeds the HEIGHT layer, the way
 * `holds.padBlendAt` does — not the voxel layer, because a dip is an absence and you cannot emit
 * one as a block.
 *
 * ★★ THE AISLE IS FLAT, AND IT IS THE ONE THING THAT MAKES THE BEAT PLAYABLE. S4 walks the player
 * *"the curve of the old common green"* and *"past the audience on the way in"* — so there has to be
 * a way in, at ground level, that does not climb three banks of seating. `holdRows` already leaves
 * the seats out of that wedge; the ground has to agree with it, or the aisle is a clear path up a
 * step you cannot walk. ⚠ It is derived by ASKING for the seats rather than by re-testing the angle:
 * a second copy of the aisle rule would agree until somebody widened one of them.
 */
export function greenProfileAt(
  green: Box, x: number, z: number, entryYaw: number,
  rows: RowDials = DEFAULT_ROWS, floor: FloorDials = DEFAULT_FLOOR,
): number {
  const c = bowlCentre(green)
  const dist = Math.hypot(x - c.x, z - c.z)

  // Inside the bowl: the wear field digs it. Doctrine-free, permanent — see `ring-floor.ts`.
  const bowl = bowlAt(green, x, z, floor, rows)
  if (bowl.wear > 0) return -bowl.drop

  // Outside the bowl: is this cell under a seating bank?
  // ⚠ THERE WAS A BAND-WIDTH CHECK HERE AND IT COULD NOT FAIL. `Math.round` already snaps `dist` to
  // the nearest band centre, so `|dist - centre| <= rowStep / 2` is true by construction — the line
  // read like a bound and constrained nothing. The mutation sweep found it by deleting it and
  // watching every assert stay green. ★ Removed rather than repaired: a row IS a full annulus one
  // `rowStep` wide, so there is no gap between banks to police, and a guard kept "just in case"
  // teaches the next reader that the rounding does less than it does.
  const row = Math.round((dist - rows.innerRadius) / rows.rowStep)
  if (row < 0 || row >= rows.rows) return 0

  // ★ THE AISLE, ASKED OF THE SEATING ITSELF. If no seat in this row lies near this bearing, the
  // wedge is open — so the bank stops here too and the way in stays walkable.
  if (!bankHere(green, x, z, entryYaw, row, rows)) return 0
  return (row + 1) * rows.rise
}

/**
 * Is a seat sitting on this cell? Asked of `holdRows`, so the wear can never drift from the rows.
 *
 * ⚠ ROUNDED TO THE CELL RATHER THAN MEASURED BY DISTANCE. A radius test would smear the wear into a
 * continuous band and lose the arcs — and the arcs ARE the content, because *tidy* is the horror.
 */
function seatWorn(green: Box, x: number, z: number, entryYaw: number, rows: RowDials): boolean {
  for (const s of holdRows(green, entryYaw, rows)) {
    if (Math.round(s.x) === x && Math.round(s.z) === z) return true
  }
  return false
}

/**
 * Is there a seating bank at this bearing in this row?
 *
 * ⚠ IT ASKS `holdRows` RATHER THAN RE-TESTING THE AISLE ANGLE. The alternative — comparing the
 * bearing against `aisleHalfAngle` here — is a second copy of a rule that already exists, and it
 * would agree right up until somebody widened one of the two. This codebase has paid for that shape
 * repeatedly; the seats are the authority on where the audience is.
 */
function bankHere(green: Box, x: number, z: number, entryYaw: number, row: number, rows: RowDials): boolean {
  const c = bowlCentre(green)
  const a = Math.atan2(z - c.z, x - c.x)
  // A bank spans the gap between neighbouring seats, so the tolerance is a seat-step of arc.
  const r = rows.innerRadius + row * rows.rowStep
  const tol = (rows.seatStep / Math.max(1, r)) * 1.2
  for (const s of holdRows(green, entryYaw, rows)) {
    if (s.row !== row) continue
    let d = Math.atan2(s.z - c.z, s.x - c.x) - a
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    if (Math.abs(d) <= tol) return true
  }
  return false
}

/**
 * What the ground reads as at this cell, or **0 for "the green's own business"** — outside the bowl
 * and off the banks, this file has no opinion and the world keeps whatever it had.
 *
 * `taken` is the doctrine. ⚠ It changes the SURFACE only; `greenProfileAt` never sees it.
 */
export function greenSurfaceAt(
  green: Box, x: number, z: number, entryYaw: number, taken: boolean, m: GreenMats,
  rows: RowDials = DEFAULT_ROWS, floor: FloorDials = DEFAULT_FLOOR,
): number {
  const bowl = bowlAt(green, x, z, floor, rows)
  if (bowl.wear > 0) {
    const s = floorSurface(bowl, green, x, z, entryYaw, taken, floor)
    return s === 'scorch' ? m.scorch : s === 'bare' ? m.bare : m.grass
  }
  if (greenProfileAt(green, x, z, entryYaw, rows, floor) > 0) {
    // ★★★ WORN SEAT-LINES. Alex, on the first build: the banks read as green steps rather than as
    // seating. Ninety-one bodies sit in these arcs every day, so the grass under them is trodden
    // bare — which is not a decoration, it is literally the brief's ground row: *"the plot's grass
    // and paths, **worn, trampled**, dragged-over."* Rows read as rows because something has been
    // sitting in them, and nothing had to be BUILT to say so. ⚠ That distinction is the whole
    // reason a hold gets no benches: carpentry would say these people made seating for guests.
    //
    // ⚠ TAKEN ONLY. A free Downbarrow's green was gathered on for generations and is worn in
    // general — but the TIDY CONCENTRIC ARCS are the collar's arrangement, and canon's horror here
    // is bookkeeping made visible. Free ground wears; it does not line up.
    if (taken && seatWorn(green, x, z, entryYaw, rows)) return m.bare
    return m.tier
  }
  return 0
}
