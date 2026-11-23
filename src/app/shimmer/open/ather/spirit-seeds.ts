// M76 s1: MANA SEEDS, THE SPIRIT PLANTER, AND THE ANEMONYX'S VISITS (Alex 11-22; Magii 68808f3 + b10842a).
//
// Canon (read-only law, world/spirits-species.md › MANA SEEDS ARE PER-SPECIES, CANON_GAPS 2026-11-22 [RULED]):
//  · TEN seeds, one per base form; a seed already IS its species from the moment the Bloom cast it. The randomness lives
//    in the wind and in the finding, NEVER in the pot: the planter, the garden and the hour decide nothing.
//  · A seed is an EVENT, not a resource: not farmed, not sold, not crafted. Its one source here is the Anemonyx herself,
//    who surfaces in the cloud-wall at the edge of a keeper's green, by its gate, every few days in 1672, and drops one
//    seed for a keeper who reaches her that day.
//  · A seed HINTS at its species, never its element (a spirit is gold until it evolves). Every seed is NAMED just
//    'Mana Seed' (Alex: "if you know you know"); only its icon carries the tell.
// Jin's (build): the visit gap (5-10 game days, Alex's number), how long a bloom takes, which seed she brings, the planter
// recipe. No new names: the planter + pedestal are plain nouns.
//
// ★ PURE. No React, no storage (grimoire-book.ts + the page own the saves).
import type { Species } from '../../spirits/spirit'
import { GAME_DAY_MS } from './nodes'
import { SPECIES, SEED_IDS, seedOf, speciesOf, type SeedId } from './seed-items'
import { countOf, take, type Inv } from '../shared/inventory'
import { bankCount, bankTake, type Bank } from './garden-bank'
export * from './seed-items'

// ── the planter ─────────────────────────────────────────────────────────────────────────────────────────────────────
// M106 (Alex 11-23): growth is counted in GAME DAYS, and the planter's Turn became TEND. "if you tend for the first two days
// the seed blooms at the start of the 3rd day not the end". Untended: plant + BLOOM_DAYS. Each tend (once per game day per
// planter, the calendar day = floor(now / GAME_DAY_MS), the Anemonyx's calendar) pulls the bloom TEND_MS earlier, so tending
// on day 1 and day 2 = plant + 2 days. A tend that puts the bloom in the past = it blooms now (ripen sees it due).
/** Game days a seed takes to bloom untended. Dial. */
export const BLOOM_DAYS = 3
/** Untended bloom time (3 game days = 192 real minutes). */
export const BLOOM_MS = BLOOM_DAYS * GAME_DAY_MS
/** What one tend takes off the wait: half a game day. Dial. */
export const TEND_MS = GAME_DAY_MS / 2
/** M76's rule, kept ONLY for pots planted before M106 (no `v`): a quarter of a game day, so a save that was due still blooms. */
export const LEGACY_BLOOM_MS = GAME_DAY_MS / 4
/** What one planter holds: nothing, a seed growing, or the spirit that bloomed from it (it stays: one spirit per planter).
 *  `v: 2` = planted under the day rule (M106); `tends` = the game days it was tended on. No `v` = an M76 pot (16-min rule). */
export type Pot = { seed: SeedId; at: number; bloomed?: true; v?: 2; tends?: number[] }
export type Pots = Readonly<Record<string, Pot>>
/** The game-day calendar (anemonyx-view.tsx counts the same days). */
export const gameDay = (t: number) => Math.floor(t / GAME_DAY_MS)

export function plant(pots: Pots, pieceId: string, seed: SeedId, now: number): Pots | null {
  if (pots[pieceId]) return null
  return { ...pots, [pieceId]: { seed, at: now, v: 2, tends: [] } }
}
/** When this pot blooms (its planting time + the wait, less what the tends took off). */
export const bloomAt = (p: Pot) => p.v === 2 ? p.at + BLOOM_MS - (p.tends?.length ?? 0) * TEND_MS : p.at + LEGACY_BLOOM_MS
/** 0..1 of the way to the bloom. */
export const growth = (p: Pot, now: number) => (p.bloomed ? 1 : Math.max(0, Math.min(1, (now - p.at) / Math.max(1, bloomAt(p) - p.at))))
/** Tended already this game day? */
export const tendedToday = (p: Pot, now: number) => !!p.tends?.includes(gameDay(now))
/** Can this pot take a tend now: growing, under the day rule, not yet due, not tended today. */
export const canTend = (p: Pot | undefined, now: number): p is Pot => !!p && !p.bloomed && p.v === 2 && bloomAt(p) > now && !tendedToday(p, now)
/** Tend a planter: once per game day. Null = refused (empty, bloomed, an old pot, or tended today already). */
export function tend(pots: Pots, pieceId: string, now: number): Pots | null {
  const p = pots[pieceId]
  if (!canTend(p, now)) return null
  return { ...pots, [pieceId]: { ...p, tends: [...(p.tends ?? []), gameDay(now)] } }
}
/** OWNER DEV ONLY (the planter panel shows it behind /api/owner): pull a growing pot's planting time back so it is
 *  `ms` closer to its bloom ('now' = due this instant). Nothing else changes; ripen then blooms it the normal way. Null = refused. */
