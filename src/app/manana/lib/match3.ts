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
  puff?: boolean // a cloud-puff: a fixed, unmatchable blocker (colour ignored)
}

export const gem = (color: number): Cell => ({ color, kind: 'none' })
export const empty = (): Cell => ({ color: -1, kind: 'none' })
export const puffCell = (): Cell => ({ color: -1, kind: 'none', puff: true })
export const isSpecial = (c: Cell) => c.kind !== 'none'
export const isPuff = (c: Cell) => c.puff === true
export const PUFF_BONUS = 30 // score for clearing one puff

export const idx = (x: number, y: number) => y * W + x
export const xy = (i: number) => ({ x: i % W, y: Math.floor(i / W) })

// orthogonal neighbours of a cell (used for puff spread + burst)
function orthos(i: number): number[] {
  const { x, y } = xy(i)
  const out: number[] = []
  if (x > 0) out.push(idx(x - 1, y))
  if (x < W - 1) out.push(idx(x + 1, y))
  if (y > 0) out.push(idx(x, y - 1))
  if (y < H - 1) out.push(idx(x, y + 1))
  return out
}

export const countPuffs = (b: Cell[]): number => b.reduce((n, c) => n + (isPuff(c) ? 1 : 0), 0)

// turn n random plain gems into puffs (called once at board start)
export function seedPuffs(b: Cell[], rng: Rng, n: number): Cell[] {
  const out = b.map((c) => ({ ...c }))
  let placed = 0
  let guard = 0
  while (placed < n && guard++ < 400) {
    const i = Math.floor(rng() * W * H)
    if (!isPuff(out[i]) && !isSpecial(out[i]) && out[i].color >= 0) {
      out[i] = puffCell()
      placed++
    }
  }
  return out
}

// one puff creeps into a random orthogonal plain-gem neighbour (the spread rule).
// Called on a move where the player cleared no puff. Returns same board if boxed in.
export function spreadPuffs(b: Cell[], rng: Rng): Cell[] {
  const puffs: number[] = []
  for (let i = 0; i < W * H; i++) if (isPuff(b[i])) puffs.push(i)
  if (!puffs.length) return b
  // candidate targets = plain gems adjacent to some puff
  const targets = new Set<number>()
  for (const p of puffs) for (const nb of orthos(p)) if (!isPuff(b[nb]) && !isSpecial(b[nb]) && b[nb].color >= 0) targets.add(nb)
  if (!targets.size) return b
  const arr = [...targets]
  const pick = arr[Math.floor(rng() * arr.length)]
  const out = b.map((c) => ({ ...c }))
  out[pick] = puffCell()
  return out
}

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
    // a puff is an immovable floor — it splits the column into segments that
    // each compact + refill independently. No puffs = one segment = old behaviour.
    let segment: number[] = []
    const resolveSegment = () => {
      if (!segment.length) return
      const solids = segment.map((y) => n[idx(x, y)]).filter((c) => c.color !== -1)
      const gap = segment.length - solids.length
      const filled: Cell[] = [
        ...Array.from({ length: gap }, () => gem(Math.floor(rng() * TYPES))),
        ...solids,
      ]
      segment.forEach((y, k) => { n[idx(x, y)] = filled[k] })
      segment = []
    }
    for (let y = 0; y < H; y++) {
      if (isPuff(n[idx(x, y)])) resolveSegment()
      else segment.push(y) // top-to-bottom order within the segment
    }
    resolveSegment()
  }
  return n
}

export interface ResolveStep {
  matched: number[] // every cell cleared this cascade (drives the pop)
  spawned: { i: number; kind: Kind }[]
  fired: Kind[] // specials that detonated this cascade (drives the sound)
  blasts: { i: number; kind: Kind; color: number }[] // where each special fired (drives beams)
  fallen: Cell[]
  gained: number
  mult: number // cascade multiplier shown as "ather heat"
  puffs: number // puffs burst this cascade
  colorCounts: number[] // gems cleared this cascade, tallied by colour id (drives quest goals)
}

export interface ResolveResult {
  steps: ResolveStep[]
  board: Cell[]
  puffs: number // total puffs burst across the whole move (0 → puffs spread)
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
    const blasts = [...toClear]
      .filter((i) => isSpecial(cur[i]) && !spawnCells.has(i))
      .map((i) => ({ i, kind: cur[i].kind, color: cur[i].color }))
    const fired = blasts.map((b) => b.kind)

    // cloud-puffs burst when a clear lands orthogonally next to them (or a blast
    // hits them directly). They never match on their own.
    const finalClear = new Set(toClear)
    for (const i of toClear) for (const nb of orthos(i)) if (isPuff(cur[nb])) finalClear.add(nb)
    let puffs = 0

    const cleared = cur.map((c) => ({ ...c }))
    const colorCounts = new Array<number>(TYPES).fill(0)
    for (const i of finalClear) {
      if (spawnCells.has(i)) continue
      if (isPuff(cur[i])) puffs++
      else if (cur[i].color >= 0) colorCounts[cur[i].color]++
      cleared[i] = empty()
    }
    for (const sp of spawns) cleared[sp.i] = { color: sp.color, kind: sp.kind }

