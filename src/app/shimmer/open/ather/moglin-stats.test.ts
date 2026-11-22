// moglin-stats.test.ts — BETA M65 s1: the five-stat radar's numbers (pure). Run: npx tsx src/app/shimmer/open/ather/moglin-stats.test.ts
import {
  STATS, STAT_GRADES, GRADE_POINTS, TALENT_BONUS, TALENT_FROM, LUCK_PCT, STAT_OF_SKILL, SCORE_MAX,
  skillScore, luckPct, rollStats, statsOf, statView, rankOf, type Stats, type StatGrade,
} from './moglin-stats'
import { SKILLS, rollSkills, rngOf } from './moglin-skills'
import { cardOf, recordCard } from './moglin-card'
import { freshTrust, type Folk } from './settlement-folk'
import type { MoglinRecord, Profession } from './moglins'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const st = (core: StatGrade, dexterity: StatGrade, patience: StatGrade, talent: StatGrade, luck: StatGrade): Stats => ({ core, dexterity, patience, talent, luck })

// ── the row's numbers, verbatim ───────────────────────────────────────────────────────────────────────────────────────
ok(JSON.stringify(GRADE_POINTS) === JSON.stringify({ S: 6, A: 5, B: 4, C: 3, D: 2, F: 0 }), 'grade points S6 A5 B4 C3 D2 F0')
ok(JSON.stringify(TALENT_BONUS) === JSON.stringify({ S: 4, A: 3, B: 2, C: 1, D: 1, F: 0 }), 'talent bonus S4 A3 B2 C1 D1 F0 (C=1 pending Alex)')
ok(JSON.stringify(LUCK_PCT) === JSON.stringify({ S: 40, A: 30, B: 20, C: 10, D: 5, F: 0 }), 'luck S40 A30 B20 C10 D5 F0 %')
ok(TALENT_FROM === 'B', "talent applies from 'B or better' (pending Alex)")
ok(STATS.join() === 'core,dexterity,patience,talent,luck', 'five axes in the radar order')
const under = (s: string) => SKILLS.filter(k => STAT_OF_SKILL[k] === s).sort().join()
ok(under('core') === 'forestry,mining', 'Core = Forestry + Prospecting (mining)')
ok(under('dexterity') === 'masonry,rinnshop,woodworking', 'Dexterity = Rinnshop + Carpentry (woodworking) + Stonery (masonry)')
ok(under('patience') === 'cooking,farming,metalwork,potions', 'Patience = Hearth (cooking) + Smithy (metalwork) + Farming + Alchemy (potions, pending Alex)')
ok(SKILLS.every(k => !!STAT_OF_SKILL[k]), 'every M46 skill sits under one stat')

// ── a skill's score ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(skillScore(st('S', 'C', 'C', 'S', 'F'), 'forestry') === 10, 'S stat + S talent = 6 + 4 = 10')
ok(skillScore(st('B', 'C', 'C', 'A', 'F'), 'forestry') === 7, 'B stat gets talent: 4 + 3 = 7')
ok(skillScore(st('C', 'C', 'C', 'S', 'F'), 'forestry') === 3, '★ C stat gets NO talent: 3 + 0 = 3')
ok(skillScore(st('F', 'C', 'C', 'S', 'F'), 'mining') === 0, 'F stat, no talent: 0')
ok(skillScore(st('C', 'A', 'C', 'C', 'F'), 'woodworking') === 6, 'a C talent still lifts an A stat: 5 + 1 = 6')
ok(skillScore(st('C', 'C', 'D', 'S', 'F'), 'potions') === 2, 'D patience: 2, no talent')
// every combination stays inside 0..10, and talent never lifts a stat below B
let inRange = true, belowB = true
for (const g of STAT_GRADES) for (const t of STAT_GRADES) {
  const v = skillScore(st(g, 'C', 'C', t, 'F'), 'forestry')
  if (v < 0 || v > SCORE_MAX) inRange = false
  if (rankOf(g) < rankOf('B') && v !== GRADE_POINTS[g]) belowB = false
}
ok(inRange, 'every stat x talent score is within 0..10 (the cap holds)')
ok(belowB, 'talent never lifts a stat graded below B')
ok(luckPct(st('C', 'C', 'C', 'C', 'A')) === 30 && luckPct(st('C', 'C', 'C', 'C', 'F')) === 0, 'luck % reads the luck grade')

