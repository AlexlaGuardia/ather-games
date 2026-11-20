// ── PLOT WALLS: build your own house on the home plot, Sims-style (BETA M37 slice 1; Alex 11-19, world d5a9e927) ─────
// Look signed on docs/looks/plot-walls.html; canon [RULED] athernyx e0ecc99 (a house goes up from crafted pieces, plain
// plan mode at the planning table, Co. iron = trim only).
//
// A wall is a run of 1 m PIECES on the plot's metre grid. Each piece is one grid EDGE between two corners:
//   'h,i,j' runs along x from (i, j) to (i+1, j)      'v,i,j' runs along z from (i, j) to (i, j+1)      (i, j = world metres)
// Pieces are as thick and tall as the prefab rooms' walls (rooms.ts WALL_T / WALL_H) and each one overruns its corners by
// half a thickness, so an L or a T closes with no gap and no seam (the mock's rule).
// Slice 1 = straight runs, drawn and erased in plan mode, solid to the walker, saved with the plot (Works.walls).
// Cost (interim, until slice 4's crafted wall pieces): 1 plank of the wall's wood per metre, all of it back on erase.
// PURE: no three, no react, no rooms.ts (rooms.ts imports THIS for its overlap checks).
import type { Box } from '../terrain-world'
import { countOf, take, give, itemDef, type Inv } from '../shared/inventory'

export const WALL_T = 0.3, WALL_H = 4.8   // BETA M50 (Alex 11-20: "50% taller walls so the rooms feel a little bigger"; was 3.2). = rooms.ts (a drawn wall and a room's wall are one family); rooms.test asserts it
export const MAX_RUN = 24                  // the longest run one drag lays (metres)
export const MAX_WALLS = 600               // pieces on one plot
export const WALL_MATS = {
  goldwood: { name: 'Goldwood', item: 'goldwood_plank', color: '#d2a157' },
  shimmeroak: { name: 'Shimmeroak', item: 'shimmeroak_plank', color: '#a79bbd' },
  dawnwood: { name: 'Dawnwood', item: 'dawnwood_plank', color: '#c27a5b' },
  // M37 slice 5 (Alex 11-20): walls come in WOOD and BRICK, each a SET colour (the material's own, never painted), and STONE = a
  // STUCCO that takes any colour. Brick is laid from Stone Brick, stucco from Stucco (both cut at the Stonery, furniture.ts).
  brick: { name: 'Brick', item: 'stone_brick', color: '#a4573f' },
  stucco: { name: 'Stucco', item: 'stucco', color: '#dcd3c2' },
} as const
export type WallMat = keyof typeof WALL_MATS
export const WALL_MAT_ORDER = Object.keys(WALL_MATS) as WallMat[]
export const WOOD_ORDER = ['goldwood', 'shimmeroak', 'dawnwood'] as const
export const isWood = (m: WallMat) => (WOOD_ORDER as readonly string[]).includes(m)
/** only stucco takes paint (a wood and a brick wall keep their own colour) */
export const paintable = (m: WallMat) => m === 'stucco'
export const SWATCHES = ['#dcd3c2', '#f2ece0', '#e9c9a0', '#d98c6a', '#b5543c', '#e3b94f', '#8fae7a', '#5f8a6e', '#7fa6c4', '#4c6b97', '#9b82b5', '#5b5560'] as const
export const isColour = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)
/** the colour a wall piece shows: stucco its paint (cream until painted), everything else its material's own */
export const wallColour = (w: Wall): string => (w.mat === 'stucco' && w.tint ? w.tint : WALL_MATS[w.mat].color)
/** kind (slice 3): a plain wall, half of a 2 m DOOR (open from the floor to DOOR_H) or a WINDOW (a crystal pane SILL..WIN_TOP) */
/** draft (M37 slice 4): a PLAN, not yet built: drawn for free, shown as a blueprint, not solid, spends nothing and refunds nothing.
 *  A piece with no `draft` is BUILT, so every wall saved before slice 4 stands as it did. */
export interface Wall { mat: WallMat; tint?: string; kind?: 'door' | 'window'; draft?: true }
const keep = (w: Wall, over: Partial<Wall>): Wall => ({ ...w, ...over })
export const DOOR_H = 2.2, SILL = 1.0, WIN_TOP = 2.2
export type Walls = Readonly<Record<string, Wall>>
export interface Corner { i: number; j: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }

