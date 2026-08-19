// The rinning-cast oracle. Run: npx tsx src/app/shimmer/engine/rin-cast.test.ts
//
// This file's real job is to hold ONE canon rule that is easy to delete by accident:
// **a missed answer costs nothing.** Canon rules rinning has no minigame *because* "you are asking
// a rinn, not tricking one", so the moment a miss removes a fish, the build is contradicting a
// ruled reason — and it would look like ordinary tuning in a diff. §2 is that rule, held four ways.

import {
  newCast, phaseAt, riseProgress, passed, answer,
  WAIT_MIN_MS, WAIT_MAX_MS, RISE_MS, TAKE_MS, REKINDLE, LIVELY_WAIT,
} from './rin-cast'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
/** Deterministic rng — a fixed sequence, so every timing below is reproducible. */
const rngOf = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

// ── 1. THE LOOP RUNS IN CANON'S ORDER: wait → rise → take ───────────────────────────────────────
{
  const c = newCast(0, rngOf([0.5]))
  const w = c.riseAt
  ok(phaseAt(c, 0) === 'waiting', 'a fresh cast is waiting')
  ok(phaseAt(c, w - 1) === 'waiting', 'still waiting right up to the rise')
  ok(phaseAt(c, w + 1) === 'rising', '★ the rise is its own phase — the tell exists')
  ok(phaseAt(c, w + RISE_MS - 1) === 'rising', 'the rise lasts its full length')
  ok(phaseAt(c, w + RISE_MS + 1) === 'taking', 'the take follows the rise')
  ok(phaseAt(c, w + RISE_MS + TAKE_MS - 1) === 'taking', 'the take window is open its full length')
}

// ── 2. ★★ THE CANON RULE: A MISSED ANSWER COSTS NOTHING ─────────────────────────────────────────
{
  const c = newCast(0, rngOf([0.5]))
  const afterTake = c.riseAt + RISE_MS + TAKE_MS + 1

  // (a) there is no losing phase in the type at all — the loop returns to waiting
  ok(phaseAt(c, afterTake) === 'waiting', '★★ an unanswered take returns to WAITING, not to a loss')
  ok(phaseAt(c, afterTake + 60_000) === 'waiting', '★★ and stays fishable indefinitely')

  // (b) answering late is simply false — it does not end or spoil the cast
  ok(answer(c, afterTake) === false, 'a late answer does not register')
  ok(phaseAt(c, afterTake) === 'waiting', '★★ ...and the cast survives it')

  // (c) answering EARLY is equally harmless — the classic "struck too soon, lost it" punishment
  ok(answer(c, 10) === false, 'an early answer does not register')
  ok(phaseAt(c, 10) === 'waiting', '★★ ...and striking early costs nothing either')

  // (d) the pass counter only ever SHORTENS the next wait — it is never read as a penalty
  const next = passed(c, afterTake, rngOf([0.5]))
  ok(next.passes === 1, 'a pass is counted')
  ok(next.riseAt < c.riseAt, '★★ a pass makes the next rise come SOONER, never later')
  const many = passed(passed(passed(next, 0, rngOf([0.5])), 0, rngOf([0.5])), 0, rngOf([0.5]))
  ok(many.riseAt <= next.riseAt * 1.001, '★★ repeated passes never lengthen the wait (no soft penalty)')
}

// ── 3. THE WAIT IS LONG, AND IT IS CANON'S KIND OF LONG ─────────────────────────────────────────
{
  const lo = newCast(0, rngOf([0])).riseAt
  const hi = newCast(0, rngOf([1])).riseAt
  ok(lo >= WAIT_MIN_MS, `the shortest wait is the floor (${lo})`)
  ok(hi <= WAIT_MAX_MS, `the longest wait is the ceiling (${hi})`)
  ok(WAIT_MIN_MS >= 4_000, `★ the wait is measured in seconds, not frames (${WAIT_MIN_MS}ms floor)`)
  // The old play3d cast bit at 900–3000ms. If someone ever tunes back to that, rinning has quietly
  // become a reaction test again with the same words on the tin.
  ok(WAIT_MIN_MS > 3_000, '★★ not the old 0.9–3.0s reaction cadence')
  ok(TAKE_MS >= 1_200, `★ the answer window is generous, not a reflex check (${TAKE_MS}ms)`)
  ok(TAKE_MS > RISE_MS / 2, 'the window is a real answer, not a frame-perfect tap')
}

// ── 4. THE TELL IS READABLE — it closes on the float, and only during the rise ──────────────────
{
  const c = newCast(0, rngOf([0.5]))
  const w = c.riseAt
  ok(riseProgress(c, w - 1) === 0, 'no rise-mark before the rise')
  ok(riseProgress(c, w + RISE_MS + 1) === 0, 'no rise-mark after the rise')
  const a = riseProgress(c, w + RISE_MS * 0.2)
  const b = riseProgress(c, w + RISE_MS * 0.8)
  ok(a > 0 && b > a && b < 1, `★ the rise closes on the float (${a.toFixed(2)} → ${b.toFixed(2)})`)
  ok(RISE_MS >= 1_500, `★★ the tell is long enough to NOTICE (${RISE_MS}ms) — the waiting is watched`)
}

// ── 5. LIVELY WATER RUNS SHORTER, AND QUIET WATER STILL FISHES ─────────────────────────────────
{
  const quiet = newCast(0, rngOf([0.5]), false)
  const live = newCast(0, rngOf([0.5]), true)
  ok(live.riseAt < quiet.riseAt, `★ lively water bites sooner (${live.riseAt} < ${quiet.riseAt})`)
  ok(live.riseAt >= WAIT_MIN_MS * LIVELY_WAIT, 'lively water is faster, not instant')
  ok(quiet.riseAt >= WAIT_MIN_MS, '★★ quiet water still runs a normal cast — it is not punished')
  // ⚠ Asserted directly rather than left to §3's ceiling: "lively is faster" and "quiet is slower"
  // are the same diff and opposite designs, and only this one names the rule it is protecting.
  ok(quiet.riseAt <= WAIT_MAX_MS, '★★ quiet water is not SECRETLY slower — lively is a bonus, not a tax')
  ok(passed(live, 0, rngOf([0.5])).lively === true, 'liveliness survives a pass')
}

// ── 6. PURE — same cast, same time, same answer, and nothing mutates ───────────────────────────
{
  const c = newCast(0, rngOf([0.5]))
  const snapshot = JSON.stringify(c)
  const t = c.riseAt + RISE_MS + 100
  ok(phaseAt(c, t) === phaseAt(c, t), 'phaseAt is pure')
  answer(c, t); riseProgress(c, t); passed(c, t, rngOf([0.5]))
  ok(JSON.stringify(c) === snapshot, '★ nothing mutates the cast in place')
  ok(REKINDLE > 0 && REKINDLE < 1, `REKINDLE is a real shortening (${REKINDLE})`)
}

console.log(fails.length ? `❌ ${fails.length} failed:\n  ${fails.join('\n  ')}` : `✅ you are asking a rinn, not tricking one — ${pass} passed`)
process.exit(fails.length ? 1 : 0)
