// The Passage vessel counter's SHELF and how each item FITS a keeper: pure, so the test can walk every birth rune.
// See open/vessel-shop.tsx for the canon notes (Lane Law, no ultimate words sold, the shelf refuses nothing for fit).
import { TRADE_POOL } from '../../play3d/scroll-market'
import { lettersOf } from '../../play3d/gems'
import { laneRunes } from '../../play3d/cast'
import { vesselRackPrice } from '../../play3d/passage'

export interface ShelfItem { key: string; kind: 'bracelet' | 'glove'; word: string | null; wordName: string | null; effect: string; runes: string[]; price: number }

/** The baseline shelf, derived (never listed): a bracelet per one-letter tactical, and blank gloves. */
export function baselineShelf(): ShelfItem[] {
  const tac = TRADE_POOL.filter(m => m.tier === 'tactical' && lettersOf(m, null).length === 1)
  const bracelets: ShelfItem[] = tac.map(m => ({ key: `b-${m.id}`, kind: 'bracelet', word: m.id, wordName: m.name, effect: m.effect ?? '', runes: lettersOf(m, null), price: vesselRackPrice('bracelet', 1, m.id) }))
  const glove: ShelfItem = { key: 'g-blank', kind: 'glove', word: null, wordName: null, effect: 'Blank paper: a glove waiting on a signature word you have not earned yet.', runes: [], price: vesselRackPrice('focus', 1, null) }
  // the keeper's own runes first is a per-keeper sort, done in the panel; the shelf itself is fixed
  return [glove, ...bracelets.sort((a, b) => a.runes[0].localeCompare(b.runes[0]))]
}

/** How an item sits with this keeper: their birth rune itself, on their element lane, off it, or no lane needed. */
export type Fit = 'birth' | 'lane' | 'off' | 'any'
export function fitOf(item: ShelfItem, birth: string | null): Fit {
  if (item.kind === 'glove' || !item.runes.length) return 'any'
  if (!birth) return 'off'
  if (item.runes.length === 1 && item.runes[0] === birth) return 'birth'
  const lane = laneRunes(birth, 'element')
  return item.runes.every(r => lane.has(r)) ? 'lane' : 'off'
}

