// WHERE THE EDGE CLOUDS STAND (BETA M24; the look + the canon note live in shared/cloud-edge.tsx). Pure layouts, tested.
//   plotEdgePuffs()  the home island: pillows banked round its rim and hanging under it (the cloud-ocean held back), the
//                    fall kept (Alex 11-18): they sit OUTSIDE and BELOW the land, never on it, so the edge still drops you
//   plotFarPuffs()   loose puffs out in the void round the island (what PlotScene drew as 34 separate meshes)
import { PLOT_N, PLOT_CELL, PLOT_HALF, PLOT_R, plotCellIsLand, plotVertexHeight } from './plot'
import { pillowsAlong, hash, type Puff } from '../shared/cloud-layout'

/** the cloud-ocean's surface under the island (PlotScene's floor) */
export const PLOT_SEA_Y = -56

/** Rim points of the island: the outer edge of every land cell with open sky beside it, every `step` cells along. */
export function islandRim(step = 2): { x: number; z: number; nx: number; nz: number; y: number }[] {
  const out: { x: number; z: number; nx: number; nz: number; y: number }[] = []
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
  for (let j = 0; j < PLOT_N; j++) for (let i = 0; i < PLOT_N; i++) {
    if (!plotCellIsLand(i, j) || (i + j) % step) continue
    for (const [di, dj] of dirs) {
      if (plotCellIsLand(i + di, j + dj)) continue
      // the cell's edge toward the open side, at its height (the two vertices on that side, averaged)
      const cx = (i + 0.5) * PLOT_CELL - PLOT_HALF, cz = (j + 0.5) * PLOT_CELL - PLOT_HALF
      const vi = di > 0 ? i + 1 : i, vj = dj > 0 ? j + 1 : j
      const y = di ? (plotVertexHeight(vi, j) + plotVertexHeight(vi, j + 1)) / 2 : (plotVertexHeight(i, vj) + plotVertexHeight(i + 1, vj)) / 2
      // the outward normal is the RADIAL one blended in, so pillows on a ragged cell edge still face away from the middle
      const r = Math.hypot(cx, cz) || 1, nx = di * 0.5 + (cx / r) * 0.5, nz = dj * 0.5 + (cz / r) * 0.5, nl = Math.hypot(nx, nz) || 1
      out.push({ x: cx + di * PLOT_CELL / 2, z: cz + dj * PLOT_CELL / 2, nx: nx / nl, nz: nz / nl, y })
      break
    }
  }
  return out
}

/** Pillows banked on the rim (pushed out past the land so the edge still falls) + a hanging layer under the island. */
export function plotEdgePuffs(): Puff[] {
  const rim = islandRim()
  // small and LOW: their heads just reach the rim, so from the land you look over a fringe of cloud, not into a wall
  const banks = pillowsAlong(rim, 3.6, 3)
  // the underside: the island hangs IN the cloud, so a ring of big soft ones under the rim and a few under the middle
  const under: Puff[] = rim.filter((_, k) => k % 3 === 0).map(p => ({ x: p.x * 0.88, y: p.y - 14 - hash(p.x, p.z) * 8, z: p.z * 0.88, s: 11 + hash(p.z, p.x) * 6, sy: 0.55 }))
  for (let k = 0; k < 10; k++) { const a = k * 2.399, r = PLOT_R * 0.45 * Math.sqrt((k + 0.5) / 10); under.push({ x: Math.cos(a) * r, y: -16 - (k % 3) * 3, z: Math.sin(a) * r, s: 16, sy: 0.5 }) }
  return [...banks, ...under]
}

/** Loose puffs out in the void round the island, sitting on the cloud sea (deterministic). */
export function plotFarPuffs(n = 60): Puff[] {
  return Array.from({ length: n }, (_, k) => {
    const a = k * 2.399, r = PLOT_R + 25 + (k * 37 % 220)
    return { x: Math.cos(a) * r, y: PLOT_SEA_Y + 4 + (k * 13 % 14), z: Math.sin(a) * r, s: 9 + (k * 7 % 14), sy: 0.5 + (k % 4) * 0.08 }
  })
}

// ── THE WILDS: the sea turns to cloud (Alex 11-18: walk to the edge and look out) ──────────────────────────────────
/** Pillow reefs riding the open sea: the sea tiles (less than SEA_LAND land) and everything past the map, in a window
 *  round (cx, cz). A 40 m lattice, hashed, so the same reefs stand for everyone; they thicken with distance from the land
 *  tiles so the sea reads as turning to cloud toward the horizon, never a wall in front of the shore. `land(tx, ty)` = that
 *  tile's land fraction (0 past the map). */
export const SEA_LAND = 0.2
export const REEF_CELL = 40, REEF_R = 460
export function wildsReefPuffs(cx: number, cz: number, land: (tx: number, ty: number) => number, seaY = 0, tileM = 1000): Puff[] {
  const isLand = (tx: number, ty: number) => land(tx, ty) >= SEA_LAND
  const out: Puff[] = []
  const i0 = Math.floor((cx - REEF_R) / REEF_CELL), i1 = Math.floor((cx + REEF_R) / REEF_CELL)
  const j0 = Math.floor((cz - REEF_R) / REEF_CELL), j1 = Math.floor((cz + REEF_R) / REEF_CELL)
  const tileOf = (v: number) => Math.floor((v + tileM / 2) / tileM)
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = (i + hash(i, j)) * REEF_CELL, z = (j + hash(j + 7, i - 3)) * REEF_CELL
    if (Math.hypot(x - cx, z - cz) > REEF_R) continue
    const tx = tileOf(x), ty = tileOf(z)
    if (isLand(tx, ty)) continue
    // how far past the land: the nearest land tile's edge, in metres (0 right at a land tile's side)
    let d = Infinity
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!isLand(tx + dx, ty + dy)) continue
      const ex = Math.max(0, Math.abs(x - (tx + dx) * tileM) - tileM / 2), ez = Math.max(0, Math.abs(z - (ty + dy) * tileM) - tileM / 2)
      d = Math.min(d, Math.hypot(ex, ez))
    }
    const thick = Number.isFinite(d) ? Math.min(1, d / 600) : 1   // open water near the shore, solid cloud far out
    if (hash(i * 1.3, j * 0.7) > 0.25 + thick * 0.6) continue
    const s = 6 + hash(i, j * 2.1) * 9 + thick * 8
    out.push({ x, y: seaY + s * 0.12, z, s, sy: 0.45 })
    if (thick > 0.3) out.push({ x: x + s * 0.7, y: seaY + s * 0.05, z: z - s * 0.4, s: s * 0.7, sy: 0.5 })
  }
  // nearest first: a buffer that cannot hold them all drops the FAR ones, never a hole beside the keeper
  return out.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))
}

/** The cloud deck: the 1 km squares PAST the map (not in the index) round the camera's tile, where no tile draws water. */
export function deckSquares(cx: number, cz: number, inIndex: (tx: number, ty: number) => boolean, tileM = 1000, reach = 2): { x: number; z: number }[] {
  const ctx = Math.floor((cx + tileM / 2) / tileM), cty = Math.floor((cz + tileM / 2) / tileM), out: { x: number; z: number }[] = []
  for (let ty = cty - reach; ty <= cty + reach; ty++) for (let tx = ctx - reach; tx <= ctx + reach; tx++) if (!inIndex(tx, ty)) out.push({ x: tx * tileM, z: ty * tileM })
  return out
}