/** the grid corner nearest a ground point */
export const snapCorner = (x: number, z: number): Corner => ({ i: Math.round(x), j: Math.round(z) })
/** a drag from `a` toward `b`, made straight (the longer axis wins) and no longer than MAX_RUN */
export function straighten(a: Corner, b: Corner): Corner {
  const di = b.i - a.i, dj = b.j - a.j, cap = (d: number) => Math.max(-MAX_RUN, Math.min(MAX_RUN, d))
  return Math.abs(di) >= Math.abs(dj) ? { i: a.i + cap(di), j: a.j } : { i: a.i, j: a.j + cap(dj) }
}
/** the pieces a straight run covers (empty when a == b) */
export function runKeys(a: Corner, b: Corner): string[] {
  const s = straighten(a, b), out: string[] = []
  if (s.j === a.j) for (let i = Math.min(a.i, s.i); i < Math.max(a.i, s.i); i++) out.push(`h,${i},${a.j}`)
  else for (let j = Math.min(a.j, s.j); j < Math.max(a.j, s.j); j++) out.push(`v,${a.i},${j}`)
  return out
}
export function parseKey(k: string): { o: 'h' | 'v'; i: number; j: number } | null {
  const m = /^([hv]),(-?\d+),(-?\d+)$/.exec(k); return m ? { o: m[1] as 'h' | 'v', i: +m[2], j: +m[3] } : null
}
/** a piece's footprint on the ground, overrun by half a thickness at each end (corners close) */
export function edgeRect(k: string): Rect {
  const e = parseKey(k)!, t = WALL_T / 2
  return e.o === 'h' ? { x0: e.i - t, x1: e.i + 1 + t, z0: e.j - t, z1: e.j + t } : { x0: e.i - t, x1: e.i + t, z0: e.j - t, z1: e.j + 1 + t }
}
/** the piece's two corners, for "is this on ground you hold" */
export function edgeEnds(k: string): [number, number][] {
  const e = parseKey(k)!; return e.o === 'h' ? [[e.i, e.j], [e.i + 1, e.j]] : [[e.i, e.j], [e.i, e.j + 1]]
}
/** solid boxes for the walker (y0 sits under the ground like a room's walls) */
export const wallBoxes = (walls: Walls, groundY: number): Box[] =>
  Object.entries(walls).filter(([, w]) => !w.draft).map(([k, w]) => { const r = edgeRect(k); return { ...r, y0: w.kind === 'door' ? groundY + DOOR_H : groundY - 0.5, y1: groundY + WALL_H } })   // a door: only its lintel is solid
export const wallRects = (walls: Walls): Rect[] => Object.keys(walls).map(edgeRect)

export type Verdict = { ok: true; add: string[]; cost: number } | { ok: false; why: string }
/** What the plot asks of a new run. `blocked` = the rooms', chests' and furniture's rectangles + named keep-clear
 *  circles; `held(x, z)` = is that point on ground the keeper holds. Pieces already standing are skipped (free). */
