// The spawn budget's oracle. Run: npx tsx src/app/shimmer/voxel3d/spawn-budget.test.ts
//
// ★ THE PROPERTY: **the sweep must not be able to own a frame, for ANY reason.** Every assert below
// asks that, from a direction that the 2026-08-23 measurement proved was reachable in the real game.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stopScan, SPAWN_SCAN_MAX, SPAWN_BUDGET_MS } from './spawn-budget'

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
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the spawn sweep cannot own a frame — ${pass} passed`)
