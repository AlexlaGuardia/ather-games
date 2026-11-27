// Thistledown Fair CLASH oracle (BETA M233 s3) — run: npx tsx src/lib/accounts/fair-clash.test.ts
// Line-ups (per-tier pools, pregenerated per tent), the stat evening (power = choice), the held difficult tier, the once-a-season
// prize, and a headless sim of the real turn-based battle at the tent's settings.
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, deleteAccount } from './db'
import { clashState, recordClash } from './fair-clash'
import { CLASH_SEASON, CLASH_OPEN, CLASH_PRIZE, CLASH_AI, CLASH_TROUPE_MANA, TENT_LEVEL, LINEUP_SIZE, cleanTent, type ClashTier } from '@/app/shimmer/open/ather/fair-clash-rules'
import { clashLineup, clashPool, evenSpirit, CLASH_SPECIES, type Foe } from '@/app/shimmer/open/ather/fair-clash'
import { tentsOf, SEASON, type Network } from '@/app/shimmer/open/ather/network'
import { createPartyBattle, currentActor, chooseAction, takeAction } from '@/app/shimmer/engine/party-battle'
import { derivePartyStats } from '@/app/shimmer/engine/party-stats'
import { formStage, SECOND_FORM_NAMES, type Spirit } from '@/app/shimmer/spirits/spirit'

let failures = 0, passes = 0
const ok = (c: boolean, label: string) => { if (c) passes++; else { failures++; console.log(`  FAIL  ${label}`) } }

// ── the season's Clash tents ──
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const clash = tentsOf(net).filter(t => t.contest === 'clash')
ok(clash.length >= 5 && clash.filter(t => t.level === 'difficult').length >= 1, `5+ Clash tents, one difficult (${clash.map(t => t.level)})`)
ok(CLASH_SEASON === SEASON, 'the Clash season is the network season')

// ── the pools: easy = base forms, average = second forms, difficult HELD ──
ok(clashPool('easy').length === 10 && clashPool('easy').every(f => f.element === 'base'), 'easy pool = the ten base forms')
ok(clashPool('average').length === 40 && clashPool('average').every(f => f.element !== 'base' && !!SECOND_FORM_NAMES[f.species][f.element as 'mana']), 'average pool = the forty second forms')
ok(clashPool('difficult').length === 0 && !CLASH_OPEN.difficult && CLASH_OPEN.easy && CLASH_OPEN.average, 'difficult (awakened) is HELD: no pool, not open')
ok(formStage(TENT_LEVEL.easy) === 'base' && formStage(TENT_LEVEL.average) === 'second', 'the tent levels sit in their tier\'s form stage')

// ── the line-ups: pregenerated per tent, the tier's pool, no species twice ──
const key = (l: Foe[]) => l.map(f => `${f.species}:${f.element}`).join(',')
for (const tier of ['easy', 'average'] as ClashTier[]) for (let t = 0; t < 5; t++) {
  const l = clashLineup(1, t, tier)
  ok(l.length === LINEUP_SIZE && new Set(l.map(f => f.species)).size === LINEUP_SIZE, `${tier} tent ${t}: ${LINEUP_SIZE} foes, no species twice (${key(l)})`)
  ok(l.every(f => (tier === 'easy') === (f.element === 'base')), `${tier} tent ${t}: fields its tier's forms`)
  ok(key(l) === key(clashLineup(1, t, tier)), `${tier} tent ${t}: the same line-up every time (pregenerated)`)
}
ok(key(clashLineup(1, 0, 'easy')) !== key(clashLineup(1, 1, 'easy')), 'the two easy tents field different line-ups')
ok(key(clashLineup(1, 2, 'average')) !== key(clashLineup(2, 2, 'average')), 'a new season, a new line-up')
ok(clashLineup(1, 4, 'difficult').length === 0, 'the held tent fields no one')

// ── THE EVENING: power = choice ──
const grind = evenSpirit('fox', 'base', 'easy'); const fresh = evenSpirit('fox', 'base', 'easy')
ok(JSON.stringify(derivePartyStats(grind)) === JSON.stringify(derivePartyStats(fresh)), 'two foxes in a tent have the same stats')
ok([grind, evenSpirit('owl', 'water', 'average')].every(s => s.seeds.every(v => v === 16) && s.temperament === 'neutral' && s.bond === 50 && s.heldItem === undefined), 'even seeds, neutral temperament, even bond, nothing held')
ok(evenSpirit('owl', 'water', 'average').level === TENT_LEVEL.average && grind.level === TENT_LEVEL.easy, 'every spirit fights at the tent\'s level')
ok(evenSpirit('owl', 'water', 'average').name === 'Tideowl' && grind.name === 'Vulnyx', 'names are the canon form names')

