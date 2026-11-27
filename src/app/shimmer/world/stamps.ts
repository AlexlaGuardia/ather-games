// ── BETA M85 s3: STAMPS + COPY / PASTE (World Builder, Scenery / Place mode) ──
// A STAMP is a saved selection of pieces (a lamp + bench cluster, a ruin): each piece's kind, turn, size and toggle, and its offset from
// the selection's centre. Stamping it puts NEW ordinary pieces on the draft (placed ones get `p` ids, scattered ones `s` ids:
// builder-props.ts / scatter-brush.ts), so save, publish, the game draw and collision are the props list's own path. A piece has no
// height of its own, it stands on the ground under it, so every stamped piece is ground-snapped where it lands.
// The stamp turns as one: the offsets turn round the centre by the same quarter turns the pieces add to their own.
// Copy / paste is the same thing kept in memory: Ctrl+C makes a stamp of the selection, Ctrl+V holds it on the crosshair.
// Stamps are kept per owner on this device beside the Place hotbar (localStorage STAMPS_KEY; the builder is owner-only).
// Not stamped: people and houses (one each, never copied) and tutorial nodes (a keeper's timer hangs on a node's id).
// PURE (no imports but builder-props + scatter-brush): stamps.test.ts.
import { PROPS_MAX, SCATTER_MAX, cleanProp, isNode, isScatter, isStanding, newPropId, pieceCount, yawOfQ, type Prop } from './builder-props'
import { newScatterId, scatterCount } from './scatter-brush'

/** one piece of a stamp: its offset (m) from the stamp's centre, its own turn / size / toggle; sc = a scattered piece */
export interface StampPiece { k: string; dx: number; dz: number; q: number; s: number; solid?: boolean; sc?: 1 }
export interface Stamp { id: string; name: string; pieces: StampPiece[] }
export const STAMPS_KEY = 'builder.stamps', STAMPS_MAX = 24, STAMP_PIECES_MAX = 400
const round = (v: number, d = 3) => { const m = 10 ** d, r = Math.round(v * m) / m; return r === 0 ? 0 : r }
const wrapQ = (q: number) => { const r = round(((q % 4) + 4) % 4, 4); return r >= 4 ? 0 : r }

/** may this piece go in a stamp */
export const stampable = (p: Prop) => !isStanding(p) && !isNode(p)
/** the selected pieces as a stamp's pieces (offsets from their centre); [] when none can be stamped */
export function stampOf(ps: readonly Prop[], ids: Iterable<string>): StampPiece[] {
  const want = new Set(ids), sel = ps.filter(p => want.has(p.id) && stampable(p)).slice(0, STAMP_PIECES_MAX)
  if (!sel.length) return []
  const cx = sel.reduce((a, p) => a + p.x, 0) / sel.length, cz = sel.reduce((a, p) => a + p.z, 0) / sel.length
  return sel.map(p => ({ k: p.k, dx: round(p.x - cx), dz: round(p.z - cz), q: p.q, s: p.s, ...(p.solid === undefined ? {} : { solid: p.solid }), ...(isScatter(p) ? { sc: 1 as const } : {}) }))
}
/** an offset turned by q quarter turns, the way a piece turned by q is drawn (rotation.y = yawOfQ(q)) */
export function turnOffset(dx: number, dz: number, q: number): { dx: number; dz: number } {
  const a = yawOfQ(q), c = Math.cos(a), s = Math.sin(a)
  return { dx: round(dx * c + dz * s), dz: round(-dx * s + dz * c) }
}
/** where each piece of a stamp lands with its centre at (x, z), turned by q: world spots, the pieces' own turns + the stamp's */
export function stampSpots(pieces: readonly StampPiece[], x: number, z: number, q: number) {
  return pieces.map(p => { const o = turnOffset(p.dx, p.dz, q); return { ...p, x: round(x + o.dx), z: round(z + o.dz), q: wrapQ(p.q + q) } })
}
/** STAMP: the list with the stamp's pieces added as new pieces (new ids), or null when the map has no room for all of them (the caps:
 *  PROPS_MAX placed, SCATTER_MAX scattered: a stamp goes down whole or not at all). `ok` = may a piece stand here (on land): a piece
 *  that may not is left out. `added` = the new ids. */
