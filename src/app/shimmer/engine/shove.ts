// shove.ts — SYSTEM 9: a cast that MOVES A FOE (move-jobs pass 2, 2026-09-29).
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// Gale Cutter "shoves foes back hard", Wind Shear "throws everyone on the line aside", Riptide "drags
// its target toward you, off their feet", Tidal Arms "yanks one foe toward you", Pyroclast's ash
// "pushes foes out of an area". None of those is damage and none is a status: each changes WHERE a
// foe stands. A gun cannot do that, which is the whole reason these moves stopped being worse guns.
//
// ── THE MODEL ──────────────────────────────────────────────────────────────────
// A shove is a short slide, not a teleport: a velocity held for `SHOVE_SECS`, so the foe is seen to
// travel and a wall it meets STOPS it (the host's `move` returns false and the slide ends there).
// One shove per target: a new one replaces the old, so two gusts never add into a launch across the map.
//
// ── BOUNDARY ───────────────────────────────────────────────────────────────────
// Targets are the same opaque ids `statuses.ts` uses. This module never learns what a foe is or what
// is solid; the host answers both through `move`. Distances are Jin's and live on the CastSpec.

/** how long a shove slides, in seconds. Short enough to read as a hit, long enough to be seen. */
export const SHOVE_SECS = 0.28

export interface Shove { id: string; vx: number; vz: number; left: number }

export type ShoveDir = 'away' | 'toward' | 'aside' | 'out'

/**
 * Unit direction for a shove of `dir` kind on a foe at (fx, fz).
 * - `away` / `toward`: along the line from the SOURCE (the caster, or a bolt's flight) to the foe.
 * - `aside`: perpendicular to the axis (ax, az), to whichever side the foe already stands on.
 * - `out`: from the centre (sx, sz) outwards (a zone pushing out).
 * A foe standing exactly on the source falls back to the axis, so it is never a zero vector.
 */
export function shoveVector(dir: ShoveDir, fx: number, fz: number, sx: number, sz: number, ax: number, az: number): { x: number; z: number } {
  const al = Math.hypot(ax, az) || 1
  const ux = ax / al, uz = az / al
  if (dir === 'aside') {
    const side = (fx - sx) * uz - (fz - sz) * ux   // signed distance off the axis
    const s = side >= 0 ? 1 : -1
    return { x: uz * s, z: -ux * s }
  }
  let dx = fx - sx, dz = fz - sz
  const d = Math.hypot(dx, dz)
  if (d < 1e-3) { dx = ux; dz = uz } else { dx /= d; dz /= d }
  return dir === 'toward' ? { x: -dx, z: -dz } : { x: dx, z: dz }
}

/** Start (or replace) a shove of `dist` world units along the unit vector (ux, uz). */
export function addShove(list: readonly Shove[], id: string, ux: number, uz: number, dist: number, secs = SHOVE_SECS): Shove[] {
  const v = dist / secs
  return [...list.filter((s) => s.id !== id), { id, vx: ux * v, vz: uz * v, left: secs }]
}

/**
 * Advance every shove by `dt`. `move(id, dx, dz)` applies the step to the foe and returns false when
 * it could not (a wall, or the foe is gone): that shove ends where it stopped. Returns the SAME array
 * when there is nothing to do, so the frame loop does not churn.
 */
export function stepShoves(list: Shove[], dt: number, move: (id: string, dx: number, dz: number) => boolean): Shove[] {
  if (list.length === 0) return list
  const out: Shove[] = []
  for (const s of list) {
    const step = Math.min(dt, s.left)
    const ok = move(s.id, s.vx * step, s.vz * step)
    const left = s.left - step
    if (ok && left > 1e-4) out.push({ ...s, left })
  }
  return out
}
