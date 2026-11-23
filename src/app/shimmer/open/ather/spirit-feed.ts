// M109 s2 (sprites, 2026-11-23, owner + ?spirits=3d only): FEED a garden spirit. No React, no three.
// Canon (CANON_GAPS M109 (c), Magii RULED 9b4dfe8 / 0aee8bd): spirit food = Ather Wheat, Glowfin, Moonkoi (Simple Spirit
// Meal is canon too, but no such item exists in the build yet, so it is not offered). Two guards, both held HERE by what
// this file does NOT have:
//  - CARE, NOT A LEASH: no hunger meter, nothing drains, nothing unlocks, nothing obeys. Feeding is a gift: one food leaves
//    the bag, she has her happy beat (spirit-trot.ts cheer), and the record below remembers it. That is all.
//  - feeding a wild spirit never makes it yours: only the keeper's own garden spirits (bloomed planters) can be talked to.
// The FED record: per planter id (the same id Follow keys on), { n: times fed, last: ms, item: what she had last }, in
// localStorage. It only ever counts up; nothing reads `last` to punish a gap.
// ⚠ M110 (later, NOT built): the per-spirit STAT record belongs beside this one, keyed by the same planter id (its own key,
// e.g. 'ather.spiritStats.v1', in its own module), read by spirit-sheet.ts in place of the species base stats.
import { gardenKey } from '@/lib/keeper-local'   // M109 s4: a garden key (the planters are the plot's), per account
import { countOf, take, type Inv } from '../shared/inventory'
import { GRADES } from './farming'

/** canon spirit food, in the order the keeper reaches for it: the commonest first, so a moonkoi is not spent while a glowfin
 *  is in the bag. Ather Wheat is graded (crop:ather_wheat:D..S): the lowest grade goes first. */
export const SPIRIT_FOODS = ['glowfin', 'ather_wheat', 'moonkoi'] as const
const wheat = GRADES.map(g => `crop:ather_wheat:${g}`)

/** the item id the keeper would give, or null = no spirit food in the bag */
export function foodIn(inv: Inv): string | null {
  for (const f of SPIRIT_FOODS) {
    if (f === 'ather_wheat') { const w = wheat.find(id => countOf(inv, id) > 0); if (w) return w }
    else if (countOf(inv, f) > 0) return f
  }
  return null
}

export type Fed = { n: number; last: number; item: string }
export type FedBook = Record<string, Fed>
/** pure: the book after feeding `id` one `item` at `now` */
export const withFed = (b: FedBook, id: string, item: string, now: number): FedBook => ({ ...b, [id]: { n: (b[id]?.n ?? 0) + 1, last: now, item } })

/** pure: feed spirit `id` from `inv`. null = no spirit food (nothing taken). */
export function feed(inv: Inv, b: FedBook, id: string, now: number): { inv: Inv; book: FedBook; item: string } | null {
  const item = foodIn(inv); if (!item) return null
  const out = take(inv, item, 1); if (!out) return null
  return { inv: out, book: withFed(b, id, item, now), item }
}

const KEY = 'ather.spiritFed.v1'
export function loadFed(): FedBook {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: FedBook = {}
    for (const [k, f] of Object.entries(v as Record<string, Partial<Fed>>)) if (f && typeof f.n === 'number' && f.n > 0) out[k] = { n: f.n, last: Number(f.last) || 0, item: String(f.item ?? '') }
    return out
  } catch { return {} }
}
export function saveFed(b: FedBook) { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(b)) } catch { /* private mode: this session only */ } }

/** planter ids fed this moment: spirit-model.tsx takes one and plays her happy beat (cheer) */
export const spiritCheer = new Set<string>()
