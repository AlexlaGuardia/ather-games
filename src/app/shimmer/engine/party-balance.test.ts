// ── Party balance — headless oracle + tuning report ────────────────────────────
// Run:  npx tsx src/app/shimmer/engine/party-balance.test.ts
//       npx tsx src/app/shimmer/engine/party-balance.test.ts --report   (verbose tables)
//
// WHY THIS IS A .test.ts AND NOT A .sim.ts. Its ancestors `party-battle.sim.ts` and
// `species-balance.sim.ts` were deleted 2026-07-09 for being print-only tuning reports —
// nothing asserted, so nothing noticed when they went stale, so they were dead weight.
// (arena.test.ts survived that same pass because it asserts.) This one prints the same
// tables but ALSO asserts the properties those tables are supposed to demonstrate, and
// exits non-zero when one breaks. A number nobody checks is not a check.
//
// What it guards — the balance surface behind every party fight (party-stats.ts's growth
// curve + calcPartyDamage, driven through party-battle.ts's real turn loop and AI):
//   1. INVARIANTS      — every fight resolves, hp/mana never go negative, order is sane.
//   2. FAIRNESS        — a true mirror is a coin flip (no side/initiative bias).
//   3. LEVEL MEANING   — being higher level must actually win more, monotonically.
//   4. TTK BAND        — fights end in a playable number of rounds at every level.
//   5. ARCHETYPE HEALTH— no species is a leaguewide auto-win or auto-lose.
//
// Determinism: the engine calls Math.random() throughout. We swap in a seeded PRNG for the
// duration of each scenario, so a run is reproducible AND a before/after balance comparison
// is apples-to-apples (same seed ⇒ same dice, only the formulas differ). Nothing here mutates
// game state — spirits are built fresh per battle.

import { createSpirit, type Spirit, type Species } from '../spirits/spirit'
import { derivePartyStats } from './party-stats'
import {
  createPartyBattle, currentActor, takeAction, chooseAction, chooseKeeperAction,
  type PartyBattleState, type AIConfig,
} from './party-battle'

const REPORT = process.argv.includes('--report')

// ── Seeded RNG (mulberry32) ────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Run fn with Math.random replaced by a seeded stream. Always restores, even on throw. */
function seeded<T>(seed: number, fn: () => T): T {
  const real = Math.random
  Math.random = mulberry32(seed)
  try { return fn() } finally { Math.random = real }
}

// ── Fixtures ───────────────────────────────────────────────────────────────────
const ALL_SPECIES: Species[] = [
  'fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat',
]

/** A spirit with FIXED seeds/temperament so a matchup measures the balance model, not IV luck. */
function mk(species: Species, level: number, seed = 15): Spirit {
  const s = createSpirit(species, species, 0, 0)
  s.level = level
  s.seeds = [seed, seed, seed, seed, seed, seed]
  s.temperament = 'neutral'
  return s
}

const AI: AIConfig = { focusFire: true, spendMana: true }
const ROUND_CAP = 200   // a fight needing more than this is a stalemate, not a long fight

export interface BattleResult {
  outcome: 'win' | 'lose' | 'stalemate'
  rounds: number
  negativeHp: boolean
  negativeMana: boolean
}

/** Drive one full battle headlessly through the real engine. `win` = the ALLY side won. */
function runBattle(allies: Spirit[], enemies: Spirit[]): BattleResult {
  const state = createPartyBattle(allies, enemies)
  let negativeHp = false
  let negativeMana = false

  const audit = (s: PartyBattleState) => {
    for (const c of [...s.allies, ...s.enemies]) if (c.hp < 0) negativeHp = true
    if (s.mana.ally.current < 0 || s.mana.enemy.current < 0) negativeMana = true
  }

  while (state.outcome === 'pending' && state.round <= ROUND_CAP) {
    const actor = currentActor(state)
    if (!actor) break   // engine advances rounds itself; a null actor here means it is wedged
    const action = actor.isKeeper ? chooseKeeperAction(state, actor) : chooseAction(state, actor, AI)
    takeAction(state, action)
    audit(state)
  }

  return {
    outcome: state.outcome === 'pending' ? 'stalemate' : state.outcome,
    rounds: state.round,
    negativeHp,
    negativeMana,
  }
}

