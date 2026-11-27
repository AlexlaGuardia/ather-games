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

// ── M141 s3 HOW EACH ONE FETCHES (Alex's OK'd list 11-24): the path / timing / height of her go and carry. Pure numbers off her
// progress; her model adds `lift` to her height and walks to fetchSlot's point at its vMax. No new clips: the trot's run / walk /
// sit (and a flier's flight) blend off the speed she really covers.
//  prank  Vulnyx DASHES in (a burst), then bounces a little way off with it before bringing it
//  hop    Croakling HOPS: an arc each HOP.len, the last one landing on the drop (and hopping back)
//  pluck  Hovari keeps her hover height and DIPS only as she grabs it
//  dart   Lepara darts out fast (a burst), back as fast as the walk allows
//  swoop  Athowl WAITS where she is, rising, then dives ONCE down onto the drop
//  echo   Noctyx flies STRAIGHT at her far drop, a flat cruise up off the ground
//  amble  Manalotl ambles: a slow sway either side of the line
//  tiny / pressed / patient: the plain walk at their own pace (Luminara's picking, Dewbear's 3 m and Shellmere's slowness are the table)
// ★ NEVER FASTER THAN THE KEEPER'S WALK ON AVERAGE: a burst is a share of the walk above 1 on her way out ONLY. From the moment
//   she claims a drop her run counts the ground she really covered (D) against the time it took (T); carrying back, her speed is
//   the most that still lands the whole round trip at D <= FETCH_WALK x T, and she does not toss until it does (a prank teases
//   with it a moment). So the round trip (claim to toss) never averages above the walk, whatever the burst. fetchSlot / tickFetch.
export const FETCH_BURST: Partial<Record<FetchStyle, number>> = { prank: 1.6, dart: 1.4 }   // her way out, a share of the walk
export const HOP = { len: 0.9, h: 0.32 } as const       // m a hop covers, m high at its top
export const PLUCK = { dip: 0.45, from: 0.75, out: 0.4 } as const   // m she dips; from this share of the way; s to rise again
export const SWOOP = { hold: 1.1, h: 1.5 } as const     // s she waits (rising), m high she dives from
export const ECHO = { h: 0.7 } as const                 // m her flat cruise
export const AMBLE = { side: 0.6, len: 1.6, ahead: 0.8 } as const   // m either side, m per sway, m ahead she aims
export const PRANK = { off: 1.3, s: 0.9, h: 0.14, hop: 0.5 } as const   // m she bounces off, s at most, m bounce high, m a bounce
/** her lowest speed while carrying (paying back a burst): she never stops dead with it */
const SLOW = 0.2
type Phase = 'go' | 'carry' | 'toss'
interface Run { sp: Species; phase: Phase | null; loot: string; item: string; n: number; t: number; at: Spot3 | null; from: Spot3 | null
  /** M141 s3 */ o: Spot3 | null; d0: number; c0: number; D: number; T: number; lift: number; off: Spot3 | null; trace: FetchSample[] }
export interface FetchSample { t: number; phase: Phase; x: number; z: number; lift: number; dx: number; dz: number }
const runs = new Map<string, Run>()
let keeperAt: Spot3 = { x: 0, y: 0, z: 0 }, seen: readonly Loot[] = []
const d2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

