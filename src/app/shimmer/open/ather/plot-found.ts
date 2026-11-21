// ── PLOT FOUNDATION (BETA M55 slice 1; Alex 11-20: "a foundation to lift the build off the ground") ─────────────────────
// One setting for the keeper's house (slice 1): none, LOW 0.6 m or HIGH 1.2 m. The ground floor's BUILT rooms stand on a stone
// plinth that tall: every level, wall, column, stair and every piece of furniture / Keepstone / lift INSIDE a built room rides
// up by it (floorAt), and every ground-floor door gets steps down to the ground outside, each under the walker's 0.5 m step.
// Cost: Stone Brick per m² of plinth per 0.6 m (a built house pays the difference when the setting changes; a room built on a
// raised house pays its plinth on the list). PURE: no three, no react.
// ── SLICE 2 (11-21): PER HOUSE. A house = a connected set of ground-floor rooms (plot-walls connectedRooms, drafts included so a
// room planned onto a house inherits it). Each house has its own height, stored per ROOM CELL in Works.foundCells (set a whole
// house at once); a cell with no value takes its house's (the highest value any of its cells holds), and a house with none
// takes the old plot-wide Works.found, so an old save keeps every house where it stood. Everything reads its lift from one
// table (liftOf): a wall the higher of its two cells, a column the highest of its four, a stair / slab / piece its cell. A door
// between two different heights (a house and the ground, or two rooms that ended up at different heights when two houses
// were joined) gets steps on its LOWER side. A built patio (plot-decks) touching a raised house rides it, flush with its floor.
import type { Box } from '../terrain-world'
import { findRooms, connectedRooms, parseKey, WALL_T, type Walls, type Paid } from './plot-walls'
import type { Decks } from './plot-decks'
import { footprint, DOOR_W, type RoomKind } from './rooms'   // a cycle (rooms imports floorAt): both sides read the other only inside functions
// ── PREFAB ROOMS (M55 leftover, 11-21): a prefab room (Works.rooms: the Rinnshop, Farm, Cooking room ...) is a HOUSE of its own for
// the foundation: the picker sets it like a drawn house, it stores its height on the room (Room.found; none = the old plot-wide
// value), its plinth is its footprint (walls included), everything inside it rides up (floorAt), its door gets steps outside.

export const FOUND_OPTS = [0, 0.6, 1.2] as const
export type FoundH = (typeof FOUND_OPTS)[number]
export const FOUND_NAME: Record<FoundH, string> = { 0: 'None', 0.6: 'Low', 1.2: 'High' }
export const adoptFound = (v: unknown): FoundH => (FOUND_OPTS as readonly number[]).includes(v as number) ? (v as FoundH) : 0
/** bricks per m² of plinth: one per 0.6 m of height */
export const plinthPerM2 = (h: number) => Math.round(h / 0.6)

