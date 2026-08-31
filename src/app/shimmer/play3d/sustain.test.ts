// ── Sustained casting — headless oracle ────────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/sustain.test.ts
//
// The three rules in `sustain.ts` are each a bug that would not look like one from outside, so each
// gets asserted from the direction the bug would actually enter:
//   1. time credited only for mana PAID — otherwise an empty keeper finishes the same bore for free
//   2. the last, partial second is bought and credited in proportion — no rounding gift or theft
//   3. cooldown runs from RELEASE — otherwise holding is strictly better than tapping, silently

import { castForMove, type CastArchetype } from './cast'
import { resolveCast, type CastEnv } from '../engine/cast-dispatch'
import { beginSustain, sustainStep, sustainCooldownUntil, type Sustain } from './sustain'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

const DRAIN = 4 // mana/sec

/** Run a channel frame by frame against a finite pool, the way a host would. */
function run(pool: number, dt: number, frames: number, drain = DRAIN) {
  let s: Sustain = beginSustain(0, 'test-move')
  let mana = pool, ended: string | null = null, spent = 0
  for (let i = 0; i < frames && !ended; i++) {
    const step = sustainStep(s, dt, mana, drain)
    s = step.sustain; mana -= step.manaSpent; spent += step.manaSpent; ended = step.ended
  }
  return { s, mana, ended, spent }
}

// ── 1. ★★★ time is only credited for mana actually paid ────────────────────────────────────────
{
  const pool = 10
  const r = run(pool, 0.1, 1000)
  chk('a channel ends when the pool runs out', r.ended === 'dry')
  chk('★★★ it holds for exactly what it could afford, not a frame longer',
    near(r.s.held, pool / DRAIN), `held ${r.s.held} vs affordable ${pool / DRAIN}`)
  chk('★ it spends the whole pool and not a drop more',
    near(r.spent, pool) && near(r.mana, 0), `spent ${r.spent}, left ${r.mana}`)
  chk('paid tracks what was actually spent', near(r.s.paid, r.spent))

  // ★★ THE BUG THIS RULE EXISTS FOR, ASSERTED AS A COMPARISON. A keeper with twice the mana must
  // get twice the channel. If time were credited on wall-clock instead of payment, these would be
  // equal and a dry keeper would bore the same hole for free.
  const rich = run(20, 0.1, 1000)
  chk('★★ twice the pool buys twice the channel — time is bought, not elapsed',
    near(rich.s.held, r.s.held * 2), `${rich.s.held} vs ${r.s.held}`)
  chk('...and a keeper with no mana at all gets no channel',
    run(0, 0.1, 10).s.held === 0 && run(0, 0.1, 10).ended === 'dry')

  // ⚠⚠ A POOL THAT DIVIDES EVENLY BARELY EXERCISES THE PARTIAL FRAME, AND THE SWEEP SAID SO. With
  // pool 10 / drain 4 / dt 0.1 the mana lands on exactly 0 after 25 whole frames, so the last
  // partial step is reached only by a floating-point remainder — the wall-clock mutation was caught
  // by a rounding crumb rather than by the rule. An assert that fires by accident is one bad
  // refactor away from firing never. This pool cannot divide: 10 / (4 * 0.3) = 8.33 frames.
  const ragged = run(10, 0.3, 1000)
  chk('★★ a pool that does NOT divide evenly still buys exactly what it paid for',
    near(ragged.s.held, 10 / DRAIN), `held ${ragged.s.held} vs affordable ${10 / DRAIN}`)
  chk('★★ ...and the ragged last frame is shorter than a whole one, not equal to it',
    ragged.s.held % 0.3 !== 0 && near(ragged.spent, 10),
    `held ${ragged.s.held}, spent ${ragged.spent}`)
}

// ── 2. the last partial frame ──────────────────────────────────────────────────────────────────
{
  // 1 mana left, a frame that wants 4 * 0.5 = 2. Affordable share is 0.25s.
  const step = sustainStep(beginSustain(0, 'm'), 0.5, 1, DRAIN)
  chk('a frame the pool cannot cover still runs, partially', step.credited > 0)
  chk('★ it credits exactly the affordable fraction, no gift',
    near(step.credited, 0.25), String(step.credited))
  chk('★ ...and no theft — it spends exactly what was left', near(step.manaSpent, 1))
  chk('...and ends dry on that same frame, not the next', step.ended === 'dry')
  chk('the credited time and the mana spent agree with the rate',
    near(step.manaSpent, step.credited * DRAIN))

  const full = sustainStep(beginSustain(0, 'm'), 0.5, 999, DRAIN)
  chk('an affordable frame credits the whole step', near(full.credited, 0.5))
  chk('...and bills the whole step', near(full.manaSpent, 0.5 * DRAIN))
  chk('...and does not end', full.ended === null)
}

// ── 3. the cooldown runs from release ──────────────────────────────────────────────────────────
{
  chk('★ cooldown is measured from the moment it STOPPED',
    sustainCooldownUntil(5000, 800) === 5800)
  // ⚠ The bug is invisible unless you compare two channel LENGTHS. Held ten seconds or one, the
  // recovery must land the same distance after the release — never the same distance after the press.
  const shortHold = sustainCooldownUntil(1000 + 500, 800)
  const longHold = sustainCooldownUntil(1000 + 9000, 800)
  chk('★★ a long hold does not get its recovery for free — release, not press',
    longHold - shortHold === 8500, `${longHold} vs ${shortHold}`)
}

