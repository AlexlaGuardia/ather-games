// The P0 feel slice's land — one hillside, small on purpose (OPEN_WORLD_PLAN.md › P0).
//
// ★ PURE and DETERMINISTIC: the page draws it and the walker stands on it from the same numbers,
// and one day `breach-server` computes it too without downloading anything.
//
// ★ WHAT YOU SEE IS WHAT YOU STAND ON. The raw shape (noise + stamps) is sampled on a 1m grid, and
// `heightAt` interpolates the SAME two triangles per cell that the mesh draws. A smooth analytic
// height under a faceted mesh would float the feet over every valley and sink them into every
// ridge — the classic "my boots are in the hill" bug, designed out rather than tuned out.
//
// No canon here: these are placeholder landforms for judging feel, not a place in the world.

import type { Box, Shape } from './terrain-world'

export const LAND_SIZE = 160          // metres, square, centred on the origin
export const CELL = 1                 // grid spacing — render and collision both
export const WATER_Y = -1.2
const N = LAND_SIZE / CELL            // cells per side
const HALF = LAND_SIZE / 2

// ── noise (value noise, seeded hash — tiny, no dependency) ───────────────────────────────────────
const hash = (ix: number, iz: number) => {
  let h = (ix * 374761393 + iz * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const smooth = (t: number) => t * t * (3 - 2 * t)
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = smooth(x - ix), fz = smooth(z - iz)
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1)
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz
}
const fbm = (x: number, z: number) =>
  vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 17, z * 2.1 - 9) * 0.28 + vnoise(x * 4.3 - 31, z * 4.3 + 5) * 0.12

const step01 = (e0: number, e1: number, v: number) => smooth(Math.min(1, Math.max(0, (v - e0) / (e1 - e0))))

/** The landform before gridding: rolling ground, a spawn pad, a pond, a low cliff, a tall bluff. */
export function rawHeight(x: number, z: number): number {
  let h = (fbm(x / 38, z / 38) - 0.5) * 7

  // a hill rising to the north (−z), so there is always somewhere to go up
  h += step01(0, -70, z) * 9

  // spawn pad: flatten toward 0 within 6m
  const dSpawn = Math.hypot(x, z)
  h *= step01(4, 12, dSpawn)

  // pond to the west: a bowl under the waterline
  const dPond = Math.hypot(x + 28, z - 14)
  h = h * step01(6, 16, dPond) + (-3.2) * (1 - step01(6, 16, dPond))

  // low cliff (3m) to the east: a plateau whose edge is steep enough to climb, not walk
  const dLow = Math.hypot(x - 34, z + 4)
  h += 3 * (1 - step01(13, 14.2, dLow))

  // tall bluff (6m) north-east: too tall for one climb — the ledge box halfway is the way up
  const dBluff = Math.hypot(x - 22, z + 42)
  h += 6 * (1 - step01(10, 11, dBluff))

  return h
}

// ── the grid both the mesh and the walker read ───────────────────────────────────────────────────
const grid = new Float32Array((N + 1) * (N + 1))
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) grid[j * (N + 1) + i] = rawHeight(i * CELL - HALF, j * CELL - HALF)

/** Grid sample at vertex (i, j) — the mesh's vertex heights, exactly. */
export const vertexHeight = (i: number, j: number) => grid[j * (N + 1) + i]
export const GRID_N = N

/** The surface the mesh draws: each cell is two triangles split on the (i,j)→(i+1,j+1) diagonal. */
export function heightAt(x: number, z: number): number {
  const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL
  if (gx < 0 || gz < 0 || gx > N || gz > N) return -Infinity       // off the edge: no land
  const i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gz))
  const fx = gx - i, fz = gz - j
  const h00 = grid[j * (N + 1) + i], h10 = grid[j * (N + 1) + i + 1]
  const h01 = grid[(j + 1) * (N + 1) + i], h11 = grid[(j + 1) * (N + 1) + i + 1]
  return fx >= fz
    ? h00 + (h10 - h00) * fx + (h11 - h10) * fz      // triangle (00, 10, 11)
    : h00 + (h11 - h01) * fx + (h01 - h00) * fz      // triangle (00, 11, 01)
}

// ── rocks, trunks, the bluff ledge: the boxes ────────────────────────────────────────────────────
export interface Prop { box: Box; kind: 'rock' | 'trunk' | 'ledge' }
const box = (cx: number, cz: number, w: number, d: number, bottom: number, top: number): Box =>
  ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0: bottom, y1: top })

function buildProps(): Prop[] {
  const out: Prop[] = []
  const grounded = (cx: number, cz: number, w: number, d: number, tall: number, kind: Prop['kind']) => {
    const g = Math.min(heightAt(cx - w / 2, cz - d / 2), heightAt(cx + w / 2, cz + d / 2), heightAt(cx, cz))
    out.push({ box: box(cx, cz, w, d, g - 1, g + tall), kind })
  }
  // near spawn: a waist-high rock to vault, a head-high boulder to climb
  grounded(6, -3, 2, 2, 1.0, 'rock')
  grounded(-7, -6, 3, 2.5, 2.2, 'rock')
  // the bluff's ledge: a shelf halfway up its south face
  const lz = -42 + 10.6, lx = 22
  const foot = heightAt(lx, lz + 3)
  out.push({ box: box(lx, lz + 0.6, 4, 1.6, foot - 1, foot + 3), kind: 'ledge' })
  // scattered rocks + trees, seeded
  for (let k = 0; k < 140; k++) {
    const x = (hash(k, 7) - 0.5) * (LAND_SIZE - 20), z = (hash(k, 13) - 0.5) * (LAND_SIZE - 20)
    if (Math.hypot(x, z) < 10 || Math.hypot(x + 28, z - 14) < 15) continue
    if (heightAt(x, z) < WATER_Y + 0.3) continue
    if (k % 3 === 0) grounded(x, z, 1.2 + hash(k, 3) * 1.6, 1 + hash(k, 5) * 1.4, 0.5 + hash(k, 9) * 1.4, 'rock')
    else grounded(x, z, 0.5, 0.5, 6, 'trunk')
  }
  return out
}
export const PROPS = buildProps()

// ── the shape the walker stands in ───────────────────────────────────────────────────────────────
// A coarse hash so a query touches a handful of boxes, not all of them.
const BUCKET = 8
const buckets = new Map<string, Box[]>()
for (const p of PROPS) {
  for (let bx = Math.floor(p.box.x0 / BUCKET); bx <= Math.floor(p.box.x1 / BUCKET); bx++)
    for (let bz = Math.floor(p.box.z0 / BUCKET); bz <= Math.floor(p.box.z1 / BUCKET); bz++) {
      const k = bx + ',' + bz
      const list = buckets.get(k) ?? []
      list.push(p.box); buckets.set(k, list)
    }
}
const POND: Box = { x0: -HALF, x1: HALF, z0: -HALF, z1: HALF, y0: -50, y1: WATER_Y }

export const LAND_SHAPE: Shape = {
  ground: heightAt,
  solids(x0, _y0, z0, x1, _y1, z1) {
    const out: Box[] = []
    for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++)
      for (let bz = Math.floor(z0 / BUCKET); bz <= Math.floor(z1 / BUCKET); bz++) {
        const l = buckets.get(bx + ',' + bz)
        if (l) for (const b of l) if (!out.includes(b)) out.push(b)
      }
    return out
  },
  // One sea level under the whole slice: water only exists where the land dips below it (the pond).
  water: () => [POND],
}