// ── the roll: deterministic per id, biased by the M46 skills ─────────────────────────────────────────────────────────
const PROFS: Profession[] = ['farmer', 'cook', 'carpenter', 'stonemason', 'alchemist', 'smith', 'jeweler', 'rinnshop']
const rec = (id: string, profession: Profession): MoglinRecord => {
  const r = rollSkills(profession, rngOf(`skills:${id}`))
  return { id, name: id, home: 's1', grades: { craft: 3, yield: 3, trade: 3 }, skills: r.skills, luck: r.luck, dream: '', profession, recruitedAt: 0 }
}
const a = rec('1:s1-9:0', 'jeweler')
ok(JSON.stringify(rollStats(a)) === JSON.stringify(rollStats({ ...a })), 'same id + skills = same stats (a reload never rerolls)')
let differ = 0
for (let i = 0; i < 40; i++) if (JSON.stringify(statsOf(rec(`x:${i}`, 'farmer'))) !== JSON.stringify(statsOf(rec(`y:${i}`, 'farmer')))) differ++
ok(differ > 20, `different ids roll differently (${differ}/40 pairs differ)`)
// bias: a stat's grade is within one of its skills' best M46 grade (1 D .. 5 S)
let within = true
for (let i = 0; i < 300; i++) {
  const m = rec(`b:${i}`, PROFS[i % PROFS.length]), s = statsOf(m)
  for (const stat of ['core', 'dexterity', 'patience'] as const) {
    const best = Math.max(...SKILLS.filter(k => STAT_OF_SKILL[k] === stat).map(k => m.skills![k]))
    if (Math.abs(rankOf(s[stat]) - best) > 1) within = false
  }
  if (Math.abs(rankOf(s.luck) - m.luck!) > 1) within = false
}
ok(within, "every stat lands within one grade of what the Moglin's M46 skills say (luck from its M46 luck)")
// a farmer's Patience (farming is its main) beats its Core on average
let pat = 0, core = 0
for (let i = 0; i < 300; i++) { const s = statsOf(rec(`f:${i}`, 'farmer')); pat += rankOf(s.patience); core += rankOf(s.core) }
ok(pat > core, `a farmer leans Patience (mean rank ${(pat / 300).toFixed(2)} vs Core ${(core / 300).toFixed(2)})`)
// grade spread: every grade appears across many Moglins (the radar is not flat)
const seen = new Set<StatGrade>()
for (let i = 0; i < 400; i++) { const s = statsOf(rec(`s:${i}`, PROFS[i % PROFS.length])); for (const k of STATS) seen.add(s[k]) }
ok(STAT_GRADES.every(g => seen.has(g)), `all six grades appear across 400 Moglins (${[...seen].sort().join('')})`)

// ── old saves keep loading ────────────────────────────────────────────────────────────────────────────────────────────
const legacy = { id: '1:moonwell:2', name: 'Old', home: 'moonwell', grades: { craft: 4, yield: 2, trade: 3 }, dream: '', profession: 'cook', recruitedAt: 0 } as MoglinRecord
const ls = statsOf(legacy)
ok(STATS.every(k => STAT_GRADES.includes(ls[k])), 'a pre-M46 record (grades only, no skills/luck) still gets five valid stats')
ok(JSON.stringify(statsOf(legacy)) === JSON.stringify(ls), '…and the same five every time')
ok(recordCard(legacy).radar.length === 5 && recordCard(legacy).scores.length === 9, '…and a full card: 5 axes + 9 scores')

// ── the card ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const v = statView(a), card = recordCard(a)
ok(card.radar.every((x, i) => x.grade === v.axes[i].grade) && card.scores.every((x, i) => x.score === v.scores[i].score), 'a recruited card shows its stats + scores')
ok(card.luckPct === v.luckPct, 'a recruited card shows its luck %')
ok(v.axes.every(x => x.reach >= 0 && x.reach <= 1) && v.axes.find(x => x.grade === 'S')?.reach !== 0, 'radar reach is 0..1 (S = 1, F = 0)')
// the folk (in a settlement) and the record it becomes share an id, so the card does not change on recruit
const folk = { id: a.id, name: a.name, home: 's1', profession: a.profession, grades: a.grades, skills: a.skills, luck: a.luck, dream: '', employed: false, wants: [] } as Folk
ok(JSON.stringify(cardOf(folk, freshTrust(), 'X').radar) === JSON.stringify(card.radar), 'the settlement card and the garden card read the same radar')
// trust reveal: an employed Moglin with nothing brought shows trade only: every axis and score hidden
const hoop = { ...folk, employed: true, wants: [{ id: 'goldwood_log', n: 5 }] } as Folk
const c0 = cardOf(hoop, freshTrust(), 'X')
ok(c0.radar.every(x => x.grade === null) && c0.scores.every(x => x.score === null) && c0.luckPct === null, 'untrusted: axes, scores and luck % all hidden')
// halfway: Talent and Luck stay hidden (they show last), scores stay hidden (a score needs Talent)
const half = cardOf(hoop, { v: 1, given: { [hoop.id]: { goldwood_log: 3 } } } as never, 'X')
ok(!half.full && half.radar.find(x => x.stat === 'talent')!.grade === null && half.radar.find(x => x.stat === 'luck')!.grade === null, 'part-trusted: Talent + Luck still hidden')
ok(half.radar.some(x => x.grade !== null), 'part-trusted: the stats of its lit skills show')
ok(half.scores.every(x => x.score === null), 'part-trusted: scores wait for the full card')

console.log(`moglin-stats: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
