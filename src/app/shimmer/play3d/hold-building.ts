// hold-building.ts — THE HOLD as a building: floors stacked straight over each other.
//
// ★ PURE. The walker, the flooded and every round read the Hold through this one module, so nothing
// can stand on a floor the others think is a wall.
//
// ── WHY THIS EXISTS (Alex 09-25: "truly stacked") ────────────────────────────────────────────────
// play3d's ground is ONE height per cell (`heights[z][x]`), which can say a setback tower and nothing
// else. Equal 50 × 80 floors have to share every cell, so here each floor is its own plan (a KIND per
// cell) at its own height, and WHICH floor a body is on is settled by the one rule the segs engine
// already uses: of the surfaces in that cell, the highest one you can step onto from where you are
// (`engine/segs-collision.ts` › resolveStand). Walls are VOLUMES — a wall on the middle floor stops a
// body standing on the middle floor and nobody above or below it.

import { HOLD_FLOORS, HOLD_COLS, HOLD_ROWS, type FloorDef } from './hold-floors'

/** Blocks from one floor to the next. Alex 09-25: 4 read low, "go taller … like a 10". A ramp must be
 *  at least this long, so raising it lengthens every ramp in `hold-floors.ts`. */
export const STOREY = 10
/** The bottom floor's height. The air below it is where the flooded climb up from. */
export const BASE_Y = STOREY

export const K = { VOID: 0, FLOOR: 1, WALL: 2, RAIL: 3, WINDOW: 4, GATE: 5, RAMP: 6, BLOCK: 7, LANDING: 8 } as const
export type Kind = typeof K[keyof typeof K]
/** Waist-high: a rail stops a walker and a low round, not a round fired over it. */
export const RAIL_H = 1.0
/** A rooftop unit: chest-high cover you can climb onto (its top is a surface — nothing falls through it). */
export const BLOCK_H = 2.5

export interface Level {
  name: string
  /** the floor's top, in blocks */
  y: number
  kind: Uint8Array
  /** the surface height of every walkable cell (a ramp's climbs; the rest sit at `y`) */
  sy: Float32Array
  /** the plan character at each cell (gate letters, fixtures) */
  ch: string[]
  /** 1 = a garden tint · 2 = the landing pad */
  tone: Uint8Array
  /** open to the sky: no roof over it (the rooftop) */
  open: boolean
}
/** One straight flight of a stair: it climbs from y0 at its low edge to y1 at its high edge. */
export interface RampRun { lv: number; cells: { x: number; z: number }[]; dir: [number, number]; y0: number; y1: number }
/** A flat landing between two flights, where a stair turns a corner. */
export interface Landing { lv: number; cells: { x: number; z: number }[]; y: number }
/** A whole stair, bottom floor to the floor above: its flights and landings in climbing order. */
export interface Stair { lv: number; y0: number; y1: number; flights: RampRun[]; landings: Landing[] }
export interface Building {
  cols: number
  rows: number
  levels: Level[]
  /** every flight of every stair (what the renderer tilts) */
  ramps: RampRun[]
  landings: Landing[]
  stairs: Stair[]
}

const RAMP_DIR: Record<string, [number, number]> = { '^': [0, -1], 'v': [0, 1], '<': [-1, 0], '>': [1, 0] }
const FIXTURES = '@XRFH'
export const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function kindOf(ch: string): Kind {
  if (ch === ' ') return K.VOID
  if (ch === '.' || ch === 'p' || FIXTURES.includes(ch)) return K.FLOOR
  if (ch === 'u') return K.BLOCK
  if (ch === 'o') return K.LANDING
  if (ch === '#') return K.WALL
  if (ch === '|') return K.RAIL
  if (ch === 'w') return K.WINDOW
  if (ch in RAMP_DIR) return K.RAMP
  if (ch >= 'A' && ch <= 'Z') return K.GATE
  throw new Error(`hold: unknown plan character '${ch}'`)
}

