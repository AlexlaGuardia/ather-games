// ── THE BURRFOLK: the trader kind of Moglin, a stall in every settlement (BETA M112 s1) ─────────────────────────────────────
// Canon: CANON/game/shimmer-folds-settlements.md › THE BURRFOLK (RULED 2026-11-23, /magii + Alex): a SUB-TYPE of Moglin by
// garb and wear (packs, bundles, odd wares); a stall in EVERY settlement; NEVER follows (not recruitable); DEWLS only (M159,
// amended 11-25; no item swaps), no coin; wares vary by the settlement's trade. Names from the free-folk pool (Gleaner reserved). Stall stock tables per trade and
// prices = Jin's, inside Alex's 15 to 100 (11-25). The wares come from canon's Trades table (same file): each trade's Product.
// ★ NOT a Folk: a Burrfolk is never in folkOf(), so no recruit / room / trust path can ever reach one. Its own seeded nothing:
//   the stall reads the settlement's biome and the season's folk (already deterministic), so every device sees the same stall,
//   and no existing Moglin's season changed (the only shared input, the name order, is read, never re-drawn).
// s1 = the stall. s2 = Gleaner (the first settlement, the camp pointer) + the Burrfolk camp in the Wilds.
// PURE: use-folk-talk.tsx applies a sale to the bag; folk-talk.ts arranges the talk; network-scene.tsx draws the stall.
import { give, take, itemDef, type Inv } from '../shared/inventory'
import type { Settlement, SettlementBiome } from './network'
import type { Profession } from './moglins'
import { folkOf, seasonRoster, RESERVED_NAMES, type Folk } from './settlement-folk'
import { GLADE_ID } from './moonwell-glade'
import { settlementTurn } from './folk-spots'
import { DEWL, dewls } from './dewl'
import { GLEANER_POST, gleanerOf } from './gleaner'

/** Canon's trades table (shimmer-folds-settlements.md › Trades), the rows whose goods are plain bag items, each with its PRICE in
 *  dewls (Alex 11-25: 15 to 100, cheapest 15). Cook, Apothecary, Well-minder and Brewer sell graded goods: not stocked yet. */
export const WARES = {
  carpenter: { trade: 'Carpenter', product: { id: 'goldwood_plank', n: 1 }, price: 15 },
  stonery:   { trade: 'Stonery', product: { id: 'ather_crystal', n: 1 }, price: 100 },
  rinner:    { trade: 'Rinner', product: { id: 'glowfin', n: 1 }, price: 30 },
  saptapper: { trade: 'Sap-tapper', product: { id: 'amber_sap', n: 1 }, price: 40 },
  digger:    { trade: 'Digger', product: { id: 'raw_mana_shard', n: 1 }, price: 20 },
} as const
export type WareKey = keyof typeof WARES
export type WareRow = (typeof WARES)[WareKey]
/** the settlement's own trade, by what lies around it (woods = timber, rock = stone, shore = the water, meadow = the orchards) */
export const BIOME_STALL: Readonly<Record<SettlementBiome, WareKey>> = { woods: 'carpenter', rock: 'stonery', shore: 'rinner', meadow: 'saptapper' }
/** ...then the trades its folk work, read off canon's table */
export const PROFESSION_STALL: Partial<Record<Profession, WareKey>> = { carpenter: 'carpenter', stonemason: 'stonery', jeweler: 'stonery', rinnshop: 'rinner', digger: 'digger' }
export const STALL_ROWS = 2
/** canon: reserved, never generated (the first settlement's four + Gleaner, the first settlement's Burrfolk) */
export const BURR_RESERVED = RESERVED_NAMES

export interface Burrfolk { id: string; name: string; home: string; stock: WareKey[] }
/** the speaker label when the season's pool has no free name left (canon's word for the kind) */
export const BURR_KIND = 'Burrfolk'
export const isBurr = (id: string | undefined) => !!id && id.startsWith('burr:')

/** What the stall sells: the settlement's own trade first, then its folk's, two rows. Uses ALL the season's folk (not who is
 *  still home), so a recruit never changes the stall. */
export function stallStock(s: Settlement, folk: readonly Folk[]): WareKey[] {
  const out: WareKey[] = [BIOME_STALL[s.biome ?? 'meadow']]
  for (const f of folk) { const k = PROFESSION_STALL[f.profession]; if (k && !out.includes(k)) out.push(k) }
  return out.slice(0, STALL_ROWS)
}

