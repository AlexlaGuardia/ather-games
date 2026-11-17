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
import { countOf, take, give, ITEM_GROUP, HOTBAR, SLOTS, BAIT_FROM, type Inv, type Stack } from '../shared/inventory'
import { MAX_CHESTS, putIn, withdraw, adoptBank, type Bank } from './garden-bank'
import { FURNITURE, MAX_PIECES, KEEPSTONES, keepstoneFor, type Job } from './furniture'

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
  carpentry:  { name: 'Carpentry room', blurb: 'Saw logs into planks and bark, and make furniture for your plot.', w: 8, d: 6, cost: [{ id: 'goldwood_log', n: 20 }], raiseMs: 120_000, open: true },
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
export interface Room {
  id: string; kind: RoomKind; x: number; z: number; q: number; placedAt: number; doneAt: number
  /** the room's own store (ROOM_STORE_SLOTS, that room's materials only; Alex 11-17). Absent = empty. */
  store?: Stack[]
}
/** A KEEPSTONE standing on the plot (canon 5a20b8f, ather-rework WORKSHOP ROOMS (6): a Blankstone pedestal whose top opens
 *  on a set crystal's light; never "chest" to a player). A door into the garden bank; each adds CHEST_SLOTS. The code and
 *  the save keep the word `chest` (the save field shipped as `chests` an hour before the ruling). `crystal` = the item
 *  set inside: the basic one is a raw mana shard; found uniques set higher crystals, look only, never more space. */
export interface Chest { id: string; x: number; z: number; q: number; placedAt: number; crystal?: string }
/** A piece of furniture or decor standing on the plot (furniture.ts). Picked up, it is the bag item `item` again. */
export interface Piece { id: string; item: string; x: number; z: number; q: number; placedAt: number }
export interface Works { v: 1; rooms: Room[]; chests: Chest[]; pieces: Piece[] }
export const freshWorks = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })

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
export type WorkNear = { kind: 'table' } | { kind: 'bench'; room: Room } | { kind: 'raising'; room: Room } | { kind: 'chest'; id: string } | { kind: 'piece'; id: string }
export function nearWork(works: Works, x: number, z: number, now = Date.now()): WorkNear | null {
  if (Math.hypot(TABLE.x - x, TABLE.z - z) < TABLE_REACH) return { kind: 'table' }
  // a Keepstone and a bench can share a room: the nearer one answers E
  let best: WorkNear | null = null, bestD = Infinity
  for (const c of allChests(works)) { const d = Math.hypot(c.x - x, c.z - z); if (d < CHEST_REACH && d < bestD) { best = { kind: 'chest', id: c.id }; bestD = d } }
  for (const p of works.pieces) {
    const f = FURNITURE[p.item], d = Math.hypot(p.x - x, p.z - z)
    if (f && d < Math.max(f.w, f.d) / 2 + 1 && d < bestD) { best = { kind: 'piece', id: p.id }; bestD = d }
  }
  for (const r of works.rooms) {
    if (!raised(r, now)) { const d = doorOf(r); if (Math.hypot(d.x - x, d.z - z) < 3 && !best) return { kind: 'raising', room: r }; continue }
    const b = benchOf(r), d = Math.hypot(b.x - x, b.z - z); if (d < BENCH_REACH && d < bestD) { best = { kind: 'bench', room: r }; bestD = d }
  }
  return best
}

// ── Keepstones: doors into the garden bank ────────────────────────────────────────────────────────────────────────
/** The plot's own Keepstone, standing by the planning table from the first minute (garden-bank.ts says why). Fixed: it
 *  cannot be picked up, so a garden always has a door into its bank. */
export const STARTER_CHEST: Chest = { id: 'starter', x: TABLE.x + 3.2, z: TABLE.z, q: 0, placedAt: 0 }
export const CHEST_W = 0.9, CHEST_D = 0.9, CHEST_H = 1.1, CHEST_REACH = 1.9
/** A Keepstone is an ITEM (canon): made at the planning table (the Stonery's job once it opens), set from the bag, picked
 *  back up. Blankstone is the build's plain stone (RULED 11-16) and the shard is the light. */
