// SQUALL sim sanity — run with: npx tsx src/app/squall/lib/squall.test.ts
import {
  makeWorld,
  setHeading,
  tick,
  addBullet,
  loadBest,
  saveBest,
  diffAt, // ensure exports resolve
  VW,
  VH,
  PLAYER_R,
  GRAZE_R,
  RAMP_T, // ensure exports resolve
  type World,
} from './squall'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
// freeze the director so hand-placed bullets aren't crowded by waves
function solo(w: World) { w.bullets = []; w.warnings = []; w.emitters = []; w.spawnPaused = true }

// 1. ready → playing on first heading; zero heading doesn't launch
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('tick no-op while ready', tick(w, 0.1).dead === false && w.state === 'ready')
  setHeading(w, 0, 0)
  ok('zero heading stays ready', w.state === 'ready')
  setHeading(w, 1, 0)
  ok('a real heading launches', w.state === 'playing')
}

// 2. movement — the mote eases toward the heading, clamps to the arena
{
  const w = makeWorld(1); w.state = 'playing'; solo(w)
  setHeading(w, 1, 0); for (let i = 0; i < 10; i++) tick(w, 1 / 60)
  ok('heading right moves +x', w.x > VW / 2)
  setHeading(w, -1, 0); for (let i = 0; i < 600; i++) tick(w, 1 / 60)
  ok('clamps to the left wall', w.x >= PLAYER_R - 0.001 && w.x < 30)
}

// 3. a bullet on the mote ends the run; a far one doesn't
{
  const w = makeWorld(2); w.state = 'playing'; solo(w)
  addBullet(w, w.x, w.y - 30, 0, 600, 6) // dead-on, fast, from just above
  let dead = false
  for (let i = 0; i < 30 && w.state === 'playing'; i++) if (tick(w, 1 / 60).dead) dead = true
  ok('a bullet to the hitbox kills', dead && (w.state as string) === 'dead')
  ok('death scores survival time', w.score >= 0)

  const w2 = makeWorld(2); w2.state = 'playing'; solo(w2)
  addBullet(w2, 10, 10, 0, 0, 6) // parked in the corner, far from the mote
  for (let i = 0; i < 30; i++) tick(w2, 1 / 60)
  ok('a far bullet is harmless', w2.state === 'playing')
}

// 4. graze — a near pass banks graze once, never kills
{
  const w = makeWorld(3); w.state = 'playing'; solo(w)
  // a bullet sliding past at graze distance (outside the hitbox, inside GRAZE_R)
  const gy = w.y - (PLAYER_R + GRAZE_R - 4)
  addBullet(w, w.x - 60, gy, 400, 0, 6) // crosses horizontally just above the mote
  let grazes = 0
  for (let i = 0; i < 60 && w.state === 'playing'; i++) if (tick(w, 1 / 60).grazed) grazes++
  ok('a near pass banks a graze', w.graze >= 1 && w.state === 'playing')
  ok('one bullet grazes at most once', grazes === 1 && w.graze === 1)
  ok('graze feeds the score', w.score >= 5)
}

// 5. survival score grows with time
{
  const w = makeWorld(4); w.state = 'playing'; solo(w)
  for (let i = 0; i < 120; i++) tick(w, 1 / 60)
  const s1 = w.score
  for (let i = 0; i < 120; i++) tick(w, 1 / 60)
  ok('surviving grows the score', w.score > s1 && s1 > 0)
}

// 6. the director spawns waves, telegraphs resolve into bullets, difficulty escalates
{
  const w = makeWorld(5); w.state = 'playing' // director LIVE
  let everSpawned = false, everFired = false
  for (let i = 0; i < 60 * 12; i++) { const ev = tick(w, 1 / 60); if (ev.spawned) everSpawned = true; if (ev.fired) everFired = true }
  ok('the director fires patterns', everSpawned)
  ok('telegraphs resolve into bullets (some pattern aimed/burst/spiral)', everFired || w.bullets.length > 0)

  // escalation: bullet speed at high difficulty beats low
  ok('difficulty ramps 0→1 over the run', diffAt(0) < 0.05 && diffAt(RAMP_T) > 0.95 && diffAt(RAMP_T / 2) > diffAt(RAMP_T / 4))
}

// 7. bullets despawn once they leave the arena
{
  const w = makeWorld(6); w.state = 'playing'; solo(w)
  addBullet(w, VW / 2, VH - 4, 0, 400, 6) // heading down off the bottom
  for (let i = 0; i < 60; i++) tick(w, 1 / 60)
  ok('off-arena bullets are recycled', w.bullets.length === 0)
}

// 8. determinism — same seed, same storm
{
  const a = makeWorld(2024), b = makeWorld(2024), c = makeWorld(2025)
  a.state = b.state = c.state = 'playing'
  for (let i = 0; i < 60 * 8; i++) { setHeading(a, 0, -1); setHeading(b, 0, -1); setHeading(c, 0, -1); tick(a, 1 / 60); tick(b, 1 / 60); tick(c, 1 / 60) }
  ok('same seed → same bullet count', a.bullets.length === b.bullets.length)
  ok('same seed → same mote position', a.x === b.x && a.y === b.y)
  const diff = a.bullets.length !== c.bullets.length || a.warnings.length !== c.warnings.length
  ok('different seed → different storm', diff || a.x !== c.x)
}

// 9. best-score helpers survive a no-storage env (headless / SSR)
{
  let threw = false, b = -1
  try { b = saveBest(200); loadBest() } catch { threw = true }
  ok('best-score helpers survive no-storage', !threw && b >= 0)
}

console.log(`\nSQUALL sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
