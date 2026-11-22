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
import { SPECIES, seedOf, speciesOf, type SeedId } from './seed-items'
export * from './seed-items'

// ── the planter ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** How long a planted seed takes to bloom: a quarter of a game day (16 real minutes). Dial. */
export const BLOOM_MS = GAME_DAY_MS / 4
/** What one planter holds: nothing, a seed growing, or the spirit that bloomed from it (it stays: one spirit per planter). */
export type Pot = { seed: SeedId; at: number; bloomed?: true }
export type Pots = Readonly<Record<string, Pot>>

export function plant(pots: Pots, pieceId: string, seed: SeedId, now: number): Pots | null {
  if (pots[pieceId]) return null
  return { ...pots, [pieceId]: { seed, at: now } }
}
/** 0..1 of the way to the bloom. */
export const growth = (p: Pot, now: number) => (p.bloomed ? 1 : Math.max(0, Math.min(1, (now - p.at) / BLOOM_MS)))
/** Every pot whose time has come blooms; returns the new pots and the species that just bloomed, in planting order. */
export function ripen(pots: Pots, now: number): { pots: Pots; bloomed: { pieceId: string; species: Species }[] } {
  const due = Object.entries(pots).filter(([, p]) => !p.bloomed && now - p.at >= BLOOM_MS).sort((a, b) => a[1].at - b[1].at)
  if (!due.length) return { pots, bloomed: [] }
  const next: Record<string, Pot> = { ...pots }
  for (const [id, p] of due) next[id] = { ...p, bloomed: true }
  return { pots: next, bloomed: due.map(([pieceId, p]) => ({ pieceId, species: speciesOf(p.seed) })) }
}
/** Picking a planter up: an empty one comes up freely; a growing seed comes back to the bag; a spirit lives there = no. */
export function liftPot(pots: Pots, pieceId: string): { pots: Pots; seed: SeedId | null } | null {
  const p = pots[pieceId]
  if (!p) return { pots, seed: null }
  if (p.bloomed) return null
  const { [pieceId]: _gone, ...rest } = pots
  return { pots: rest, seed: p.seed }
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
