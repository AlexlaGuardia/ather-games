// THE ROWS — where the audience sits, and which way it is made to face.
//
// ★ PURE CORE. No react, no three, no voxels, no world reads. It owns one question: *given a green
// and a way in, where does each collared spirit sit.* The bodies, the dimming and the stone are
// three other passes. `plot-ring.ts` draws exactly this line for the keeper's own ring and its
// header records why: placement is pure and has an oracle; objects and clocks live elsewhere.
//
// ── ★★★ CANON PUT THE ROWS BEFORE THE RING, TWICE, AND MEANT IT AS A BUILD ORDER ──────────────
// `design-briefs/moglin-holds.md`: *"The captives in the rows are the cruelty; the fight in the
// middle is only the excuse. **Build the rows before you build the ring.**"* And the beat sheet's
// own build note: *"the rows are the set piece, not the ring floor."* So this file exists before
// anything that draws a fighting floor, and that is not sequencing — it is where the meaning is.
//
// ── WHAT THE PROSE SPECIFIES (Bonn #3 ch11, shipped) ──────────────────────────────────────────
// *"the ground dipped into a wide shallow bowl, a ring of bare smooth earth like a stage worn flat
// by use, and around the rim of it, **in tidy curving rows**, sat the audience."* Plus S1, from the
// road at dusk: *"small lights, moving, **in rows**."* And S4: collared Luminara *"seated in tidy
// rows around the rim, **dimmed, facing the middle**."*
//
// ★★ "TIDY" IS THE HORROR, NOT A STYLE NOTE, and it has a geometric consequence. The cruelty here
// is bookkeeping made visible — a thing arranged. So seats are spaced by **arc length, not by
// angle**: equal angles would crowd the inner row and thin the outer one, which reads as a crowd
// that gathered rather than a stock that was placed. The regularity is the point.
//
// ⚠⚠ NOTHING ABOUT THE TAKING IS BAKED IN HERE — NO DIM, NO GREY, NO COLLAR. Beat S6 frees the
// hold: *"the lights come up out of the rows. The hill goes properly bright for the first time."*
// If a seat carried its own dimness, freeing would mean REGENERATING the seating, and the freed
// hold would be a different arrangement of the same spirits — the reward would read as a glitch.
// The seats are where somebody sits; whether they are dimmed is the hold's state at render time.
// Same reasoning as `burrowtown.ts`'s overlay being a layer over an intact free town.
import type { Box } from './jigsaw'

/** One place to sit, facing the middle. Pure placement — see the header on why it carries no dim. */
export interface Seat {
  x: number
  z: number
  /** Course above the green's own level. Row 0 is the lowest, nearest the floor. */
  y: number
  /** Radians, pointing at the centre of the bowl. Canon: *"facing the middle."* */
  yaw: number
  /** Which curving row, outward from the rim. */
  row: number
}

export interface RowDials {
  /** How many curving rows. */
  rows: number
  /** Blocks from the bowl's centre to the FIRST row. The floor is everything inside this. */
  innerRadius: number
  /** Blocks between one row and the next, outward. */
  rowStep: number
  /** Courses each row rises above the one inside it — so the back can see over the front. */
  rise: number
  /** Blocks between neighbours along a row, measured as ARC LENGTH. See the header on "tidy". */
  seatStep: number
  /**
   * Half-width of the gap left for the way in, in radians.
   *
   * ★ S4: the player *"is walked the curve of the old common green… and **passes the audience on
   * the way in**."* You cannot walk through an occupied row, so the seating opens for the path.
   * ⚠ AND THE GAP IS WHERE THE PLAYER ENTERS, NOT AN ARBITRARY GAP — a hold whose aisle faces away
   * from its approach makes the beat play with the audience behind the player, which is the one
   * blocking note the beat has: they must be *passed*.
   */
  aisleHalfAngle: number
  /** Refuse to seat more than this many, whatever the geometry allows. */
  maxSeats: number
}

/**
 * ⚠ UNSWEPT, like every number in `burrowtown.ts`, and for the same reason: `ruins.ts` records the
 * rule for this machinery — *"tune by sweep, never by eye."* These are a starting point shaped by
 * the prose (a *wide shallow* bowl, *tidy* rows) and by the one hard fact canon gives — the Frontier
 * fields ONE line, so this is a crowd of Luminara and not a menagerie. **How many** is explicitly
 * Jin's, and the figure that matters is whether the rows read as *many* from the bramble road.
 */
export const DEFAULT_ROWS: RowDials = {
  rows: 3,
  innerRadius: 9,
  rowStep: 2,
  rise: 1,
  seatStep: 2,
  aisleHalfAngle: 0.32,   // ~18 degrees each side of the way in
  maxSeats: 120,
}

/** The centre of a green, in world blocks. The bowl is concentric with it. */
export function bowlCentre(green: Box): { x: number; z: number } {
  return { x: (green.x0 + green.x1) / 2, z: (green.z0 + green.z1) / 2 }
}

/**
 * Every seat around a green's rim.
 *
 * `entryYaw` is the bearing the player arrives on, in radians — the aisle opens there.
 *
 * ★★ DETERMINISTIC AND SEEDLESS, DELIBERATELY. Every other assembly in this tree is seeded because
 * it must vary; this one must NOT. `jigsaw`'s discipline is that any column can re-derive the same
 * answer without talking to its neighbours, and the cheapest way to satisfy that is to have nothing
 * to re-derive: the seating is a pure function of the green, the dials and the way in. It also
 * happens to be what canon asks for — *tidy* rows are not rolled ones.
 */
export function holdRows(green: Box, entryYaw: number, d: RowDials = DEFAULT_ROWS): Seat[] {
  const c = bowlCentre(green)
  // The bowl must fit inside the green it is worn into, or the rows stand in somebody's house.
  const halfSpan = Math.min(green.x1 - green.x0, green.z1 - green.z0) / 2
  const out: Seat[] = []

  for (let row = 0; row < d.rows; row++) {
    const r = d.innerRadius + row * d.rowStep
    if (r > halfSpan) break                       // ran out of green; a partial ring is honest
    // ★ ARC LENGTH, NOT ANGLE. `seatStep` is a distance between neighbours, so the outer rows get
    // MORE seats rather than the same number spread thinner — which is what "tidy" looks like.
    const count = Math.max(1, Math.floor((2 * Math.PI * r) / d.seatStep))
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      // The aisle. `delta` is the signed angular distance to the way in, wrapped to [-pi, pi] —
      // without the wrap an aisle straddling 0 would open on only one of its two sides.
      let delta = a - entryYaw
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      if (Math.abs(delta) < d.aisleHalfAngle) continue
      out.push({
        x: c.x + Math.cos(a) * r,
        z: c.z + Math.sin(a) * r,
        y: row * d.rise,
        // Facing the middle: the bearing from the seat back to the centre, which is `a` reversed.
        yaw: a + Math.PI,
        row,
      })
      if (out.length >= d.maxSeats) return out
    }
  }
  return out
}

/**
 * The bowl's floor radius — everything inside the first row.
 *
 * ⚠ THIS IS NOT THE RING AND MUST NOT BECOME IT. It is the extent the fighting floor will be worn
 * into later; the floor itself, its dip and its surface are a separate pass, deliberately unbuilt.
 * Canon's ordering is the whole reason (*"build the rows before you build the ring"*), and a helper
 * that quietly grew a floor would collapse the two.
 */
export const bowlFloorRadius = (d: RowDials = DEFAULT_ROWS): number => d.innerRadius - 1