export function canLay(walls: Walls, keys: string[], mat: WallMat, held: (x: number, z: number) => boolean,
  blocked: { rects: { r: Rect; why: string }[]; circles: readonly { x: number; z: number; r: number }[] }, inv?: Inv): Verdict {
  const add = keys.filter(k => !walls[k])
  if (!add.length) return { ok: false, why: keys.length ? 'That wall is already up.' : 'Drag to draw a wall.' }
  if (Object.keys(walls).length + add.length > MAX_WALLS) return { ok: false, why: `${MAX_WALLS} metres of wall already stand. Take some down first.` }
  for (const k of add) {
    if (!edgeEnds(k).every(([x, z]) => held(x, z))) return { ok: false, why: 'Build on ground you hold.' }
    const r = edgeRect(k)
    for (const c of blocked.circles) {
      const px = Math.max(r.x0, Math.min(c.x, r.x1)), pz = Math.max(r.z0, Math.min(c.z, r.z1))
      if (Math.hypot(px - c.x, pz - c.z) < c.r) return { ok: false, why: 'Leave room around the gate, Gregory and the table.' }
    }
    for (const b of blocked.rects) if (r.x0 < b.r.x1 && r.x1 > b.r.x0 && r.z0 < b.r.z1 && r.z1 > b.r.z0) return { ok: false, why: b.why }
  }
  const item = WALL_MATS[mat].item
  if (inv && countOf(inv, item) < add.length) return { ok: false, why: `${add.length} ${itemDef(item).name} needed, ${countOf(inv, item)} in the bag.` }
  return { ok: true, add, cost: add.length }
}
/** lay the run: the new pieces stand, their planks leave the bag */
export function lay(walls: Walls, inv: Inv, add: string[], mat: WallMat): { walls: Walls; inv: Inv } | null {
  const t = take(inv, WALL_MATS[mat].item, add.length); if (!t) return null
  const next: Record<string, Wall> = { ...walls }; for (const k of add) next[k] = { mat }
  return { walls: next, inv: t }
}
/** M37 slice 4: draw a run as a PLAN: the new pieces are drafts, nothing leaves the bag (plot-bom.ts lists what building them takes) */
export function planRun(walls: Walls, add: string[], mat: WallMat): Walls {
  const next: Record<string, Wall> = { ...walls }; for (const k of add) next[k] = { mat, draft: true }; return next
}
/** take a run down: every standing piece under it comes down and its plank comes back (what the bag cannot hold stays up) */
export function raze(walls: Walls, inv: Inv, keys: string[]): { walls: Walls; inv: Inv; down: number; full: boolean } {
  const next: Record<string, Wall> = { ...walls }
  let bag = inv, down = 0, full = false
  for (const k of keys) {
    const w = next[k]; if (!w) continue
    if (w.draft) { delete next[k]; down++; continue }   // a plan: nothing was spent, nothing comes back
    let g = give(bag, WALL_MATS[w.mat].item, 1); if (g.left) { full = true; break }
    if (w.kind === 'window') { const gp = give(g.inv, 'crystal_pane', 1); if (gp.left) { full = true; break }; g = gp }   // a built window's pane comes back too
    bag = g.inv; delete next[k]; down++
  }
  return { walls: next, inv: bag, down, full }
}
/** load-side: keep only well-formed pieces of a known wood */
export function adoptWalls(v: unknown): Walls {
  const out: Record<string, Wall> = {}
  if (v && typeof v === 'object') for (const [k, w] of Object.entries(v as Record<string, { mat?: string }>)) {
    if (parseKey(k) && w && typeof w.mat === 'string' && w.mat in WALL_MATS) { const kd = (w as Wall).kind === 'door' || (w as Wall).kind === 'window' ? { kind: (w as Wall).kind } : {}; out[k] = { mat: w.mat as WallMat, ...(w.mat === 'stucco' && isColour((w as Wall).tint) ? { tint: (w as Wall).tint!.toLowerCase() } : {}), ...kd, ...((w as Wall).draft === true ? { draft: true as const } : {}) } }
  }
  return out
}

