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
  COLLAR_FOES, POSTURE_ORDER, foeDef, pickPosture, spawnFoe, strike, hostile, collarFrac, stepFoe, answerCollar, LEAVING_SPEED,
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

// ── 6. the approach (2026-08-16, #294) ──────────────────────────────────────────────────────────
{
  const at = (p: FoePosture, x: number, z: number) => spawnFoe(`t-${p}`, p, x, z)
  const KEEPER = { px: 0, pz: 0 }

  // ★★ THE RULING, NOT A BALANCE NUMBER — AND IT CHANGED ON 2026-08-16. This first asserted that a
  // freed Moglin goes completely INERT, which I filed as a placeholder and canon then refused:
  // *"the only thing that separates this from a nicer collar is that he can go… the exit is not a
  // courtesy feature. It is the canon. Build it and never hide it."* A Moglin standing frozen on
  // the road forever is the build quietly keeping him. He walks off.
  const freed = strike(at('skirmisher', 5, 0), 999).foe
  const fi = stepFoe(freed, KEEPER, 0.1)
  check('★★ a freed Moglin never presses again', !fi.pressing)
  check('★★ and he LEAVES — the exit is canon, not a courtesy', fi.moveTo !== null)
  check('★ away from the keeper, not toward them',
    (fi.moveTo?.x ?? 0) > 5, `moved to ${fi.moveTo?.x?.toFixed(3)} from 5`)
  // ⚠ Leaving is a walk, not a rout. Canon's beat is deflation; a freed Moglin sprinting away reads
  // as fear, and the line's whole point is that he was never the frightening one.
  const gone = Math.hypot((fi.moveTo?.x ?? 5) - 5, fi.moveTo?.z ?? 0)
  check('at a leaving pace, slower than he fought at',
    Math.abs(gone - LEAVING_SPEED * 0.1) < 1e-9 && LEAVING_SPEED < COLLAR_FOES.skirmisher.speed,
    `${gone.toFixed(3)} in 0.1s`)

  // The channeler holds its line instead of closing, and presses from it — reach 8 > standoff 7 is
  // what makes "hold still and lean on you" a behaviour rather than a stalemate.
  const ch = at('channeler', 7, 0)
  const chI = stepFoe(ch, KEEPER, 0.5)
  check('the channeler holds its standoff', chI.moveTo === null)
  check('★ and presses from it — reach outlives standoff', chI.pressing)
  const chFar = stepFoe(at('channeler', 40, 0), KEEPER, 0.5)
  check('but from far off it closes and does not press', !!chFar.moveTo && !chFar.pressing)
  check('and it closes toward the keeper, never away',
    (chFar.moveTo?.x ?? 99) < 40, `moved to ${chFar.moveTo?.x}`)

  // ⚠ Nothing may end up INSIDE the keeper. standoff 0 means "come all the way", not "occupy them".
  let bul = at('bulwark', 12, 0)
  for (let i = 0; i < 400; i++) {
    const it = stepFoe(bul, KEEPER, 0.05)
    if (it.moveTo) bul = { ...bul, x: it.moveTo.x, z: it.moveTo.z }
  }
  const rest = Math.hypot(bul.x, bul.z)
  check('★ a standoff-0 foe stops AT the keeper, never inside them',
    rest >= COLLAR_FOES.bulwark.body, `rested at ${rest.toFixed(3)}`)
  check('and it did arrive — a blockade that never blocks is scenery', rest < 2)
  check('and it presses once it is there', stepFoe(bul, KEEPER, 0.05).pressing)

  // A step never overshoots the line it is closing to, at any dt the frame loop can hand it.
  const over = stepFoe(at('skirmisher', 3, 0), KEEPER, 5)
  check('★ a long frame cannot overshoot the keeper', (over.moveTo?.x ?? -1) >= 0)

  // ⚠ The wall case. A foe that stops dead on its first obstacle reads as a failed spawn.
  const wallAt5 = (x: number, _z: number) => x > 4.5 && x < 5.5
  const blocked = stepFoe(at('skirmisher', 5.6, 3), { ...KEEPER, blocked: wallAt5 }, 0.2)
  check('★ a blocked foe slides along the wall rather than parking on it',
    blocked.moveTo !== null && Math.abs((blocked.moveTo?.x ?? 0) - 5.6) < 1e-9,
    'x is held by the wall, z is free to slide')

  // ★ Pressing is billed from where it STANDS. Otherwise a foe presses you through a wall it never
  // got around — the fight would resolve on the far side of geometry the player is using correctly.
  // ⚠ THE DISTANCE HAS TO BE CHOSEN SO THE TWO ANSWERS DIFFER. A walled foe 30 blocks out is not
  // pressing under either rule, so that version of this assert was green for the wrong reason and
  // survived the mutation. Here the step it WANTS would carry it from 1.5 (outside reach 0.85) to
  // 0.71 (inside), while the wall means it never actually goes anywhere.
  const sealed = () => true
  const stuck = stepFoe(at('skirmisher', 1.5, 0), { ...KEEPER, blocked: sealed }, 0.3)
  check('★ a walled-off foe cannot press you from where it merely WANTED to be',
    stuck.moveTo === null && !stuck.pressing)

  // Speed is honoured — the defs bound it so nothing out-runs a keeper, and the stepper must not
  // quietly exceed the number that guarantee rests on.
  const sk = at('skirmisher', 20, 0)
  const one = stepFoe(sk, KEEPER, 0.1)
  const moved = Math.hypot((one.moveTo?.x ?? 20) - 20, (one.moveTo?.z ?? 0))
  check('a step is exactly speed x dt', Math.abs(moved - COLLAR_FOES.skirmisher.speed * 0.1) < 1e-9,
    `moved ${moved.toFixed(4)}`)
}

