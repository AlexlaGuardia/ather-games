// SEEDFALL sim sanity — run with: npx tsx src/app/seedfall/lib/seedfall.test.ts
import {
  makeWorld,
  setInput,
  tick,
  loadGarden, // ensure exports resolve
  VW,
  VH, // ensure exports resolve
  DEPTH_GOAL,
  SEED_R,
  SOFT_VY,
  FUEL_MAX,
  type World,
} from './seedfall'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
// neutralize wind for deterministic physics assertions
function calm(w: World) { w.wind = 0; w.windTarget = 0; w.windT = 999 }

// 1. ready → playing on first input
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('tick no-op while ready', tick(w, 0.1).thrust === false && w.state === 'ready')
  setInput(w, true, false)
  ok('input launches the drop', w.state === 'playing')
}

// 2. gravity pulls down with no thrust
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  tick(w, 0.1)
  ok('falls under gravity', w.vy > 0)
}

// 3. both-thrust lifts + burns fuel; releasing regens
{
  const w = makeWorld(1); w.state = 'playing'; calm(w); w.y = 120 // off the ceiling so lift can register
  setInput(w, true, true)
  tick(w, 0.1)
  ok('both-thrust lifts (vy negative)', w.vy < 0)
  ok('fuel burned', w.fuel < FUEL_MAX)
  const burned = w.fuel
  setInput(w, false, false); tick(w, 0.2)
  ok('fuel regens when released', w.fuel > burned)
}

// 4. out of fuel = no thrust
{
  const w = makeWorld(1); w.state = 'playing'; calm(w); w.fuel = 0
  setInput(w, true, true)
  tick(w, 0.1)
  ok('no fuel → still falls', w.vy > 0 && w.thrusting === false)
}

// 5. lateral thrust steers (the drift that out-runs the Havari)
{
  const l = makeWorld(1); l.state = 'playing'; calm(l); setInput(l, true, false); tick(l, 0.1)
  ok('left thrust pushes left', l.vx < 0)
  const r = makeWorld(1); r.state = 'playing'; calm(r); setInput(r, false, true); tick(r, 0.1)
  ok('right thrust pushes right', r.vx > 0)
}

// 6. a branch limb crashes you; the gap threads you through (+score)
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  const b = w.branches[0]
  // sit in the limb's y-band, OFF the opening → crash
  w.y = b.y - 5; w.x = b.gapX > VW / 2 ? 6 : VW - 6; w.vx = 0; w.vy = 60
  ok('under a branch limb = crash', tick(w, 0.05).crashed && w.state === 'crashed')

  const w2 = makeWorld(1); w2.state = 'playing'; calm(w2)
  const b2 = w2.branches[0]
  w2.y = b2.y - 2; w2.x = b2.gapX; w2.vx = 0; w2.vy = 250 // through the gap, crossing fully
  const ev = tick(w2, 0.1)
  ok('through the gap = thread, no crash', ev.thread && w2.state === 'playing' && w2.threads === 1)
  ok('threading scores', w2.score > 0)
}

// 7. the Havari's swoop snatches a seed left in its dive line; drift off it and it passes
{
  // dive aimed right at a stationary seed → caught somewhere in the sweep
  const w = makeWorld(1); w.state = 'playing'; calm(w); w.x = 200
  w.havari = { x: -13, dy: -122, side: 1, targetX: 200, state: 'sweep', t: 0 }
  let caught = false
  for (let i = 0; i < 200 && w.state === 'playing'; i++) { if (tick(w, 1 / 60).caught) caught = true }
  ok('swoop snatches a seed in its dive line', caught && w.state === 'caught')

  // dive aimed far from the seed → it crosses and peels off (a dodge)
  const w2 = makeWorld(1); w2.state = 'playing'; calm(w2); w2.x = 360
  w2.havari = { x: -13, dy: -122, side: 1, targetX: 40, state: 'sweep', t: 0 }
  let dodged = false
  for (let i = 0; i < 200 && w2.state === 'playing'; i++) { if (tick(w2, 1 / 60).dodged) dodged = true }
  ok('a swoop off the seed = dodge (+score)', dodged && w2.dodges === 1 && w2.state === 'playing')
}

// 8. soft landing on the soil plants; hot or off-pad shatters
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  w.x = w.padX; w.y = DEPTH_GOAL - SEED_R - 1; w.vx = 0; w.vy = 20
  const ev = tick(w, 0.05)
  ok('soft on-pad = landed', w.state === 'landed' && ev.landed)
  ok('a rating is given', ev.rating === 'perfect' || ev.rating === 'soft')

  const hot = makeWorld(1); hot.state = 'playing'; calm(hot)
  hot.x = hot.padX; hot.y = DEPTH_GOAL - SEED_R - 1; hot.vx = 0; hot.vy = 240
  ok('hard landing = crashed', tick(hot, 0.05).crashed && hot.state === 'crashed')

  const off = makeWorld(1); off.state = 'playing'; calm(off)
  off.x = off.padX < VW / 2 ? VW - SEED_R - 2 : SEED_R + 2
  off.y = DEPTH_GOAL - SEED_R - 1; off.vx = 0; off.vy = 30
  ok('off-pad = crashed', tick(off, 0.05).crashed && off.state === 'crashed')
}

// 9. depth grows the score; determinism
{
  const w = makeWorld(7); w.state = 'playing'; calm(w)
  for (let i = 0; i < 30; i++) tick(w, 0.05)
  ok('falling grows the score', w.score > 0)

  const a = makeWorld(2024), b = makeWorld(2024), c = makeWorld(2025)
  ok('same seed → same pad + branches', a.padX === b.padX && a.branches.length === b.branches.length)
  ok('different seed → different pad', a.padX !== c.padX)
}

console.log(`\nSEEDFALL sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
