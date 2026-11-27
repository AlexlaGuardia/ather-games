// BETA M233 v2d (Alex 11-27, watching a Clash live): "the camera is up too close" + "after a match is over it should say the
// winner and the tournament tree pops up and crosses off the loser and moves up the winner and then highlights the next two..
// make it dramatic with intros for the spirit on each corner as they enter and then 'Begin'". PURE; no React.
//   CLASH_CAM : the ring's camera, ONE table (Alex's tuner in /shimmer/dev?mode=fair copies values straight into it).
//   camPose   : where that table puts the camera for a canvas aspect (pulled back further when the ring would not fit).
//   CEREMONY  : the beats' lengths (ms at 1x) and ceremonyMs (a faster bout dial shortens them, never below a floor).
//   treeMarks : the tree after a bout: the loser crossed, the winner's new seat, the next two highlighted.
import type { Bracket } from './clash-bracket'
import { nextBout } from './clash-bracket'

export interface ClashCam {
  /** camera height over the sand (m) */ height: number
  /** how far back from the ring's centre it stands, along the ground (m) */ distance: number
  /** where round the ring it stands (deg; 0 = the open side, the stands behind the fight) */ angle: number
  /** vertical field of view (deg) */ fov: number
  /** the ground half-width (m) round the centre that must stay in view; a narrow screen pulls the camera back to keep it */ fit: number
  /** 0 = fixed on the ring's centre; 1 = follows the two spirits' midpoint */ follow: number
}
/** the ring's camera (v2d: pulled back and fixed on the centre, so no trailing can push a spirit to the edge) */
export const CLASH_CAM: ClashCam = { height: 14, distance: 12, angle: 0, fov: 42, fit: 7.2, follow: 0 }
/** the tuner's slider ranges */
export const CAM_RANGE: Record<keyof ClashCam, [number, number, number]> = {
  height: [4, 30, 0.5], distance: [0, 30, 0.5], angle: [-180, 180, 5], fov: [20, 80, 1], fit: [0, 12, 0.2], follow: [0, 1, 0.05],
}
const rad = (d: number) => (d * Math.PI) / 180
/** the camera's offset from its target (x, y, z) for a canvas of this aspect (w / h) */
export function camPose(cam: ClashCam, aspect: number): { x: number; y: number; z: number; fov: number; scale: number } {
  const yaw = rad(cam.angle), R = Math.hypot(cam.height, cam.distance) || 1, pitch = Math.atan2(cam.height, cam.distance)
  const tv = Math.tan(rad(cam.fov / 2)), th = tv * Math.max(0.1, aspect)
  // fit: the ground circle of radius `fit` round the target stays inside the frame (across: th; up-down foreshortened by the pitch)
  const scale = cam.fit > 0 ? Math.max(1, cam.fit / (R * th), (cam.fit * Math.sin(pitch)) / (R * tv)) : 1
  return { x: Math.sin(yaw) * cam.distance * scale, y: cam.height * scale, z: Math.cos(yaw) * cam.distance * scale, fov: cam.fov, scale }
}
/** the values as a line to paste back into CLASH_CAM */
export const camLine = (c: ClashCam) => `{ height: ${c.height}, distance: ${c.distance}, angle: ${c.angle}, fov: ${c.fov}, fit: ${c.fit}, follow: ${c.follow} }`

/** the ceremony's beats (ms at 1x): corner intros, 'Begin', the winner banner, the tree */
export const CEREMONY = { intro: 2600, begin: 900, winner: 1700, tree: 2800 } as const
export type Beat = keyof typeof CEREMONY
/** a beat's length at a bout speed dial: faster bouts shorten it, never under FLOOR_MS (the checks still see each beat) */
export const FLOOR_MS = 500
export const ceremonyMs = (b: Beat, speed = 1) => Math.max(FLOOR_MS, Math.round(CEREMONY[b] / Math.max(1, speed)))

export interface TreeMark { crossed: number | null; moved: boolean; next: boolean }
/** the tree after bout `last` was recorded: per bout, its crossed-off loser (any decided bout), whether its seat was JUST filled
 *  by `last`'s winner (moved up), and whether it is the NEXT bout (both seats known, unfought). */
export function treeMarks(b: Bracket, last: number | null, full = false): TreeMark[] {
  const nx = nextBout(b, full), w = last === null ? null : b.bouts[last]?.winner ?? null
  let movedAt = -1
  if (last !== null && w !== null) movedAt = b.bouts.findIndex((bt, j) => j > last && bt.round === b.bouts[last].round + 1 && (bt.a === w || bt.b === w))
  return b.bouts.map((bt, j) => ({
    crossed: bt.winner === null ? null : bt.a === bt.winner ? bt.b : bt.a,
    moved: j === movedAt,
    next: j === nx,
  }))
}
/** a form's line on the name card ('base' = the base form) */
export const formName = (el: string) => (el === 'base' ? 'Base form' : `${el[0].toUpperCase()}${el.slice(1)} form`)
