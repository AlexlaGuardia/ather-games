// The Darter's handling, proved in numbers before anyone looks at it. Run: npx tsx src/app/shimmer/open/courser.test.ts

import { createCourser, tickCourser, bodySpeeds, slipAngle, DARTER, type CourserInput, type Ground } from './courser'
import { trackHeight, JUMP, WHOOPS } from './track'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const DT = 1 / 120
const flat: Ground = () => 0
const inp = (o: Partial<CourserInput> = {}): CourserInput => ({ throttle: 0, steer: 0, handbrake: false, dt: DT, ...o })
const run = (c: ReturnType<typeof createCourser>, secs: number, o: Partial<CourserInput>, g: Ground = flat) => {
  for (let i = 0; i < Math.round(secs / DT); i++) tickCourser(c, inp(o), g)
}

// ── at rest, it stays at rest ──
{
  const c = createCourser(0, 0, 0, flat)
  run(c, 3, {})
  ok(Math.hypot(c.x, c.z) < 1e-6 && c.yaw === 0, `idle creep: moved to ${c.x.toFixed(4)},${c.z.toFixed(4)} yaw ${c.yaw}`)
}

// ── launch: 0→100 km/h (27.8 m/s) in a brisk 3–6 s, top speed near the table's ──
{
  const c = createCourser(0, 0, 0, flat)
  let t100 = -1
  for (let i = 0; i < 20 * 120; i++) {
    tickCourser(c, inp({ throttle: 1 }), flat)
    if (t100 < 0 && bodySpeeds(c).fwd >= 27.8) t100 = i * DT
  }
  ok(t100 > 3 && t100 < 6, `0-100 km/h took ${t100.toFixed(2)}s (want 3-6)`)
  const v = bodySpeeds(c).fwd
  ok(v > DARTER.top * 0.85 && v <= DARTER.top, `top speed ${v.toFixed(1)} vs table ${DARTER.top}`)
  ok(c.z < -100 && Math.abs(c.x) < 1e-6, `straight line drifted: x=${c.x.toFixed(4)}`)
}

// ── brakes: from 100 km/h to a stop inside 25 m, and they never reverse the car ──
{
  const c = createCourser(0, 0, 0, flat)
  c.vz = -27.8
  const z0 = c.z
  run(c, 4, { throttle: -1 })
  // after stopping, holding S engages reverse, so measure the stopping point as the furthest point reached
  let far = 0
  const c2 = createCourser(0, 0, 0, flat); c2.vz = -27.8
  for (let i = 0; i < 4 * 120; i++) { tickCourser(c2, inp({ throttle: -1 }), flat); far = Math.max(far, -(c2.z - z0)) }
  ok(far < 25 && far > 12, `100→0 braking distance ${far.toFixed(1)}m (want 12-25)`)
  ok(bodySpeeds(c).fwd < 0, `holding brake after the stop should become reverse (fwd ${bodySpeeds(c).fwd.toFixed(2)})`)
  const c3 = createCourser(0, 0, 0, flat); c3.vz = -10
  run(c3, 10, {})
  ok(Math.abs(bodySpeeds(c3).fwd) < 1e-9, `coasting must stop dead, not creep (fwd ${bodySpeeds(c3).fwd})`)
}

// ── steering: a held turn at 15 m/s goes round a circle with tyres biting (little slip) ──
{
  const c = createCourser(0, 0, 0, flat)
  c.vz = -15
  run(c, 6, { throttle: 0.35, steer: -1 })
  ok(c.yaw > Math.PI, `turned only ${(c.yaw * 180 / Math.PI).toFixed(0)}° in 6s left`)
  ok(slipAngle(c) < 0.2, `grip turn slip ${(slipAngle(c) * 180 / Math.PI).toFixed(1)}° (want < 11°)`)
  // steering the other way turns the other way
  const d = createCourser(0, 0, 0, flat); d.vz = -15
  run(d, 1, { throttle: 0.35, steer: 1 })
  ok(d.yaw < -0.3, `right steer should yaw negative, got ${d.yaw.toFixed(2)}`)
}