export const KEEPSTONE = 'keepstone'
export const KEEPSTONE_RECIPE: readonly { id: string; n: number }[] = [{ id: 'blankstone', n: 3 }, { id: 'raw_mana_shard', n: 1 }]
export function makeKeepstone(inv: Inv): Inv | null {
  let out: Inv | null = inv
  for (const c of KEEPSTONE_RECIPE) { out = out && take(out, c.id, c.n); if (!out) return null }
  const r = give(out!, KEEPSTONE, 1)
  return r.left > 0 ? null : r.inv
}
export const allChests = (w: Works): Chest[] => [STARTER_CHEST, ...w.chests]
/** Chests standing, the starter included: what the bank's cap is counted from. */
export const chestsStanding = (w: Works) => 1 + w.chests.length
export function chestBox(c: Pick<Chest, 'x' | 'z' | 'q'>): Box {
  const [hw, hd] = c.q % 2 ? [CHEST_D / 2, CHEST_W / 2] : [CHEST_W / 2, CHEST_D / 2]
  return { x0: c.x - hw, x1: c.x + hw, y0: GROUND_Y - 0.5, y1: GROUND_Y + CHEST_H, z0: c.z - hd, z1: c.z + hd }
}
export function canPlaceChest(works: Works, owned: ReadonlySet<string>, x: number, z: number, q: number, inv?: Inv, item = KEEPSTONE): PlaceVerdict {
  if (chestsStanding(works) >= MAX_CHESTS) return { ok: false, why: `${MAX_CHESTS} Keepstones already stand on the plot.` }
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
  if (allChests(works).some(c => Math.hypot(c.x - x, c.z - z) < 1.4)) return { ok: false, why: 'Too close to another Keepstone.' }
  if (!(item in KEEPSTONES)) return { ok: false, why: 'That is not a Keepstone.' }
  if (inv && countOf(inv, item) < 1) return { ok: false, why: `No ${KEEPSTONES[item].name} in the bag.${item === KEEPSTONE ? ' Make one at the planning table.' : ''}` }
  return { ok: true }
}
export function placeChest(works: Works, owned: ReadonlySet<string>, inv: Inv, x: number, z: number, q: number, now = Date.now(), item = KEEPSTONE): { works: Works; inv: Inv; chest: Chest } | null {
  if (!canPlaceChest(works, owned, x, z, q, inv, item).ok) return null
  const out = take(inv, item, 1); if (!out) return null
  const chest: Chest = { id: `chest-${now.toString(36)}`, x, z, q: ((q % 4) + 4) % 4, placedAt: now, crystal: KEEPSTONES[item].crystal }
  return { works: { ...works, chests: [...works.chests, chest] }, inv: out, chest }
}
/** Lift a placed Keepstone back into the bag. The starter one stays; a full bag refuses. The bank keeps every stack
 *  (garden-bank.ts: over the cap is tolerated, deposits just stop until it drains). */
export function pickUpChest(works: Works, id: string, inv: Inv): { works: Works; inv: Inv } | null {
  const c = works.chests.find(x => x.id === id)
  if (!c) return null
  const r = give(inv, keepstoneFor(c.crystal), 1)   // a found one comes back as itself
  if (r.left > 0) return null
  return { works: { ...works, chests: works.chests.filter(c => c.id !== id) }, inv: r.inv }
}

// ── ROOM STORES (Alex 11-17, via hub): each workshop room keeps its OWN inventory, apart from the garden bank, and it
//    takes only that room's materials. ★ WHY SMALL: the voxel station rack's argument (voxel3d/chest.ts › RACK_SLOTS): a
//    room is stocked for the job it does, not a second bank; if it held a bagful nobody would need a Keepstone. 16 = two
//    rows of the 8-wide grid. ★ What it is FOR: the bench works from it first (bait from the Rinnshop's own mast and
//    catches), and it is what a room's Moglin trades will read and fill (deadfall into carpentry, charcoal to the smithy,
//    RULED c52ba1c) when those land. ★ Over the cap is tolerated like the bank: nothing here ever trims a stack.
export const ROOM_STORE_SLOTS = 16
const grp = (id: string) => ITEM_GROUP[id]
/** What each room keeps. Derived from where an item comes from (ITEM_GROUP), so a new catch or crystal lands in the right
 *  room with no list to keep. Rooms not open yet have their rule now so the table can say what each will hold. */
