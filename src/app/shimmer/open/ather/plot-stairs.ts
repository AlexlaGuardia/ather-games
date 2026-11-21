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
/** M56 LANDING TURN (11-21): a stair may turn a quarter at a landing half way up: FLIGHT steps along `dir`, a WIDTH x WIDTH
 *  landing at the half storey, then FLIGHT steps to the keeper's right ('r') or left ('l'). Absent = straight. */
export type Turn = 'l' | 'r'
export interface Stair { mat: WallMat; dir: Dir; turn?: Turn; draft?: true }
export const FLIGHT = STEPS / 2
/** what a stair costs in its material's item: a tread each, and the landing (turned) as LANDING_COST more */
export const LANDING_COST = 4
export const stairCost = (s: Pick<Stair, 'turn'>) => STEPS + (s.turn ? LANDING_COST : 0)
export type Stairs = Readonly<Record<string, Stair>>
const F: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] }
const R: Record<Dir, [number, number]> = { 0: [1, 0], 1: [0, 1], 2: [-1, 0], 3: [0, -1] }
export const parseStair = (k: string): { i: number; j: number } | null => { const m = /^(-?\d+),(-?\d+)$/.exec(k); return m ? { i: +m[1], j: +m[2] } : null }
/** the yaw a view faces -> the quarter a stair placed from it climbs (away from the camera) */
export const dirOfYaw = (yaw: number): Dir => (((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4) as Dir
// yaw 0 looks −z (north) = dir 0; yaw −π/2 looks +x = dir 1 (three.js rotation.y: forward (−sin, −cos))

/** the stair's treads in its OWN frame: a = metres along `dir` from the start edge, b = metres to its right from the start cell's
 *  left edge; `top` = how many RISEs up the tread stands. Straight: STEPS treads. Turned: FLIGHT treads, the landing (one flat
 *  WIDTH x WIDTH tread at FLIGHT rises), then FLIGHT treads climbing right (b grows) or left (b shrinks) off the landing. */
export interface Tread { a0: number; a1: number; b0: number; b1: number; top: number }
export function treads(s: Pick<Stair, 'turn'>): Tread[] {
  if (!s.turn) return Array.from({ length: STEPS }, (_, n) => ({ a0: n * TREAD, a1: (n + 1) * TREAD, b0: 0, b1: WIDTH, top: n + 1 }))
  const out: Tread[] = [], la = FLIGHT * TREAD
  for (let n = 0; n < FLIGHT; n++) out.push({ a0: n * TREAD, a1: (n + 1) * TREAD, b0: 0, b1: WIDTH, top: n + 1 })
  out.push({ a0: la, a1: la + WIDTH, b0: 0, b1: WIDTH, top: FLIGHT })   // the landing: flush with the last step of the first flight
  for (let m = 0; m < FLIGHT; m++) {
    const [b0, b1] = s.turn === 'r' ? [WIDTH + m * TREAD, WIDTH + (m + 1) * TREAD] : [-(m + 1) * TREAD, -m * TREAD]
    out.push({ a0: la, a1: la + WIDTH, b0, b1, top: FLIGHT + 1 + m })
  }
  return out
}
/** the way the top step leads out (world quarter): `dir` straight, `dir` turned a quarter right / left when turned */
export const arrivalDir = (s: Pick<Stair, 'dir' | 'turn'>): Dir => (s.turn ? ((s.dir + (s.turn === 'r' ? 1 : 3)) % 4) : s.dir) as Dir
/** local (a, b) -> world, from the start cell (i, j) */
const toW = (i: number, j: number, dir: Dir, a: number, b: number): [number, number] => {
  const [fx, fz] = F[dir], [rx, rz] = R[dir]
  return [i + 0.5 - fx * 0.5 - rx * 0.5 + fx * a + rx * b, j + 0.5 - fz * 0.5 - rz * 0.5 + fz * a + rz * b]
}
const treadCells = (i: number, j: number, dir: Dir, t: Tread): [number, number][] => {
  const [fx, fz] = F[dir], [rx, rz] = R[dir], out: [number, number][] = []
  for (let A = Math.floor(t.a0); A < Math.ceil(t.a1); A++) for (let B = Math.floor(t.b0); B < Math.ceil(t.b1); B++) out.push([i + fx * A + rx * B, j + fz * A + rz * B])
  return out
}
/** the cells a stair covers: RUN along its climb, WIDTH to its right (straight); the first flight, the landing and the turned
 *  flight (turned). Each cell once, in climbing order. */
export function stairCells(i: number, j: number, dir: Dir, turn?: Turn): [number, number][] {
  const seen = new Set<string>(), out: [number, number][] = []
  for (const t of treads({ turn })) for (const c of treadCells(i, j, dir, t)) { const k = `${c[0]},${c[1]}`; if (!seen.has(k)) { seen.add(k); out.push(c) } }
  return out
}
/** one solid box per tread, from below the level's floor up to the tread's top (base = the level's floor y) */
export function stairBoxes(k: string, s: Stair, base: number): Box[] {
  const p = parseStair(k)!
  return treads(s).map(t => {
    const [xa, za] = toW(p.i, p.j, s.dir, t.a0, t.b0), [xb, zb] = toW(p.i, p.j, s.dir, t.a1, t.b1)
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb), y0: base - 0.5, y1: base + t.top * RISE }
  })
}
/** a turned stair's GUARD (M56 landing turn): the landing stands half a storey up with open sides, so a rail runs along the
 *  landing's far edge (on along the turned flight's far side) and along its side away from the turn; RAIL_T thick, inside the
 *  stair's cells, RAIL_UP above the tread it runs beside. It also keeps a keeper who overshoots the landing off its edge (the
 *  walker cannot step up from the very lip, measured 11-21). Straight stairs: none. */