export function buildHold(floors: readonly FloorDef[] = HOLD_FLOORS, cols = HOLD_COLS, rows = HOLD_ROWS): Building {
  const n = cols * rows
  const levels: Level[] = floors.map((f, i) => {
    const lv: Level = { name: f.name, y: BASE_Y + i * STOREY, kind: new Uint8Array(n), sy: new Float32Array(n), ch: new Array(n).fill(' '), tone: new Uint8Array(n), open: !!f.open }
    for (const p of f.parts) {
      const w = p.rows[0].length
      p.rows.forEach((r, dz) => {
        if (r.length !== w) throw new Error(`hold: ${f.name} row ${dz} is ${r.length} wide, not ${w}`)
        for (let dx = 0; dx < w; dx++) {
          const x = p.x + dx, z = p.z + dz, ch = r[dx]
          if (x < 0 || z < 0 || x >= cols || z >= rows) throw new Error(`hold: ${f.name} runs off the grid at ${x},${z}`)
          if (ch === ' ') continue
          const i2 = z * cols + x
          lv.kind[i2] = kindOf(ch); lv.ch[i2] = ch; lv.sy[i2] = ch === 'u' ? lv.y + BLOCK_H : lv.y
          if (p.tone === 'garden') lv.tone[i2] = 1
          if (ch === 'p') lv.tone[i2] = 2
        }
      })
    }
    return lv
  })
  // stairs: a connected set of flight cells (arrows) and landings ('o'). Each FLIGHT is a run of one
  // arrow and climbs along it; a landing is flat. The flights chain end to end through the landings,
  // and the storey is shared out between the flights by length, so every step is the same height and
  // a stair can turn as many corners as it likes.
  const ramps: RampRun[] = [], landings: Landing[] = [], stairs: Stair[] = []
  const comp = (lv: Level, i0: number, same: (i: number) => boolean, seen: Uint8Array) => {
    const cells: { x: number; z: number }[] = [], stack = [i0]
    seen[i0] = 1
    while (stack.length) {
      const c = stack.pop()!, x = c % cols, z = (c / cols) | 0
      cells.push({ x, z })
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, ni = nz * cols + nx
        if (nx >= 0 && nz >= 0 && nx < cols && nz < rows && !seen[ni] && same(ni)) { seen[ni] = 1; stack.push(ni) }
      }
    }
    return cells
  }
  const isStair = (lv: Level, i: number) => lv.kind[i] === K.RAMP || lv.kind[i] === K.LANDING
  levels.forEach((lv, li) => {
    const seenStair = new Uint8Array(n), seenPiece = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      if (!isStair(lv, i) || seenStair[i]) continue
      const all = comp(lv, i, j => isStair(lv, j), seenStair)
      const up = levels[li + 1]
      const at = all[0]
      if (!up) throw new Error(`hold: a stair on ${lv.name} (the top floor) has no floor to climb to`)
      // the pieces: flights (one arrow each) and landings
      type Piece = { cells: { x: number; z: number }[]; dir: [number, number] | null; lo: number; len: number }
      const pieces: Piece[] = []
      const pieceOf = new Map<number, number>()
      for (const c of all) {
        const ci = c.z * cols + c.x
        if (seenPiece[ci]) continue
        const ch = lv.ch[ci]
        const cells = comp(lv, ci, j => lv.ch[j] === ch, seenPiece)
        const dir = lv.kind[ci] === K.RAMP ? RAMP_DIR[ch] : null
        const along = (q: { x: number; z: number }) => dir ? q.x * dir[0] + q.z * dir[1] : 0
        const lo = dir ? Math.min(...cells.map(along)) : 0
        const len = dir ? Math.max(...cells.map(along)) - lo + 1 : 0
        for (const q of cells) pieceOf.set(q.z * cols + q.x, pieces.length)
        pieces.push({ cells, dir, lo, len })
      }
      const cellAt = (x: number, z: number) => (x < 0 || z < 0 || x >= cols || z >= rows ? -1 : z * cols + x)
      const walkable = (L: Level, ci: number) => ci >= 0 && (L.kind[ci] === K.FLOOR || L.kind[ci] === K.GATE)
      // the first flight is the one whose low edge steps off this floor
      const start = pieces.findIndex(p => p.dir && p.cells.some(q => {
        const along = q.x * p.dir![0] + q.z * p.dir![1]
        return along === p.lo && walkable(lv, cellAt(q.x - p.dir![0], q.z - p.dir![1]))
      }))
      if (start < 0) throw new Error(`hold: the stair at ${at.x},${at.z} on ${lv.name} has no foot on the floor (its first flight's low end must face floor)`)
      // walk the chain: each next piece touches the one before
      const order = [start], used = new Set([start])
      for (;;) {
        const cur = pieces[order[order.length - 1]]
        let next = -1
        for (const q of cur.cells) for (const [dx, dz] of DIRS) {
          const ci = cellAt(q.x + dx, q.z + dz), pi = ci >= 0 ? pieceOf.get(ci) : undefined
          if (pi !== undefined && !used.has(pi)) next = pi
        }
        if (next < 0) break
        order.push(next); used.add(next)
      }
      if (used.size !== pieces.length) throw new Error(`hold: the stair at ${at.x},${at.z} branches; a stair is one path of flights and landings`)
      const total = order.reduce((a, k) => a + pieces[k].len, 0)
      if (total < STOREY) throw new Error(`hold: the stair at ${at.x},${at.z} is ${total} long; a storey needs ${STOREY}`)
      const rise = (steps: number) => lv.y + (STOREY * steps) / total
      const stair: Stair = { lv: li, y0: lv.y, y1: up.y, flights: [], landings: [] }
      let base = 0
      for (const k of order) {
        const p = pieces[k]
        for (const q of p.cells) {
          const ci = q.z * cols + q.x
          if (up.kind[ci] !== K.VOID) throw new Error(`hold: ${up.name} is not open over the stair at ${q.x},${q.z}`)
          lv.sy[ci] = p.dir ? rise(base + (q.x * p.dir[0] + q.z * p.dir[1]) - p.lo + 0.5) : rise(base)
        }
        if (p.dir) {
          const f: RampRun = { lv: li, cells: p.cells, dir: p.dir, y0: rise(base), y1: rise(base + p.len) }
          stair.flights.push(f); ramps.push(f)
        } else {
          const l: Landing = { lv: li, cells: p.cells, y: rise(base) }
          stair.landings.push(l); landings.push(l)
        }
        base += p.len
      }
      // the last flight tops out onto the floor above
      const last = pieces[order[order.length - 1]]
      if (!last.dir) throw new Error(`hold: the stair at ${at.x},${at.z} ends on a landing, not a flight`)
      const hi = last.lo + last.len - 1
      const tops = last.cells.filter(q => q.x * last.dir![0] + q.z * last.dir![1] === hi)
      if (!tops.every(q => walkable(up, cellAt(q.x + last.dir![0], q.z + last.dir![1]))))
        throw new Error(`hold: the stair at ${at.x},${at.z} tops out on no floor of ${up.name}`)
      stairs.push(stair)
    }
  })
  return { cols, rows, levels, ramps, landings, stairs }
}

