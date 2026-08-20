// The rinning LOOP, composed. Run: npx tsx src/app/shimmer/engine/rin-loop.test.ts
//
// ★ WHY THIS EXISTS SEPARATELY FROM THE THREE UNIT SUITES. `rin-water`, `rin-cast` and `rin-catch`
// each pass on their own and each is right on its own; what nothing tested is the SEQUENCE the host
// runs them in — resolve a spot, open a cast, tick it, answer a take, resolve a catch. Every bug
// this file is aimed at lives in the joins: an ordering that makes a fair answer miss, a clock that
// resets and takes the keeper's patience with it, a depth taken from the wrong y.
//
// ⚠ IT DELIBERATELY DOES NOT RENDER ANYTHING. The host wiring in `VoxelWorld.tsx` is React and
// three and cannot be run here — so this asserts the composition it is built from, which is the
// part that carries the reasoning. What it cannot prove is that the host calls these in this order;
// that claim is carried by the comment at the call site and by playing it.

import { newCast, phaseAt, passed, answer, RISE_MS, TAKE_MS, WAIT_MIN_MS } from './rin-cast'
import { rinCatch, population, ceilingFor, PATIENCE_FULL_MS, type RinWater } from './rin-catch'
import { rinSpotAt } from '../voxel/rin-water'
import { columnHeight } from '../voxel/height'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const SEED = 1337
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

// ── 1. ★★ A REAL SPOT FROM THE REAL WORLD RESOLVES INTO A CATCHABLE WATER ──────────────────────
// The host builds `RinWater` from `rinSpotAt` plus `columnHeight`. If that construction is wrong —
// a bad depth, a non-finite surface — the ladder still returns something, so nothing fails and the
// weighting is quietly nonsense. Walk the world until each kind is found, then check the join.
{
  const found = new Map<number, RinWater>()
  for (let x = -1500; x <= 1500 && found.size < 3; x += 13) {
    for (let z = -1500; z <= 1500 && found.size < 3; z += 13) {
      const spot = rinSpotAt(x, z, SEED)
      if (!spot || found.has(spot.kind)) continue
      found.set(spot.kind, {
        kind: spot.kind,
        depth: Math.max(0, spot.surfaceY - columnHeight(x, z, SEED)),
        lively: spot.lively,
      })
    }
  }
  ok(found.size === 3, `all three spot kinds exist in the world to be caught from (${found.size})`)
  for (const [kind, w] of found) {
    ok(Number.isFinite(w.depth) && w.depth >= 0, `kind ${kind}: depth is a real number (${w.depth})`)
    ok(population(w) > 0, `kind ${kind}: holds some life`)
    const r = rinCatch(w, 10, PATIENCE_FULL_MS, lcg(kind + 1))
    ok(!!r.itemId && r.xp > 0 && r.tier <= ceilingFor(w),
      `kind ${kind}: a cast lands ${r.itemId} (tier ${r.tier}, ceiling ${ceilingFor(w)})`)
  }
}

// ── 2. ★★ THE TICK-BEFORE-CLICK ORDER, WHICH IS THE ONE THAT DECIDES FAIRNESS ──────────────────
// The host advances the cast BEFORE reading the mouse. Ticked the other way round, a take that
// begins on frame N is not visible until frame N+1, so an answer on frame N — the frame the player
// actually saw it — is judged against 'rising' and misses. That is a reflex penalty arrived at by
// an ordering, and canon refuses reflex penalties in this skill twice, with a reason.
{
  const t0 = 0
  const c = newCast(t0, () => 0)                 // rng 0 → the shortest possible wait
  const takeStart = t0 + c.riseAt + RISE_MS
  ok(phaseAt(c, takeStart - 1) === 'rising', 'the instant before the take is still the rise')
  ok(phaseAt(c, takeStart) === 'taking', '★★ the take is answerable on the very frame it begins')
  ok(answer(c, takeStart), '...and `answer` agrees on that frame')
  ok(answer(c, takeStart + TAKE_MS - 1), 'and on the last frame of the window')
  ok(!answer(c, takeStart + TAKE_MS), 'but not after it')
}

// ── 3. ★★ PATIENCE SURVIVES A PASS — the join the host's `outMs` exists for ────────────────────
// `passed()` returns a cast with a NEW `startMs`, because the wait it describes starts now. So any
// patience derived from the cast's own clock resets every time a take goes unanswered — punishing
// the keeper who looked away, which is precisely who canon's "idle-friendly" line is written for.
// The host keeps `outMs` from the first cast and never moves it; this proves the two differ.
{
  const outMs = 0
  let c = newCast(outMs, () => 0.5)
  const firstTake = outMs + c.riseAt + RISE_MS
  const now = firstTake + TAKE_MS + 1           // one take came and went
  c = passed(c, now, () => 0.5)
  ok(c.startMs === now, 'a pass restarts the cast clock (this is correct for the WAIT)')
  ok(c.startMs > outMs, '★★ ...and therefore is NOT the patience clock — they have diverged')

  const deep: RinWater = { kind: 3, depth: 10, lively: true }
  const mean = (patienceMs: number) => {
    const rng = lcg(5)
    let sum = 0
    for (let i = 0; i < 20000; i++) sum += rinCatch(deep, 10, patienceMs, rng).tier
    return sum / 20000
  }
  // What the bug would have looked like: the keeper waited `now` ms, but a cast-clock patience
  // would report 0 and pay the impatient rate.
  const honest = mean(now - outMs), reset = mean(0)
  ok(honest > reset,
    `★★ the honest clock pays better than the reset one would (${reset.toFixed(3)} → ${honest.toFixed(3)}) — ` +
    'this gap IS the bug that `outMs` prevents')
}

// ── 4. A FULL SESSION ENDS WITH SOMETHING IN THE BAG, AND NEVER WITH A PENALTY ─────────────────
// Drive the loop the way a keeper does: cast, ignore some takes, answer one. The thing being
// asserted is that ignoring takes costs nothing — `passes` may only shorten the next wait.
{
  const rng = lcg(21)
  let c = newCast(0, rng, false)
  let t = 0, ignored = 0
  const waits: number[] = []
  for (let i = 0; i < 4; i++) {
    waits.push(c.riseAt)
    t = c.startMs + c.riseAt + RISE_MS + TAKE_MS + 1
    c = passed(c, t, rng)
    ignored++
  }
  ok(ignored === 4, 'four takes went unanswered')
  ok(c.passes === 4, 'and the cast counted them')
  ok(waits.slice(1).every(w => w <= waits[0] + 1),
    '★★ every wait after the first is no longer than the first — a pass may only ever SHORTEN')
  ok(Math.min(...waits.slice(1)) < WAIT_MIN_MS,
    `★ and rekindling genuinely bites (shortest re-wait ${Math.round(Math.min(...waits.slice(1)))}ms < ${WAIT_MIN_MS}ms floor)`)

  // Then answer one, from water that cannot pay the top rung, at a level that could.
  const shallow: RinWater = { kind: 1, depth: 3, lively: false }
  const landed = rinCatch(shallow, 10, t, rng)
  ok(landed.tier === 1 && landed.xp === 15, `a pond pays tier 1 however long the session ran (${landed.tier})`)
}

console.log(fails.length ? `❌ ${fails.length} failed:\n  ${fails.join('\n  ')}` : `✅ the loop composes — ${pass} passed`)
process.exit(fails.length ? 1 : 0)
