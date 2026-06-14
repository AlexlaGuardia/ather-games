// LAZ sim sanity — run with: npx tsx src/app/laz/lib/laz.test.ts
import {
  makeWorld,
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
} from './laz'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

// 1. boot state
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('no gates yet', w.gates.length === 0)
  ok('score 0', w.score === 0)
  ok('tick is a no-op while ready', tick(w, 0.1).pass === 0 && w.state === 'ready')
}

// 2. flap launches the run + sets upward velocity
{
  const w = makeWorld(1)
  flap(w)
  ok('flap starts the run', w.state === 'playing')
  ok('flap sets upward impulse', w.vy === FLAP_V)
  ok('first gate spawned', w.gates.length === 1)
}

// 3. gravity pulls down over time
{
  const w = makeWorld(1)
  flap(w)
  w.vy = 0 // neutralize the launch impulse to read gravity cleanly
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
  w.gates = [{ x: 30, gapY: VH / 2, passed: false }] // right edge (90) already behind the bird
  const ev = tick(w, 0.05) // pass check fires this frame
  ok('gate passed scored', ev.pass === 1 && w.score === 1)
  ok('gate marked passed (no double count)', tick(w, 0.05).pass === 0)
}

// 5. flying into a gate column (outside the gap) crashes
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = 40 // high — above the gap
  w.gates = [{ x: BIRD_X - 5, gapY: VH / 2, passed: false }]
  const ev = tick(w, 0.016)
  ok('crash into gate', ev.crash === true && w.state === 'over')
}

// 6. inside the gap is safe
{
  const w = makeWorld(1)
  w.state = 'playing'
  w.y = VH / 2
  w.vy = 0
  w.gates = [{ x: BIRD_X - 5, gapY: VH / 2, passed: false }]
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
  ok('floor crash', ev.crash === true && w.state === 'over')
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
  const a = makeWorld(2024); flap(a)
  const b = makeWorld(2024); flap(b)
  ok('same seed → same first gap', a.gates[0].gapY === b.gates[0].gapY)
  const c = makeWorld(2025); flap(c)
  ok('different seed → different gap', a.gates[0].gapY !== c.gates[0].gapY)
}

console.log(`\nLAZ sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
