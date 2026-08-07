// Terrain profile — render the generator's country as a top-down map, so tuning is done by LOOKING.
//
// ★ WHY THIS SCRIPT EXISTS: the 2D generator once passed 27 asserts over a map of ruler-straight
// highways (WORLDGEN-RESEARCH's own lesson), and the first 3D pass measured "17 voxels of relief"
// that read on screen as a bowling green. Statistics pass; eyes catch. The oracles (height.test,
// biome.test) pin the claims; this renders them.
//
// Run: npx tsx scripts/terrain-profile.mts [--size 2048] [--stride 2] [--seed 1337] [--out path.png]
//
// Left panel: hypsometric height (blue water → green lowland → brown upland → white peaks).
// Right panel: biome labels (see LEGEND) with the grey band's dithered surface shown as generated —
// what you are judging on the right is literally `materialAt`'s surface answer, not a diagram.

import sharp from 'sharp'
import { columnHeight } from '../src/app/shimmer/voxel/height.ts'
import { biomeAt, greySurfaceAt, forestness, type BiomeId } from '../src/app/shimmer/voxel/biome.ts'
import { DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth.ts'
import { DEFAULT_SITES, siteAt } from '../src/app/shimmer/voxel/sites.ts'

const arg = (name: string, dflt: number): number => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const argS = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : dflt
}

const SIZE = arg('size', 2048)        // world units on a side
const STRIDE = arg('stride', 2)       // world units per pixel
const SEED = arg('seed', 1337)
const OUT = argS('out', 'terrain-profile.png')
const SEA = DEFAULT_DEPTH.seaLevel

const px = Math.floor(SIZE / STRIDE)
const W = px * 2 + 8                  // two panels + a divider
const H = px

const LEGEND: Record<BiomeId, [number, number, number]> = {
  basin: [47, 111, 158],
  shore: [216, 198, 145],
  greyfield: [131, 136, 123],
  crag: [235, 235, 240],
  highland: [151, 124, 83],
  woodland: [38, 99, 47],
  meadow: [110, 168, 74],
}

const img = new Uint8Array(W * H * 3)
const put = (x: number, y: number, r: number, g: number, b: number) => {
  const o = (y * W + x) * 3
  img[o] = r; img[o + 1] = g; img[o + 2] = b
}

let min = Infinity, max = -Infinity
const heights = new Int16Array(px * px)
for (let iz = 0; iz < px; iz++) {
  for (let ix = 0; ix < px; ix++) {
    const h = columnHeight(ix * STRIDE - SIZE / 2, iz * STRIDE - SIZE / 2, SEED)
    heights[iz * px + ix] = h
    if (h < min) min = h
    if (h > max) max = h
  }
}

const counts = new Map<string, number>()
for (let iz = 0; iz < px; iz++) {
  for (let ix = 0; ix < px; ix++) {
    const x = ix * STRIDE - SIZE / 2, z = iz * STRIDE - SIZE / 2
    const h = heights[iz * px + ix]

    // ── left: hypsometric ──────────────────────────────────────────────────────────────────────
    if (h <= SEA) {
      const d = Math.min(1, (SEA - h) / 30)
      put(ix, iz, 40 - d * 25, 90 - d * 50, 140 - d * 60)
    } else {
      const t = (h - SEA) / Math.max(1, max - SEA)
      let r: number, g: number, b: number
      if (t < 0.35) { const u = t / 0.35; r = 90 + u * 60; g = 150 + u * 20; b = 70 }
      else if (t < 0.7) { const u = (t - 0.35) / 0.35; r = 150 + u * 10; g = 170 - u * 60; b = 70 + u * 10 }
      else { const u = (t - 0.7) / 0.3; r = 160 + u * 90; g = 110 + u * 140; b = 80 + u * 170 }
      // hillshade off the local gradient so relief reads as relief
      const e = ix + 1 < px ? heights[iz * px + ix + 1] : h
      const s = iz + 1 < px ? heights[(iz + 1) * px + ix] : h
      const shade = Math.max(-30, Math.min(30, (h - e) * 4 + (h - s) * 4))
      put(ix, iz, Math.min(255, r + shade), Math.min(255, g + shade), Math.min(255, b + shade))
    }

    // ── right: biome labels, with the REAL dithered grey surface ───────────────────────────────
    const b = biomeAt(x, z, SEED, h, SEA)
    counts.set(b, (counts.get(b) ?? 0) + 1)
    let [r, g, bl] = LEGEND[b]
    if ((b === 'meadow' || b === 'woodland' || b === 'highland') && greySurfaceAt(x, z, SEED)) {
      ;[r, g, bl] = LEGEND.greyfield          // the fringe guttering INTO living country
    }
    if (b === 'woodland') {
      // modulate by the mask so cores read denser than edges
      const f = forestness(SEED, x / 16, z / 16)
      r = r * (0.75 + 0.25 * (1 - f)); g = g * (0.75 + 0.25 * (1 - f)); bl = bl * (0.75 + 0.25 * (1 - f))
    }
    put(px + 8 + ix, iz, r, g, bl)
  }
}
for (let iz = 0; iz < H; iz++) for (let d = 0; d < 8; d++) put(px + d, iz, 20, 20, 24)

// ── structure sites, marked on BOTH panels so pad-vs-relief can be judged at a glance ────────────
let siteCount = 0
{
  const cellSpan = DEFAULT_SITES.spacing * 16
  const c0 = Math.floor(-SIZE / 2 / cellSpan) - 1, c1 = Math.ceil(SIZE / 2 / cellSpan) + 1
  for (let cz = c0; cz <= c1; cz++) for (let cx = c0; cx <= c1; cx++) {
    const s = siteAt(SEED, cx, cz)
    if (!s) continue
    const ix = Math.round((s.x + SIZE / 2) / STRIDE), iz = Math.round((s.z + SIZE / 2) / STRIDE)
    if (ix < 3 || ix >= px - 3 || iz < 3 || iz >= px - 3) continue
    siteCount++
    for (let d = -3; d <= 3; d++) {                       // a diamond reads at map scale; a dot vanishes
      for (const [mx, mz] of [[d, 3 - Math.abs(d)], [d, Math.abs(d) - 3]]) {
        put(ix + mx, iz + mz, 255, 40, 40)
        put(px + 8 + ix + mx, iz + mz, 255, 40, 40)
      }
    }
  }
}

await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT)

const total = px * px
console.log(`${OUT} — ${SIZE}×${SIZE} world units at stride ${STRIDE}, seed ${SEED}, height ${min}..${max}, ${siteCount} sites in frame`)
for (const [b, n] of [...counts.entries()].sort((a, c) => c[1] - a[1]))
  console.log(`  ${b.padEnd(10)} ${((n / total) * 100).toFixed(1)}%`)
