// THE CLUSTER MEADOW (Alex 11-15: "what if we filled in the space inbetween the gardens with diff terrain.. this
// cluster could be modeled after the meadows biome with hills and other landscapes dividing them.. plus the bridges
// could just be paths that all meet").
//
// Alone, a garden is its own floating island. Linked, the fold is ONE place (canon: a cluster is one fold, not four
// folds with doors), so the ground between the gardens fills in: a meadow round them all, hills rising in the
// divides between neighbours, a path from every garden's gate corner winding to the shared square where they all
// meet. The whole cluster floats as one; its outer edge is the fall home, as a lone island's is.
//
// HOW THE GROUND IS MADE. One height field on the islands' own grid (4 m; every garden centre and the Green sit on
// multiples of 4 m and gardens turn by quarter-turns, so island vertices land exactly on meadow vertices).
// ANCHORS: every island vertex (its own height: the seam cannot crack), the square, and the paths (pad height).
// Everything else = its nearest anchor's height + a hill that grows with the distance from it, so the meadow meets
// every shore, path and the square level and climbs only as it leaves them.
//
// ★ PURE. No React, no three.

import { PLOT_R, PLOT_HALF, PLOT_CELL, PATH_START, plotCellIsLand, plotVertexHeight, plotVertexTouchesLand } from './plot'

export const MEADOW_CELL = PLOT_CELL   // the islands' own cell, so their vertices are the valley's
export const PATH_W = 6
export const PATH_Y = 2.0

export interface Placed { x: number; z: number; rot: number }
export interface Path { pts: [number, number][]; w: number }
export interface Tree { x: number; y: number; z: number; r: number; tall: number }
export interface Meadow {
  x0: number; z0: number; n: number          // vertex (a, b) stands at (x0 + 2a, z0 + 2b); n vertices a side
  h: Float32Array                            // vertex heights
  land: Uint8Array                           // per cell: 1 = meadow ground (not an island, not the void)
  kind: Uint8Array                           // per cell: 0 grass, 1 path, 2 the square
  island: Uint8Array                         // per cell: 1 = a garden island's own ground (drawn by its island)
  trees: Tree[]
  treeNo?: number[]                          // M160: each tree's number in the full list, when some are left out (its tint goes by it)
}

// three.js rotation.y: world = centre + (c·x + s·z, −s·x + c·z)
export const toWorld = (cx: number, cz: number, rot: number, lx: number, lz: number) => {
  const c = Math.cos(rot), s = Math.sin(rot)
  return { x: cx + c * lx + s * lz, z: cz - s * lx + c * lz }
}
export const toLocal = (cx: number, cz: number, rot: number, x: number, z: number) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dz = z - cz
  return { x: c * dx - s * dz, z: s * dx + c * dz }
}

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) ^ 0x2c1b3c6d
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

/** Distance from (x,z) to a polyline. */
export function pathDist(p: Path, x: number, z: number): number {
  let best = Infinity
  for (let k = 1; k < p.pts.length; k++) {
    const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z))
  }
  return best
}

/** A garden's path: from its start corner (PATH_START, on the diagonal) out past the shore, bending gently, to the
 *  middle of the Green where every path meets. `bend` (±1) sets which way it curves. */
export function gardenPath(g: Placed, mx: number, mz: number, bend: number): Path {
  const s = toWorld(g.x, g.z, g.rot, PATH_START.x, PATH_START.z), e = { x: mx, z: mz }
  const dx = e.x - s.x, dz = e.z - s.z, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L
  const pts: [number, number][] = []
  for (let k = 0; k <= 24; k++) {
    const t = k / 24, off = Math.sin(t * Math.PI) * 12 * bend * smooth(0.15, 0.4, t)   // straight off the corner, then a bend
    pts.push([s.x + dx * t + nx * off, s.z + dz * t + nz * off])
  }
  return { pts, w: PATH_W }
}

