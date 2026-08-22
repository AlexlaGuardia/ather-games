// UPDRAFT sim sanity — run with: npx tsx src/app/updraft/lib/updraft.test.ts
import {
  makeWorld,
  launch,
  flap,
  tick,
  loadHiScore, // referenced to ensure exports resolve
  FLAP_V,
  GRAVITY,
  GROUND_Y,
  BIRD_X,
  BIRD_R,
  GATE_W,
  GAP_H,
  VH,
  type World,
  type Air,
  type Gate,
  type UpdraftState,
} from './updraft'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

/**
 * ⚠ A GATE FIXTURE MUST CARRY `gapH` AND `air`, AND THE FAILURE WHEN IT DOES NOT IS SILENT.
 * These blocks used to build `{ x, gapY, passed }` literals. `Gate` grew `gapH` (per-air opening)
 * and `air`, so `gapH` came through as undefined, `gapY ± undefined / 2` is NaN, and EVERY
 * comparison against NaN is false — so `hitsGate` answered "no collision" for a bird buried in a
 * column. The crash assert did not detect a physics regression; it had stopped being able to see
 * one at all. Built through one helper now, so a future field lands in every fixture at once.
 */
/**
 * ⚠ READ `state` THROUGH THIS, NOT DIRECTLY, AFTER ASSIGNING IT.
 * `w.state = 'playing'` narrows the field to that literal for the rest of the block, so a later
 * `w.state === 'over'` — which is exactly what a crash assert must ask — is flagged TS2367 "no
 * overlap" even though `tick` really does flip it at runtime. tsc is describing its own flow
 * analysis, not the sim. This launders the read back to the declared union so the assert can be
 * written the way it reads.
 */
const state = (w: World): UpdraftState => w.state

function gate(x: number, gapY: number, gapH = GAP_H, air: Air = 'open'): Gate {
  // ⚠ A DECLARATION, NOT `=> ({ ... })`. This file's blocks are bare `{ ... }` statements, and an
  // arrow whose body is a parenthesized object literal sitting directly above one parses as a
  // parameter list under `tsc` (tsx swallowed it, so it was red in typecheck and green in test).
  // The return type is the point anyway: a future `Gate` field fails HERE, at one place.
  return { x, gapY, gapH, air, passed: false }
}

// 1. boot state
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('no gates yet', w.gates.length === 0)
  ok('score 0', w.score === 0)
  ok('tick is a no-op while ready', tick(w, 0.1).pass === 0 && w.state === 'ready')
}

// 2. ★ LAUNCH STARTS THE RUN; FLAP ONLY BEATS THE WINGS — and the SPLIT is the assert.
// This block used to call `flap` and expect a run to begin. That contract was deliberately retired:
// START flips ready → playing WITHOUT an impulse, so the rider hangs on the updraft long enough to
// read the first gate, and your first tap is a flap and nothing else (page.tsx § START). The old
// test kept asserting the coupled version and went red instead of learning the new rule — so pin
// BOTH halves of the decoupling, which is what nothing was checking.
{
  const w = makeWorld(1)
  flap(w)
  ok('★ a flap on the ready screen does NOT start the run', w.state === 'ready')
  ok('and it does not sneak in an impulse either', w.vy === 0)

  launch(w)
  ok('launch starts the run', w.state === 'playing')
  ok('★ launch does NOT beat the wings — you wait on the updraft', w.vy === 0)
  ok('first gate spawned', w.gates.length === 1)

  flap(w)
  ok('flap sets upward impulse once in flight', w.vy === FLAP_V)
}

// 3. gravity pulls down over time
{
  const w = makeWorld(1)
  launch(w)
  w.vy = 0 // read gravity cleanly, whatever the entry impulse is
  const y0 = w.y
  tick(w, 0.1)
  ok('gravity increases downward velocity', w.vy > 0 && Math.abs(w.vy - GRAVITY * 0.1) < 1)
  ok('falls', w.y > y0)
}

// 4. clearing a gate scores
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = VH / 2
  w.gates = [gate(30, VH / 2)] // right edge (90) already behind the bird
  const ev = tick(w, 0.05) // pass check fires this frame
  ok('gate passed scored', ev.pass === 1 && w.score === 1)
  ok('gate marked passed (no double count)', tick(w, 0.05).pass === 0)
}

// 5. flying into a gate column (outside the gap) crashes
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = 40 // high — above the gap
  w.gates = [gate(BIRD_X - 5, VH / 2)]
  const ev = tick(w, 0.016)
  ok('crash into gate', ev.crash === true && state(w) === 'over')
}

// 6. inside the gap is safe
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = VH / 2
  w.vy = 0
  w.gates = [gate(BIRD_X - 5, VH / 2)]
  const ev = tick(w, 0.016)
  ok('threading the gap is safe', ev.crash === false && w.state === 'playing')
}

// 7. hitting the floor kills
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = GROUND_Y - BIRD_R - 1
  w.vy = 600
  const ev = tick(w, 0.1)
  ok('floor crash', ev.crash === true && state(w) === 'over')
}

// 8. ceiling clamps, does not kill
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = BIRD_R + 1
  w.vy = -600
  const ev = tick(w, 0.1)
  ok('ceiling clamps not kills', ev.crash === false && w.state === 'playing' && w.y >= BIRD_R)
}

// 9. determinism
{
  const a = makeWorld(2024); launch(a)
  const b = makeWorld(2024); launch(b)
  const c = makeWorld(2025); launch(c)
  // Assert the fixture before reading through it: with `flap` here these three worlds held NO gates
  // and the file died on a null deref, which reads as broken test code rather than "nothing started".
  ok('the seeded worlds actually spawned a gate to compare', !!(a.gates[0] && b.gates[0] && c.gates[0]))
  ok('same seed → same first gap', a.gates[0]?.gapY === b.gates[0]?.gapY)
  ok('different seed → different gap', a.gates[0]?.gapY !== c.gates[0]?.gapY)
}

console.log(`\nUPDRAFT sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
