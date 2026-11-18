// The XP feed (M21): every open-world gain reaches the bar once, with the right skill/level/fill, and a level-up says so.
// Run: npx tsx src/app/shimmer/open/shared/xp-feed.test.ts
import { subscribeXp, fillOf, type XpGain } from './xp-feed'
import { addOpenXp, pruneCommit, _resetForestry, openSkills } from '../ather/forestry'
import { xpForSkillLevel } from '../../engine/skills'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const got: XpGain[] = []
const off = subscribeXp(g => got.push(g))

_resetForestry()
pruneCommit('goldwood', 't1', 0)
ok(got.length === 1, `prune emits once (got ${got.length})`)
ok(got[0]?.skill === 'forestry' && got[0].name === 'Forestry', 'prune reads Forestry')
ok(got[0]?.gained > 0 && got[0].xp === openSkills().forestry.xp, 'gain + xp match the store')
ok(got[0]?.need === xpForSkillLevel(1) && got[0].leveledTo === null, 'need = level 1 cost, no level-up')
const f1 = fillOf(got[0])
pruneCommit('goldwood', 't2', 0)
ok(fillOf(got[1]) > f1, `fill rises (${f1} -> ${fillOf(got[1])})`)

got.length = 0
addOpenXp('prospecting', 7)
ok(got.length === 1 && got[0].skill === 'prospecting' && got[0].gained === 7, 'addOpenXp emits for any skill')

got.length = 0
const need = xpForSkillLevel(openSkills().rinning.level)
const up = addOpenXp('rinning', need + 1)
ok(up === 2 && got[0]?.leveledTo === 2 && got[0].level === 2, `level-up carried (up ${up}, leveledTo ${got[0]?.leveledTo})`)
ok(got[0]?.xp === 1 && got[0].need === xpForSkillLevel(2), 'fill restarts in the new level')

got.length = 0
addOpenXp('forestry', 0)
ok(got.length === 0, 'a zero gain is silent')
off()
addOpenXp('forestry', 3)
ok(got.length === 0, 'unsubscribe works')

console.log(`xp-feed: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f))
if (fails.length) process.exit(1)
