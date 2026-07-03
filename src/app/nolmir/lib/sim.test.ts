// NOLMIR Crucible sim — runMatch. The idle economy's foundation: away.ts settles
// past matches by seed and trusts runMatch to be DETERMINISTIC (a reload can't
// reroll history; live and away agree). This guards that, plus the result
// invariants, swept across 200 seeds (deterministic, so never flaky).
// Run: npx tsx src/app/nolmir/lib/sim.test.ts
import { runMatch } from './sim'
import { demoCrucible } from './crucible'
import type { MatchMods } from './types'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const doc = demoCrucible()
const mods: MatchMods = { guardHpMult: 1, spikeDmgMult: 1, yieldMult: 1 }
const N = 200

// ── determinism — the invariant away.ts leans on ───────────────────────────
{
  let allSame = true
  for (const seed of [1, 7, 42, 999, 123_456, 2_000_000]) {
    const a = JSON.stringify(runMatch(doc, seed, mods))
    const b = JSON.stringify(runMatch(doc, seed, mods))
    if (a !== b) allSame = false
  }
  ok('runMatch is deterministic (same seed+mods → identical result)', allSame)

  // different seeds must actually diverge — else "the same course for everyone"
  // would be the ONLY course, and the sim would be degenerate
  const fingerprints = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(runMatch(doc, s, mods))))
  ok('different seeds give different matches', fingerprints.size > 1)
}

// ── result invariants swept across 200 seeds ────────────────────────────────
{
  let victories = 0, badYield = 0, badDeepest = 0, badTicks = 0, badSeed = 0, badVictory = 0, badWinner = 0, maxTicks = 0
  for (let seed = 1; seed <= N; seed++) {
    const r = runMatch(doc, seed, mods)
    if (!(r.manaYield >= 0)) badYield++
    if (!(r.deepest >= 0 && r.deepest <= 1)) badDeepest++
    if (!(r.ticks > 0)) badTicks++
    if (r.seed !== seed) badSeed++
    maxTicks = Math.max(maxTicks, r.ticks)
    if (r.victory) {
      victories++
      if (r.winnerTeam === null) badVictory++
      if (!r.reachedGauntlet) badVictory++
      if (r.winnerTeam !== null && (r.winnerTeam < 0 || r.winnerTeam > 3)) badWinner++
    }
  }
  ok('manaYield is never negative', badYield === 0)
  ok('deepest stays in [0,1]', badDeepest === 0)
  ok('every match runs at least one tick', badTicks === 0)
  ok('the result echoes its own seed', badSeed === 0)
  ok('a victory always names a winner AND reached the gauntlet', badVictory === 0)
  ok('a winning team index is valid (0..3)', badWinner === 0)
  ok('matches terminate in bounded ticks (no runaway sim)', maxTicks < 100_000)
  ok("the sim isn't degenerate (some won, some lost)", victories > 0 && victories < N)
}

// ── mods bite the outcome (fixed seeds → a stable, real signal) ─────────────
{
  const paper: MatchMods = { guardHpMult: 0.1, spikeDmgMult: 3, yieldMult: 1 }
  const tank: MatchMods = { guardHpMult: 20, spikeDmgMult: 0.2, yieldMult: 1 }
  let paperWins = 0, tankWins = 0
  for (let seed = 1; seed <= 120; seed++) {
    if (runMatch(doc, seed, paper).victory) paperWins++
    if (runMatch(doc, seed, tank).victory) tankWins++
  }
  ok('paper guards let more challengers take the vault than tanky guards', paperWins > tankWins)
  ok('tanky guards do hold the line sometimes', tankWins < 120)
}

// ── yieldMult scales the harvest for a FIXED outcome ────────────────────────
{
  // same seed + same combat mods → same match; only the yield scalar differs,
  // so the harvest must scale with it (no outcome entanglement here)
  const seed = 42
  const base: MatchMods = { guardHpMult: 1, spikeDmgMult: 1, yieldMult: 1 }
  const rich: MatchMods = { guardHpMult: 1, spikeDmgMult: 1, yieldMult: 2 }
  const a = runMatch(doc, seed, base)
  const b = runMatch(doc, seed, rich)
  ok('same combat mods → same outcome regardless of yieldMult', a.deepest === b.deepest && a.victory === b.victory)
  ok('a higher yieldMult never harvests less', b.manaYield >= a.manaYield)
}

console.log(`\nSIM runMatch: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