export interface PrefabRoom { id: string; kind: RoomKind; x: number; z: number; q: number; found?: number }
export interface Founded { walls?: Walls; paid?: Paid; found?: number; /** slice 2: per room cell 'i,j' */ foundCells?: Readonly<Record<string, number>>; decks?: Decks; /** the prefab rooms (Works.rooms) */ rooms?: readonly PrefabRoom[] }
export function adoptFoundCells(v: unknown): Record<string, FoundH> {
  const out: Record<string, FoundH> = {}
  if (v && typeof v === 'object') for (const [k, h] of Object.entries(v as Record<string, unknown>)) if (/^-?\d+,-?\d+$/.test(k) && (FOUND_OPTS as readonly number[]).includes(h as number)) out[k] = h as FoundH
  return out
}
const cache = new WeakMap<object, Set<string>>()
/** the cells of the ground floor's BUILT rooms: the plinth's top (cached per works object) */
export function plinthCells(w: Founded): Set<string> {
  const hit = cache.get(w); if (hit) return hit
  const paid = w.paid ?? {}, built: Walls = Object.fromEntries(Object.entries(w.walls ?? {}).filter(([, x]) => !x.draft))
  const s = new Set(findRooms(built).filter(r => paid[r.key]).flatMap(r => r.cells.map(([i, j]) => `${i},${j}`)))
  cache.set(w, s); return s
}
/** the old plot-wide setting: what a house with no per-cell value stands on */
export const foundH = (w: Founded) => adoptFound(w.found)
export interface House { cells: string[]; built: string[]; h: FoundH; /** a PREFAB room's house: its id and its footprint in m² (cells/built stay empty) */ room?: string; m2?: number }
/** a prefab room's plinth: its footprint and the half wall round it */
const prefabRect = (r: PrefabRoom) => { const f = footprint(r.kind, r.x, r.z, r.q), t = WALL_T / 2; return { x0: f.x0 - t, x1: f.x1 + t, z0: f.z0 - t, z1: f.z1 + t } }
/** a prefab room's foundation: its own value, else the old plot-wide one */
export const roomFound = (w: Founded, r: PrefabRoom): FoundH => (r.found === undefined ? foundH(w) : adoptFound(r.found))
const anyFound = (w: Founded) => !!foundH(w) || !!w.foundCells || !!w.rooms?.some(r => r.found)
export interface Lift {
  /** every house (connected ground rooms, drafts included), its cells, its BUILT cells (the plinth) and its height */
  houses: House[]
  /** the lift under cell (i, j): its house's height (built or planned), a riding patio's, else 0 */
  cell(i: number, j: number): number
  /** the lift of a built cell only (what is actually raised: floors, pieces, plinth); a planned room is not raised yet */
  floor(i: number, j: number): number
  edge(key: string): number
  corner(i: number, j: number): number
  /** the house containing or nearest (x, z) within `reach` m (by built cell centres; a prefab room by its footprint), else null */
  houseAt(x: number, z: number, reach?: number): House | null
  /** the foundation under (x, z) when it is inside a prefab room (walls included), else null */
  prefabAt(x: number, z: number): number | null
}
const liftCache = new WeakMap<object, Lift>()
const edgeCellsOf = (k: string): [number, number][] => { const e = parseKey(k)!; return e.o === 'h' ? [[e.i, e.j - 1], [e.i, e.j]] : [[e.i - 1, e.j], [e.i, e.j]] }
/** the foundation table for these works (cached per works object) */
export function liftOf(w: Founded): Lift {
  const hit = liftCache.get(w); if (hit) return hit
  const built = plinthCells(w), explicit = w.foundCells ?? {}, legacy = foundH(w)
  const rooms = findRooms(w.walls ?? {}), seen = new Set<string>(), houses: House[] = [], planned = new Map<string, number>()
  for (const r of rooms) {
    if (seen.has(r.key)) continue
    const group = connectedRooms(rooms, r); for (const g of group) seen.add(g.key)
    const cells = group.flatMap(g => g.cells.map(([i, j]) => `${i},${j}`))
    const vals = cells.map(c => explicit[c]).filter((v): v is number => v !== undefined)
    const dflt = (vals.length ? Math.max(...vals) : legacy) as FoundH
    // a house's height: one value for its cells (a cell set apart by a join keeps its own: see the slice 2 note)
    for (const c of cells) planned.set(c, explicit[c] ?? dflt)
    houses.push({ cells, built: cells.filter(c => built.has(c)), h: dflt })
  }
  // a built patio touching a raised built house rides it (the highest it touches), the whole patio as one
  const ride = new Map<string, number>(), deck = Object.entries(w.decks ?? {}).filter(([, d]) => !d.draft).map(([k]) => k), dset = new Set(deck), dseen = new Set<string>()
  const N: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (const start of deck) {
    if (dseen.has(start)) continue
    const comp: string[] = [], st = [start]; dseen.add(start)
    while (st.length) { const c = st.pop()!; comp.push(c); const [i, j] = c.split(',').map(Number); for (const [di, dj] of N) { const n = `${i + di},${j + dj}`; if (dset.has(n) && !dseen.has(n)) { dseen.add(n); st.push(n) } } }
    let h = 0
    for (const c of comp) { const [i, j] = c.split(',').map(Number); for (const [di, dj] of N) { const n = `${i + di},${j + dj}`; if (built.has(n)) h = Math.max(h, planned.get(n) ?? 0) } }
    if (h) for (const c of comp) ride.set(c, h)
  }
  const prefab = (w.rooms ?? []).map(r => { const f = footprint(r.kind, r.x, r.z, r.q); return { r, rect: prefabRect(r), h: roomFound(w, r), m2: (f.x1 - f.x0) * (f.z1 - f.z0) } })
  for (const p of prefab) houses.push({ cells: [], built: [], h: p.h, room: p.r.id, m2: p.m2 })
  const cell = (i: number, j: number) => { const k = `${i},${j}`; return planned.get(k) ?? ride.get(k) ?? 0 }
  const floor = (i: number, j: number) => { const k = `${i},${j}`; return built.has(k) ? (planned.get(k) ?? 0) : (ride.get(k) ?? 0) }
  const lift: Lift = {
    houses, cell, floor,
    edge: k => Math.max(...edgeCellsOf(k).map(([i, j]) => cell(i, j))),
    corner: (i, j) => Math.max(cell(i - 1, j - 1), cell(i, j - 1), cell(i - 1, j), cell(i, j)),
    houseAt(x, z, reach = 6) {
      let best: House | null = null, bd = reach
      for (const hs of houses) for (const c of hs.built) { const [i, j] = c.split(',').map(Number), d = Math.hypot(i + 0.5 - x, j + 0.5 - z); if (d < bd) { bd = d; best = hs } }
      for (const p of prefab) { const R = p.rect, d = Math.hypot(Math.max(R.x0 - x, 0, x - R.x1), Math.max(R.z0 - z, 0, z - R.z1)); if (d < bd) { bd = d; best = houses.find(hs => hs.room === p.r.id)! } }
      return best
    },
    prefabAt(x, z) { for (const p of prefab) if (x >= p.rect.x0 && x <= p.rect.x1 && z >= p.rect.z0 && z <= p.rect.z1) return p.h; return null },
  }
  liftCache.set(w, lift); return lift
}
/** the floor under (x, z): the ground, or the ground + its house's foundation inside a built ground-floor room (or a riding patio) */
export function floorAt(w: Founded, groundY: number, x: number, z: number): number {
  if (!anyFound(w)) return groundY
  const L = liftOf(w), p = L.prefabAt(x, z)
  return groundY + (p ?? L.floor(Math.floor(x), Math.floor(z)))
}
/** set one house's foundation: every one of its cells (planned ones too) to `h` */
export function setHouseFound<T extends Founded>(w: T, house: House, h: FoundH): T {
  if (house.room) return { ...w, rooms: (w.rooms ?? []).map(r => (r.id === house.room ? { ...r, found: h } : r)) }
  const fc: Record<string, number> = { ...(w.foundCells ?? {}) }; for (const c of house.cells) fc[c] = h
  return { ...w, foundCells: fc }
}
/** what moving one house from `from` to `to` costs (+) or gives back (−) in Stone Brick, over its built footprint */
export const houseFoundDelta = (house: House, from: number, to: number) => (house.m2 ?? house.built.length) * (plinthPerM2(to) - plinthPerM2(from))
/** a prefab room's lift (its walls, floor, bench and everything in it ride it) */
export const roomLift = (w: Founded, r: PrefabRoom) => (anyFound(w) ? roomFound(w, r) : 0)

