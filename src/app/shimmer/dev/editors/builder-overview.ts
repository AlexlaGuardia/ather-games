// ── BETA M83: THE BUILDER'S WHOLE-MAP OVERVIEW (pure; drawn under the tile editor by TerrainEditor) ──────────────────────────
// Alex 11-23: "a reference image under the map I'm editing so I can see the whole thing with the slice I'm viewing highlighted".
// Every tile of the selected map at OV px a side, shaded from the same heights the tile view sculpts (+ the draft's edits),
// laid on the tile grid (tx right, ty down, like the tile view's +x / +z). Click a pixel -> the tile under it.
// Run the test: npx tsx src/app/shimmer/dev/editors/builder-overview.test.ts
import { ramp } from './terrain-ramp'

export interface OvTile { name: string; tx: number; ty: number }
/** one tile's heights: `at(i, j)` = the bare ground at vertex (i, j) of its nx x nz grid (NaN = void, nothing there) */
export interface OvSource { nx: number; nz: number; at(i: number, j: number): number }
export interface OvLayout { tx0: number; ty0: number; cols: number; rows: number; px: number; w: number; h: number }

export function overviewLayout(tiles: OvTile[], px: number): OvLayout {
  if (!tiles.length) return { tx0: 0, ty0: 0, cols: 0, rows: 0, px, w: 0, h: 0 }
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity
  for (const t of tiles) { a = Math.min(a, t.tx); b = Math.max(b, t.tx); c = Math.min(c, t.ty); d = Math.max(d, t.ty) }
  const cols = b - a + 1, rows = d - c + 1
  return { tx0: a, ty0: c, cols, rows, px, w: cols * px, h: rows * px }
}

/** the tile under image pixel (x, y), or undefined (off the grid, or a grid cell the map has no tile in) */
export function tileAtPixel(L: OvLayout, tiles: OvTile[], x: number, y: number): OvTile | undefined {
  if (!(x >= 0 && y >= 0 && x < L.w && y < L.h)) return undefined
  const tx = L.tx0 + Math.floor(x / L.px), ty = L.ty0 + Math.floor(y / L.px)
  return tiles.find(t => t.tx === tx && t.ty === ty)
}
/** a tile's box in the image, as fractions 0..1 of its width / height (the overlay draws the highlight with it) */
export function tileBox(L: OvLayout, t: { tx: number; ty: number }): { x: number; y: number; w: number; h: number } {
  return { x: (t.tx - L.tx0) / L.cols, y: (t.ty - L.ty0) / L.rows, w: 1 / L.cols, h: 1 / L.rows }
}

/** The image's ground: one height per pixel (NaN = void inside a tile, NO_TILE = a grid cell with no tile: open sea). A pixel's base is its centre vertex; the draft's edits are the
 *  MEAN of the deltas over the pixel's block of vertices, so a small sculpt still moves the pixel instead of hiding between
 *  samples. `edited` marks pixels with any edit (the tint). */
export const NO_TILE = -1e6
export function overviewHeights(L: OvLayout, tiles: OvTile[], src: (t: OvTile) => OvSource | null, edits: (name: string) => Record<string, number> | undefined): { H: Float32Array; edited: Uint8Array; drawn: number } {
  const H = new Float32Array(L.w * L.h).fill(NO_TILE), edited = new Uint8Array(L.w * L.h), P = L.px
  let drawn = 0
  for (const t of tiles) {
    const S = src(t); if (!S) continue
    drawn++
    const { nx, nz } = S, X0 = (t.tx - L.tx0) * P, Y0 = (t.ty - L.ty0) * P
    const pi = (i: number) => Math.min(P - 1, Math.floor(i / nx * P)), pj = (j: number) => Math.min(P - 1, Math.floor(j / nz * P))
    const E = edits(t.name), sum = E ? new Float32Array(P * P) : null, cnt = E ? new Float32Array(P * P) : null
    if (E && sum && cnt) {
      // vertices per pixel block (exact: the same floor mapping counted)
      const ci = new Float32Array(P), cj = new Float32Array(P)
      for (let i = 0; i < nx; i++) ci[pi(i)]++
      for (let j = 0; j < nz; j++) cj[pj(j)]++
      for (let q = 0; q < P; q++) for (let p = 0; p < P; p++) cnt[q * P + p] = ci[p] * cj[q]
      for (const [ks, d] of Object.entries(E)) {
        const k = Number(ks); if (!Number.isInteger(k) || k < 0 || k >= nx * nz || !d) continue
        sum[pj(Math.floor(k / nx)) * P + pi(k % nx)] += d / 10
      }
    }
    for (let q = 0; q < P; q++) for (let p = 0; p < P; p++) {
      const i = Math.min(nx - 1, Math.round((p + 0.5) / P * (nx - 1))), j = Math.min(nz - 1, Math.round((q + 0.5) / P * (nz - 1)))
      let h = S.at(i, j)
      const o = (Y0 + q) * L.w + X0 + p
      if (sum && cnt && sum[q * P + p] !== 0) { h += sum[q * P + p] / cnt[q * P + p]; edited[o] = 1 }
      H[o] = h
    }
  }
  return { H, edited, drawn }
}

const SEA: [number, number, number] = [0.13, 0.25, 0.40], NONE: [number, number, number] = [0.06, 0.07, 0.10]
/** shaded relief into RGBA (the tile view's look: ramp above the water line, deep blue below, voids dark), edits tinted warm */
export function overviewRGBA(L: OvLayout, H: Float32Array, edited: Uint8Array, waterY: number, tint = true): Uint8ClampedArray {
  const px = new Uint8ClampedArray(L.w * L.h * 4), cell = 1000 / L.px, Lt = [-0.55, -0.55, 0.63]
  const at = (x: number, y: number, d: number) => { const v = H[Math.min(L.h - 1, Math.max(0, y)) * L.w + Math.min(L.w - 1, Math.max(0, x))]; return Number.isFinite(v) && v > NO_TILE ? v : d }
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const o = y * L.w + x, h = H[o]
    let r: number, g: number, b: number
    if (h === NO_TILE) [r, g, b] = SEA
    else if (!Number.isFinite(h)) [r, g, b] = NONE
    else if (h < waterY) { const d = Math.min(1, (waterY - h) / 12); r = 0.30 - 0.17 * d; g = 0.52 - 0.27 * d; b = 0.72 - 0.32 * d }
    else {
      const gx = (at(x + 1, y, h) - at(x - 1, y, h)) / (2 * cell), gz = (at(x, y + 1, h) - at(x, y - 1, h)) / (2 * cell), n = 1 / Math.hypot(gx, gz, 1)
      const shade = Math.max(0.3, Math.min(1.3, 0.55 + 0.9 * ((-gx * Lt[0] - gz * Lt[1] + Lt[2]) * n - 0.4)))
      ;[r, g, b] = ramp(h - waterY); r *= shade; g *= shade; b *= shade
    }
    if (tint && edited[o]) { r += (1 - r) * 0.35; g += (0.55 - g) * 0.2; b *= 0.75 }
    px[o * 4] = r * 255; px[o * 4 + 1] = g * 255; px[o * 4 + 2] = b * 255; px[o * 4 + 3] = 255
  }
  return px
}
