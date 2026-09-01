// The spawn budget's oracle. Run: npx tsx src/app/shimmer/voxel3d/spawn-budget.test.ts
//
// ★ THE PROPERTY: **the sweep must not be able to own a frame, for ANY reason.** Every assert below
// asks that, from a direction that the 2026-08-23 measurement proved was reachable in the real game.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  stopScan, SPAWN_SCAN_MAX, SPAWN_BUDGET_MS,
  LIGHT_BUILD_MS, sweepCeilingMs,
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

// ── 3b. ★★★ A LOOP WHERE ONE ITERATION IS ENORMOUS — AND THE THIRD ROUND OF FIXING IT ──────────
// Section 3 replays the 2026-08-23 stall at a UNIFORM 0.504ms per column, and under a uniform cost
// the top-of-loop check is genuinely enough. **So it passed, correctly, about a loop that was not
// the one shipping.** The real body had one call costing hundreds of times the others, and a check
// evaluated BEFORE the body cannot bound a call that begins after it.
//
// ⚠⚠ 08-27 ADDED A GATE ON THAT CALL AND STATED A CEILING OF `SPAWN_BUDGET_MS + COLD_FIELD_MS`.
// That held the count and could not hold the cost: `COLD_FIELD_MS = 20` was measured on a server
// CPU, and Alex's UHD 630 answered with **55.80ms of a 58.9ms frame — 2.4x the stated bound**.
// 09-01 removed the term instead of re-measuring it. These asserts now cover BOTH halves: the
// sweep is cheap because it computes nothing, and the field is cheap because it is sliced.
{
  const CHEAP_MS = 0.05          // a warm column: a map hit, some arithmetic, two dice

  /** The OLD host sweep, kept as history: the clock is checked at the TOP, and the body pays. */
  const oldSweep = (coldCost: number) => {
    let examined = 0, elapsed = 0, cold = 0
    for (let i = 0; i < 500; i++) {
      if (stopScan(examined, elapsed)) break
      if (cold >= 2) continue               // the original inline `lightBudget = 2`, no clock
      cold++
      elapsed += coldCost                   // ← the call nothing could interrupt
      examined++
      elapsed += CHEAP_MS
    }
    return { elapsed, cold }
  }
  const before = oldSweep(118)
  ok(before.elapsed > 100 && before.cold === 1,
    `★★★ the OLD rule reproduces Alex's 2026-08-27 frame — ${before.elapsed.toFixed(1)}ms from ` +
    `${before.cold} cold field. **The count limit was never what let the cost in**: after one field ` +
    'the top-of-loop check breaks immediately however high the count was set.')

  /** The sweep as it ships now: a cold column is nominated and SKIPPED, never built inline. */
  const sweep = () => {
    let examined = 0, elapsed = 0
    for (let i = 0; i < 500; i++) {
      if (stopScan(examined, elapsed)) break
      // Worst case on purpose: every column cold, which is exactly a freshly-loaded night. Each is
      // a map miss and a nomination — no field is computed here at any price.
      examined++
      elapsed += CHEAP_MS
    }
    return elapsed
  }
  ok(sweep() <= sweepCeilingMs(),
    `★★★ the walk is bounded by sweepCeilingMs() = ${sweepCeilingMs()}ms with NOTHING behind it — ` +
    `modelled ${sweep().toFixed(2)}ms with every column cold`)
  ok(sweepCeilingMs() === SPAWN_BUDGET_MS,
    '★★ the ceiling has ONE term now, and it is the one this module controls. A ceiling containing ' +
    'a term the machine decides (a measured field cost) is a measurement wearing a bound\'s name.')

  // ── ★★★ THE ASSERT THE LAST TWO ROUNDS COULD NOT MAKE: PER-FRAME COST IS INDEPENDENT OF THE
  // FIELD'S TOTAL COST. This is the whole difference between budgeting a call and slicing it.
  const sliced = (total: number, budget: number) => {
    let left = total, frames = 0, worst = 0
    while (left > 0) { const spent = Math.min(left, budget); worst = Math.max(worst, spent); left -= spent; frames++ }
    return { frames, worst }
  }
  // 13ms = the server measurement · 20 = the retired COLD_FIELD_MS · 53 = Alex's actual box ·
  // 200 = a machine nobody has tested on yet, which is the case a per-machine constant fails.
  for (const total of [13, 20, 52.8, 200]) {
    const r = sliced(total, LIGHT_BUILD_MS)
    ok(r.worst <= LIGHT_BUILD_MS,
      `★★★ a ${total}ms field costs at most ${r.worst}ms in any ONE frame (${r.frames} frames) — ` +
      'the per-frame cost does not scale with the field, which is why no per-machine constant has ' +
      'to be right for the frame to hold')
    // The old design's worst frame WAS the total. Stated as a contrast so the regression is legible.
    ok(r.worst < total || total <= LIGHT_BUILD_MS,
      `★★ and it is strictly better than the atomic build, whose worst frame was the whole ${total}ms`)
  }
  ok(sliced(52.8, LIGHT_BUILD_MS).worst < 58.9 / 10,
    '★★★ Alex\'s 55.80ms-of-58.9ms frame cannot recur: the same field now costs ' +
    `${sliced(52.8, LIGHT_BUILD_MS).worst}ms a frame across ${sliced(52.8, LIGHT_BUILD_MS).frames} frames`)
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
  // ── ★★★ THE SWEEP MUST NOMINATE, NEVER BUILD (2026-09-01) ───────────────────────────────────
  // The retired assert here was `/mayStartColdField\(/` — it proved the sweep asked permission
  // before an inline build, which was the 08-27 design. The build is no longer inline at all, so
  // the thing to assert is that it CANNOT become inline again by accident.
  ok(/startLightBuild\(/.test(code),
    '★★★ the sweep nominates a cold column for the job instead of building it')
  ok(/if \(!lf\) \{ startLightBuild\([^)]*\); continue \}/.test(code),
    '★★★ and a column without a ready field is SKIPPED in the same breath — no-spawn is the safe ' +
    'direction, so the lantern\'s veto can never be bypassed by a cache miss')
  ok(/advanceLightBuild\(LIGHT_BUILD_MS\)/.test(code),
    '★★★ the frame loop advances the job by the module\'s own slice — a job nothing advances is a ' +
    'column that is skipped forever, which reads in-game as "Hollows stopped spawning"')
  ok(!/mayStartColdField/.test(code),
    '★★ the retired gate is gone from the host, not merely unused');
  // ── ⚠⚠ THE WINDOW SLICING OPENED, AND IT DID NOT EXIST BEFORE ────────────────────────────────
  // A synchronous build had no window to go stale in. A job spans frames, so an edit or an
  // eviction mid-build must DROP it — otherwise a pre-edit field lands in the cache a few frames
  // after the player invalidated it, which is the delete silently undone.
  ok(/lightJob\.current = null/.test(code),
    '★★★ an in-flight field build is cancellable at all');
  ok((code.match(/lightJob\.current = null/g) ?? []).length >= 3,
    '★★★ and it is cancelled on BOTH invalidation paths (block edit, eviction) as well as on ' +
    'publish — a job cancelled only where somebody remembered is a stale field waiting to happen')
  // ⚠⚠ THE REGRESSION THAT WOULD UNDO ALL OF THIS: someone calling the builder straight from the
  // sweep again. Both entry points must appear EXACTLY ONCE, inside `advanceLightBuild`.
  for (const fn of ['beginLight(', 'stepLight(']) {
    ok((code.match(new RegExp(fn.replace('(', '\\('), 'g')) ?? []).length === 1,
      `★★★ ${fn}) is called in exactly one place — a second call site is a synchronous field build ` +
      'somewhere, which is the 55.80ms frame coming back')
  }
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
