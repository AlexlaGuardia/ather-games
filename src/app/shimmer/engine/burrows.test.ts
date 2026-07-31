// Burrows oracle — run: npx tsx src/app/shimmer/engine/burrows.test.ts
//
// What this file guards: a derived patrol has the same invisible failure modes as the
// derived board. A loop that differs by one dropped waypoint between two clients puts the
// same moglin in two places at once. A pose that jumps at the pause/leg seam reads as
// teleporting once per lap. A beaten record keyed wrong brings a beaten patrol back
// mid-window (cheap grinding) or never (a dead burrow that still shows a mouth). And a
// waypoint ring that ignores terrain marches a body through a rock, which is the one
// thing the whole loop-validation machinery exists to prevent.

import {
  patrolDown, markBeaten, pruneBeaten, patrolLoop, patrolPose,
  PATROL_RADIUS, PATROL_SPEED, PATROL_PAUSE_S, EMERGE_MS,
  type BeatenRecord, type PatrolLoop,
} from './burrows'
import { windowAt, WINDOW_MS, type DealWindow } from './spawn-board'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

console.log('\nburrows oracle\n')

const winAt = (i: number): DealWindow => ({ index: i, startMs: i * WINDOW_MS, endMs: (i + 1) * WINDOW_MS })

console.log('the beaten record follows the window, not the clock')
{
  const w5 = winAt(5), w6 = winAt(6)
  let rec: BeatenRecord = {}
  check('an untouched burrow presses', !patrolDown(rec, 'a:1,2', w5))
  rec = markBeaten(rec, 'a:1,2', w5)
  check('beaten this window → down this window', patrolDown(rec, 'a:1,2', w5))
  check('…for the ENTIRE window, no 10-min early return', patrolDown(rec, 'a:1,2', w5))
  check('next deal presses again', !patrolDown(rec, 'a:1,2', w6))
  check('a different burrow is untouched by the win', !patrolDown(rec, 'a:9,9', w5))
  const pruned = pruneBeaten(rec, w6)
  check('prune drops spent windows', Object.keys(pruned).length === 0)
  const kept = pruneBeaten(markBeaten({}, 'b:3,3', w6), w6)
  check('prune keeps the live window', patrolDown(kept, 'b:3,3', w6))
}

console.log('\nthe loop is deterministic and terrain-honest')
{
  const open = () => true
  const l1 = patrolLoop(10, 10, open, 'zone:10,10')
  const l2 = patrolLoop(10, 10, open, 'zone:10,10')
  check('same key → identical loop', JSON.stringify(l1) === JSON.stringify(l2))
  const l3 = patrolLoop(10, 10, open, 'zone:11,10')
  check('different key → different walk', JSON.stringify(l1.points) !== JSON.stringify(l3.points))
  check('open ground keeps a real loop', l1.points.length >= 3, `${l1.points.length} points`)
  check('waypoints stay near the mouth', l1.points.every(p => Math.hypot(p.x - 10, p.y - 10) <= PATROL_RADIUS + 0.01))
  check('period covers legs + pauses', l1.periodS > l1.points.length * PATROL_PAUSE_S)

  // A wall splits the yard: nothing east of x=10 is walkable. Every kept waypoint and
  // every sampled leg must respect it.
  const walled = (x: number, _y: number) => x <= 10
  const lw = patrolLoop(10, 10, walled, 'zone:10,10')
  check('walled loop keeps no east-side point', lw.points.every(p => Math.round(p.x) <= 10))
  for (let i = 0; i < lw.points.length; i++) {
    const p = lw.points[i], q = lw.points[(i + 1) % lw.points.length]
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    if (Math.round(mid.x) > 10) { check('leg midpoint crosses the wall', false, `leg ${i}`); break }
  }
  const boxed = (x: number, y: number) => x === 10 && y === 10
  const lb = patrolLoop(10, 10, boxed, 'zone:10,10')
  check('boxed-in burrow → empty loop (idles at the mouth)', lb.points.length === 0)
}