// ── M37 slice 2: ROOMS, FLOORS, ROOFS (the mock's rules) ────────────────────────────────────────────────────────────
// A room is whatever the outside cannot reach: flood from beyond the walls' bounding box, crossing any grid edge that has
// no piece on it; every 1 m cell left over belongs to a room (cells joined the same way). Cell (i, j) = the square
// [i, i+1] × [j, j+1]. A rectangular room gets the house's roof style; any other shape gets a flat roof over its cells.
export const ROOF_STYLES = ['gable', 'hip', 'flat'] as const
export type RoofStyle = typeof ROOF_STYLES[number]
export const ROOF_OVER = 0.3, ROOF_PITCH = 0.72, LOW_WALL = 0.7   // eave overhang (m), rise per metre of half-span, walls-down height
export interface PlotRoom { cells: [number, number][]; rect: Rect | null; key: string }
const crossKey = (i: number, j: number, di: number, dj: number) => (di ? `v,${i + Math.max(di, 0)},${j}` : `h,${i},${j + Math.max(dj, 0)}`)
const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export function findRooms(walls: Walls): PlotRoom[] {
  const keys = Object.keys(walls); if (keys.length < 4) return []
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity
  for (const k of keys) for (const [x, z] of edgeEnds(k)) { i0 = Math.min(i0, x); j0 = Math.min(j0, z); i1 = Math.max(i1, x); j1 = Math.max(j1, z) }
  i0 -= 1; j0 -= 1   // cells i0..i1 cover the box plus a ring outside it
  const id = (i: number, j: number) => `${i},${j}`, out = new Set<string>(), q: [number, number][] = []
  for (let i = i0; i <= i1; i++) for (const j of [j0, j1]) if (!out.has(id(i, j))) { out.add(id(i, j)); q.push([i, j]) }
  for (let j = j0; j <= j1; j++) for (const i of [i0, i1]) if (!out.has(id(i, j))) { out.add(id(i, j)); q.push([i, j]) }
  while (q.length) {
    const [i, j] = q.pop()!
    for (const [di, dj] of STEPS) {
      const a = i + di, b = j + dj
      if (a < i0 || b < j0 || a > i1 || b > j1 || out.has(id(a, b)) || walls[crossKey(i, j, di, dj)]) continue
      out.add(id(a, b)); q.push([a, b])
    }
  }
  const seen = new Set<string>(), rooms: PlotRoom[] = []
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    if (out.has(id(i, j)) || seen.has(id(i, j))) continue
    const cells: [number, number][] = [], st: [number, number][] = [[i, j]]; seen.add(id(i, j))
    while (st.length) {
      const [a, b] = st.pop()!; cells.push([a, b])
      for (const [di, dj] of STEPS) {
        const c = a + di, d = b + dj
        if (out.has(id(c, d)) || seen.has(id(c, d)) || walls[crossKey(a, b, di, dj)]) continue
        seen.add(id(c, d)); st.push([c, d])
      }
    }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
    for (const [a, b] of cells) { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, a + 1); z1 = Math.max(z1, b + 1) }
    cells.sort((p, r) => p[0] - r[0] || p[1] - r[1])
    rooms.push({ cells, rect: cells.length === (x1 - x0) * (z1 - z0) ? { x0, x1, z0, z1 } : null, key: `${cells[0][0]},${cells[0][1]}:${cells.length}` })
  }
  return rooms
}
/** a roof as flat triangles (x, y, z per vertex; y from the wall top `y`): `roof` = the sloped skin, `ends` = the gable
 *  triangles over the wall line (drawn in the wall's wood). A non-rectangular room gets a flat slab per cell. */
export function roofMesh(room: PlotRoom, style: RoofStyle, y: number): { roof: number[]; ends: number[]; slabs: Rect[] } {
  const o = ROOF_OVER
  if (style === 'flat' || !room.rect) return { roof: [], ends: [], slabs: room.rect ? [{ x0: room.rect.x0 - o, x1: room.rect.x1 + o, z0: room.rect.z0 - o, z1: room.rect.z1 + o }] : room.cells.map(([i, j]) => ({ x0: i - 0.1, x1: i + 1.1, z0: j - 0.1, z1: j + 1.1 })) }
  const r = room.rect, alongX = r.x1 - r.x0 >= r.z1 - r.z0
  const [u0, u1, v0, v1] = alongX ? [r.x0 - o, r.x1 + o, r.z0 - o, r.z1 + o] : [r.z0 - o, r.z1 + o, r.x0 - o, r.x1 + o]
  const P = (u: number, yy: number, v: number) => (alongX ? [u, yy, v] : [v, yy, u])
  const half = (v1 - v0) / 2, vc = (v0 + v1) / 2, top = y + half * ROOF_PITCH
  const quad = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d]
  if (style === 'gable') {
    const ends: number[] = []   // the gable triangle sits on the end wall, its apex just under the ridge
    for (const u of [u0 + o, u1 - o]) ends.push(...P(u, y, v0 + o), ...P(u, y, v1 - o), ...P(u, top - 0.05, vc))
    return { roof: [...quad(P(u0, y, v0), P(u1, y, v0), P(u1, top, vc), P(u0, top, vc)), ...quad(P(u0, y, v1), P(u1, y, v1), P(u1, top, vc), P(u0, top, vc))], ends, slabs: [] }
  }
  const mid = (u0 + u1) / 2, r0 = Math.min(u0 + half, mid), r1 = Math.max(u1 - half, mid)
  return { roof: [
    ...quad(P(u0, y, v0), P(u1, y, v0), P(r1, top, vc), P(r0, top, vc)),
    ...quad(P(u0, y, v1), P(u1, y, v1), P(r1, top, vc), P(r0, top, vc)),
    ...P(u0, y, v0), ...P(u0, y, v1), ...P(r0, top, vc),
    ...P(u1, y, v0), ...P(u1, y, v1), ...P(r1, top, vc),
  ], ends: [], slabs: [] }
}
export const adoptRoof = (v: unknown): RoofStyle => (ROOF_STYLES as readonly string[]).includes(v as string) ? v as RoofStyle : 'gable'

