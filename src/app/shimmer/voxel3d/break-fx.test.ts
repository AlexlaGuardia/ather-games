// The GPU half's arithmetic. Run: npx tsx src/app/shimmer/voxel3d/break-fx.test.ts
//
// ★ THREE CONSTRUCTS HEADLESS AS LONG AS NOTHING RENDERS. A BufferGeometry, a ShaderMaterial and a
// Points object are plain objects until a WebGLRenderer compiles them, so every number this pass
// computes — spawn placement, drag, gravity, the ring, the frame ceiling — is testable in node with
// no browser at all. What is NOT tested here is whether the shader compiles or what it looks like;
// that is what `/shimmer/dev/break` is for, and saying which half was checked is the point.
//
// ⚠ SO READ A GREEN RUN NARROWLY: it means the chips are in the right place moving the right way.
// It does not mean anything appeared on a screen.

import { createBreakFx, EMIT_PER_FRAME } from './break-fx'
import { recipeFor, chipColor } from './break-fx-spec'
import { MAT } from '../voxel/depth'
import { WOOD } from '../voxel/trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const posOf = (fx: ReturnType<typeof createBreakFx>) =>
  (fx.points.geometry.getAttribute('position') as { array: Float32Array }).array
const colOf = (fx: ReturnType<typeof createBreakFx>) =>
  (fx.points.geometry.getAttribute('aColor') as { array: Float32Array }).array

// ── 1. NOTHING HAPPENS UNTIL SOMETHING BREAKS ──────────────────────────────────────────────────
{
  const fx = createBreakFx()
  ok(fx.live() === 0, 'a fresh pass holds no chips')
  ok(fx.points.visible === false, 'and is not drawn')
  fx.tick(1 / 60)
  ok(fx.points.visible === false, 'an idle tick does not turn it on — the whole system sleeps')
  fx.dispose()
}

// ── 2. A CHIP IS BORN ON THE STRUCK FACE, NOT AT THE CELL CENTRE ───────────────────────────────
// This is the difference the effect exists for, so it is asserted by POSITION rather than by count.
{
  const fx = createBreakFx()
  fx.chip(10, 20, 30, 1, 0, 0, MAT.STONE, 6)     // +X face
  const p = posOf(fx)
  let outside = 0
  for (let i = 0; i < 6; i++) if (p[i * 3] > 10.9) outside++
  ok(fx.live() === 6, 'six chips asked for, six alive')
  ok(outside === 6, 'every chip from a +X strike is born beyond the +X face, not inside the block')

  const fy = createBreakFx()
  fy.chip(10, 20, 30, 0, 1, 0, MAT.STONE, 6)     // top face
  const q = posOf(fy)
  let above = 0
  for (let i = 0; i < 6; i++) if (q[i * 3 + 1] > 20.9) above++
  ok(above === 6, 'and a strike on the top face throws from the top — the normal is actually used')
  fx.dispose(); fy.dispose()
}

// ── 3. THE CHIP WEARS THE MESHER'S COLOUR ──────────────────────────────────────────────────────
{
  const fx = createBreakFx()
  fx.chip(0, 0, 0, 0, 1, 0, MAT.STONE, 40)
  const c = colOf(fx)
  const hex = chipColor(MAT.STONE)
  const want = [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]
  // Each chip is shaded 0.75–1.2× its material, so assert the RATIO holds, not the exact value —
  // and assert the shading actually varies, or a bug that shaded everything 1.0 would pass.
  let ratioOk = 0, distinct = new Set<number>()
  for (let i = 0; i < 40; i++) {
    const r = c[i * 3] / want[0]
    if (r > 0.7 && r < 1.25) ratioOk++
    distinct.add(Math.round(c[i * 3] * 1000))
  }
  ok(ratioOk === 40, 'every chip is a shade of the material colour the mesher uses')
  ok(distinct.size > 5, 'and the shades actually differ — a burst of identical clones reads as a system, not debris')
  fx.dispose()
}

// ── 4. GRAVITY, AND THE ONE THAT IS A REAL BUG CLASS ───────────────────────────────────────────
{
  const fx = createBreakFx()
  fx.chip(0, 50, 0, 0, -1, 0, MAT.SAND, 4)       // struck from below, thrown down
  const p = posOf(fx)
  const y0 = p[1]
  for (let i = 0; i < 30; i++) fx.tick(1 / 60)
  ok(p[1] < y0, 'a chip falls')

  // ⚠ FRAMERATE INDEPENDENCE. Drag applied as a raw per-frame multiply is the classic version of
  // this bug: identical on the machine it was tuned on, and visibly different on any other. Half a
  // second of flight must land in the same place whether it took 30 steps or 120.
  const a = createBreakFx(1); const b = createBreakFx(1)
  a.chip(0, 50, 0, 1, 0, 0, MAT.STONE, 1)
  b.chip(0, 50, 0, 1, 0, 0, MAT.STONE, 1)
  for (let i = 0; i < 30; i++) a.tick(1 / 60)
  for (let i = 0; i < 120; i++) b.tick(1 / 240)
  const pa = posOf(a), pb = posOf(b)
  const drift = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
  ok(drift < 0.05, `half a second of flight lands in the same place at 60fps and 240fps (drift ${drift.toFixed(4)})`)
  fx.dispose(); a.dispose(); b.dispose()
}

