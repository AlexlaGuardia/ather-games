// ── SPIRITS FETCH GROUND LOOT (BETA M141 s2, Alex 11-24; canon RULED-AFK athernyx dbdda14). A following spirit may, BY HER OWN
// CHOICE, go to a drop near the keeper, pick it up, come back and toss it; the keeper gets it on landing. No verb, no toggle: a
// spirit may not bother, and the keeper can always pick it up unhelped (walk up to a drop she is going for and she lets it go).
// ★ ONE SOURCE OF LOOT: ground-loot.ts. She HOLDS a drop with claimLoot (one holder, memory only) and it leaves the save only by
//   payLoot when her toss lands. So a reload, a zone change or a travel mid-fetch = the drop on the ground where it lay; called
//   off with it in her mouth = set down where she stands (moveLoot, same id). More drops fetched, never more loot.
// ★ ONLY when no Hollow is about and she is not in a fight (spirit-fight's slot wins anyway), never faster than the keeper walks.
// ★ EAGERNESS PER SPECIES = the one table FETCH (Alex OK'd list 11-24, off canon's temperament column). Pure; the look is
//   ground-loot-view.tsx, her walk = the follow walk (ather/spirit-model.tsx asks fetchSlot before her skit / formation slot).
// Mana'mals never join (only a following spirit's model calls joinFetch).
import type { Species } from '../../spirits/spirit'
import { LOOT_REST_MS, claimLoot, holderOf, moveLoot, releaseLoot, type Loot, type Spot3 } from './ground-loot'

