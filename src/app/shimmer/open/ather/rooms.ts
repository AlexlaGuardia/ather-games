// THE WORKSHOP ROOMS + THE PLANNING TABLE — what a keeper builds on the home plot (2026-11-17, play / Jin 2 95f19652).
//
// Canon (game/ather-rework-2026-11.md › WORKSHOP ROOMS, RULED 11-16 + 11-17): no lone crafting stations; the keeper
// builds ROOMS through a planning table: alchemy, smith, cooking, carpentry, stonemason, and the RINNSHOP (rinsticks,
// bait, catches readied for the hearth). Jin's: the table, rooms, sizes, costs, timings, which Moglin trade pairs.
// Alex's design (11-16 night): a table you plan at, ghost-blue pieces, the mats listed at the table, scaffolding timed
// by the size of the job, deconstruct.
//
// ★ SLICE 1 builds WHOLE ROOMS (a room is one placed footprint), not wall-by-wall pieces. A room is the unit every
// canon line talks about, and a room you can stand in and use beats a wall kit you have to assemble before anything
// works. Pieces can come later inside the same footprint.
//
// ★ PURE: no React, no three, no DOM except the guarded load/save. Plot-local metres (plot.ts frame).
import type { Box } from '../terrain-world'
import { squareAt, sqId, GATE, GREG, THRESHOLD, PATH_START, GROUND_Y } from './plot'
import { gardenKey } from '@/lib/keeper-local'
import { countOf, take, type Inv } from '../shared/inventory'
import { MAX_CHESTS } from './garden-bank'

export type RoomKind = 'rinnshop' | 'cooking' | 'alchemy' | 'smith' | 'carpentry' | 'stonemason'
export interface RoomDef {
  name: string
  /** one short line for the table's card */
  blurb: string
  /** footprint in metres before turning: w across the front, d front to back */
  w: number; d: number
  cost: readonly { id: string; n: number }[]
  /** how long the scaffolding stands (the job's size) */
  raiseMs: number
  /** false = drawn on the table but not buildable yet (a coming-soon card, never a dead end) */
  open: boolean
}
// Costs are goldwood logs only on purpose: it is the one material a new keeper can gather (Forestry 1), and a room
// that asks for something you cannot reach yet is a locked door, not a choice. Tune with play.
export const ROOMS: Readonly<Record<RoomKind, RoomDef>> = {
  rinnshop:   { name: 'Rinnshop',   blurb: 'Make bait and, soon, rinsticks. Catches are readied here for the hearth.', w: 8, d: 6, cost: [{ id: 'goldwood_log', n: 16 }], raiseMs: 90_000, open: true },
  cooking:    { name: 'Cooking room', blurb: 'The hearth: roast rinn and more. Drawn up, not ready to build yet.', w: 8, d: 6, cost: [{ id: 'goldwood_log', n: 20 }], raiseMs: 120_000, open: false },
  alchemy:    { name: 'Alchemy room', blurb: 'Drawn up, not ready to build yet.', w: 8, d: 6, cost: [{ id: 'goldwood_log', n: 24 }], raiseMs: 120_000, open: false },
  smith:      { name: 'Smithy',     blurb: 'Works imported metal. Drawn up, not ready to build yet.', w: 8, d: 7, cost: [{ id: 'goldwood_log', n: 24 }], raiseMs: 150_000, open: false },
  carpentry:  { name: 'Carpentry room', blurb: 'Drawn up, not ready to build yet.', w: 8, d: 6, cost: [{ id: 'goldwood_log', n: 20 }], raiseMs: 120_000, open: false },
  stonemason: { name: 'Stonery',    blurb: 'Rubble in, stone and low gems out. Drawn up, not ready to build yet.', w: 8, d: 7, cost: [{ id: 'goldwood_log', n: 24 }], raiseMs: 150_000, open: false },
}
export const ROOM_ORDER: readonly RoomKind[] = ['rinnshop', 'cooking', 'alchemy', 'smith', 'carpentry', 'stonemason']

