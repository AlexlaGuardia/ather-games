// BETA M233 CLASH v2b: the headless tuning sim for the live auto-battle (src/app/shimmer/open/ather/clash-fight.ts).
// Runs seeded fights over every species pair at both open tent levels (easy = base forms Lv12, average = second forms Lv40,
// each species' element drawn per fight), both sides swapped. Prints duration mean / p10 / p90 / max and the win-rate table.
// Targets (Alex 11-27): mean 60-90 s, no species pair above MAX_WR at even level (power = choice), no fight over 240 s.
// Run: npx tsx scripts/clash-sim.mts [fightsPerPair=60]   exit 1 if a target misses.
import { runFight, tentEntrant, type CheerPolicy } from '../src/app/shimmer/open/ather/clash-fight'
import { CLASH_SPECIES } from '../src/app/shimmer/open/ather/fair-clash'
import { ELEMENTS, type Element } from '../src/app/shimmer/spirits/spirit'
import type { ClashTier } from '../src/app/shimmer/open/ather/fair-clash-rules'

const N = Number(process.argv[2] ?? 60)
const MAX_WR = 0.8
const cheer: [CheerPolicy, CheerPolicy] = [{ at: 0.3 }, { at: 0.3 }]
let bad = 0
for (const tier of ['easy', 'average'] as ClashTier[]) {
  const durs: number[] = [], wr = new Map<string, number>(), timeouts = { n: 0 }
  let seed = tier === 'easy' ? 1 : 100001
  for (const a of CLASH_SPECIES) for (const b of CLASH_SPECIES) {
    if (a === b) continue
    let aw = 0
    for (let i = 0; i < N; i++) {
      seed++
      const el = (k: number): Element => tier === 'easy' ? 'base' : ELEMENTS[(seed * 7 + k * 3) % ELEMENTS.length]
      const swap = i % 2 === 1
      const ea = tentEntrant(a, el(1), tier), eb = tentEntrant(b, el(2), tier)
      const r = swap ? runFight(eb, ea, seed, { cheer }) : runFight(ea, eb, seed, { cheer })
      durs.push(r.seconds)
      if (r.reason === 'time') timeouts.n++
      if ((r.winner === 0) !== swap) aw++
    }
    wr.set(`${a}>${b}`, aw / N)
  }
  durs.sort((x, y) => x - y)
  const q = (p: number) => durs[Math.min(durs.length - 1, Math.floor(p * durs.length))]
  const mean = durs.reduce((n, v) => n + v, 0) / durs.length
  console.log(`\n== ${tier} (${durs.length} fights) duration mean ${mean.toFixed(1)} s  p10 ${q(0.1).toFixed(1)}  p50 ${q(0.5).toFixed(1)}  p90 ${q(0.9).toFixed(1)}  max ${durs[durs.length - 1].toFixed(1)}  timeouts ${timeouts.n}`)
  const head = ['', ...CLASH_SPECIES.map(s => s.slice(0, 5).padStart(6))].join('')
  console.log('row beats col (win rate %)\n' + head.padStart(head.length + 6))
  let worst = 0, worstK = ''
  for (const a of CLASH_SPECIES) {
    const row = CLASH_SPECIES.map(b => { if (a === b) return '     -'; const w = wr.get(`${a}>${b}`)!; if (w > worst) { worst = w; worstK = `${a}>${b}` } return String(Math.round(w * 100)).padStart(6) }).join('')
    const tot = CLASH_SPECIES.filter(b => b !== a).reduce((n, b) => n + wr.get(`${a}>${b}`)!, 0) / (CLASH_SPECIES.length - 1)
    console.log(a.padEnd(12) + row + `   all ${Math.round(tot * 100)}%`)
  }
  // a matchup's win rate = both of its cells together (row a vs b and row b vs a are separate seeded runs: 2N fights)
  worst = 0
  for (const a of CLASH_SPECIES) for (const b of CLASH_SPECIES) {
    if (a === b) continue
    const w = (wr.get(`${a}>${b}`)! + 1 - wr.get(`${b}>${a}`)!) / 2
    if (w > worst) { worst = w; worstK = `${a}>${b}` }
  }
  console.log(`worst matchup ${worstK} ${Math.round(worst * 100)}% (${2 * N} fights)`)
  const okMean = mean >= 60 && mean <= 90, okWr = worst <= MAX_WR, okMax = durs[durs.length - 1] <= 240
  console.log(`targets: mean 60-90 ${okMean ? 'OK' : 'MISS'} · worst <= ${MAX_WR * 100}% ${okWr ? 'OK' : 'MISS'} · max <= 240 ${okMax ? 'OK' : 'MISS'}`)
  if (!okMean || !okWr || !okMax) bad++
}
process.exit(bad ? 1 : 0)