// ── M37 slice 3: DOORS, WINDOWS, PAINT (taps in plan mode) ─────────────────────────────────────────────────────────
/** the standing piece nearest a ground point, within `reach` m of its centre line (null when none) */
export function pieceAt(walls: Walls, x: number, z: number, reach = 0.6): string | null {
  let best: string | null = null, bd = reach
  for (const k of Object.keys(walls)) {
    const e = parseKey(k)!, [ax, az, bx, bz] = e.o === 'h' ? [e.i, e.j, e.i + 1, e.j] : [e.i, e.j, e.i, e.j + 1]
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)))), d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t))
    if (d < bd) { bd = d; best = k }
  }
  return best
}
/** the two pieces either side of `k` along its own line */
const along = (k: string): [string, string] => { const e = parseKey(k)!; return e.o === 'h' ? [`h,${e.i + 1},${e.j}`, `h,${e.i - 1},${e.j}`] : [`v,${e.i},${e.j + 1}`, `v,${e.i},${e.j - 1}`] }
/** a piece with its door / window cut back out (it keeps its wood and its draft) */
const plain = (w: Wall): Wall => ({ mat: w.mat, ...(w.tint ? { tint: w.tint } : {}), ...(w.draft ? { draft: true as const } : {}) })
export type Change = { ok: true; walls: Walls; said: string } | { ok: false; why: string }
/** a door takes 2 m: the tapped piece and a plain neighbour on its line. Tapping a door fills both halves back in. */
export function toggleDoor(walls: Walls, k: string): Change {
  const w = walls[k]; if (!w) return { ok: false, why: 'Tap a wall to put a door in it.' }
  const next: Record<string, Wall> = { ...walls }
  if (w.kind === 'door') {
    next[k] = plain(w)
    for (const n of along(k)) if (next[n]?.kind === 'door') { next[n] = plain(next[n]); break }
    return { ok: true, walls: next, said: 'Door filled in.' }
  }
  const mate = along(k).find(n => next[n] && !next[n].kind)
  if (!mate) return { ok: false, why: 'A door needs 2 m of plain wall.' }
  next[k] = keep(w, { kind: 'door' }); next[mate] = keep(next[mate], { kind: 'door' })
  return { ok: true, walls: next, said: 'A doorway.' }
}
/** a window is one metre: tap a plain piece for a pane, tap a window to fill it in */
export function toggleWindow(walls: Walls, k: string): Change {
  const w = walls[k]; if (!w) return { ok: false, why: 'Tap a wall to put a window in it.' }
  if (w.kind === 'door') return { ok: false, why: 'That is a doorway.' }
  return { ok: true, walls: { ...walls, [k]: w.kind === 'window' ? plain(w) : keep(w, { kind: 'window' }) }, said: w.kind === 'window' ? 'Window filled in.' : 'A window.' }
}
/** PAINT a wall (slice 5): only STUCCO takes it, any colour, free (a door's two halves go together). Wood and brick keep their
 *  own colour: the verdict says so. */
export function paintWall(walls: Walls, k: string, colour: string): { walls: Walls } | { why: string } {
  const w = walls[k]; if (!w) return { why: 'Tap a wall to paint it.' }
  if (!paintable(w.mat)) return { why: `${WALL_MATS[w.mat].name} keeps its own colour. Only stucco takes paint.` }
  if (!isColour(colour)) return { why: 'That is not a colour.' }
  const c = colour.toLowerCase(), ks = [k, ...(w.kind === 'door' ? along(k).filter(n => walls[n]?.kind === 'door' && walls[n].mat === 'stucco').slice(0, 1) : [])]
  if (ks.every(n => wallColour(walls[n]) === c)) return { why: 'Already that colour.' }
  const next: Record<string, Wall> = { ...walls }; for (const n of ks) next[n] = { ...next[n], tint: c }
  return { walls: next }
}
/** FLOORS (slice 5): a pattern and a colour per cell, set a whole room at once, every pattern freely paintable. A pattern costs
 *  its base material per m² (wood patterns planks, stone patterns bricks); a colour is free. Unset cells = plain goldwood planks. */