    const fallen = collapse(cleared, rng)
    const mult = 1 + cascade * 0.5
    const gained = Math.round((toClear.size * 10 + puffs * PUFF_BONUS) * mult)
    steps.push({ matched: [...finalClear], spawned: spawns.map((s) => ({ i: s.i, kind: s.kind })), fired, blasts, fallen, gained, mult, puffs, colorCounts })
    cur = fallen
    cascade++
  }
  return { steps, board: cur, puffs: steps.reduce((a, s) => a + s.puffs, 0) }
}

export function swapMakesMatch(b: Cell[], a: number, c: number): boolean {
  if (!areAdjacent(a, c)) return false
  return findMatches(swapped(b, a, c)).size > 0
}

// ── special + special COMBOS ────────────────────────────────────────────────
// Swapping two specials together fires a signature combined effect, bigger than
// the two firing on their own. `board` is already swapped (both specials sit at
// a and c). Returns the enhanced board (some gems re-forged into specials) + the
// seed clear-set for resolve()'s detonateChain to blow through.
type Fam = 'surge' | 'star' | 'prism'
const fam = (k: Kind): Fam | null =>
  k === 'surgeH' || k === 'surgeV' ? 'surge' : k === 'star' ? 'star' : k === 'prism' ? 'prism' : null

const rowCells = (y: number) => Array.from({ length: W }, (_, x) => idx(x, y))
const colCells = (x: number) => Array.from({ length: H }, (_, y) => idx(x, y))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function presentColour(b: Cell[], rng: Rng): number {
  const seen = [...new Set(b.filter((c) => c.color >= 0 && !c.puff).map((c) => c.color))]
  return seen.length ? seen[Math.floor(rng() * seen.length)] : 0
}

export function specialCombo(b: Cell[], a: number, c: number, rng: Rng): { board: Cell[]; forced: Set<number> } {
  const fa = fam(b[a].kind)!, fb = fam(b[c].kind)!
  const nb = b.map((x) => ({ ...x }))
  const forced = new Set<number>([a, c])
  const { x: cx, y: cy } = xy(c)
  const key = [fa, fb].sort().join('+') // canonical pair name

  // prism + prism → clear the whole board (the nuke)
  if (key === 'prism+prism') {
    for (let i = 0; i < W * H; i++) if (!isPuff(nb[i])) forced.add(i)
    return { board: nb, forced }
  }

  // prism + surge/star → every gem of the partner's colour becomes that special, then all fire
  if (fa === 'prism' || fb === 'prism') {
    const partner = fa === 'prism' ? c : a
    const otherFam: Fam = fa === 'prism' ? fb : fa
    const colour = nb[partner].color >= 0 ? nb[partner].color : presentColour(nb, rng)
    let flip = 0
    for (let i = 0; i < W * H; i++) {
      if (i === a || i === c || isPuff(nb[i]) || nb[i].color < 0) continue
      if (nb[i].color === colour) {
        nb[i] = { ...nb[i], kind: otherFam === 'star' ? 'star' : (flip++ % 2 ? 'surgeH' : 'surgeV') }
        forced.add(i)
      }
    }
    return { board: nb, forced }
  }

  // surge + surge → full row AND full column through the swap (a giant plus)
  if (key === 'surge+surge') {
    for (const i of rowCells(cy)) forced.add(i)
    for (const i of colCells(cx)) forced.add(i)
    return { board: nb, forced }
  }

  // star + surge → a THICK cross: three rows and three columns
  if (key === 'star+surge') {
    for (let dy = -1; dy <= 1; dy++) for (const i of rowCells(clamp(cy + dy, 0, H - 1))) forced.add(i)
    for (let dx = -1; dx <= 1; dx++) for (const i of colCells(clamp(cx + dx, 0, W - 1))) forced.add(i)
    return { board: nb, forced }
  }

  // star + star → a 5×5 blast around the swap
  for (let y = clamp(cy - 2, 0, H - 1); y <= clamp(cy + 2, 0, H - 1); y++)
    for (let x = clamp(cx - 2, 0, W - 1); x <= clamp(cx + 2, 0, W - 1); x++) forced.add(idx(x, y))
  return { board: nb, forced }
}

// a swap is also legal if it detonates a special. Returns the seed clear-set
// (post-swap) for resolve(), or null if it's a plain (non-detonating) swap.
export function swapDetonation(b: Cell[], a: number, c: number, rng?: Rng): { board: Cell[]; forced: Set<number> } | null {
  if (!areAdjacent(a, c)) return null
  if (!isSpecial(b[a]) && !isSpecial(b[c])) return null
  const nb = swapped(b, a, c)
  // BOTH cells special after the swap → a combined combo effect
  if (isSpecial(nb[a]) && isSpecial(nb[c])) return specialCombo(nb, a, c, rng ?? Math.random)
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
