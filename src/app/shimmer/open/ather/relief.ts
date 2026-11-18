// THE WILDS' RELIEF (BETA M16, Alex 11-18: "the one thing that would make a big dif would be terrain for the map, right now
// it's easy to spot everything from a distance"). Build's call, no canon names (play / Jin ec72056f, hub-approved plan).
//
// The tiles are cut from the continent heightmap at 10 m a pixel (tools/worldmap/export_wilds.py), so up close the Wilds are
// gentle rolling ground (first-wilds: 35 m of range over 1 km, slope p95 0.27) and a keeper sees every Hollow across the
// tile. This adds relief ON TOP of that land, at parse time (ather/wilds.ts parseWilds), so the data files stay as they are:
//   · HILLS: smooth value noise, a few metres to ~14 m, ~140 m across: the big folds that hide a Hollow behind a rise
//   · RIDGES: ridged noise, crests of a few metres ~55 m apart: lines of cover inside the hills
//   · OUTCROPS: sparse steep knolls of rock, 5-9 m wide, 3.5-6.5 m tall: cover you can put your back to, climb country
//     (steeper than MAX_WALK_GRADIENT on their flanks, so the keeper climbs them; Hollows walk straight over, combat.ts)
// ★ POINTWISE IN WORLD COORDINATES. Every input (noise, the path mask, the water fade, the arrival disc) is a function of the
//   vertex's own world position and its RAW height, so two tiles agree exactly on the vertices they share: no seam cracks.
// ★ MASKED where flat ground is the point: near water (by raw height, so shores and the sea floor are untouched), on and
//   beside the path network, settlements and the fair (network.ts clearing: settlements keep their saved waymark heights),
//   and a disc round Greg's arrival waymark.
// ★ Never digs below the water line: a dip that would go under waterY stops at the raw height (no dry-floored ponds).
// ★ M18 (Alex 11-18: "sculpt the terrain around the roads"): with a ROAD FIELD (network.ts roadField, from path heights baked
//   by scripts/bake-path-profiles.mts) the paths no longer just switch the relief off. The ground UNDER a path is the path's
//   own smoothed, grade-held height; beside it the land is CUT or FILLED back to the relieved terrain across a VERGE whose
//   width grows with the height gap (BANK: about 1 in 2), so a path through a hill runs in a cutting, a path over a dip on a
//   low bank, and nothing steps at the path's edge. Settlement + fair discs stay flat (roads.flat). Without a field (an
//   older bake, the unit tests' raw tile) the M16 path mask stands.
// PURE. No three, no React, no DOM.

import type { RoadField } from './network'

const h32 = (i: number, j: number, s: number) => {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t: number) => t * t * (3 - 2 * t)
/** Value noise in 0..1 at (x, z) on a lattice `w` metres wide. */
function vnoise(x: number, z: number, w: number, salt: number): number {
  const fx = x / w, fz = z / w, i = Math.floor(fx), j = Math.floor(fz), u = smooth(fx - i), v = smooth(fz - j)
  const a = h32(i, j, salt), b = h32(i + 1, j, salt), c = h32(i, j + 1, salt), d = h32(i + 1, j + 1, salt)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export const HILL_M = 16, HILL_W = 110
export const RIDGE_M = 6, RIDGE_W = 55
/** outcrops: one candidate per OUT_CELL square, OUT_P of them stand */
export const OUT_CELL = 60, OUT_P = 0.45
/** Greg's arrival waymark in WORLD coordinates (waymarks.ts GREG_WAYMARK: first-wilds is tile 0,0, so local = world).
 *  Kept as a literal because waymarks.ts imports wilds.ts; relief.test.ts asserts the two agree. */
export const ARRIVAL = { x: -300, z: 300 }, ARRIVAL_FLAT = 22, ARRIVAL_FADE = 30

export type Outcrop = { i: number; j: number; x: number; z: number; R: number; H: number }
/** The outcrop standing in lattice square (i, j), world coordinates, or null (OUT_P of the squares hold one). */
export function outcropAt(i: number, j: number): Outcrop | null {
  if (h32(i, j, 201) >= OUT_P) return null
  return { i, j, x: (i + 0.2 + h32(i, j, 202) * 0.6) * OUT_CELL, z: (j + 0.2 + h32(i, j, 203) * 0.6) * OUT_CELL,
    R: 5 + h32(i, j, 204) * 4, H: 3.5 + h32(i, j, 205) * 3 }
}
/** Every outcrop whose centre lies in the world box [x0,x1) × [z0,z1). Global lattice: a tile edge never splits one in two. */
export function outcropsIn(x0: number, z0: number, x1: number, z1: number): Outcrop[] {
  const out: Outcrop[] = []
  for (let j = Math.floor(z0 / OUT_CELL) - 1; j <= Math.floor(z1 / OUT_CELL); j++)
    for (let i = Math.floor(x0 / OUT_CELL) - 1; i <= Math.floor(x1 / OUT_CELL); i++) {
      const o = outcropAt(i, j)
      if (o && o.x >= x0 && o.x < x1 && o.z >= z0 && o.z < z1) out.push(o)
    }
  return out
}
/** An outcrop's own salt, for anything that rides on it (wilds.ts: the crystal it may carry). */
export const outcropRoll = (o: Outcrop, salt: number) => h32(o.i, o.j, salt)

/** The raw relief at a world point, before any mask: hills + ridges + outcrops, metres. */
export function reliefRaw(x: number, z: number): number {
  const hill = (vnoise(x, z, HILL_W, 101) * 0.65 + vnoise(x, z, HILL_W * 0.5, 102) * 0.35 - 0.5) * 2 * HILL_M
  const r = vnoise(x + 17, z - 31, RIDGE_W, 103)
  const ridge = (1 - Math.abs(2 * r - 1)) * RIDGE_M
  let out = 0
  const ci = Math.floor(x / OUT_CELL), cj = Math.floor(z / OUT_CELL)
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const o = outcropAt(ci + di, cj + dj)
    if (!o) continue
    const d = Math.hypot(x - o.x, z - o.z)
    if (d < o.R) out = Math.max(out, o.H * smooth(1 - d / o.R) + (h32(Math.floor(x), Math.floor(z), 206) - 0.5) * 0.3)   // a rough crown
  }
  return hill + ridge + out
}