export const ROOM_ACCEPTS: Readonly<Record<RoomKind, (id: string) => boolean>> = {
  rinnshop: id => grp(id) === 'rinning' || id === 'mast',
  cooking: id => (grp(id) === 'rinning' && id !== 'bait') || id === 'mast',
  alchemy: id => (grp(id) === 'prospecting' && id !== 'blankstone') || /_sap$/.test(id),
  smith: id => id === 'deadfall' || id === 'charcoal',
  carpentry: id => (grp(id) === 'forestry' && id !== 'mast') || id === 'deadfall',
  stonemason: id => grp(id) === 'prospecting',
}
/** Said when the room refuses something: what it does keep. */
export const ROOM_KEEPS: Readonly<Record<RoomKind, string>> = {
  rinnshop: 'catches, bait and mast', cooking: 'catches and mast for the hearth', alchemy: 'crystals, shards and saps',
  smith: 'deadfall and charcoal', carpentry: 'wood', stonemason: 'stone and crystal',
}
export const roomAccepts = (kind: RoomKind, id: string) => ROOM_ACCEPTS[kind](id)
export const roomStore = (r: Room): Bank => ({ v: 1, stacks: r.store ?? [] })
const setStore = (w: Works, id: string, b: Bank): Works => ({ ...w, rooms: w.rooms.map(r => (r.id === id ? { ...r, store: b.stacks } : r)) })
export type StoreMove = { works: Works; inv: Inv; moved: number } | { works: Works; inv: Inv; moved: 0; why: string }

/** Bag slot → the room's store. Refuses what the room does not keep; what does not fit stays in the bag. */
export function stockRoom(w: Works, roomId: string, inv: Inv, at: number): StoreMove {
  const r = w.rooms.find(x => x.id === roomId), s = inv.slots[at]
  if (!r || !s) return { works: w, inv, moved: 0, why: '' }
  if (!roomAccepts(r.kind, s.id)) return { works: w, inv, moved: 0, why: `The ${ROOMS[r.kind].name} keeps ${ROOM_KEEPS[r.kind]}.` }
  const p = putIn(roomStore(r), ROOM_STORE_SLOTS, s.id, s.n), moved = s.n - p.left
  if (!moved) return { works: w, inv, moved: 0, why: `The ${ROOMS[r.kind].name}'s store is full.` }
  const slots = inv.slots.map((x, i) => (i !== at ? x : p.left > 0 ? { id: s.id, n: p.left } : null))
  return { works: setStore(w, roomId, p.bank), inv: { ...inv, slots }, moved }
}
/** Everything in the BAG (not the hotbar: what you hold stays in your hands) that this room keeps, into its store. */
export function stockRoomFromBag(w: Works, roomId: string, inv: Inv): StoreMove {
  let out: StoreMove = { works: w, inv, moved: 0 }
  for (let at = HOTBAR; at < SLOTS; at++) {
    const r = stockRoom(out.works, roomId, out.inv, at)
    if (r.moved) out = { works: r.works, inv: r.inv, moved: out.moved + r.moved }
  }
  return out
}
/** Store stack k → the bag; what the bag cannot take stays. */
export function takeFromRoom(w: Works, roomId: string, k: number, inv: Inv): StoreMove {
  const r = w.rooms.find(x => x.id === roomId)
  if (!r) return { works: w, inv, moved: 0, why: '' }
  const t = withdraw(roomStore(r), k, inv)
  if (!t.moved) return { works: w, inv, moved: 0, why: 'No room in the bag.' }
  return { works: setStore(w, roomId, t.bank), inv: t.inv, moved: t.moved }
}
/** How many of `id` the bench can reach: the room's store and the bag together. */
export const benchCount = (r: Room, inv: Inv, id: string) => roomStore(r).stacks.reduce((a, s) => a + (s.id === id ? s.n : 0), 0) + countOf(inv, id)
/** Cut ONE food into bait at the Rinnshop bench: from the room's store first, else the bag. The bait goes to the bag (you
 *  cast from your hands); if the bag is full it waits in the store. Null when there is nothing to cut or nowhere for it. */
