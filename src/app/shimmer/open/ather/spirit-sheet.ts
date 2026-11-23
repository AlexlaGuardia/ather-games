// M109 s1 (sprites, 2026-11-23): what the SPIRIT PANEL shows, PURE (no React, no DOM). Invents nothing: every number and
// name comes from the game's own spirit data.
//  - name   = the species' canon name (spirits/spirit.ts SPECIES_NAMES = canon/spirits.json names). No personal names.
//  - stats  = the species BASE stats of the live party model (engine/party-stats.ts SPECIES_STATS_V2: pwr grd foc res agi vig).
//             A garden spirit carries no individual Spirit record yet (a planter knows only its seed's species), so there are
//             no seeds/level/temperament to derive from: the panel shows the species line, labelled as such.
//  - moves  = what the data gives that species: born knowing (Mana Pulse + Spirit Ward, engine/moves.ts getMovesForSpirit:
//             every spirit at bloom) + its base learnset (engine/base-learnset.ts BASE_LEARNSET) with the level each joins.
//             Move names are registered in CANON/game/moves.md (base-learnset.ts may add none).
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import { BASE_LEARNSET, BLOOM_LEVEL } from '../../engine/base-learnset'
import { ALL_MOVES, MOVE_MANA_PULSE, MOVE_SPIRIT_WARD } from '../../engine/moves'

export const SHEET_STATS = ['pwr', 'grd', 'foc', 'res', 'agi', 'vig'] as const
export type SheetStat = typeof SHEET_STATS[number]
/** the labels the party panel already uses (play3d/PartyPanel.tsx) */
export const SHEET_LABEL: Record<SheetStat, string> = { pwr: 'PWR', grd: 'GRD', foc: 'FOC', res: 'RES', agi: 'AGI', vig: 'VIG' }
/** the radar's full reach = the highest base stat any species has (derived from the table, not a tuned number) */
export const STAT_TOP = Math.max(...Object.values(SPECIES_STATS_V2).flatMap(s => SHEET_STATS.map(k => s[k])))

export interface SheetAxis { stat: SheetStat; label: string; value: number; reach: number }
export interface SheetMove { id: string; name: string; level: number; power: number; state: string }
export interface SpiritSheet { species: Species; name: string; axes: SheetAxis[]; moves: SheetMove[] }

export function spiritSheet(sp: Species): SpiritSheet {
  const st = SPECIES_STATS_V2[sp]
  const axes = SHEET_STATS.map(k => ({ stat: k, label: SHEET_LABEL[k], value: st[k], reach: st[k] / STAT_TOP }))
  const born = [MOVE_MANA_PULSE, MOVE_SPIRIT_WARD].map(m => ({ id: m.id, name: m.name, level: BLOOM_LEVEL, power: m.power, state: m.state }))
  const learned = (BASE_LEARNSET[sp] ?? []).flatMap(e => { const m = ALL_MOVES[e.id]; return m ? [{ id: m.id, name: m.name, level: e.level, power: m.power, state: m.state }] : [] })
  return { species: sp, name: SPECIES_NAMES[sp], axes, moves: [...born, ...learned] }
}
