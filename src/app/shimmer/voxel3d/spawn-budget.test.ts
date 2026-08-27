// The spawn budget's oracle. Run: npx tsx src/app/shimmer/voxel3d/spawn-budget.test.ts
//
// ★ THE PROPERTY: **the sweep must not be able to own a frame, for ANY reason.** Every assert below
// asks that, from a direction that the 2026-08-23 measurement proved was reachable in the real game.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  stopScan, SPAWN_SCAN_MAX, SPAWN_BUDGET_MS,
  mayStartColdField, COLD_FIELDS_PER_SWEEP, COLD_FIELD_MS, sweepCeilingMs,
} from './spawn-budget'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. ★★ EITHER LIMIT STOPS IT, AND THEY FAIL DIFFERENTLY ─────────────────────────────────────
{
  ok(stopScan(0, 0) === false, 'a fresh sweep is allowed to start')
  ok(stopScan(SPAWN_SCAN_MAX - 1, 0) === false, 'one column under the count still runs')
  ok(stopScan(SPAWN_SCAN_MAX, 0) === true, `★★ the COUNT alone stops the sweep (${SPAWN_SCAN_MAX})`)
  ok(stopScan(0, SPAWN_BUDGET_MS) === true, `★★ the CLOCK alone stops it (${SPAWN_BUDGET_MS}ms)`)
  ok(stopScan(0, SPAWN_BUDGET_MS - 0.001) === false, 'and not one tick early')

  // ★★★ THE ONE THAT MATTERS: a single pathological column must not be able to blow the frame while
  // the COUNT still looks healthy. An uncached light field measured ~14.4ms on its own — five times
  // the whole budget — so a count-only limit would have let one column do it.
  ok(stopScan(1, 14.4) === true,
    '★★★ ONE expensive column trips the clock even at count 1 — a count-only bound would not have')
}

// ── 2. ★★ THE BUDGET IS SMALLER THAN A FRAME, WHICH IS THE ENTIRE POINT ────────────────────────
// A "budget" of 20ms on a 16.7ms frame is not a budget, it is a rounding error with a constant name.
{
  ok(SPAWN_BUDGET_MS < 16.7,
    `★★★ the sweep's ceiling is under one 60fps frame (${SPAWN_BUDGET_MS}ms) — otherwise it is decoration`)
  ok(SPAWN_BUDGET_MS * 4 < 16.7,
    `★★ and leaves most of the frame to everything else (${SPAWN_BUDGET_MS}ms of 16.7)`)
  ok(SPAWN_SCAN_MAX > 0 && SPAWN_SCAN_MAX < 273,
    `★ the scan cap is a real cap — below the ~273 columns the measured stall walked (${SPAWN_SCAN_MAX})`)
}

// ── 3. ★★★ THE MEASURED STALL IS NOW IMPOSSIBLE — asserted against the real number ─────────────
// 137.5ms in one frame, ~273 columns, ~500µs per column. Replay that cost against the predicate and
// show it stops early. ⚠ This is the regression test: if someone raises either limit far enough to
// re-admit that frame, this goes red with the original measurement in the message.
{
  const PER_COLUMN_MS = 137.5 / 273        // the measured cost, not an invented one
  let examined = 0, elapsed = 0
  while (!stopScan(examined, elapsed)) { examined++; elapsed += PER_COLUMN_MS }
  ok(elapsed < 16.7,
    `★★★ replaying the REAL 2026-08-23 stall (${PER_COLUMN_MS.toFixed(3)}ms/column) stops at ` +
    `${elapsed.toFixed(1)}ms instead of 137.5 — under one frame`)
  ok(examined < 273, `★★ and it stops after ${examined} columns, not all 273`)
}

