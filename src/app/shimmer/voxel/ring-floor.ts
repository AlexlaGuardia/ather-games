// THE RING FLOOR — the shallow bowl the audience looks down into.
//
// ★ PURE CORE. No react, no three, no voxels. It answers two questions about one cell: *how far
// below the green does the ground sit here*, and *how trodden is it*. What that ground is MADE of is
// a doctrine question and lives at the bottom of this file, separately, for a reason.
//
// ── ★★★ THE TENSION CANON SETS UP, AND HOW IT RESOLVES ────────────────────────────────────────
// Bonn #3 ch11: *"the ground dipped into a wide shallow bowl, a ring of bare smooth earth **like a
// stage worn flat by use**."* And the hold brief's ground row bans exactly one thing: ⛔ *"a
// flattened construction pad."* Both sentences are about flatness. **The difference is worn versus
// built, and it shows in two places only:**
//   · a pad has a HARD EDGE at a chosen radius; wear FADES OUT wherever feet stopped going.
//   · a pad is UNIFORMLY deep; wear is deepest where the traffic is and shallows toward the rim.
// So the bowl is a wear FIELD, not a shape. Nothing here picks a circle and digs it.
//
// ⚠⚠ AND THE EDGE MUST BE IRREGULAR OR IT IS A PAD WHATEVER THE FALLOFF DOES. A perfectly circular
// rim reads as surveyed no matter how softly the depth ramps, so the radius is perturbed by
// position-keyed noise — deterministic, so any column re-derives the same rim without talking to
// its neighbours, which is the same discipline `jigsaw` runs on.
//
// ── ★★★ WHAT UN-WEARS WHEN THE HOLD FALLS, AND WHAT DOES NOT ──────────────────────────────────
// Beat S6 frees the hold: *"the cloud takes its colour back… the burrows underneath were always
// Downbarrow's, and now they are again."* ⚠ **The colour comes back. The ground does not un-dip.**
// Years of use wore that hollow and freeing Burdock does not fill it in — and canon is explicit that
// a freed hold *"does not become a ruin"*, so it must not become a building site either.
// So this file splits along that line, and the split is the whole design:
//   · `bowlAt` — GEOMETRY and WEAR. Doctrine-free, permanent, true of Downbarrow's own green too:
//     a town gathered here long before anyone collared anything.
//   · `floorSurface` — bare earth, scorch, grass. **Doctrine.** Lifts when the hold falls.
// A single function returning "a scorched bowl" would make freeing mean REGENERATING the ground,
// and the reward beat would flatten the hollow the act was staged in.
//
// ★ THE RADIUS IS ASKED OF `hold-rows.ts`, NEVER RESTATED. The floor is *everything inside the first
// row* — one fact, and a second copy of it here would agree until somebody moved a row.
import { value2, fbm2 } from './noise'
import { bowlFloorRadius, bowlCentre, DEFAULT_ROWS, type RowDials } from './hold-rows'
import type { Box } from './jigsaw'

export interface FloorDials {
  /** Deepest the bowl ever gets, in blocks. ⚠ *Shallow* is canon's word — this is not a pit. */
  maxDrop: number
  /** How far the irregular rim can wander in or out, in blocks. 0 makes it a surveyed circle. */
  rimJitter: number
  /** Below this wear the ground is still the green's grass. */
  bareAt: number
  /**
   * Half-width of a drag-line, in radians. Scorched lines run from the way in toward the middle —
   * *"scorched drag-lines"* in the brief's ground row — because that is the path stock is hauled.
   */
  dragHalfAngle: number
  /** How many drag-lines fan out from the way in. */
  dragLines: number
}

/** ⚠ UNSWEPT, like every number in this family. `ruins.ts`: *"tune by sweep, never by eye."* */
export const DEFAULT_FLOOR: FloorDials = {
  maxDrop: 2,
  rimJitter: 1.6,
  bareAt: 0.25,
  dragHalfAngle: 0.10,
  dragLines: 3,
}

export interface BowlCell {
  /** Blocks below the green's own level. 0 outside the bowl; never negative. */
  drop: number
  /**
   * How trodden this cell is, 0..1. 1 at the middle, fading to 0 at the irregular rim.
   *
   * ★ IT IS PUBLISHED SEPARATELY FROM `drop` BECAUSE THE SURFACE NEEDS IT AND THE DEPTH IS TOO
   * COARSE TO CARRY IT. `maxDrop` is 2, so `drop` only takes three values and a surface derived
   * from it would band into three hard rings — the pad edge returning by the back door.
   */
  wear: number
}

