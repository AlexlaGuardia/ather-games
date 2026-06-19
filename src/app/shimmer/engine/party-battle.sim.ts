// Headless party-battle sim — prove the loop + mana economy + difficulty BEFORE any UI.
// Run: npx tsx src/app/shimmer/engine/party-battle.sim.ts
//
// Validates: (1) the core party turn loop terminates with a winner,
// (2) the mana economy bites (fights run past the pool → Strike fallback),
// (3) difficulty is tunable — a "stronghold" (more/stronger foes) makes the
//     player genuinely struggle (the Moglin-stronghold design goal).

import { createSpirit, type Spirit } from '../spirits/spirit'
import type { Species } from '../spirits/spirit'
import {
  createPartyBattle, currentActor, takeAction, chooseAction, BASIC_STRIKE,
  type PartyBattleState, type AIConfig, type ManaConfig,
} from './party-battle'

function mkSpirit(species: Species, level: number, name = species): Spirit {
  const s = createSpirit(species, name, 0, 0)
  s.level = level
  s.bond = 60
  s.happiness = 128
  return s
}

const ALLY_AI: AIConfig = { focusFire: true, spendMana: true }
const ENEMY_AI: AIConfig = { focusFire: true, spendMana: true }

interface RunResult { outcome: 'win' | 'lose'; rounds: number; manaDryTurns: number; constrained: number; turns: number }

function runBattle(
  allies: Spirit[], enemies: Spirit[],
  mana?: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> },
): RunResult {
  const state: PartyBattleState = createPartyBattle(allies, enemies, mana)
  let starved = 0     // ally turns that WANTED a mana move but could only afford Strike
  let constrained = 0 // ally turns where mana forced a WEAKER move than the actor's best (Strike or cheaper)
  let allyTurns = 0
  let turns = 0
  const SAFETY = 2000
  while (state.outcome === 'pending' && turns < SAFETY) {
    const actor = currentActor(state)
    if (!actor) break // round boundary handled inside takeAction; guard anyway
    const ai = actor.side === 'ally' ? ALLY_AI : ENEMY_AI
    const action = chooseAction(state, actor, ai)
    if (actor.side === 'ally') {
      allyTurns++
      const bestPower = Math.max(BASIC_STRIKE.power, ...actor.moves.map(e => e.move.power))
      const chosenPower = action.type !== 'move' ? BASIC_STRIKE.power
        : action.moveIdx < 0 ? BASIC_STRIKE.power : actor.moves[action.moveIdx].move.power
      if (chosenPower < bestPower) constrained++ // mana made it settle for less
      if (action.type === 'move' && action.moveIdx < 0
          && actor.moves.some(e => e.move.power > BASIC_STRIKE.power)) starved++
    }
    takeAction(state, action)
    turns++
  }
  return {
    outcome: state.outcome === 'lose' ? 'lose' : 'win',
    rounds: state.round,
    manaDryTurns: starved,
    constrained: allyTurns ? constrained / allyTurns : 0,
    turns,
  }
}

function sweep(label: string, mkAllies: () => Spirit[], mkEnemies: () => Spirit[], runs = 400,
  mana?: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> }) {
  let wins = 0, rounds = 0, dry = 0, constrained = 0, turns = 0
  for (let i = 0; i < runs; i++) {
    const r = runBattle(mkAllies(), mkEnemies(), mana)
    if (r.outcome === 'win') wins++
    rounds += r.rounds
    dry += r.manaDryTurns
    constrained += r.constrained
    turns += r.turns
  }
  const pct = (wins / runs * 100).toFixed(1)
  console.log(
    `${label.padEnd(34)} | win ${pct.padStart(5)}% | rounds ${(rounds / runs).toFixed(1).padStart(4)}` +
    ` | constrained ${(constrained / runs * 100).toFixed(0).padStart(3)}% | dry/run ${(dry / runs).toFixed(1).padStart(4)} | turns ${(turns / runs).toFixed(0).padStart(3)}`,
  )
}