// ── 3b. ★★★ THE ASSERT SECTION 3 COULD NOT MAKE: A LOOP WHERE ONE ITERATION IS ENORMOUS ────────
// Section 3 above replays the 2026-08-23 stall at a UNIFORM 0.504ms per column, and under a uniform
// cost the top-of-loop check is genuinely enough — the overshoot is one cheap iteration. **So it
// passed, correctly, about a loop that was not the one shipping.** The real body had one call that
// cost hundreds of times the others, and a check evaluated BEFORE the body cannot bound a call that
// begins after it. Nothing on a single thread preempts a synchronous call.
//
// ⚠ THIS IS THE SAME SHAPE AS THE SEAM ORACLE THE SAME NIGHT: an assert that was accurate, was not
// weak, and simply did not constrain the axis that broke. Ask of any passing guard what the
// cheapest wrong answer is that still satisfies it. Here it was *"make one column cost 118ms."*
{
  const CHEAP_MS = 0.05          // a warm column: a map hit, some arithmetic, two dice
  /** A faithful mini-model of the host sweep: the clock is checked at the TOP, and the body pays. */
  const sweep = (coldCost: number, gate: boolean) => {
    let examined = 0, elapsed = 0, cold = 0
    for (let i = 0; i < 500; i++) {
      if (stopScan(examined, elapsed)) break
      // Worst case on purpose: every column cold, which is exactly a freshly-loaded night.
      if (gate) { if (!mayStartColdField(cold, elapsed)) continue }
      else if (cold >= 2) continue          // the old rule: an inline `lightBudget = 2`, no clock
      cold++
      elapsed += coldCost                   // ← the call nothing could interrupt
      examined++
      elapsed += CHEAP_MS
    }
    return { elapsed, cold }
  }

  // ── ⚠⚠ AND MODELLING IT CORRECTED THE DIAGNOSIS, WHICH IS WHY THE MODEL WAS WORTH WRITING ────
  // The hand-off note read the 118.60ms frame as *"lightBudget=2 ⇒ ~59ms per cold field"* — two
  // fields, halved. This model says that cannot happen: after ONE field `elapsed` is ~118 and the
  // top-of-loop `stopScan` breaks immediately, so the old rule admitted exactly one however high
  // `lightBudget` was set. **The count limit was never what let the cost in.** Confirmed from the
  // other side by direct measurement of the untabulated field: 113.16ms median on a server CPU
  // against the profile's 118.60ms. One call, not two — and the arithmetic that produced "59"
  // was an inference from a limit that was not binding.
  //
  // ★ IT ALSO MOVES THE FIX. If two fields were the problem, lowering the count fixes it; since one
  // field was, only making the field cheap does — which is what the tabulation is for. The gate
  // below is the belt, not the braces.
  const before = sweep(118, false)
  ok(before.elapsed > 100 && before.cold === 1,
    `★★★ the OLD rule reproduces Alex's 2026-08-27 frame — ${before.elapsed.toFixed(1)}ms from ` +
    `${before.cold} cold field, against a "budget" of ${SPAWN_BUDGET_MS}ms whose docstring said ` +
    'a single pathological column could not blow the frame. It could, and it was the only one that did.')

  // The same sweep under the new rule, at the same per-field cost, and at the stated ceiling.
  for (const cost of [59, COLD_FIELD_MS, 200]) {
    const after = sweep(cost, true)
    ok(after.cold <= COLD_FIELDS_PER_SWEEP,
      `★★ at ${cost}ms/field the sweep admits ${after.cold} cold field(s), never more than ${COLD_FIELDS_PER_SWEEP}`)
    ok(after.elapsed <= SPAWN_BUDGET_MS + cost,
      `★★★ the worst frame is budget + ONE admitted field and no more — ${after.elapsed.toFixed(1)}ms ` +
      `at ${cost}ms/field. This is the bound the module can state; the old one was a promise.`)
  }

  // ★ AND THE STATED CEILING MUST BE THE ONE THAT ACTUALLY HOLDS at the measured cost — a ceiling
  // nothing checks is the docstring bug wearing a constant's name.
  ok(sweep(COLD_FIELD_MS, true).elapsed <= sweepCeilingMs(),
    `★★★ sweepCeilingMs() = ${sweepCeilingMs()}ms actually bounds the modelled sweep`)
  ok(sweepCeilingMs() < 123.4,
    `★★ and the ceiling is well under the 123.4ms frame that prompted it (${sweepCeilingMs()}ms)`)

  // The gate must be a gate: once the walk's clock is spent, no new field may START.
  ok(mayStartColdField(0, 0) === true, 'a fresh sweep may compute its one field')
  ok(mayStartColdField(COLD_FIELDS_PER_SWEEP, 0) === false, '★★ the count alone refuses a second field')
  ok(mayStartColdField(0, SPAWN_BUDGET_MS) === false,
    '★★★ the CLOCK alone refuses a field the sweep has no room to finish — the check the old loop ' +
    'never made, because it only ever asked at the top of the iteration')
}

