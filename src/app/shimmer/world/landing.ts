// THE LANDING — Rune Hold square's public gate-landing, and where a keeper crossing in stands up.
//
// ★ PURE DATA + ONE DERIVATION. No react, no three, no DOM, and deliberately NO import of the map:
// this module is imported by `zones.ts` (which owns the map), so reaching back for `RUNE_HOLD`
// would be a cycle. Instead the placement is stated here and `landing.test.ts` proves it against
// the SHIPPED grid. The proof lives with the test; the numbers live with the door.
//
// ── ★★ WHY THESE NUMBERS ARE NOT A GUESS, WHICH IS THE ONE THING THIS FILE HAS TO EARN ────────
// `voxel3d/crossing-out.ts` refuses to derive the landing, and it is right to: *"a derived landing
// is a wall or a rooftop with a green test beside it."* That refusal was written on 2026-08-27,
// when the square was thin outlines on a grass field and there was nothing to derive FROM.
//
// The 08-25 re-proportioning changed the input. Rune Hold now carries a programmatic **24x24 plaza
// of Dirt (tile 3) spanning x 38..61, y 38..61**, authored with THE LANDING reserved at its heart
// (GBOARD, *RUNE HOLD RE-PROPORTIONED*), and the keeper's own `playerStart` sits inside it at
// (49,58). So the heart of the square is a MEASURED fact about the shipped map, not a plausible
// coordinate — and `landing.test.ts` re-measures it rather than trusting this comment, because a
// comment is the half that goes stale silently.
//
// ⚠ EVERY CELL BELOW IS ASSERTED TO BE PLAZA FLOOR TODAY. If the town is ever re-authored the test
// goes red naming the cell, instead of the door quietly ending up inside a shopfront.

/** Canon's nametag, and the only thing `landingGate()` looks for. Re-exported from `crossing-out`. */
export const LANDING_LABEL = 'THE LANDING'

/** The plaza, as the shipped map has it — the bounds every placement here is checked against. */
export const PLAZA = { x0: 38, y0: 38, x1: 61, y1: 61 } as const

/** Plaza floor. A landing cell that is not this is a landing inside somebody's wall. */
export const PLAZA_FLOOR = 3

/** The town's masonry — brown Building Block, SOLID. What the piers are built from. */
export const PIER_TILE = 103

/**
 * The doorway's own tile. Tile 14, Warp.
 *
 * ── ★★★ THE DOOR'S CELLS MUST CARRY THIS, AND IT IS NOT DECORATION ───────────────────────────
 * `world/rune-hold-fold.test.ts` holds the rule and states it plainly: *"a gate must sit ON the
 * warp tiles Alex painted. This is the check that ties CODE to MAP."* Alex positions a door by
 * painting a block of tile 14 and the gate's anchor is read off it — so a gate whose footprint is
 * bare ground is *"a door in two places, neither of them right."*
 *
 * ⚠ I GOT THIS WRONG FIRST AND A PEER WINDOW'S SWEEP CAUGHT IT. My first pass left the doorway as
 * plaza dirt, reasoning from a comment in `zones.ts` that gates *"render from data"* — true, and it
 * does not mean the map may disagree with the data. The play lane's post-deploy sweep read my
 * in-flight tree, went red on this exact assert, and dbr'd it over rather than filing it as noise
 * from someone else's edit. **The pairing check existed, was correct, and was the only thing that
 * knew.** Kept written down because the wrong reasoning was plausible enough to repeat.
 */
export const DOOR_TILE = 14

/**
 * The door itself: **1 wide x 2 deep**, Alex's ruling of 2026-08-24 — the ruling that widened
 * `Gate` with `w`/`h` in the first place, since `size` is one number and a landing is not square.
 *
 * ★ ONE TILE WIDE IS THE POINT. A keeper walks THROUGH it rather than onto it, and two deep is what
 * makes the crossing a passage rather than a doormat.
 */
