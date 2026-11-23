// Moglin skills (M46 slice 1). Run: npx tsx src/app/shimmer/open/ather/moglin-skills.test.ts
import { SKILLS, SKILL_LABEL, SKILL_OF_ROOM, rollSkills, rngOf, migrateSkills, skillIn, type Skills, type Skill } from './moglin-skills'
import { adoptVillage, PROFESSIONS, type MoglinRecord } from './moglins'
import { advance } from './station-queue'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
ok(SKILL_LABEL.rinnshop === 'Rinnshop' && !Object.values(SKILL_LABEL).includes('Rinning'), 'label is Rinnshop')
ok(SKILLS.length === 9 && SKILLS.every(s => SKILL_LABEL[s]), 'nine labelled skills')

// spiky rolls
const MAINS: Record<string, Skill> = { farmer: 'farming', cook: 'cooking', carpenter: 'woodworking', stonemason: 'masonry', alchemist: 'potions', smith: 'metalwork', jeweler: 'masonry' }
const MAINLIST: Record<string, Skill[]> = { farmer: ['farming'], cook: ['cooking'], carpenter: ['woodworking', 'forestry'], stonemason: ['masonry', 'mining'], alchemist: ['potions'], smith: ['metalwork'], jeweler: ['masonry'], rinnshop: ['rinnshop'], digger: ['mining'] }
for (const p of PROFESSIONS) {
  let best = 0, sideSum = 0, sideN = 0, restSum = 0, restN = 0, inRange = true
  for (let i = 0; i < 2000; i++) {
    const { skills, luck } = rollSkills(p, rngOf(`t:${p}:${i}`))
    const main = Math.max(...MAINLIST[p].map(k => skills[k]))
    if (SKILLS.every(s => skills[s] <= main)) best++
    for (const s of SKILLS) { if (skills[s] < 1 || skills[s] > 5) inRange = false }
    const others = SKILLS.filter(s => s !== MAINS[p] && !(p === 'carpenter' && s === 'forestry') && !(p === 'stonemason' && s === 'mining')).map(s => skills[s]).sort((a, b) => b - a)
    sideSum += others[0] + others[1]; sideN += 2; restSum += others.slice(2).reduce((a, b) => a + b, 0); restN += others.length - 2
    if (!(luck >= 1 && luck <= 5)) inRange = false
  }
  ok(best / 2000 >= 0.85, `${p}: main skill is max in ${(best / 20).toFixed(1)}%`)
  ok(sideSum / sideN > restSum / restN, `${p}: side mean ${(sideSum / sideN).toFixed(2)} > rest mean ${(restSum / restN).toFixed(2)}`)
  ok(inRange, `${p}: all grades 1-5`)
}
const a = rollSkills('smith', rngOf('x')), b = rollSkills('smith', rngOf('x'))
ok(JSON.stringify(a) === JSON.stringify(b), 'roll is deterministic')

// migration round-trip
const old = (id: string, profession: MoglinRecord['profession'], craft: 1 | 2 | 3 | 4 | 5, y: 1 | 2 | 3 | 4 | 5): MoglinRecord =>
  ({ id, name: id, home: 'h', grades: { craft, yield: y, trade: 2 }, dream: '', profession, recruitedAt: 0 })
const v1 = adoptVillage({ v: 1, lastTick: 0, moglins: [old('c1', 'carpenter', 2, 5), old('f1', 'farmer', 1, 4), old('k1', 'cook', 3, 1), old('s1', 'smith', 1, 3), old('m1', 'stonemason', 4, 2)] }, 1000)
const sk = (id: string) => v1.moglins.find(m => m.id === id)!.skills as Skills
ok(v1.moglins.length === 5, 'no Moglin dropped')
ok(sk('c1').woodworking === 2 && sk('c1').forestry === 5, 'carpenter: craft->woodworking, yield->forestry')
ok(sk('f1').farming === 4, 'farmer: yield->farming')
ok(sk('k1').cooking === 3 && sk('k1').rinnshop === 1, 'cook: craft->cooking, yield->rinnshop')
ok(sk('s1').metalwork === 3, 'smith: yield->metalwork')
ok(sk('m1').masonry === 4 && sk('m1').mining === 2, 'stonemason: craft->masonry, yield->mining')
const v2 = adoptVillage(JSON.parse(JSON.stringify(v1)), 1000), v3 = adoptVillage({ v: 1, lastTick: 0, moglins: [old('c1', 'carpenter', 2, 5)] }, 1000)
ok(JSON.stringify(v2.moglins) === JSON.stringify(v1.moglins), 'reload of a migrated save is identical')
ok(JSON.stringify(v3.moglins[0].skills) === JSON.stringify(sk('c1')) && v3.moglins[0].luck === v1.moglins[0].luck, 'second migration of the old record gives identical skills + luck')
ok(v1.moglins[0].grades.yield === 5, 'legacy grades kept readable')
ok(JSON.stringify(migrateSkills(old('c1', 'carpenter', 2, 5))) === JSON.stringify({ skills: sk('c1'), luck: v1.moglins[0].luck }), 'migrateSkills agrees with adopt')

// skillIn routes per room; any Moglin works any room
const rec = { ...old('r1', 'carpenter', 1, 1), skills: { forestry: 5, woodworking: 4, farming: 3, cooking: 2, masonry: 1, metalwork: 2, mining: 3, potions: 4, rinnshop: 5 } as Skills }
ok(skillIn(rec, 'carpentry', 'craft') === 4 && skillIn(rec, 'carpentry', 'yield') === 5, 'carpentry: woodworking / forestry')
ok(skillIn(rec, 'farm', 'yield') === 3 && skillIn(rec, 'cooking', 'craft') === 2 && skillIn(rec, 'alchemy', 'craft') === 4, 'farm/cooking/alchemy')
ok(skillIn(rec, 'stonemason', 'craft') === 1 && skillIn(rec, 'stonemason', 'yield') === 3 && skillIn(rec, 'smith', 'yield') === 2 && skillIn(rec, 'rinnshop', 'craft') === 5, 'stonemason/smith/rinnshop')
ok(Object.keys(SKILL_OF_ROOM).length === 7, 'every room kind mapped')
ok(skillIn(old('z', 'farmer', 1, 4), 'farm', 'yield') === 4, 'legacy record routes through migration')

// station wiring (M65 s2: Luck DOUBLES a run; the odds are tested in moglin-stats.test): always-lucky doubles, none is unchanged
import { REFINE } from './furniture'
const job = REFINE[0], st = { store: job.in.map(c => ({ id: c.id, n: c.n * 40 })) }
const w0 = { cur: 0, last: 0 }, base = advance({ ...st, work: w0 }, 60_000, 1, [job], undefined), lucky = advance({ ...st, work: w0 }, 60_000, 1, [job], { chance: 0.4, rnd: () => 0 }), unlucky = advance({ ...st, work: w0 }, 60_000, 1, [job], { chance: 0.4, rnd: () => 0.99 })
const tot = (r: typeof base) => r.made.reduce((x, y) => x + y.n, 0)
ok(tot(base) > 0 && tot(unlucky) === tot(base), 'no luck hit = unchanged output')
ok(tot(lucky) === 2 * tot(base), `lucky runs drop double (${tot(lucky)} vs ${tot(base)})`)
console.log(`${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('FAIL', f)
if (fails.length) process.exit(1)
