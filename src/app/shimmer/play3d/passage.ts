/**
 * passage.ts — THE SHELVES OF THE PASSAGE, under Rune Hold. Pure: the clock, the stock, the trades.
 *
 * Canon (`world/rune-hold.md` § The three shelves, RULED 2026-09-03): the Passage sells all four layers of
 * a move — **rune-gems** from the merchants (the letters, including specialized and off-lane ones you
 * cannot use), **combinations** from the teachers (the word, in person) and the **scroll racks** (the
 * word, bought), and **vessels** (the paper — BOTH counters now built: the cutter in
 * `vessels.ts` § `buyVessel`, and the second-hand RACK at the foot of this file). Merchants ride the
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
 * ── VOCABULARY ── ✅ merchant, teacher, rack, counter, gem, combination, Marks, sleeper.
 * ⛔ **"hidden gems" for a sleeper** — `gem` is the rune-gem on the shelf beside it (canon 09-05). ⛔ shop UI words that
 * borrow the Citadel's (socket/sigil/slot), and every Earth weekday.
 */
import { CYCLE_MS } from '../voxel/clock'
import { countItem, removeItems, type Inventory } from '../engine/inventory'
import { RUNES } from './birth/runes.data'
import { laneRunes } from './cast'
import { KEEPER_MOVES, type KeeperMove } from './keeper-moves'
import { TRADE_POOL, canRead, hasLearned, learn, tradeable, type Book } from './scroll-market'
import { addGems, lettersOf, VESSELS, type Letters, type Vessel } from './gems'
import { grantVessel, seatCapOf, BAND_FOR_VESSEL, type VesselTier } from './vessels'
import { ALL_BANDS } from './cast'

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

// ── the RACK: second-hand vessels, someone else's word ──────────────────────────────────────
/**
 * ── ★★★ THE PASSAGE'S SECOND COUNTER (canon, 2026-09-05) ──────────────────────────────────────
 * `design-briefs/shimmer-casting-vessels.md` › THE THREE ROADS rules the BOUGHT road as **two
 * counters, not one**, and the cutter (`vessels.ts` › `buyVessel`) was only the first:
 *
 *   · **the cutter** — made to order, for a word you name. Expensive, no mystery, and it is the
 *     escape hatch when you know exactly what you want.
 *   · **the rack** — *"second-hand, someone else's word. Cheap, plentiful, and you hunt it. Every
 *     vessel on it was cut for a word somebody meant to write, so the rack is a wall of other
 *     people's purposes."*
 *
 * ── ★★★ THE RACK IS GENERATED WITHOUT REFERENCE TO THE KEEPER, AND THAT IS THE WHOLE MECHANIC ──
 * `vessel-drops.ts` › `chooseWord` does the exact opposite on purpose: a FOUND vessel is cut for a
 * word on THIS keeper's lane, because a dug-up brick with a story is a bad prize. The rack must not
 * do that. Its stock existed before you walked in and was cut for people who are not you — so most
 * of it is **unusable to you, and that is the feature**. Finding the one that fits is the hunt
 * canon names, and it only means anything because the shelf was not arranged for you.
 * ⚠ DO NOT "IMPROVE" THIS BY FILTERING THE RACK TO THE KEEPER'S LANE. It would raise every session's
 * hit rate and delete the counter's entire reason to exist — the cutter already serves the keeper
 * who knows what they want, at a higher price, and that IS the trade the two counters encode.
 *
 * ── ★★ THE SLEEPERS, AND THEY FALL OUT OF THE PRICING RULE RATHER THAN BEING PLACED ───────────
 * Canon: *"The rack occasionally holds something genuinely rare: a fine vessel, or one cut for a
 * word far above what the shelf is priced for. This is not the shopkeeper doing the player a favour
 * — it is the supply chain working exactly as canon describes it."*
 *
 * So the shelf **prices by WEAR, not by WORTH** (`rackPrice`): a flat second-hand rate, a small
 * count for seats the shelf can see, and only a token bump for material. A fine vessel therefore
 * sits at very nearly the price of a plain one — **the under-pricing IS the sleeper**, and nothing
 * in this file ever decides to be generous. That is what makes it the supply chain rather than a
 * favour, which is the sentence canon spends its whole paragraph on.
 *
 * ⛔ **NEVER CALLED "HIDDEN GEMS" ANYWHERE IN THE BUILD.** Alex's phrase was colloquial and canon
 * rules the collision outright: `gem` is the **rune-gem**, the LETTER, sold on this same shop's
 * neighbouring shelf (`gemTrayFor`, twenty lines up). Two objects in one market wearing one noun is
 * the `chest`/`cache` mistake again. They are **sleepers**.
 *
 * ── ★★ WHY A SLEEPER DOES NOT MAKE THE TOP RUNG BUYABLE, which is the one thing that would break canon ──
 * Canon says Crucible-class goods *"wash down the Trading Floor and out into the Passage"*, and it
 * ALSO says the Crucible band is what makes the top rung *"structurally unbuyable rather than merely
 * expensive"*. Both hold, because they are about different halves of a move: **the PAPER washes down
 * and the WORD never does.** `scroll-market.ts` › `tradeable` admits only `passive` and `tactical`,
 * so no counter in this shop has ever sold an ultimate and none can. A tier-3 sleeper is a keeper's
 * prize that outran them — canon's own words, *"somebody won a vessel, found they had no word for it,
 * and sold it on"* — and buying it hands you fine paper you still have no ultimate to write on.
 * ⚠ `RACK_WORD_POOL` is derived from `tradeable`, never from a list here, so the day an ultimate
 * becomes tradeable this rack follows canon instead of contradicting it, and the day it must not,
 * one edit in `scroll-market.ts` closes every counter at once.
 *
 * ── JIN'S NUMBERS (canon hands the build stock, prices and rotation) ──
 *   · the rack holds `RACK_SIZE` vessels and turns over every world day, like the gem tray
 *   · `RACK_BASE` 40 against the cutter's 75 — "cheap, plentiful", and the gap is the trade
 *   · +`RACK_PER_SEAT` per seat past the first: the shelf can COUNT, it cannot judge
 *   · +`RACK_TIER_BUMP` flat for anything above tier 1, which is the whole of what the shelf knows
 *     about material — deliberately far less than the material is worth
 *   · `SLEEPER_CHANCE` per slot; a sleeper rolls tier 2, or tier 3 at `SLEEPER_FINE_CHANCE`
 */