/** The planning table: a fixture beside Greg on the start ground. */
export const TABLE = { x: GREG.x + 6, z: GREG.z - 10 }
export const TABLE_REACH = 2.6
export const BENCH_REACH = 2.4
/** Ground kept clear of rooms: the gate and its threshold, Greg, the table, where a cluster's path leaves. */
export const KEEP_CLEAR: readonly { x: number; z: number; r: number }[] = [
  { x: GATE.x, z: GATE.z, r: 9 }, { x: THRESHOLD.x, z: THRESHOLD.z, r: 6 }, { x: GREG.x, z: GREG.z, r: 4 },
  { x: TABLE.x, z: TABLE.z, r: 4 }, { x: PATH_START.x, z: PATH_START.z, r: 10 },
]
export const WALL_H = 3.2, WALL_T = 0.3, DOOR_W = 2.2

/** A placed room. `q` = quarter turns (0..3); the door is on the front (local −z at q 0, turning with it). */
export interface Room { id: string; kind: RoomKind; x: number; z: number; q: number; placedAt: number; doneAt: number }
/** A chest the keeper placed: a door into the garden bank (garden-bank.ts). Each one adds CHEST_SLOTS. */
export interface Chest { id: string; x: number; z: number; q: number; placedAt: number }
export interface Works { v: 1; rooms: Room[]; chests: Chest[] }
export const freshWorks = (): Works => ({ v: 1, rooms: [], chests: [] })

const turned = (def: RoomDef, q: number) => (q % 2 === 0 ? { hw: def.w / 2, hd: def.d / 2 } : { hw: def.d / 2, hd: def.w / 2 })
/** The room's ground rectangle (axis-aligned: quarter turns only). */
export function footprint(kind: RoomKind, x: number, z: number, q: number) {
  const { hw, hd } = turned(ROOMS[kind], q)
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }
}
/** Local (across, depth) → plot metres. Front is local −z. */
export function toWorld(r: Pick<Room, 'x' | 'z' | 'q'>, lx: number, lz: number) {
  const q = ((r.q % 4) + 4) % 4
  const [wx, wz] = q === 0 ? [lx, lz] : q === 1 ? [-lz, lx] : q === 2 ? [-lx, -lz] : [lz, -lx]
  return { x: r.x + wx, z: r.z + wz }
}
/** Where you stand to work the room: just inside, before the back wall. */
export const benchOf = (r: Room) => toWorld(r, 0, ROOMS[r.kind].d / 2 - 1.4)
/** The door's middle, on the front wall. */
export const doorOf = (r: Room) => toWorld(r, 0, -ROOMS[r.kind].d / 2)

export type PlaceVerdict = { ok: true } | { ok: false; why: string }
export function canPlace(works: Works, owned: ReadonlySet<string>, kind: RoomKind, x: number, z: number, q: number, inv?: Inv): PlaceVerdict {
  const def = ROOMS[kind]
  if (!def.open) return { ok: false, why: `${def.name}: not ready to build yet.` }
  if (works.rooms.some(r => r.kind === kind)) return { ok: false, why: `You already have a ${def.name}.` }
  const f = footprint(kind, x, z, q)
  for (let sx = f.x0; sx <= f.x1 + 1e-6; sx += Math.min(2, f.x1 - f.x0)) for (let sz = f.z0; sz <= f.z1 + 1e-6; sz += Math.min(2, f.z1 - f.z0)) {
    const s = squareAt(Math.min(sx, f.x1 - 1e-3), Math.min(sz, f.z1 - 1e-3))
    if (!s || !owned.has(sqId(s.i, s.j))) return { ok: false, why: 'Build on ground you hold.' }
  }
  for (const k of KEEP_CLEAR) {
    const cx = Math.max(f.x0, Math.min(k.x, f.x1)), cz = Math.max(f.z0, Math.min(k.z, f.z1))
    if (Math.hypot(cx - k.x, cz - k.z) < k.r) return { ok: false, why: 'Too close to the gate, Gregory or the table.' }
  }
  for (const o of works.rooms) {
    const g = footprint(o.kind, o.x, o.z, o.q)
    if (f.x0 < g.x1 + 1 && f.x1 > g.x0 - 1 && f.z0 < g.z1 + 1 && f.z1 > g.z0 - 1) return { ok: false, why: `Overlaps your ${ROOMS[o.kind].name}.` }
  }
  if (inv) { const short = def.cost.find(c => countOf(inv, c.id) < c.n); if (short) return { ok: false, why: `Needs ${short.n} ${short.id.replace(/_/g, ' ')} (you have ${countOf(inv, short.id)}).` } }
  return { ok: true }
}
/** Place a room: the mats leave the bag and the scaffolding goes up. Null when it cannot. */
export function place(works: Works, owned: ReadonlySet<string>, inv: Inv, kind: RoomKind, x: number, z: number, q: number, now = Date.now()): { works: Works; inv: Inv; room: Room } | null {
  if (!canPlace(works, owned, kind, x, z, q, inv).ok) return null
  let out: Inv | null = inv
  for (const c of ROOMS[kind].cost) { out = out && take(out, c.id, c.n); if (!out) return null }
  const room: Room = { id: `${kind}-${now.toString(36)}`, kind, x: Math.round(x), z: Math.round(z), q: ((q % 4) + 4) % 4, placedAt: now, doneAt: now + ROOMS[kind].raiseMs }
  return { works: { ...works, rooms: [...works.rooms, room] }, inv: out!, room }
}
export const raised = (r: Room, now = Date.now()) => now >= r.doneAt
export const progress = (r: Room, now = Date.now()) => Math.max(0, Math.min(1, (now - r.placedAt) / Math.max(1, r.doneAt - r.placedAt)))

