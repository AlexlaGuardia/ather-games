// THE ATHER'S MAP PLATE (Alex 11-15: "im a big fan of how the minimap on the nyx side turned out, especially the
// actual look of the map.. is there any way we could do something similar for the ather?"). The continent's plate is
// relief washed into parchment: heights to colour, light from the north-west, contours, a paper grain. This is the same
// recipe for a Wilds tile, in the Ather's palette:
//   • colour by BIOME, in the hues of the Atlas's Ather face (continent/map.tsx ATHER_BANDS, from
//     athernyx/assets/maps/atlas/gen_ather_relief.py): water blue, meadow lime, woods green, shore gold, rock lavender.
//     (A tile's relief is ~35 m, inside one of the Atlas's height bands, so height alone would paint it one colour.)
//   • light from the north-west, stepped to quarters: the Ather is quantized (shimmer-geography.md), and so is its map
//   • a contour every CONTOUR m, a darker line in the land's own hue (sepia would be the mortal map's ink)
//   • the tile's real trees as canopy dots, so the woods read as woods and match what you walk through
//   • a soft cloud grain where the parchment has paper grain
//
// ★ PURE: returns RGBA pixels, so it tests under node. ather/minimap.tsx and the fold map draw it onto canvases.

import { BIOME, type BiomeId, type Wilds } from './wilds'
import { SQ, GRID_HALF, PLOT_R, insideIsland, plotHeightAt, sqId, squareAt } from './plot'

export const PLATE_MPP = 2          // metres per plate pixel (a 1 km tile = 500 px)
export const CONTOUR = 4            // metres between contour lines

/** The Atlas's Ather hues, assigned by biome. */
export const ATHER_HUE: Record<BiomeId, [number, number, number]> = {
  0: [92, 112, 178],    // water
  1: [214, 196, 128],   // shore
  2: [170, 206, 120],   // meadow
  3: [126, 196, 132],   // woods
  4: [176, 150, 196],   // rock
}

