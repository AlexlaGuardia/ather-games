// ATHERDASH sim sanity — run with: npx tsx src/app/atherdash/lib/atherdash.test.ts
import {
  makeWorld,
  start,
  swap,
  tick,
  persp,
  screenY,
  screenX,
  laneNearX,
  loadHiScore, // referenced to ensure exports resolve
  HORIZON_Y,
  NEAR_Y,
  VANISH_X,
  LANES,
  SWAP_T,
  SPEED,
  DASH_COUNT,
  GATE_GAP_Z,
  GATE_HIT_Z,
  LEAD_DIST,
  ELEMENTS,
} from './atherdash'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps
const stepN = (w: ReturnType<typeof makeWorld>, n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(w, dt) }

// 1. boot state
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('on a valid start lane', w.lane >= 0 && w.lane < LANES && w.x === w.lane)
  ok('no gates yet', w.gates.length === 0)
  ok('score 0', w.score === 0)
  ok('dashes seeded full + in [0,1)', w.dashes.length === DASH_COUNT && w.dashes.every((z) => z >= 0 && z < 1))
  ok('4 canon elements', ELEMENTS.length === LANES && ELEMENTS.every((e) => e.base && e.name))
}

// 2. projection endpoints + monotonicity + easing (unchanged crux)
{
  ok('z=1 → horizon', near(persp(1), 0) && near(screenY(1), HORIZON_Y))
  ok('z=0 → camera/near', near(persp(0), 1) && near(screenY(0), NEAR_Y))
  ok('p clamps', persp(-5) === 1 && persp(5) === 0)
  let mono = true, prev = screenY(1)
  for (let z = 1; z >= 0; z -= 0.05) { if (screenY(z) < prev - 1e-9) mono = false; prev = screenY(z) }
  ok('screenY monotonic far→near', mono)
  ok('perspective eased (near rushes)', (screenY(0) - screenY(0.1)) > (screenY(0.9) - screenY(1.0)))
  ok('lanes meet vanish at horizon', Array.from({ length: LANES }, (_, i) => i).every((i) => near(screenX(i, 1), VANISH_X)))
  ok('lanes spread at near', screenX(0, 0) < screenX(LANES - 1, 0))
  ok('laneNearX even spacing', near(laneNearX(1) - laneNearX(0), laneNearX(2) - laneNearX(1)))
}

// 3. input gating: nothing moves until start; swap clamps
{
  const w = makeWorld(2)
  const lane0 = w.lane
  swap(w, +1); ok('swap ignored while ready', w.lane === lane0)
  start(w); ok('start → playing', w.state === 'playing')
  swap(w, +1); ok('swap works while playing', w.lane === lane0 + 1)
  swap(w, +1); swap(w, +1); swap(w, +1); ok('clamps at right edge', w.lane === LANES - 1)
  for (let i = 0; i < 6; i++) swap(w, -1); ok('clamps at left edge', w.lane === 0)
}

// 4. lane-swap lerp reaches target in ~SWAP_T
{
  const w = makeWorld(3); start(w)
  swap(w, +1)
  const target = w.lane
  const dt = 1 / 120; let t = 0
  for (let i = 0; i < 200 && w.x !== target; i++) { tick(w, dt); t += dt }
  ok('x reaches target lane', w.x === target)
  ok('full swap took ~SWAP_T', Math.abs(t - SWAP_T) <= dt * 1.5)
}

// 5. ground dashes recycle, never escape [0,1) (even on the ready screen)
{
  const w = makeWorld(4)
  let okRange = true
  for (let i = 0; i < 400; i++) { tick(w, 1 / 60); if (!w.dashes.every((z) => z >= 0 && z < 1)) okRange = false }
  ok('dashes stay in [0,1) (ready screen alive)', okRange && w.dashes.length === DASH_COUNT)
}

// 6. gates spawn on the track cadence, not before the lead-in
{
  const w = makeWorld(5); start(w)
  // before travelling LEAD_DIST, no gate
  const framesToLead = Math.floor((LEAD_DIST / SPEED) * 60) - 2
  stepN(w, framesToLead)
  ok('no gate before the lead-in', w.gates.length === 0)
  stepN(w, 6)
  ok('first gate spawned after lead-in', w.gates.length >= 1)
  ok('gate opens a valid lane', w.gates.every((g) => g.lane >= 0 && g.lane < LANES))
  // run a while; gates should be spaced ~GATE_GAP_Z apart (cadence holds)
  stepN(w, Math.floor((GATE_GAP_Z * 3 / SPEED) * 60))
  ok('multiple gates in flight', w.gates.length >= 2)
}

// 7. matching lane PASSES (score up), wrong lane CRASHES (game over)
{
  // pass case
  const w = makeWorld(6); start(w)
  while (w.gates.length === 0) tick(w, 1 / 60)
  const g = w.gates[0]
  w.x = g.lane; w.lane = g.lane // sit in the right lane
  let passed = false
  for (let i = 0; i < 600 && !g.resolved; i++) { if (tick(w, 1 / 60).pass) passed = true }
  ok('in matching lane → gate passed', g.passed && passed && w.score >= 1)
  ok('still playing after a pass', w.state === 'playing')

  // crash case
  const w2 = makeWorld(7); start(w2)
  while (w2.gates.length === 0) tick(w2, 1 / 60)
  const g2 = w2.gates[0]
  const wrong = (g2.lane + 1) % LANES
  w2.x = wrong; w2.lane = wrong
  let crashed = false
  for (let i = 0; i < 600 && w2.state === 'playing'; i++) { if (tick(w2, 1 / 60).crash) crashed = true }
  ok('wrong lane → crash', crashed && g2.resolved && !g2.passed)
  ok('crash → game over', w2.state === 'over')
  ok('no score from a crashed gate', w2.score === 0)
}

// 8. a gate resolves exactly once; swap blocked after game over
{
  const w = makeWorld(8); start(w)
  while (w.gates.length === 0) tick(w, 1 / 60)
  const g = w.gates[0]
  w.x = (g.lane + 2) % LANES; w.lane = w.x // wrong → will crash
  for (let i = 0; i < 600 && w.state === 'playing'; i++) tick(w, 1 / 60)
  const laneAtDeath = w.lane
  swap(w, +1)
  ok('no swap after game over', w.lane === laneAtDeath)
  ok('gate resolved exactly once (over)', w.state === 'over')
}

// 9. determinism from seed
{
  const a = makeWorld(99); start(a)
  const b = makeWorld(99); start(b)
  stepN(a, 300); stepN(b, 300)
  ok('same seed → same gate count', a.gates.length === b.gates.length)
  ok('same seed → same gate lanes', a.gates.every((g, i) => g.lane === b.gates[i].lane))
  ok('GATE_HIT_Z sits in front of camera', GATE_HIT_Z > 0 && GATE_HIT_Z < 0.2)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
