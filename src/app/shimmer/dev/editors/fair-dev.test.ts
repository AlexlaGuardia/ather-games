// BETA M243: the Fair bench (fair-dev.ts): same seed = same result in all three events, the level dial is the tent's own evening
// at the tent level, the bench's Clash runner is the live engine (and logs every tick), and the no-write guard refuses writes.
// Run: npx tsx src/app/shimmer/dev/editors/fair-dev.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { devEntrant, devSpirit, devClashRunner, clashOdds, randomFoes, devHeat, runHeat, devSmash, raceStats, isWrite, noWriteFetch, installNoWrites, logLine, DASH_SUB, type Pick } from './fair-dev'
import { tentEntrant, runFight, type TickLog } from '../../open/ather/clash-fight'
import { fightRunner } from '../../open/ather/clash-bout'
import { evenSpirit } from '../../open/ather/fair-clash'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const fox: Pick = { species: 'fox', element: 'base', level: 12 }
const owl: Pick = { species: 'owl', element: 'base', level: 12 }

// ── the level dial at the tent level IS the tent's evening ──
const te = tentEntrant('fox', 'base', 'easy'), de = devEntrant(fox)
ok(JSON.stringify(te.stats) === JSON.stringify(de.stats) && te.level === de.level, 'Lv12 base fox = the easy tent\'s evened fox')
const te40 = tentEntrant('owl', 'storm', 'average'), de40 = devEntrant({ species: 'owl', element: 'storm', level: 40 })
ok(JSON.stringify(te40.stats) === JSON.stringify(de40.stats), 'Lv40 storm owl = the average tent\'s evened owl')
ok(devEntrant({ ...fox, level: 40 }).stats.maxHp > de.stats.maxHp, 'the level dial moves her stats (Lv40 fox has more HP than Lv12)')
ok(JSON.stringify(devSpirit(fox).seeds) === JSON.stringify(evenSpirit('fox', 'base', 'easy').seeds), 'even seeds, as the tent')

// ── Clash: the bench's runner = the live engine, replayable, logged ──
function playOut(r: ReturnType<typeof devClashRunner>, seed: number) {
  const p = r.run({ spirit: devSpirit(fox), keeper: true }, { spirit: devSpirit(owl) }, { tier: 'easy', seed })
  let t = 0; while (!p.over(t) && t < 400) { p.at(t); t += 0.25 }
  return p.winner()
}
const logA: TickLog[] = [], logB: TickLog[] = []
const wA = playOut(devClashRunner((_b, l) => logA.push(l)), 7003), wB = playOut(devClashRunner((_b, l) => logB.push(l)), 7003)
ok(wA !== null && wA === wB, `same seed = same Clash winner (${wA} / ${wB})`)
ok(logA.length > 100 && logA.length === logB.length && logA[logA.length - 1].t === logB[logB.length - 1].t, `same seed = the same tick log (${logA.length} ticks)`)
ok(logA.map(l => l.ev.length).join() === logB.map(l => l.ev.length).join(), 'same events tick for tick')
ok(logA.some(l => l.ev.some(e => e.kind === 'hit')) && logA[logA.length - 1].ev.some(e => e.kind === 'end'), 'the log carries the hits and the end')
// the game's fightRunner at the tent level plays the SAME fight as the bench's runner (the bench is the real engine)
const g = fightRunner.run({ spirit: evenSpirit('fox', 'base', 'easy'), keeper: true }, { spirit: evenSpirit('owl', 'base', 'easy') }, { tier: 'easy', seed: 7003 })
{ let t = 0; while (!g.over(t) && t < 400) { g.at(t); t += 0.25 } }
ok(g.winner() === wA, `the game's own runner gives the same winner for that seed (${g.winner()} / ${wA})`)
// headless: different seeds do not all agree (the seed really drives it)
const winners = new Set(Array.from({ length: 12 }, (_, i) => runFight(devEntrant(fox), devEntrant(owl), 500 + i).seconds.toFixed(2)))
ok(winners.size > 6, `different seeds = different fights (${winners.size}/12 distinct lengths)`)
ok(logLine(2, { kind: 'start', side: 1, move: 'bonded', moveId: 'stone_throw' }, ['Vulnyx', 'Owl']).includes('Owl starts (stone_throw)'), 'a start line names who winds up what')
ok(logLine(1.5, { kind: 'hit', side: 0, dmg: 12.4, move: 'melee' }, ['Vulnyx', 'Owl']).includes('Vulnyx hits Owl (melee) -12'), 'a log line reads who hit whom')