/** The walls a walker collides with: back + two sides + the front either side of the door. Scaffolding is solid too. */
export function wallsOf(r: Room): Box[] {
  const f = footprint(r.kind, r.x, r.z, r.q), y0 = GROUND_Y - 0.5, y1 = GROUND_Y + WALL_H, t = WALL_T
  const q = r.q % 4, out: Box[] = []
  const xs = (x0: number, x1: number, z0: number, z1: number) => out.push({ x0, x1, y0, y1, z0, z1 })
  // the four sides in world terms; the door side is the one the front faces
  const front = q === 0 ? 'z0' : q === 1 ? 'x1' : q === 2 ? 'z1' : 'x0'
  const side = (s: 'x0' | 'x1' | 'z0' | 'z1') => {
    const along = s[0] === 'z' ? [f.x0, f.x1] : [f.z0, f.z1], at = f[s], a0 = at - t / 2, a1 = at + t / 2
    const seg = (b0: number, b1: number) => (s[0] === 'z' ? xs(b0, b1, a0, a1) : xs(a0, a1, b0, b1))
    if (s !== front) { seg(along[0], along[1]); return }
    const mid = (along[0] + along[1]) / 2
    seg(along[0], mid - DOOR_W / 2); seg(mid + DOOR_W / 2, along[1])
  }
  for (const s of ['x0', 'x1', 'z0', 'z1'] as const) side(s)
  return out
}

/** The nearest thing the keeper can use with E, or null: the table, or a raised room's bench. */
export type WorkNear = { kind: 'table' } | { kind: 'bench'; room: Room } | { kind: 'raising'; room: Room } | { kind: 'chest' }
export function nearWork(works: Works, x: number, z: number, now = Date.now()): WorkNear | null {
  if (Math.hypot(TABLE.x - x, TABLE.z - z) < TABLE_REACH) return { kind: 'table' }
  // a chest and a bench can share a room: the nearer one answers E
  let best: WorkNear | null = null, bestD = Infinity
  for (const c of allChests(works)) { const d = Math.hypot(c.x - x, c.z - z); if (d < CHEST_REACH && d < bestD) { best = { kind: 'chest' }; bestD = d } }
  for (const r of works.rooms) {
    if (!raised(r, now)) { const d = doorOf(r); if (Math.hypot(d.x - x, d.z - z) < 3 && !best) return { kind: 'raising', room: r }; continue }
    const b = benchOf(r), d = Math.hypot(b.x - x, b.z - z); if (d < BENCH_REACH && d < bestD) { best = { kind: 'bench', room: r }; bestD = d }
  }
  return best
}

