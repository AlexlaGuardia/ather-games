// M109 s1: the spirit panel's data = the game's own data, nothing invented. Run: npx tsx src/app/shimmer/open/ather/spirit-sheet.test.ts
import { spiritSheet, STAT_TOP, SHEET_STATS } from './spirit-sheet'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import { BASE_LEARNSET } from '../../engine/base-learnset'
import { ALL_MOVES } from '../../engine/moves'
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { setFollowing, FOLLOW_MAX } from './spirit-follow'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
for (const sp of Object.keys(SPECIES_NAMES) as Species[]) {
  const s = spiritSheet(sp)
  ok(s.name === SPECIES_NAMES[sp], `${sp}: canon species name (${s.name})`)
  ok(s.axes.length === 6 && s.axes.every(a => a.value === SPECIES_STATS_V2[sp][a.stat]), `${sp}: radar values = SPECIES_STATS_V2`)
  ok(s.axes.every(a => a.reach > 0 && a.reach <= 1 && Math.abs(a.reach - a.value / STAT_TOP) < 1e-9), `${sp}: reach = value / the table's top`)
  const want = ['mana_pulse', 'spirit_ward', ...BASE_LEARNSET[sp].map(e => e.id)]
  ok(JSON.stringify(s.moves.map(m => m.id)) === JSON.stringify(want), `${sp}: moves = born knowing + BASE_LEARNSET (${s.moves.map(m => m.id).join(',')})`)
  ok(s.moves.every(m => ALL_MOVES[m.id]?.name === m.name), `${sp}: every move name is the registry's`)
}
ok(STAT_TOP === Math.max(...Object.values(SPECIES_STATS_V2).flatMap(v => SHEET_STATS.map(k => v[k]))), 'STAT_TOP is the table max')
const vx = spiritSheet('fox'), mx = spiritSheet('axolotl')
ok(vx.name === 'Vulnyx' && mx.name === 'Manalotl', 'the two live spirits by name')
// Alex 11-23: up to 3 follow at once; a 4th Follow is refused, Stay frees a slot, re-following one already following is fine
ok(FOLLOW_MAX === 3, 'FOLLOW_MAX = 3')
ok(['a', 'b', 'c'].every(id => setFollowing(id, true)) && !setFollowing('d', true) && setFollowing('b', true), 'a 4th Follow is refused')
ok(setFollowing('a', false) && setFollowing('d', true), 'Stay frees a slot')
if (fails.length) { console.error(`spirit-sheet: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-sheet: ${pass}/0`)
