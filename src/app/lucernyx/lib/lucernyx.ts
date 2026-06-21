// LUCERNYX — the lantern Ancient who keeps the light. You don't slay the grey-corrupted;
// you rekindle them. Slide diagonally (checkers); jump an adjacent enemy into the empty
// square beyond and it flips to your light and STAYS on its square (material never leaves
// the board). A converted piece reverses its march. Run a piece to the enemy's home rank
// and it lights a torch + ascends off the board — first to 3 torches wins. Spending pieces
// for torches thins your army and dangles convertible targets midfield, so conversion is
// the natural counter to a torch-rush. (Canon: world/mother.md in /athernyx — Tier-2.)
//
// THE GIMMICK — the REKINDLE PULSE (2026-06-21): lighting a torch makes the lantern FLARE.
// Every enemy piece diagonally adjacent to one of your pieces instantly rekindles to your
// light (one wave, no chain). So you set up beside the corrupted BEFORE you torch — the
// torch-race and the convert mechanic now talk to each other, and a torch becomes a board-
// swing, not a quiet +1. This is what makes it Lucernyx and not checkers.
//
// Board is TALLER than wide (8×10): the torch-race is a longer, more perilous march.
//
// Pure sim — no canvas, no React. Deterministic. The page drives it with legalMoves()/
// apply()/aiMove() and renders from the returned board.
//
// CUT 2026-06-18: element-tile "sanctuaries" (rooted pieces couldn't be jumped). They turned
// the torch-race into board-locks — self-play draws ran 10% with them, 0.3% without — and the
// un-jumpable blocker squares read as "my move vanished." Don't re-add terrain without a
// draw-rate check.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

export type Owner = 'light' | 'grey'
export const COLS = 8 // board width
export const ROWS = 10 // board height — taller than wide for a longer torch-race
export const PIECE_RANKS = 3 // back ranks each side fills (checkers density)
export const TORCHES_TO_WIN = 3
export const PULSE_CAP = 3 // the flare rekindles at most this many (the nearest to the torch) — a swing, not an army-wipe

export const other = (o: Owner): Owner => (o === 'light' ? 'grey' : 'light')
// light's home is the bottom; it advances UP toward row 0. grey advances DOWN toward ROWS-1.
export const forwardDir = (o: Owner): number => (o === 'light' ? -1 : 1)
// the rank a piece must reach to light a torch (the enemy's home rank)
export const homeRank = (o: Owner): number => (o === 'light' ? 0 : ROWS - 1)

export const idx = (r: number, c: number): number => r * COLS + c
export const rowOf = (i: number): number => Math.floor(i / COLS)
export const colOf = (i: number): number => i % COLS
const inB = (r: number, c: number): boolean => r >= 0 && r < ROWS && c >= 0 && c < COLS
export const isDark = (r: number, c: number): boolean => (r + c) % 2 === 1

export interface Move {
  from: number
  to: number // final landing square
  path: number[] // landing squares in order (1 for a slide, N for a multi-jump)
  converts: number[] // squares of enemies flipped along the way
  torch: boolean // does the piece ascend + light a torch on landing
}

export interface Board {
  cells: (Owner | null)[] // index r*COLS+c; null = empty. only dark squares are ever occupied
  turn: Owner
  torches: { light: number; grey: number }
  winner: Owner | null // set when over; null + over = draw (board-lock, equal tiebreak)
  over: boolean
  pulse?: number[] // squares rekindled by the last torch's flare (for the render to animate)
}

export function makeBoard(): Board {
  const cells: (Owner | null)[] = new Array(COLS * ROWS).fill(null)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isDark(r, c)) continue
      if (r < PIECE_RANKS) cells[idx(r, c)] = 'grey' // grey home at the top
      else if (r >= ROWS - PIECE_RANKS) cells[idx(r, c)] = 'light' // light home at the bottom
    }
  }
  return { cells, turn: 'light', torches: { light: 0, grey: 0 }, winner: null, over: false }
}

export function countPieces(b: Board, o: Owner): number {
  let n = 0
  for (const x of b.cells) if (x === o) n++
  return n
}

// all legal moves for `owner` on board `b` (forward-only slides + forward-only jump-converts,
// jumps optional — every prefix of a multi-jump chain is a legal stopping point)
export function legalMoves(b: Board, owner: Owner): Move[] {
  const moves: Move[] = []
  const dir = forwardDir(owner)
  const enemy = other(owner)
  const home = homeRank(owner)

  for (let s = 0; s < b.cells.length; s++) {
    if (b.cells[s] !== owner) continue
    const r = rowOf(s), c = colOf(s)

    // simple slides
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc
      if (!inB(nr, nc) || !isDark(nr, nc)) continue
      const ni = idx(nr, nc)
      if (b.cells[ni] === null) {
        moves.push({ from: s, to: ni, path: [ni], converts: [], torch: nr === home })
      }
    }

    // jump-converts (DFS; emit a move at every captured step)
    const dfs = (r0: number, c0: number, converts: number[], path: number[]) => {
      for (const dc of [-1, 1]) {
        const or = r0 + dir, oc = c0 + dc // the enemy being jumped
        const lr = r0 + 2 * dir, lc = c0 + 2 * dc // the empty landing beyond
        if (!inB(lr, lc) || !isDark(lr, lc)) continue
        const oi = idx(or, oc), li = idx(lr, lc)
        if (b.cells[oi] !== enemy) continue
        if (converts.includes(oi)) continue // don't re-jump one we've already flipped this chain
        if (b.cells[li] !== null || li === s || path.includes(li)) continue // landing must be clear
        const nextConverts = [...converts, oi]
        const nextPath = [...path, li]
        const torch = lr === home
        moves.push({ from: s, to: li, path: nextPath, converts: nextConverts, torch })
        // a piece that torches ascends off the board, so the chain ends there
        if (!torch) dfs(lr, lc, nextConverts, nextPath)
      }
    }
    dfs(r, c, [], [])
  }
  return moves
}