export function atherPlatePixels(W: Wilds, mpp = PLATE_MPP): { w: number; h: number; px: Uint8ClampedArray } {
  const sx = W.meta.sizeX, sz = W.meta.sizeZ, w = Math.round(sx / mpp), h = Math.round(sz / mpp)
  const px = new Uint8ClampedArray(w * h * 4)
  const X = (i: number) => -sx / 2 + (i + 0.5) * mpp, Z = (j: number) => -sz / 2 + (j + 0.5) * mpp
  const hgt = new Float32Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) hgt[j * w + i] = W.heightAt(X(i), Z(j))
  const H = (i: number, j: number) => hgt[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))]
  const wy = W.meta.waterY
  const biomeOf = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) biomeOf[j * w + i] = W.biomeAt(X(i), Z(j))
  const B = (i: number, j: number) => biomeOf[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))]
  const S = 3   // the light reads the slope over ±S px (12 m): a tile's relief is gentle, a 1-px slope is noise
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const y = H(i, j), b = B(i, j)
    let [r, g, bl] = ATHER_HUE[b as BiomeId]
    if (b === BIOME.water || y < wy) {
      // the shallows pale toward the shore, like the parchment's coast, but they GLOW (the Ather's water is lit);
      // faint depth lines every metre where the parchment draws none
      const depth = wy - y, t = Math.min(1, depth / 2.5)
      ;[r, g, bl] = ATHER_HUE[0]; r += (1 - t) * 64; g += (1 - t) * 74; bl += (1 - t) * 52
      if (Math.floor(depth) !== Math.floor(wy - H(i + 1, j)) && depth > 0.3) { r += 14; g += 16; bl += 18 }
    } else {
      // north-west light, stepped to eighths: quantized (the Ather is), but fine enough that the land still reads
      const dx = H(i + S, j) - H(i - S, j), dz = H(i, j + S) - H(i, j - S)
      const k = Math.round(Math.max(0.66, Math.min(1.24, 1 - (dx + dz) * 0.16)) * 8) / 8
      r *= k; g *= k; bl *= k
      const band = Math.floor(y / CONTOUR)
      if (Math.floor(H(i + 1, j) / CONTOUR) !== band || Math.floor(H(i, j + 1) / CONTOUR) !== band) { r *= 0.84; g *= 0.86; bl *= 0.9 }
      // where two countries meet (meadow / woods / shore), a soft seam
      if (B(i + 1, j) !== b || B(i, j + 1) !== b) { r *= 0.9; g *= 0.92; bl *= 0.94 }
    }
    // lift toward the Ather's pale glow (CLOUD #e9edf8), then a soft cloud grain
    r += (233 - r) * 0.14; g += (237 - g) * 0.14; bl += (248 - bl) * 0.14
    const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, grain = 0.985 + (n - Math.floor(n)) * 0.025
    const o = (j * w + i) * 4
    px[o] = r * grain; px[o + 1] = g * grain; px[o + 2] = bl * grain; px[o + 3] = 255
  }
  // canopy: each real tree a painted crown, lit from the north-west, its shadow to the south-east
  const paint = (ci: number, cj: number, rr: number, f: (d: number, nx: number, ny: number) => number) => {
    for (let dj = -Math.ceil(rr); dj <= Math.ceil(rr); dj++) for (let di = -Math.ceil(rr); di <= Math.ceil(rr); di++) {
      const i = Math.round(ci + di), j = Math.round(cj + dj), d = Math.hypot(di, dj) / rr
      if (i < 0 || j < 0 || i >= w || j >= h || d > 1) continue
      const k = f(d, di / rr, dj / rr), o = (j * w + i) * 4
      px[o] *= k; px[o + 1] *= k; px[o + 2] *= k
    }
  }
  const trees = [...W.trees].sort((a, b) => a.z - b.z)
  for (const t of trees) {   // shadows first, so a crown never sits under its neighbour's shadow
    const rr = Math.max(2, t.r / mpp * 1.6)   // crowns overlap into one canopy (1-px crowns read as salt and pepper)
    paint((t.x + sx / 2) / mpp + rr * 0.45, (t.z + sz / 2) / mpp + rr * 0.45, rr, d => 0.95 + d * 0.05)
  }
  for (const t of trees) {
    const rr = Math.max(2, t.r / mpp * 1.6)   // crowns overlap into one canopy (1-px crowns read as salt and pepper)
    paint((t.x + sx / 2) / mpp, (t.z + sz / 2) / mpp, rr, (d, nx, ny) => {
      const lit = -(nx + ny) * 0.5   // toward the north-west = brighter
      return d > 0.86 ? 0.93 : 0.97 + lit * 0.09
    })
  }
  return { w, h, px }
}

/** Browser: the plate on a canvas (cached per tile by the caller). */
export function atherPlateCanvas(W: Wilds): HTMLCanvasElement {
  const { w, h, px } = atherPlatePixels(W)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h)
  img.data.set(px); ctx.putImageData(img, 0, 0)
  return c
}
const cache = new Map<string, HTMLCanvasElement>()
export function atherPlate(W: Wilds): HTMLCanvasElement {
  let c = cache.get(W.meta.name)
  if (c) { cache.delete(W.meta.name); cache.set(W.meta.name, c); return c }   // most recent last
  c = atherPlateCanvas(W); cache.set(W.meta.name, c)
  while (cache.size > 12) cache.delete(cache.keys().next().value!)   // a roaming keeper keeps ~12 MB of plates, not 67
  return c
}

// ── THE HOME PLOT'S PLATE (Alex 11-15: "next up maybe the homeplots map") ─────────────────────────────────────────
// The same recipe on the island: the void around it (DEEP, star-flecked, map-kit's ATHER_CLOUD), a lit rim where the
// island falls away, meadow in the Atlas hue with north-west light and 1 m contours, and the garden grid: your squares
// in full colour, the rest under the fold-mist (the cloud colour) with faint seams so the 9×9 reads. Gate and Gregory
// are drawn by the minimap on top (they are places, not ground).