export const LANDING = { x: 49, y: 49, w: 1, h: 2 } as const

/**
 * The stone either side. Two piers, each **2 wide x 2 deep**, flanking the door.
 *
 * ── ★★ VOXEL-BUILT, AND THAT IS ALEX'S RULING OF 2026-09-03, NOT A PREFERENCE ─────────────────
 * A `gate_landing.glb` was baked for this spot and RETIRED the same day (`d077e88`, kept at
 * `tools/render/ref/`). Three reasons, and the first is the one that decides it: **a mesh writes
 * nothing into the grid, so it has no collision** — a keeper walks straight through both piers of a
 * bare GLB. Tiles are solid by construction, which is the same argument `pieces.ts` makes voxel-side:
 * *"the expensive-sounding half of the idea reduces to a value already in an array."*
 *
 * ★ TWO WIDE, NOT ONE, BECAUSE A SHEET IS NOT A GATEWAY. `voxel3d/crossings.ts` records the rule
 * from Alex's 08-27 stone-hedge ruling: a frame must read as a **trilithon** and be at least two
 * thick, because *a sheet of stone with a rectangle cut out of it reads as masonry however you
 * proportion it*. Two-by-two piers give the door jambs with depth.
 *
 * ⚠⚠ AND THE LINTEL IS HONESTLY MISSING, WHICH IS A LIMIT OF THE RENDERER AND NOT AN OMISSION.
 * The tile world extrudes a 2D grid: a cell is a full-height box or it is nothing, so there is no
 * way to hang a course of stone ABOVE a walkable opening. Canon (`world/gates.md`) calls a kept
 * gate a *framed doorway*; what ships here is the two jambs of that frame and no head. Expressing
 * the head needs either a new tile class rendered raised and non-solid, or Rune Hold rebuilt in
 * voxel3d — the open direction question from 08-25. Saying so beats a comment claiming a frame.
 */
export const PIERS: ReadonlyArray<readonly [number, number]> = [
  [47, 49], [48, 49], [50, 49], [51, 49],
  [47, 50], [48, 50], [50, 50], [51, 50],
]

/**
 * Where a keeper crossing IN from the Ather stands up. One tile south of the door, on open plaza.
 *
 * ── ★★★ THIS IS THE NUMBER THE WHOLE CROSSING WAS BLOCKED ON, SO HERE IS WHY IT IS THIS ONE ───
 * `Gate.toX/toY` is the obvious candidate and it is WRONG — hub nearly shipped it on 08-27 and
 * caught it: `toX/toY` is where a gate SENDS you, a tile in `toZone`, so anchoring on it puts the
 * keeper at the far end of the door they just came through. That is precisely the *legal and
 * meaningless* coordinate `engine/crossing.ts` bans (0,0) by name for.
 *
 * ⚠⚠ BESIDE THE DOOR, NEVER ON IT. `arrivalBlockedBy` refuses any tile inside ANY gate's footprint,
 * because a gate tile is what a warp fires on: an arrival placed on one is an instant re-warp, and
 * that reads as the crossing being broken rather than as the arrival being one tile off.
 *
 * ★ SOUTH RATHER THAN NORTH, and it is the one aesthetic call in this file. The keeper's own
 * `playerStart` is (49,58), twelve rows south — so south is the square's approach, the side the
 * town faces the door from. Standing up on the north side would put a keeper's back to the town
 * on arrival. ⚠ Alex's to slide; it is one number and nothing derives from it.
 */
export const LANDING_ARRIVAL = { x: 49, y: 51 } as const

/** Is (x,y) inside the plaza the placements above are all asserted against? */
export const inPlaza = (x: number, y: number): boolean =>
  x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1

/** The door's cells, expanded — the footprint `gateFootprint` will report for THE LANDING. */
export function landingCells(): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dy = 0; dy < LANDING.h; dy++) for (let dx = 0; dx < LANDING.w; dx++)
    out.push([LANDING.x + dx, LANDING.y + dy])
  return out
}