export interface Batch {
  winRate: number      // ally win share, 0-1
  meanRounds: number
  medianRounds: number
  stalemates: number
  negativeHp: number
  negativeMana: number
  n: number
}

/** Run n battles of one matchup under a deterministic seed stream. */
function batch(allyOf: () => Spirit[], enemyOf: () => Spirit[], n: number, seed: number): Batch {
  return seeded(seed, () => {
    let wins = 0, stalemates = 0, negHp = 0, negMana = 0
    const rounds: number[] = []
    for (let i = 0; i < n; i++) {
      const r = runBattle(allyOf(), enemyOf())
      if (r.outcome === 'win') wins++
      if (r.outcome === 'stalemate') stalemates++
      if (r.negativeHp) negHp++
      if (r.negativeMana) negMana++
      rounds.push(r.rounds)
    }
    rounds.sort((a, b) => a - b)
    return {
      winRate: wins / n,
      meanRounds: rounds.reduce((s, v) => s + v, 0) / n,
      medianRounds: rounds[Math.floor(n / 2)],
      stalemates, negativeHp: negHp, negativeMana: negMana, n,
    }
  })
}

const team = (species: Species[], level: number) => () => species.map(sp => mk(sp, level))
const TRIO: Species[] = ['fox', 'axolotl', 'frog']

// ── Failure collection ─────────────────────────────────────────────────────────
//
// KNOWN_GAPS = checks that fail on TODAY's balance and are not yet fixed. They still print,
// loudly, under their own heading — but they don't fail the run, so this stays usable as a
// regression gate instead of a suite that is always red and therefore always ignored. A
// failure NOT in this set exits non-zero. Delete an entry the moment its fix lands; if a
// known-gap check starts passing, the run also fails, so the list can't quietly rot.
const KNOWN_GAPS = new Set([
  'species-ceiling:frog',
  'species-floor:owl',
  'species-floor:firefly',
  'level-cliff:2',
  'level-cliff:5',
])

