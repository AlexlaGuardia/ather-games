// ── PLOT STAIRS (BETA M56 slice 1; Alex 11-20: "plus stairs and other basic building pieces") ─────────────────────────────
// A straight stair: STEPS treads of TREAD m, each rising STOREY/STEPS (≈0.42 m, under the walker's 0.5 m step rule), so it
// climbs exactly one storey over RUN m. WIDTH cells wide. It stands on level k (keyed by its LOW start cell 'i,j') and leads
// up to level k+1; the slab above gets a hole over its footprint so the keeper's head clears it. dir = which way it climbs:
// 0 north (−z), 1 east (+x), 2 south (+z), 3 west (−x). Material = any wall material; cost STEPS of its item. PURE.
import type { Box } from '../terrain-world'
import { WALL_MATS, WALL_H, edgeEnds, findRooms, type WallMat, type Walls } from './plot-walls'
/** = plot-floors STOREY (WALL_H + SLAB_T 0.2). Not imported: plot-floors imports this module, and a top-level read across that
 *  cycle would hit an uninitialised const. plot-stairs.test asserts the two agree. */
export const STAIR_STOREY = WALL_H + 0.2

export const STEPS = 12, TREAD = 0.5, RUN = STEPS * TREAD, WIDTH = 2
export const RISE = STAIR_STOREY / STEPS
export type Dir = 0 | 1 | 2 | 3
export interface Stair { mat: WallMat; dir: Dir; draft?: true }
export type Stairs = Readonly<Record<string, Stair>>
const F: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] }
const R: Record<Dir, [number, number]> = { 0: [1, 0], 1: [0, 1], 2: [-1, 0], 3: [0, -1] }
export const parseStair = (k: string): { i: number; j: number } | null => { const m = /^(-?\d+),(-?\d+)$/.exec(k); return m ? { i: +m[1], j: +m[2] } : null }
/** the yaw a view faces -> the quarter a stair placed from it climbs (away from the camera) */
export const dirOfYaw = (yaw: number): Dir => (((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4) as Dir
// yaw 0 looks −z (north) = dir 0; yaw −π/2 looks +x = dir 1 (three.js rotation.y: forward (−sin, −cos))

/** the cells a stair covers: RUN along its climb, WIDTH to its right */
export function stairCells(i: number, j: number, dir: Dir): [number, number][] {
  const [fx, fz] = F[dir], [rx, rz] = R[dir], out: [number, number][] = []
  for (let a = 0; a < RUN; a++) for (let b = 0; b < WIDTH; b++) out.push([i + fx * a + rx * b, j + fz * a + rz * b])
  return out
}
/** one solid box per step, from below the level's floor up to the step's top (base = the level's floor y) */
export function stairBoxes(k: string, s: Stair, base: number): Box[] {
  const p = parseStair(k)!, [fx, fz] = F[s.dir], [rx, rz] = R[s.dir], out: Box[] = []
  // the start edge's two corners on the low side, in cell-centre terms: centre of (i,j) minus half a cell forward
  const cx = p.i + 0.5 - fx * 0.5, cz = p.j + 0.5 - fz * 0.5
  for (let n = 0; n < STEPS; n++) {
    const a0 = n * TREAD, a1 = (n + 1) * TREAD
    const xs = [cx + fx * a0 - rx * 0.5, cx + fx * a1 - rx * 0.5, cx + fx * a0 + rx * (WIDTH - 0.5), cx + fx * a1 + rx * (WIDTH - 0.5)]
    const zs = [cz + fz * a0 - rz * 0.5, cz + fz * a1 - rz * 0.5, cz + fz * a0 + rz * (WIDTH - 0.5), cz + fz * a1 + rz * (WIDTH - 0.5)]
    out.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: base - 0.5, y1: base + (n + 1) * RISE })
  }
  return out
}
export function adoptStairs(v: unknown): Stairs {
  const out: Record<string, Stair> = {}
  if (v && typeof v === 'object') for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
    if (!parseStair(k) || !s || typeof s !== 'object') continue
    const x = s as { mat?: unknown; dir?: unknown; draft?: unknown }
    if (typeof x.mat !== 'string' || !(x.mat in WALL_MATS) || ![0, 1, 2, 3].includes(x.dir as number)) continue
    out[k] = { mat: x.mat as WallMat, dir: x.dir as Dir, ...(x.draft === true ? { draft: true as const } : {}) }
  }
  return out
}
/** every cell any stair on this level covers ('i,j') */
export const stairCellSet = (st: Stairs | undefined) => new Set(Object.entries(st ?? {}).flatMap(([k, s]) => { const p = parseStair(k)!; return stairCells(p.i, p.j, s.dir).map(([a, b]) => `${a},${b}`) }))

