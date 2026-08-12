// Run: npx tsx src/app/shimmer/engine/collar-foes.test.ts
//
// Two things are guarded here and they are not the same kind of thing.
//
// The first is CANON, and it is the one that would do real damage: this class has no health, cannot
// die, and stops being a target the instant its collar comes off. A change that quietly gave a
// collared Moglin a wounded state, or let a freed one re-arm, would contradict a fact already
// printed in the books — and it would do it silently, because the fight would still "work".
//
// The second is the TRIANGLE. Three foes that differ only in integrity are one foe with three bars.
// hollows.ts had to fight for that rule once already; asserting it here is what stops a balance pass
// converging them back into each other.

import {
  COLLAR_FOES, POSTURE_ORDER, foeDef, pickPosture, spawnFoe, strike, hostile, collarFrac,
  type FoePosture,
} from './collar-foes'
import { TIER_DIALS } from '../play3d/collar-raid'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

// ── 1. Alex's numbers, verbatim ─────────────────────────────────────────────────────────────────
{
  check('the road-blocker carries 175', COLLAR_FOES.bulwark.integrity === 175)
  check('the one that presses from range carries 125', COLLAR_FOES.channeler.integrity === 125)
  check('the fast one carries 100', COLLAR_FOES.skirmisher.integrity === 100)
}

// ── 2. ★ CANON: NO DEATH, NO WOUNDED STATE, NO RE-ARM ──────────────────────────────────────────
{
  const f = spawnFoe('m1', 'bulwark', 0, 0)
  check('a spawned foe starts at a full collar', f.collar?.integrity === 175 && f.collar?.max === 175)
  check('and is hostile while collared', hostile(f))

  const part = strike(f, 100)
  check('a partial strike weakens the collar', part.foe.collar?.integrity === 75)
  check('and does not free him yet', !part.freed && hostile(part.foe))

  const done = strike(part.foe, 75)
  check('★ emptying the collar frees him', done.freed && done.foe.collar === null)
  // ★ The whole canon payoff: he is simply the sweet creature again. No corpse, no HP, no phase two.
  check('★ a freed Moglin is never hostile again', !hostile(done.foe))
  check('★ and has no bar left to draw', collarFrac(done.foe) === 0)

  // ⚠ RE-STRIKING A FREED ONE MUST BE A NO-OP, not a re-arm. Canon gives nothing here to model, so
  // the only wrong answer is a second collar appearing out of a stray damage tick.
  const again = strike(done.foe, 999)
  check('★ striking a freed Moglin does nothing at all', !again.freed && again.foe.collar === null)

  // Overkill frees exactly once and does not go negative — a caller firing the deflate off `freed`
  // must never see it twice.
  const one = strike(spawnFoe('m2', 'skirmisher', 0, 0), 10_000)
  check('overkill frees on exactly one strike', one.freed && one.foe.collar === null)
  check('a zero strike changes nothing', !strike(spawnFoe('m3', 'bulwark', 0, 0), 0).freed)
}

// ── 3. ★ THE TRIANGLE IS A TRIANGLE ────────────────────────────────────────────────────────────
// Each posture must OWN an axis, not merely sit at a different point on one.
{
  const by = (k: keyof typeof COLLAR_FOES.bulwark) =>
    POSTURE_ORDER.map(p => COLLAR_FOES[p][k] as number)

  // ⚠ STRICTLY GREATER THAN THE OTHER TWO, not merely equal to the maximum.
  // This first read `Math.max(...vals) === COLLAR_FOES[p][k]`, which passes VACUOUSLY when every
  // posture shares a value: zeroing the channeler's standoff — turning it into a second melee foe,
  // exactly the convergence this block exists to prevent — left all three at 0 and the assert stayed
  // green. Caught by mutation, not by reading. Owning an axis means being alone at the top of it.
  const maxAt = (k: keyof typeof COLLAR_FOES.bulwark, p: FoePosture) => {
    const mine = COLLAR_FOES[p][k] as number
    return POSTURE_ORDER.every(q => q === p || (COLLAR_FOES[q][k] as number) < mine)
  }
  check('★ the bulwark owns toughness AND body — it is the wall',
    maxAt('integrity', 'bulwark') && maxAt('body', 'bulwark'))
  check('★ the channeler owns reach and standoff — it is the reason to close',
    maxAt('reach', 'channeler') && maxAt('standoff', 'channeler'))
  check('★ the skirmisher owns speed — it is the reason not to stand still',
    maxAt('speed', 'skirmisher'))

  // And the frail one is genuinely frail: the cheapest to free is what makes triage a choice.
  check('★ the fastest is also the cheapest to free',
    COLLAR_FOES.skirmisher.integrity === Math.min(...by('integrity')))

  // No two postures may share an entire profile — the converge-check.
  const sig = (p: FoePosture) => JSON.stringify(COLLAR_FOES[p])
  check('no two postures are the same foe', new Set(POSTURE_ORDER.map(sig)).size === 3)

  // ⚠ Nothing may out-run a keeper, or walking away stops being an answer. Voxel run speed is 22
  // units/s; even the drained floor (locomotion DRAINED_SPEED 4.2) must beat the fastest posture.
  check('★ nothing out-runs even a drained keeper', Math.max(...by('speed')) < 4.2)
}

// ── 4. ★ THE TWO AXES MUST NOT SILENTLY MERGE ──────────────────────────────────────────────────
// collar-raid.ts tiers integrity by WHAT IS AT STAKE (70/120/200, canon-anchored). This file tiers
// by HOW ONE FIGHTS. They describe different encounters; if someone ever multiplies them, difficulty
// is counted twice. Asserting they are separate tables is the cheapest way to notice that happening.
{
  const raidValues = [TIER_DIALS.base.integrity, TIER_DIALS.second.integrity, TIER_DIALS.awakened.integrity]
  const patrolValues = POSTURE_ORDER.map(p => COLLAR_FOES[p].integrity)
  check('★ patrol integrity is its own table, not the raid tiers',
    JSON.stringify(raidValues) !== JSON.stringify(patrolValues))
  check('the raid tiers are untouched by this file',
    TIER_DIALS.base.integrity === 70 && TIER_DIALS.second.integrity === 120 && TIER_DIALS.awakened.integrity === 200)
}

// ── 5. the weighted pick ────────────────────────────────────────────────────────────────────────
{
  check('roll 0 takes the first posture', pickPosture(0) === POSTURE_ORDER[0])
  check('roll 1 is clamped, never undefined', POSTURE_ORDER.includes(pickPosture(1)))
  check('a negative roll is clamped too', POSTURE_ORDER.includes(pickPosture(-3)))
  const seen = new Set<FoePosture>()
  for (let i = 0; i < 200; i++) seen.add(pickPosture(i / 200))
  check('every posture is reachable', seen.size === 3)
  check('foeDef agrees with the table', foeDef('channeler') === COLLAR_FOES.channeler)
}

console.log(`\ncollar foes: ${pass} passed, ${fail} failed`)
if (fail === 0) console.log('✅ a collar to break, never a body to kill')
process.exit(fail === 0 ? 0 : 1)
