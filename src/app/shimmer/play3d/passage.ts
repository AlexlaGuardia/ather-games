/**
 * passage.ts — THE SHELVES OF THE PASSAGE, under Rune Hold. Pure: the clock, the stock, the trades.
 *
 * Canon (`world/rune-hold.md` § The three shelves, RULED 2026-09-03): the Passage sells all four layers of
 * a move — **rune-gems** from the merchants (the letters, including specialized and off-lane ones you
 * cannot use), **combinations** from the teachers (the word, in person) and the **scroll racks** (the
 * word, bought), and **vessels** (the paper — not built yet, one loadout only). Merchants ride the
 * Passage on **E'xday** (market day); teachers hold on **Coomday** (focus). The Ather keeps the
 * five-day week. Ultimates are never bought and never taught here.
 *
 * ── JIN'S NUMBERS (canon says stock, prices, rotation and the shop are the build's) ──
 *   · a WEEKDAY is one world day (`CYCLE_MS`, 64 real minutes), five to the week; the rack turns daily
 *   · the teacher gives ONE combination a Coomday, FREE if you can read it — a master who takes you on
 *     is earned, not paid (`moves.md` § the three roads). The scroll racks sell the same words for Marks
 *   · the gem tray holds six runes an E'xday; a gem on one of your two lanes costs 30 Marks, off-lane
 *     60 (specialized — you cannot seat it until you train that rune; the merchant does not care)
 *   · the SELL counter (E'xday) buys the prospecting ladder — the one place the voxel world EARNS Marks
 *     today: shard 4 · element crystal 12 · pure core 40 · ather crystal 120. A crystal is worth less
 *     sold than the gem it would imbue into, so imbuing stays the better road for a rune you hold
 *
 * ── VOCABULARY ── ✅ merchant, teacher, rack, counter, gem, combination, Marks. ⛔ shop UI words that
 * borrow the Citadel's (socket/sigil/slot), and every Earth weekday.
 */
import { CYCLE_MS } from '../voxel/clock'
import { countItem, removeItems, type Inventory } from '../engine/inventory'
import { RUNES } from './birth/runes.data'
import { laneRunes } from './cast'
import { KEEPER_MOVES, type KeeperMove } from './keeper-moves'
import { TRADE_POOL, canRead, hasLearned, learn, tradeable, type Book } from './scroll-market'
import { addGems, type Letters } from './gems'

// ── the week ────────────────────────────────────────────────────────────────────────────────
/** the Original Five States, in canon's order (`world/calendar.md`) */
export const WEEK = ['Solday', 'Coomday', "E'xday", 'Niteday', 'Floday'] as const
export type Weekday = (typeof WEEK)[number]
export const MARKET_DAY: Weekday = "E'xday"
export const TEACHING_DAY: Weekday = 'Coomday'

export function cycleAt(nowMs: number): number { return Math.floor(nowMs / CYCLE_MS) }
export function weekdayOf(cycle: number): Weekday { return WEEK[((cycle % 5) + 5) % 5] }
export function weekdayAt(nowMs: number): Weekday { return weekdayOf(cycleAt(nowMs)) }
/** whole days until the next `day` — 0 when it is today */
export function daysUntil(cycle: number, day: Weekday): number {
  const i = WEEK.indexOf(day), c = ((cycle % 5) + 5) % 5
  return (i - c + 5) % 5
}

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

// ── the merchants: rune-gems, E'xday ────────────────────────────────────────────────────────
export const TRAY_SIZE = 6
export const GEM_PRICE_LANE = 30
export const GEM_PRICE_OFF = 60

/** the six runes on the tray this cycle — never a lost state (no one-rune move exists to write) */
export function gemTrayFor(cycle: number, seed = 1, size = TRAY_SIZE): string[] {
  return RUNES.filter((r) => !r.lostState)
    .map((r) => ({ id: r.id, k: hash01(`gem|${seed}|${cycle}|${r.id}`) }))
    .sort((a, b) => a.k - b.k || (a.id < b.id ? -1 : 1))
    .slice(0, size)
    .map((e) => e.id)
}

/** on either of this keeper's lanes → the lane price; anything else is specialized */
export function gemPrice(rune: string, birth: string | null): number {
  if (birth && (laneRunes(birth, 'element').has(rune) || laneRunes(birth, 'state').has(rune))) return GEM_PRICE_LANE
  return GEM_PRICE_OFF
}