export function makeBaitAt(w: Works, roomId: string, inv: Inv, id: string): { works: Works; inv: Inv; made: number } | null {
  const r = w.rooms.find(x => x.id === roomId), made = BAIT_FROM[id]
  if (!r || r.kind !== 'rinnshop' || !made) return null
  let store = roomStore(r), bag: Inv | null = inv
  const k = store.stacks.findIndex(s => s.id === id)
  if (k >= 0) store = { v: 1, stacks: store.stacks.flatMap((s, i) => (i !== k ? [s] : s.n > 1 ? [{ ...s, n: s.n - 1 }] : [])) }
  else { bag = take(inv, id, 1); if (!bag) return null }
  const g = give(bag, 'bait', made)
  let left = g.left
  if (left > 0) { const p = putIn(store, ROOM_STORE_SLOTS, 'bait', left); store = p.bank; left = p.left }
  return left > 0 ? null : { works: setStore(w, roomId, store), inv: g.inv, made }
}

/** Work a carpentry job (or any bench job): the inputs come from the room's store first, then the bag; what is made goes
 *  to the bag, or, if the bag is full and the room keeps it, to the store. Null when short or with nowhere to put it. */
export function craftAt(w: Works, roomId: string, inv: Inv, job: Job): { works: Works; inv: Inv } | null {
  const r = w.rooms.find(x => x.id === roomId)
  if (!r) return null
  let store = roomStore(r), bag: Inv | null = inv
  for (const c of job.in) {
    const inStore = store.stacks.reduce((a, s) => a + (s.id === c.id ? s.n : 0), 0)
    if (inStore + countOf(inv, c.id) < c.n) return null
    let need = c.n
    const stacks = store.stacks.map(s => ({ ...s }))
    for (const s of stacks) if (need > 0 && s.id === c.id) { const t = Math.min(need, s.n); s.n -= t; need -= t }
    store = { v: 1, stacks: stacks.filter(s => s.n > 0) }
    if (need > 0) { bag = bag && take(bag, c.id, need); if (!bag) return null }
  }
  const g = give(bag!, job.out.id, job.out.n)
  let left = g.left
  if (left > 0 && roomAccepts(r.kind, job.out.id)) { const p = putIn(store, ROOM_STORE_SLOTS, job.out.id, left); store = p.bank; left = p.left }
  return left > 0 ? null : { works: setStore(w, roomId, store), inv: g.inv }
}
/** How many times a job could run now from the room's store and the bag together. */
export const jobRuns = (r: Room, inv: Inv, job: Job) => Math.min(...job.in.map(c => Math.floor(benchCount(r, inv, c.id) / c.n)))

