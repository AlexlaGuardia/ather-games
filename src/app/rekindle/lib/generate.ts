// REKINDLE — board generator. Builds a guaranteed-solvable network BY
// CONSTRUCTION (a random spanning tree = one connected, single-colour machine),
// then the loader scrambles it. Source = the tree root, cores = its far leaves.
// Powers the Daily Machine (date-seeded, shareable) and Endless free play.

import { mulberry32, type Rng } from '@/lib/arcade/rng'
import { opposite, type Cell, type Level } from './puzzle'

const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]
const popcount = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1))

export type Template = Omit<Level, 'charge' | 'par'>

export function genTemplate(cols: number, rows: number, seed: number, name = 'Unknown Machine'): Template {
  const rng: Rng = mulberry32(seed)
  const ri = (n: number) => Math.floor(rng() * n)
  const mask = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  const seen = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))

  // root in a corner-ish spot so the source reads as a clean terminal
  const root: [number, number] = [ri(2) ? 0 : rows - 1, ri(2) ? 0 : cols - 1]
  const stack: [number, number][] = [root]
  seen[root[0]][root[1]] = true

  // randomized-DFS spanning tree over the full grid (a perfect maze: everything
  // connected, no loops)
  while (stack.length) {
    const [r, c] = stack[stack.length - 1]
    const open: number[] = []
    for (let d = 0; d < 4; d++) {
      const nr = r + DY[d], nc = c + DX[d]
      if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && !seen[nr][nc]) open.push(d)
    }
    if (!open.length) { stack.pop(); continue }
    const d = open[ri(open.length)]
    const nr = r + DY[d], nc = c + DX[d]
    mask[r][c] |= 1 << d
    mask[nr][nc] |= 1 << opposite(d)
    seen[nr][nc] = true
    stack.push([nr, nc])
  }

  // distances from root over the tree → pick the farthest leaves as cores
  const dist = Array.from({ length: rows }, () => new Array<number>(cols).fill(-1))
  const q: [number, number][] = [root]
  dist[root[0]][root[1]] = 0
  while (q.length) {
    const [r, c] = q.shift()!
    for (let d = 0; d < 4; d++) {
      if (!(mask[r][c] & (1 << d))) continue
      const nr = r + DY[d], nc = c + DX[d]
      if (dist[nr][nc] === -1) { dist[nr][nc] = dist[r][c] + 1; q.push([nr, nc]) }
    }
  }
  const leaves: { r: number; c: number; d: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (popcount(mask[r][c]) === 1 && !(r === root[0] && c === root[1]))
        leaves.push({ r, c, d: dist[r][c] })
  leaves.sort((a, b) => b.d - a.d)
  const coreCount = Math.min(leaves.length, cols >= 5 && rows >= 5 ? 2 : 1)
  const cores = new Set(leaves.slice(0, Math.max(1, coreCount)).map((l) => `${l.r},${l.c}`))

  const grid: Cell[][] = mask.map((row, r) =>
    row.map((m, c): Cell => {
      const key = `${r},${c}`
      if (r === root[0] && c === root[1]) return { base: m, rot: 0, role: 'source', fixed: true, hue: 'cyan' }
      if (cores.has(key)) return { base: m, rot: 0, role: 'core', fixed: true, hue: 'cyan' }
      return { base: m, rot: 0, role: 'wire', fixed: false }
    }),
  )
  return { name, cols, rows, grid }
}

/** today's date as a stable numeric seed (UTC) — everyone gets the same machine. */
export function dailySeed(d: Date): number {
  const k = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  return k >>> 0
}
export function dailyKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