/** a following spirit (her model, while she follows) */
export function joinFetch(id: string, sp: Species) { const r = runs.get(id); if (r) r.sp = sp; else runs.set(id, { sp, phase: null, loot: '', item: '', n: 0, t: 0, at: null, from: null, o: null, d0: 0, c0: 0, D: 0, T: 0, lift: 0, off: null, trace: [] }) }
/** she stops following: anything she holds is let go; in her mouth = set down where she stands */
export function leaveFetch(id: string) { const r = runs.get(id); if (r) letGo(id, r, true); runs.delete(id) }
/** the ground is gone (left the zone, the page): every hold let go; the save still has every drop where it lay */
export function endFetch() { for (const [id, r] of runs) letGo(id, r, false) }
function letGo(id: string, r: Run, setDown: boolean) {
  if (r.phase && r.phase !== 'go' && setDown && r.at) moveLoot(r.loot, whoOf(id), r.at)
  if (r.phase) releaseLoot(r.loot, whoOf(id))
  r.phase = null; r.loot = ''; r.t = 0; r.from = null; r.off = null
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
    const me = whoOf(id), p = I.at(id), m = FETCH[r.sp], last = r.at
    if (p) r.at = p
    if (r.phase && r.phase !== 'toss' && p && last) { r.D += d2(p, last); r.T += I.dt }   // M141 s3: the round trip's ground + time
    if (!r.phase) r.lift *= Math.exp(-I.dt * 8)
    if (!p || I.hollow || I.fighting(id)) { if (r.phase) letGo(id, r, true); continue }   // a Hollow / a fight / she is not drawn: set down where she stood
    if (!r.phase) {
      let best: Loot | null = null, bd = Infinity
      for (const d of I.loot) {
        const age = (I.now - d.at) / 1000
        if (holderOf(d.id) !== undefined || d2(d, I.keeper) > m.r || age < m.wait || (!m.midAir && I.now - d.at < LOOT_REST_MS)) continue
        if ((m.tiny && !tinyLoot(d)) || wantRoll(id, d.id) >= m.chance || !I.fits(d.item) || I.keeperTakes(d)) continue
        const dd = d2(d, p); if (dd < bd) { bd = dd; best = d }
      }
      if (best && claimLoot(best.id, me)) Object.assign(r, { phase: 'go', loot: best.id, item: best.item, n: best.n, t: 0, from: null, o: { ...p }, d0: Math.max(0.01, bd), D: 0, T: 0, off: null, trace: [] })
      continue
    }
    const d = byId.get(r.loot)
    if (!d || holderOf(r.loot) !== me) { if (holderOf(r.loot) === me) releaseLoot(r.loot, me); r.phase = null; r.loot = ''; continue }   // gone (paid in another tab, its life ran out)
    r.t += I.dt
    if (r.phase === 'go') {
      if (I.keeperTakes(d) || d2(d, I.keeper) > m.r + FETCH_DIAL.leash || r.t > FETCH_DIAL.giveUpS) { letGo(id, r, false); continue }
      if (d2(d, p) <= FETCH_DIAL.pickM) { r.phase = 'carry'; r.t = 0; r.c0 = Math.max(0.01, d2(p, I.keeper)); r.off = m.style === 'prank' ? bounceOff(p, I.keeper) : null }
    } else if (r.phase === 'carry') {
      if (r.off && (d2(p, r.off) < 0.3 || r.t > PRANK.s)) r.off = null   // the prank's bounce is done: now she brings it
      if (!r.off && d2(p, I.keeper) <= FETCH_DIAL.tossM && I.can && r.D <= FETCH_WALK * r.T + 1e-6) { r.phase = 'toss'; r.t = 0; r.from = { ...p } }
      else if (r.t > FETCH_DIAL.carryS) letGo(id, r, true)
    } else if (r.t >= FETCH_DIAL.tossS) {
      const loot = r.loot; r.phase = null; r.loot = ''; r.from = null
      if (moveLoot(loot, me, I.keeper)) I.pay(loot, me); else releaseLoot(loot, me)
    }
    if (r.phase) {
      r.lift = liftOf(m.style, r, p, d, I.keeper)
      if (r.trace.length < 600) r.trace.push({ t: r.T, phase: r.phase, x: p.x, z: p.z, lift: r.lift, dx: d.x, dz: d.z })
    }
  }
}
/** the prank's bounce: a little way on past the drop, away from the keeper and a touch aside */
function bounceOff(p: Spot3, k: Spot3): Spot3 {
  const dk = Math.max(1e-3, d2(p, k)), ux = (p.x - k.x) / dk, uz = (p.z - k.z) / dk
  return { x: p.x + (ux * 0.8 - uz * 0.6) * PRANK.off, y: p.y, z: p.z + (uz * 0.8 + ux * 0.6) * PRANK.off }
}
const smooth = (u: number) => { const c = Math.min(1, Math.max(0, u)); return c * c * (3 - 2 * c) }
/** m above her own height this frame (pure: her style, how far along she is) */
export function liftOf(style: FetchStyle, r: Pick<Run, 'phase' | 't' | 'd0' | 'c0' | 'D' | 'off'>, p: { x: number; z: number }, d: { x: number; z: number }, k: { x: number; z: number }): number {
  const pk = FETCH_DIAL.pickM, s = r.phase === 'go' ? Math.min(1, Math.max(0, 1 - (d2(p, d) - pk) / Math.max(0.01, r.d0 - pk))) : Math.min(1, Math.max(0, 1 - (d2(p, k) - FETCH_DIAL.tossM * 0.6) / Math.max(0.01, r.c0 - FETCH_DIAL.tossM * 0.6)))
  if (r.phase === 'toss') return 0
  switch (style) {
    case 'hop': { const n = r.phase === 'go' ? Math.max(1, Math.round((r.d0 - pk) / HOP.len)) : Math.max(1, Math.round(r.c0 / HOP.len)); return HOP.h * Math.abs(Math.sin(Math.PI * s * n)) }
    case 'pluck': return r.phase === 'go' ? -PLUCK.dip * smooth((s - PLUCK.from) / (1 - PLUCK.from)) : -PLUCK.dip * (1 - smooth(r.t / PLUCK.out))
    case 'swoop': return r.phase === 'go' ? (r.t < SWOOP.hold ? SWOOP.h * smooth(r.t / SWOOP.hold) : SWOOP.h * (1 - s) * (1 - s)) : 0
    case 'echo': return ECHO.h * Math.min(1, 4 * s, 4 * (1 - s))
    case 'prank': return r.phase === 'carry' && r.off ? PRANK.h * Math.abs(Math.sin(Math.PI * r.D / PRANK.hop)) : 0
    default: return 0
  }
}
/** M141 s3: how high her fetch lifts (or, a Hovari's grab, dips) her this frame; her model adds it to her height */
export const fetchLift = (id: string) => runs.get(id)?.lift ?? 0

