// ── THE NYX CONTINENT AS A BUILDER MAP (BETA M83 s3) ──
// The continent is ONE exported region (public/open/continent.{json,bin.gz}: a 5 m grid, 2335 x 1567 vertices, 11.7 x 7.8 km,
// origin at its centre). Far too big for one editor tile, so the builder cuts it into VIRTUAL 1 km tiles on the Wilds' own grid
// (tile (tx, ty) is centred on (tx * 1000, ty * 1000), the same tileOf as wilds-world), each 200 cells x 5 m = 201 x 201
// vertices that ARE region vertices (no resampling: tile vertex (a, b) = region vertex (i0 + a, j0 + b)). That makes the
// continent's layer the exact shape of a Wilds layer ({ tiles: { 'nyx_<tx>_<ty>': {k: dm} }, water, falls }), so the whole
// engine (brush, undo, the draft store, publish / roll back, the Fly view, the 3x3 ring) works on it unchanged.
//   · the region's half-sizes are odd multiples of 5 m off a 1 km line (5835 / 3915 m), so every tile edge lands on a region
//     vertex; nyx-builder.test.ts fails if a re-export ever breaks that.
//   · tile vertices past the region's edge are void (h = NYX_VOID_Y, voidV = 1): the brush skips them, Fly drops them.
//   · neighbouring tiles share their edge vertices (as Wilds tiles do); the brush writes both, the game takes one.
// The game applies the published layer to the region's heights on load (open/continent/nyx-layer.ts).
// Pure; nyx-builder.test.ts.
import type { BrushTile } from '../open/ather/wilds-edits'

export const NYX_REGION = 'continent'
export const NYX_TILE_M = 1000
export const NYX_PREFIX = 'nyx_'
/** the continent's sea surface (continent/page.tsx › Water; rinning-nyx.ts NYX_WATER_Y) */
export const NYX_WATER_Y = -0.15
export const NYX_VOID_Y = NYX_WATER_Y - 30

export interface NyxMeta { cell: number; nx: number; nz: number; sizeX: number; sizeZ: number }
export interface NyxTileRef { name: string; tx: number; ty: number; land: number }

export const nyxTileName = (tx: number, ty: number) => `${NYX_PREFIX}${tx}_${ty}`
export function parseNyxTile(name: string): { tx: number; ty: number } | null {
  const m = /^nyx_(-?\d+)_(-?\d+)$/.exec(name); return m ? { tx: Number(m[1]), ty: Number(m[2]) } : null
}
/** vertices per tile side (201 at 5 m) */
export const nyxN = (m: NyxMeta) => Math.round(NYX_TILE_M / m.cell) + 1
/** region vertex of tile (tx, ty)'s vertex (0, 0); NaN-free only when the grid lines up (the test pins it) */
export const nyxOrigin = (m: NyxMeta, tx: number, ty: number) => ({
  i0: Math.round((tx * NYX_TILE_M - NYX_TILE_M / 2 + m.sizeX / 2) / m.cell),
  j0: Math.round((ty * NYX_TILE_M - NYX_TILE_M / 2 + m.sizeZ / 2) / m.cell),
})
/** true when every tile edge lands exactly on a region vertex */
export const nyxAligned = (m: NyxMeta) => {
  const fx = (-NYX_TILE_M / 2 + m.sizeX / 2) / m.cell, fz = (-NYX_TILE_M / 2 + m.sizeZ / 2) / m.cell
  return Math.abs(fx - Math.round(fx)) < 1e-6 && Math.abs(fz - Math.round(fz)) < 1e-6 && Math.abs(NYX_TILE_M / m.cell - Math.round(NYX_TILE_M / m.cell)) < 1e-6
}
export function nyxBrushTile(m: NyxMeta, tx: number, ty: number): BrushTile {
  const n = nyxN(m), size = (n - 1) * m.cell
  return { name: nyxTileName(tx, ty), ox: tx * NYX_TILE_M, oz: ty * NYX_TILE_M, nx: n, nz: n, cell: m.cell, sizeX: size, sizeZ: size }
}