/** m/s: the keeper's walk (shared/locomotion.ts WALK_SPEED; the test holds them equal). No fetch is ever faster. */
export const FETCH_WALK = 4.2
export type FetchStyle = 'prank' | 'hop' | 'pluck' | 'dart' | 'swoop' | 'echo' | 'tiny' | 'amble' | 'pressed' | 'patient'
export interface Manner {
  /** 0..1: how likely she bothers with a drop (decided once per drop) */ chance: number
  /** m from the KEEPER a drop may lie for her to go for it */ r: number
  /** s a drop lies before she sets off */ wait: number
  /** her speed on a fetch, a share of the keeper's walk (never above 1) */ v: number
  /** only tiny things (a shard, a dewl, a lump; never a log) */ tiny?: boolean
  /** takes it while it is still falling (no rest) */ midAir?: boolean
  style: FetchStyle
}
// FOR FUN: Vulnyx steals it as a prank (dashes), Croakling hops on it, Hovari plucks it mid-air, Lepara darts out and back.
// WHEN IT SUITS THEM: Athowl waits then swoops once, Noctyx finds far drops by echo, Luminara only tiny things, Manalotl ambles.
// RARELY: Dewbear stays pressed to you, Shellmere slow + patient but picks up anything.
export const FETCH: Record<Species, Manner> = {
  fox:           { chance: 0.9,  r: 8,  wait: 0.3, v: 1,    style: 'prank' },
  frog:          { chance: 0.8,  r: 6,  wait: 0.4, v: 0.7,  style: 'hop' },
  hummingbird:   { chance: 0.8,  r: 7,  wait: 0,   v: 0.9,  style: 'pluck', midAir: true },
  rabbit:        { chance: 0.8,  r: 6,  wait: 0.2, v: 1,    style: 'dart' },
  owl:           { chance: 0.5,  r: 9,  wait: 2.5, v: 1,    style: 'swoop' },
  bat:           { chance: 0.5,  r: 14, wait: 1,   v: 0.8,  style: 'echo' },
  firefly:       { chance: 0.5,  r: 7,  wait: 0.8, v: 0.7,  style: 'tiny', tiny: true },
  axolotl:       { chance: 0.5,  r: 6,  wait: 1.5, v: 0.45, style: 'amble' },
  'water-bear':  { chance: 0.12, r: 3,  wait: 1.5, v: 0.5,  style: 'pressed' },
  turtle:        { chance: 0.2,  r: 6,  wait: 3,   v: 0.35, style: 'patient' },
}
/** the fetch's dials (not species manners) */
export const FETCH_DIAL = {
  pickM: 0.7,    // m from the drop that counts as picked up
  tossM: 2.4,    // m from the keeper she tosses from
  tossS: 0.55,   // s the toss is in the air
  giveUpS: 12,   // s on her way before she gives up (it cannot be reached)
  carryS: 20,    // s carrying before she sets it down where she stands (cannot get back to the keeper)
  leash: 4,      // m past her radius the keeper may walk off before she lets the drop be
} as const
/** a lump small enough for Luminara: not a log, a mast or a blankstone, at most two */
export const tinyLoot = (d: Pick<Loot, 'item' | 'n'>) => !d.item.endsWith('_log') && d.item !== 'mast' && d.item !== 'blankstone' && d.n <= 2
/** 0..1, the same for this spirit and this drop every time she looks (she decides once) */
export function wantRoll(spirit: string, loot: string): number {
  let h = 2166136261
  for (const c of `${spirit}|${loot}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return (h % 100000) / 100000
}
export const whoOf = (id: string) => `spirit:${id}`

type Phase = 'go' | 'carry' | 'toss'
interface Run { sp: Species; phase: Phase | null; loot: string; item: string; n: number; t: number; at: Spot3 | null; from: Spot3 | null }
const runs = new Map<string, Run>()
let keeperAt: Spot3 = { x: 0, y: 0, z: 0 }, seen: readonly Loot[] = []
const d2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

/** a following spirit (her model, while she follows) */
export function joinFetch(id: string, sp: Species) { const r = runs.get(id); if (r) r.sp = sp; else runs.set(id, { sp, phase: null, loot: '', item: '', n: 0, t: 0, at: null, from: null }) }
/** she stops following: anything she holds is let go; in her mouth = set down where she stands */
export function leaveFetch(id: string) { const r = runs.get(id); if (r) letGo(id, r, true); runs.delete(id) }
/** the ground is gone (left the zone, the page): every hold let go; the save still has every drop where it lay */
export function endFetch() { for (const [id, r] of runs) letGo(id, r, false) }
function letGo(id: string, r: Run, setDown: boolean) {
  if (r.phase && r.phase !== 'go' && setDown && r.at) moveLoot(r.loot, whoOf(id), r.at)
  if (r.phase) releaseLoot(r.loot, whoOf(id))
  r.phase = null; r.loot = ''; r.t = 0; r.from = null
}

export interface FetchInput {
  now: number; dt: number
  keeper: Spot3
  loot: readonly Loot[]
  /** where she stands now (null = not drawn) */ at: (id: string) => Spot3 | null
  /** a Hollow is about (no fetching then) */ hollow: boolean
  /** she is in a fight */ fighting: (id: string) => boolean
  /** the keeper can take things (not down, not travelling) */ can: boolean
  fits: (item: string) => boolean
  /** the keeper is about to take this one themselves (in their pull) */ keeperTakes: (d: Loot) => boolean
  /** her toss landed: put it in the bag (payLoot; the drop already lies at the keeper's feet) */ pay: (loot: string, who: string) => void
}
/** One frame of every following spirit's fetch. */
export function tickFetch(I: FetchInput): void {
  keeperAt = I.keeper; seen = I.loot
  const byId = new Map(I.loot.map(d => [d.id, d]))
  for (const [id, r] of runs) {
    const me = whoOf(id), p = I.at(id), m = FETCH[r.sp]
    if (p) r.at = p
    if (!p || I.hollow || I.fighting(id)) { if (r.phase) letGo(id, r, true); continue }   // a Hollow / a fight / she is not drawn: set down where she stood
    if (!r.phase) {
      let best: Loot | null = null, bd = Infinity
      for (const d of I.loot) {
        const age = (I.now - d.at) / 1000
        if (holderOf(d.id) !== undefined || d2(d, I.keeper) > m.r || age < m.wait || (!m.midAir && I.now - d.at < LOOT_REST_MS)) continue
        if ((m.tiny && !tinyLoot(d)) || wantRoll(id, d.id) >= m.chance || !I.fits(d.item) || I.keeperTakes(d)) continue
        const dd = d2(d, p); if (dd < bd) { bd = dd; best = d }
      }
      if (best && claimLoot(best.id, me)) Object.assign(r, { phase: 'go', loot: best.id, item: best.item, n: best.n, t: 0, from: null })
      continue
    }
    const d = byId.get(r.loot)
    if (!d || holderOf(r.loot) !== me) { if (holderOf(r.loot) === me) releaseLoot(r.loot, me); r.phase = null; r.loot = ''; continue }   // gone (paid in another tab, its life ran out)
    r.t += I.dt
    if (r.phase === 'go') {
      if (I.keeperTakes(d) || d2(d, I.keeper) > m.r + FETCH_DIAL.leash || r.t > FETCH_DIAL.giveUpS) { letGo(id, r, false); continue }
      if (d2(d, p) <= FETCH_DIAL.pickM) { r.phase = 'carry'; r.t = 0 }
    } else if (r.phase === 'carry') {
      if (d2(p, I.keeper) <= FETCH_DIAL.tossM && I.can) { r.phase = 'toss'; r.t = 0; r.from = { ...p } }
      else if (r.t > FETCH_DIAL.carryS) letGo(id, r, true)
    } else if (r.t >= FETCH_DIAL.tossS) {
      const loot = r.loot; r.phase = null; r.loot = ''; r.from = null
      if (moveLoot(loot, me, I.keeper)) I.pay(loot, me); else releaseLoot(loot, me)
    }
  }
}

/** Where her fetch walks her (null = no fetch: her skit / formation slot). `vMax` = never faster than the keeper walks. */
export function fetchSlot(id: string, loot: readonly Loot[] = seen): { x: number; z: number; face: number; vMax: number } | null {
  const r = runs.get(id); if (!r?.phase) return null
  const vMax = FETCH_WALK * Math.min(1, FETCH[r.sp].v), p = r.at ?? keeperAt, k = keeperAt
  if (r.phase === 'go') { const d = loot.find(o => o.id === r.loot); return d ? { x: d.x, z: d.z, face: Math.atan2(d.x - p.x, d.z - p.z), vMax } : null }
  if (r.phase === 'toss') return { x: p.x, z: p.z, face: Math.atan2(k.x - p.x, k.z - p.z), vMax }
  const dk = d2(p, k), u = dk > 1e-3 ? FETCH_DIAL.tossM * 0.6 / dk : 0
  return { x: k.x + (p.x - k.x) * u, z: k.z + (p.z - k.z) * u, face: Math.atan2(k.x - p.x, k.z - p.z), vMax }
}
/** What is in a spirit's mouth or in the air now (the look draws it there instead of on the ground). `u` = the toss, 0..1. */
export function fetchCarried(): { loot: string; spirit: string; phase: 'carry' | 'toss'; at: Spot3; from: Spot3 | null; to: Spot3; u: number }[] {
  const out: ReturnType<typeof fetchCarried> = []
  for (const [id, r] of runs) if ((r.phase === 'carry' || r.phase === 'toss') && r.at) out.push({ loot: r.loot, spirit: id, phase: r.phase, at: r.at, from: r.from, to: keeperAt, u: r.phase === 'toss' ? Math.min(1, r.t / FETCH_DIAL.tossS) : 0 })
  return out
}
/** checks: READ only */
export const fetchState = () => [...runs].map(([id, r]) => ({ id, sp: r.sp, phase: r.phase, loot: r.loot }))
/** Test hook. */
export const _resetFetch = () => { endFetch(); runs.clear() }