const fails: { key: string; msg: string }[] = []
const passedKeys = new Set<string>()
const check = (key: string, cond: boolean, msg: string) => {
  if (cond) passedKeys.add(key)
  else fails.push({ key, msg })
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STAT GROWTH — what a level is actually worth (the Dewbear question)
// ═══════════════════════════════════════════════════════════════════════════════
const GROWTH_LEVELS = [1, 6, 10, 20, 40, 60]

function growthReport() {
  console.log('\n── STAT GROWTH PER SPECIES (fixed seeds 15, neutral) ──')
  console.log('  lv1 → lv10 delta, and levels needed to gain ONE point of each stat\n')
  console.log('  species        pwr  grd  foc  res  agi  vig   HP  | slowest stat')
  for (const sp of ALL_SPECIES) {
    const a = derivePartyStats(mk(sp, 1))
    const b = derivePartyStats(mk(sp, 10))
    const keys = ['pwr', 'grd', 'foc', 'res', 'agi', 'vig'] as const
    const deltas = keys.map(k => b[k] - a[k])
    const hp = b.maxHp - a.maxHp
    // levels per point on the weakest-growing stat
    const slowIdx = deltas.indexOf(Math.min(...deltas))
    const perPoint = deltas[slowIdx] > 0 ? (9 / deltas[slowIdx]).toFixed(1) : '∞'
    console.log(
      `  ${sp.padEnd(13)}` +
      deltas.map(d => `+${d}`.padStart(5)).join('') +
      `${('+' + hp).padStart(5)}  | ${keys[slowIdx]} = 1 pt per ${perPoint} levels`,
    )
  }

  if (REPORT) {
    console.log('\n  Dewbear (water-bear) full curve:')
    console.log('    lv   pwr  grd  foc  res  agi  vig   HP')
    for (const lv of GROWTH_LEVELS) {
      const s = derivePartyStats(mk('water-bear', lv))
      console.log(`    ${String(lv).padStart(2)} ` +
        [s.pwr, s.grd, s.foc, s.res, s.agi, s.vig, s.maxHp].map(v => String(v).padStart(5)).join(''))
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INVARIANTS + FAIRNESS — a mirror is a coin flip and always resolves
// ═══════════════════════════════════════════════════════════════════════════════
function mirrorScenarios() {
  console.log('\n── FAIR MIRROR (same trio, same level, both sides) ──')
  console.log('  level   winRate   medianRounds   meanRounds   stalemates')
  const results: { level: number; b: Batch }[] = []
  for (const lv of [5, 15, 30, 50]) {
    const b = batch(team(TRIO, lv), team(TRIO, lv), 200, 0xBEEF + lv)
    results.push({ level: lv, b })
    console.log(
      `  ${String(lv).padStart(5)}   ${pct(b.winRate).padStart(7)}   ` +
      `${String(b.medianRounds).padStart(12)}   ${b.meanRounds.toFixed(1).padStart(10)}   ${String(b.stalemates).padStart(10)}`,
    )

    check(`mirror-resolves:${lv}`, b.stalemates === 0, `mirror lv${lv}: ${b.stalemates}/${b.n} fights hit the ${ROUND_CAP}-round cap (stalemate)`)
    check(`mirror-hp:${lv}`, b.negativeHp === 0, `mirror lv${lv}: hp went negative in ${b.negativeHp} fights`)
    check(`mirror-mana:${lv}`, b.negativeMana === 0, `mirror lv${lv}: mana went negative in ${b.negativeMana} fights`)
    check(
      `mirror-fair:${lv}`,
      Math.abs(b.winRate - 0.5) <= 0.12,
      `mirror lv${lv}: win rate ${pct(b.winRate)} — a true mirror should be ~50% (side/initiative bias?)`,
    )
    // A fight has to last long enough to be a fight, and end soon enough to be playable.
    check(
      `mirror-ttk:${lv}`,
      b.medianRounds >= 3 && b.medianRounds <= 40,
      `mirror lv${lv}: median ${b.medianRounds} rounds is outside the playable 3-40 band`,
    )
  }
  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LEVEL MEANING — the property Alex asked about. Levels must BUY something.
// ═══════════════════════════════════════════════════════════════════════════════
const LEVEL_GAPS = [0, 2, 5, 10, 20]

function levelLadder() {
  console.log('\n── LEVEL LADDER (ally trio lv20 vs enemy trio lv20+gap) ──')
  console.log('  gap   allyWinRate   medianRounds')
  const rates: { gap: number; rate: number }[] = []
  for (const gap of LEVEL_GAPS) {
    const b = batch(team(TRIO, 20), team(TRIO, 20 + gap), 200, 0xC0FFEE + gap)
    rates.push({ gap, rate: b.winRate })
    console.log(`  ${String(gap).padStart(3)}   ${pct(b.winRate).padStart(11)}   ${String(b.medianRounds).padStart(12)}`)
    check(`ladder-resolves:${gap}`, b.stalemates === 0, `ladder gap ${gap}: ${b.stalemates} stalemates`)
  }

  // Monotonic: every extra enemy level must not INCREASE the ally's win rate.
  // (Small non-monotonic wobble is sampling noise, so allow a little slack.)
  for (let i = 1; i < rates.length; i++) {
    check(
      `ladder-monotonic:${rates[i].gap}`,
      rates[i].rate <= rates[i - 1].rate + 0.06,
      `level advantage is not monotonic: enemy +${rates[i].gap} wins LESS than enemy +${rates[i - 1].gap} ` +
      `(ally ${pct(rates[i].rate)} vs ${pct(rates[i - 1].rate)})`,
    )
  }

  const at = (g: number) => rates.find(r => r.gap === g)!.rate
  const even = at(0)
  console.log(`\n  swing per 5 levels: ${pct(even - at(5))}   per 10 levels: ${pct(even - at(10))}`)

  // A level has to BUY something…
  check('level-matters:5', even - at(5) >= 0.10,
    `5 levels swings the fight only ${pct(even - at(5))} — a level has to be worth something (want ≥10%)`)
  check('level-matters:10', even - at(10) >= 0.20,
    `10 levels swings the fight only ${pct(even - at(10))} — want ≥20%`)

  // …but NOT everything. This is the property the sim was built to expose: a small level
  // deficit currently reads as an auto-loss, so nothing else about a fight gets to matter.
  // The cause is short TTK — at ~5-6 hits per KO, a ~13% per-hit edge turns a 6-hit kill
  // into a 5-hit kill, which is deterministic, not a probability. A playable game wants a
  // level or two to TILT a fight, not decide it before the first turn.
  check('level-cliff:2', at(2) >= 0.20,
    `a 2-level deficit is an auto-loss (${pct(at(2))} win) — small gaps should tilt, not decide (want ≥20%)`)
  check('level-cliff:5', at(5) >= 0.05,
    `a 5-level deficit is unwinnable (${pct(at(5))} win) — want ≥5%, some room for play to matter`)
  return rates
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ARCHETYPE HEALTH — no species auto-wins or auto-loses the league
// ═══════════════════════════════════════════════════════════════════════════════
function speciesMatrix() {
  console.log('\n── SPECIES LEAGUE (1v1 mirror-level, 60 fights per pairing, lv25) ──')
  const leagueRate: Record<string, number> = {}
  for (const a of ALL_SPECIES) {
    let wins = 0, games = 0
    const row: string[] = []
    for (const d of ALL_SPECIES) {
      if (a === d) { row.push('  — '); continue }
      const b = batch(() => [mk(a, 25)], () => [mk(d, 25)], 60, 0xA11CE + a.length * 31 + d.length)
      wins += b.winRate * b.n
      games += b.n
      row.push(String(Math.round(b.winRate * 100)).padStart(4))
      check(`1v1-resolves:${a}:${d}`, b.stalemates === 0, `1v1 ${a} vs ${d}: ${b.stalemates} stalemates`)
    }
    leagueRate[a] = wins / games
    if (REPORT) console.log(`  ${a.padEnd(13)}${row.join('')}`)
  }

  console.log('\n  league win rate (vs the whole field):')
  const sorted = Object.entries(leagueRate).sort((x, y) => y[1] - x[1])
  for (const [sp, r] of sorted) console.log(`    ${sp.padEnd(14)} ${pct(r)}`)

  for (const [sp, r] of sorted) {
    check(`species-ceiling:${sp}`, r <= 0.80, `${sp} beats the field ${pct(r)} of the time — oppressive`)
    check(`species-floor:${sp}`, r >= 0.20, `${sp} beats the field only ${pct(r)} of the time — dead archetype`)
  }
  return leagueRate
}

// ═══════════════════════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════════════════════
console.log('═══ PARTY BALANCE ORACLE ═══')
growthReport()
mirrorScenarios()
levelLadder()
speciesMatrix()

// ── Verdict ────────────────────────────────────────────────────────────────────
const known = fails.filter(f => KNOWN_GAPS.has(f.key))
const fresh = fails.filter(f => !KNOWN_GAPS.has(f.key))
// A known gap that now passes means someone fixed it (or the check went slack) — either
// way the list is out of date and must be edited, so treat it as a failure too.
const fixed = [...KNOWN_GAPS].filter(k => passedKeys.has(k))

if (known.length) {
  console.log(`\n⚠️  KNOWN GAPS — real problems, recorded so the gate stays usable (${known.length}):`)
  for (const f of known) console.log(`  - ${f.msg}`)
}
if (fixed.length) {
  console.error(`\n❌ KNOWN_GAPS is stale — these now PASS, remove them from the set:\n  - ` + fixed.join('\n  - '))
}
if (fresh.length) {
  console.error(`\n❌ PARTY BALANCE FAILED (${fresh.length} new):\n  - ` + fresh.map(f => f.msg).join('\n  - '))
}
if (fresh.length || fixed.length) process.exit(1)
console.log(`\n✅ party balance: no regressions (${known.length} known gaps outstanding)`)