export const PLOT_MPP = 0.5
export const PLOT_EXTENT = PLOT_R + 14   // metres from the centre the plate covers (island + a margin of void)

export function plotPlatePixels(owned: ReadonlySet<string>, mpp = PLOT_MPP): { w: number; h: number; px: Uint8ClampedArray; extent: number } {
  const E = PLOT_EXTENT, w = Math.round((E * 2) / mpp), h = w
  const px = new Uint8ClampedArray(w * h * 4)
  const X = (i: number) => -E + (i + 0.5) * mpp, Z = (j: number) => -E + (j + 0.5) * mpp
  const S = 4
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = X(i), z = Z(j), o = (j * w + i) * 4
    let r: number, g: number, b: number
    if (!insideIsland(x, z)) {
      // the void: deep, with a few stars; a soft glow hugs the island's edge (the fold's light spilling over)
      const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, f = n - Math.floor(n)
      r = 8; g = 6; b = 20
      if (f > 0.9965) { r = g = 200; b = 230 }
      let edge = 0; for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [4, 0], [-4, 0], [0, 4], [0, -4]]) if (insideIsland(x + dx, z + dz)) edge = Math.max(edge, Math.abs(dx) === 2 || Math.abs(dz) === 2 ? 1 : 0.5)
      r += edge * 60; g += edge * 62; b += edge * 80
    } else {
      const y = plotHeightAt(x, z)
      ;[r, g, b] = ATHER_HUE[2]
      const dx = plotHeightAt(x + S * mpp, z) - plotHeightAt(x - S * mpp, z), dz = plotHeightAt(x, z + S * mpp) - plotHeightAt(x, z - S * mpp)
      const k = Math.round(Math.max(0.7, Math.min(1.25, 1 - (dx + dz) * 0.35)) * 8) / 8
      r *= k; g *= k; b *= k
      const band = Math.floor(y), bx = Math.floor(plotHeightAt(x + mpp, z)), bz = Math.floor(plotHeightAt(x, z + mpp))
      if (bx !== band || bz !== band) { r *= 0.86; g *= 0.88; b *= 0.92 }
      // the rim: the last metre before the fall, lit
      let rim = false; for (const [ex, ez] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (!insideIsland(x + ex, z + ez)) rim = true
      if (rim) { r += 40; g += 42; b += 40 }
      // the garden grid: yours in colour, the rest under the fold-mist
      const sq = squareAt(x, z)
      if (sq) {
        const mine = owned.has(sqId(sq.i, sq.j))
        if (!mine) { r += (233 - r) * 0.62; g += (237 - g) * 0.62; b += (248 - b) * 0.62 }
        const lx = (x + GRID_HALF) % SQ, lz = (z + GRID_HALF) % SQ
        if (lx < mpp * 1.2 || lz < mpp * 1.2) { const s = mine ? 0.86 : 0.93; r *= s; g *= s; b *= s }
      }
      r += (233 - r) * 0.1; g += (237 - g) * 0.1; b += (248 - b) * 0.1
      const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, grain = 0.985 + (n - Math.floor(n)) * 0.025
      r *= grain; g *= grain; b *= grain
    }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255
  }
  return { w, h, px, extent: E }
}
const plotCache = new Map<string, HTMLCanvasElement>()
/** Browser: the home plate on a canvas, cached per set of owned squares. */
export function plotPlate(owned: ReadonlySet<string>): { canvas: HTMLCanvasElement; extent: number } {
  const key = [...owned].sort().join('|')
  let c = plotCache.get(key)
  if (!c) {
    const { w, h, px } = plotPlatePixels(owned)
    c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h); img.data.set(px); ctx.putImageData(img, 0, 0)
    plotCache.clear(); plotCache.set(key, c)
  }
  return { canvas: c, extent: PLOT_EXTENT }
}
