// ── THE BURRFOLK: the trader kind of Moglin, a stall in every settlement (BETA M112 s1) ─────────────────────────────────────
// Canon: CANON/game/shimmer-folds-settlements.md › THE BURRFOLK (RULED 2026-11-23, /magii + Alex): a SUB-TYPE of Moglin by
// garb and wear (packs, bundles, odd wares); a stall in EVERY settlement; NEVER follows (not recruitable); BARTER only, no
// coin; wares vary by the settlement's trade. Names from the free-folk pool (Gleaner reserved). Stall stock tables per trade and
// barter rates = Jin's. The rows come from canon's Trades table (same file): each row is a trade's Want -> Product.
// ★ NOT a Folk: a Burrfolk is never in folkOf(), so no recruit / room / trust path can ever reach one. Its own seeded nothing:
//   the stall reads the settlement's biome and the season's folk (already deterministic), so every device sees the same stall,
//   and no existing Moglin's season changed (the only shared input, the name order, is read, never re-drawn).
// s1 = the stall + barter. s2 = Gleaner (the first settlement, the camp pointer) + the Burrfolk camp in the Wilds.
// PURE: use-folk-talk.tsx applies a barter to the bag; folk-talk.ts arranges the talk; network-scene.tsx draws the stall.
import { countOf, give, take, itemDef, type Inv } from '../shared/inventory'
import type { Settlement, SettlementBiome } from './network'
import type { Profession } from './moglins'
import { folkOf, seasonNames, folkCount, FOLK_MAX, type Folk } from './settlement-folk'
import { GLADE_ID } from './moonwell-glade'
import { settlementTurn } from './folk-spots'

/** Canon's trades table (shimmer-folds-settlements.md › Trades), the rows whose goods are plain bag items. Cook, Apothecary,
 *  Well-minder and Brewer trade graded crops / potions (`crop:x:A`): their rows wait on a graded barter (s2+). Rates = Jin's. */
export const BARTER = {
  carpenter: { trade: 'Carpenter', want: { id: 'goldwood_log', n: 2 }, product: { id: 'goldwood_plank', n: 1 } },
  stonery:   { trade: 'Stonery', want: { id: 'raw_mana_shard', n: 3 }, product: { id: 'ather_crystal', n: 1 } },
  rinner:    { trade: 'Rinner', want: { id: 'goldwood_plank', n: 2 }, product: { id: 'glowfin', n: 1 } },
  saptapper: { trade: 'Sap-tapper', want: { id: 'starwillow_branch', n: 2 }, product: { id: 'amber_sap', n: 1 } },
  digger:    { trade: 'Digger', want: { id: 'goldwood_plank', n: 2 }, product: { id: 'raw_mana_shard', n: 1 } },
} as const
export type BarterKey = keyof typeof BARTER
export type BarterRow = (typeof BARTER)[BarterKey]
/** the settlement's own trade, by what lies around it (woods = timber, rock = stone, shore = the water, meadow = the orchards) */
export const BIOME_STALL: Readonly<Record<SettlementBiome, BarterKey>> = { woods: 'carpenter', rock: 'stonery', shore: 'rinner', meadow: 'saptapper' }
/** ...then the trades its folk work, read off canon's table */
export const PROFESSION_STALL: Partial<Record<Profession, BarterKey>> = { carpenter: 'carpenter', stonemason: 'stonery', jeweler: 'stonery', rinnshop: 'rinner', digger: 'digger' }
export const STALL_ROWS = 2
/** canon: reserved, never generated (the first settlement's four + Gleaner, the first settlement's Burrfolk) */
export const BURR_RESERVED = new Set(['Angelica', 'Chamomile', 'Borage', 'Feverfew', 'Gleaner'])

export interface Burrfolk { id: string; name: string; home: string; stock: BarterKey[] }
/** the speaker label when the season's pool has no free name left (canon's word for the kind) */
export const BURR_KIND = 'Burrfolk'
export const isBurr = (id: string | undefined) => !!id && id.startsWith('burr:')