/**
 * The bowl at one cell, in world coordinates.
 *
 * Doctrine-free on purpose: this is equally the answer for Downbarrow's own gathering-green, which
 * a town wore hollow before anyone took it. What the collar added is colour and scorch, not depth.
 */
export function bowlAt(
  green: Box, x: number, z: number,
  d: FloorDials = DEFAULT_FLOOR, rows: RowDials = DEFAULT_ROWS,
): BowlCell {
  const c = bowlCentre(green)
  const dx = x - c.x, dz = z - c.z
  const dist = Math.hypot(dx, dz)
  const base = bowlFloorRadius(rows)

  // ★ THE IRREGULAR RIM. Keyed on the ANGLE, not on the cell, so the boundary wanders smoothly
  // around the bowl instead of dissolving into per-cell speckle — a rim that jitters cell-by-cell
  // reads as damage, not as wear.
  const a = Math.atan2(dz, dx)
  // ⚠ THE SAMPLING CIRCLE IS SMALL ON PURPOSE. Reading 2D noise around a circle is the standard way
  // to get a smooth PERIODIC function of angle — but only while the circle stays within a few
  // lattice cells. At radius 8 it crossed sixteen of them and the rim came out in **8 abrupt steps**,
  // which reads as damage rather than as wear; the oracle caught it. Radius 2.2 keeps the walk
  // inside a handful of cells, so the interpolation does the smoothing.
  const jitter = (value2(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0x8ec7) - 0.5) * 2 * d.rimJitter
  // ⚠⚠ AND THE RIM MAY NEVER REACH THE SEATING. `bowlFloorRadius` is `innerRadius - 1`, so a +1.6
  // jitter puts the rim at 9.6 against a front row at 9 — and the oracle found a seat standing IN
  // the bowl. A collared spirit seated inside the fighting floor is not a subtle defect, and it
  // appears only on the bearings the noise happens to push outward. Clamped, because the invariant
  // is "the floor stops before the audience", not "the jitter happens to be small enough".
  const rim = Math.min(base + jitter, rows.innerRadius - 0.5)
  if (dist >= rim || rim <= 0) return { drop: 0, wear: 0 }

  // ★ WEAR FALLS OFF FROM THE MIDDLE, WHERE THE FEET ARE. Squared, so the centre stays broad and
  // flat — *"worn flat by use"* — instead of coming to a point like something excavated.
  const t = 1 - dist / rim
  const wear = Math.max(0, Math.min(1, t * t * (1 + 0.35 * (fbm2(x * 0.18, z * 0.18, 0x51a6, 3) - 0.5))))
  return { drop: Math.round(wear * d.maxDrop), wear }
}

/** What the ground reads as. */
export type FloorSurface = 'grass' | 'bare' | 'scorch'

/**
 * The surface at one cell. **Doctrine — this is the half that lifts when the hold falls.**
 *
 * `entryYaw` is the bearing the way in sits on; drag-lines fan from there toward the middle, because
 * that is the path stock is hauled along. ⚠ Scorch is the ONLY thing here that is the collar's; a
 * freed green keeps its worn hollow and its bare middle, and simply stops being burnt.
 */
export function floorSurface(
  cell: BowlCell, green: Box, x: number, z: number, entryYaw: number,
  taken: boolean, d: FloorDials = DEFAULT_FLOOR,
): FloorSurface {
  if (cell.wear <= 0) return 'grass'

  // ★★★ A DRAG-LINE IS CHECKED BEFORE THE WEAR GATE, AND THE FIRST VERSION HAD IT AFTER — WHICH IS
  // BACKWARDS. Gated behind `wear >= bareAt`, a line could only appear where the ground was ALREADY
  // bare, so the outer bowl produced none at all and the oracle found zero to measure. But a drag
  // mark is not something that happens to worn ground: **dragging is what wears it.** The brief's
  // ground row is *"grass and paths, worn, trampled, dragged-over"* — paths THROUGH grass. So a line
  // marks its own track wherever it runs, and the general wear decides only the ground around it.
  if (taken) {
    // ⚠ THE LINES FAN, THEY DO NOT RADIATE EVENLY. A rosette of evenly spaced spokes is a
    // decoration; stock is dragged in from ONE side, so they cluster about the way in.
    const c = bowlCentre(green)
    const a = Math.atan2(z - c.z, x - c.x)
    for (let i = 0; i < d.dragLines; i++) {
      const spoke = entryYaw + ((i / Math.max(1, d.dragLines - 1)) - 0.5) * (Math.PI * 2 / 3)
      let delta = a - spoke
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      if (Math.abs(delta) < d.dragHalfAngle) return 'scorch'
    }
  }
  if (cell.wear < d.bareAt) return 'grass'
  return 'bare'
}
