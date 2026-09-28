// ★ PURE. Rune Hold's ground as ONE smooth surface (Alex, 2026-09-28: "id like to make the terrain smoother … rn the
// sides of the steps have a holographic sheen to them").
//
// WHY THE SHEEN: every floor cell was drawn as a solid column (`FloorTerrain`), and the town laid a riser box on each
// terrace step whose side faces sat EXACTLY on the column's side faces — two surfaces in one place, flickering
// between each other (z-fighting). The terraces are quarter-tier RAMPS by design (`rune-hold-terraces.ts`), so the
// honest drawing of them is a slope, not a staircase of columns.
//
// THE SURFACE: a heightfield whose vertices sit at CELL CENTRES at the cell's own height, bilinear between — the
// same sampling `Townsfolk.groundY` already walks people on, so their feet land on what is drawn. A half-cell ring
// round the map edge carries the border cells out to their edges, and a skirt drops from there so the town never
// shows a paper edge. The walker's collision is unchanged (per cell, eased), so a keeper's feet sit within half a
// quarter-step of the drawn slope.
import { PATH, BUILDING } from './rune-hold-look'

/** the meadow tile id in the town grid */
export const MEADOW = 97
/** tiles the town draws as smooth ground; `ZoneGeometry` skips its stepped columns for these (outside the editor) */
export const SMOOTH_TILES: ReadonlySet<number> = new Set([PATH, MEADOW])
export const isSmooth = (v: number | undefined): boolean => v !== undefined && v >= 0 && SMOOTH_TILES.has(v & 0xff)

/** how far the ground sits above the cell height — just over the old flat-plane lift, so nothing pokes through */
export const GROUND_LIFT = 0.03
/** the skirt at the map edge drops to the columns' old floor */
export const SKIRT_Y = -1

export interface GroundMesh { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; quads: number }

/**
 * The town's smooth ground. `heights[z][x]` in tier units (STEP = 1 in play3d). Lattice points are cell centres
 * plus a half-cell border ring; a quad is drawn when any of the cells it touches is smooth ground.
 */
export function groundMesh(g: number[][], heights: number[][] | undefined): GroundMesh {
  const rows = g.length, cols = g[0]?.length ?? 0
  // lattice coordinates: index 0 = x -0.5, 1..cols = cell centres 0..cols-1, cols+1 = cols-0.5
  const LX = cols + 2, LZ = rows + 2
  const cellH = (x: number, z: number): number => {
    const cx = Math.min(cols - 1, Math.max(0, x)), cz = Math.min(rows - 1, Math.max(0, z))
    const v = g[cz]?.[cx]
    // a building or a void borrows the height of its smooth neighbours so the slope does not dive into it
    if (v === undefined || v < 0 || (v & 0xff) === BUILDING) {
      let sum = 0, n = 0
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const w = g[cz + dz]?.[cx + dx]
        if (isSmooth(w)) { sum += heights?.[cz + dz]?.[cx + dx] ?? 0; n++ }
      }
      if (n) return sum / n
    }
    return heights?.[cz]?.[cx] ?? 0
  }
  const lx = (i: number) => (i === 0 ? -0.5 : i === LX - 1 ? cols - 0.5 : i - 1)
  const lz = (j: number) => (j === 0 ? -0.5 : j === LZ - 1 ? rows - 0.5 : j - 1)
  const cellOf = (i: number, n: number) => Math.min(n - 1, Math.max(0, i - 1))

  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const vid = new Int32Array(LX * LZ).fill(-1)
  const vert = (i: number, j: number): number => {
    const k = j * LX + i
    if (vid[k] >= 0) return vid[k]
    const x = lx(i), z = lz(j)
    const y = cellH(cellOf(i, cols), cellOf(j, rows)) + GROUND_LIFT
    vid[k] = pos.length / 3
    pos.push(x, y, z)
    uv.push((x + 0.5) / cols, 1 - (z + 0.5) / rows)
    return vid[k]
  }
  let quads = 0
  for (let j = 0; j < LZ - 1; j++) for (let i = 0; i < LX - 1; i++) {
    // the cells this quad overlaps (a border quad overlaps only the edge cells)
    const cs = [[cellOf(i, cols), cellOf(j, rows)], [cellOf(i + 1, cols), cellOf(j, rows)], [cellOf(i, cols), cellOf(j + 1, rows)], [cellOf(i + 1, cols), cellOf(j + 1, rows)]]
    if (!cs.some(([x, z]) => isSmooth(g[z]?.[x]))) continue
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1)
    idx.push(a, c, b, b, c, d)   // counter-clockwise seen from above (+Y)
    quads++
  }
  // the skirt: every border edge that carries ground drops to SKIRT_Y, faces outward
  const skirt = (i0: number, j0: number, i1: number, j1: number) => {
    const t0 = vid[j0 * LX + i0], t1 = vid[j1 * LX + i1]
    if (t0 < 0 || t1 < 0) return
    const b0 = pos.length / 3; pos.push(pos[t0 * 3], SKIRT_Y, pos[t0 * 3 + 2]); uv.push(uv[t0 * 2], uv[t0 * 2 + 1])
    const b1 = pos.length / 3; pos.push(pos[t1 * 3], SKIRT_Y, pos[t1 * 3 + 2]); uv.push(uv[t1 * 2], uv[t1 * 2 + 1])
    idx.push(t0, b0, t1, t1, b0, b1)
  }
  for (let i = 0; i < LX - 1; i++) { skirt(i + 1, 0, i, 0); skirt(i, LZ - 1, i + 1, LZ - 1) }
  for (let j = 0; j < LZ - 1; j++) { skirt(0, j, 0, j + 1); skirt(LX - 1, j + 1, LX - 1, j) }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), indices: new Uint32Array(idx), quads }
}

/** The drawn ground height at a world point — the bilinear the mesh interpolates (for props that must sit on it). */
export function groundHeight(g: number[][], heights: number[][] | undefined, x: number, z: number): number {
  const rows = g.length, cols = g[0]?.length ?? 0
  const at = (cx: number, cz: number) => heights?.[Math.min(rows - 1, Math.max(0, cz))]?.[Math.min(cols - 1, Math.max(0, cx))] ?? 0
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0
  return (at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx) * (1 - fz) + (at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx) * fz + GROUND_LIFT
}
