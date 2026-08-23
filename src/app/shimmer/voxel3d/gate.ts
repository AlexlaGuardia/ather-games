// Moonwell Glade's tutorial gate — a ceremonial stone arch, sealed until the tutorial quest closes.
//
// ★ PURE MATH. No three, no react, no DOM — same shape as hollows.ts: this file decides WHERE the
// arch sits and WHICH cells belong to its frame vs. its doorway. VoxelWorld.tsx is the only thing
// that actually calls setVoxel — this file never touches a Column.
//
// ★ PHASE 1 IS CEREMONIAL ONLY. No enclosure wall around the glade yet — that is the glade
// dressing pass's job (a ring of something, still Alex's call on look). Wiring a wall in here would
// be scope creep on a mechanics-first pass; the arch alone is enough to gate the exit.

import { ZONE_ANCHORS } from '../voxel/zones'
import { maxBubbleReach } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'

const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

/**
 * How far OUTSIDE the fold's furthest reach the arch stands, in blocks.
 *
 * ── ★★★ THIS REPLACES A DISTANCE-FROM-THE-GLADE THAT THE WORLD OUTGREW ───────────────────────
 * The arch used to sit `GATE_DIST = 300` blocks from the glade toward the garden — a good number on
 * 2026-08-08, chosen as "just inside the tended edge" of a ~320-radius glade. On 08-15 the home
 * plot's fold was carved at the origin with radius 500, and 300-from-the-glade became **r=358 from
 * the fold's centre: ~145 blocks INSIDE a shell standing at ~501.** Measured across eight seeds,
 * `bubbleMaterialAt` claimed **20 of 20 arch cells as fold interior** — which is not "a wall in the
 * way", it is the hollow, where there is no ground at any altitude.
 *
 * ⚠⚠ AND ALEX'S RULING OF 2026-08-23 TURNED THAT FROM SCENERY INTO A SOFT-LOCK: *"the glades will
 * be a one time visit, itll be the tutorial area, after they complete the tutorial they take a gate
 * to the home plot."* This arch is the tutorial's ONLY exit. Buried, the opening has no way out.
 *
 * ★ SO THE NUMBER IS NOW MEASURED FROM THE THING THAT MOVED, NOT FROM THE THING THAT DIDN'T. The
 * old derivation was anchored to the glade and blind to the fold, so nothing about it could notice
 * the fold arriving. `maxBubbleReach` already answers "how far out does the fold reach, shell plus
 * its mound" (540 today) — so the arch stands a standoff beyond THAT, and the day the fold grows or
 * its mound deepens, the arch steps back on its own instead of being swallowed in silence.
 *
 * ⚠ IT IS A FLOOR, NOT A PLACEMENT. The fold's reach decides where the arch may NOT be; the standoff
 * is the only free number here, and it is Alex's to slide.
 *
 * ⚠ AND THE STANDOFF ITSELF IS HEADROOM, NOT A GUARD — a mutation to 0 leaves the whole suite green,
 * because `maxBubbleReach` already counts the mound and the boundary is genuinely clear. Saying so
 * rather than letting 30 sit there looking load-bearing: the number that keeps the arch out of the
 * cloud is `maxBubbleReach`, and this one only buys comfortable distance.
 */
const GATE_STANDOFF = 30

const gdx = -GLADE.x, gdz = -GLADE.z
const glen = Math.hypot(gdx, gdz) || 1

/** Distance from the fold's centre the arch stands: past everything the fold occupies, plus room. */
const GATE_RADIUS = maxBubbleReach(WILDS_BUBBLE) + GATE_STANDOFF

/**
 * World XZ of the gate's centre column — still on the straight line from the glade's heart toward
 * the garden origin, because that is the direction of travel home and the tutorial walks it. What
 * changed is where along that line it stops: at a radius the fold cannot reach, rather than at a
 * distance from the glade that knows nothing about the fold.
 *
 * ⚠ The glade is ~657 out, so this sits ~87 blocks from spawn rather than the old 300 — a shorter
 * walk to the exit, and the shortening is geometry rather than a design change. If the tutorial
 * wants a longer approach, `GATE_STANDOFF` is the dial and the fold's reach is its floor.
 */
// ⚠ THE UNIT VECTOR POINTS ORIGIN→GLADE, NOT GLADE→ORIGIN, AND THE SIGN IS NOT COSMETIC. Written
// with `gdx/glen` (which points glade→origin) the arch lands at the same RADIUS on the OPPOSITE side
// of the world — 1076 blocks from the fold's door instead of ~65. ★ And it reads as a success: the
// bubble check comes back "0 of 20 cells claimed", perfectly clear, because the far side of the
// world is indeed outside the fold. The clearance assert alone could never catch this; only a
// distance to something known could, which is why the test below pins the arch BETWEEN the fold and
// the glade rather than merely outside the fold.
export const GATE_X = Math.round((GLADE.x / glen) * GATE_RADIUS)
export const GATE_Z = Math.round((GLADE.z / glen) * GATE_RADIUS)

/**
 * Snap the arch to whichever axis the garden-ward direction dominates — a voxel arch reads as
 * built, not organic, and every other structure in this world (pieces, doorways) is axis-aligned
 * too. The glade sits mostly north of the garden (|gdz| > |gdx|), so the arch spans X and is one
 * block thick in Z, facing the direction of travel toward home.
 */
export const GATE_SPANS_X = Math.abs(gdz) >= Math.abs(gdx)

export interface GateCell {
  x: number; y: number; z: number
  /** True for the 3×3 interior — sealed with stone until the quest closes, then cleared to AIR.
   *  False for the jambs and lintel — permanent, never touched after the first build. */
  doorway: boolean
}

/**
 * Every cell the arch occupies: a 5-wide × 4-high frame, one block thick, with a 3×3 doorway hole
 * centred in it (leaves a 1-block jamb on each side and a 1-block lintel on top).
 */
export function gateCells(baseY: number): GateCell[] {
  const cells: GateCell[] = []
  for (let h = -2; h <= 2; h++) {          // span offset across the 5-wide axis
    for (let y = 0; y <= 3; y++) {         // 0..3 = 4 high
      const doorway = h >= -1 && h <= 1 && y <= 2   // 3 wide × 3 high interior
      const x = GATE_SPANS_X ? GATE_X + h : GATE_X
      const z = GATE_SPANS_X ? GATE_Z : GATE_Z + h
      cells.push({ x, y: baseY + y, z, doorway })
    }
  }
  return cells
}