/** the plinth's solids: a block under every built room cell, and under every built ground-floor wall (walls stand on its rim) */
export function plinthBoxes(w: Founded, groundY: number): Box[] {
  if (!anyFound(w)) return []
  const L = liftOf(w), out: Box[] = [], t = WALL_T / 2
  for (const c of plinthCells(w)) { const [i, j] = c.split(',').map(Number), h = L.floor(i, j); if (h) out.push({ x0: i, x1: i + 1, z0: j, z1: j + 1, y0: groundY - 0.5, y1: groundY + h }) }
  for (const [k, x] of Object.entries(w.walls ?? {})) {
    if (x.draft) continue
    const h = Math.max(...edgeCellsOf(k).map(([i, j]) => L.floor(i, j))); if (!h) continue   // a wall stands on the higher side's rim
    const e = parseKey(k)!; const r = e.o === 'h' ? { x0: e.i - t, x1: e.i + 1 + t, z0: e.j - t, z1: e.j + t } : { x0: e.i - t, x1: e.i + t, z0: e.j - t, z1: e.j + 1 + t }
    out.push({ ...r, y0: groundY - 0.5, y1: groundY + h })
  }
  for (const r of w.rooms ?? []) { const h = roomFound(w, r); if (h) out.push({ ...prefabRect(r), y0: groundY - 0.5, y1: groundY + h }) }
  return out
}
const OUT: Record<number, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] }   // a prefab room's front (its door) faces this way per quarter
/** the steps down from a raised prefab room's door: n steps outside the front wall, DOOR_W wide, each under 0.5 m */
export function prefabSteps(w: Founded, groundY: number): Box[] {
  const out: Box[] = []
  for (const r of w.rooms ?? []) {
    const h = roomFound(w, r); if (!h) continue
    const q = ((r.q % 4) + 4) % 4, [ox, oz] = OUT[q], f = footprint(r.kind, r.x, r.z, r.q), n = Math.ceil(h / 0.45) - 1
    const fx = ox > 0 ? f.x1 : ox < 0 ? f.x0 : r.x, fz = oz > 0 ? f.z1 : oz < 0 ? f.z0 : r.z   // the door's middle on the front wall
    for (let s = 0; s < n; s++) {
      const top = groundY + h * (n - s) / (n + 1), d0 = WALL_T / 2 + s * STEP_DEPTH, d1 = d0 + STEP_DEPTH
      if (ox) { const a = fx + ox * d0, b = fx + ox * d1; out.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: fz - DOOR_W / 2, z1: fz + DOOR_W / 2, y0: groundY - 0.5, y1: top }) }
      else { const a = fz + oz * d0, b = fz + oz * d1; out.push({ x0: fx - DOOR_W / 2, x1: fx + DOOR_W / 2, z0: Math.min(a, b), z1: Math.max(a, b), y0: groundY - 0.5, y1: top }) }
    }
  }
  return out
}
export const STEP_DEPTH = 0.45
/** the door steps: at every built ground-floor DOOR piece whose two sides stand at different heights (a house and the ground, or
 *  two rooms at different heights), n steps on the LOWER side, each under 0.5 m, from the low floor up to the high one */