// ── the drift: handbrake + steer at speed swings the tail out, and letting go recovers ──
{
  const c = createCourser(0, 0, 0, flat)
  c.vz = -30
  let peak = 0
  for (let i = 0; i < 1.2 * 120; i++) { tickCourser(c, inp({ steer: -1, handbrake: true, throttle: 0.5 }), flat); peak = Math.max(peak, slipAngle(c)) }
  ok(peak > 0.45, `handbrake drift peak slip ${(peak * 180 / Math.PI).toFixed(0)}° (want > 26°)`)
  ok(bodySpeeds(c).fwd > 10, `a drift should keep the car moving (fwd ${bodySpeeds(c).fwd.toFixed(1)})`)
  run(c, 2.5, { throttle: 0.6 })
  ok(slipAngle(c) < 0.08, `after letting go the car straightens (slip ${(slipAngle(c) * 180 / Math.PI).toFixed(1)}°)`)
}

// ── a hard grip turn at top speed starts to slide on its own (the power-slide is reachable) ──
{
  const c = createCourser(0, 0, 0, flat)
  c.vz = -42
  let peak = 0
  for (let i = 0; i < 1.5 * 120; i++) { tickCourser(c, inp({ steer: 1, throttle: 1 }), flat); peak = Math.max(peak, slipAngle(c)) }
  ok(peak > 0.08 && peak < 0.6, `top-speed full lock slip ${(peak * 180 / Math.PI).toFixed(1)}° (want a slide, not a spin)`)
}

// ── the jump: at speed the car leaves the lip, flies a real distance, and lands upright on the road ──
{
  const z = (JUMP.z0 + JUMP.z1) / 2
  const c = createCourser(JUMP.x0 - 60, z, -Math.PI / 2, trackHeight)   // yaw −π/2 faces +x
  let flew = false, takeoff = 0, touch = 0, maxY = -1
  for (let i = 0; i < 8 * 120; i++) {
    const was = c.airborne
    tickCourser(c, inp({ throttle: 1 }), trackHeight)
    if (!was && c.airborne) { flew = true; takeoff = c.x }
    if (c.airborne) maxY = Math.max(maxY, c.y)
    if (was && !c.airborne && touch === 0) touch = c.x
  }
  ok(flew, 'never left the ground at the jump')
  ok(Math.abs(takeoff - JUMP.x1) < 1.5, `takeoff at x=${takeoff.toFixed(1)}, lip is ${JUMP.x1}`)
  ok(touch - takeoff > 10, `flew only ${(touch - takeoff).toFixed(1)}m`)
  ok(maxY > JUMP.h, `apex ${maxY.toFixed(2)} should clear the lip ${JUMP.h}`)
  ok(!c.airborne && Math.abs(c.y - trackHeight(c.x, c.z)) < 1e-6, 'ended off the ground')
  // crawling over it drops off the lip close in (a 2.6 m fall), it does not sail
  const s = createCourser(JUMP.x0 - 3, z, -Math.PI / 2, trackHeight)
  s.vx = 4
  let off = 0, down = 0
  for (let i = 0; i < 6 * 120; i++) {
    const was = s.airborne
    tickCourser(s, inp({ throttle: 0.15 }), trackHeight)
    if (!was && s.airborne && !off) off = s.x
    if (was && !s.airborne && !down) down = s.x
  }
  ok(off > 0 && down - off < 4, `a crawl off the lip should drop near it (flew ${(down - off).toFixed(1)}m)`)
}

// ── the whoops unsettle at speed (some air) but never bury the car under the ground ──
{
  const z = (WHOOPS.z0 + WHOOPS.z1) / 2
  const c = createCourser(WHOOPS.x0 - 40, z, -Math.PI / 2, trackHeight)
  c.vx = 30
  let below = 0, air = 0
  for (let i = 0; i < 4 * 120; i++) {
    tickCourser(c, inp({ throttle: 1 }), trackHeight)
    if (c.y < trackHeight(c.x, c.z) - 1e-6) below++
    if (c.airborne) air++
  }
  ok(below === 0, `sank below the ground ${below} steps`)
  ok(air > 0, 'the whoops at 30 m/s should get the wheels light at least once')
}

// ── hills: full throttle still climbs the east hill, and a parked car rolls back down ──
{
  const c = createCourser(140, 0, -Math.PI / 2, trackHeight)
  run(c, 10, { throttle: 1 }, trackHeight)
  ok(c.x > 225, `stalled on the hill at x=${c.x.toFixed(0)}`)
  const p = createCourser(195, 0, -Math.PI / 2, trackHeight)
  run(p, 4, {}, trackHeight)
  ok(p.x < 194, `parked on the slope it should roll back (x ${p.x.toFixed(1)})`)
}

console.log(`courser: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
