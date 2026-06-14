// SEEDFALL sim sanity — run with: npx tsx src/app/seedfall/lib/seedfall.test.ts
import {
  makeWorld,
  setInput,
  tick,
  loadGarden, // ensure exports resolve
  VW,
  GROUND_Y,
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

// 3. thrust counters gravity + burns fuel
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  setInput(w, true, true) // both = straight up
  tick(w, 0.1)
  ok('both-thrust lifts (vy negative)', w.vy < 0)
  ok('fuel burned', w.fuel < FUEL_MAX)
}

// 4. out of fuel = no thrust
{
  const w = makeWorld(1); w.state = 'playing'; calm(w); w.fuel = 0
  setInput(w, true, true)
  tick(w, 0.1)
  ok('no fuel → still falls', w.vy > 0 && w.thrusting === false)
}

// 5. lateral thrust steers
{
  const l = makeWorld(1); l.state = 'playing'; calm(l); setInput(l, true, false); tick(l, 0.1)
  ok('left thrust pushes left', l.vx < 0)
  const r = makeWorld(1); r.state = 'playing'; calm(r); setInput(r, false, true); tick(r, 0.1)
  ok('right thrust pushes right', r.vx > 0)
}

// 6. soft landing on the pad plants
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  w.x = w.padX; w.y = GROUND_Y - SEED_R - 1; w.vx = 0; w.vy = 20 // gentle, centered
  const ev = tick(w, 0.05)
  ok('soft on-pad = landed', w.state === 'landed' && ev.landed)
  ok('a rating is given', ev.rating === 'perfect' || ev.rating === 'soft')
}

// 7. coming in hot = crash
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  w.x = w.padX; w.y = GROUND_Y - SEED_R - 1; w.vx = 0; w.vy = 240
  const ev = tick(w, 0.05)
  ok('hard landing = crashed', w.state === 'crashed' && ev.crashed)
}

// 8. missing the soil = crash even if gentle
{
  const w = makeWorld(1); w.state = 'playing'; calm(w)
  w.x = w.padX < VW / 2 ? VW - SEED_R - 2 : SEED_R + 2 // opposite side from the pad, on-screen
  w.y = GROUND_Y - SEED_R; w.vx = 0; w.vy = 30 // gentle, but missing the soil
  const ev = tick(w, 0.05)
  ok('off-pad = crashed', w.state === 'crashed' && ev.crashed)
}

// 9. determinism
{
  const a = makeWorld(2024), b = makeWorld(2024), c = makeWorld(2025)
  ok('same seed → same pad', a.padX === b.padX && a.padW === b.padW)
  ok('different seed → different pad', a.padX !== c.padX)
}

console.log(`\nSEEDFALL sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