const ramp = (a: number, b: number, t: number) => smooth(Math.max(0, Math.min(1, (t - a) / (b - a))))
/** How much relief a world point takes, 0..1. `rawH` is the tile's own height there; `clear` is network.ts clearing. */
export function reliefMask(x: number, z: number, rawH: number, waterY: number, clear?: (x: number, z: number) => boolean): number {
  let m = ramp(waterY + 1.5, waterY + 7, rawH)                 // shores and the sea floor stay as they are
  if (m <= 0) return 0
  m *= ramp(ARRIVAL_FLAT, ARRIVAL_FLAT + ARRIVAL_FADE, Math.hypot(x - ARRIVAL.x, z - ARRIVAL.z))
  if (m <= 0 || !clear) return m
  if (clear(x, z)) return 0
  // a soft edge to the path mask: the share of a ring of points 8 m and 16 m out that are clear ground
  let n = 0
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); if (clear(x + c * 8, z + s * 8)) n += 2; if (clear(x + c * 16, z + s * 16)) n += 1 }
  return m * (1 - Math.min(1, n / 6))
}

/** the bank beside a sculpted path: rise over run (verge width = height gap / BANK) */
export const BANK = 0.5, VERGE_MIN = 3, PATH_EDGE = 0.6, ROAD_REACH = 70

/** The relieved height of a vertex at a world point. Never below the water line where the raw ground was above it.
 *  With `roads` the land is sculpted to meet the paths (M18); without, the M16 path mask (`clear`) applies. */
export function relieve(x: number, z: number, rawH: number, waterY: number, clear?: (x: number, z: number) => boolean, roads?: RoadField | null): number {
  if (roads) {
    // the land as it would be with no path here: relief everywhere but water, the arrival and settlement/fair ground
    let m = ramp(waterY + 1.5, waterY + 7, rawH) * ramp(ARRIVAL_FLAT, ARRIVAL_FLAT + ARRIVAL_FADE, Math.hypot(x - ARRIVAL.x, z - ARRIVAL.z))
    if (m > 0) m *= 1 - roads.flat(x, z)
    let land = m > 0 ? rawH + reliefRaw(x, z) * m : rawH
    if (land < waterY + 1 && rawH > waterY + 1) land = waterY + 1
    // then meet the nearest path: its own height underfoot, a verge back to the land as wide as the gap needs
    const r = roads.near(x, z, ROAD_REACH)
    if (!r) return land
    const edge = r.hw + PATH_EDGE, gap = land - r.y, verge = Math.max(VERGE_MIN, Math.abs(gap) / BANK)
    if (r.d >= edge + verge) return land
    return r.y + gap * smooth(Math.max(0, Math.min(1, (r.d - edge) / verge)))
  }
  const m = reliefMask(x, z, rawH, waterY, clear)
  if (m <= 0) return rawH
  const h = rawH + reliefRaw(x, z) * m
  return h < waterY + 1 ? Math.min(rawH, Math.max(h, waterY + 1)) : h
}
