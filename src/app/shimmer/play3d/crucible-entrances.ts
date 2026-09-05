// crucible-entrances.ts — WHERE THE SIXTY COME IN, derived from the map's own size.
//
// ★ PURE. No react/three/DOM. Given a grid's dimensions it answers where canon's twenty entrances
// are and where each of the sixty challengers stands when the pyramid opens. Nothing else.
//
// ── ★★★ WHY THIS EXISTS, AND IT IS THE THING THAT MAKES ARENA SIZE MEASURABLE AT ALL ──────────
// Until now the sixty did not spawn on the MAP, they spawned on a ring around the PLAYER.
// `hunter-ai.ts` places a member on its first live tick at `targetX/targetZ ± (spawnMin..+span)`,
// i.e. 12–16 tiles from whoever it is hunting, and on frame one the only living body is you. So
// every challenger materialised in an annulus centred on the keeper, **at the same density no
// matter how large the arena was**. Resizing the Crucible could not have changed how crowded it
// felt, and any judgement made from resizing it would have been about something else.
//
// ⚠⚠ AND IT WAS WORSE THAN UNIFORM: THE RING DID NOT FIT. Player start is (19,25) on a 30-row
// grid, so 39.6% of the ring (measured, 100k samples) lands off the array. `blocked()` returns
// true for an out-of-bounds cell, and an out-of-bounds spawn falls back to ONE tile — `targets[0]`,
// (15,26). **About 24 of the 60 stacked on a single square.** ★ The trap that makes this worth an
// entry rather than a fix: simply enlarging the map makes that pile vanish, because the ring then
// fits — so a resize would have "improved" the arena for a reason with nothing to do with size,
// and the improvement would have been read as evidence about size.
//
// ── ★★ THE POSITIONS ARE CANON, NOT INVENTED (`game/pyramid-zero.md` › Entry) ─────────────────
//   *"Four sides, five entry points each (20 total entrances)"*
//   *"Requires 3 challengers per entrance to activate (60 total)"*
//   *"When filled: All 60 warped to starting positions"*
// So the shape of this file is ruled: four sides, five points a side, three challengers a point.
// `crucible-bots.ts` has carried the entrance index on every challenger since it landed
// (`Challenger.squad`, *"which squad (0..19) — the entrance they came through"*) and **nothing has
// ever mapped that index to a place.** This is the missing half of a model that was already right.
//
// ── ★ EVERYTHING DERIVES FROM (cols, rows), WHICH IS THE WHOLE POINT ─────────────────────────
// A bigger arena spreads the sixty further apart WITHOUT anything here changing, so "how big should
// a floor be" becomes a question a keeper can answer by walking into it. A hardcoded table of
// twenty coordinates would have been the same trap in a new costume: correct at one size, silently
// wrong at every other, and `wilds-gen.ts` already set the precedent of a generator handing its
// gate positions out as DATA rather than burying them.

import { ENTRANCES, SQUAD_SIZE, ROSTER_SIZE } from './crucible-bots'

/** 0 = north (low z), 1 = east (high x), 2 = south (high z), 3 = west (low x). */
export type Side = 0 | 1 | 2 | 3
export const SIDES = 4
/** canon: five entry points on each of the four sides */
export const PER_SIDE = ENTRANCES / SIDES

export interface Entrance { index: number; side: Side; x: number; z: number }

/**
 * How far in from the wall an entrance stands. Enough that a squad's spread cannot reach the
 * border ring even on the smallest arena the editor's resize allows (8×8, `Shimmer3D` clamps there).
 */
export const WALL_INSET = 3

/**
 * The twenty entrances for a grid of this size.
 *
 * ★ EVENLY SPACED AT (i+1)/(PER_SIDE+1) OF THE SIDE, so the five points sit inside the wall rather
 * than one landing in each corner — a corner entrance belongs to two sides and would put two squads
 * on top of each other, which is the one arrangement canon's "four sides, five each" rules out.
 */
export function entrancesFor(cols: number, rows: number): Entrance[] {
  const out: Entrance[] = []
  const along = (n: number, span: number) => Math.round(((n + 1) / (PER_SIDE + 1)) * (span - 1))
  for (let i = 0; i < ENTRANCES; i++) {
    const side = Math.floor(i / PER_SIDE) as Side
    const n = i % PER_SIDE
    let x: number, z: number
    if (side === 0) { x = along(n, cols); z = WALL_INSET }
    else if (side === 1) { x = cols - 1 - WALL_INSET; z = along(n, rows) }
    else if (side === 2) { x = along(n, cols); z = rows - 1 - WALL_INSET }
    else { x = WALL_INSET; z = along(n, rows) }
    out.push({ index: i, side, x, z })
  }
  return out
}

/**
 * Where challenger `seat` (0..2) of the squad that came through `entrance` stands.
 *
 * ★ THE THREE STAND ABREAST, ALONG the wall rather than in a line away from it, so a squad faces
 * the arena together — canon has them arriving as a unit, and a file pointing inward reads as a
 * queue. The spread is clamped so it can never reach the border on a small map.
 */
export function spawnFor(entrance: Entrance, seat: number, cols: number, rows: number): { x: number; z: number } {
  const off = seat - (SQUAD_SIZE - 1) / 2          // -1, 0, +1 for a squad of three
  const horizontal = entrance.side === 0 || entrance.side === 2
  const x = horizontal ? entrance.x + off * 2 : entrance.x
  const z = horizontal ? entrance.z : entrance.z + off * 2
  // ⚠ Clamped INSIDE the border ring. The border is solid, and a challenger placed in a wall is a
  // challenger the collision probe will never let move.
  return {
    x: Math.max(1, Math.min(cols - 2, Math.round(x))),
    z: Math.max(1, Math.min(rows - 2, Math.round(z))),
  }
}

/**
 * Every starting position, in roster order — the whole of canon's *"all 60 warped to starting
 * positions"*. `squad` on a challenger IS the entrance index, so a caller zips this against the
 * roster rather than recomputing the mapping.
 */
export function startingPositions(cols: number, rows: number): { x: number; z: number }[] {
  const ent = entrancesFor(cols, rows)
  const out: { x: number; z: number }[] = []
  for (let i = 0; i < ROSTER_SIZE; i++) {
    out.push(spawnFor(ent[Math.floor(i / SQUAD_SIZE)]!, i % SQUAD_SIZE, cols, rows))
  }
  return out
}
