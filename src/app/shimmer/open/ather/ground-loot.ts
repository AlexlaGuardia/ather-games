// ── GROUND LOOT (BETA M141 s1, Alex 11-24): a finished tree / crystal drops its M136 yield on the ground; walk near and it comes.
// ★ ONE SOURCE: channel.ts Work.drops, paid once a cycle (finishWork). A drop's id is <node>:<node id>:<cycle's reset>:<k>, so the
//   same cycle put down twice is still one set.
// ★ THE SAVED RECORD IS THE TRUTH: a drop lies where it lies until payLoot takes it out of the save. Flying to the keeper (and, in
//   s2, riding with a spirit) is a CLAIM: memory only, one holder at a time. A reload, a zone change or a travel mid-flight lets go
//   of the claim and the drop is on the ground again. Every change reads the save first, so a second tab cannot pay one twice.
// ★ Loot outlives its node's reset and the season: nothing but LOOT_LIFE_MS (real time) or a pick-up takes it.
// Garden-tied like the node work (GARDEN_KEY_SPECS): never networked, a party mate has their own. Pure; the look = ground-loot-view.tsx.
import { gardenKey } from '@/lib/keeper-local'
import { ownerSlot } from '../shared/owner-store'
import type { NodeKind, Stack } from './channel'

/** real time before a drop may vanish. Alex: at least 10 minutes. */
export const LOOT_LIFE_MS = 30 * 60_000
/** metres: closer than this a drop comes to the keeper (grey matter's 4.5 is combat.ts, untouched) */
export const LOOT_PULL_M = 2
/** metres of height a pull reaches over (not up a cliff) */
export const LOOT_PULL_UP = 2.5
/** ms a drop lies before it can be pulled, so it is seen to fall */
export const LOOT_REST_MS = 600
/** an item of one node lies in at most this many piles */
export const LOOT_PILES = 3

export interface Loot { id: string; item: string; n: number; x: number; y: number; z: number; at: number }
export interface Spot3 { x: number; y: number; z: number }

const KEY = 'open.loot.v1'
let loot: Loot[] = [], unsaved = false
const claims = new Map<string, string>()
const slot = ownerSlot(() => gardenKey(KEY), () => { loot = []; unsaved = false; claims.clear() })
const num = Number.isFinite
const valid = (v: unknown): v is Loot => {
  const d = v as Loot
  return !!d && typeof d.id === 'string' && typeof d.item === 'string' && Number.isInteger(d.n) && d.n > 0 && num(d.x) && num(d.y) && num(d.z) && num(d.at)
}
function read(): void {
  try {
    const s = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null'), seen = new Set<string>()
    loot = (Array.isArray(s?.drops) ? s.drops as unknown[] : []).filter((d): d is Loot => valid(d) && !seen.has(d.id) && !!seen.add(d.id))
  } catch { /* private window, or rubbish: what is in memory stands */ }
}
function load(): void { if (slot.due()) { loot = []; read() } }
/** before a change: what the save says NOW (a second tab may have paid one); a save that could not be written is not read back */
function fresh(): void { load(); if (slot.writable() && !unsaved) read() }
function save(): void {
  if (!slot.writable()) return
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify({ v: 1, drops: loot })); unsaved = false } catch { unsaved = true }
}
const gone = (d: Loot, now: number) => now - d.at >= LOOT_LIFE_MS
/** Everything lying about now. */
export function lootNow(now = Date.now()): readonly Loot[] {
  load()
  if (loot.some(d => gone(d, now))) { fresh(); loot = loot.filter(d => !gone(d, now)); save(); for (const id of claims.keys()) if (!loot.some(d => d.id === id)) claims.delete(id) }
  return loot
}
/** The piles of a yield: an item's n split over at most LOOT_PILES. */
export function pilesOf(drops: readonly Stack[]): Stack[] {
  return drops.flatMap(s => { const k = Math.min(LOOT_PILES, Math.floor(s.n)); return Array.from({ length: Math.max(0, k) }, (_, i) => ({ id: s.id, n: Math.floor(s.n / k) + (i < s.n % k ? 1 : 0) })) })
}
/** A node is finished: its yield lies on `spots` (one per pile, reused when there are fewer). `until` = the cycle (finishWork). */
export function dropLoot(node: NodeKind, id: string, until: number, drops: readonly Stack[], spots: readonly Spot3[], now = Date.now()): Loot[] {
  fresh()
  const add = pilesOf(drops).map((s, k): Loot => ({ id: `${node}:${id}:${until}:${k}`, item: s.id, n: s.n, ...spots[k % spots.length], at: now })).filter(d => !loot.some(o => o.id === d.id))
  loot = [...loot, ...add]; save()
  return add
}
/** Hold a drop (the keeper's pull; s2: a spirit). One holder; false = gone, or another has it. */
export function claimLoot(id: string, who: string): boolean {
  load()
  if (!loot.some(d => d.id === id) || (claims.get(id) ?? who) !== who) return false
  claims.set(id, who)
  return true
}
export function releaseLoot(id: string, who: string): void { if (claims.get(id) === who) claims.delete(id) }
export const holderOf = (id: string) => claims.get(id)
/** The one way out of the record: `give` puts n in the bag and answers what did not fit (that stays on the ground). Null = not
 *  there any more, or another holds it. The claim is over either way. */