console.log('\nthe pose is continuous, on-loop, and shared')
{
  const open = () => true
  const loop = patrolLoop(20, 20, open, 'meadow:20,20')
  const win = winAt(3)
  const t0 = win.startMs + EMERGE_MS + 1000
  const a = patrolPose(loop, 20, 20, t0, win)
  const b = patrolPose(loop, 20, 20, t0, win)
  check('two clients at the same ms agree exactly', a.x === b.x && a.y === b.y && a.facing === b.facing)
  check('emerged after the boundary beat', a.emerge === 1)
  const early = patrolPose(loop, 20, 20, win.startMs + EMERGE_MS / 2, win)
  check('mid-emerge is fractional', early.emerge > 0 && early.emerge < 1)

  // Walk a full period at 50ms steps: the body must never jump more than a step's worth
  // of walking, and must always sit within radius of the mouth.
  let prev = patrolPose(loop, 20, 20, t0, win)
  let maxJump = 0, offLeash = false
  const stepMs = 50
  for (let ms = t0 + stepMs; ms < t0 + loop.periodS * 1000 + 500; ms += stepMs) {
    const p = patrolPose(loop, 20, 20, ms, win)
    maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y))
    if (Math.hypot(p.x - 20, p.y - 20) > PATROL_RADIUS + 0.01) offLeash = true
    prev = p
  }
  const maxStep = PATROL_SPEED * (stepMs / 1000) * 1.5
  check('no teleport at any seam over a full lap', maxJump <= maxStep, `max jump ${maxJump.toFixed(3)} tiles vs ${maxStep.toFixed(3)}`)
  check('never strays past the leash', !offLeash)
  const lap1 = patrolPose(loop, 20, 20, t0, win)
  const lap2 = patrolPose(loop, 20, 20, t0 + loop.periodS * 1000, win)
  check('one period later → same spot (a true loop)', Math.hypot(lap1.x - lap2.x, lap1.y - lap2.y) < 0.05)

  // Pause beats exist and hold still.
  let pausedFrames = 0, total = 0
  for (let ms = t0; ms < t0 + loop.periodS * 1000; ms += stepMs) {
    if (patrolPose(loop, 20, 20, ms, win).paused) pausedFrames++
    total++
  }
  const pausedShare = pausedFrames / total
  const expectedShare = (loop.points.length * PATROL_PAUSE_S) / loop.periodS
  check('the look-around beats take their share of the lap', Math.abs(pausedShare - expectedShare) < 0.06,
    `${(pausedShare * 100).toFixed(1)}% vs expected ${(expectedShare * 100).toFixed(1)}%`)

  // The boxed idle still turns (so the mouth guard reads alive, not frozen).
  const empty: PatrolLoop = { points: [], periodS: 1, phaseS: 0, legs: [], speed: PATROL_SPEED, pauseS: PATROL_PAUSE_S }
  const i1 = patrolPose(empty, 5, 5, t0, win)
  const i2 = patrolPose(empty, 5, 5, t0 + 2000, win)
  check('an idle mouth-guard stands AT the mouth', i1.x === 5 && i1.y === 5)
  check('…and slowly turns', i1.facing !== i2.facing)
}

console.log('\nphase offsets desynchronize neighbours')
{
  const open = () => true
  const win = winAt(0)
  const keys = ['z:5,5', 'z:15,5', 'z:5,15', 'z:15,15', 'z:25,25']
  const loops = keys.map(k => patrolLoop(30, 30, open, k))
  const phases = new Set(loops.map(l => l.phaseS.toFixed(3)))
  check('five burrows, five phases', phases.size === keys.length)
  const t = win.startMs + EMERGE_MS + 60_000
  const paused = loops.map(l => patrolPose(l, 30, 30, t, win).paused)
  check('not all in the same beat at once', new Set(paused).size > 1 || loops.length < 2)
}

console.log('\nthe pin cooperates (windowAt)')
{
  // ?window=N pins the deal index but the clock keeps running — beaten-at-pin must hold
  // within the pinned index, exactly like the resource board.
  const now = 99 * WINDOW_MS + 5_000
  const pinned = windowAt(now, 7)
  check('pin overrides the live index', pinned.index === 7)
  let rec: BeatenRecord = markBeaten({}, 'p:1,1', pinned)
  check('beaten under a pin stays down under that pin', patrolDown(rec, 'p:1,1', pinned))
  check('…and is up on the live window', !patrolDown(rec, 'p:1,1', windowAt(now, null)))
}

console.log('\nwander dials (the plot spirit ring reuses this machinery)')
{
  const open = () => true
  const dials = { radius: 4.5, speed: 0.7, pauseS: 3.4 }
  const l = patrolLoop(50, 50, open, 'plot:sp1', dials)
  check('dialed radius leashes the points', l.points.every(p => Math.hypot(p.x - 50, p.y - 50) <= 4.5 + 0.01))
  check('the loop carries its dials', l.speed === 0.7 && l.pauseS === 3.4)
  const ld = patrolLoop(50, 50, open, 'plot:sp1')
  check('no dials = the moglin constants (burrows unchanged)', ld.speed === PATROL_SPEED && ld.pauseS === PATROL_PAUSE_S)
  // The pose honors the dialed amble: max per-frame step bounded by the slower speed.
  const win = winAt(0)
  const t0 = win.startMs + EMERGE_MS + 500
  let prev = patrolPose(l, 50, 50, t0, win), maxJump = 0
  for (let ms = t0 + 50; ms < t0 + l.periodS * 1000; ms += 50) {
    const p = patrolPose(l, 50, 50, ms, win)
    maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y))
    prev = p
  }
  check('amble pace honored over a full lap', maxJump <= 0.7 * 0.05 * 1.5, `max ${maxJump.toFixed(3)}`)
}

console.log(failures === 0 ? '\nall green' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