export function hasten(pots: Pots, pieceId: string, now: number, ms: number | 'now'): Pots | null {
  const p = pots[pieceId]
  if (!p || p.bloomed || isCarried(pieceId)) return null
  const by = ms === 'now' ? Math.max(0, bloomAt(p) - now) : Math.max(0, Math.min(ms, bloomAt(p) - now))
  return { ...pots, [pieceId]: { ...p, at: p.at - by } }
}
/** Which day of its growing the pot is on (1-based, from its planting). */
export const growDay = (p: Pot, now: number) => Math.max(1, Math.floor((now - p.at) / GAME_DAY_MS) + 1)
/** Every pot whose time has come blooms; returns the new pots and the species that just bloomed, in planting order. */
export function ripen(pots: Pots, now: number): { pots: Pots; bloomed: { pieceId: string; species: Species }[] } {
  const due = Object.entries(pots).filter(([k, p]) => !isCarried(k) && !p.bloomed && now >= bloomAt(p)).sort((a, b) => a[1].at - b[1].at)   // a carried pot blooms once set down
  if (!due.length) return { pots, bloomed: [] }
  const next: Record<string, Pot> = { ...pots }
  for (const [id, p] of due) next[id] = { ...p, bloomed: true }
  return { pots: next, bloomed: due.map(([pieceId, p]) => ({ pieceId, species: speciesOf(p.seed) })) }
}

// ── the seeds on the plot (M106): the bag and the garden bank (every chest is a door into that one pool) ───────────────
/** Every Mana Seed the keeper holds on the plot, grouped by seed: how many in the bag, how many in the bank. */
export function seedsOnPlot(inv: Inv, bank: Bank): { id: SeedId; bag: number; bank: number }[] {
  return SEED_IDS.map(id => ({ id, bag: countOf(inv, id), bank: bankCount(bank, id) })).filter(s => s.bag + s.bank > 0)
}
/** Take one seed: from the bag first, else from the bank (through the bank's own bankTake). Null = none anywhere. */
export function takeSeed(inv: Inv, bank: Bank, id: SeedId): { inv: Inv; bank: Bank; from: 'bag' | 'bank' } | null {
  const i = take(inv, id, 1)
  if (i) return { inv: i, bank, from: 'bag' }
  const b = bankTake(bank, id, 1)
  return b ? { inv, bank: b, from: 'bank' } : null
}

// M106 fix (11-23): a growing pot TRAVELS with its planter. Picking a planter up (E 'Pick up' or three melee hits, both through
// piece-lift.ts) moves its pot under CARRIED + the old piece id, seed, planting time and tends untouched; the next Spirit Planter
// set down takes the oldest carried pot. So a lift never loses a seed or its growth day. (Before: E gave the seed back to the
// bag and lost its days; melee skipped the pot entirely and the seed was lost.)
/** The pots key prefix of a pot riding in the bag with its lifted planter. */
export const CARRIED = 'carried:'
export const isCarried = (key: string) => key.startsWith(CARRIED)
/** Picking a planter up: an empty one comes up freely (pots unchanged); a growing pot is carried with it; a spirit lives
 *  there = no (null). */
export function carryPot(pots: Pots, pieceId: string): Pots | null {
  const p = pots[pieceId]
  if (!p) return pots
  if (p.bloomed) return null
  const { [pieceId]: _gone, ...rest } = pots
  return { ...rest, [CARRIED + pieceId]: p }
}
/** A Spirit Planter just set down at `pieceId`: it takes the oldest carried pot (unchanged). None carried = pots unchanged. */
export function settlePot(pots: Pots, pieceId: string): Pots {
  if (pots[pieceId]) return pots
  const c = Object.entries(pots).filter(([k]) => isCarried(k)).sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1))[0]
  if (!c) return pots
  const { [c[0]]: _gone, ...rest } = pots
  return { ...rest, [pieceId]: c[1] }
}

// ── the Anemonyx at the green's edge ────────────────────────────────────────────────────────────────────────────────
export const VISIT_MIN_DAYS = 5, VISIT_MAX_DAYS = 10
/** A small stable hash (FNV-1a), so a keeper's visit days are the same on every reload and differ between keepers. */
function hash(salt: string, k: number): number {
  let h = 0x811c9dc5
  const s = `${salt}:${k}`
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}
/** The game day of visit k (k = 0 is the first). Gaps of 5-10 days, counted from the garden's day 0. */
export function visitDay(salt: string, k: number): number {
  let d = 0
  for (let i = 0; i <= k; i++) d += VISIT_MIN_DAYS + (hash(salt, i) % (VISIT_MAX_DAYS - VISIT_MIN_DAYS + 1))
  return d
}
/** Which visit (if any) falls on this game day. She is there that day only, gone the next. */
export function visitOn(salt: string, day: number): number | null {
  for (let k = 0; ; k++) { const d = visitDay(salt, k); if (d === day) return k; if (d > day) return null }
}
/** The next visit on or after `day`. */
export function nextVisit(salt: string, day: number): { k: number; day: number } {
  for (let k = 0; ; k++) { const d = visitDay(salt, k); if (d >= day) return { k, day: d } }
}
/** The seed she brings on visit k: fixed per visit (the finding), drawn first from the species this keeper has not yet
 *  seen, so the book fills; once all ten are known, any of the ten. */
export function visitSeed(salt: string, k: number, seen: ReadonlySet<Species>): SeedId {
  const pool = SPECIES.filter(s => !seen.has(s))
  const from = pool.length ? pool : SPECIES
  return seedOf(from[hash(salt, 1000 + k) % from.length])
}
/** Reaching her on a visit day: one seed per visit, only if met that day. */
export function meetAnemonyx(salt: string, day: number, met: readonly number[], seen: ReadonlySet<Species>): { k: number; seed: SeedId } | null {
  const k = visitOn(salt, day)
  if (k === null || met.includes(k)) return null
  return { k, seed: visitSeed(salt, k, seen) }
}
