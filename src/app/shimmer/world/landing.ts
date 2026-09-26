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
 * The door itself: **3 wide x 2 deep** — a round plaza with the home plot's swirl portal standing on it.
 *
 * ── ★★ ALEX, 2026-09-26: *"the landing could be a bit bigger and honestly i think it would look good as a
 * simple plaza with the disc portal we have in the homeplot."* ───────────────────────────────────────────
 * This SUPERSEDES two earlier rulings, and says so rather than letting them rot in place:
 *   · 2026-08-24 *1 wide x 2 deep* ("one tile wide is the point") — the door is now as wide as the disc,
 *     so every column the keeper can see the portal in is a column that crosses. A 3-wide disc over a
 *     1-wide trigger would be a door that works only down its middle.
 *   · 2026-09-03 *voxel-built piers* (the trilithon, the missing lintel) — the plaza has no piers. The
 *     frame canon asks for (`world/gates.md`: *"an arch, a plinth"*) is now the PLINTH: the round dais
 *     and the stone ring the disc stands in (`RuneHoldScene`). Two deep still makes it a passage.
 * The disc is the plot's own portal (`voxel3d/seam.ts` › `portalMaterial`), tinted the Rune Hold gate's
 * colour on the Ather side — two ends of one gate are one frequency (`world/gates.md` › bound resonance).
 */
export const LANDING = { x: 48, y: 49, w: 3, h: 2 } as const

/**
 * The stone either side — **none since 2026-09-26** (see `LANDING`). Kept as an empty list rather than
 * deleted so a reader who remembers the piers finds the ruling that removed them.
 */
export const PIERS: ReadonlyArray<readonly [number, number]> = []

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

/** The label `expandGate` stamps on Gregory's door. The other door out of the town. */
export const SHOPFRONT_LABEL = 'THE SPIRIT CORNER'
/**
 * Where a keeper stands up coming back OUT through Greg's shopfront (canon, `rune-hold.md` › the
 * fork: *"a visitor who lands in the glade and does not stay walks back out through the shopfront
 * to the square"*). One tile south of the door's 2×2 footprint (22–23, 48–49), the side Greg
 * himself stands on (his square spot is 24,50) — beside the door, never on it, for the same reason
 * `LANDING_ARRIVAL` is. ⚠ The trail's target for the fork (`SPIRIT_CORNER_STEP`, 23,49) is a tile
 * OF the door and must never be reused as an arrival: it re-warps on the first frame.
 */
export const SHOPFRONT_ARRIVAL = { x: 23, y: 50 } as const

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