/** every tile the region touches, with its land share (vertices above the sea), row by row */
export function nyxTiles(m: NyxMeta, h: Float32Array): NyxTileRef[] {
  const n = nyxN(m), out: NyxTileRef[] = []
  const t0 = Math.floor((-m.sizeX / 2 + NYX_TILE_M / 2) / NYX_TILE_M), t1 = Math.ceil((m.sizeX / 2 - NYX_TILE_M / 2) / NYX_TILE_M)
  const u0 = Math.floor((-m.sizeZ / 2 + NYX_TILE_M / 2) / NYX_TILE_M), u1 = Math.ceil((m.sizeZ / 2 - NYX_TILE_M / 2) / NYX_TILE_M)
  for (let ty = u0; ty <= u1; ty++) for (let tx = t0; tx <= t1; tx++) {
    const { i0, j0 } = nyxOrigin(m, tx, ty)
    let land = 0
    for (let b = 0; b < n; b += 4) for (let a = 0; a < n; a += 4) {
      const i = i0 + a, j = j0 + b
      if (i >= 0 && j >= 0 && i < m.nx && j < m.nz && h[j * m.nx + i] > NYX_WATER_Y) land++
    }
    const tot = Math.ceil(n / 4) ** 2
    out.push({ name: nyxTileName(tx, ty), tx, ty, land: land / tot })
  }
  return out
}

/** The bare base of one tile (no edits), row-major k = b * N + a. Off-region vertices: NYX_VOID_Y + voidV; `voided` = the cells
 *  (k = b * (N-1) + a) with any void corner, as the editor's water-cell index. */
export function sampleNyxTile(m: NyxMeta, h: Float32Array, tx: number, ty: number): { h: Float32Array; voidV: Uint8Array | undefined; voided: Uint8Array } {
  const N = nyxN(m), { i0, j0 } = nyxOrigin(m, tx, ty), out = new Float32Array(N * N), voidV = new Uint8Array(N * N), voided = new Uint8Array((N - 1) * (N - 1))
  let any = false
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
    const i = i0 + a, j = j0 + b, k = b * N + a
    if (i >= 0 && j >= 0 && i < m.nx && j < m.nz) out[k] = h[j * m.nx + i]; else { out[k] = NYX_VOID_Y; voidV[k] = 1; any = true }
  }
  if (any) for (let b = 0; b < N - 1; b++) for (let a = 0; a < N - 1; a++)
    voided[b * (N - 1) + a] = voidV[b * N + a] | voidV[b * N + a + 1] | voidV[(b + 1) * N + a] | voidV[(b + 1) * N + a + 1]
  return { h: out, voidV: any ? voidV : undefined, voided }
}

/** THE GAME'S HALF: add a published layer's height deltas (dm) to the region's heights IN PLACE (the Region's heightAt /
 *  groundAt / mesh all read this array). A vertex two tiles share takes one value (the brush writes both the same). Tiles that
 *  are not nyx_ tiles are ignored. Returns how many region vertices moved. */
export function applyNyxLayer(m: NyxMeta, h: Float32Array, tiles: Record<string, Record<string, number>> | null | undefined): number {
  if (!tiles || !nyxAligned(m)) return 0
  const N = nyxN(m), d = new Map<number, number>()
  for (const [name, E] of Object.entries(tiles)) {
    const t = parseNyxTile(name); if (!t || !E) continue
    const { i0, j0 } = nyxOrigin(m, t.tx, t.ty)
    for (const [ks, dm] of Object.entries(E)) {
      const k = Number(ks); if (!Number.isInteger(k) || k < 0 || k >= N * N || !Number.isFinite(dm)) continue
      const i = i0 + (k % N), j = j0 + Math.floor(k / N)
      if (i < 0 || j < 0 || i >= m.nx || j >= m.nz) continue
      d.set(j * m.nx + i, dm / 10)
    }
  }
  for (const [r, dy] of d) h[r] += dy
  return d.size
}