export type TradeRefusal = 'not-today' | 'not-stocked' | 'too-dear' | 'already-known' | 'unreadable' | 'not-for-sale' | 'nothing-to-sell'
export interface GemTrade { ok: boolean; letters: Letters; marks: number; why?: TradeRefusal; say: string }

export function buyGem(letters: Letters, marks: number, rune: string, tray: readonly string[], birth: string | null, day: Weekday): GemTrade {
  const no = (why: TradeRefusal, say: string): GemTrade => ({ ok: false, letters, marks, why, say })
  if (day !== MARKET_DAY) return no('not-today', `The merchants ride the Passage on ${MARKET_DAY}. The stalls are shuttered.`)
  if (!tray.includes(rune)) return no('not-stocked', 'No one is carrying that stone today.')
  const price = gemPrice(rune, birth)
  if (marks < price) return no('too-dear', `${price} Marks for that one. Come back with them.`)
  const name = RUNES.find((r) => r.id === rune)?.name ?? rune
  return { ok: true, letters: addGems(letters, rune, 1), marks: marks - price, say: `A ${name} gem, wrapped. ${price} Marks.` }
}

// ── the counter: the prospecting ladder, bought for Marks, E'xday ───────────────────────────
/** what the merchants pay, per unit — "runestones" (`rune-hold.md` § What's Traded) */
export const SELL_PRICES: Record<string, number> = {
  raw_mana_shard: 4,
  violet_crystal: 12, storm_crystal: 12, earth_crystal: 12, water_crystal: 12,
  pure_mana_core: 40, ather_crystal: 120,
}
export interface Sale { ok: boolean; marks: number; sold: number; why?: TradeRefusal; say: string }

/** sell up to `n` of an item; mutates the inventory (the world's contract). Returns Marks earned. */
export function sell(inv: Inventory, itemId: string, n: number, day: Weekday): Sale {
  const no = (why: TradeRefusal, say: string): Sale => ({ ok: false, marks: 0, sold: 0, why, say })
  if (day !== MARKET_DAY) return no('not-today', `Nobody is buying until ${MARKET_DAY}.`)
  const each = SELL_PRICES[itemId]
  if (!each) return no('not-for-sale', 'They turn it over, and hand it back.')
  const have = countItem(inv, itemId)
  const count = Math.min(Math.max(0, Math.floor(n)), have)
  if (count <= 0) return no('nothing-to-sell', 'You have none of that to sell.')
  if (!removeItems(inv, itemId, count)) return no('nothing-to-sell', 'You have none of that to sell.')
  return { ok: true, marks: each * count, sold: count, say: `${count} ${itemId.replace(/_/g, ' ')} for ${each * count} Marks.` }
}

// ── the teachers: one combination, Coomday, free if you can read it ─────────────────────────
/** the master holding this cycle, and the one word they give. Deterministic; never an ultimate. */
export function teacherFor(cycle: number, seed = 1): KeeperMove {
  const pool = [...TRADE_POOL].map((m) => ({ m, k: hash01(`teach|${seed}|${cycle}|${m.id}`) }))
    .sort((a, b) => a.k - b.k || (a.m.id < b.m.id ? -1 : 1))
  return pool[0]!.m
}
export interface Lesson { ok: boolean; book: Book; why?: TradeRefusal; say: string }

export function takeLesson(book: Book, owned: readonly string[], move: KeeperMove, day: Weekday): Lesson {
  const no = (why: TradeRefusal, say: string): Lesson => ({ ok: false, book, why, say })
  if (day !== TEACHING_DAY) return no('not-today', `The masters hold on ${TEACHING_DAY}. Today the bench is empty.`)
  if (!tradeable(move)) return no('not-for-sale', 'A signature is not taught over a bench. Earn it.')
  if (hasLearned(book, move.id)) return no('already-known', 'You already carry that one. Sit anyway, if you like.')
  if (!canRead(move, owned)) return no('unreadable', 'It is written in a rune you do not hold. The master says it slowly, and it does not take.')
  return { ok: true, book: learn(book, move.id), say: `${move.name}. Say it until it is one word.` }
}

/** every move a teacher could ever give — the rack's pool, restated as a guard-readable fact */
export const TEACHABLE: readonly KeeperMove[] = KEEPER_MOVES.filter(tradeable)