// ── the real battle at the tent's settings (a newcomer's spirit can win an easy tent) ──
function bout(me: Spirit, foe: Spirit, tier: ClashTier) {
  const s = createPartyBattle([me], [foe], { enemy: CLASH_TROUPE_MANA[tier] })
  while (s.outcome === 'pending' && s.round <= 80) {
    const a = currentActor(s); if (!a) break
    takeAction(s, a.side === 'enemy' ? chooseAction(s, a, CLASH_AI[tier]) : chooseAction(s, a, { focusFire: true, spendMana: true, stance: 'press' }))
  }
  return s.outcome
}
function lineupWins(tier: ClashTier, element: 'base' | 'water', n: number) {
  const per: Record<string, number> = {}
  for (const sp of CLASH_SPECIES) {
    let w = 0
    for (let i = 0; i < n; i++) if (clashLineup(1, (tier === 'easy' ? 0 : 2) + (i % 2), tier).every(f => bout(evenSpirit(sp, element, tier), evenSpirit(f.species, f.element, tier), tier) === 'win')) w++
    per[sp] = w / n
  }
  return per
}
const easy = lineupWins('easy', 'base', 40)
ok(Object.values(easy).every(p => p >= 0.8), `EVERY base form beats an easy tent's whole line-up most times (${Object.entries(easy).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(' ')})`)
const avg = lineupWins('average', 'water', 60), avgMean = Object.values(avg).reduce((a, b) => a + b, 0) / 10
ok(avgMean >= 0.4 && avgMean <= 0.9, `an average tent is a real fight: a second form takes the line-up ${Math.round(avgMean * 100)}% (40..90)`)
ok(Object.values(avg).every(p => p > 0.1), `no second form is shut out of an average tent (${Object.entries(avg).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(' ')})`)

// ── the prize: once per tent per season, never for the held tier ──
ok(cleanTent(0) === 0 && cleanTent(4) === 4 && cleanTent(-1) === null && cleanTent(1.5) === null && cleanTent(99) === null && cleanTent('x') === null, 'a tent number is a small whole number')
ok(CLASH_PRIZE.easy > 0 && CLASH_PRIZE.average > CLASH_PRIZE.easy, 'an average tent pays more than an easy one')
const path = join(tmpdir(), `fair-clash-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const [a, b] = ['clash_a', 'clash_b'].map(mk)
ok(clashState(1, null).won.length === 0 && !clashState(1, null).signedIn && clashState(1, a).won.length === 0, 'nothing won yet')
const w1 = recordClash(a, 1, { tent: 0, level: 'easy', spirit: 'Vulnyx' })
ok(w1.ok && w1.value.first && w1.value.prize === CLASH_PRIZE.easy && w1.value.won.join() === '0', 'the first win pays the easy prize')
const w2 = recordClash(a, 1, { tent: 0, level: 'easy', spirit: 'Vulnyx' })
ok(w2.ok && !w2.value.first && w2.value.prize === 0, 'a second win at the same tent pays nothing')
const w3 = recordClash(a, 1, { tent: 2, level: 'average', spirit: 'Tideowl' })
ok(w3.ok && w3.value.prize === CLASH_PRIZE.average && w3.value.won.join() === '0,2', 'another tent pays its own prize')
ok(!recordClash(a, 1, { tent: 4, level: 'difficult' }).ok && clashState(1, a).won.join() === '0,2', 'the held tent takes no win')
ok(!recordClash(a, 1, { tent: 'x', level: 'easy' }).ok && !recordClash(a, 1, { tent: 1, level: 'hard' }).ok, 'a bad tent or tier is refused')
ok(recordClash(b, 1, { tent: 0, level: 'easy' }).ok && clashState(1, b).won.join() === '0', 'keeper B wins tent 0 on her own count')
const w5 = recordClash(a, 2, { tent: 0, level: 'easy' })
ok(w5.ok && w5.value.first && w5.value.prize === CLASH_PRIZE.easy, 'a new season pays again')
deleteAccount(a)
ok(clashState(1, a).won.length === 0 && clashState(1, b).won.length === 1, 'a deleted keeper\'s wins go with her')
try { unlinkSync(path) } catch { /* */ }

console.log(`fair-clash: ${passes}/${failures}`)
process.exit(failures ? 1 : 0)
