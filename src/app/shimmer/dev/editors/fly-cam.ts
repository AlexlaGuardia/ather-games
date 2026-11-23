// ── BETA M83 p1 s1b: the World Builder's FREE-FLY CAMERA (Alex 11-22: "fly around.. zoom in and out") ──
// PURE (no three, no React): fly-cam.test.ts drives it. BuilderFly.tsx feeds it keys / mouse / wheel each frame.
//   FLY  WASD moves along the view (flattened to the ground plane, so W never dives), Space / C rise and sink, Shift = fast,
//        right-drag looks, wheel dollies along the view ray.
//   TOP  T toggles a straight-down view at the same x, z; WASD pans (W = north = -z), wheel changes height. T again returns to
//        the fly view you left.
// The camera never goes under the ground (+ CLEAR m) or above CEIL m, so a fast dolly cannot bury it or lose the map.

export interface Cam { x: number; y: number; z: number; yaw: number; pitch: number; top: boolean; /** the fly pose to return to from TOP */ back?: { y: number; pitch: number } }
export interface Keys { f: boolean; b: boolean; l: boolean; r: boolean; up: boolean; down: boolean; fast: boolean }
export const NO_KEYS: Keys = { f: false, b: false, l: false, r: false, up: false, down: false, fast: false }
export const SPEED = 40, FAST = 4, CLEAR = 2, CEIL = 1200, LOOK = 0.004, PITCH_MAX = 1.5, WHEEL_STEP = 0.0015
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** view direction (three's convention: yaw 0 looks down -z, pitch > 0 looks up) */
export const forward = (c: Pick<Cam, 'yaw' | 'pitch'>): [number, number, number] =>
  [-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch)]

function settle(c: Cam, ground: (x: number, z: number) => number): Cam {
  const g = ground(c.x, c.z)
  return { ...c, y: clamp(c.y, (Number.isFinite(g) ? g : -1e3) + CLEAR, CEIL) }
}

/** one frame of movement; speed scales with height above the ground so a low pass is precise and a high one covers the map */
export function stepCam(c: Cam, k: Keys, dt: number, ground: (x: number, z: number) => number): Cam {
  const g = ground(c.x, c.z), above = Math.max(4, c.y - (Number.isFinite(g) ? g : c.y - 40))
  const v = SPEED * (k.fast ? FAST : 1) * clamp(above / 40, 0.25, 6) * dt
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
  let dx = 0, dz = 0, dy = 0
  if (c.top) { if (k.f) dz -= v; if (k.b) dz += v; if (k.l) dx -= v; if (k.r) dx += v }
  else {
    const a = (k.f ? 1 : 0) - (k.b ? 1 : 0), s = (k.r ? 1 : 0) - (k.l ? 1 : 0)
    dx = (fx * a + rx * s) * v; dz = (fz * a + rz * s) * v
  }
  if (k.up) dy += v; if (k.down) dy -= v
  return settle({ ...c, x: c.x + dx, y: c.y + dy, z: c.z + dz }, ground)
}

/** right-drag look (ignored in TOP: the view stays straight down) */
export function lookCam(c: Cam, mx: number, my: number): Cam {
  if (c.top) return c
  return { ...c, yaw: c.yaw - mx * LOOK, pitch: clamp(c.pitch - my * LOOK, -PITCH_MAX, PITCH_MAX) }
}

/** wheel: FLY dollies along the view ray, TOP changes height (both proportional to the height above ground). deltaY > 0 = out. */
export function zoomCam(c: Cam, deltaY: number, ground: (x: number, z: number) => number): Cam {
  const g = ground(c.x, c.z), above = Math.max(4, c.y - (Number.isFinite(g) ? g : c.y - 40))
  const d = -deltaY * WHEEL_STEP * above
  if (c.top) return settle({ ...c, y: c.y - d }, ground)
  const [fx, fy, fz] = forward(c)
  return settle({ ...c, x: c.x + fx * d, y: c.y + fy * d, z: c.z + fz * d }, ground)
}

/** T: straight down over the same spot (at least 150 m up), and back to the fly pose you left */
export function toggleTop(c: Cam, ground: (x: number, z: number) => number): Cam {
  if (c.top) return settle({ ...c, top: false, y: c.back?.y ?? c.y, pitch: c.back?.pitch ?? -0.5, back: undefined }, ground)
  const g = ground(c.x, c.z)
  return settle({ ...c, top: true, back: { y: c.y, pitch: c.pitch }, pitch: -Math.PI / 2, yaw: 0, y: Math.max(c.y, (Number.isFinite(g) ? g : 0) + 150) }, ground)
}

/** a start pose: south of the point, raised, looking at it */
export function camOver(x: number, z: number, ground: (x: number, z: number) => number): Cam {
  const g = ground(x, z), h = (Number.isFinite(g) ? g : 0)
  return settle({ x, y: h + 90, z: z + 140, yaw: 0, pitch: -0.55, top: false }, ground)
}

// ── M83 (Alex 11-23, "changing the terrain dramatically takes a bit long"): the brush STRENGTH ladder, m per 50 ms tick at the
// brush centre. The slider and the - / = hotkeys share it. Top raised 1 -> 3 (60 m/s held: the per-vertex clamp, EDIT_MAX_DM
// +-60 m, is reached in about a second, so the cap is the edit layer's, not the brush's). Bottom raised 0.02 -> 0.1: edits are
// stored in whole decimetres and each tick ROUNDS (clampDm), so 0.02 m/tick (0.2 dm) rounded to 0 every tick and did nothing at
// all (builder-fly-lock-check measured +0.000 m); 0.1 is the smallest strength that moves the ground.
export const STRENGTH_MIN = 0.1, STRENGTH_MAX = 3
export const STRENGTH_STEPS = [0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3]
/** the next rung up (dir 1) or down (-1) from s; a value between rungs goes to the neighbouring rung in that direction */
export function stepStrength(s: number, dir: 1 | -1): number {
  const L = STRENGTH_STEPS
  if (dir > 0) return L.find(v => v > s + 1e-9) ?? L[L.length - 1]
  for (let i = L.length - 1; i >= 0; i--) if (L[i] < s - 1e-9) return L[i]
  return L[0]
}
