// GREG'S HOME at Moonwell Glade (M30): a code-built round cottage blockout just behind his bench. PURE (no three, no react):
// the footprint and its collision boxes live here so the walker (dynamic-solids.ts) and the drawing (glade-home.tsx) agree.
// Placement: GLADE_LAYOUT.home (M40 layout B: on the pond's north-east shore). The door faces the green.
import { GLADE_LAYOUT, gladeAt } from './moonwell-glade'
import { GLADE_GREEN } from './moonwell'
import { gladePlace } from './glade-people'
import { padLevel, PLACE_SIZE } from './glade-pads'
import type { Box } from '../terrain-world'

export const HOME_R = 1.9, HOME_H = 3.2
export function gladeHome(): { x: number; z: number; yaw: number } {
  const w = gladePlace('home'); if (w) return { x: w.x, z: w.z, yaw: w.yaw }   // M153 s1c-2: moved in Place mode
  const p = gladeAt(GLADE_LAYOUT.home)
  return { ...p, yaw: Math.atan2(GLADE_GREEN.x - p.x, GLADE_GREEN.z - p.z) }   // M40: the door faces the green (his bench is in front of it)
}
/** the height it stands at: the ground at its centre; moved, the highest ground under it (glade-pads.ts) */
export function gladeHomeY(ground: (x: number, z: number) => number): number {
  const h = gladeHome()
  return gladePlace('home') ? padLevel({ ...h, ...PLACE_SIZE.home }, ground).top : ground(h.x, h.z)
}
/** in front of the door, where a keeper stands */
export const gladeHomeDoor = () => { const h = gladeHome(), r = HOME_R * 1.4 + 0.7; return { x: h.x + Math.sin(h.yaw) * r, z: h.z + Math.cos(h.yaw) * r } }
/** A round footprint as a plus of two AABBs (corners cut), so it reads as a drum, not a crate. */
export function gladeHomeBoxes(ground: (x: number, z: number) => number, x0: number, z0: number, x1: number, z1: number): Box[] {
  const h = gladeHome(), r = HOME_R, k = r * 0.62
  if (x1 < h.x - r || x0 > h.x + r || z1 < h.z - r || z0 > h.z + r) return []
  const g = gladeHomeY(ground)
  if (!Number.isFinite(g)) return []
  const y0 = g - 1.5, y1 = g + HOME_H
  return [
    { x0: h.x - r, y0, z0: h.z - k, x1: h.x + r, y1, z1: h.z + k },
    { x0: h.x - k, y0, z0: h.z - r, x1: h.x + k, y1, z1: h.z + r },
  ]
}