// odds: the sim's loop, replayable, chunkable
const o1 = clashOdds(devEntrant(fox), devEntrant(owl), 40, 9), o2 = clashOdds(devEntrant(fox), devEntrant(owl), 40, 9)
ok(o1.n === 40 && o1.aWins === o2.aWins && o1.meanS === o2.meanS, `odds replay (${o1.aWins}/40, ${o1.meanS.toFixed(1)} s)`)
const half = clashOdds(devEntrant(fox), devEntrant(owl), 20, 9), rest = clashOdds(devEntrant(fox), devEntrant(owl), 40, 9, 20, half)
ok(rest.n === 40 && rest.aWins === o1.aWins && Math.abs(rest.meanS - o1.meanS) < 1e-6, 'odds in two chunks = odds in one')
{ // sides swap every other fight, as clash-sim.mts (the odds are her share either side of the ring)
  const A = devEntrant(fox), B = devEntrant({ species: 'water-bear', element: 'base', level: 12 }); let want = 0
  for (let i = 0; i < 24; i++) want += i % 2 ? (runFight(B, A, 300 + i).winner === 1 ? 1 : 0) : (runFight(A, B, 300 + i).winner === 0 ? 1 : 0)
  const got = clashOdds(A, B, 24, 300)
  ok(got.aWins === want, `odds = the sim's swapped loop exactly (${got.aWins}/${want})`)
}
const self = clashOdds(devEntrant(fox), devEntrant(fox), 60, 3)
ok(self.aWins > 15 && self.aWins < 45, `a mirror match is near even (${self.aWins}/60): sides swap`)
const f1 = randomFoes('average', 5), f2 = randomFoes('average', 5)
ok(f1.length === 3 && JSON.stringify(f1) === JSON.stringify(f2) && new Set(f1.map(f => f.species)).size === 3 && f1.every(f => f.level === 40 && f.element !== 'base'), 'random foes: seeded, 3 species, second forms at 40')

// ── Dash ──
const heat = devHeat(fox, null, 42), heat2 = devHeat(fox, null, 42)
ok(heat.length === 5 && heat[2].you === true && JSON.stringify(heat) === JSON.stringify(heat2), 'the heat: 5, hers in the middle lane, seeded fill-ins')
const r1 = runHeat(heat, 1234), r2 = runHeat(heat, 1234)
ok(r1.ms.every(m => m != null) && r1.ms.join() === r2.ms.join() && r1.winner === r2.winner, `same seed = same Dash times (${r1.ms.join(',')})`)
const r3 = runHeat(heat, 98765)
ok(r3.ms.join() !== r1.ms.join(), 'another seed = another race')
ok(raceStats('fox', 40).agi > raceStats('fox', 12).agi, 'the level dial moves her race stats')
const picked = devHeat(owl, [fox, { species: 'turtle', element: 'water', level: 40 }], 1)
ok(picked.length === 3 && !!picked[1].you && picked.some(r => r.species === 'turtle' && r.element === 'water'), 'picked entrants race as picked')
ok(/const SUB = 0\.05\b/.test(readFileSync(join(__dirname, '../../open/ather/dash-view.tsx'), 'utf8')) && DASH_SUB === 0.05, 'runHeat steps as the view (SUB 0.05)')

// ── Smash ──
const s1 = devSmash({ species: 'water-bear', element: 'earth', level: 40 }, 77), s2 = devSmash({ species: 'water-bear', element: 'earth', level: 40 }, 77)
ok(s1.score > 0 && s1.score === s2.score && s1.move === s2.move, `same seed = same Smash score (${s1.score})`)
const hits = new Set(Array.from({ length: 20 }, (_, i) => devSmash(fox, i).score))
ok(hits.size > 1, `the seed drives the swing's spread (${hits.size} distinct)`)
ok(devSmash({ ...fox, level: 40 }, 3).score > devSmash(fox, 3).score, 'a higher level swings harder')

// ── no writes ──
ok(isWrite('/api/fair/dash', 'POST') && isWrite('https://ather.games/api/fair/smash', 'post') && isWrite('/api/save', 'PUT'), 'a POST/PUT to /api is a write')
ok(!isWrite('/api/fair/dash', 'GET') && !isWrite('/shimmer/dev', 'POST') && !isWrite('https://other.site/api/x', 'POST'), 'GETs, non-api and other sites are not')
;(async () => {
  const seen: string[] = [], blocked: string[] = []
  const real = (async (u: RequestInfo | URL, i?: RequestInit) => { seen.push(`${i?.method ?? 'GET'} ${String(u)}`); return new Response('{"ok":1}') }) as typeof fetch
  const f = noWriteFetch(real, (u, m) => blocked.push(`${m} ${u}`), 'https://ather.games')
  const w = await f('/api/fair/clash', { method: 'POST', body: '{}' })
  ok(w.status === 403 && seen.length === 0 && blocked.length === 1, 'a write never reaches the server and is reported')
  const r = await f('/api/fair/dash')
  ok(r.status === 200 && seen.length === 1, 'a GET passes')
  const win = { fetch: real, navigator: { sendBeacon: (_u: string | URL) => { seen.push('beacon'); return true } }, location: { origin: 'https://ather.games' } }
  const undo = installNoWrites(win as never, (u, m) => blocked.push(`${m} ${u}`))
  await win.fetch('/api/fair/smash', { method: 'POST' })
  const beacon = win.navigator.sendBeacon('/api/save')
  ok(blocked.length === 3 && !beacon && !seen.includes('beacon') && seen.length === 1, 'installed: fetch + beacon writes are refused')
  undo()
  ok(win.fetch === real, 'the guard comes off when the bench closes')

  console.log(`fair-dev: ${pass} pass, ${fails.length} fail`)
  for (const x of fails) console.log('  ✗', x)
  process.exit(fails.length ? 1 : 0)
})()
