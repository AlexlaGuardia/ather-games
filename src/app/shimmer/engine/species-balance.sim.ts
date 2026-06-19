// Headless species-balance matrix — every species vs every species, 1v1, stat-isolated.
// Run: npx tsx src/app/shimmer/engine/species-balance.sim.ts [level]
//
// Purpose: turn "balance 10 spirits by feel" into "tune the 10 base-stat lines until
// the win matrix flattens." We hold element/temperament/seeds/bond constant across the
// whole field so the ONLY variable is the species base stats (+ the level curve). A
// balanced roster = every species' marginal win% sits in a tight band around 50.
//
// Why these controls:
//  - same element (mana) for both fighters  -> matchup is a 1.0x mirror, isolates stats
//  - bond 0                                  -> no signature move, identical movesets
//  - neutral temperament, flat seeds (15)    -> no nature/IV noise
// What's left moving the needle is purely SPECIES_STATS + the deriveCombatStats curve.

import { createSpirit, type Spirit, type Species } from '../spirits/spirit'
import { createPartyBattle, currentActor, takeAction, chooseAction, type AIConfig } from './party-battle'

const SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const ABBR: Record<Species, string> = {
  fox: 'fox', axolotl: 'axo', owl: 'owl', frog: 'frog', firefly: 'ffly', rabbit: 'rbbt',
  'water-bear': 'wbr', hummingbird: 'hmbd', turtle: 'trtl', bat: 'bat',
}
const LEVEL = Number(process.argv[2]) || 25
const RUNS = 160
const AI: AIConfig = { focusFire: true, spendMana: true }

function mk(species: Species): Spirit {
  const s = createSpirit(species, species, 0, 0)
  s.level = LEVEL
  s.element = 'mana'          // shared element → neutral matchup, full moveset
  s.bond = 0                  // no signature → identical kits
  s.temperament = 'neutral'
  s.seeds = [15, 15, 15, 15, 15, 15]
  return s
}

function duel(a: Species, b: Species): boolean {
  const st = createPartyBattle([mk(a)], [mk(b)])
  let guard = 0
  while (st.outcome === 'pending' && guard < 1000) {
    const actor = currentActor(st)
    if (!actor) break
    takeAction(st, chooseAction(st, actor, AI))
    guard++
  }
  return st.outcome === 'win' // 'a' (ally) won
}

// win[a][b] = a's win% vs b
const win: Record<string, Record<string, number>> = {}
for (const a of SPECIES) {
  win[a] = {}
  for (const b of SPECIES) {
    if (a === b) { win[a][b] = 50; continue }
    let w = 0
    for (let i = 0; i < RUNS; i++) if (duel(a, b)) w++
    win[a][b] = (w / RUNS) * 100
  }
}

// ── Print matrix ──
console.log(`\n=== Species balance matrix — L${LEVEL}, ${RUNS} runs/pair, stat-isolated (mana mirror, bond 0, neutral, flat seeds) ===\n`)
const head = 'vs    ' + SPECIES.map(s => ABBR[s].padStart(5)).join('')
console.log(head)
for (const a of SPECIES) {
  const row = SPECIES.map(b => (a === b ? '  -  ' : win[a][b].toFixed(0).padStart(5))).join('')
  console.log(ABBR[a].padEnd(6) + row)
}

// ── Marginal balance score: avg win% across the field (excl. self) ──
console.log('\n=== Marginal win% (avg vs whole field) — sorted; balanced = tight band near 50 ===\n')
const marg = SPECIES.map(a => {
  const opp = SPECIES.filter(b => b !== a)
  const avg = opp.reduce((s, b) => s + win[a][b], 0) / opp.length
  return { a, avg }
}).sort((x, y) => y.avg - x.avg)
for (const { a, avg } of marg) {
  const bar = '█'.repeat(Math.round(avg / 2))
  console.log(`${ABBR[a].padEnd(6)} ${avg.toFixed(1).padStart(5)}%  ${bar}`)
}
const spread = marg[0].avg - marg[marg.length - 1].avg
console.log(`\nspread (top − bottom): ${spread.toFixed(1)} pts  ${spread < 25 ? '→ fairly even' : spread < 45 ? '→ lopsided, worth tuning' : '→ badly skewed'}`)
console.log('')