/** Where island land stands under a world point, for each garden: the vertex index in that garden's grid, or null. */
function islandVertex(gs: Placed[], x: number, z: number): number | null {
  for (const g of gs) {
    const l = toLocal(g.x, g.z, g.rot, x, z)
    const i = Math.round((l.x + PLOT_HALF) / PLOT_CELL), j = Math.round((l.z + PLOT_HALF) / PLOT_CELL)
    if (plotVertexTouchesLand(i, j)) return plotVertexHeight(i, j)
  }
  return null
}
function islandCell(gs: Placed[], x: number, z: number): boolean {
  for (const g of gs) {
    const l = toLocal(g.x, g.z, g.rot, x, z)
    if (plotCellIsLand(Math.floor((l.x + PLOT_HALF) / PLOT_CELL), Math.floor((l.z + PLOT_HALF) / PLOT_CELL))) return true
  }
  return false
}

/** The cluster's outline: a rounded square round every PRESENT garden (an empty corner stays sky), and the square. */
export const MEADOW_R = PLOT_R + 52
function inOutline(gs: Placed[], mx: number, mz: number, half: number, x: number, z: number): boolean {
  if (Math.max(Math.abs(x - mx), Math.abs(z - mz)) < half + 30) return true
  for (const g of gs) {
    const dx = x - g.x, dz = z - g.z, a = Math.atan2(dz, dx)
    const R = MEADOW_R + Math.sin(a * 5 + g.x * 0.01) * 4 + Math.sin(a * 11 - 0.4) * 2
    if ((Math.abs(dx) / R) ** 6 + (Math.abs(dz) / R) ** 6 < 1) return true
  }
  return false
}

/** The hill a point would carry far from every anchor: ridges in the divides between neighbours (the lines through the
 *  square's middle, beyond it), rolling ground everywhere. Metres above the anchor. */
function hillAt(mx: number, mz: number, x: number, z: number): number {
  const u = x - mx, v = z - mz
  const ridge = Math.exp(-((Math.min(Math.abs(u), Math.abs(v)) / 55) ** 2)) * smooth(45, 160, Math.max(Math.abs(u), Math.abs(v)))
  const roll = 0.5 + 0.5 * Math.sin(x * 0.031 + 1.3) * Math.cos(z * 0.027 - 0.7)
  return 2 + 12 * ridge + 4 * roll + 1.2 * Math.sin(x * 0.12 - z * 0.05) * Math.cos(z * 0.1 + x * 0.03)
}

/** How far round an OPEN SPOT's centre the ground lies mown and level (BETA M52): the island's own reach, so a mate's
 *  garden landing there sits on ground that was already flat. */
export const SPOT_R = PLOT_R - 8
/** `spots` (BETA M52, Alex 11-20: "keep the whole green as is with just open spots"): quarters no mate holds yet. Each is
 *  level, mown ground where a garden will land (kind 3), inside the outline, so the Green is whole even alone. */
