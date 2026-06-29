// VAULT sim sanity — run with: npx tsx src/app/vault/lib/vault.test.ts
import {
  makeWorld, tick, pressJump, releaseJump,
  diffAt, speedAt, // ensure exports resolve
  TOP_BASE, FOE_W, FOE_H, SPIKE_H, MOTE_R, JUMP_V0, DEATH_Y, RUNNER_H,
  type World, type Seg,
} from './vault'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
// give a world a flat, infinite, hazard-free floor, freeze generation, and reset to a clean grounded
// baseline (clears any buffered jump) — for isolated physics tests
function flat(w: World) {
  w.segs = [{ x0: -500, x1: 1e9, top: TOP_BASE } as Seg]
  w.foes = []; w.spikes = []; w.motes = []
  w.genX = 1e12; w.lastTop = TOP_BASE
  w.y = TOP_BASE; w.vy = 0; w.grounded = true; w.jumping = false; w.coyote = 0; w.buffer = 0
}

// 1. state machine
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  tick(w, 0.1); ok('ready does not advance', w.dist === 0)
  pressJump(w); ok('press → playing', w.state === 'playing')
}

// 2. runs forward + survives the nursery runway
{
  const w = makeWorld(7); pressJump(w)
  let alive = true
  for (let i = 0; i < 120 && alive; i++) { tick(w, 0.016); if (w.state === 'dead') alive = false }
  ok('advances downrange', w.dist > 200)
  ok('survives the flat runway', alive)
}

// 3. variable jump — holding clears higher than a tap
{
  const hold = makeWorld(3); flat(hold); pressJump(hold)
  const tap = makeWorld(3); flat(tap); pressJump(tap)
  // launch both
  tick(hold, 0.016); tick(tap, 0.016)
  releaseJump(tap) // tap = release immediately after launch
  let minHold = hold.y, minTap = tap.y
  for (let i = 0; i < 90; i++) {
    tick(hold, 0.016); tick(tap, 0.016)
    minHold = Math.min(minHold, hold.y); minTap = Math.min(minTap, tap.y)
  }
  ok('hold jumps higher than tap', minHold < minTap - 20)
  ok('both actually left the ground', minTap < TOP_BASE - 10)
}

// 4. coyote time — a jump just after leaving a ledge still fires
{
  const w = makeWorld(5); pressJump(w); flat(w)
  // settle on the ground
  for (let i = 0; i < 5; i++) tick(w, 0.016)
  ok('grounded after settling', w.grounded)
  // simulate walking off an edge: drop the floor, leaving coyote
  w.grounded = false; w.coyote = 0.08; w.vy = 0; w.jumping = false
  pressJump(w); tick(w, 0.01)
  ok('coyote jump fires (vy up)', w.vy < 0 && w.jumping)
}

// 5. jump buffer — a press just before touchdown fires on landing
{
  const w = makeWorld(9); pressJump(w); flat(w)
  // airborne, descending, just above the floor
  w.grounded = false; w.jumping = false; w.coyote = 0; w.vy = 200; w.y = TOP_BASE - 4
  pressJump(w) // buffered while still in the air
  let jumped = false
  for (let i = 0; i < 8; i++) { tick(w, 0.016); if (w.events.some(e => e.type === 'jump')) jumped = true }
  ok('buffered press fires on landing', jumped)
}

// 6. stomp — descending onto a foe kills it and bounces
{
  const w = makeWorld(11); pressJump(w); flat(w)
  w.foes = [{ x: w.dist + 2, y: TOP_BASE, dead: false }]
  w.grounded = false; w.jumping = true; w.vy = 130; w.y = TOP_BASE - FOE_H + 4
  tick(w, 0.016)
  ok('foe stomped (dead)', w.foes[0].dead)
  ok('stomp bounces up', w.vy < 0)
  ok('combo = 1', w.combo === 1)
  ok('stomp scored', w.stompScore > 0)
}

// 7. side-hit a foe = death
{
  const w = makeWorld(12); pressJump(w); flat(w)
  for (let i = 0; i < 3; i++) tick(w, 0.016) // grounded, running
  w.foes = [{ x: w.dist + 1, y: TOP_BASE, dead: false }]
  w.vy = 0; w.grounded = true; w.y = TOP_BASE
  tick(w, 0.016)
  ok('side contact kills (foe)', w.state === 'dead' && w.events.some(e => e.type === 'death' && e.cause === 'foe'))
}

// 8. spike = death (never stompable, even from above)
{
  const w = makeWorld(13); pressJump(w); flat(w)
  w.spikes = [{ x: w.dist + 2, y: TOP_BASE }]
  w.grounded = false; w.vy = 150; w.y = TOP_BASE - SPIKE_H + 4
  tick(w, 0.016)
  ok('spike contact kills (spike)', w.state === 'dead' && w.events.some(e => e.type === 'death' && e.cause === 'spike'))
}

