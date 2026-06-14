// WARD sim sanity — run with: npx tsx src/app/ward/lib/ward.test.ts
// No UI. Proves the core loop is right before we draw a single pixel.
import {
  makeWorld,
  startWave,
  fireBloom,
  tick,
  bloomRadius,
  aliveSpires,
  BLOOM_MAX,
  BLOOM_GROW,
  GROUND_Y,
  NUM_SPIRES,
  type World,
} from './ward'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.error(`  ✗ ${name}`)
  }
}

// 1. world boots into wave 1 with the right shape
{
  const w = makeWorld(123)
  ok('starts on wave 1', w.wave === 1)
  ok('all spires alive', aliveSpires(w) === NUM_SPIRES)
  ok('wave 1 queues 6 blight (4 + wave*2)', w.toSpawn.length === 6)
  ok('ammo refilled to max', w.ammo === w.maxAmmo && w.ammo === 13)
  ok('all blight spawn above the field', w.toSpawn.every((b) => b.y < 0))
  ok('every blight aims at a real spire', w.toSpawn.every((b) => b.target >= 0 && b.target < NUM_SPIRES))
}

// 2. bloom radius envelope: 0 → max → 0
{
  ok('radius 0 at age 0', bloomRadius(0) === 0)
  ok('radius peaks at grow end', Math.abs(bloomRadius(BLOOM_GROW) - BLOOM_MAX) < 0.01)
  ok('radius back to ~0 after life', bloomRadius(2) === 0)
}

// 3. firing spends ammo and stops at empty
{
  const w = makeWorld(7)
  const startAmmo = w.ammo
  ok('fire returns true with ammo', fireBloom(w, 100, 100) === true)
  ok('ammo decremented', w.ammo === startAmmo - 1)
  ok('a bloom exists', w.blooms.length === 1)
  w.ammo = 0
  ok('fire returns false when empty', fireBloom(w, 100, 100) === false)
  ok('no bloom added when empty', w.blooms.length === 1)
}

// 4. a bloom on top of a blight intercepts it and scores
{
  const w = makeWorld(7)
  w.toSpawn = []
  w.blight = [{ x: 200, y: 200, ox: 200, oy: -10, vx: 0, vy: 0, target: 0, alive: true }]
  fireBloom(w, 200, 200) // bloom centered on the blight
  const ev = tick(w, 0.05) // radius now > 3, overlaps
  ok('blight intercepted', ev.intercepts === 1)
  ok('blight removed', w.blight.length === 0)
  ok('score went up', w.score > 0)
  ok('combo incremented', w.combo === 1)
}

// 5. a blight reaching the ground destroys a live spire
{
  const w = makeWorld(7)
  w.toSpawn = []
  const tx = w.spires[2].x
  w.blight = [{ x: tx, y: GROUND_Y - 1, ox: tx, oy: -10, vx: 0, vy: 200, target: 2, alive: true }]
  const before = aliveSpires(w)
  const ev = tick(w, 0.05)
  ok('spire hit reported', ev.spireHits === 1)
  ok('one fewer spire', aliveSpires(w) === before - 1)
  ok('that spire is dead', w.spires[2].alive === false)
}

// 6. losing the last spire ends the run
{
  const w = makeWorld(7)
  w.toSpawn = []
  w.spires.forEach((s, i) => (s.alive = i === 4)) // only spire 4 left
  const tx = w.spires[4].x
  w.blight = [{ x: tx, y: GROUND_Y - 1, ox: tx, oy: -10, vx: 0, vy: 200, target: 4, alive: true }]
  const ev = tick(w, 0.05)
  ok('game over fired', ev.gameOver === true)
  ok('state is over', w.state === 'over')
  ok('tick is a no-op after game over', tick(w, 1).intercepts === 0)
}

// 7. clearing a wave (no blight left, none queued) advances and refills
{
  const w = makeWorld(7)
  w.toSpawn = []
  w.blight = []
  const ev = tick(w, 0.05)
  ok('wave cleared reported', ev.waveCleared === true)
  ok('state went to wavebreak', w.state === 'wavebreak')
  // let the break elapse
  let guard = 0
  while (w.state === 'wavebreak' && guard++ < 1000) tick(w, 0.1)
  ok('advanced to wave 2', w.wave === 2)
  ok('wave 2 has 8 blight', w.toSpawn.length === 8)
}

// 8. determinism — same seed, same first spawn
{
  const a = makeWorld(999)
  const b = makeWorld(999)
  ok('same seed → same blight origin', a.toSpawn[0].ox === b.toSpawn[0].ox)
  const c = makeWorld(1000)
  ok('different seed → different field', a.toSpawn[0].ox !== c.toSpawn[0].ox)
}

console.log(`\nWARD sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
