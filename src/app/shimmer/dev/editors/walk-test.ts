// ── BETA M87 (World Builder p5): THE WALK TEST's state. PURE (no three, no react) so the test drives what the view does.
// One key (H) drops the keeper ON FOOT at the crosshair spot in the DRAFT: the draft's ground (heightAt, edits included)
// plus the draft's solid pieces (scenery + zone builds, as the walker's boxes) make a terrain-world Shape, and the walker
// is the game's own (open/shared/locomotion.ts through open/terrain-world.ts), untouched. H again = back to Fly, over the
// spot the keeper is standing on, at the height and pitch Fly had when the walk began.
// The walk only READS the draft: nothing here writes edits, pieces or the store (the test pins that).

import { terrainWorld, type Box, type Shape } from '../../open/terrain-world'
import { createLoco, tickLocomotion, type LocoState, type LocoInput, type LocoWorld } from '../../open/shared/locomotion'
import { CLEAR, type Cam, type Keys } from './fly-cam'

type Ground = (x: number, z: number) => number
const NO_BOXES: readonly Box[] = []

/** the draft as the walker sees it: its ground and its solid boxes (no water boxes: the builder's sea is drawn, not swum) */
export function walkShape(ground: Ground, boxes: readonly Box[]): Shape {
  return {
    ground,
    solids: (x0, y0, z0, x1, y1, z1) => boxes.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0 && b.y0 <= y1 && b.y1 >= y0),
    water: () => NO_BOXES,
  }
}

export interface Walk { loco: LocoState; world: LocoWorld; /** how Fly sat when the walk began: height above the ground and pitch */ back: { above: number; pitch: number } }

/** the feet where a body dropped at (x, z) lands: on the ground, or on top of a solid piece that stands there */
export function dropFeet(shape: Shape, x: number, z: number): number {
  const g = shape.ground(x, z); if (!Number.isFinite(g)) return NaN
  let y = g
  for (const b of shape.solids(x, -1e4, z, x, 1e4, z)) if (b.x0 <= x && x < b.x1 && b.z0 <= z && z < b.z1 && b.y1 > y) y = b.y1
  return y
}

/** H in Fly: the keeper on foot at the crosshair spot; null where there is no land (the void, nothing under the crosshair) */
export function enterWalk(cam: Cam, spot: { x: number; z: number } | null, shape: Shape): Walk | null {
  if (!spot) return null
  const feet = dropFeet(shape, spot.x, spot.z); if (!Number.isFinite(feet)) return null
  const g = shape.ground(cam.x, cam.z), above = Math.max(CLEAR, cam.y - (Number.isFinite(g) ? g : feet))
  return { loco: createLoco(spot.x, feet + 0.05, spot.z), world: terrainWorld(shape), back: { above, pitch: cam.top ? -0.6 : cam.pitch } }
}

/** the walker's input from the fly keys and the view's yaw (three's convention: yaw 0 looks down -z) */
export function walkInput(k: Keys, yaw: number, dt: number): LocoInput {
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw), rightX = Math.cos(yaw), rightZ = -Math.sin(yaw)
  const a = (k.f ? 1 : 0) - (k.b ? 1 : 0), s = (k.r ? 1 : 0) - (k.l ? 1 : 0)
  let mvX = fwdX * a + rightX * s, mvZ = fwdZ * a + rightZ * s
  const n = Math.hypot(mvX, mvZ); if (n > 0) { mvX /= n; mvZ /= n }
  return { mvX, mvZ, fwdX, fwdZ, rightX, rightZ, jumpKey: k.up, crouchKey: k.down, dt }
}

/** one frame on foot (the game's own tick; it mutates the walker's state, never the draft) */
export function stepWalk(w: Walk, k: Keys, yaw: number, dt: number): Walk {
  tickLocomotion(w.loco, walkInput(k, yaw, dt), w.world)
  return w
}

/** the eye the view draws from */
export const walkEye = (w: Walk) => ({ x: w.loco.px, y: w.loco.py + w.loco.eye, z: w.loco.pz })

/** H on foot: Fly again, over where the keeper stands, at the height + pitch Fly had; the view keeps the walk's yaw */
export function exitWalk(w: Walk, cam: Cam, ground: Ground): Cam {
  const x = w.loco.px, z = w.loco.pz, g = ground(x, z), base = Number.isFinite(g) ? g : w.loco.py
  return { x, y: base + w.back.above, z, yaw: cam.yaw, pitch: w.back.pitch, top: false }
}
