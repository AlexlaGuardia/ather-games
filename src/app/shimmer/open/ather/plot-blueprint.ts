// ── HOUSE BLUEPRINTS (BETA M39 slice 1; world d5a9e927, 11-19). Alex 11-19: settlements "built out of the same building parts
// the player uses", and he draws them. A blueprint is the M37 data (walls with their kind, painted floors, the roof style)
// of ONE building drawn on a plot in plan mode, re-based so its footprint's min corner is (0, 0). Its FRONT is the
// footprint's z = 0 side: placed on a Glade lot, the front faces the green. Saved by the owner (save-house-blueprint) into
// world/house-blueprints/<id>.json, read at runtime (no deploy). PURE.
import { parseKey, adoptWalls, adoptRoof, adoptFloors, edgeEnds, edgeRect, WALL_T, DOOR_H, type Walls, type Floors, type RoofStyle } from './plot-walls'
import type { Box } from '../terrain-world'

export interface HouseBlueprint { v: 1; id: string; name: string; w: number; d: number; walls: Walls; floors: Floors; roof: RoofStyle; saved: number }
export const SAFE_HOUSE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/
export const MAX_BP_SIDE = 40, MAX_BP_PIECES = 400

/** the building a tapped wall belongs to: every piece joined to it corner-to-corner */
export function connectedPieces(walls: Walls, start: string): string[] {
  if (!walls[start]) return []
  const byCorner = new Map<string, string[]>()
  for (const k of Object.keys(walls)) for (const [x, z] of edgeEnds(k)) { const c = `${x},${z}`; const l = byCorner.get(c) ?? []; l.push(k); byCorner.set(c, l) }
  const seen = new Set([start]), q = [start]
  while (q.length) { const k = q.pop()!; for (const [x, z] of edgeEnds(k)) for (const n of byCorner.get(`${x},${z}`) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n) } }
  return [...seen]
}
/** lift one building off a plot as a blueprint: its pieces + the painted floor cells inside its footprint, re-based to 0,0 */
export function extractBlueprint(walls: Walls, floors: Floors | undefined, roof: RoofStyle, tapped: string, id: string, name: string, now = Date.now()): HouseBlueprint | null {
  const keys = connectedPieces(walls, tapped); if (keys.length < 1) return null
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity
  for (const k of keys) for (const [x, z] of edgeEnds(k)) { i0 = Math.min(i0, x); j0 = Math.min(j0, z); i1 = Math.max(i1, x); j1 = Math.max(j1, z) }
  const out: Record<string, Walls[string]> = {}
  for (const k of keys) { const e = parseKey(k)!; out[`${e.o},${e.i - i0},${e.j - j0}`] = walls[k] }
  const fl: Record<string, Floors[string]> = {}
  for (const [c, m] of Object.entries(floors ?? {})) { const [a, b] = c.split(',').map(Number); if (a >= i0 && a < i1 && b >= j0 && b < j1) fl[`${a - i0},${b - j0}`] = m }
  return { v: 1, id, name, w: i1 - i0, d: j1 - j0, walls: out, floors: fl, roof, saved: now }
}
/** what is wrong with a would-be blueprint (empty = fine); the route and the loader both ask */
export function houseProblems(v: unknown): string[] {
  const b = v as HouseBlueprint, out: string[] = []
  if (!b || b.v !== 1) return ['not a house blueprint (v1)']
  if (typeof b.id !== 'string' || !SAFE_HOUSE_ID.test(b.id)) out.push('id: lowercase letters, digits and dashes')
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 60) out.push('name: 1-60 characters')
  if (!Number.isInteger(b.w) || !Number.isInteger(b.d) || b.w < 1 || b.d < 1 || b.w > MAX_BP_SIDE || b.d > MAX_BP_SIDE) out.push(`footprint: whole metres, 1-${MAX_BP_SIDE}`)
  const ws = Object.keys(b.walls ?? {})
  if (!ws.length || ws.length > MAX_BP_PIECES) out.push(`walls: 1-${MAX_BP_PIECES} pieces`)
  if (Object.keys(adoptWalls(b.walls)).length !== ws.length) out.push('walls: a piece is malformed')
  if (ws.some(k => edgeEnds(k).some(([x, z]) => x < 0 || z < 0 || x > b.w || z > b.d))) out.push('walls: a piece lies outside the footprint')
  return out
}
/** a blueprint as stored, cleaned (null when it has problems) */
export function parseHouse(v: unknown): HouseBlueprint | null {
  if (houseProblems(v).length) return null
  const b = v as HouseBlueprint
  return { v: 1, id: b.id, name: b.name.trim(), w: b.w, d: b.d, walls: adoptWalls(b.walls), floors: adoptFloors(b.floors), roof: adoptRoof(b.roof), saved: Number.isFinite(b.saved) ? b.saved : 0 }
}
/** does it fit a pad (w across, d deep), either way round is NOT allowed: the front must face the green */
export const fitsPad = (b: { w: number; d: number }, padW: number, padD: number) => b.w <= padW && b.d <= padD

/** where a blueprint stands: its footprint centred on the pad, its front (local z = 0) toward the pad's front (yaw = the
 *  lot's: forward = (-sin yaw, -cos yaw)). Returns the group transform for the renderer (local metres -> world) and the
 *  walker's boxes, sampled small along each piece (the yaw is not a quarter turn, so a piece's AABB would block a corner). */
export function placeBlueprint(b: HouseBlueprint, pad: { x: number; z: number; yaw: number; y: number }) {
  // local (u, v): u across (+u = the pad's right), v from the front (v = 0) to the back (v = d). Centre the footprint.
  const s = Math.sin(pad.yaw), c = Math.cos(pad.yaw)
  const fwd = { x: -s, z: -c }, right = { x: c, z: -s }
  const toWorld = (u: number, v: number) => {
    const a = u - b.w / 2, back = v - b.d / 2   // metres right of centre, metres behind centre
    return { x: pad.x + right.x * a - fwd.x * back, z: pad.z + right.z * a - fwd.z * back }
  }
  const boxes: Box[] = []
  for (const [k, w] of Object.entries(b.walls)) {
    const r = edgeRect(k), alongU = r.x1 - r.x0 > r.z1 - r.z0, n = 4
    for (let q = 0; q < n; q++) {
      const t = (q + 0.5) / n, u = alongU ? r.x0 + (r.x1 - r.x0) * t : (r.x0 + r.x1) / 2, v = alongU ? (r.z0 + r.z1) / 2 : r.z0 + (r.z1 - r.z0) * t
      const p = toWorld(u, v), h = Math.max(WALL_T, (alongU ? r.x1 - r.x0 : r.z1 - r.z0) / n) / 2
      boxes.push({ x0: p.x - h, x1: p.x + h, z0: p.z - h, z1: p.z + h, y0: w.kind === 'door' ? pad.y + DOOR_H : pad.y - 0.5, y1: pad.y + 3.2 })
    }
  }
  // the group: a local point (u, y, v) lands at toWorld(u, v). Three: position = toWorld(0,0), rotation-y so +x -> right, +z -> back
  const o = toWorld(0, 0)
  return { boxes, toWorld, group: { x: o.x, z: o.z, rotY: Math.atan2(-right.z, right.x) } }
}
