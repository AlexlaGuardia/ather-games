// ── THE EXCHANGE'S MARKET (BETA M228b, Alex 11-27): the GUIDE price an order form presets to, the 7-day STATS under it, and the
// numbers the ATHER TRADING CO. CLERKS quote by (the market's life support on the basic goods: they buy a little below and sell
// a little above the guide, in small lots, and wind down to nothing when the switch is off). Pure and import-free: the server
// (lib/accounts/exchange.ts) and the hall panel read the same code.
//
// SEED PRICES (Jin's, Marks each, on the ladder's scale): what a basic good is worth before anyone has traded it. Kept near what
// the game already charges or paid: the Co. supplier sells Rootbulb 20 / Capgrain 25 each (business/suppliers.ts, lots of 10);
// the wood, gems and catch are the retired 2D book's sell prices (sprites/items.ts sellPrice) x10, and blankstone / logs / bricks /
// herbs sit beside their nearest neighbour (a log is a plank before the saw; a brick is a blankstone cut square).

export const SEED_PRICE: Readonly<Record<string, number>> = Object.freeze({
  goldwood_log: 20, goldwood_plank: 30, goldwood_bark: 20, shimmeroak_plank: 70,
  blankstone: 25, stone_brick: 40, raw_mana_shard: 50,
  violet_crystal: 80, earth_crystal: 80, storm_crystal: 80, water_crystal: 80,
  shimmerscale: 20, rootbulb: 20, capgrain: 25,
  'crop:goldleaf:D': 25, 'crop:ather_wheat:D': 25,
})
/** the basic goods the Co. clerks keep a buy and a sell on */
export const CLERK_ITEMS: readonly string[] = Object.freeze(Object.keys(SEED_PRICE))
/** the clerks' account on the book, and the name the book shows for them (never a keeper's name) */
export const CLERK_ID = 'co:clerk'
export const CLERK_NAME = 'Co. clerk'
export const isClerk = (user_id: string) => user_id.startsWith('co:')

export const WEEK_MS = 7 * 86_400_000
export const DAY_MS = 86_400_000
export const dayStart = (now: number) => Math.floor(now / DAY_MS) * DAY_MS

/** the clerks' dials (defaults; the server reads overrides from the exchange_config table, and an env switch) */
export interface ClerkDial {
  on: boolean
  /** units in each clerk order */
  lot: number
  /** buy at guide x (1 - spread), sell at guide x (1 + spread) */
  spread: number
  /** FARM CAP: units the clerks buy of one good in a day (all keepers together) */
  dayUnitsPerItem: number
  /** FARM CAP: Marks one keeper can take from the clerks in a day */
  dayMarksPerKeeper: number
  /** FARM CAP: Marks the clerks pay out in a day, all keepers, all goods */
  dayMarksTotal: number
}
export const CLERK_DEFAULT: Readonly<ClerkDial> = Object.freeze({ on: true, lot: 5, spread: 0.1, dayUnitsPerItem: 60, dayMarksPerKeeper: 600, dayMarksTotal: 12_000 })
/** a dial read from strings (db rows / env), every number clamped to something sane */
export function readDial(kv: Readonly<Record<string, string | undefined>>): ClerkDial {
  const num = (k: string, lo: number, hi: number, d: number) => { const v = Number(kv[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d }
  const sw = String(kv.clerks ?? '').toLowerCase()
  return {
    on: !(sw === 'off' || sw === '0' || sw === 'false'),
    lot: Math.round(num('clerk_lot', 0, 50, CLERK_DEFAULT.lot)),
    spread: num('clerk_spread', 0.02, 0.5, CLERK_DEFAULT.spread),
    dayUnitsPerItem: Math.round(num('clerk_day_units', 0, 10_000, CLERK_DEFAULT.dayUnitsPerItem)),
    dayMarksPerKeeper: Math.round(num('clerk_day_marks_keeper', 0, 1_000_000, CLERK_DEFAULT.dayMarksPerKeeper)),
    dayMarksTotal: Math.round(num('clerk_day_marks_total', 0, 10_000_000, CLERK_DEFAULT.dayMarksTotal)),
  }
}

export interface Fill { n: number; price: number; at: number }
export interface Stats { high: number; low: number; last: number; volume: number; trades: number }
/** the 7-day stats of an item's fills (null when nothing traded in the window) */
export function statsOf(fills: readonly Fill[], now: number): Stats | null {
  const w = fills.filter(f => f.at > now - WEEK_MS && f.at <= now)
  if (!w.length) return null
  const lastF = w.reduce((a, b) => (b.at >= a.at ? b : a))
  return { high: Math.max(...w.map(f => f.price)), low: Math.min(...w.map(f => f.price)), last: lastF.price, volume: w.reduce((s, f) => s + f.n, 0), trades: w.length }
}
/** the median fill price over the last 7 days (the lower middle on an even count, so a guide is always a price that traded) */
export function medianPrice(fills: readonly Fill[], now: number): number | null {
  const p = fills.filter(f => f.at > now - WEEK_MS && f.at <= now).map(f => f.price).sort((a, b) => a - b)
  return p.length ? p[Math.floor((p.length - 1) / 2)] : null
}
/** the GUIDE price: the 7-day median, else the seed price, else nothing (the form keeps what was typed) */
export function guidePrice(item: string, fills: readonly Fill[], now: number): number | null {
  return medianPrice(fills, now) ?? SEED_PRICE[item] ?? null
}
/** what the clerks quote: the guide held within half to twice the seed (so a pair of keepers trading with each other at a silly
 *  price cannot drag the clerks' buy up and farm them), then a buy below and a sell above it */
export function clerkQuote(item: string, guide: number | null, spread: number): { buy: number; sell: number } | null {
  const seed = SEED_PRICE[item]
  if (!seed) return null
  const g = Math.min(seed * 2, Math.max(Math.ceil(seed / 2), guide ?? seed))
  const buy = Math.max(1, Math.floor(g * (1 - spread)))
  return { buy, sell: Math.max(buy + 1, Math.ceil(g * (1 + spread))) }
}
/** how many units the clerks may still buy from this seller at this price today (the farm cap) */
export function clerkRoom(d: Pick<ClerkDial, 'dayUnitsPerItem' | 'dayMarksPerKeeper' | 'dayMarksTotal'>, used: { itemUnits: number; sellerMarks: number; totalMarks: number }, price: number): number {
  if (price < 1) return 0
  return Math.max(0, Math.min(d.dayUnitsPerItem - used.itemUnits, Math.floor((d.dayMarksPerKeeper - used.sellerMarks) / price), Math.floor((d.dayMarksTotal - used.totalMarks) / price)))
}
/** the claim box's key for Marks (an item id can never start with '$': exchange-rules ITEM_RE) */
export const CLAIM_MARKS = '$marks'