console.log('\n=== Party Battle — balance sweep (400 runs each) ===\n')

// 1. Fair fight: mirror 3v3, same level → should be a coin-flip (~50%), proves the loop is symmetric.
sweep('Fair 3v3 (L25 mirror)',
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)])

// 2. Slight edge: your party 2 levels up → should win comfortably but not always.
sweep('Slight edge (L27 vs L25)',
  () => [mkSpirit('fox', 27), mkSpirit('owl', 27), mkSpirit('frog', 27)],
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)])

// 3. STRUGGLE band: a stronghold tuned to be hard-but-winnable (the design target).
sweep('Stronghold — struggle (3 L25 vs 3 L31)',
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
  () => [mkSpirit('owl', 31), mkSpirit('bat', 31), mkSpirit('turtle', 31)])

// 4. WALL: 3 vs 4 stronger → shows the knob can also make a true wall (boss/late stronghold).
sweep('Stronghold — wall (3 L25 vs 4 L30)',
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
  () => [mkSpirit('owl', 30), mkSpirit('bat', 30), mkSpirit('firefly', 30), mkSpirit('turtle', 30)])

// 5. Mana matters: the struggle stronghold, but your side mana-rich vs a starved enemy.
sweep('Struggle — you mana-rich',
  () => [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
  () => [mkSpirit('owl', 31), mkSpirit('bat', 31), mkSpirit('turtle', 31)],
  400,
  { ally: { start: 40, max: 50, regen: 10 }, enemy: { start: 10, max: 16, regen: 3 } })

// 5. Mana OFF (Strike only, both sides) — isolates how much the mana layer changes fight length.
{
  let wins = 0, rounds = 0
  const runs = 400
  for (let i = 0; i < runs; i++) {
    const state = createPartyBattle(
      [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
      [mkSpirit('fox', 25), mkSpirit('owl', 25), mkSpirit('frog', 25)],
    )
    let turns = 0
    while (state.outcome === 'pending' && turns < 2000) {
      const actor = currentActor(state)
      if (!actor) break
      takeAction(state, chooseAction(state, actor, { focusFire: true, spendMana: false }))
      turns++
    }
    if (state.outcome === 'win') wins++
    rounds += state.round
  }
  console.log(`${'Strike-only mirror (no mana)'.padEnd(34)} | win ${(wins / runs * 100).toFixed(1).padStart(5)}% | rounds ${(rounds / runs).toFixed(1).padStart(4)}`)
}

console.log('')

// ── Species-niche matrix in PARTY context (v2 phys/spirit stats live) ──
// 1v1 duels through the real party engine (mana, evasion, category-AI) at fixed level,
// all same element (neutral matchup) + bond 0 so the only variable is the species stats.
// Goal: no dead units (everyone beats SOMETHING >60%), spread tightening toward even.
{
  const SP: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
  const AB: Record<string, string> = { fox: 'fox', axolotl: 'axo', owl: 'owl', frog: 'frog', firefly: 'ffly', rabbit: 'rbbt', 'water-bear': 'wbr', hummingbird: 'hmbd', turtle: 'trtl', bat: 'bat' }
  const L = 25, N = 120
  const mkS = (sp: Species): Spirit => { const s = createSpirit(sp, sp, 0, 0); s.level = L; s.element = 'mana'; s.bond = 0; s.happiness = 128; return s }
  const duelP = (a: Species, b: Species): boolean => {
    const st = createPartyBattle([mkS(a)], [mkS(b)])
    let g = 0
    while (st.outcome === 'pending' && g < 1000) { const ac = currentActor(st); if (!ac) break; takeAction(st, chooseAction(st, ac, { focusFire: true, spendMana: true })); g++ }
    return st.outcome === 'win'
  }
  const W: Record<string, Record<string, number>> = {}
  for (const a of SP) { W[a] = {}; for (const b of SP) { if (a === b) { W[a][b] = 50; continue } let w = 0; for (let i = 0; i < N; i++) if (duelP(a, b)) w++; W[a][b] = w / N * 100 } }
  console.log(`=== Species niche matrix — PARTY engine, v2 phys/spirit stats, L${L}, ${N}/pair ===\n`)
  console.log('vs    ' + SP.map(x => AB[x].padStart(5)).join(''))
  for (const a of SP) console.log(AB[a].padEnd(6) + SP.map(b => (a === b ? '  -  ' : W[a][b].toFixed(0).padStart(5))).join(''))
  const marg2 = SP.map(a => ({ a, avg: SP.filter(b => b !== a).reduce((s, b) => s + W[a][b], 0) / (SP.length - 1) })).sort((x, y) => y.avg - x.avg)
  console.log('\nmarginal win% (sorted):')
  for (const { a, avg } of marg2) {
    const beats = SP.filter(b => b !== a && W[a][b] >= 60).length
    console.log(`  ${AB[a].padEnd(6)} ${avg.toFixed(1).padStart(5)}%  beats ${beats} >60%${beats === 0 ? '  ⚠ DEAD UNIT' : ''}`)
  }
  console.log(`  spread: ${(marg2[0].avg - marg2[marg2.length - 1].avg).toFixed(1)} pts\n`)
}

// ── Team-value (flex-slot) test — the CORRECT test for glass cannons ──
// A glass cannon's niche is alpha-striking from a screened backline, which 1v1 can't show.
// So: fix a 2-spirit core (balanced + physical wall), rotate each species through the 3rd
// "flex" slot, and measure win% vs a gauntlet of varied enemy teams. If firefly/hummingbird
// climb here vs their 1v1 floor, they're proven party units, not dead weight.
{
  const SP: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
  const AB: Record<string, string> = { fox: 'fox', axolotl: 'axo', owl: 'owl', frog: 'frog', firefly: 'ffly', rabbit: 'rbbt', 'water-bear': 'wbr', hummingbird: 'hmbd', turtle: 'trtl', bat: 'bat' }
  const L = 25, N = 120
  const mkS = (sp: Species): Spirit => { const s = createSpirit(sp, sp, 0, 0); s.level = L; s.element = 'mana'; s.bond = 0; s.happiness = 128; return s }
  const CORE: Species[] = ['fox', 'water-bear']                 // balanced striker + physical wall
  const GAUNTLET: Species[][] = [
    ['owl', 'frog', 'turtle'],          // caster + sweeper + spirit wall
    ['rabbit', 'bat', 'axolotl'],       // bruiser + spirit skirmisher + sustain
    ['hummingbird', 'fox', 'water-bear'], // speed + balanced + wall
  ]
  const teamWin = (allies: Species[], enemies: Species[]): boolean => {
    const st = createPartyBattle(allies.map(mkS), enemies.map(mkS))
    let g = 0
    while (st.outcome === 'pending' && g < 2000) { const ac = currentActor(st); if (!ac) break; takeAction(st, chooseAction(st, ac, { focusFire: true, spendMana: true })); g++ }
    return st.outcome === 'win'
  }
  console.log(`=== Team-value: flex-slot win% — core [fox, water-bear] + FLEX vs a 3-team gauntlet (L${L}, ${N}/matchup) ===\n`)
  const rows = SP.map(flex => {
    let w = 0, tot = 0
    for (const enemy of GAUNTLET) { for (let i = 0; i < N; i++) { if (teamWin([...CORE, flex], enemy)) w++; tot++ } }
    return { flex, pct: w / tot * 100 }
  }).sort((x, y) => y.pct - x.pct)
  for (const { flex, pct } of rows) console.log(`  +${AB[flex].padEnd(5)} ${pct.toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(pct / 2.5))}`)
  console.log('\n  (compare each to its 1v1 marginal above — glass cannons SHOULD climb here)\n')
}