// 9. gap = death (fall past the death line)
{
  const w = makeWorld(15); pressJump(w)
  w.segs = []; w.genX = 1e12 // no ground anywhere, no generation
  w.grounded = false; w.vy = 0; w.y = TOP_BASE
  let died = false
  for (let i = 0; i < 120 && !died; i++) { tick(w, 0.016); if (w.state === 'dead') died = true }
  ok('falling into a gap kills (gap)', died && w.y > DEATH_Y - 1 || w.events.some(e => e.type === 'death' && e.cause === 'gap'))
}

// 10. mote collect
{
  const w = makeWorld(17); pressJump(w); flat(w)
  w.motes = [{ x: w.dist + 2, y: TOP_BASE - RUNNER_H / 2, got: false }]
  tick(w, 0.016)
  ok('mote collected', w.motes[0].got && w.motesGot === 1)
}

// 11. combo — two aerial stomps without landing stack the multiplier
{
  const w = makeWorld(19); pressJump(w); flat(w)
  w.foes = [{ x: w.dist + 2, y: TOP_BASE, dead: false }]
  w.grounded = false; w.jumping = true; w.vy = 130; w.y = TOP_BASE - FOE_H + 4
  tick(w, 0.016)
  const after1 = w.stompScore
  // second foe, still airborne (no landing in between)
  w.foes.push({ x: w.dist + 2, y: TOP_BASE, dead: false })
  w.vy = 130; w.y = TOP_BASE - FOE_H + 4
  tick(w, 0.016)
  ok('combo = 2', w.combo === 2)
  ok('second stomp worth more', w.stompScore - after1 > after1)
}

// 12. determinism — same seed + same input → identical run
{
  const run = (seed: number) => {
    const w = makeWorld(seed); pressJump(w)
    for (let i = 0; i < 300; i++) { if (i % 40 === 0) pressJump(w); if (i % 40 === 12) releaseJump(w); tick(w, 0.016) }
    return { dist: Math.round(w.dist), score: w.score, state: w.state }
  }
  const a = run(424242), b = run(424242)
  ok('deterministic dist', a.dist === b.dist)
  ok('deterministic score', a.score === b.score)
  // dist is seed-INDEPENDENT by design (speed depends only on distance) — so compare the COURSE the
  // seed actually generates. Tick a bit first (still safely on the flat runway) so terrain past the
  // runway is generated, then sign the generated segments' heights + hazard counts.
  const courseSig = (seed: number) => {
    const w = makeWorld(seed); pressJump(w)
    for (let i = 0; i < 150; i++) tick(w, 0.016)
    const gen = w.segs.filter(s => s.x0 >= 900)
    return gen.map(s => Math.round(s.top)).join(',') + `#f${w.foes.length}#s${w.spikes.length}#m${w.motes.length}`
  }
  ok('different seed → different course', courseSig(424242) !== courseSig(999))
}

// 13. difficulty ramp monotonic + speed rises
{
  ok('diff rises with distance', diffAt(0) < diffAt(3000) && diffAt(3000) < diffAt(9000))
  ok('speed rises with distance', speedAt(0) < speedAt(6500))
  ok('diff caps at 1', diffAt(1e9) <= 1)
}

// 14. double-jump — a stomp banks ONE air-jump; tapping mid-air fires it; landing clears it
{
  const w = makeWorld(21); pressJump(w); flat(w)
  // stomp a foe (airborne, descending onto it)
  w.foes = [{ x: w.dist + 2, y: TOP_BASE, dead: false }]
  w.grounded = false; w.jumping = true; w.vy = 130; w.y = TOP_BASE - FOE_H + 4
  tick(w, 0.016)
  ok('stomp banks an air-jump', w.airJumps === 1)
  // now airborne after the bounce; a buffered press fires a second jump and spends the charge
  pressJump(w); tick(w, 0.016)
  ok('air-jump fires mid-air', w.events.some(e => e.type === 'jump' && e.air === true))
  ok('air-jump relaunches upward', w.vy < 0)
  ok('air-jump is spent (one per stomp)', w.airJumps === 0)
  // a SECOND mid-air press with no charge left does nothing
  w.events.length = 0
  pressJump(w); tick(w, 0.016)
  ok('no third jump without another stomp', !w.events.some(e => e.type === 'jump'))
}

// 15. no free double-jump — a plain ground jump grants no air-jump
{
  const w = makeWorld(23); pressJump(w); flat(w)
  pressJump(w); tick(w, 0.016) // ground jump launches
  ok('airborne from ground jump', !w.grounded && w.vy < 0)
  ok('ground jump banks no air-jump', w.airJumps === 0)
  w.events.length = 0
  pressJump(w); tick(w, 0.016) // press again mid-air — nothing to spend
  ok('cannot air-jump without stomping', !w.events.some(e => e.type === 'jump'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
