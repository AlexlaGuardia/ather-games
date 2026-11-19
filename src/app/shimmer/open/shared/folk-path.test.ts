// shared/folk-path.ts: a folk rig walks a polyline at its pace, turns (never snaps) toward its heading, and goes round a pool.
import { stepWalk, startWalk, turnToward, faceYaw, aroundPath, segClear, WALK_SPEED, TURN_RATE } from './folk-path'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e

ok(near(faceYaw({ x: 0, z: 0 }, { x: 0, z: 1 }), 0) && near(faceYaw({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2), 'rig yaw: +z is 0, +x is pi/2')
ok(near(turnToward(0, 1, 0.25), 0.25) && near(turnToward(0, 0.1, 0.25), 0.1), 'turns at most max, lands on target when close')
ok(near(turnToward(3, -3, 0.1), 3.1), 'turns the SHORT way across pi')

{ // one step of 1 s on a long straight walks exactly WALK_SPEED metres
  const s = stepWalk(startWalk({ x: 0, z: 0 }, 0), [{ x: 0, z: 10 }], 1)
  ok(near(s.z, WALK_SPEED) && near(s.x, 0) && !s.done, `1 s = ${WALK_SPEED} m along the leg`) }
{ // a step longer than the leg spends the rest on the next one
  const s = stepWalk(startWalk({ x: 0, z: 0 }, 0), [{ x: 0, z: 1 }, { x: 5, z: 1 }], 1)
  ok(s.leg === 1 && near(s.z, 1) && near(s.x, WALK_SPEED - 1), 'the leftover distance carries round the corner') }
{ // reaching the last point is done, and stands exactly on it
  let w = startWalk({ x: 0, z: 0 }, 0), d = false
  for (let i = 0; i < 100 && !d; i++) { const s = stepWalk(w, [{ x: 2, z: 2 }, { x: 3, z: -1 }], 0.1); w = s; d = s.done }
  ok(d && near(w.x, 3) && near(w.z, -1), 'arrives and stands exactly on the last point') }
{ // turning: a sharp heading change is eased over frames, not snapped
  const s = stepWalk(startWalk({ x: 0, z: 0 }, 0), [{ x: 0, z: -10 }], 0.05)
  ok(Math.abs(s.yaw) <= TURN_RATE * 0.05 + 1e-9 && Math.abs(s.yaw) > 0, 'a U-turn eases (one frame turns at most TURN_RATE*dt)') }
ok(stepWalk(startWalk({ x: 1, z: 1 }, 0), [], 0.1).done, 'no points: done at once')
ok(near(stepWalk(startWalk({ x: 0, z: 0 }, 0), [{ x: 0, z: 5 }], -1).z, 0), 'a negative dt does not walk backwards')

{ // round a pool: every point of the path keeps the radius, ends at b; a clear line stays straight
  const c = { x: 0, z: 0 }, r = 4, a = { x: 0, z: -6 }, b = { x: 0, z: 6 }
  const p = aroundPath(a, b, c, r)
  ok(p.length > 2 && p[p.length - 1] === b, 'blocked: goes round, ends at b')
  let prev = a, clear = true
  for (const q of p) { if (!segClear(prev, q, c, r - 0.25)) clear = false; prev = q }   // chords of a 0.5 rad ring dip ~3% inside it
  ok(clear, 'no leg of the path cuts into the pool')
  ok(aroundPath({ x: 6, z: -6 }, { x: 6, z: 6 }, c, r).length === 1, 'clear line: straight') }

console.log(`folk-path: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