// ── FURNITURE ON THE PLOT: set from the bag, picked back up (furniture.ts holds what each piece is) ────────────────
export function pieceRect(item: string, x: number, z: number, q: number) {
  const f = FURNITURE[item], [hw, hd] = q % 2 ? [f.d / 2, f.w / 2] : [f.w / 2, f.d / 2]
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }
}
/** The walker's boxes: solid pieces only (you walk through a stool or under an arch). */
export const pieceBoxes = (w: Works): Box[] => w.pieces.filter(p => FURNITURE[p.item]?.solid).map(p => {
  const k = pieceRect(p.item, p.x, p.z, p.q)
  return { ...k, y0: GROUND_Y - 0.5, y1: GROUND_Y + FURNITURE[p.item].h }
})
export function canPlacePiece(works: Works, owned: ReadonlySet<string>, item: string, x: number, z: number, q: number, inv?: Inv): PlaceVerdict {
  const f = FURNITURE[item]
  if (!f) return { ok: false, why: 'That is not furniture.' }
  if (works.pieces.length >= MAX_PIECES) return { ok: false, why: `${MAX_PIECES} pieces already stand on the plot.` }
  const k = pieceRect(item, x, z, q)
  for (const [cx, cz] of [[k.x0, k.z0], [k.x1, k.z0], [k.x0, k.z1], [k.x1, k.z1]]) {
    const s = squareAt(cx, cz); if (!s || !owned.has(sqId(s.i, s.j))) return { ok: false, why: 'Set it on ground you hold.' }
  }
  for (const c of KEEP_CLEAR) {
    const px = Math.max(k.x0, Math.min(c.x, k.x1)), pz = Math.max(k.z0, Math.min(c.z, k.z1))
    if (Math.hypot(px - c.x, pz - c.z) < c.r) return { ok: false, why: 'Too close to the gate, Gregory or the table.' }
  }
  const pad = 0.15, hit = (b: { x0: number; x1: number; z0: number; z1: number }) => k.x0 - pad < b.x1 && k.x1 + pad > b.x0 && k.z0 - pad < b.z1 && k.z1 + pad > b.z0
  for (const r of works.rooms) {
    if (wallsOf(r).some(hit)) return { ok: false, why: `In the wall of your ${ROOMS[r.kind].name}.` }
    const d = doorOf(r), b = benchOf(r)
    if (Math.hypot(d.x - x, d.z - z) < 1.6) return { ok: false, why: 'That blocks the doorway.' }
    if (Math.hypot(b.x - x, b.z - z) < 1.6) return { ok: false, why: 'That crowds the bench.' }
  }
  if (allChests(works).map(chestBox).some(hit)) return { ok: false, why: 'Too close to a Keepstone.' }
  if (works.pieces.some(p => hit(pieceRect(p.item, p.x, p.z, p.q)))) return { ok: false, why: 'Something already stands there.' }
  if (inv && countOf(inv, item) < 1) return { ok: false, why: `No ${f.name} in the bag.` }
  return { ok: true }
}
export function placePiece(works: Works, owned: ReadonlySet<string>, inv: Inv, item: string, x: number, z: number, q: number, now = Date.now()): { works: Works; inv: Inv; piece: Piece } | null {
  if (!canPlacePiece(works, owned, item, x, z, q, inv).ok) return null
  const out = take(inv, item, 1); if (!out) return null
  const piece: Piece = { id: `piece-${now.toString(36)}-${works.pieces.length}`, item, x, z, q: ((q % 4) + 4) % 4, placedAt: now }
  return { works: { ...works, pieces: [...works.pieces, piece] }, inv: out, piece }
}
export function pickUpPiece(works: Works, id: string, inv: Inv): { works: Works; inv: Inv } | null {
  const p = works.pieces.find(x => x.id === id)
  if (!p) return null
  const r = give(inv, p.item, 1)
  return r.left > 0 ? null : { works: { ...works, pieces: works.pieces.filter(x => x.id !== id) }, inv: r.inv }
}
/** Turn a standing piece a quarter, if it still fits where it stands. */
export function turnPiece(works: Works, owned: ReadonlySet<string>, id: string): Works | null {
  const p = works.pieces.find(x => x.id === id)
  if (!p) return null
  const rest = { ...works, pieces: works.pieces.filter(x => x.id !== id) }, q = (p.q + 1) % 4
  if (!canPlacePiece(rest, owned, p.item, p.x, p.z, q).ok) return null
  return { ...works, pieces: works.pieces.map(x => (x.id === id ? { ...x, q } : x)) }
}

// ── save: garden-tied (the garden is shared across a roster; Alex 11-17), registered in GARDEN_KEY_SPECS ─────────────
export const WORKS_KEY = 'open.works.v1'
export function loadWorks(): Works {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(WORKS_KEY)) ?? 'null')
    if (v?.v === 1 && Array.isArray(v.rooms)) return {
      v: 1, rooms: v.rooms.filter((r: Room) => r && r.kind in ROOMS && Number.isFinite(r.x) && Number.isFinite(r.z))
        .map((r: Room) => (r.store ? { ...r, store: adoptBank({ v: 1, stacks: r.store }).stacks } : r)),
      // chests arrived after rooms (11-17): an older save has none
      chests: Array.isArray(v.chests) ? v.chests.filter((c: Chest) => c && typeof c.id === 'string' && Number.isFinite(c.x) && Number.isFinite(c.z)) : [],
      // furniture arrived after Keepstones (11-17): an older save has none; a piece whose item is gone is dropped
      pieces: Array.isArray(v.pieces) ? v.pieces.filter((p: Piece) => p && typeof p.id === 'string' && p.item in FURNITURE && Number.isFinite(p.x) && Number.isFinite(p.z)) : [],
    }
  } catch { /* private window */ }
  return freshWorks()
}
export function saveWorks(w: Works) { try { localStorage.setItem(gardenKey(WORKS_KEY), JSON.stringify(w)) } catch { /* private window */ } }
