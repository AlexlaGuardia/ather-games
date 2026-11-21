// BETA M60: ONE INTERACTION RULE (Alex 11-21, hub #15626): E acts only on what the CROSSHAIR is on, within 3 m. Before this every
// interactable picked by distance alone (the gate, Fennel, Greg, waymarks, the planning table + stations, the whole of a settlement,
// Nyx doors), so 'E · …' showed just for standing near something, and a thing behind you could take E.
//
// Each interactable is a vertical CAPSULE (a post from y0 to y1 at x,z, radius r: a Moglin, a waymark stone, a table, a door).
// The crosshair is the camera's centre ray, the same on desktop and phone. A capsule is aimed at when the ray passes within r of
// it, with a little slack that grows with distance (PICK_CONE): the ray rarely lands EXACTLY on a 40 cm Moglin. In reach = the
// capsule's nearest side is within PICK_REACH of the eye, measured on the ground plane. Of everything aimed at and in reach, the
// one nearest the crosshair wins; nothing aimed at = nothing (no fallback to "the nearest one"). Pure.

export const PICK_REACH = 3
/** Slack round each capsule, as an angle off the crosshair (radians, ~6°). */
export const PICK_CONE = (6 * Math.PI) / 180

export interface Pickable<T> { x: number; z: number; y0: number; y1: number; r: number; item: T }
type V3 = { readonly x: number; readonly y: number; readonly z: number }

/** How far off the crosshair a capsule is, as an angle (0 = the ray touches it), and how far along the ray; null = behind. */
export function aimMiss(c: { x: number; z: number; y0: number; y1: number; r: number }, eye: V3, dir: V3, far = PICK_REACH + 8): { miss: number; t: number } | null {
  let best: { miss: number; t: number } | null = null
  for (let t = 0.05; t <= far; t += 0.05) {
    const px = eye.x + dir.x * t, py = eye.y + dir.y * t, pz = eye.z + dir.z * t
    const vy = py < c.y0 ? c.y0 - py : py > c.y1 ? py - c.y1 : 0
    const d = Math.max(0, Math.hypot(px - c.x, pz - c.z, vy) - c.r), miss = Math.atan2(d, t)
    if (!best || miss < best.miss) best = { miss, t }
  }
  return best
}

/** The interactable under the crosshair within reach, or null. `dir` = the camera's forward, unit length. */
/** `from` = where reach is measured from: the keeper's feet (in third person the camera stands metres behind them). */
export function aimPick<T>(cands: readonly Pickable<T>[], eye: V3, dir: V3, from: { x: number; z: number } = eye, reach = PICK_REACH, cone = PICK_CONE): T | null {
  let best: T | null = null, bestMiss = Infinity
  for (const c of cands) {
    if (Math.hypot(c.x - from.x, c.z - from.z) - c.r > reach) continue
    const a = aimMiss(c, eye, dir)
    if (a && a.miss <= cone && a.miss < bestMiss) { best = c.item; bestMiss = a.miss }
  }
  return best
}

/** The walker's look as a unit forward vector (yaw 0 looks down -z; pitch up is positive). */
export const lookDir = (yaw: number, pitch: number) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) })