/** The season's free names: every slot of the season's name order no Moglin of any settlement holds, minus the reserved names
 *  and the spares handed to folk whose drawn name was reserved (settlement-folk.ts › seasonRoster owns the bookkeeping). */
export function freeNames(season: number): string[] { return seasonRoster(season).free }

/** The Burrfolk keeping the stall in a settlement this season (none in the Glade: Gleaner is s2). Same on every device. */
export function burrfolkOf(s: Settlement, season: number, folk: readonly Folk[] = folkOf(s, season)): Burrfolk | null {
  if (s.id === GLADE_ID) return null
  if (s.id === GLEANER_POST.id) return gleanerOf()   // s2: Gleaner (owner-only post until M70 ships: gleaner.ts)
  const idx = Number(/-(\d+)$/.exec(s.id)?.[1] ?? 0), free = freeNames(season)
  // a season whose folk use nearly the whole pool leaves fewer free names than stalls: those stall-keepers go by their kind's
  // name (canon's word) rather than share a living speaker's (canon: two living speakers never share a name). Pool = Magii's.
  const name = free[idx] ?? BURR_KIND
  return { id: `burr:${season}:${s.id}`, name, home: s.id, stock: stallStock(s, folk) }
}

/** Where the stall stands: in the green, opposite the signpost (network-scene.tsx's SettlementModel: signpost at local (7, 10)),
 *  out past where the folk stand (folk-spots.ts: local z <= 9), well inside the lots' ring (settlement-lots.ts: >= 20 m). */
export const STALL_LOCAL = { x: -8, z: 12.5 }
export function stallSpot(s: Settlement): { x: number; z: number; yaw: number } {
  if (s.id === GLEANER_POST.id) return { x: s.x, z: s.z, yaw: Math.atan2(-300 - s.x, 300 - s.z) }   // the post IS the stall, facing the arrival
  const turn = settlementTurn(s), c = Math.cos(turn), sn = Math.sin(turn), { x: lx, z: lz } = STALL_LOCAL
  return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, yaw: turn }   // faces out from the knoll, as the folk do
}

/** One sale. Refused (nothing changes) when the bag is short of dewls or has no room for the ware. No coin, no swaps. */
export function buyWare(inv: Inv, key: WareKey): { ok: true; inv: Inv } | { ok: false; why: 'short' | 'full' } {
  const { price, product } = WARES[key]
  const less = take(inv, DEWL, price); if (!less) return { ok: false, why: 'short' }
  const r = give(less, product.id, product.n)
  return r.left > 0 ? { ok: false, why: 'full' } : { ok: true, inv: r.inv }
}

/** ★ SIGNED (Alex, athernyx b3dc505): CANON/game/shimmer-lines-batch-2026-11-23c.md › C, MAIN (lines-batch-23c.test.ts);
 *  swap + short = batch 11-25b › C (SIGNED 0c9415c; burrfolk.test.ts). 1 dewl is singular (dewl.ts).
 *  The Burrfolk's spoken lines are SIGNED too: BURRFOLK_BARKS below. */
const nm = (id: string) => itemDef(id).name
export const BURR_LABEL = {
  look: 'Have a look',
  swap: (k: WareKey) => `${nm(WARES[k].product.id)} · ${dewls(WARES[k].price)}`,
  done: (k: WareKey) => `${nm(WARES[k].product.id)} · in your bag`,
  short: (k: WareKey) => `You need ${dewls(WARES[k].price)} for the ${nm(WARES[k].product.id)}.`,
  full: (k: WareKey) => `Your bag is full. Make room for the ${nm(WARES[k].product.id)}.`,
} as const

/** ★ SIGNED (Alex, athernyx 2ac7da7): CANON/game/shimmer-lines-batch-2026-11-23b.md › D5, word for word (burrfolk.test.ts reads
 *  the canon file); stall = batch 11-25b › B. The speaker label is the Burrfolk's own pooled name. s1 wires greet / stall / leave; idle (in earshot) and
 *  newstock (stock changed since the last visit) are here for s2 (stock does not change yet). */
export const BURRFOLK_BARKS = {
  greet: 'Wares from all over. Have a look.',
  stall: 'No coin, only dewls. Take your time.',
  idle: "Pack's heavy and the day is young.",
  newstock: 'Something new in the pack. It followed me here.',
  leave: "Mind the road. I'll be here.",
} as const