// ── 4. ★★★ THE HOST ACTUALLY ASKS — a predicate nothing calls is decoration ─────────────────────
// ⚠ A textual scan of a file this module does not own, so it BLIND-CHECKS first: a regex that
// matches nothing reports "no problem" and is indistinguishable from a clean read.
{
  const host = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  const code = host.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  ok(code.length > 100_000,
    `★★★ BLIND CHECK: read ${code.length} chars of VoxelWorld.tsx — a short read means the scan lost its subject`)
  ok(/stopScan\(/.test(code), '★★★ the sweep actually CALLS stopScan — an unused budget bounds nothing')
  ok(/break/.test(code.slice(code.indexOf('stopScan('), code.indexOf('stopScan(') + 120)),
    '★★ and BREAKS on it rather than merely computing it')
  // ★ The sub-zones must survive too — they are how the next capture names the slow line.
  for (const z of ['world:spawn/light', 'world:spawn/mesh']) {
    ok(code.includes(`mark('${z}')`), `★ the ${z} sub-zone is still marked`)
  }
  // ⚠ Flat marks: each sub-zone must RE-OPEN the parent, or everything after it is misattributed.
  ok((code.match(/mark\('world:spawn'\)/g) ?? []).length >= 3,
    '★★★ each sub-zone re-opens world:spawn — marks are flat, so a sub-zone that never closes ' +
    'silently bills the rest of the frame to itself')

  // ── ★★★ AND THE GATE MUST BE ON THE EXPENSIVE CALL, NOT MERELY IMPORTED ──────────────────────
  ok(/mayStartColdField\(/.test(code),
    '★★★ the sweep asks before starting a cold light field — the top-of-loop check cannot bound ' +
    'a call that begins after it')
  ok(!/\blightBudget\b/.test(code),
    '★★ the old inline `lightBudget` literal is gone — a term of the frame ceiling living as a ' +
    'bare number inside a 9,000-line component is a term nobody can check')

  // ★★★ THE TABULATION REGRESSION GUARD, and it is the one with the measurement behind it.
  // `openToSky` is asked once per cell of the sky seed. Pointing it at `columnHeight` regenerates
  // multi-octave terrain noise tens of thousands of times to answer 2,304 distinct questions:
  // measured 113.16ms live against 12.98ms from a 48×48 table, holding everything else identical,
  // byte-identical output across 10 fields. The cost is invisible at the call site — it is one
  // short arrow function that reads like a comparison — so it needs a guard that reads the line.
  // ⚠⚠ THIS PATTERN WAS `/openToSky:[^,\n]*/` AND IT COULD NOT FAIL. The predicate it has to read
  // is `openToSky: (x, z, y) => y > columnHeight(x, z, SEED),` — which is FULL OF COMMAS, so a
  // comma-terminated match captured `openToSky: (x` and stopped, three characters before the only
  // token the assert is looking for. Restoring the 113ms bug left it green. Caught by mutating,
  // never by running. **A guard's own delimiter is part of its subject: check that the text it
  // captures actually contains the thing you are about to search for.**
  const sky = code.match(/openToSky:.*$/gm) ?? []
  ok(sky.length > 0, '★ BLIND CHECK: found the openToSky predicate at all (a regex that matches ' +
    'nothing reports no problem and reads exactly like a clean file)')
  ok(sky.some(l => l.includes('=>')), '★ BLIND CHECK: and captured a whole arrow function, not a ' +
    'prefix of one — a truncated capture searches text the subject was never in')
  ok(sky.every(l => !/columnHeight\(/.test(l)),
    `★★★ the sky seed reads a TABLE, not generated terrain per cell — ${sky.join(' | ')}`)
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the spawn sweep cannot own a frame — ${pass} passed`)
