// ── THE DIGGER'S TRADE (BETA M108 s3: the cells' first charge) ───────────────────────────────────────────────────────────
// Canon: CANON/game/shimmer-folds-settlements.md › Trades: **Digger** = Want Goldwood Plank (shoring), Product Raw Mana Shard
// (Prospecting, Marl's trade). ather-rework §7⅞ (Magii [RULED] 83b6870): the keeper trades with a Digger Moglin in the Ather
// for Raw Mana Shards to fill Franky's cells. Barter as Moglins trade (no coin). Nobody is given away.
// Jin's dials (hub 11-23): 2 planks for 1 shard, repeatable, any Digger at home in a settlement.
// PURE: the talk (folk-talk.ts) offers it, use-folk-talk.tsx applies it to the bag.
import { countOf, give, take, itemDef, type Inv } from '../shared/inventory'

export const DIGGER_TRADE = { want: { id: 'goldwood_plank', n: 2 }, product: { id: 'raw_mana_shard', n: 1 } } as const

/** One trade. Refused (nothing changes) when the bag is short of planks or has no room for the shard. */
export function diggerTrade(inv: Inv): { ok: true; inv: Inv } | { ok: false; why: 'short' | 'full' } {
  const { want, product } = DIGGER_TRADE
  if (countOf(inv, want.id) < want.n) return { ok: false, why: 'short' }
  const less = take(inv, want.id, want.n); if (!less) return { ok: false, why: 'short' }
  const r = give(less, product.id, product.n)
  return r.left > 0 ? { ok: false, why: 'full' } : { ok: true, inv: r.inv }
}

/** FUNCTIONAL labels (build text, for @lark to replace) */
export const DIGGER_LABEL = {
  trade: `Trade ${DIGGER_TRADE.want.n} ${itemDef(DIGGER_TRADE.want.id).name} for ${DIGGER_TRADE.product.n} ${itemDef(DIGGER_TRADE.product.id).name}`,
  done: `${itemDef(DIGGER_TRADE.product.id).name} · in your bag`,
  short: `You need ${DIGGER_TRADE.want.n} ${itemDef(DIGGER_TRADE.want.id).name} to trade`,
  full: 'Your bag is full. Make room for the shards.',   // SIGNED pattern (batch 11-23c b3dc505, Magii #17067)
} as const