export const RAIL_T = 0.25, RAIL_UP = 1   // 0.25: a keeper pressed against it (BODY_R 0.3) stands 0.55 m in, past the 0.5 m by the slab edge where the turned flight's headroom pinches (measured: 3.4 stuck, 3.5 climbs)
export function landingRails(k: string, s: Stair, base: number): Box[] {
  if (!s.turn) return []
  const p = parseStair(k)!, tr = treads(s), la = FLIGHT * TREAD, far = la + WIDTH, out: Box[] = []
  const seg = (a0: number, a1: number, b0: number, b1: number, top: number) => {
    const [xa, za] = toW(p.i, p.j, s.dir, a0, b0), [xb, zb] = toW(p.i, p.j, s.dir, a1, b1)
    out.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb), y0: base - 0.5, y1: base + top * RISE + RAIL_UP })
  }
  for (const t of tr.slice(FLIGHT)) seg(far - RAIL_T, far, t.b0, t.b1, t.top)                        // the far edge: the landing, then each turned step
  const side = s.turn === 'r' ? [0, RAIL_T] : [WIDTH - RAIL_T, WIDTH]                                // the landing's side away from the turn
  seg(la, far - RAIL_T, side[0], side[1], FLIGHT)
  return out
}
export function adoptStairs(v: unknown): Stairs {
  const out: Record<string, Stair> = {}
  if (v && typeof v === 'object') for (const [k, s] of Object.entries(v as Record<string, unknown>)) {
    if (!parseStair(k) || !s || typeof s !== 'object') continue
    const x = s as { mat?: unknown; dir?: unknown; turn?: unknown; draft?: unknown }
    if (typeof x.mat !== 'string' || !(x.mat in WALL_MATS) || ![0, 1, 2, 3].includes(x.dir as number)) continue
    out[k] = { mat: x.mat as WallMat, dir: x.dir as Dir, ...(x.turn === 'l' || x.turn === 'r' ? { turn: x.turn } : {}), ...(x.draft === true ? { draft: true as const } : {}) }
  }
  return out
}
/** every cell any stair on this level covers ('i,j') */
export const stairCellSet = (st: Stairs | undefined) => new Set(Object.entries(st ?? {}).flatMap(([k, s]) => { const p = parseStair(k)!; return stairCells(p.i, p.j, s.dir, s.turn).map(([a, b]) => `${a},${b}`) }))

export type StairChange = { ok: true; stairs: Stairs; said: string; refund?: { id: string; n: number } } | { ok: false; why: string }
/** the Stairs tool's tap at cell (i, j): a tap on a stair's cells takes it away (a built one with its cost back); otherwise a
 *  DRAFT stair starts here climbing `dir`. `cellOk(i,j)`: may a stair stand on that cell (ground held / a slab below). Refuses
 *  a wall crossing the footprint and an overlap with another stair. */