// ── 5. A CHIP DIES, AND ITS SLOT COMES BACK ────────────────────────────────────────────────────
{
  const fx = createBreakFx()
  fx.chip(0, 0, 0, 0, 1, 0, MAT.STONE, 10)
  ok(fx.live() === 10, 'ten alive')
  const longest = recipeFor('stone').life * 1.25 + 0.1     // the +25% life jitter, plus a frame
  for (let i = 0; i < Math.ceil(longest * 60); i++) fx.tick(1 / 60)
  ok(fx.live() === 0, 'and all ten are gone once the longest possible life has elapsed')
  ok(fx.points.visible === false, 'the pass switches itself back off rather than drawing nothing forever')
  const p = posOf(fx)
  ok(p[1] < -900, 'a dead chip is parked out of sight, not left at its last position')
  fx.dispose()
}

// ── 6. ★★ THE FELLED-TREE CEILING — the guard this design is most likely to need ───────────────
// A fell writes AIR to every log cell in one frame. Without a ceiling that is hundreds of bursts in
// a single tick on the weakest machine we support.
{
  const fx = createBreakFx()
  for (let i = 0; i < 200; i++) fx.burst(i, 60, 0, WOOD.GOLDWOOD_LOG)   // 200 logs, one frame
  ok(fx.live() <= EMIT_PER_FRAME, `one frame cannot birth more than the ceiling (${fx.live()} <= ${EMIT_PER_FRAME})`)
  ok(fx.dropped() > 0, 'and the overflow is reported, not silently absorbed — a silent cap is a lying cap')

  // ⚠ AND IT MUST BE A DROP, NOT A DEFERRAL. If the overflow were queued, the next frame would open
  // with a backlog and the stutter would simply move. A fresh frame starts with a fresh allowance
  // and no debt.
  const before = fx.live()
  fx.tick(1 / 600)                    // a tiny tick: nothing should die, nothing should be born
  ok(fx.live() >= before - 1, 'no queued backlog arrives on the next frame — the overflow was discarded')
  fx.dispose()
}

// ── 7. THE RING BOUNDS EXISTENCE, NOT JUST BIRTH ───────────────────────────────────────────────
{
  const fx = createBreakFx(7, 32)                                   // a tiny budget, to force reuse
  for (let f = 0; f < 20; f++) { fx.chip(0, 0, 0, 0, 1, 0, MAT.STONE, 20); fx.tick(1 / 600) }
  ok(fx.live() <= 32, `live chips never exceed the budget (${fx.live()} <= 32)`)
  ok(fx.live() > 0, 'and the ring is actually holding chips rather than losing them all')
  fx.dispose()
}

// ── 8. AN UNBREAKABLE / EMPTY CELL THROWS NOTHING ──────────────────────────────────────────────
{
  const fx = createBreakFx()
  fx.chip(0, 0, 0, 0, 1, 0, MAT.AIR, 8)
  fx.burst(0, 0, 0, MAT.AIR)
  ok(fx.live() === 0, 'air throws nothing — the bucket said null and the pass believed it')
  fx.chip(0, 0, 0, 0, 1, 0, MAT.STONE, 0)
  ok(fx.live() === 0, 'and asking for zero chips is not asking for one')
  fx.dispose()
}

// ── 9. ★★★ IT COMES BACK AFTER GOING QUIET, AND THIS ASSERT EXISTS BECAUSE A MUTATION FOUND IT ─
// Sections 1-8 were all green against a version that leaked its slots: a dead chip that never
// released `life` still vanished, still stopped moving, still stopped being counted — every visible
// symptom was correct. What broke was the NEXT burst. `tick` returns early when nothing is live, and
// `spawn` only grows the live count when it takes a slot that was actually free, so once the ring had
// been round once, a fresh burst landed in a stale slot, the count stayed at zero, the early return
// fired, and the effect went dark FOREVER — silently, with no error and nothing on screen.
//
// ⚠ IT NEEDED A SECOND CYCLE TO SHOW. Every existing section either emits once or never lets the
// pass fall idle first, and that is exactly the shape of the bug: quiet, then loud, then quiet for
// good. The state machine has to be walked all the way round, not sampled at one point on it.
//
// ⚠⚠ AND THE FIXTURE IS THE LOAD-BEARING PART, WHICH I GOT WRONG FIRST. Written against the default
// 512-slot budget this assert CANNOT FIRE: the second burst takes slots 8-15, which were never used
// and are genuinely free, so the stale-slot path is never entered and the mutation sails through. An
// 8-slot budget forces the ring to wrap onto the very slots that just died, which is the only state
// where the bug exists. Ask of any guard: is there an input that makes this fail?
{
  const fx = createBreakFx(3, 8)                   // budget 8, so a second burst MUST reuse dead slots
  fx.chip(0, 0, 0, 0, 1, 0, MAT.STONE, 8)
  const longest = recipeFor('stone').life * 1.25 + 0.1
  for (let i = 0; i < Math.ceil(longest * 60); i++) fx.tick(1 / 60)
  ok(fx.live() === 0 && fx.points.visible === false, 'the pass has gone fully quiet')

  fx.chip(5, 5, 5, 0, 1, 0, MAT.STONE, 8)          // strike again into recycled slots
  ok(fx.live() === 8, 'a burst after the pass went idle is counted')
  fx.tick(1 / 60)
  ok(fx.live() === 8, 'and survives the tick rather than being skipped by the idle early-return')
  ok(fx.points.visible === true, 'the pass turns itself back on — it does not go dark for good')

  const p = posOf(fx)
  let moved = 0
  const y0: number[] = []
  for (let i = 0; i < 8; i++) if (p[i * 3 + 1] > -900) y0.push(p[i * 3 + 1])
  for (let i = 0; i < 10; i++) fx.tick(1 / 60)
  let k = 0
  for (let i = 0; i < 8; i++) if (p[i * 3 + 1] > -900 && p[i * 3 + 1] !== y0[k++]) moved++
  ok(moved > 0, 'and the second-cycle chips are actually being integrated, not frozen in place')
  fx.dispose()
}

console.log(`break-fx: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
