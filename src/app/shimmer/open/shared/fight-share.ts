// ── SHARED FIGHTS: WHO HOSTS, AND THE SNAPSHOT (BETA M28 slice 2, docs/M28-shared-fights.md option A) ────────────────────
// A party in one Wilds instance fights the SAME Hollows. One keeper, the HOST, runs combat.ts for the Hollows as today and
// relays a compact snapshot (server 'relay', shimmer-server afc1d34) ~10x/s; the others stop spawning their own, draw the
// host's, and lerp them like remote keepers. Solo (no party, or alone in the instance) = today's game exactly.
//   host  = the lowest player id among me + the peers in my instance: every client computes the SAME answer from the same
//           roster, with no election message; when the host leaves, the next lowest takes over from the last snapshot
//           (its Hollows are already there).
// ★ PURE (no React, no three, no socket). Node test: fight-share.test.ts.
import type { Combat, CombatEvent, Hollow, HollowKind, HollowState, Terrain } from '../ather/combat'
import { CHAMP, CHAMP_ID, THERE_R, hurtChampion, thereAt, throwVolley, type Attack, type Champion, type ChampState } from '../ather/champion'

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

const KINDS: HollowKind[] = ['shambler', 'floater', 'crawler']
const STATES: HollowState[] = ['wander', 'chase', 'windup', 'lunge', 'recover', 'stagger', 'charge']
const r1 = (v: number) => Math.round(v * 10) / 10
/** one Hollow on the wire: [id, kind, x, z, yaw, hp, maxHp, state, mass?] (M120 s2: a crawler's mass, so a guest draws its size) */
export type SnapRow = [number, number, number, number, number, number, number, number] | [number, number, number, number, number, number, number, number, number]
/** M156 s3, the champion: [node, nx, nz, x, z, yaw, bar, hp, state, t, attack (-1 none), ax, az] */
export type ChampRow = [string, number, number, number, number, number, number, number, number, number, number, number, number]
export interface Snap { h: SnapRow[]; c?: ChampRow }

/** The host's view, nearest first, capped. */
export function encodeSnap(c: Combat, at: { x: number; z: number }): Snap {
  const near = c.hollows.filter(h => h.hp > 0 && (Math.hypot(h.x - at.x, h.z - at.z) < SNAP_R || (c.champ && Math.hypot(h.x - c.champ.nx, h.z - c.champ.nz) < CHAMP.leash)))
    .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z)).slice(0, SNAP_MAX)
  return { h: near.map(h => [h.id, Math.max(0, KINDS.indexOf(h.kind)), r1(h.x), r1(h.z), r1(h.yaw), Math.ceil(h.hp), h.maxHp, Math.max(0, STATES.indexOf(h.state)), ...(h.kind === 'crawler' ? [h.mass ?? 1] : [])] as SnapRow), ...(c.champ ? { c: encodeChamp(c.champ) } : {}) }
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
    if (kind === 'crawler') h.mass = typeof row[8] === 'number' ? row[8] : 1
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

