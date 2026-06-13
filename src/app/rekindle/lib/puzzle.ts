// REKINDLE — puzzle core. Pure, deterministic, no DOM.
// Rotate conduits to route Ather from coloured sources to matching cores. The
// twist: a tile reached by two different source-colours goes MIXED, and a pure
// core won't accept mixed Ather. So the puzzle is to keep flows SEPARATE and
// route each colour home — not just connect everything.

// sides: 0=N 1=E 2=S 3=W ; bit = 1<<side
export const N = 1, E = 2, S = 4, W = 8
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]
export const opposite = (d: number) => (d + 2) & 3

export type Role = 'wire' | 'source' | 'core' | 'empty'
export type Hue = 'cyan' | 'amber' | 'rose'

export interface Cell {
  base: number // open-sides mask in the SOLVED orientation
  rot: number // 0..3 quarter-turns currently applied
  role: Role
  fixed: boolean // source/core/empty never rotate
  hue?: Hue // source: the colour it emits; core: the colour it needs
}

export interface Level {
  name: string
  cols: number
  rows: number
  grid: Cell[][] // [row][col]
  charge: number // max rotations allowed (set at scramble — fair but tight)
  par: number // rotations for a 3-star clear
}

export function rotMask(mask: number, rot: number): number {
  let m = 0
  for (let s = 0; s < 4; s++) if (mask & (1 << s)) m |= 1 << ((s + rot) & 3)
  return m
}

export const openSides = (c: Cell) => (c.role === 'empty' ? 0 : rotMask(c.base, c.rot))

// ── authoring ───────────────────────────────────────────────────────────────
type Spec =
  | number
  | { s: number; h?: Hue }
  | { c: number; h?: Hue }
  | 0

const wire = (base: number): Cell => ({ base, rot: 0, role: 'wire', fixed: false })
const gap = (): Cell => ({ base: 0, rot: 0, role: 'empty', fixed: true })

function template(name: string, rows: Spec[][]): Omit<Level, 'charge' | 'par'> {
  const grid = rows.map((row) =>
    row.map((cell): Cell => {
      if (cell === 0) return gap()
      if (typeof cell === 'number') return wire(cell)
      if ('s' in cell) return { base: cell.s, rot: 0, role: 'source', fixed: true, hue: cell.h ?? 'cyan' }
      return { base: cell.c, rot: 0, role: 'core', fixed: true, hue: cell.h ?? 'cyan' }
    }),
  )
  return { name, cols: rows[0].length, rows: rows.length, grid }
}

// ── connectivity components + colour ─────────────────────────────────────────
export interface Solve {
  powered: Set<string> // cells in a component that contains >=1 source
  hue: Map<string, Hue | 'mixed'> // display colour for powered cells
  coresLit: Set<string> // cores whose required colour is satisfied (pure match)
  done: boolean // every core lit
}

export function solveState(l: Level): Solve {
  const { grid, rows, cols } = l
  const comp = new Map<string, number>()
  const compHues: Set<Hue>[] = []
  const compHasSource: boolean[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]
      if (cell.role === 'empty' || comp.has(`${r},${c}`)) continue
      const id = compHues.length
      compHues.push(new Set())
      compHasSource.push(false)
      // BFS the connected component over mutual open sides
      const q: [number, number][] = [[r, c]]
      comp.set(`${r},${c}`, id)
      while (q.length) {
        const [cr, cc] = q.shift()!
        const cur = grid[cr][cc]
        if (cur.role === 'source') {
          compHasSource[id] = true
          if (cur.hue) compHues[id].add(cur.hue)
        }
        const o = openSides(cur)
        for (let d = 0; d < 4; d++) {
          if (!(o & (1 << d))) continue
          const nr = cr + DY[d], nc = cc + DX[d]
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
          const nb = grid[nr][nc]
          if (nb.role === 'empty') continue
          if (!(openSides(nb) & (1 << opposite(d)))) continue
          const k = `${nr},${nc}`
          if (comp.has(k)) continue
          comp.set(k, id)
          q.push([nr, nc])
        }
      }
    }
  }

  const powered = new Set<string>()
  const hue = new Map<string, Hue | 'mixed'>()
  const coresLit = new Set<string>()
  for (const [key, id] of comp) {
    if (!compHasSource[id]) continue
    powered.add(key)
    const hues = compHues[id]
    hue.set(key, hues.size === 1 ? [...hues][0] : 'mixed')
  }
  let done = true
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]
      if (cell.role !== 'core') continue
      const key = `${r},${c}`
      const h = hue.get(key)
      if (h && h !== 'mixed' && h === cell.hue) coresLit.add(key)
      else done = false
    }
  }
  return { powered, hue, coresLit, done }
}

