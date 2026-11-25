// THE MOONWELL'S STONE RIM AND ITS LIGHT (BETA M165 s1; look LOCKED by Alex 11-25; canon characters/moonwell-folk.md: the rim is Sax's
// work). Dressed stones laid end to end round the sheet's edge (moonwell-water.ts poolEdge), every corner ON the ground under it, so
// they follow the owner's sculpting. Nothing here is solid: a kerb under RIM_TOP high that a keeper steps straight over. Pure.
import { MOONWELL } from './moonwell'
import { POOL_SEGS, POOL_Y, poolEdge } from './moonwell-water'

type Ground = (x: number, z: number) => number
/** no stone stands higher than this over its ground (under a keeper's knee) */
export const RIM_TOP = 0.24
const SUNK = 0.3, LEN = 1.45, GAP = 0.05, INK = 0.018
export const RIM_TONES = ['#dccdb2', '#c9b99c', '#e6d9c1', '#bcad93'] as const
export interface RimMesh { pos: Float32Array; col: Float32Array; ink: Float32Array; stones: number; tops: { x: number; z: number; h: number }[] }
const rnd = (n: number) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s) }
const rgb = (h: string) => [1, 3, 5].map(i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })

/** the stones as flat-shaded triangles (no index), vertex colours and their ink hull */
export function poolRim(ground: Ground): RimMesh {
  const e = poolEdge(ground), at = (a: number, out: number) => {   // a spot `out` m outside the edge on the bearing a (in edge steps)
    const k = Math.floor(a), f = a - k, p = e[((k % POOL_SEGS) + POOL_SEGS) % POOL_SEGS], q = e[(((k + 1) % POOL_SEGS) + POOL_SEGS) % POOL_SEGS]
    const x = p.x + (q.x - p.x) * f - MOONWELL.x, z = p.z + (q.z - p.z) * f - MOONWELL.z, d = Math.hypot(x, z), s = (d + out) / d
    return { x: MOONWELL.x + x * s, z: MOONWELL.z + z * s }
  }
  const step = e.map((p, k) => { const q = e[(k + 1) % POOL_SEGS]; return Math.hypot(q.x - p.x, q.z - p.z) })
  const round = step.reduce((s, v) => s + v, 0), n = Math.round(round / LEN)
  const along: number[] = [0]; for (const s of step) along.push(along[along.length - 1] + s)
  const bearing = (d: number) => { let k = 0; while (k < POOL_SEGS - 1 && along[k + 1] < d) k++; return k + (d - along[k]) / (step[k] || 1) }
  const pos: number[] = [], col: number[] = [], ink: number[] = [], tops: RimMesh['tops'] = []
  const joint = (k: number) => (k % n === 0 ? (k / n) * round : ((k + (rnd(k) - 0.5) * 0.34) / n) * round)
  for (let k = 0; k < n; k++) {
    const d0 = joint(k) + GAP / 2, d1 = joint(k + 1) - GAP / 2, h = 0.15 + rnd(k + 300) * 0.07, w = 0.62 + rnd(k + 600) * 0.26, inn = -0.14 - rnd(k + 900) * 0.08
    const prof: [number, number][] = [[inn, -SUNK], [inn, h - 0.05], [inn + 0.07, h], [inn + w - 0.09, h], [inn + w, h - 0.06], [inn + w, -SUNK]]
    const c = rgb(RIM_TONES[Math.floor(rnd(k + 1200) * 4)])
    const ring = (d: number, grow: number, end: number) => prof.map(([o, y], i) => {
      const b = bearing(d + end * grow), p = at(b, o + (i < 3 ? -grow : grow)), g = ground(at(b, o).x, at(b, o).z)
      return [p.x, (Number.isFinite(g) ? g : POOL_Y - 0.05) + y + (i === 0 || i === 5 ? 0 : grow), p.z]
    })
    const build = (grow: number, into: number[], paint: boolean) => {
      const A = [ring(d0, grow, -1), ring((d0 + d1) / 2, grow, 0), ring(d1, grow, 1)]
      const tri = (...v: number[][]) => { for (const q of v) into.push(...q); if (paint) for (let i = 0; i < 3; i++) col.push(...c) }
      for (let s = 0; s < 2; s++) for (let i = 0; i < 5; i++) { const a = A[s][i], b = A[s][i + 1], q = A[s + 1][i], r = A[s + 1][i + 1]; tri(a, q, b); tri(q, r, b) }
      for (let i = 1; i < 5; i++) { tri(A[0][0], A[0][i], A[0][i + 1]); tri(A[2][0], A[2][i + 1], A[2][i]) }
      if (paint) for (const r of A) for (const i of [2, 3]) tops.push({ x: r[i][0], z: r[i][2], h: r[i][1] })
    }
    build(0, pos, true); build(INK, ink, false)
  }
  return { pos: new Float32Array(pos), col: new Float32Array(col), ink: new Float32Array(ink), stones: n, tops }
}

/** the water's own colours, ring by ring of poolSheet: silver in the middle, deeper between, bright again where it laps the stones */
export const SHEET_TONES = ['#e9f6ff', '#c4e6fa', '#a3d6e6', '#93cbd9', '#bfe6ee', '#f0fbff'] as const
export function sheetColors(): Float32Array { const out: number[] = [...rgb(SHEET_TONES[0])]; for (const t of SHEET_TONES.slice(1)) { const c = rgb(t); for (let k = 0; k < POOL_SEGS; k++) out.push(...c) } return new Float32Array(out) }

/** the glow: a low veil of light standing on the water's edge (bright at the water, gone GLOW_H up) and pale glints on the water */
export const GLOW_H = 0.8
export function poolGlow(ground: Ground): { pos: Float32Array; col: Float32Array; idx: number[] } {
  const e = poolEdge(ground), pos: number[] = [], col: number[] = [], idx: number[] = [], c = rgb('#e6f5ff'), w = rgb('#fffbea')
  e.forEach((p, k) => {
    const f = (p.r - 0.3) / p.r, x = MOONWELL.x + (p.x - MOONWELL.x) * f, z = MOONWELL.z + (p.z - MOONWELL.z) * f
    pos.push(x, POOL_Y, z, x, POOL_Y + GLOW_H, z); col.push(...c, 0.3, ...c, 0)
    const a = k * 2, b = ((k + 1) % POOL_SEGS) * 2; idx.push(a, b, a + 1, a + 1, b, b + 1)
  })
  for (let g = 0; g < 22; g++) {
    const a = rnd(g + 40) * Math.PI * 2, d = 0.15 + Math.sqrt(rnd(g + 80)) * 0.7, x = MOONWELL.x + Math.cos(a) * MOONWELL.rx * d, z = MOONWELL.z + Math.sin(a) * MOONWELL.rz * d, rx = 0.9 + rnd(g + 120) * 1.7, rz = 0.14 + rnd(g + 160) * 0.16, b = pos.length / 3
    pos.push(x, POOL_Y + 0.015, z); col.push(...w, 0.75)
    for (let k = 0; k < 14; k++) { const t = (k / 14) * Math.PI * 2; pos.push(x + Math.cos(t) * rx, POOL_Y + 0.015, z + Math.sin(t) * rz); col.push(...w, 0.55); idx.push(b, b + 1 + (k + 1) % 14, b + 1 + k) }
  }
  return { pos: new Float32Array(pos), col: new Float32Array(col), idx }
}