export function toggleStair(st: Stairs | undefined, walls: Walls, i: number, j: number, dir: Dir, mat: WallMat, cellOk: (i: number, j: number) => boolean, turn?: Turn): StairChange {
  const next: Record<string, Stair> = { ...(st ?? {}) }
  for (const [k, s] of Object.entries(st ?? {})) {
    const p = parseStair(k)!
    if (stairCells(p.i, p.j, s.dir, s.turn).some(([a, b]) => a === i && b === j)) { delete next[k]; return { ok: true, stairs: next, said: s.draft ? 'Stairs taken off the plan.' : 'Stairs down.', ...(s.draft ? {} : { refund: { id: WALL_MATS[s.mat].item, n: stairCost(s) } }) } }
  }
  const cells = stairCells(i, j, dir, turn), set = new Set(cells.map(([a, b]) => `${a},${b}`))
  if (!cells.every(([a, b]) => cellOk(a, b))) return { ok: false, why: 'Stairs need ground you hold (or a floor under them) all the way up.' }
  if ([...stairCellSet(st)].some(c => set.has(c))) return { ok: false, why: 'Another stair is in the way.' }
  // a wall whose both sides are stair cells cuts the run
  for (const w of Object.keys(walls)) { const [[x0, z0], [x1, z1]] = edgeEnds(w); const sides = x0 === x1 ? [[x0 - 1, z0], [x0, z0]] : [[x0, z0 - 1], [x0, z0]]; void x1; void z1; if (sides.every(([a, b]) => set.has(`${a},${b}`))) return { ok: false, why: 'A wall cuts across the stairs.' } }
  next[`${i},${j}`] = { mat, dir, ...(turn ? { turn } : {}), draft: true }
  return { ok: true, stairs: next, said: turn ? `Stairs turning ${turn === 'r' ? 'right' : 'left'} at a landing, on the plan.` : 'Stairs, on the plan.' }
}
export const stairNeeds = (st: Stairs | undefined) => { const m = new Map<string, number>(); for (const s of Object.values(st ?? {})) if (s.draft) { const id = WALL_MATS[s.mat].item; m.set(id, (m.get(id) ?? 0) + stairCost(s)) } return [...m].map(([id, n]) => ({ id, n })) }
export const draftStairs = (st: Stairs | undefined) => Object.values(st ?? {}).filter(s => s.draft).length
export function standStairs(st: Stairs | undefined): Stairs { const out: Record<string, Stair> = {}; for (const [k, s] of Object.entries(st ?? {})) { const { draft: _d, ...rest } = s; void _d; out[k] = rest } return out }
/** may an upper-level stair stand: every cell on a built room of its own level (its floor is that level's slab) */
export function stairStandsOn(levelWalls: Walls, k: string, s: Stair): boolean {
  const cells = new Set(findRooms(levelWalls).flatMap(r => r.cells.map(([a, b]) => `${a},${b}`))), p = parseStair(k)!
  return stairCells(p.i, p.j, s.dir, s.turn).every(([a, b]) => cells.has(`${a},${b}`))
}

/** M56 (c): the edges round the holes these stairs cut in the floor above (keys as plot-walls edges): an edge of a hole cell whose
 *  other side is floor (`slab`, the level above's slab cells) and not hole, minus the arrival end (the edge the top step leads out
 *  through) and minus any edge `walls` (that level's pieces) already holds. */
export function holeRails(st: Stairs | undefined, slab: ReadonlySet<string>, walls: Walls): { key: string; mat: WallMat }[] {
  const hole = stairCellSet(st), out: { key: string; mat: WallMat }[] = [], seen = new Set<string>()
  for (const [k, s] of Object.entries(st ?? {})) {
    if (s.draft) continue
    const p = parseStair(k)!, [fx, fz] = F[arrivalDir(s)], cells = stairCells(p.i, p.j, s.dir, s.turn), tr = treads(s)
    const top = new Set(treadCells(p.i, p.j, s.dir, tr[tr.length - 1]).map(([a, b]) => `${a + fx},${b + fz}`))   // the cells the top step leads onto
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