// ── M156 s3 (Alex 11-25 "A, then B"): THE CHAMPION IS THE HOST'S ────────────────────────────────────────────────────────────
// It rises where the HOST's ground is grey, for whichever of us comes near it while the host is in the fight (SNAP_R); it travels
// in the snapshot, fights the nearest of us, and a guest's rounds go to the host like a Hollow's (row id CHAMP_ID). ONE KILL, the
// host's sim's: the host clears their node and tells each keeper THERE (thereAt) with 'champ.down', addressed. A guest believes it
// only from the keeper who hosted it as it was last shown, only of a champion just shown on its last bar, only once, and only if near it
// themselves; then they write their OWN save. The host dropping mid-fight: the next host carries on with it as last shown. The host
// back: the interim host hands it over as a bar + health (never a kill), believed only for a grey node the host has and only near it.
export const DOWN_KIND = 'champ.down', HAND_KIND = 'champ.hand'
/** a guest keeps a champion on screen this far off; past it, it is somebody else's fight */
export const CHAMP_SEEN_R = 130
/** how long after it was last shown its fall is believed; how long after taking the Wilds back a hand-over is */
export const DOWN_MS = 8000, HAND_MS = 25_000
/** the fall is told again, for a word the relay dropped (once is believed) */
export const DOWN_AGAIN = [1000, 2500]
/** a guest's rounds on the champion: no more than this a second (the best gun in the game, and room) */
export const CHAMP_DPS_MAX = 250
const CSTATES: ChampState[] = ['rise', 'idle', 'windup', 'act', 'recover', 'submerge', 'home']
const ATTACKS: Attack[] = ['slam', 'lunge', 'volley']
const r2 = (v: number) => Math.round(v * 100) / 100
export const encodeChamp = (ch: Champion): ChampRow => [ch.nodeId, r1(ch.nx), r1(ch.nz), r1(ch.x), r1(ch.z), r2(ch.yaw), ch.bar, Math.ceil(ch.hp), CSTATES.indexOf(ch.state), r2(ch.t), ch.attack ? ATTACKS.indexOf(ch.attack) : -1, r2(ch.ax), r2(ch.az)]
export function decodeChamp(v: unknown): ChampRow | null {
  if (!Array.isArray(v) || v.length !== 13 || typeof v[0] !== 'string' || v[0].length > 64 || v.slice(1).some(n => !Number.isFinite(n))) return null
  const [, , , , , , bar, hp, st, , at] = v as ChampRow
  return [0, 1, 2].includes(bar) && hp > 0 && hp <= CHAMP.barHp && !!CSTATES[st] && (at === -1 || !!ATTACKS[at]) ? v as ChampRow : null
}
/** A guest takes the host's champion; returns what the guest's page should hear (a bar broke). */
export function applyChamp(c: Combat, T: Terrain, v: unknown, me: { x: number; z: number }): CombatEvent[] {
  const row = decodeChamp(v), out: CombatEvent[] = []
  if (!row || Math.min(Math.hypot(row[3] - me.x, row[4] - me.z), Math.hypot(row[1] - me.x, row[2] - me.z)) > CHAMP_SEEN_R) { c.champ = undefined; return out }
  const [nodeId, nx, nz, x, z, yaw, b, hp, st, t, at, ax, az] = row, bar = b as 0 | 1 | 2, state = CSTATES[st], attack = at < 0 ? null : ATTACKS[at]
  let ch = c.champ?.nodeId === nodeId ? c.champ : undefined
  if (!ch) {
    ch = { nodeId, nx, nz, x, y: T.heightAt(x, z), z, yaw, bar, hp, state, t, attack, queue: [], ax, az, hitDone: true, hitFlash: 0, sink: state === 'rise' ? 1 : 0 }
    c.champ = ch
  } else if (bar > ch.bar) out.push({ kind: 'champ-break', nodeId, bar: ch.bar })
  const thrown = attack === 'volley' && state === 'act' && !(ch.state === 'act' && ch.attack === 'volley')
  Object.assign(ch, { nx, nz, nX: x, nZ: z, yaw, bar, hp, state, t, attack, ax, az })
  if (thrown) throwVolley(c, ch, true)
  return out
}
/** A guest's rounds on the host's champion, budgeted: `spent` carries the sender's damage this second. */
export interface HitBudget { at: number; dmg: number }
export function champNetHit(c: Combat, T: Terrain, from: { id: string; x: number; z: number } | undefined, dmg: number, budget: Map<string, HitBudget>, now: number): boolean {
  const ch = c.champ
  if (!ch || !from || !(dmg > 0) || dmg > 200 || !thereAt(c, ch, from)) return false
  let b = budget.get(from.id)
  if (!b || now - b.at >= 1000) { b = { at: now, dmg: 0 }; budget.set(from.id, b) }
  if (b.dmg + dmg > CHAMP_DPS_MAX) return false
  b.dmg += dmg
  hurtChampion(c, T, ch, dmg)
  return true
}
/** what a guest was last shown of a champion; `done` = its fall was believed */
export interface Shown { node: string; bar: number; x: number; z: number; nx: number; nz: number; at: number; done: boolean; host: string; /** risen: a round could fell it */ up: boolean; /** the last fall believed (its repeats carry the same key) */ key?: number }
export const shownOf = (was: Shown | null, ch: Champion, host: string, at: number): Shown =>
  ({ node: ch.nodeId, bar: ch.bar, x: ch.x, z: ch.z, nx: ch.nx, nz: ch.nz, at, host, up: ch.state !== 'rise', key: was?.key, done: !!was?.done && was.node === ch.nodeId && ch.state !== 'rise' })
/** Is this word of its fall true for me? */
export function believeDown(s: Shown | null, from: string, v: unknown, me: { x: number; z: number }, now: number): string | null {
  const { n, k } = (v ?? {}) as { n?: unknown; k?: unknown }
  return s && !s.done && s.up && typeof k === 'number' && k !== s.key && s.host === from && n === s.node && s.bar === 2 && now - s.at < DOWN_MS && Math.min(Math.hypot(me.x - s.x, me.z - s.z), Math.hypot(me.x - s.nx, me.z - s.nz)) < THERE_R + 15 ? s.node : null
}
/** The host is back: the fight the interim host kept, as [node, bar, health]. Only ever a fight in progress. */
export const encodeHand = (ch: Champion) => ({ n: ch.nodeId, b: ch.bar, h: Math.ceil(ch.hp) })
export function takeHand(c: Combat, v: unknown, from: { x: number; z: number } | undefined, node: { id: string; x: number; z: number; quiet?: boolean } | undefined): boolean {
  const o = v as { n?: unknown; b?: unknown; h?: unknown } | null
  if (!o || !node || node.quiet || o.n !== node.id || (o.b !== 0 && o.b !== 1 && o.b !== 2) || typeof o.h !== 'number' || !(o.h > 0) || o.h > CHAMP.barHp || !from || Math.hypot(from.x - node.x, from.z - node.z) > CHAMP_SEEN_R) return false
  if (c.champ && c.champ.nodeId !== node.id) return false
  ;(c.dormant ??= {})[node.id] = Math.max(c.dormant[node.id] ?? 0, o.b)
  if (c.champ) { if (c.champ.bar < o.b) { c.champ.bar = o.b; c.champ.hp = o.h } }
  else (c.dormantHp ??= {})[node.id] = o.h
  return true
}
export { CHAMP_ID }
