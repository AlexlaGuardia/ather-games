// THE FALL INTO A VOID (void v2, Alex 11-23 06:4x: "have the void mist/fog tall enough for the player to fall inside and disappear
// into so they feel like they fell off the map"). CANON (read-only, game/shimmer-geography.md): a void is deep, uncooled cloud,
// uncrossable but by its crossings; a fall costs time, never gore. This is only the falling: the cost (voidFall in page.tsx: set
// down at the last crossing, else the last waymark) is unchanged and runs once the view is black.
//
//   lip     the keeper's feet reach FALL_LIP weight (wilds-voids: past the rolled-over lip, on the cliff)
//   falling the walker hands the body to stepFall: gravity (the walker's own GRAVITY), the run carried and bleeding off, the
//           ground ignored on the way down, never below the pit floor (the camera stops inside the densest fog, never under the
//           ground mesh)
//   dark    the view goes black over FALL_BLACK_S (sooner if the body is already deep): `dark` drives a black veil
//   done    once fully black: the page runs the fall's cost exactly once
// PURE. No three, no React, no DOM.
import { GRAVITY } from '../shared/locomotion'

export const FALL_BLACK_S = 1.3      // lip to black, seconds
export const FALL_DARK_FROM = 0.25   // the veil starts closing after this long in the air
export const FALL_DEEP_M = 18        // ...or as the body sinks this far below where it left the lip (whichever is darker)
export const FALL_FLOOR_GAP = 0.3    // the body never goes nearer the pit floor than this
export const FALL_PUSH = 5           // m/s: the least run into the void off the lip

export interface FallState { t: number; y0: number; vy: number; hvx: number; hvz: number; done: boolean }
export interface Body { px: number; py: number; pz: number }

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

/** The keeper has gone over: start falling from where they are, keeping the run (never rising). `inward` (unit, toward the deep:
 *  the void weight's gradient) gets at least FALL_PUSH of the run, so the body leaves the cliff face and drops clear into the
 *  column instead of sliding down the wall. */
export function startFall(b: Body, vy: number, hvx: number, hvz: number, inward?: { x: number; z: number }): FallState {
  if (inward) { const along = hvx * inward.x + hvz * inward.z; if (along < FALL_PUSH) { hvx += inward.x * (FALL_PUSH - along); hvz += inward.z * (FALL_PUSH - along) } }
  return { t: 0, y0: b.py, vy: Math.min(0, vy), hvx, hvz, done: false }
}

/** One frame of the fall: moves `b` in place (no allocation), returns the veil's darkness 0..1. `s.done` turns true on the
 *  frame the view is fully black, and stays true (the page acts on the edge). */
export function stepFall(s: FallState, b: Body, dt: number, ground: (x: number, z: number) => number): number {
  s.t += dt
  s.vy -= GRAVITY * dt
  const drag = Math.exp(-0.5 * dt)   // the run bleeds off in the cloud
  s.hvx *= drag; s.hvz *= drag
  b.px += s.hvx * dt; b.pz += s.hvz * dt
  const y = b.py
  b.py += s.vy * dt
  const g = ground(b.px, b.pz)
  if (Number.isFinite(g) && b.py < g + FALL_FLOOR_GAP) {
    if (g > y) { b.px -= s.hvx * dt; b.pz -= s.hvz * dt; s.hvx = 0; s.hvz = 0 }   // a wall ahead: stop against it
    b.py = Math.min(y, g + FALL_FLOOR_GAP); s.vy = 0                                              // rests, never lifts
  }
  const dark = Math.max(smooth((s.t - FALL_DARK_FROM) / (FALL_BLACK_S - FALL_DARK_FROM)), smooth((s.y0 - b.py) / FALL_DEEP_M))
  if (dark >= 1) s.done = true
  return dark
}