export interface Surface { lv: number; y: number; kind: Kind }

/** Every surface in a cell that something can stand on (floor, ramp, and the gate/window openings
 *  whose passability the caller decides), lowest first. */
export function surfacesAt(b: Building, x: number, z: number): Surface[] {
  const out: Surface[] = []
  if (x < 0 || z < 0 || x >= b.cols || z >= b.rows) return out
  const i = z * b.cols + x
  for (let lv = 0; lv < b.levels.length; lv++) {
    const L = b.levels[lv], k = L.kind[i] as Kind
    if (k === K.FLOOR || k === K.RAMP || k === K.LANDING || k === K.BLOCK || k === K.GATE || k === K.WINDOW) out.push({ lv, y: L.sy[i], kind: k })
  }
  return out
}

/** The floor a height belongs to: its storey band runs from just under the floor to just under the next. */
export function levelOfY(b: Building, y: number): number {
  const i = Math.floor((y - BASE_Y + 0.5) / STOREY)
  return i < 0 || i >= b.levels.length ? -1 : i
}

/** The plan kind at a cell on a floor (VOID off the grid). */
export function kindAt(b: Building, lv: number, x: number, z: number): Kind {
  if (lv < 0 || lv >= b.levels.length || x < 0 || z < 0 || x >= b.cols || z >= b.rows) return K.VOID
  return b.levels[lv].kind[z * b.cols + x] as Kind
}

/**
 * Is there a solid thing at (x, z) at height `y`? Walls fill their storey; a rail stops what is below
 * RAIL_H over its floor. `open(lv, i)` says whether a gate/window cell is open to whoever is asking —
 * the keeper never passes a window; a flooded body passes one whose seals are gone.
 */
export function solidAt(b: Building, x: number, z: number, y: number, open: (lv: number, i: number, k: Kind) => boolean): boolean {
  const lv = levelOfY(b, y)
  if (lv < 0) return false
  const L = b.levels[lv], i = z * b.cols + x
  if (x < 0 || z < 0 || x >= b.cols || z >= b.rows) return true
  const k = L.kind[i] as Kind
  if (k === K.WALL) return true
  if (k === K.RAIL) return y < L.y + RAIL_H
  if (k === K.BLOCK) return y < L.y + BLOCK_H - 0.1
  if (k === K.GATE || k === K.WINDOW) return !open(lv, i, k)
  return false
}

/** Does a round at height `y` hit a floor slab, a ramp, or the roof in this cell? */
export function slabAt(b: Building, x: number, z: number, y: number): boolean {
  if (x < 0 || z < 0 || x >= b.cols || z >= b.rows) return true
  const i = z * b.cols + x
  for (const L of b.levels) {
    const k = L.kind[i]
    if (k === K.VOID) continue
    if (k === K.RAMP || k === K.LANDING) { if (y <= L.sy[i] && y > L.sy[i] - 0.5) return true; continue }
    if (y <= L.y && y > L.y - 0.3) return true
  }
  const top = b.levels[b.levels.length - 1]
  if (!top.open && top.kind[i] !== K.VOID && y >= top.y + STOREY && y < top.y + STOREY + 0.3) return true
  return false
}

/** The zone's flat views: a grid (FLOOR where any floor has anything, VOID elsewhere) and each cell's
 *  HIGHEST surface — only a fallback; the walker reads `surfacesAt` through its collision context. */
export function flatViews(b: Building, tiles: { FLOOR: number; VOID: number }): { grid: number[][]; heights: number[][] } {
  const grid: number[][] = [], heights: number[][] = []
  for (let z = 0; z < b.rows; z++) {
    const g: number[] = [], h: number[] = []
    for (let x = 0; x < b.cols; x++) {
      const i = z * b.cols + x
      let top = -1
      for (let lv = 0; lv < b.levels.length; lv++) if (b.levels[lv].kind[i] !== K.VOID) top = lv
      g.push(top < 0 ? tiles.VOID : tiles.FLOOR)
      h.push(top < 0 ? 0 : b.levels[top].sy[i] || b.levels[top].y)
    }
    grid.push(g); heights.push(h)
  }
  return { grid, heights }
}