// ── 7. what a round does to a collar (2026-08-16, #294) ─────────────────────────────────────────
{
  const collared = spawnFoe('a', 'bulwark', 3, 0)
  const freed = strike(spawnFoe('b', 'bulwark', 3, 0), 999).foe

  // ★★ THE RULE THE WHOLE REGION-COMBAT DESIGN RESTS ON. Canon forbids guns to answer this class:
  // you free a person, and a bullet cannot free anyone. If this ever goes green the wrong way,
  // "runes ARE the combat" quietly becomes "gun fights with a different bar".
  check('★★ a move that strikes the collar opens it', answerCollar(collared, 'opens') === 'opens')
  check('★★ lead does not', answerCollar(collared, 'lead') === 'refused-lead')

  // ⚠ TWO REFUSAL CLASSES, AND THEY ARE NOT INTERCHANGEABLE (ruled 2026-08-16). Class 1 is Rule 3 —
  // the body IS the described mechanism. Class 2 is thematic — the move IS the line's named evil,
  // and it catches moves that are perfectly gentle. **A move can pass Rule 3 cleanly and still fail
  // class 2**, so collapsing them into one "refused" would lose the distinction canon drew.
  check('★ cruelty is refused (class 1 — Rule 3)', answerCollar(collared, 'cruelty') === 'refused-cruelty')
  check('★ control is refused (class 2 — hypocrisy)', answerCollar(collared, 'control') === 'refused-control')
  check('★ and the two refusals are distinguishable',
    answerCollar(collared, 'cruelty') !== answerCollar(collared, 'control'))
  // Canon's verb is DEFEATING. A heal or a launch is a legitimate part of winning and never the
  // thing that opens a collar — delivery-agnostic was never "any cast counts".
  check('★ a move that never enters the contest cannot win it',
    answerCollar(collared, 'no-contest') === 'no-contest')

  // ★★ FAIL CLOSED. An unclassified move has never been checked against Rule 3, so it must not be
  // the thing that frees someone. Same shape as WILDS_SWALLOW_EXEMPT and focus_active's allowlist:
  // never let an unrecognised value land in the band that GRANTS permission.
  check('★★ an unclassified move is REFUSED, never allowed through',
    answerCollar(collared, undefined) !== 'opens')

  // ⚠ Refused is NOT the same as absent. Lead must STOP on a collared body — a round passing through
  // a person reads as a broken hitbox, and the player blames the game rather than their choice of
  // tool. A freed Moglin is the opposite: nothing there to answer.
  check('★ a freed pair is not a target at all', answerCollar(freed, 'opens') === 'not-a-target')
  check('and lead does not target them either', answerCollar(freed, 'lead') === 'not-a-target')
  check('★ refused and not-a-target are distinct answers',
    answerCollar(collared, 'lead') !== answerCollar(freed, 'lead'))
}

console.log(`\ncollar foes: ${pass} passed, ${fail} failed`)
if (fail === 0) console.log('✅ a collar to break, never a body to kill')
process.exit(fail === 0 ? 0 : 1)
