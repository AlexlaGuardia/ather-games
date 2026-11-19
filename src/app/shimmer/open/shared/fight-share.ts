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

// ── SLICE 3: HITS + DROPS ──
// A guest's round flashes its Hollow at once (Combat.remote) and queues the hit; the queue goes to the HOST ('fight.hit',
// addressed), which applies it like its own (combat.ts applyNetHit). Every kill the host sees, its own or a guest's, shows up
// as a NEW DROP in the host's sim; the host broadcasts those ('fight.kill') and each guest lays its OWN copy (Alex 11-19:
// each keeper gets their own drop, no loot fights).
export const HIT_KIND = 'fight.hit'
export const KILL_KIND = 'fight.kill'
export const HIT_MAX = 20
/** [hollow id, damage] */
export type HitRow = [number, number]
export const encodeHits = (hits: readonly { id: number; dmg: number }[]): { h: HitRow[] } =>
  ({ h: hits.slice(0, HIT_MAX).map(x => [x.id, Math.round(x.dmg * 10) / 10]) })
export function decodeHits(d: unknown): HitRow[] {
  const h = (d as { h?: unknown })?.h
  return Array.isArray(h) ? h.filter((r): r is HitRow => Array.isArray(r) && typeof r[0] === 'number' && typeof r[1] === 'number').slice(0, HIT_MAX) : []
}
/** [x, z, amount] */
export type KillRow = [number, number, number]
/** The host's new drops since last look (marks them seen). The first look marks what is already lying there, sends nothing. */
export function newDrops(c: Combat, seen: Set<number>, first: boolean): KillRow[] {
  const out: KillRow[] = []
  for (const d of c.drops) if (!seen.has(d.id)) { seen.add(d.id); if (!first) out.push([r1(d.x), r1(d.z), d.amount]) }
  for (const id of seen) if (!c.drops.some(d => d.id === id)) seen.delete(id)
  return out
}
export function decodeKills(d: unknown): KillRow[] {
  const k = (d as { k?: unknown })?.k
  return Array.isArray(k) ? k.filter((r): r is KillRow => Array.isArray(r) && r.length >= 3 && r.every(v => typeof v === 'number') && r[2] > 0 && r[2] <= 10).slice(0, 20) : []
}
// ── #1651 (Alex 11-19): Hollows hunt GUESTS too. The host's sim picks the nearest keeper; a blow or spit that reaches a guest
// is a 'hurt-other' event there, sent to THAT guest (addressed), who applies it to its own hp with its own frame's defence.
// Known limit: the host judges reach from the guest's synced spot (~100 ms behind), so a last-instant dodge can still be hit.
export const HURT_KIND = 'fight.hurt'
export const HURT_MAX = 50
export const encodeHurt = (dmg: number) => ({ d: Math.round(dmg * 10) / 10 })
/** Raw damage, or null for junk (non-number, <= 0, > HURT_MAX). */
export function decodeHurt(x: unknown): number | null {
  const d = (x as { d?: unknown })?.d
  return typeof d === 'number' && d > 0 && d <= HURT_MAX ? d : null
}
/** A guest lays its own copy of the host's drop. */
export function layDrop(c: Combat, T: Terrain, [x, z, amount]: KillRow) {
  c.drops.push({ id: c.nextId++, x, y: T.heightAt(x, z), z, amount, age: 0 })
}
