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
// PURE. No three, no React, no DOM.

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

/** The raw relief at a world point, before any mask: hills + ridges + outcrops, metres. */
export function reliefRaw(x: number, z: number): number {
  const hill = (vnoise(x, z, HILL_W, 101) * 0.65 + vnoise(x, z, HILL_W * 0.5, 102) * 0.35 - 0.5) * 2 * HILL_M
  const r = vnoise(x + 17, z - 31, RIDGE_W, 103)
  const ridge = (1 - Math.abs(2 * r - 1)) * RIDGE_M
  let out = 0
  const ci = Math.floor(x / OUT_CELL), cj = Math.floor(z / OUT_CELL)
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = ci + di, j = cj + dj
    if (h32(i, j, 201) >= OUT_P) continue
    const ox = (i + 0.2 + h32(i, j, 202) * 0.6) * OUT_CELL, oz = (j + 0.2 + h32(i, j, 203) * 0.6) * OUT_CELL
    const R = 5 + h32(i, j, 204) * 4, H = 3.5 + h32(i, j, 205) * 3
    const d = Math.hypot(x - ox, z - oz)
    if (d < R) out = Math.max(out, H * smooth(1 - d / R) + (h32(Math.floor(x), Math.floor(z), 206) - 0.5) * 0.3)   // a rough crown
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

/** The relieved height of a vertex at a world point. Never below the water line where the raw ground was above it. */
export function relieve(x: number, z: number, rawH: number, waterY: number, clear?: (x: number, z: number) => boolean): number {
  const m = reliefMask(x, z, rawH, waterY, clear)
  if (m <= 0) return rawH
  const h = rawH + reliefRaw(x, z) * m
  return h < waterY + 1 ? Math.min(rawH, Math.max(h, waterY + 1)) : h
}
