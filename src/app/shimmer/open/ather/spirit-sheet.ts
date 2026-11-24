// M109 s1 (sprites, 2026-11-23): what the SPIRIT PANEL shows, PURE (no React, no DOM). Invents nothing: every number and
// name comes from the game's own spirit data.
//  - name   = the species' canon name (spirits/spirit.ts SPECIES_NAMES = canon/spirits.json names). No personal names.
//  - stats  = the species BASE (M118 s1: spirit-growth.ts SPECIES_BASE, fixed + rebased low: pwr grd foc res agi vig) x her
//             growth, plus what PLAY at training furniture added (M110 s1, spirit-stats.ts, keyed by her planter id), rounded.
//  - growth = the bar's fill only (M118 s1). Levels are HIDDEN: the sheet carries no level number for her or her moves.
//  - moves  = what the data gives that species: born knowing (Mana Pulse + Spirit Ward, engine/moves.ts getMovesForSpirit:
//             every spirit at bloom) + its base learnset (engine/base-learnset.ts BASE_LEARNSET) with the level each joins.
//             Move names are registered in CANON/game/moves.md (base-learnset.ts may add none).
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { SPECIES_BASE, barFill } from './spirit-growth'
import { BASE_LEARNSET } from '../../engine/base-learnset'
import { ALL_MOVES, MOVE_MANA_PULSE, MOVE_SPIRIT_WARD } from '../../engine/moves'
import { statValue, type StatRec } from './spirit-stats'

export const SHEET_STATS = ['pwr', 'grd', 'foc', 'res', 'agi', 'vig'] as const
export type SheetStat = typeof SHEET_STATS[number]
/** the labels the party panel already uses (play3d/PartyPanel.tsx) */
export const SHEET_LABEL: Record<SheetStat, string> = { pwr: 'PWR', grd: 'GRD', foc: 'FOC', res: 'RES', agi: 'AGI', vig: 'VIG' }
/** the radar's full reach = the highest base stat any species has (derived from the table, not a tuned number); a grown
 *  spirit past it is drawn against her own top instead, so the radar keeps her shape */
export const STAT_TOP = Math.max(...Object.values(SPECIES_BASE).flatMap(s => SHEET_STATS.map(k => s[k])))

export interface SheetAxis { stat: SheetStat; label: string; value: number; reach: number }
export interface SheetMove { id: string; name: string; power: number; state: string }
export interface SpiritSheet { species: Species; name: string; axes: SheetAxis[]; moves: SheetMove[]; /** the growth bar, 0..1 */ growth: number }

/** `rec` = her stat record (spirit-stats.ts); absent = the species base */
export function spiritSheet(sp: Species, rec?: StatRec): SpiritSheet {
  const vals = SHEET_STATS.map(k => Math.round(statValue(sp, rec, k))), top = Math.max(STAT_TOP, ...vals)
  const axes = SHEET_STATS.map((k, i) => ({ stat: k, label: SHEET_LABEL[k], value: vals[i], reach: Math.min(1, vals[i] / top) }))
  const born = [MOVE_MANA_PULSE, MOVE_SPIRIT_WARD].map(m => ({ id: m.id, name: m.name, power: m.power, state: m.state }))
  const learned = (BASE_LEARNSET[sp] ?? []).flatMap(e => { const m = ALL_MOVES[e.id]; return m ? [{ id: m.id, name: m.name, power: m.power, state: m.state }] : [] })
  return { species: sp, name: SPECIES_NAMES[sp], axes, moves: [...born, ...learned], growth: barFill(rec && { xp: rec.xp ?? 0, grown: rec.grown ?? 0 }) }
}
