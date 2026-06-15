// GRAVITAR sim tests — npx tsx src/app/gravitar/lib/gravitar.test.ts
import {
  makeWorld, tick, gravityAt, ARENA_R, FUEL_MAX, TARGET_CORES, SHIP_R,
  type World,
} from './gravitar'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)) }
const NO = { rotate: 0, thrust: false }
const hyp = (x: number, y: number) => Math.sqrt(x * x + y * y)

// 1. setup
{
  const w = makeWorld(1)
  ok('three gravity wells', w.bodies.length === 3)
  ok('cores stocked to target', w.cores.length === TARGET_CORES)
  ok('ship starts alive, fuelled', w.ship.alive && w.ship.fuel === FUEL_MAX && !w.over)
}

// 2. gravity pulls the ship toward a body
{
  const w = makeWorld(1)
  const s = w.ship
  s.x = 0; s.y = -200; s.vx = 0; s.vy = 0 // above the central body at origin
  tick(w, 1 / 60, NO)
  ok('gravity accelerates toward the world (downward, +y)', s.vy > 0)
  // (no "zero sideways drift" check — the two companion worlds pull laterally too; that's the point)
}

// 3. thrust accelerates along the heading + burns fuel
{
  const w = makeWorld(2)
  const s = w.ship
  s.x = 0; s.y = -400; s.vx = 0; s.vy = 0; s.angle = -Math.PI / 2 // pointing "up", away from centre
  const f0 = s.fuel
  tick(w, 1 / 60, { rotate: 0, thrust: true })
  ok('thrust pushes along heading (up, -y beats gravity for one tick)', s.vy < 0)
  ok('thrust drains fuel', s.fuel < f0)
}

// 4. no thrust without fuel
{
  const w = makeWorld(2)
  const s = w.ship
  s.x = 0; s.y = -400; s.vx = 0; s.vy = 0; s.angle = -Math.PI / 2; s.fuel = 0
  tick(w, 1 / 60, { rotate: 0, thrust: true })
  ok('empty tank: only gravity acts (falls toward centre, +y)', s.vy > 0)
}

// 5. collecting a core scores + refuels + restocks
{
  const w = makeWorld(3)
  const s = w.ship
  s.fuel = 20
  const c = w.cores[0]
  s.x = c.x; s.y = c.y; s.vx = 0; s.vy = 0
  const ev = tick(w, 1 / 60, NO)
  ok('core collected', ev.collected === 1 && w.score === 1)
  ok('core refuelled the spark', s.fuel > 20)
  ok('system restocked to target', w.cores.length === TARGET_CORES)
}

// 6. crashing into a world ends the run
{
  const w = makeWorld(4)
  const b = w.bodies[0]
  w.ship.x = b.x; w.ship.y = b.y // dead centre of the world
  const ev = tick(w, 1 / 60, NO)
  ok('crash kills', w.over && !w.ship.alive && ev.crashed)
}

// 7. the void-wall turns you back (a soft reflective bound, not death)
{
  const w = makeWorld(5)
  w.ship.x = ARENA_R + 50; w.ship.y = 0; w.ship.vx = 60; w.ship.vy = 0 // outside, fleeing further out
  tick(w, 1 / 60, NO)
  ok('the void wall does not kill', !w.over && w.ship.alive)
  ok('it reflects the spark back inside the arena', hyp(w.ship.x, w.ship.y) <= ARENA_R && w.ship.vx < 0)
}

// 8. determinism — same seed, same system
{
  const a = makeWorld(2024), b = makeWorld(2024)
  ok('same seed → same first core', a.cores[0].x === b.cores[0].x && a.cores[0].y === b.cores[0].y)
}

// 9. gravityAt is stronger nearer a body
{
  const w = makeWorld(6)
  const near = gravityAt(w, 0, -90) // just outside the central r=64 body
  const far = gravityAt(w, 0, -400)
  ok('gravity falls off with distance', hyp(near.ax, near.ay) > hyp(far.ax, far.ay))
}

// 10. a tangential pass curves but doesn't instantly crash or escape (orbits are possible)
{
  const w = makeWorld(7)
  const s = w.ship
  s.x = 0; s.y = -160; s.vx = 130; s.vy = 0 // sideways past the central world
  let minD = Infinity, maxD = 0
  for (let i = 0; i < 180 && !w.over; i++) { tick(w, 1 / 60, NO); const d = hyp(s.x, s.y); minD = Math.min(minD, d); maxD = Math.max(maxD, d) }
  ok('a tangential pass stays bound for ~3s (a real slingshot arc)', !w.over && minD > w.bodies[0].r + SHIP_R && maxD < ARENA_R)
}

// 11. headless pilots across several systems — a competent controller scores + survives
//     (a GREEDY bot only; a human anticipates gravity far better. This just proves the game is
//     navigable, not instant-death — the real feel-tuning is a hands-on job, by design.)
function pilot(seed: number) {
  const w = makeWorld(seed)
  const s = w.ship
  const dt = 1 / 60
  let steps = 0
  while (!w.over && steps < 60 * 60) {
    let nb = w.bodies[0], nbd = Infinity
    for (const b of w.bodies) { const d = hyp(b.x - s.x, b.y - s.y); if (d < nbd) { nbd = d; nb = b } }
    const speed = hyp(s.vx, s.vy)
    const intoBody = s.vx * (nb.x - s.x) + s.vy * (nb.y - s.y) > 0 // closing on the world
    let want: number, maxDa: number
    if (nbd < nb.r + 95 && intoBody) {            // flee the well we're falling into
      want = Math.atan2(s.y - nb.y, s.x - nb.x); maxDa = 1.4
    } else if (speed > 165) {                      // too fast — brake against velocity
      want = Math.atan2(-s.vy, -s.vx); maxDa = 0.9
    } else {                                       // seek the nearest core
      let bi = 0, bd = Infinity
      for (let i = 0; i < w.cores.length; i++) { const d = hyp(w.cores[i].x - s.x, w.cores[i].y - s.y); if (d < bd) { bd = d; bi = i } }
      const c = w.cores[bi]
      want = Math.atan2(c.y - s.y, c.x - s.x); maxDa = 0.45
    }
    let da = want - s.angle
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    const rotate = Math.abs(da) < 0.06 ? 0 : da > 0 ? 1 : -1
    const thrust = s.fuel > 0 && Math.abs(da) < maxDa
    tick(w, dt, { rotate, thrust })
    steps++
  }
  return { score: w.score, secs: steps / 60 }
}
{
  const runs = [11, 3, 7, 21, 42, 99].map(pilot)
  const total = runs.reduce((a, r) => a + r.score, 0)
  const longest = Math.max(...runs.map((r) => r.secs))
  console.log(`     (pilots: scores ${runs.map((r) => r.score).join(',')} · longest ${longest.toFixed(1)}s)`)
  ok('greedy bots score across systems (navigable, not instakill)', total >= 5)
  ok('a run sustains for a real stretch (no death-spiral)', longest >= 20)
}

console.log(`\nGRAVITAR sim: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
