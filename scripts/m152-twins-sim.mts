// M152 s1: the DB2 Twins' sim table for Alex (src/app/shimmer/open/shared/twins-sim.ts drives the real combat.ts). Deterministic.
//   npx tsx scripts/m152-twins-sim.mts [--out docs/looks/m152-s1-2026-11-27/sim.md]
import { writeFileSync } from 'node:fs'
const S = await import(process.cwd() + '/src/app/shimmer/open/shared/twins-sim.ts')
const i = process.argv.indexOf('--out'), out = i > 0 ? process.argv[i + 1] : ''
const GUNS: [string, string][] = [['twins', 'DB2 Twins (proposed)'], ['roar', 'Roar (breacher)'], ['repeater', 'Repeater (starter)']]
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : '> 30', f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : '> 30'
const L: string[] = []
L.push('| | ' + GUNS.map(g => g[1]).join(' | ') + ' |', '|---|' + GUNS.map(() => '---').join('|') + '|')
const P = GUNS.map(([id]) => S.paper(id))
const row = (label: string, f: (p: ReturnType<typeof S.paper>, id: string) => string) => L.push(`| ${label} | ` + GUNS.map(([id], k) => f(P[k], id)).join(' | ') + ' |')
row('one pull, every pellet on', p => f1(p.shell))
row('clip (pulls) / dump time', (p, id) => `${f1(p.clipDamage)} (${id === 'twins' ? 4 : Math.round(p.clipDamage / p.shell)}) / ${p.dumpSecs.toFixed(2)} s`)
row('burst: first 0.6 s, point blank', p => f1(p.burst06))
row('held DPS (no reload)', p => f1(p.held))
row('sustained DPS (with reloads)', p => f1(p.sustained))
row('reach (m)', p => f1(p.reach))
const D = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]
const fall = GUNS.map(([id]) => D.map(d => S.shellAt(id, d)))
L.push('', '**Falloff: mean damage of ONE pull on a shambler-sized body, hip fire, aimed at the chest (200 seeds)**', '',
  '| m | ' + D.join(' | ') + ' |', '|---|' + D.map(() => '---').join('|') + '|')
GUNS.forEach(([, n], k) => L.push(`| ${n} | ` + fall[k].map(f1).join(' | ') + ' |'))
L.push('', '**Time to kill, trigger held from the first round (s, reloads included, 60 seeds)**', '', '| | 45 hp (a shambler) at 2 / 5 / 8 m | 100 hp (a keeper) at 2 / 5 / 8 m |', '|---|---|---|')
for (const [id, n] of GUNS) L.push(`| ${n} | ` + [45, 100].map(hp => [2, 5, 8].map(d => f2(S.ttk(id, d, hp))).join(' / ')).join(' | ') + ' |')
L.push('', '**Shove (m a free shambler at 2 m is pushed away; one pull is capped at 1.2 m by combat.ts SHOVE_MAX)**', '', '| | one pull | 0.6 s held |', '|---|---|---|')
for (const [id, n] of GUNS) L.push(`| ${n} | ${S.shoveAt(id, 2, 0).toFixed(2)} | ${S.shoveAt(id, 2, 0.61).toFixed(2)} |`)
const NC = GUNS.map(([id]) => S.newcomer(id)), pair = S.newcomerPair()
const nc = (r: { champ: any; pack: any }) => `champion ${r.champ.died}/200 died, ${r.champ.secs} s · pack ${r.pack.died}/60 died, ${r.pack.secs} s`
L.push('', '**The 6% rule (wilds-teeth (8)): the newcomer bot, champion with 3 crawler adds, 200 seeds; deaths must stay at or under 12/200**', '')
GUNS.forEach(([, n], k) => L.push(`- ${n} ALONE: ${nc(NC[k])}`))
L.push(`- **Repeater + Twins as the sidearm** (draws the Twins inside ${S.PAIR_DRAW} m, Twins in hand ${Math.round(pair.twinsShare * 100)}% of the time): ${nc(pair)}`)
const pass = pair.champ.died <= 12 && pair.pack.died === 0
L.push('', `**Verdict: ${pass ? 'PASSES' : 'FAILS'} the 6% rule as a sidearm** (${pair.champ.died}/200 with the pair vs ${NC[2].champ.died}/200 with the Repeater alone; champion ${pair.champ.secs} s vs ${NC[2].champ.secs} s).`,
  `The Twins ALONE are not a newcomer's gun (${NC[0].champ.died}/200 died): the bot shoots from range, where they do nothing. That is the design (a point-blank sidearm), and they are never the only gun.`)
const md = L.join('\n'); console.log(md); if (out) writeFileSync(out, md + '\n')
