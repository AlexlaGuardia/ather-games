// BETA M239 (sprites, 2026-11-27): SPIRITS USE THE TRAINING PIECES. Pure (no React, no three, no storage). Canon RULED
// athernyx 3a77c87 + c01931e/05f3d0d (game/shimmer-battles.md › How stats grow): party spirits use the pieces AS THEY PLEASE,
// within what the keeper allows (train-assign.ts); play, never drill; no forced sessions, no punishing timers. The play itself
// (walk to it, the per-kind motion, the finish) is spirit-trot.ts (M110 s1/s2); the point it spends is spirit-stats.ts
// (withPlay / trainPlay: pool + per-stat cap, M118 s2). This file adds the two things that were missing:
//  1. LEAN: which piece she is drawn to. A species with its own hand-tuned manner (spirit-models.ts toyLean) keeps it; every
//     other species leans to her SIGNATURE stat (her highest trainable stat in the fixed species base, spirit-growth.ts), the
//     closest the build has to a temperament's favoured stat until garden spirits carry one. Weights only: never forced.
//  2. OCCUPANCY: two spirits never share one piece at once. A spirit claims the piece when she picks it and holds it while she
//     walks there and plays; the claim is a short LEASE refreshed each frame, so a spirit that is unmounted (the keeper leaves
//     the garden, she is called off, the plot reloads) frees the piece by itself, with nothing to clean up.
import { SPECIES_BASE } from './spirit-growth'
import { TRAIN_STATS, type TrainStat } from './spirit-stats'
import type { Species } from '../../spirits/spirit'

/** DIALS (Jin's): fav = the draw of her signature stat's pieces (others 1); lease = ms a claim lives without a refresh */
export const USE = { fav: 1.5, lease: 1500 }

/** her signature trainable stat: the highest of PWR/GRD/AGI/VIG in her fixed species base (ties: the TRAIN_STATS order) */
export function favouredStat(sp: Species): TrainStat {
  const b = SPECIES_BASE[sp]
  let best: TrainStat = TRAIN_STATS[0]
  for (const k of TRAIN_STATS) if ((b?.[k] ?? 0) > (b?.[best] ?? 0)) best = k
  return best
}
const flat = (l: Readonly<Record<string, number>> | undefined) => !l || TRAIN_STATS.every(k => (l[k] ?? 1) === 1)
/** her lean over the four training stats: the species' own manner when it has one, else her signature stat x USE.fav */
export function leanFor(sp: Species, own?: Readonly<Record<string, number>>): Record<TrainStat, number> {
  if (!flat(own)) return Object.fromEntries(TRAIN_STATS.map(k => [k, own![k] ?? 1])) as Record<TrainStat, number>
  const fav = favouredStat(sp)
  return Object.fromEntries(TRAIN_STATS.map(k => [k, k === fav ? USE.fav : 1])) as Record<TrainStat, number>
}
/** pure: the weighted pick among `list` by her lean (r in [0,1)); -1 for an empty list */
export function pickToy(list: readonly { stat: string }[], lean: Readonly<Record<string, number>>, r: number): number {
  if (!list.length) return -1
  const w = list.map(t => Math.max(0, lean[t.stat] ?? 1)), sum = w.reduce((a, b) => a + b, 0)
  if (sum <= 0) return Math.min(list.length - 1, Math.floor(r * list.length))
  let c = r * sum, i = 0
  while (i < list.length - 1 && c > w[i]) { c -= w[i]; i++ }
  return i
}

/** OCCUPANCY: piece id -> who holds it and when the hold was last refreshed. `who` = any per-spirit token. */
export type Occupancy = {
  /** take or refresh the hold; false = another spirit holds it (a live lease) */
  claim: (piece: string, who: object, now: number) => boolean
  /** true = another spirit holds it right now */
  taken: (piece: string, who: object, now: number) => boolean
  /** let go (only the holder can) */
  release: (piece: string, who: object) => void
  /** who holds what (tests, the check's probe) */
  holders: (now: number) => Record<string, object>
  /** the table's clock (ms): the game's is real time; a test passes its own */
  now: () => number
}
export const wallClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
export function makeOccupancy(lease = USE.lease, clock: () => number = wallClock): Occupancy {
  const m = new Map<string, { who: object; at: number }>()
  const live = (piece: string, now: number) => { const h = m.get(piece); return h && now - h.at <= lease ? h : null }
  return {
    claim(piece, who, now) { const h = live(piece, now); if (h && h.who !== who) return false; m.set(piece, { who, at: now }); return true },
    taken(piece, who, now) { const h = live(piece, now); return !!h && h.who !== who },
    release(piece, who) { if (m.get(piece)?.who === who) m.delete(piece) },
    now: clock,
    holders(now) { const o: Record<string, object> = {}; for (const [k] of m) { const h = live(k, now); if (h) o[k] = h.who } return o },
  }
}
/** the garden's one shared table (every spirit on the plot reads the same pieces) */
export const PIECE_USE = makeOccupancy()

// M239b (Alex 11-27, ruling on M239): ONE SESSION A GAME DAY. The Allow gate stays (opt-in per spirit, train-assign.ts). A spirit
// active in the garden goes to ONE allowed piece a game day, plays, gets her point, and that is her session for the day (the
// refusal lives in spirit-stats.ts withPlay). Allowed on several: she picks one at RANDOM, seeded per spirit + day (this replaces
// the signature-stat lean above for the garden). None allowed: she never trains.
/** pure: a 32-bit FNV-1a hash, the per-spirit-per-day seed */
function seedOf(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h
}
/** pure: today's piece for spirit `spirit` among the pieces she is allowed on (ids, any order), or null (none allowed).
 *  The same spirit + day always picks the same piece, whatever order the list comes in. */
export function dailyPiece(allowed: readonly string[], spirit: string, day: number): string | null {
  if (!allowed.length) return null
  const l = [...new Set(allowed)].sort()
  return l[seedOf(`${spirit}|${day}`) % l.length]
}