// ── chests: doors into the garden bank ────────────────────────────────────────────────────────────────────────
/** The plot's own chest, standing by the planning table from the first minute (garden-bank.ts says why). */
export const STARTER_CHEST: Chest = { id: 'starter', x: TABLE.x + 3.2, z: TABLE.z, q: 0, placedAt: 0 }
export const CHEST_W = 1.2, CHEST_D = 0.8, CHEST_H = 0.9, CHEST_REACH = 1.9
export const CHEST_COST: readonly { id: string; n: number }[] = [{ id: 'goldwood_log', n: 8 }]
export const allChests = (w: Works): Chest[] => [STARTER_CHEST, ...w.chests]
/** Chests standing, the starter included: what the bank's cap is counted from. */
export const chestsStanding = (w: Works) => 1 + w.chests.length
export function chestBox(c: Pick<Chest, 'x' | 'z' | 'q'>): Box {
  const [hw, hd] = c.q % 2 ? [CHEST_D / 2, CHEST_W / 2] : [CHEST_W / 2, CHEST_D / 2]
  return { x0: c.x - hw, x1: c.x + hw, y0: GROUND_Y - 0.5, y1: GROUND_Y + CHEST_H, z0: c.z - hd, z1: c.z + hd }
}
export function canPlaceChest(works: Works, owned: ReadonlySet<string>, x: number, z: number, q: number, inv?: Inv): PlaceVerdict {
  if (chestsStanding(works) >= MAX_CHESTS) return { ok: false, why: `${MAX_CHESTS} chests already stand on the plot.` }
  const k = chestBox({ x, z, q })
  for (const [cx, cz] of [[k.x0, k.z0], [k.x1, k.z0], [k.x0, k.z1], [k.x1, k.z1]]) {
    const s = squareAt(cx, cz); if (!s || !owned.has(sqId(s.i, s.j))) return { ok: false, why: 'Build on ground you hold.' }
  }
  for (const c of KEEP_CLEAR) {
    const px = Math.max(k.x0, Math.min(c.x, k.x1)), pz = Math.max(k.z0, Math.min(c.z, k.z1))
    if (Math.hypot(px - c.x, pz - c.z) < c.r) return { ok: false, why: 'Too close to the gate, Gregory or the table.' }
  }
  // inside a room is fine (a storeroom), but never in a wall, the doorway or at the bench
  const pad = 0.3
  for (const r of works.rooms) {
    if (wallsOf(r).some(b => k.x0 - pad < b.x1 && k.x1 + pad > b.x0 && k.z0 - pad < b.z1 && k.z1 + pad > b.z0)) return { ok: false, why: `In the wall of your ${ROOMS[r.kind].name}.` }
    const d = doorOf(r), b = benchOf(r)
    if (Math.hypot(d.x - x, d.z - z) < 1.8) return { ok: false, why: 'That blocks the doorway.' }
    if (Math.hypot(b.x - x, b.z - z) < 1.8) return { ok: false, why: 'That crowds the bench.' }
  }
  if (allChests(works).some(c => Math.hypot(c.x - x, c.z - z) < 1.4)) return { ok: false, why: 'Too close to another chest.' }
  if (inv) { const short = CHEST_COST.find(c => countOf(inv, c.id) < c.n); if (short) return { ok: false, why: `Needs ${short.n} ${short.id.replace(/_/g, ' ')} (you have ${countOf(inv, short.id)}).` } }
  return { ok: true }
}
export function placeChest(works: Works, owned: ReadonlySet<string>, inv: Inv, x: number, z: number, q: number, now = Date.now()): { works: Works; inv: Inv; chest: Chest } | null {
  if (!canPlaceChest(works, owned, x, z, q, inv).ok) return null
  let out: Inv | null = inv
  for (const c of CHEST_COST) { out = out && take(out, c.id, c.n); if (!out) return null }
  const chest: Chest = { id: `chest-${now.toString(36)}`, x, z, q: ((q % 4) + 4) % 4, placedAt: now }
  return { works: { ...works, chests: [...works.chests, chest] }, inv: out!, chest }
}

// ── save: garden-tied (the garden is shared across a roster; Alex 11-17), registered in GARDEN_KEY_SPECS ─────────────
export const WORKS_KEY = 'open.works.v1'
export function loadWorks(): Works {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(WORKS_KEY)) ?? 'null')
    if (v?.v === 1 && Array.isArray(v.rooms)) return {
      v: 1, rooms: v.rooms.filter((r: Room) => r && r.kind in ROOMS && Number.isFinite(r.x) && Number.isFinite(r.z)),
      // chests arrived after rooms (11-17): an older save has none
      chests: Array.isArray(v.chests) ? v.chests.filter((c: Chest) => c && typeof c.id === 'string' && Number.isFinite(c.x) && Number.isFinite(c.z)) : [],
    }
  } catch { /* private window */ }
  return freshWorks()
}
export function saveWorks(w: Works) { try { localStorage.setItem(gardenKey(WORKS_KEY), JSON.stringify(w)) } catch { /* private window */ } }
