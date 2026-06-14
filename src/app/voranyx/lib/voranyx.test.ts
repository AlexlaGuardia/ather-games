// VORANYX sim sanity — run with: npx tsx src/app/voranyx/lib/voranyx.test.ts
import {
  makeWorld,
  player,
  steer,
  setBoost,
  tick,
  score,
  BASE_MASS,
  START_MASS,
  BOOST_MAX,
  SPEED,
  ARENA_R0,
  type World,
} from './voranyx'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

// 1. boot
{
  const w = makeWorld(1, 8)
  const p = player(w)!
  ok('player exists', !!p)
  ok('player starts blank (no element)', p.element === null)
  ok('player starts at START_MASS', p.mass === START_MASS)
  ok('8 AI spawned', w.wyrms.filter((x) => !x.isPlayer).length === 8)
  ok('food stocked', w.food.length > 50)
}

// 2. head moves along heading
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = 0; p.y = 0; p.angle = 0; steer(w, 0)
  tick(w, 0.1)
  ok('moves +x on heading 0', p.x > 0 && Math.abs(p.y) < 1)
}

// 3. eating dross grows mass
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = 0; p.y = 0; p.angle = 0; steer(w, 0)
  w.food = [{ x: 2, y: 0, kind: 'dross' }]
  const m0 = p.mass
  const ev = tick(w, 0.016)
  ok('ate the dross', ev.ate >= 1) // (food restocks after, so don't assert empty)
  ok('mass grew', p.mass > m0)
}

// 4. first seed paints you; later seeds don't repaint
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = 0; p.y = 0; p.angle = 0; steer(w, 0); p.element = null
  w.food = [{ x: 1, y: 0, kind: 'seed', element: 'storm' }]
  const ev = tick(w, 0.016)
  ok('first seed sets element', p.element === 'storm' && ev.seed)
  w.food = [{ x: p.x + 1, y: p.y, kind: 'seed', element: 'water' }]
  tick(w, 0.016)
  ok('second seed does NOT repaint', p.element === 'storm')
}

// 5. metabolism: starve → shrink → revert to blank
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = 0; p.y = 0; w.food = []; p.mass = 60
  for (let i = 0; i < 40; i++) { w.food = []; tick(w, 0.1) }
  ok('starving shrinks mass', p.mass < 60)
  // drive all the way down
  p.mass = BASE_MASS + 0.004; p.element = 'storm'
  w.food = []; tick(w, 0.05)
  ok('reverts to blank at base mass', p.mass <= BASE_MASS + 0.02 && p.element === null)
}

// 6. boost drains charge and is faster; no charge = no boost
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = 0; p.y = 0; p.angle = 0; steer(w, 0); p.mass = 40; p.boost = BOOST_MAX
  w.food = []
  setBoost(w, true)
  const x0 = p.x
  tick(w, 0.1)
  const boosted = p.x - x0
  ok('boost drains charge', p.boost < BOOST_MAX)
  ok('boost is faster than cruise', boosted > SPEED * 0.1 + 1)
  // out of charge → cruise speed
  p.boost = 0; p.x = 0; p.angle = 0; steer(w, 0); setBoost(w, true)
  const x1 = p.x
  tick(w, 0.1)
  ok('no charge → no boost', p.x - x1 < SPEED * 0.1 + 1)
}

// 7. head into a body kills the hitter and drops bubbles
{
  const w = makeWorld(1, 1)
  const p = player(w)!
  const ai = w.wyrms.find((x) => !x.isPlayer)!
  ai.mass = 50; ai.angle = 0; ai.target = 0; ai.x = 200; ai.y = 0
  ai.trail = []
  for (let x = 0; x <= 200; x += 6) ai.trail.push(x, 0) // a straight body along y=0
  p.x = 100; p.y = 0; p.angle = 0; steer(w, 0); p.mass = 16
  w.food = [] // isolate the burst (a fall always drops at least a mote; restock adds ≤6)
  const ev = tick(w, 0.001)
  ok('player head into AI body = death', p.alive === false && ev.died)
  ok('death scattered bubbles', w.food.length > 6)
}

// 8. the void edge is lethal
{
  const w = makeWorld(1, 0)
  const p = player(w)!
  p.x = ARENA_R0 + 60; p.y = 0; p.angle = 0; steer(w, 0)
  const ev = tick(w, 0.01)
  ok('crossing the void ring kills', p.alive === false && ev.died)
}

// 9. determinism + score
{
  const a = makeWorld(2024, 4)
  const b = makeWorld(2024, 4)
  const aAi = a.wyrms.find((x) => !x.isPlayer)!
  const bAi = b.wyrms.find((x) => !x.isPlayer)!
  ok('same seed → same first AI spawn', aAi.x === bAi.x && aAi.y === bAi.y)
  ok('score reads player mass', score(a) === Math.round(player(a)!.mass))
}

console.log(`\nVORANYX sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
