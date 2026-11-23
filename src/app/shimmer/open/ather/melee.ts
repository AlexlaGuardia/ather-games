// MELEE (BETA M42, Alex 11-20: "a melee button like right clicking while weapons stowed so the player has a way to break placed
// items with like 3 hits to move them"). Stowed + right-click = a short swing; THREE hits on the same placed thing (furniture, a
// lift, a placed Keepstone, never the starter) pop it back into the bag, refunded whole. A pause resets the count; a swing has a
// short cooldown. Armed right-click stays the sights (combat-layer). Only the keeper's own plot (the works this page holds).
// PURE: no React, no three, no DOM.
import type { Works } from './rooms'
import { pickUpChest, pieceRect, chestBox, CHEST_H, TABLE, TABLE_ITEM } from './rooms'
import { give } from '../shared/inventory'
import { FURNITURE } from './furniture'
import { GROUND_Y } from './plot'
import type { Inv } from '../shared/inventory'
import { liftPiece } from './piece-lift'
import type { Pots } from './spirit-seeds'

export const MELEE_HITS = 3
export const MELEE_REACH = 2.6     // metres from the eye: a hand's reach, shorter than any tool
export const MELEE_CD_MS = 420     // between swings
export const MELEE_RESET_MS = 4000 // a pause this long and the count starts over

/** M96: the never-moved planning table answers as kind 'table' (id TABLE_HIT); once moved it is an ordinary piece. */
export const TABLE_HIT = 'table'
export interface Target { kind: 'piece' | 'chest' | 'table'; id: string; x: number; z: number; t: number }
export interface Hits { id: string; n: number; at: number }

type V3 = [number, number, number]
/** distance along the ray (origin o, unit dir d) to the box, or Infinity */
export function rayBox(o: V3, d: V3, b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): number {
  let t0 = 0, t1 = Infinity
  const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1]
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return Infinity; continue }
    let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a]
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return Infinity
  }
  return t0
}

/** what a swing from the eye would land on: the nearest placed piece or placed Keepstone within reach (the starter never) */
export function meleeTarget(w: Works, o: V3, d: V3, reach = MELEE_REACH): Target | null {
  let best: Target | null = null
  for (const p of w.pieces) {
    const f = FURNITURE[p.item]; if (!f) continue
    const r = pieceRect(p.item, p.x, p.z, p.q), t = rayBox(o, d, { ...r, y0: GROUND_Y, y1: GROUND_Y + Math.max(0.4, Math.min(f.h, 2.2)) })
    if (t <= reach && (!best || t < best.t)) best = { kind: 'piece', id: p.id, x: p.x, z: p.z, t }
  }
  if (!w.tableMoved) {   // M96: the fixture at its first spot (the size workshop.tsx draws, 2.2 x 1.3 m, waist high)
    const t = rayBox(o, d, { x0: TABLE.x - 1.1, x1: TABLE.x + 1.1, y0: GROUND_Y, y1: GROUND_Y + 1.05, z0: TABLE.z - 0.65, z1: TABLE.z + 0.65 })
    if (t <= reach && (!best || t < best.t)) best = { kind: 'table', id: TABLE_HIT, x: TABLE.x, z: TABLE.z, t }
  }
  for (const c of w.chests) {   // w.chests = placed ones only; the starter lives outside the list (rooms.ts allChests)
    const t = rayBox(o, d, { ...chestBox(c), y1: GROUND_Y + CHEST_H })
    if (t <= reach && (!best || t < best.t)) best = { kind: 'chest', id: c.id, x: c.x, z: c.z, t }
  }
  return best
}

/** may a swing go now? */
export const canSwing = (lastSwing: number, now: number) => now - lastSwing >= MELEE_CD_MS
/** one landed hit: the count on that target (a new target, or a long pause, starts at 1); `broke` on the third */
export function strike(h: Hits | null, id: string, now: number): { hits: Hits | null; n: number; broke: boolean } {
  const n = h && h.id === id && now - h.at <= MELEE_RESET_MS ? h.n + 1 : 1
  return n >= MELEE_HITS ? { hits: null, n, broke: true } : { hits: { id, n, at: now }, n, broke: false }
}
/** the third hit: the thing comes back to the bag, whole. null = the bag is full (nothing moves); 'spirit' = a spirit lives in
 *  this planter (it stays). A piece comes up through piece-lift.ts like the card's Pick up, so a growing planter keeps its seed
 *  (M106 fix: this path used to skip the pot and the seed was lost). */
export function breakTarget(w: Works, t: Pick<Target, 'kind' | 'id'>, inv: Inv, pots: Pots): { works: Works; inv: Inv; pots: Pots } | 'spirit' | null {
  if (t.kind === 'table') {   // M96: the fixture comes up as the bag item; the save remembers it left its spot
    if (w.tableMoved) return null
    const r = give(inv, TABLE_ITEM, 1)
    return r.left > 0 ? null : { works: { ...w, tableMoved: true }, inv: r.inv, pots }
  }
  if (t.kind === 'piece') { const l = liftPiece(w, t.id, inv, pots); return l === 'spirit' ? 'spirit' : typeof l === 'string' ? null : l }
  const c = pickUpChest(w, t.id, inv)
  return c ? { ...c, pots } : null
}