export type StairChange = { ok: true; stairs: Stairs; said: string; refund?: { id: string; n: number } } | { ok: false; why: string }
/** the Stairs tool's tap at cell (i, j): a tap on a stair's cells takes it away (a built one with its cost back); otherwise a
 *  DRAFT stair starts here climbing `dir`. `cellOk(i,j)`: may a stair stand on that cell (ground held / a slab below). Refuses
 *  a wall crossing the footprint and an overlap with another stair. */
export function toggleStair(st: Stairs | undefined, walls: Walls, i: number, j: number, dir: Dir, mat: WallMat, cellOk: (i: number, j: number) => boolean): StairChange {
  const next: Record<string, Stair> = { ...(st ?? {}) }
  for (const [k, s] of Object.entries(st ?? {})) {
    const p = parseStair(k)!
    if (stairCells(p.i, p.j, s.dir).some(([a, b]) => a === i && b === j)) { delete next[k]; return { ok: true, stairs: next, said: s.draft ? 'Stairs taken off the plan.' : 'Stairs down.', ...(s.draft ? {} : { refund: { id: WALL_MATS[s.mat].item, n: STEPS } }) } }
  }
  const cells = stairCells(i, j, dir), set = new Set(cells.map(([a, b]) => `${a},${b}`))
  if (!cells.every(([a, b]) => cellOk(a, b))) return { ok: false, why: 'Stairs need ground you hold (or a floor under them) all the way up.' }
  if ([...stairCellSet(st)].some(c => set.has(c))) return { ok: false, why: 'Another stair is in the way.' }
  // a wall whose both sides are stair cells cuts the run
  for (const w of Object.keys(walls)) { const [[x0, z0], [x1, z1]] = edgeEnds(w); const sides = x0 === x1 ? [[x0 - 1, z0], [x0, z0]] : [[x0, z0 - 1], [x0, z0]]; void x1; void z1; if (sides.every(([a, b]) => set.has(`${a},${b}`))) return { ok: false, why: 'A wall cuts across the stairs.' } }
  next[`${i},${j}`] = { mat, dir, draft: true }
  return { ok: true, stairs: next, said: 'Stairs, on the plan.' }
}
export const stairNeeds = (st: Stairs | undefined) => { const m = new Map<string, number>(); for (const s of Object.values(st ?? {})) if (s.draft) { const id = WALL_MATS[s.mat].item; m.set(id, (m.get(id) ?? 0) + STEPS) } return [...m].map(([id, n]) => ({ id, n })) }
export const draftStairs = (st: Stairs | undefined) => Object.values(st ?? {}).filter(s => s.draft).length
export function standStairs(st: Stairs | undefined): Stairs { const out: Record<string, Stair> = {}; for (const [k, s] of Object.entries(st ?? {})) { const { draft: _d, ...rest } = s; void _d; out[k] = rest } return out }
/** may an upper-level stair stand: every cell on a built room of its own level (its floor is that level's slab) */
export function stairStandsOn(levelWalls: Walls, k: string, s: Stair): boolean {
  const cells = new Set(findRooms(levelWalls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`))), p = parseStair(k)!
  return stairCells(p.i, p.j, s.dir).every(([a, b]) => cells.has(`${a},${b}`))
}

/** M56 (c): the edges round the holes these stairs cut in the floor above (keys as plot-walls edges): an edge of a hole cell whose
 *  other side is floor (`slab`, the level above's slab cells) and not hole, minus the arrival end (the edge the top step leads out
 *  through) and minus any edge `walls` (that level's pieces) already holds. */
export function holeRails(st: Stairs | undefined, slab: ReadonlySet<string>, walls: Walls): { key: string; mat: WallMat }[] {
  const hole = stairCellSet(st), out: { key: string; mat: WallMat }[] = [], seen = new Set<string>()
  for (const [k, s] of Object.entries(st ?? {})) {
    if (s.draft) continue
    const p = parseStair(k)!, [fx, fz] = F[s.dir], cells = stairCells(p.i, p.j, s.dir)
    const top = new Set(cells.slice((RUN - 1) * WIDTH).map(([a, b]) => `${a + fx},${b + fz}`))   // the cells the top step leads onto
    for (const [a, b] of cells) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = `${a + di},${b + dj}`
      if (hole.has(n) || !slab.has(n) || (top.has(n) && di === fx && dj === fz)) continue
      const key = di ? `v,${a + Math.max(di, 0)},${b}` : `h,${a},${b + Math.max(dj, 0)}`
      if (walls[key] || seen.has(key)) continue
      seen.add(key); out.push({ key, mat: s.mat })
    }
  }
  return out
}