// the four diagonal neighbours of a dark square (where pieces can sit)
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

// apply a move for the side to move; returns a NEW board (caller keeps the old one for undo/anim)
export function apply(b: Board, m: Move): Board {
  const owner = b.turn
  const enemy = other(owner)
  const cells = b.cells.slice()
  const torches = { ...b.torches }
  let pulse: number[] | undefined

  cells[m.from] = null
  for (const sq of m.converts) cells[sq] = owner // flip in place — material never leaves
  if (m.torch) {
    torches[owner]++ // the piece lights a torch and ascends off the board
    // THE REKINDLE PULSE — the lantern flares from the torch point. Rekindle the enemies
    // diagonally adjacent to your light, but only the nearest PULSE_CAP to where you lit
    // it (the flare's reach fades with distance) — a swing, not a board-wide army-wipe.
    // Skip any on YOUR torch rank: a piece rekindled at the far altar can't advance and
    // would just sit there, so the flare passes over them. Collect, then flip as one wave.
    const torchRank = homeRank(owner)
    const cand: number[] = []
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== enemy || rowOf(i) === torchRank) continue
      const r = rowOf(i), c = colOf(i)
      for (const [dr, dc] of DIAG) {
        const nr = r + dr, nc = c + dc
        if (inB(nr, nc) && cells[idx(nr, nc)] === owner) { cand.push(i); break }
      }
    }
    const er = rowOf(m.to), ec = colOf(m.to) // the torch point — the flare's epicentre
    const dist = (i: number) => Math.max(Math.abs(rowOf(i) - er), Math.abs(colOf(i) - ec))
    cand.sort((a, b) => dist(a) - dist(b) || a - b) // nearest first; index breaks ties (deterministic)
    const flips = cand.slice(0, PULSE_CAP)
    for (const i of flips) cells[i] = owner
    if (flips.length) pulse = flips
  } else {
    cells[m.to] = owner
  }

  let winner: Owner | null = null
  let over = false
  if (torches[owner] >= TORCHES_TO_WIN) {
    winner = owner
    over = true
  }

  const turn = other(owner)
  const next: Board = { cells, turn, torches, winner, over, pulse }

  if (!over) {
    // board-lock or wipeout ends the game on the next player's turn
    if (countPieces(next, turn) === 0 || legalMoves(next, turn).length === 0) {
      next.over = true
      next.winner = resolveTiebreak(next)
    }
  }
  return next
}

// most torches, then most pieces; equal = draw (null)
function resolveTiebreak(b: Board): Owner | null {
  if (b.torches.light !== b.torches.grey) return b.torches.light > b.torches.grey ? 'light' : 'grey'
  const pl = countPieces(b, 'light'), pg = countPieces(b, 'grey')
  if (pl !== pg) return pl > pg ? 'light' : 'grey'
  return null
}

// does `who` have an immediate torch available (a one-move ascend)?
function hasImminentTorch(b: Board, who: Owner): boolean {
  return legalMoves(b, who).some((m) => m.torch)
}

// board value from `me`'s perspective (greedy AI eval)
function evalBoard(b: Board, me: Owner): number {
  const opp = other(me)
  if (b.over) {
    if (b.winner === me) return 1e6
    if (b.winner === opp) return -1e6
    return 0 // draw
  }
  let s = 0
  s += (b.torches[me] - b.torches[opp]) * 1000
  s += (countPieces(b, me) - countPieces(b, opp)) * 40 // each conversion is a +80 swing — drives the AI to flip
  // advancement: reward pushing toward the enemy home rank
  for (let i = 0; i < b.cells.length; i++) {
    if (b.cells[i] === me) s += advance(me, rowOf(i)) * 3
    else if (b.cells[i] === opp) s -= advance(opp, rowOf(i)) * 3
  }
  if (hasImminentTorch(b, opp)) s -= 250 // they're one move from a torch — bad
  if (hasImminentTorch(b, me)) s += 120
  return s
}

// how many ranks a piece of `o` has advanced from its start edge (0..ROWS-1)
const advance = (o: Owner, r: number): number => (o === 'light' ? ROWS - 1 - r : r)

// greedy AI: simulate each legal move, keep the best by eval, break ties deterministically
export function aiMove(b: Board, rng: Rng = mulberry32(1)): Move | null {
  const me = b.turn
  const moves = legalMoves(b, me)
  if (moves.length === 0) return null
  let best: Move | null = null
  let bestScore = -Infinity
  for (const m of moves) {
    const score = evalBoard(apply(b, m), me) + rng() * 0.5 // jitter only splits exact ties
    if (score > bestScore) { bestScore = score; best = m }
  }
  return best
}
