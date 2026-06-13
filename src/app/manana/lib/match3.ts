// MANA'NANA match-3 core (v2 — specials). A cell carries a colour + an optional
// special "kind" that blooms from a big match and detonates when matched or
// swapped. Pure + deterministic given an rng.

import type { Rng } from '@/lib/arcade/rng'

export const W = 8
export const H = 8
export const TYPES = 6
export const MIN_RUN = 3

// surgeH clears its ROW, surgeV its COLUMN, star both (a cross), prism a colour
export type Kind = 'none' | 'surgeH' | 'surgeV' | 'prism' | 'star'

export interface Cell {
  color: number // -1 = empty hole (mid-resolve)
  kind: Kind
}

export const gem = (color: number): Cell => ({ color, kind: 'none' })
export const empty = (): Cell => ({ color: -1, kind: 'none' })
export const isSpecial = (c: Cell) => c.kind !== 'none'

export const idx = (x: number, y: number) => y * W + x
export const xy = (i: number) => ({ x: i % W, y: Math.floor(i / W) })

export function areAdjacent(a: number, b: number): boolean {
  const A = xy(a)
  const B = xy(b)
  return Math.abs(A.x - B.x) + Math.abs(A.y - B.y) === 1
}

// a fresh board, all plain gems, with NO pre-existing matches
export function genBoard(rng: Rng): Cell[] {
  const b: Cell[] = new Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t = -1
      let guard = 0
      do {
        t = Math.floor(rng() * TYPES)
        guard++
      } while (
        guard < 40 &&
        ((x >= 2 && b[idx(x - 1, y)].color === t && b[idx(x - 2, y)].color === t) ||
          (y >= 2 && b[idx(x, y - 1)].color === t && b[idx(x, y - 2)].color === t))
      )
      b[idx(x, y)] = gem(t)
    }
  }
  return b
}

export interface Run {
  cells: number[]
  dir: 'h' | 'v'
  len: number
}

// every maximal horizontal/vertical run of MIN_RUN+ same colour
export function findRuns(b: Cell[]): Run[] {
  const runs: Run[] = []
  for (let y = 0; y < H; y++) {
    let start = 0
    for (let x = 1; x <= W; x++) {
      const cont = x < W && b[idx(x, y)].color !== -1 && b[idx(x, y)].color === b[idx(x - 1, y)].color
      if (!cont) {
        const len = x - start
        if (len >= MIN_RUN) runs.push({ cells: Array.from({ length: len }, (_, k) => idx(start + k, y)), dir: 'h', len })
        start = x
      }
    }
  }
  for (let x = 0; x < W; x++) {
    let start = 0
    for (let y = 1; y <= H; y++) {
      const cont = y < H && b[idx(x, y)].color !== -1 && b[idx(x, y)].color === b[idx(x, y - 1)].color
      if (!cont) {
        const len = y - start
        if (len >= MIN_RUN) runs.push({ cells: Array.from({ length: len }, (_, k) => idx(x, start + k)), dir: 'v', len })
        start = y
      }
    }
  }
  return runs
}

export function findMatches(b: Cell[]): Set<number> {
  const s = new Set<number>()
  for (const r of findRuns(b)) for (const i of r.cells) s.add(i)
  return s
}

// what special a run of this length blooms into (null = just clears)
function specialFor(run: Run): Kind | null {
  if (run.len >= 7) return 'star'
  if (run.len >= 5) return 'prism'
  if (run.len === 4) return run.dir === 'h' ? 'surgeH' : 'surgeV'
  return null
}

export function swapped(b: Cell[], a: number, c: number): Cell[] {
  const n = b.map((x) => ({ ...x }))
  ;[n[a], n[c]] = [n[c], n[a]]
  return n
}

// the cells a detonating special clears (effect only — chaining handled above)
function blastCells(b: Cell[], i: number): number[] {
  const { x, y } = xy(i)
  const k = b[i].kind
  const out: number[] = []
  if (k === 'surgeH' || k === 'star') for (let xx = 0; xx < W; xx++) out.push(idx(xx, y))
  if (k === 'surgeV' || k === 'star') for (let yy = 0; yy < H; yy++) out.push(idx(x, yy))
  if (k === 'prism') {
    const col = b[i].color
    for (let j = 0; j < W * H; j++) if (b[j].color === col) out.push(j)
  }
  return out
}

function collapse(b: Cell[], rng: Rng): Cell[] {
  const n = b.map((x) => ({ ...x }))
  for (let x = 0; x < W; x++) {
    const col: Cell[] = []
    for (let y = H - 1; y >= 0; y--) {
      const c = n[idx(x, y)]
      if (c.color !== -1) col.push(c)
    }
    for (let y = H - 1, k = 0; y >= 0; y--, k++) {
      n[idx(x, y)] = k < col.length ? col[k] : gem(Math.floor(rng() * TYPES))
    }
  }
  return n
}

