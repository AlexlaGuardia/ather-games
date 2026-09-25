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

/** Blocks from one floor to the next. Low enough to read as a storey, not a hall. */
export const STOREY = 4
/** The bottom floor's height. The air below it is where the flooded climb up from. */
export const BASE_Y = STOREY

export const K = { VOID: 0, FLOOR: 1, WALL: 2, RAIL: 3, WINDOW: 4, GATE: 5, RAMP: 6 } as const
export type Kind = typeof K[keyof typeof K]
/** Waist-high: a rail stops a walker and a low round, not a round fired over it. */
export const RAIL_H = 1.0

export interface Level {
  name: string
  /** the floor's top, in blocks */
  y: number
  kind: Uint8Array
  /** the surface height of every walkable cell (a ramp's climbs; the rest sit at `y`) */
  sy: Float32Array
  /** the plan character at each cell (gate letters, fixtures) */
  ch: string[]
  /** 1 = a garden tint */
  tone: Uint8Array
}
export interface RampRun { lv: number; cells: { x: number; z: number }[]; dir: [number, number]; y0: number; y1: number }
export interface Building {
  cols: number
  rows: number
  levels: Level[]
  ramps: RampRun[]
}

const RAMP_DIR: Record<string, [number, number]> = { '^': [0, -1], 'v': [0, 1], '<': [-1, 0], '>': [1, 0] }
const FIXTURES = '@XRFH'
export const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function kindOf(ch: string): Kind {
  if (ch === ' ') return K.VOID
  if (ch === '.' || FIXTURES.includes(ch)) return K.FLOOR
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
    const lv: Level = { name: f.name, y: BASE_Y + i * STOREY, kind: new Uint8Array(n), sy: new Float32Array(n), ch: new Array(n).fill(' '), tone: new Uint8Array(n) }
    for (const p of f.parts) {
      const w = p.rows[0].length
      p.rows.forEach((r, dz) => {
        if (r.length !== w) throw new Error(`hold: ${f.name} row ${dz} is ${r.length} wide, not ${w}`)
        for (let dx = 0; dx < w; dx++) {
          const x = p.x + dx, z = p.z + dz, ch = r[dx]
          if (x < 0 || z < 0 || x >= cols || z >= rows) throw new Error(`hold: ${f.name} runs off the grid at ${x},${z}`)
          if (ch === ' ') continue
          const i2 = z * cols + x
          lv.kind[i2] = kindOf(ch); lv.ch[i2] = ch; lv.sy[i2] = lv.y
          if (p.tone === 'garden') lv.tone[i2] = 1
        }
      })
    }
    return lv
  })
  // ramps: each 4-connected run of one arrow climbs a storey along the arrow, smoothly — a cell's
  // surface is the slope's height at the cell's middle
  const ramps: RampRun[] = []
  levels.forEach((lv, li) => {
    const seen = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      if (lv.kind[i] !== K.RAMP || seen[i]) continue
      const ch = lv.ch[i], dir = RAMP_DIR[ch]
      const cells: { x: number; z: number }[] = [], stack = [i]
      seen[i] = 1
      while (stack.length) {
        const c = stack.pop()!, x = c % cols, z = (c / cols) | 0
        cells.push({ x, z })
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz, ni = nz * cols + nx
          if (nx >= 0 && nz >= 0 && nx < cols && nz < rows && !seen[ni] && lv.ch[ni] === ch) { seen[ni] = 1; stack.push(ni) }
        }
      }
      const along = (c: { x: number; z: number }) => c.x * dir[0] + c.z * dir[1]
      const lo = Math.min(...cells.map(along)), hi = Math.max(...cells.map(along)), len = hi - lo + 1
      const up = levels[li + 1]
      if (!up) throw new Error(`hold: a ramp on ${lv.name} (the top floor) has no floor to climb to`)
      if (len < STOREY) throw new Error(`hold: the ramp at ${cells[0].x},${cells[0].z} is ${len} long; a storey needs ${STOREY}`)
      for (const c of cells) {
        const ci = c.z * cols + c.x
        lv.sy[ci] = lv.y + (STOREY * (along(c) - lo + 0.5)) / len
        if (up.kind[ci] !== K.VOID) throw new Error(`hold: ${up.name} is not open over the ramp at ${c.x},${c.z}`)
        if (along(c) === hi) {
          const tx = c.x + dir[0], tz = c.z + dir[1], ti = tz * cols + tx
          if (up.kind[ti] !== K.FLOOR && up.kind[ti] !== K.GATE) throw new Error(`hold: the ramp at ${c.x},${c.z} tops out on no floor of ${up.name}`)
        }
      }
      ramps.push({ lv: li, cells, dir, y0: lv.y, y1: up.y })
    }
  })
  return { cols, rows, levels, ramps }
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
    if (k === K.FLOOR || k === K.RAMP || k === K.GATE || k === K.WINDOW) out.push({ lv, y: L.sy[i], kind: k })
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
    if (k === K.RAMP) { if (y <= L.sy[i] && y > L.sy[i] - 0.5) return true; continue }
    if (y <= L.y && y > L.y - 0.3) return true
  }
  const top = b.levels[b.levels.length - 1]
  if (top.kind[i] !== K.VOID && y >= top.y + STOREY && y < top.y + STOREY + 0.3) return true
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
      h.push(top < 0 ? 0 : b.levels[top].kind[i] === K.RAMP ? b.levels[top].sy[i] : b.levels[top].y)
    }
    grid.push(g); heights.push(h)
  }
  return { grid, heights }
}