export function doorSteps(w: Founded, groundY: number): Box[] {
  if (!anyFound(w)) return []
  const L = liftOf(w), out: Box[] = prefabSteps(w, groundY)
  for (const [k, x] of Object.entries(w.walls ?? {})) {
    if (x.draft || x.kind !== 'door') continue
    const e = parseKey(k)!
    const [a, b] = edgeCellsOf(k), ha = L.floor(a[0], a[1]), hb = L.floor(b[0], b[1])
    if (ha === hb) continue   // level both sides: no step
    const lo = Math.min(ha, hb), rise = Math.abs(ha - hb), n = Math.ceil(rise / 0.45) - 1
    const sgn = ha > hb ? 1 : -1    // the steps go toward the LOW side: +j (h) / +i (v) when A is the high side
    for (let s = 0; s < n; s++) {
      const top = groundY + lo + rise * (n - s) / (n + 1), d0 = WALL_T / 2 + s * STEP_DEPTH, d1 = d0 + STEP_DEPTH
      if (e.o === 'h') { const z0 = e.j + sgn * d0, z1 = e.j + sgn * d1; out.push({ x0: e.i, x1: e.i + 1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: groundY - 0.5, y1: top }) }
      else { const x0 = e.i + sgn * d0, x1 = e.i + sgn * d1; out.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: e.j, z1: e.j + 1, y0: groundY - 0.5, y1: top }) }
    }
  }
  return out
}
/** slice 1: what setting the WHOLE plot's foundation from `from` to `to` costs (kept for the old one-value saves' tests) */
export const foundDelta = (w: Founded, from: number, to: number) => plinthCells(w).size * (plinthPerM2(to) - plinthPerM2(from))