export interface ResolveStep {
  matched: number[] // every cell cleared this cascade (drives the pop)
  spawned: { i: number; kind: Kind }[]
  fired: Kind[] // specials that detonated this cascade (drives the sound)
  fallen: Cell[]
  gained: number
  mult: number // cascade multiplier shown as "ather heat"
}

export interface ResolveResult {
  steps: ResolveStep[]
  board: Cell[]
}

// expand a clear set through any specials it touches (chain reaction)
function detonateChain(b: Cell[], base: Set<number>, protectedCells: Set<number>): Set<number> {
  const out = new Set(base)
  const q = [...base].filter((i) => isSpecial(b[i]) && !protectedCells.has(i))
  while (q.length) {
    const i = q.shift()!
    for (const j of blastCells(b, i)) {
      if (!out.has(j)) {
        out.add(j)
        if (isSpecial(b[j]) && !protectedCells.has(j)) q.push(j)
      }
    }
  }
  return out
}

// run the cascade. `forced` seeds the first pass with a swap-detonation set
// (no runs needed); otherwise the first pass finds matches like every cascade.
export function resolve(board: Cell[], rng: Rng, opts: { swapAt?: number; forced?: Set<number> } = {}): ResolveResult {
  let cur = board.map((c) => ({ ...c }))
  const steps: ResolveStep[] = []
  let cascade = 0
  let forced = opts.forced
  for (;;) {
    // --- gather this cascade's base matched cells + special spawns ---
    let base = new Set<number>()
    const spawns: { i: number; kind: Kind; color: number }[] = []
    const spawnCells = new Set<number>()

    if (forced) {
      base = new Set(forced)
      forced = undefined
    } else {
      const runs = findRuns(cur).filter((r) => r.len >= MIN_RUN)
      if (runs.length === 0) break
      for (const r of runs) for (const i of r.cells) base.add(i)
      for (const r of runs) {
        const kind = specialFor(r)
        if (!kind) continue
        let cell = cascade === 0 && opts.swapAt != null && r.cells.includes(opts.swapAt) ? opts.swapAt : r.cells[Math.floor(r.cells.length / 2)]
        if (spawnCells.has(cell)) cell = r.cells.find((c) => !spawnCells.has(c)) ?? cell
        spawns.push({ i: cell, kind, color: cur[cell].color })
        spawnCells.add(cell)
      }
    }

    // --- chain through specials, then clear (keep the cells that become specials) ---
    const toClear = detonateChain(cur, base, spawnCells)
    const fired = [...toClear].filter((i) => isSpecial(cur[i]) && !spawnCells.has(i)).map((i) => cur[i].kind)
    const cleared = cur.map((c) => ({ ...c }))
    for (const i of toClear) if (!spawnCells.has(i)) cleared[i] = empty()
    for (const sp of spawns) cleared[sp.i] = { color: sp.color, kind: sp.kind }

    const fallen = collapse(cleared, rng)
    const mult = 1 + cascade * 0.5
    const gained = Math.round(toClear.size * 10 * mult)
    steps.push({ matched: [...toClear], spawned: spawns.map((s) => ({ i: s.i, kind: s.kind })), fired, fallen, gained, mult })
    cur = fallen
    cascade++
  }
  return { steps, board: cur }
}

export function swapMakesMatch(b: Cell[], a: number, c: number): boolean {
  if (!areAdjacent(a, c)) return false
  return findMatches(swapped(b, a, c)).size > 0
}

// a swap is also legal if it detonates a special. Returns the seed clear-set
// (post-swap) for resolve(), or null if it's a plain (non-detonating) swap.
export function swapDetonation(b: Cell[], a: number, c: number): { board: Cell[]; forced: Set<number> } | null {
  if (!areAdjacent(a, c)) return null
  if (!isSpecial(b[a]) && !isSpecial(b[c])) return null
  const nb = swapped(b, a, c)
  // a prism takes the colour of the plain gem it was swapped with
  if (nb[a].kind === 'prism' && nb[c].kind === 'none') nb[a] = { ...nb[a], color: nb[c].color }
  if (nb[c].kind === 'prism' && nb[a].kind === 'none') nb[c] = { ...nb[c], color: nb[a].color }
  return { board: nb, forced: new Set([a, c]) }
}

export function anyMove(b: Cell[]): boolean {
  for (let i = 0; i < W * H; i++) {
    if (isSpecial(b[i])) return true // a special can always be swapped to fire
    const { x, y } = xy(i)
    if (x < W - 1 && swapMakesMatch(b, i, idx(x + 1, y))) return true
    if (y < H - 1 && swapMakesMatch(b, i, idx(x, y + 1))) return true
  }
  return false
}

export function reshuffle(rng: Rng): Cell[] {
  let b = genBoard(rng)
  let guard = 0
  while (!anyMove(b) && guard++ < 20) b = genBoard(rng)
  return b
}