export const RACK_SIZE = 5
export const RACK_BASE = 40
export const RACK_PER_SEAT = 10
export const RACK_TIER_BUMP = 15
/**
 * ⚠ PER SLOT, NOT PER RACK, and the arithmetic is the whole tuning. At `1/7` across five slots the
 * rack held a sleeper roughly every 1.4 cycles — measured, not estimated — which is a shelf that
 * always has something good on it, i.e. the opposite of canon's *"occasionally"*. At `1/18` it is
 * about one every 3.6 cycles: often enough to be worth walking in for, rare enough that finding one
 * is the event the word "hunt" implies.
 */
export const SLEEPER_CHANCE = 1 / 18
export const SLEEPER_FINE_CHANCE = 1 / 3
/**
 * ── ★★★ THE RACK IS MOSTLY BRACELETS, AND THE REASON IS CANON RATHER THAN TASTE ────────────────
 * `VESSEL_FOR_KIND` maps **focus → the `ultimate` band** and bracelet → `tactical`. `TRADE_POOL`
 * holds **zero** ultimate words by `tradeable`, so a glove on this rack can NEVER be cut — the
 * shop has no ultimate word to have cut it for. That is canon arriving as a mechanical consequence
 * rather than as a rule anyone wrote here: *"the cutter can serve any word a keeper can name — and
 * an ultimate is precisely the word it may not sell, so there is no paper for one to cut."*
 *
 * A blank glove is therefore a legitimate and meaningful thing to find second-hand — it is fine
 * paper waiting on a word you have not earned yet, which is canon's *"somebody won a vessel, found
 * they had no word for it, and sold it on"* seen from the buyer's end. But at an even split HALF the
 * rack was blank paper, which reads as an empty shop rather than as a wall of other people's
 * purposes. So bracelets carry the rack and a glove is the rarer sight.
 * ⚠ DERIVED, NOT LISTED: if a future band gains tradeable words this weight is still just a weight,
 * and the "can it be cut" question stays answered by `RACK_WORD_POOL` alone.
 */
