// ATHERDASH slice sim sanity — run with: npx tsx src/app/atherdash/lib/atherdash.test.ts
import {
  makeWorld,
  swap,
  tick,
  persp,
  screenY,
  screenX,
  laneNearX,
  HORIZON_Y,
  NEAR_Y,
  VANISH_X,
  LANES,
  SWAP_T,
  SPEED,
  DASH_COUNT,
  MARKER_EVERY,
} from './atherdash'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// 1. boot state
{
  const w = makeWorld(1)
  ok('starts on center lane', w.lane === ((LANES - 1) >> 1))
  ok('x starts at lane', w.x === w.lane)
  ok('no markers yet', w.markers.length === 0)
  ok('dashes seeded full', w.dashes.length === DASH_COUNT)
  ok('dashes in [0,1)', w.dashes.every((z) => z >= 0 && z < 1))
}

// 2. projection endpoints + monotonicity
{
  ok('z=1 → horizon', near(persp(1), 0) && near(screenY(1), HORIZON_Y))
  ok('z=0 → camera/near', near(persp(0), 1) && near(screenY(0), NEAR_Y))
  ok('p clamps below 0', persp(-5) === 1)
  ok('p clamps above 1', persp(5) === 0)
  // closer (smaller z) always projects lower on screen
  let monoY = true
  let prev = screenY(1)
  for (let z = 1; z >= 0; z -= 0.05) { if (screenY(z) < prev - 1e-9) monoY = false; prev = screenY(z) }
  ok('screenY monotonic far→near', monoY)
  // near-camera rushes: last 10% of z covers more screen than first 10% (eased)
  const farSpan = screenY(0.9) - screenY(1.0)
  const nearSpan = screenY(0.0) - screenY(0.1)
  ok('perspective eased (near rushes)', nearSpan > farSpan)
}

// 3. lanes converge to the vanishing point at the horizon, spread at the camera
{
  ok('all lanes meet vanish at horizon', [0, 1, 2].every((i) => near(screenX(i, 1), VANISH_X)))
  ok('lane 0 left of lane 2 at near', screenX(0, 0) < screenX(2, 0))
  ok('center lane is centered at near', near(screenX((LANES - 1) / 2, 0), VANISH_X))
  ok('laneNearX even spacing', near(laneNearX(1) - laneNearX(0), laneNearX(2) - laneNearX(1)))
}

// 4. swap clamps to the field
{
  const w = makeWorld(2)
  swap(w, +1); ok('swap right', w.lane === ((LANES - 1) >> 1) + 1)
  swap(w, +1); swap(w, +1); ok('clamps at right edge', w.lane === LANES - 1)
  swap(w, -1); swap(w, -1); swap(w, -1); swap(w, -1); ok('clamps at left edge', w.lane === 0)
}

// 5. lane-swap lerp reaches target in ~SWAP_T (crisp)
{
  const w = makeWorld(3)
  swap(w, +1) // target one lane right
  const target = w.lane
  const dt = 1 / 120
  let t = 0
  for (let i = 0; i < 200 && w.x !== target; i++) { tick(w, dt); t += dt }
  ok('x reaches target lane', w.x === target)
  ok('full swap took ~SWAP_T', t <= SWAP_T + dt * 1.5 && t >= SWAP_T - dt * 1.5)
}

// 6. ground dashes recycle, never escape [0,1)
{
  const w = makeWorld(4)
  let okRange = true
  for (let i = 0; i < 600; i++) { tick(w, 1 / 60); if (!w.dashes.every((z) => z >= 0 && z < 1)) okRange = false }
  ok('dashes stay in [0,1) after recycling', okRange)
  ok('dash count constant', w.dashes.length === DASH_COUNT)
}

// 7. markers spawn over time, ride forward, and retire at the camera
{
  const w = makeWorld(5)
  for (let i = 0; i < 60; i++) tick(w, 1 / 60) // ~1s
  ok('markers spawned', w.markers.length > 0)
  ok('markers within depth', w.markers.every((m) => m.z > 0 && m.z <= 1))
  ok('markers ride valid lanes', w.markers.every((m) => m.lane >= 0 && m.lane < LANES))
  // a marker spawned at the horizon reaches the camera in ~1/SPEED seconds, then retires
  const before = w.markers.length
  for (let i = 0; i < Math.ceil((1 / SPEED) * 60) + 5; i++) tick(w, 1 / 60)
  ok('old markers retired (stream bounded)', w.markers.length < before + Math.ceil(1 / (SPEED * MARKER_EVERY)) + 4)
}

// 8. determinism from seed
{
  const a = makeWorld(99)
  const b = makeWorld(99)
  for (let i = 0; i < 120; i++) { tick(a, 1 / 60); tick(b, 1 / 60) }
  ok('same seed → same marker count', a.markers.length === b.markers.length)
  ok('same seed → same lanes', a.markers.every((m, i) => m.lane === b.markers[i].lane))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
