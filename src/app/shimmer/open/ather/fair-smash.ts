// BETA M233 s1: SMASH's HIT. One swing at the bell with the battle system's own damage (engine/party-stats.ts
// calcPartyDamage): her stats as the spirit sheet reads them (spirit-stats.ts statValue: species base x growth x training),
// her element (her form), and her hardest move (born + learnset, spirit-sheet.ts). The bell is a fixed neutral target.
// Pure apart from `rand` (the battle's own crit/spread roll, Math.random unless a test passes one).
import { calcPartyDamage, type PartyDamageInput } from '../../engine/party-stats'
import { ALL_MOVES, MOVE_MANA_PULSE, toBattleElement, type Move } from '../../engine/moves'
import type { Species, Element } from '../../spirits/spirit'
import { statValue, type StatRec } from './spirit-stats'
import { spiritSheet } from './spirit-sheet'

const ZERO = { pwr: 0, grd: 0, agi: 0, vig: 0 }
/** the special bell: a fixed neutral target, guard = spirit-res 20 */
export const BELL: PartyDamageInput = { pstats: { pwr: 0, grd: 20, foc: 0, res: 20, agi: 0, vig: 0, maxHp: 1 }, statStages: ZERO, element: 'neutral', status: null }

/** her hardest move (the highest power she knows) */
export function smashMove(sp: Species, rec?: StatRec): Move {
  let best: Move = MOVE_MANA_PULSE
  for (const m of spiritSheet(sp, rec).moves) { const mv = ALL_MOVES[m.id]; if (mv && mv.power > best.power) best = mv }
  return best
}

export function smashHit(sp: Species, rec: StatRec | undefined, element: Element | undefined, rand: () => number = Math.random): { hit: number; move: string; crit: boolean } {
  const v = (k: 'pwr' | 'grd' | 'foc' | 'res' | 'agi' | 'vig') => Math.round(statValue(sp, rec, k))
  const atk: PartyDamageInput = { pstats: { pwr: v('pwr'), grd: v('grd'), foc: v('foc'), res: v('res'), agi: v('agi'), vig: v('vig'), maxHp: 1 }, statStages: ZERO, element: toBattleElement(element ?? 'base'), status: null }
  const move = smashMove(sp, rec), level = 1 + (rec?.grown ?? 0)
  const real = Math.random
  Math.random = rand
  try { const r = calcPartyDamage(atk, BELL, move, level); return { hit: r.damage, move: move.name, crit: r.crit } } finally { Math.random = real }
}
