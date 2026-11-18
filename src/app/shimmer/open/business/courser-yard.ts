// THE COURSER YARD (BETA M14, Magii RULED 11-18, CANON_GAPS › Nyx window-shopping): a town craft-shop of the courser trade
// (world/transportation.md › Coursers › Who makes & sells them, 1672). No named maker: the door is a plain trade name. It sells
// the three part ladders (Core / Trim / Rune) the garage fits. Whole coursers wait on Alex (only the Darter exists).
// Pure. Prices + deed gates are trade.ts' (TIER_PRICE / TIER_DEEDS), the same ones the garage charged, so nothing is re-priced.
import { PART_LABEL, tierLabel, type Slot, type Tier } from '../courser-build'
import { canBuy, buy, TIER_PRICE, TIER_DEEDS, type Ledger } from '../trade'

export const YARD_SLOTS: readonly Slot[] = ['core', 'trim', 'rune']
export type PartState = 'owned' | 'buy' | 'later'
export interface PartRow { slot: Slot; tier: Exclude<Tier, 0>; name: string; price: number; deeds: number; state: PartState; why?: string }

/** Every part on the yard's racks for this purse: owned, buyable now, or not yet (and why, in the ledger's own words). */
export function yardRows(l: Ledger): PartRow[] {
  const out: PartRow[] = []
  for (const slot of YARD_SLOTS) for (const tier of [1, 2, 3] as const) {
    const owned = l.owned[slot] >= tier, c = owned ? { ok: true } as { ok: boolean; why?: string } : canBuy(l, slot, tier)
    out.push({ slot, tier, name: tierLabel(slot, tier), price: TIER_PRICE[tier], deeds: TIER_DEEDS[tier], state: owned ? 'owned' : c.ok ? 'buy' : 'later', why: owned ? undefined : c.why })
  }
  return out
}

export const slotName = (s: Slot) => PART_LABEL[s].name
export const buyPart = (l: Ledger, slot: Slot, tier: Tier) => buy(l, slot, tier)
