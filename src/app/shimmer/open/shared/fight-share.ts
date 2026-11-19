// ── SHARED FIGHTS: WHO HOSTS, AND THE SNAPSHOT (BETA M28 slice 2, docs/M28-shared-fights.md option A) ────────────────────
// A party in one Wilds instance fights the SAME Hollows. One keeper, the HOST, runs combat.ts for the Hollows as today and
// relays a compact snapshot (server 'relay', shimmer-server afc1d34) ~10x/s; the others stop spawning their own, draw the
// host's, and lerp them like remote keepers. Solo (no party, or alone in the instance) = today's game exactly.
//   host  = the lowest player id among me + the peers in my instance: every client computes the SAME answer from the same
//           roster, with no election message; when the host leaves, the next lowest takes over from the last snapshot
//           (its Hollows are already there).
// ★ PURE (no React, no three, no socket). Node test: fight-share.test.ts.
import type { Combat, Hollow, HollowKind, HollowState, Terrain } from '../ather/combat'

export const SNAP_KIND = 'fight.snap'
export const SNAP_HZ = 10
export const SNAP_MAX = 40          // Hollows per snapshot (~30 bytes each: well inside the server's 2 KB relay cap)
export const SNAP_R = 90            // only the Hollows within this of the host travel (what a party can see)

/** Sharing is on only in a party with someone else actually here. */
export const sharing = (party: string | null | undefined, peerIds: readonly string[]) => !!party && peerIds.length > 0
/** The host: the lowest id of everyone present (me included). */
export function hostOf(me: string, peerIds: readonly string[]): string {
  let h = me
  for (const p of peerIds) if (p < h) h = p
  return h
}

const KINDS: HollowKind[] = ['shambler', 'floater']
const STATES: HollowState[] = ['wander', 'chase', 'windup', 'lunge', 'recover', 'stagger', 'charge']
const r1 = (v: number) => Math.round(v * 10) / 10
/** one Hollow on the wire: [id, kind, x, z, yaw, hp, maxHp, state] */
export type SnapRow = [number, number, number, number, number, number, number, number]
export interface Snap { h: SnapRow[] }

/** The host's view, nearest first, capped. */
export function encodeSnap(c: Combat, at: { x: number; z: number }): Snap {
  const near = c.hollows.filter(h => h.hp > 0 && Math.hypot(h.x - at.x, h.z - at.z) < SNAP_R)
    .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z)).slice(0, SNAP_MAX)
  return { h: near.map(h => [h.id, Math.max(0, KINDS.indexOf(h.kind)), r1(h.x), r1(h.z), r1(h.yaw), Math.ceil(h.hp), h.maxHp, Math.max(0, STATES.indexOf(h.state))]) }
}

/** A remote Hollow carries where the host last said it was; stepCombat (remote) eases it there. */
export type NetHollow = Hollow & { nx?: number; nz?: number; nyaw?: number }

/** A non-host takes the host's snapshot: upsert by id (new ones snap into place, known ones get a target), drop the rest. */
export function applySnap(c: Combat, T: Terrain, s: Snap) {
  if (!s || !Array.isArray(s.h)) return
  const byId = new Map(c.hollows.map(h => [h.id, h as NetHollow]))
  const next: NetHollow[] = []
  for (const row of s.h) {
    if (!Array.isArray(row) || row.length < 8) continue
    const [id, k, x, z, yaw, hp, maxHp, st] = row
    const kind = KINDS[k] ?? 'shambler', state = STATES[st] ?? 'wander'
    let h = byId.get(id)
    if (!h) {
      h = { id, kind, x, y: T.heightAt(x, z), z, yaw, hp, maxHp, state, t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }
    }
    h.kind = kind; h.hp = hp; h.maxHp = maxHp; h.state = state
    h.nx = x; h.nz = z; h.nyaw = yaw
    next.push(h)
  }
  c.hollows = next
}

/** ease a remote Hollow toward the host's word (the same exponential lerp as remote keepers) */
export const NET_LERP = 10
export function easeRemote(h: NetHollow, dt: number) {
  if (h.nx === undefined || h.nz === undefined) return
  const k = 1 - Math.exp(-NET_LERP * dt)
  h.x += (h.nx - h.x) * k; h.z += (h.nz - h.z) * k
  if (h.nyaw !== undefined) { let d = h.nyaw - h.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); h.yaw += d * k }
}