export function payLoot(id: string, who: string, give: (item: string, n: number) => number, now = Date.now()): { item: string; got: number; left: number } | null {
  fresh()
  const d = loot.find(o => o.id === id), held = claims.get(id)
  if (!d || gone(d, now) || (held !== undefined && held !== who)) { if (held === who) claims.delete(id); return null }
  const left = Math.max(0, Math.min(d.n, give(d.item, d.n)))
  loot = left ? loot.map(o => (o === d ? { ...d, n: left } : o)) : loot.filter(o => o !== d)
  claims.delete(id)
  if (left < d.n) save()
  return { item: d.item, got: d.n - left, left }
}
/** Is the keeper close enough for this one to come? */
export const inPull = (d: Loot, f: Spot3, now: number) => now - d.at >= LOOT_REST_MS && Math.hypot(d.x - f.x, d.z - f.z) <= LOOT_PULL_M && Math.abs(d.y - f.y) <= LOOT_PULL_UP

// ── where it lands ──────────────────────────────────────────────────────────────────────────────────────────────
export const CELL = 0.5, REACH_M = 16, STEP_UP = 0.5, LEVEL_M = 0.8
/** Spots for `n` piles beside (node), each one a place the keeper can WALK to from where they stand: a flood over `free` ground
 *  (dry, solid, no pit, no trunk), never a step higher than STEP_UP. First choice 0.9 to 2.6 m from the node and level with it (a node on a slope); nothing there
 *  (it stands over a gap) = the nearest ground they can reach; none at all = their own feet. */
export function lootSpots(node: { x: number; z: number; y?: number }, feet: Spot3, n: number, free: (x: number, z: number) => boolean, height: (x: number, z: number) => number, rand: () => number = Math.random): Spot3[] {
  const key = (i: number, j: number) => i * 1000 + j, R = Math.ceil(REACH_M / CELL), at = (i: number, j: number): Spot3 | null => {
    const x = feet.x + i * CELL, z = feet.z + j * CELL
    if (!free(x, z)) return null
    const y = height(x, z); return Number.isFinite(y) ? { x, y, z } : null
  }
  const seen = new Set<number>(), q: { i: number; j: number; s: Spot3 }[] = []
  const add = (i: number, j: number, from: Spot3 | null) => {
    const k = key(i, j); if (seen.has(k) || Math.abs(i) > R || Math.abs(j) > R) return
    const s = at(i, j); if (!s || (from && Math.abs(s.y - from.y) > STEP_UP)) return
    seen.add(k); q.push({ i, j, s })
  }
  for (let r = 0; r <= 2 && !q.length; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) add(i, j, null)   // the keeper may stand half over an edge
  for (let k = 0; k < q.length; k++) { const c = q[k]; add(c.i + 1, c.j, c.s); add(c.i - 1, c.j, c.s); add(c.i, c.j + 1, c.s); add(c.i, c.j - 1, c.s) }
  const all = q.map(c => ({ s: c.s, d: Math.hypot(c.s.x - node.x, c.s.z - node.z) })).sort((a, b) => a.d - b.d)
  const by = all.filter(c => c.d >= 0.9 && c.d <= 2.6), level = by.filter(c => Math.abs(c.s.y - (node.y ?? c.s.y)) <= LEVEL_M), from = level.length >= Math.min(3, n) ? level : by.length ? by : all.slice(0, Math.max(1, n))
  if (!from.length) return [{ ...feet }]
  const out: Spot3[] = []
  for (let k = 0; k < n; k++) {
    const pool = from.filter(c => !out.some(o => o.x === c.s.x && o.z === c.s.z)), pick = pool.length ? pool : from
    // of three tries, the one furthest from what lies already: a scatter, not a heap
    const tries = [0, 1, 2].map(() => pick[Math.min(pick.length - 1, Math.floor(rand() * pick.length))].s)
    out.push({ ...tries.sort((a, b) => Math.min(9, ...out.map(o => Math.hypot(o.x - b.x, o.z - b.z))) - Math.min(9, ...out.map(o => Math.hypot(o.x - a.x, o.z - a.z))))[0] })
  }
  return out
}
/** Test hook. */
export const _resetLoot = () => { load(); loot = []; claims.clear(); save() }