export const FLOOR_PATS = {
  planks: { name: 'Planks', item: 'goldwood_plank', color: '#d2a157' },
  herringbone: { name: 'Herringbone', item: 'goldwood_plank', color: '#c08a4e' },
  tile: { name: 'Tile', item: 'stone_brick', color: '#b9b2a6' },
  flagstone: { name: 'Flagstone', item: 'stone_brick', color: '#8d8a84' },
} as const
export type FloorPat = keyof typeof FLOOR_PATS
export const FLOOR_PAT_ORDER = Object.keys(FLOOR_PATS) as FloorPat[]
export const FLOOR_PER_M2 = 1
export interface Floor { pat: FloorPat; col: string }
export type Floors = Readonly<Record<string, Floor>>
export const DEFAULT_FLOOR: Floor = { pat: 'planks', col: FLOOR_PATS.planks.color }
export const floorOf = (floors: Floors | undefined, i: number, j: number): Floor => floors?.[`${i},${j}`] ?? DEFAULT_FLOOR
/** a room's floor as laid: its first cell's (a room is set whole) */
export const roomFloor = (floors: Floors | undefined, room: PlotRoom): Floor => floorOf(floors, room.cells[0][0], room.cells[0][1])
/** the room whose key ('i,j:n') names it: the floor a vanished room had is its first cell's */
export const floorByKey = (floors: Floors | undefined, key: string): Floor => { const [c] = key.split(':'); const [i, j] = c.split(',').map(Number); return floorOf(floors, i, j) }
export function paintFloor(floors: Floors | undefined, room: PlotRoom, pat: FloorPat, col: string): Floors {
  const next: Record<string, Floor> = { ...(floors ?? {}) }; for (const [i, j] of room.cells) next[`${i},${j}`] = { pat, col }; return next
}
/** set a room's floor. A BUILT room whose base material changes swaps it: the new pattern's m² in, the old m² back (the bag
 *  only; the plan pays in the list). A plan, or a colour-only change, is free. */
export function setFloor(floors: Floors | undefined, room: PlotRoom, pat: FloorPat, col: string, built: boolean, inv: Inv): { floors: Floors; inv: Inv } | { why: string } {
  if (!isColour(col)) return { why: 'That is not a colour.' }
  const was = roomFloor(floors, room), n = room.cells.length * FLOOR_PER_M2, a = FLOOR_PATS[was.pat].item, b = FLOOR_PATS[pat].item
  let bag = inv
  if (built && a !== b) {
    const t = take(inv, b, n); if (!t) return { why: `${n} ${itemDef(b).name} needed for that floor, ${countOf(inv, b)} in the bag.` }
    const g = give(t, a, n); if (g.left) return { why: 'Your bag is full: no room for the old floor.' }
    bag = g.inv
  }
  return { floors: paintFloor(floors, room, pat, col.toLowerCase()), inv: bag }
}
export function adoptFloors(v: unknown): Floors {
  const out: Record<string, Floor> = {}
  if (v && typeof v === 'object') for (const [k, m] of Object.entries(v as Record<string, unknown>)) {
    if (!/^-?\d+,-?\d+$/.test(k)) continue
    if (typeof m === 'string' && m in WALL_MATS) out[k] = { pat: 'planks', col: WALL_MATS[m as WallMat].color }   // slice 3 saved a wood per cell: it stays that wood, as planks
    else if (m && typeof m === 'object') { const f = m as { pat?: unknown; col?: unknown }; if (typeof f.pat === 'string' && f.pat in FLOOR_PATS && isColour(f.col)) out[k] = { pat: f.pat as FloorPat, col: f.col.toLowerCase() } }
  }
  return out
}
/** the room a ground point stands in (null outside every room) */
export const roomAt = (rooms: PlotRoom[], x: number, z: number) => { const i = Math.floor(x), j = Math.floor(z); return rooms.find(r => r.cells.some(([a, b]) => a === i && b === j)) ?? null }

/** M37 slice 4: which rooms' floor + roof are BUILT (room key to its m², what building it cost in planks and bricks).
 *  A save from before slice 4 has none, so every room its built walls close counts as built (grandfathered, never un-built). */
export type Paid = Readonly<Record<string, number>>
export function adoptPaid(v: unknown, walls: Walls): Paid {
  if (v && typeof v === 'object') {
    const out: Record<string, number> = {}
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.floor(n)
    return out
  }
  const built: Record<string, Wall> = {}; for (const [k, w] of Object.entries(walls)) if (!w.draft) built[k] = w
  const out: Record<string, number> = {}; for (const r of findRooms(built)) out[r.key] = r.cells.length
  return out
}
