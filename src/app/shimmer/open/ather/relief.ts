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

// ── M40 MOONWELL GLADE, layout B (Alex 11-19): the ground is SHAPED here, pointwise, so no tile is re-baked. Over the Glade
// the relief is off and the floor is one level (GLADE.y) so the green and every lot's pad are flat; the pond is a bowl carved
// GLADE.depth below it inside the pond's ellipse (water drawn at GLADE.y - WATER_DROP by moonwell-quest.tsx); outside, the
// Glade fades back to the land over GLADE.fade m. Literals, because moonwell.ts -> waymarks.ts -> wilds.ts -> here would be a
// cycle: relief.test.ts asserts they agree with moonwell.ts / moonwell-glade.ts.
// Sizes are as tight as the plan allows (lotsR 31 still covers every lot's far corners, 30.7 m out): each metre of Glade
// is a metre of the M16 relief gone from the arrival's view (measured on first-wilds: 80.6 % far ground hidden without the
// Glade, 70.5 % with it at these sizes, 69.4 % at a looser 33/7/16).
export const GLADE = { gx: -300, gz: 269.25, lotsR: 31, pondX: -347.5, pondZ: 270.5, rx: 20.5, rz: 24.5, bank: 3, homeX: -323.75, homeZ: 244.75, homeR: 7, y: 24, depth: 1.8, fade: 10 } as const
export const WATER_DROP = 0.35
/** past this the Glade never reaches (a 30 m hill beside it would want a 60 m bank: the bank is capped here) */
export const GLADE_REACH = 60
/** metres outside the Glade's level ground (<= 0 = on it): the green + lots disc, the pond and its bank, Greg's home */
export function gladeDist(x: number, z: number): number {
  const lots = Math.hypot(x - GLADE.gx, z - GLADE.gz) - GLADE.lotsR
  const dx = x - GLADE.pondX, dz = z - GLADE.pondZ, d = Math.hypot(dx, dz) || 1
  const pond = d - 1 / Math.hypot(dx / d / (GLADE.rx + GLADE.bank), dz / d / (GLADE.rz + GLADE.bank))
  const home = Math.hypot(x - GLADE.homeX, z - GLADE.homeZ) - GLADE.homeR
  return Math.min(lots, pond, home)
}
/** inside the pond's ellipse: metres in from the shore (> 0 = water) */
export function pondDepthIn(x: number, z: number): number {
  const dx = x - GLADE.pondX, dz = z - GLADE.pondZ, d = Math.hypot(dx, dz) || 1
  return 1 / Math.hypot(dx / d / GLADE.rx, dz / d / GLADE.rz) - d
}
/** no tree, crystal or outcrop stands on the Glade (wilds.ts asks) */
export const inGlade = (x: number, z: number) => gladeDist(x, z) < 4
/** the Glade's shaping applied to a land height: level floor, pond bowl, a smooth fade back to `land` */
export function gladeGround(x: number, z: number, land: number): number {
  const d = gladeDist(x, z)
  if (d >= GLADE_REACH) return land
  // the fade is as wide as the height gap needs (BANK, like a path's verge), never under GLADE.fade: a fixed width made a
  // 1.34 slope where a relief hill sits beside the Glade (measured on first-wilds), steeper than the keeper can walk
  const verge = Math.max(GLADE.fade, Math.abs(land - GLADE.y) / BANK)
  if (d >= verge) return land
  const w = smooth(Math.max(0, Math.min(1, 1 - d / verge)))
  const p = pondDepthIn(x, z), floor = GLADE.y - (p > 0 ? GLADE.depth * smooth(Math.min(1, p / 4)) : 0)
  return land + (floor - land) * w
}

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
  const h = relieveBase(x, z, rawH, waterY, clear, roads)
  const pads = roads?.pads(x, z)
  return pads?.length ? padGround(pads, h) : h
}
/** how far a pad's blend ring can reach (a literal, like GLADE: network.ts PAD_REACH, which relief.test asserts agrees) */
export const PAD_REACH = 20
/** M39 s3: settlement lots stand on LEVEL PADS. Each baked pad is one height over its footprint + apron, blended back to the
 *  ground across a verge as wide as the gap needs (BANK, the Glade's and the paths'): no cliff, no tile seam, because the pad's
 *  level is baked data and everything else is a function of the point. Several pads' rings overlap between lots: a Shepard
 *  blend (weight -> infinity on a pad) keeps every pad exactly level and the ground continuous. */
export function padGround(pads: { d: number; y: number }[], land: number): number {
  let wsum = 0, wy = 0, hold = 0
  for (const p of pads) {
    if (p.d <= 0) return p.y
    const verge = Math.min(PAD_REACH, Math.max(VERGE_MIN, Math.abs(land - p.y) / BANK))
    if (p.d >= verge) continue
    const s = smooth(p.d / verge), a = (1 - s) / s
    wsum += a; wy += a * p.y; hold = Math.max(hold, 1 - s)
  }
  if (!wsum) return land
  return land + (wy / wsum - land) * hold
}
function relieveBase(x: number, z: number, rawH: number, waterY: number, clear?: (x: number, z: number) => boolean, roads?: RoadField | null): number {
  if (roads) {
    // the land as it would be with no path here: relief everywhere but water, the arrival and settlement/fair ground
    let m = ramp(waterY + 1.5, waterY + 7, rawH) * ramp(ARRIVAL_FLAT, ARRIVAL_FLAT + ARRIVAL_FADE, Math.hypot(x - ARRIVAL.x, z - ARRIVAL.z))
    if (m > 0) m *= 1 - roads.flat(x, z)
    let land = m > 0 ? rawH + reliefRaw(x, z) * m : rawH
    if (land < waterY + 1 && rawH > waterY + 1) land = waterY + 1
    // then meet the nearest path: its own height underfoot, a verge back to the land as wide as the gap needs
    const r = roads.near(x, z, ROAD_REACH)
    if (!r) return gladeGround(x, z, land)
    const edge = r.hw + PATH_EDGE, gap = land - r.y, verge = Math.max(VERGE_MIN, Math.abs(gap) / BANK)
    if (r.d >= edge + verge) return gladeGround(x, z, land)
    return gladeGround(x, z, r.y + gap * smooth(Math.max(0, Math.min(1, (r.d - edge) / verge))))   // M40: the Glade wins over a path through it
  }
  const m = reliefMask(x, z, rawH, waterY, clear)
  if (m <= 0) return gladeGround(x, z, rawH)
  const h = rawH + reliefRaw(x, z) * m
  return gladeGround(x, z, h < waterY + 1 ? Math.min(rawH, Math.max(h, waterY + 1)) : h)
}