/** Where her fetch walks her (null = no fetch: her skit / formation slot). `vMax` = never faster than the keeper walks. */
export function fetchSlot(id: string, loot: readonly Loot[] = seen): { x: number; z: number; face: number; vMax: number } | null {
  const r = runs.get(id); if (!r?.phase) return null
  const m = FETCH[r.sp], walk = FETCH_WALK * Math.min(1, m.v), p = r.at ?? keeperAt, k = keeperAt
  if (r.phase === 'go') {
    const d = loot.find(o => o.id === r.loot); if (!d) return null
    const face = Math.atan2(d.x - p.x, d.z - p.z), vMax = FETCH_WALK * (FETCH_BURST[m.style] ?? Math.min(1, m.v))
    if (m.style === 'swoop' && r.t < SWOOP.hold) return { x: p.x, z: p.z, face, vMax: walk }   // she waits where she is, rising
    if (m.style === 'amble') {   // a slow sway either side of the line, aimed a little ahead of her
      const dd = d2(p, d); if (dd > AMBLE.ahead * 1.5) {
        const ux = (d.x - p.x) / dd, uz = (d.z - p.z) / dd, w = AMBLE.side * Math.cos(2 * Math.PI * r.D / AMBLE.len)
        return { x: p.x + ux * AMBLE.ahead - uz * w, z: p.z + uz * AMBLE.ahead + ux * w, face, vMax } }
    }
    return { x: d.x, z: d.z, face, vMax }
  }
  if (r.phase === 'toss') return { x: p.x, z: p.z, face: Math.atan2(k.x - p.x, k.z - p.z), vMax: walk }
  const dk = d2(p, k), u = dk > 1e-3 ? FETCH_DIAL.tossM * 0.6 / dk : 0
  const to = r.off ?? { x: k.x + (p.x - k.x) * u, z: k.z + (p.z - k.z) * u }
  // ★ the round trip's cap: the most she may go and still land D <= walk x T at the toss (in debt = her slowest)
  const R = r.off ? d2(p, r.off) + Math.max(0, d2(r.off, k) - FETCH_DIAL.tossM) : Math.max(0, dk - FETCH_DIAL.tossM), left = (r.D + R) / FETCH_WALK - r.T
  const vAll = left > 1e-3 ? R / left : 0, vMax = Math.min(FETCH_WALK * (m.style === 'dart' ? 1.4 : Math.min(1, m.v)), Math.max(FETCH_WALK * SLOW, vAll))
  return { x: to.x, z: to.z, face: r.off ? Math.atan2(to.x - p.x, to.z - p.z) : Math.atan2(k.x - p.x, k.z - p.z), vMax }
}
/** What is in a spirit's mouth or in the air now (the look draws it there instead of on the ground). `u` = the toss, 0..1. */
export function fetchCarried(): { loot: string; spirit: string; phase: 'carry' | 'toss'; at: Spot3; from: Spot3 | null; to: Spot3; u: number }[] {
  const out: ReturnType<typeof fetchCarried> = []
  for (const [id, r] of runs) if ((r.phase === 'carry' || r.phase === 'toss') && r.at) out.push({ loot: r.loot, spirit: id, phase: r.phase, at: r.at, from: r.from, to: keeperAt, u: r.phase === 'toss' ? Math.min(1, r.t / FETCH_DIAL.tossS) : 0 })
  return out
}
/** checks: READ only */
export const fetchState = () => [...runs].map(([id, r]) => ({ id, sp: r.sp, phase: r.phase, loot: r.loot, style: FETCH[r.sp].style, lift: +r.lift.toFixed(3), D: +r.D.toFixed(2), T: +r.T.toFixed(2) }))
/** checks: READ only. M141 s3: her current (or last) run's samples, one a frame, claim to toss */
export const fetchTrace = (id: string): readonly FetchSample[] => runs.get(id)?.trace ?? []
/** Test hook. */
export const _resetFetch = () => { endFetch(); runs.clear() }