export function placeStamp(ps: readonly Prop[], pieces: readonly StampPiece[], x: number, z: number, q: number, ok?: (x: number, z: number) => boolean): { props: Prop[]; added: string[] } | null {
  const spots = stampSpots(pieces, x, z, q).filter(p => !ok || ok(p.x, p.z))
  const nP = spots.filter(p => !p.sc).length, nS = spots.length - nP
  if (pieceCount(ps) + nP > PROPS_MAX || scatterCount(ps) + nS > SCATTER_MAX) return null
  const out = [...ps], added: string[] = []
  let np = parseInt(newPropId(ps).slice(1), 36), ns = parseInt(newScatterId(ps).slice(1), 36)
  for (const p of spots) {
    const id = p.sc ? `s${(ns++).toString(36)}` : `p${(np++).toString(36)}`
    const c = cleanProp({ id, k: p.k, x: p.x, z: p.z, q: p.q, s: p.s, ...(p.solid === undefined ? {} : { solid: p.solid }) })
    if (!c || isStanding(c) || isNode(c)) continue
    out.push(c); added.push(c.id)
  }
  return { props: out, added }
}

// ── the shelf (localStorage, JSON): junk dropped, so a hand-edited or old entry never breaks the editor ──
const KIND = /^[a-z]{2,10}:[a-z0-9_-]{1,40}$/, num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export function cleanStampPiece(v: unknown): StampPiece | null {
  const o = v as Partial<StampPiece> | null
  if (!o || typeof o !== 'object' || typeof o.k !== 'string' || !KIND.test(o.k) || !num(o.dx) || !num(o.dz) || Math.abs(o.dx) > 2000 || Math.abs(o.dz) > 2000) return null
  if (o.k.startsWith('who:') || o.k.startsWith('spot:') || o.k.startsWith('node:')) return null
  return { k: o.k, dx: round(o.dx), dz: round(o.dz), q: num(o.q) ? wrapQ(o.q) : 0, s: num(o.s) ? o.s : 1, ...(typeof o.solid === 'boolean' && o.sc !== 1 ? { solid: o.solid } : {}), ...(o.sc === 1 ? { sc: 1 as const } : {}) }
}
export function cleanStamps(v: unknown): Stamp[] {
  if (!Array.isArray(v)) return []
  const out: Stamp[] = [], seen = new Set<string>()
  for (const s of v) {
    const o = s as Partial<Stamp> | null
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !/^[a-z0-9]{1,16}$/.test(o.id) || seen.has(o.id) || !Array.isArray(o.pieces)) continue
    const pieces = o.pieces.map(cleanStampPiece).filter((p): p is StampPiece => !!p).slice(0, STAMP_PIECES_MAX)
    if (!pieces.length) continue
    seen.add(o.id); out.push({ id: o.id, name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 32) : `Stamp ${out.length + 1}`, pieces })
    if (out.length >= STAMPS_MAX) break
  }
  return out
}
/** the shelf with one more stamp (newest last; the oldest goes past STAMPS_MAX) */
export function addStamp(list: readonly Stamp[], pieces: readonly StampPiece[], now = Date.now()): Stamp[] {
  if (!pieces.length) return [...list]
  let n = now; while (list.some(s => s.id === n.toString(36))) n++
  const used = new Set(list.map(s => s.name)); let i = list.length + 1; while (used.has(`Stamp ${i}`)) i++
  return [...list, { id: n.toString(36), name: `Stamp ${i}`, pieces: [...pieces] }].slice(-STAMPS_MAX)
}
export const loadStamps = (raw: string | null): Stamp[] => { try { return cleanStamps(JSON.parse(raw ?? 'null')) } catch { return [] } }