export function buildMeadow(gardens: Placed[], mx: number, mz: number, half: number, paths: Path[], spots: Placed[] = []): Meadow {
  const C = MEADOW_CELL   // HX a whole number of cells, so x0 shares the islands' lattice (multiples of C)
  const HX = Math.ceil((Math.max(...[...gardens, ...spots].map(g => Math.max(Math.abs(g.x - mx), Math.abs(g.z - mz))), half) + MEADOW_R + 10) / C) * C
  const x0 = mx - HX, z0 = mz - HX, n = (2 * HX) / C + 1
  const N = n * n, dist = new Float32Array(N).fill(Infinity), ha = new Float32Array(N), h = new Float32Array(N)
  // anchors: islands (their own vertex heights), the square, the paths
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const x = x0 + a * C, z = z0 + b * C, k = b * n + a
    const iv = islandVertex(gardens, x, z)
    if (iv !== null) { dist[k] = 0; ha[k] = iv; continue }
    if (spots.some(sp => Math.hypot(x - sp.x, z - sp.z) <= SPOT_R)) { dist[k] = 0; ha[k] = PATH_Y; continue }
    if (Math.max(Math.abs(x - mx), Math.abs(z - mz)) <= half || paths.some(p => pathDist(p, x, z) <= p.w / 2 + 1)) { dist[k] = 0; ha[k] = PATH_Y }
  }
  // chamfer distance transform, carrying the nearest anchor's height along
  const D1 = C, D2 = C * Math.SQRT2
  const relax = (k: number, kk: number, w: number) => { if (dist[kk] + w < dist[k]) { dist[k] = dist[kk] + w; ha[k] = ha[kk] } }
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const k = b * n + a
    if (a > 0) relax(k, k - 1, D1)
    if (b > 0) { relax(k, k - n, D1); if (a > 0) relax(k, k - n - 1, D2); if (a < n - 1) relax(k, k - n + 1, D2) }
  }
  for (let b = n - 1; b >= 0; b--) for (let a = n - 1; a >= 0; a--) {
    const k = b * n + a
    if (a < n - 1) relax(k, k + 1, D1)
    if (b < n - 1) { relax(k, k + n, D1); if (a < n - 1) relax(k, k + n + 1, D2); if (a > 0) relax(k, k + n - 1, D2) }
  }
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const k = b * n + a, x = x0 + a * C, z = z0 + b * C
    h[k] = dist[k] === 0 ? ha[k] : ha[k] + hillAt(mx, mz, x, z) * smooth(3, 60, dist[k])
  }
  // cells: meadow ground where all four corners are inside the outline and the cell is not an island's own
  const cn = n - 1, land = new Uint8Array(cn * cn), kind = new Uint8Array(cn * cn), island = new Uint8Array(cn * cn)
  for (let b = 0; b < cn; b++) for (let a = 0; a < cn; a++) {
    const x = x0 + a * C, z = z0 + b * C, cx = x + C / 2, cz = z + C / 2, k = b * cn + a
    if (islandCell(gardens, cx, cz)) { island[k] = 1; continue }
    const all = spots.length ? [...gardens, ...spots] : gardens
    if (!(inOutline(all, mx, mz, half, x, z) && inOutline(all, mx, mz, half, x + C, z) && inOutline(all, mx, mz, half, x, z + C) && inOutline(all, mx, mz, half, x + C, z + C))) continue
    land[k] = 1
    kind[k] = paths.some(p => pathDist(p, cx, cz) <= p.w / 2 + 0.5) ? 1 : Math.max(Math.abs(cx - mx), Math.abs(cz - mz)) < half ? 2
      : spots.some(sp => Math.hypot(cx - sp.x, cz - sp.z) <= SPOT_R) ? 3 : 0
  }
  // trees: a scatter on the open meadow, thicker along the ridges; never on a path, the square, or near either
  const trees: Tree[] = []
  for (let b = 2; b < cn - 2; b += 2) for (let a = 2; a < cn - 2; a += 2) {
    const ja = a + Math.floor(hash(a, b) * 2), jb = b + Math.floor(hash(b, a) * 2)
    const k = jb * cn + ja, vk = jb * n + ja
    if (!land[k] || kind[k] !== 0 || dist[vk] < 12) continue
    const x = x0 + ja * C + C / 2, z = z0 + jb * C + C / 2, u = x - mx, v = z - mz
    const ridge = Math.exp(-((Math.min(Math.abs(u), Math.abs(v)) / 55) ** 2))
    if (hash(ja * 7, jb * 13) > 0.05 + 0.3 * ridge) continue
    trees.push({ x, y: h[vk], z, r: 1.3 + hash(ja, jb * 3) * 1.1, tall: 2.6 + hash(ja * 5, jb) * 2.4 })
  }
  return { x0, z0, n, h, land, kind, island, trees }
}

/** The meadow's ground at (x,z), or −Infinity off it (an island's own ground is plot.ts's; the void is the fall). Same
 *  triangulation as the mesh, so what you see is what you stand on. */
export function meadowHeightAt(m: Meadow, x: number, z: number): number {
  const fx = (x - m.x0) / MEADOW_CELL, fz = (z - m.z0) / MEADOW_CELL, a = Math.floor(fx), b = Math.floor(fz), cn = m.n - 1
  if (a < 0 || b < 0 || a >= cn || b >= cn || !m.land[b * cn + a]) return -Infinity
  const u = fx - a, v = fz - b, n = m.n
  const h00 = m.h[b * n + a], h10 = m.h[b * n + a + 1], h01 = m.h[(b + 1) * n + a], h11 = m.h[(b + 1) * n + a + 1]
  return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
}
export const meadowVertex = (m: Meadow, x: number, z: number) => {
  const a = Math.round((x - m.x0) / MEADOW_CELL), b = Math.round((z - m.z0) / MEADOW_CELL)
  return a >= 0 && b >= 0 && a < m.n && b < m.n ? m.h[b * m.n + a] : NaN
}