/** What the stall swaps: the settlement's own trade first, then its folk's, two rows. Uses ALL the season's folk (not who is
 *  still home), so a recruit never changes the stall. */
export function stallStock(s: Settlement, folk: readonly Folk[]): BarterKey[] {
  const out: BarterKey[] = [BIOME_STALL[s.biome ?? 'meadow']]
  for (const f of folk) { const k = PROFESSION_STALL[f.profession]; if (k && !out.includes(k)) out.push(k) }
  return out.slice(0, STALL_ROWS)
}

/** The season's free name slots: every slot of the season's name order no Moglin of any settlement holds (settlement i owns
 *  slots i*FOLK_MAX .. +FOLK_MAX-1 and uses the first folkCount of them), minus the reserved names. Generous on purpose: it
 *  counts every slot index the pool has, so a settlement that does not exist only costs a name, never shares one. */
export function freeNames(season: number): string[] {
  const { names, order } = seasonNames(season), out: string[] = []
  for (let j = 0; j < order.length; j++) {
    const i = Math.floor(j / FOLK_MAX), k = j % FOLK_MAX
    if (k < folkCount(`s${season}-${i}`, season)) continue
    const nm = names[order[j]]; if (!BURR_RESERVED.has(nm)) out.push(nm)
  }
  return out
}

/** The Burrfolk keeping the stall in a settlement this season (none in the Glade: Gleaner is s2). Same on every device. */
export function burrfolkOf(s: Settlement, season: number, folk: readonly Folk[] = folkOf(s, season)): Burrfolk | null {
  if (s.id === GLADE_ID) return null
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
  const turn = settlementTurn(s), c = Math.cos(turn), sn = Math.sin(turn), { x: lx, z: lz } = STALL_LOCAL
  return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, yaw: turn }   // faces out from the knoll, as the folk do
}

/** One swap. Refused (nothing changes) when the bag is short of the want or has no room for the product. No coin, ever. */
export function barter(inv: Inv, key: BarterKey): { ok: true; inv: Inv } | { ok: false; why: 'short' | 'full' } {
  const { want, product } = BARTER[key]
  if (countOf(inv, want.id) < want.n) return { ok: false, why: 'short' }
  const less = take(inv, want.id, want.n); if (!less) return { ok: false, why: 'short' }
  const r = give(less, product.id, product.n)
  return r.left > 0 ? { ok: false, why: 'full' } : { ok: true, inv: r.inv }
}

/** FUNCTIONAL labels (build text, for @lark to replace). The Burrfolk's spoken lines are SIGNED: BURRFOLK_BARKS below. */
const nm = (id: string) => itemDef(id).name
export const BURR_LABEL = {
  look: 'Have a look',
  swap: (k: BarterKey) => `Swap ${BARTER[k].want.n} ${nm(BARTER[k].want.id)} for ${BARTER[k].product.n} ${nm(BARTER[k].product.id)}`,
  done: (k: BarterKey) => `${nm(BARTER[k].product.id)} · in your bag`,
  short: (k: BarterKey) => `You need ${BARTER[k].want.n} ${nm(BARTER[k].want.id)} to swap`,
  full: (k: BarterKey) => `No room in your bag for the ${nm(BARTER[k].product.id)}`,
} as const

/** ★ SIGNED (Alex, athernyx 2ac7da7): CANON/game/shimmer-lines-batch-2026-11-23b.md › D5, word for word (burrfolk.test.ts reads
 *  the canon file). The speaker label is the Burrfolk's own pooled name. s1 wires greet / stall / leave; idle (in earshot) and
 *  newstock (stock changed since the last visit) are here for s2 (stock does not change yet). */
export const BURRFOLK_BARKS = {
  greet: 'Wares from all over. Have a look.',
  stall: "No coin, only swaps. Bring me something I haven't got.",
  idle: "Pack's heavy and the day is young.",
  newstock: 'Something new in the pack. It followed me here.',
  leave: "Mind the road. I'll be here.",
} as const
