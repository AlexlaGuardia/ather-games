// ── BETA M84 s2: BUILD on a Creative-mode zone (pure; ZoneBuilder.tsx drives it, zone-build.test.ts tests it) ──
// Alex 11-23: "remove and place building zones after preparing the landscape and then build out each house and building".
// The parts are the PLAYER's building parts (furniture.ts: M98b wall panels + floor slabs, and the furniture) and every
// placement goes through the player's own rule (rooms.ts canPlacePiece: overlap, slab-under-furniture, panel at any angle),
// with the zone as the site (PieceSite: inside the zone rectangle, no plot fixtures). No costs, no bag: nothing is taken.
// The pieces are ZONE-LOCAL (builder-zones.ts ZonePiece), so the build belongs to the zone: deleting the zone deletes it.
import { canPlacePiece, TABLE_ITEM, type Works, type Piece, type PieceSite } from '../../open/ather/rooms'
import { FURNITURE, FURNITURE_ORDER } from '../../open/ather/furniture'
import { normQ } from '../../open/ather/build-prefs'
import { ZONE_PIECES_MAX, type Zone, type ZonePiece } from '../../world/builder-zones'

/** what the zone build offers: every player part except the planning table (one per keeper, a plot thing) and the lift (a shaft
 *  through storeys the zone build does not have) */
export const ZONE_PARTS: readonly string[] = FURNITURE_ORDER.filter(id => id !== TABLE_ITEM && !FURNITURE[id].shaft)
export type PartGroup = 'walls' | 'floors' | 'furniture'
export const partGroup = (item: string): PartGroup => FURNITURE[item]?.panel ? 'walls' : FURNITURE[item]?.slab ? 'floors' : 'furniture'

const NOBODY: ReadonlySet<string> = new Set()
const worksOf = (pieces: readonly ZonePiece[]): Works => ({ v: 1, rooms: [], chests: [], pieces: pieces.map(p => ({ ...p, placedAt: 0 }) as Piece) })
export const zoneSite = (z: Pick<Zone, 'x0' | 'z0' | 'x1' | 'z1'>): PieceSite => {
  const w = z.x1 - z.x0, d = z.z1 - z.z0, e = 1e-6
  return { inside: (x, y) => x >= -e && x <= w + e && y >= -e && y <= d + e }
}

export type BuildVerdict = { ok: true; zone: Zone } | { ok: false; why: string }
/** can `item` stand at local (x, z) turned q, among the zone's other pieces (`skip` = the one being moved/turned) */
export function canSet(z: Zone, item: string, x: number, y: number, q: number, skip?: string): { ok: true } | { ok: false; why: string } {
  if (!ZONE_PARTS.includes(item)) return { ok: false, why: 'Not a building part.' }
  const rest = (z.build ?? []).filter(p => p.id !== skip)
  if (!skip && rest.length >= ZONE_PIECES_MAX) return { ok: false, why: `${ZONE_PIECES_MAX} parts already stand in this zone.` }
  const v = canPlacePiece(worksOf(rest), NOBODY, item, x, y, q, undefined, zoneSite(z))
  return v.ok ? { ok: true } : { ok: false, why: v.why }
}
const newId = (z: Zone, now: number) => { let id = `p${now.toString(36)}`; for (let n = 1; (z.build ?? []).some(p => p.id === id); n++) id = `p${now.toString(36)}-${n}`; return id }
const r3 = (v: number) => Math.round(v * 1000) / 1000
const withBuild = (z: Zone, b: ZonePiece[]): Zone => { const o: Zone = { ...z }; if (b.length) o.build = b; else delete o.build; return o }

/** set a new part (free: no bag, no cost) */
export function setPart(z: Zone, item: string, x: number, y: number, q: number, now = Date.now()): BuildVerdict {
  const c = canSet(z, item, x, y, q); if (!c.ok) return c
  return { ok: true, zone: withBuild(z, [...(z.build ?? []), { id: newId(z, now), item, x: r3(x), z: r3(y), q: normQ(q) }]) }
}
/** move (and/or turn) a standing part */
export function movePart(z: Zone, id: string, x: number, y: number, q: number): BuildVerdict {
  const p = (z.build ?? []).find(o => o.id === id); if (!p) return { ok: false, why: 'That part is gone.' }
  const c = canSet(z, p.item, x, y, q, id); if (!c.ok) return c
  return { ok: true, zone: withBuild(z, (z.build ?? []).map(o => o.id === id ? { ...o, x: r3(x), z: r3(y), q: normQ(q) } : o)) }
}
export const deletePart = (z: Zone, id: string): Zone => withBuild(z, (z.build ?? []).filter(o => o.id !== id))
/** the part under local (x, z): furniture above a slab (the topmost thing you see), else the slab */
export function partAt(z: Zone, x: number, y: number, quadOf: (p: ZonePiece) => [number, number][]): ZonePiece | null {
  const inQ = (q: [number, number][]) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, az] = q[i], [bx, bz] = q[(i + 1) % 4]; const c = (bx - ax) * (y - az) - (bz - az) * (x - ax); if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false } } return true }
  const hits = (z.build ?? []).filter(p => inQ(quadOf(p)))
  return hits.find(p => !FURNITURE[p.item].slab) ?? hits[hits.length - 1] ?? null
}