// thin compat shims
export const energized = (l: Level) => solveState(l).powered
export const solved = (l: Level, s?: Solve) => (s ?? solveState(l)).done

export function cloneLevel(l: Level): Level {
  return { ...l, grid: l.grid.map((row) => row.map((c) => ({ ...c }))) }
}

// minimal taps to turn a wire back into an orientation matching its authored mask
function restoreTaps(cell: Cell): number {
  for (let k = 0; k < 4; k++) if (rotMask(cell.base, (cell.rot + k) & 3) === cell.base) return k
  return 0
}

/** scramble wire rotations (seeded), never hand back a solved board, and set a
 *  FAIR-but-tight charge: always enough to restore the authored solution, never
 *  generous. par = that restore cost (the 3-star target). */
export function scramble(base: Omit<Level, 'charge' | 'par'>, seed: number): Level {
  const lv: Level = { ...cloneLevel(base as Level), charge: 0, par: 0 }
  let s = seed >>> 0
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const roll = () => {
    for (const row of lv.grid) for (const cell of row) if (!cell.fixed) cell.rot = Math.floor(rnd() * 4) & 3
  }
  roll()
  for (let a = 0; a < 12 && solved(lv); a++) roll()
  if (solved(lv)) {
    for (const row of lv.grid) for (const cell of row) if (!cell.fixed) { cell.rot = (cell.rot + 1) & 3; break }
  }
  let cost = 0
  for (const row of lv.grid) for (const cell of row) if (!cell.fixed) cost += restoreTaps(cell)
  lv.par = cost
  lv.charge = cost + Math.max(3, Math.ceil(cost * 0.45))
  return lv
}

// star rating for a finished level
export function stars(used: number, par: number, charge: number): 1 | 2 | 3 {
  if (used <= par) return 3
  if (used <= par + Math.ceil((charge - par) / 2)) return 2
  return 1
}

// ── levels (authored solved; scrambled at load) ─────────────────────────────
// L0-L2 single-colour (teach connectivity). L3+ introduce colour purity.
const C: Hue = 'cyan', A: Hue = 'amber'
export const TEMPLATES = [
  template('First Light', [
    [{ s: E }, W | S, 0, 0],
    [0, N | S, 0, 0],
    [0, N | E, W | E, { c: W }],
  ]),
  template('The Fork', [
    [{ s: S }, 0, 0, { c: S }, 0],
    [N | E, W | E, W | E, N | W | S, 0],
    [0, 0, 0, N | S, 0],
    [0, { c: E }, W | E, N | W, 0],
  ]),
  template('Crossing', [
    [{ s: E }, W | S, 0, { s: S }, 0],
    [0, N | E, W | E, N | E | S | W, W | S],
    [0, 0, 0, N | S, N | S],
    [0, 0, 0, { c: N }, { c: N }],
  ]),
  // colour debut: two hues on their own rails — keep each current flowing home
  template('Two Currents', [
    [{ s: E, h: C }, W | E, W | S, 0, 0],
    [0, 0, N | E, W | E, { c: W, h: C }],
    [{ s: E, h: A }, W | E, W | S, 0, 0],
    [0, 0, N | E, W | E, { c: W, h: A }],
  ]),
  // tangled but separable: a wrong turn merges the veins and muddies them
  template('Pure Veins', [
    [{ s: E, h: C }, W | E, W | S, 0, 0],
    [0, 0, N | S, 0, 0],
    [0, 0, N | E, W | E, { c: W, h: C }],
    [0, 0, 0, 0, 0],
    [{ s: E, h: A }, W | E, W | E, W | E, { c: W, h: A }],
  ]),
]

export const LEVELS: Level[] = TEMPLATES.map((t, i) => scramble(t, ((i + 1) * 2654435761) >>> 0))