export const RACK_GLOVE_SHARE = 1 / 4

export interface RackVessel {
  kind: Vessel
  tier: VesselTier
  /** the word it was cut for — someone else's. `null` only if no word of that band exists. */
  word: string | null
  price: number
}

/** Every word the rack could ever carry: the shop's own tradeable pool, never a list kept here. */
export const RACK_WORD_POOL: readonly KeeperMove[] = TRADE_POOL

/**
 * What the shelf asks. Wear, not worth — see the header. Pure, and it never sees the keeper: a
 * vessel is not priced up because it happens to fit you, which is the other half of "you hunt it".
 */
export function rackPrice(kind: Vessel, tier: VesselTier, word: string | null): number {
  const m = word ? KEEPER_MOVES.find((k) => k.id === word) : undefined
  const seats = m ? lettersOf(m, null).length : 0
  return RACK_BASE + Math.max(0, seats - 1) * RACK_PER_SEAT + (tier > 1 ? RACK_TIER_BUMP : 0)
}

/**
 * The rack this cycle. Deterministic from `(cycle, seed, slot)` alone — no keeper, no birth, no
 * inventory. Same shape as `gemTrayFor` and `teacherFor` so all three counters turn on one clock.
 */
export function rackFor(cycle: number, seed = 1, size = RACK_SIZE): RackVessel[] {
  const out: RackVessel[] = []
  for (let i = 0; i < size; i++) {
    const k = (t: string) => hash01(`rack|${seed}|${cycle}|${i}|${t}`)
    const kind: Vessel = k('kind') < RACK_GLOVE_SHARE ? 'focus' : 'bracelet'
    // A sleeper is a TIER roll and nothing else — the price rule above does the rest.
    const sleeper = k('sleep') < SLEEPER_CHANCE
    const tier: VesselTier = !sleeper ? 1 : (k('fine') < SLEEPER_FINE_CHANCE ? 3 : 2)
    // The word: any tradeable word of this vessel's band, chosen with no reference to the keeper.
    const band = ALL_BANDS[BAND_FOR_VESSEL[kind]]
    const pool = RACK_WORD_POOL.filter((m) => m.tier === band && lettersOf(m, null).length <= seatCapOf(tier))
    const word = pool.length ? pool[Math.floor(k('word') * pool.length)]!.id : null
    out.push({ kind, tier, word: word ?? null, price: rackPrice(kind, tier, word ?? null) })
  }
  return out
}

export interface RackPurchase { ok: boolean; marks: number; why?: TradeRefusal; say: string }

/**
 * Buy slot `slot` off today's rack. The rack is open every day — canon gives market day to the
 * MERCHANTS who ride in; the vessel shelves are the shop's own stock and stand whether or not
 * anyone is visiting, exactly as the cutter does.
 *
 * ⚠ IT REFUSES NOTHING FOR FIT, AND THAT IS DELIBERATE. A vessel cut for a word off your lane is a
 * brick with a story, and the panel says so plainly before you spend — but the shelf will still
 * sell it to you, because a shop that refuses your Marks on your behalf is not a wall of other
 * people's purposes, it is a curated aisle. The information is the mercy; the choice stays yours.
 */
export function buyFromRack(marks: number, slot: number, rack: readonly RackVessel[]): RackPurchase {
  const no = (why: TradeRefusal, say: string): RackPurchase => ({ ok: false, marks, why, say })
  const v = rack[slot]
  if (!v) return no('not-stocked', 'That one is gone. The rack turns over.')
  if (marks < v.price) return no('too-dear', `${v.price} Marks, second-hand. Come back with them.`)
  const g = grantVessel(v.kind, v.tier, v.word, 'bought')
  if (!g.ok) return no(g.why as TradeRefusal, g.say)
  return { ok: true, marks: marks - v.price, say: g.say }
}