// ── 4. the fail-closed edges ───────────────────────────────────────────────────────────────────
{
  const s = beginSustain(2, 'm')
  chk('a fresh channel has held nothing and paid nothing', s.held === 0 && s.paid === 0)
  chk('...and remembers its slot and move', s.slot === 2 && s.moveId === 'm')

  chk('★ a move with NO drain breaks the channel rather than running it free',
    sustainStep(s, 0.5, 999, 0).ended === 'broken')
  chk('...and a negative drain likewise', sustainStep(s, 0.5, 999, -3).ended === 'broken')
  chk('...spending nothing on the way out',
    sustainStep(s, 0.5, 999, 0).manaSpent === 0 && sustainStep(s, 0.5, 999, 0).credited === 0)

  chk('a stalled frame changes nothing and does not end the channel',
    sustainStep(s, 0, 999, DRAIN).ended === null && sustainStep(s, 0, 999, DRAIN).credited === 0)
  chk('a backwards frame cannot rewind a channel', sustainStep(s, -1, 999, DRAIN).credited === 0)
  chk('a NaN frame credits nothing rather than poisoning held',
    Number.isFinite(sustainStep(s, Number.NaN, 999, DRAIN).sustain.held))
  chk('a NaN pool ends the channel rather than running on a false compare',
    sustainStep(s, 0.5, Number.NaN, DRAIN).ended === 'dry')

  // Purity: a host may run this twice (predict, then commit) and must get the same answer.
  const a = sustainStep(s, 0.3, 50, DRAIN), b = sustainStep(s, 0.3, 50, DRAIN)
  chk('★ pure — the same inputs give the same outcome, and the input is untouched',
    a.credited === b.credited && a.manaSpent === b.manaSpent && s.held === 0)
}

// ── 5. the contract, and the honest state of its first user ────────────────────────────────────
{
  chk('the spec carries a per-second drain, not a lump price',
    'sustainDrain' in castForMove('mend'))
  // ── ★★ THIS BLOCK WAS INVERTED 2026-08-31 (hub) WHEN MELTBORE SHIPPED, AND THE INVERSION IS THE
  // POINT. It used to assert that NO move sustains and that meltbore stays `unbuilt` — both true
  // when written, both false within the day. A red that only means "the world moved on" is the
  // exact thing that trains a room to discount red, so the asserts were re-aimed at the new truth
  // rather than deleted. What they guard is unchanged: that this hook has a real first user and
  // that nobody quietly widened the move to make a red go away.
  const mb = castForMove('meltbore')
  chk('★ meltbore is the hook\'s first user — a channel, not a hopeful comment',
    mb.archetype === 'channel')
  chk('★ ...and it bills by the second, or it is a channel in name only',
    mb.sustainDrain > 0, `sustainDrain ${mb.sustainDrain}`)

  // ⚠ THE PRESS AND THE HOLD ARE DIFFERENT PRICES AND MUST BOTH EXIST. A channel with the whole
  // cost on `manaCost` is a normal cast with a long animation — releasing early would refund
  // nothing and holding longer would cost nothing, so TIME, the resource canon actually spends,
  // would not be spent at all. This is the assert that catches that being flattened later.
  chk('★ the press is cheap and the hold is where the price lives',
    mb.manaCost > 0 && mb.sustainDrain > mb.manaCost,
    `press ${mb.manaCost}, drain ${mb.sustainDrain}/s`)

  // ⚠⚠ AND THE ONE THAT COULD NOT BE WRITTEN UNTIL THERE WAS A HOST: a channel whose cooldown is
  // started at the PRESS makes a ten-second hold recover as fast as a tap. `cast-dispatch` must
  // return `cooldownUntil: null` for it, and the host must start the clock on release. Asserted
  // through the dispatcher rather than by reading the file, so it fails if the case is ever folded
  // back into the placed `default:` branch.
  {
    const env: CastEnv = {
      now: 1000, hp: 10, hpMax: 10, mana: 100, cooldownUntil: [0, 0, 0, 0],
      stanceMoveId: null, supports: new Set<CastArchetype>(['channel']),
    }
    const out = resolveCast(0, ['meltbore', null, null, null], env)
    chk('★★ a channel starts NO cooldown at the press — rule 3 lives in the host',
      out.kind === 'applied' && out.cooldownUntil === null,
      out.kind === 'applied' ? `cooldownUntil ${out.cooldownUntil}` : out.kind)
    chk('★ ...and the press still charges its own price',
      out.kind === 'applied' && out.manaCost === mb.manaCost)
    // The release instant decides the recovery, so the same channel held twice as long recovers at
    // two different moments. A cooldown read off the press cannot tell those apart.
    chk('★ ...and the cooldown is measured from the RELEASE',
      sustainCooldownUntil(5000, mb.cooldownMs) === 5000 + mb.cooldownMs
      && sustainCooldownUntil(9000, mb.cooldownMs) !== sustainCooldownUntil(5000, mb.cooldownMs))
  }
}

console.log(`\nsustain oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
