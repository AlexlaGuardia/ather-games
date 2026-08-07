// Locomotion oracle. Run: npx tsx src/app/shimmer/voxel3d/locomotion.test.ts
//
// Movement bugs are feel bugs, and feel bugs get reported as vibes ("it's a dash now"). These
// asserts pin the behaviours behind the vibes: each one is a verb a player counts on, run against
// a synthetic grid where the answer is knowable.

import {
  createLoco, tickLocomotion, bodyFree, floorProbe,
  RUN_SPEED, JUMP_V0, SLIDE_SPEED, SLIDEHOP_BOOST, WALLJUMP_PUSH,
  CLIMB_HOLD_MIN, CLIMB_MAX_RISE, EYE_STAND, EYE_SLIDE, type LocoInput,
} from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const DT = 1 / 60
const input = (o: Partial<LocoInput> = {}): LocoInput => ({
  mvX: 0, mvZ: 0, fwdX: 1, fwdZ: 0, rightX: 0, rightZ: 1,
  jumpKey: false, crouchKey: false, dt: DT, ...o,
})

/** Flat floor at y<10 (top = 10), plus whatever `extra` says is solid. */
const world = (extra: (x: number, y: number, z: number) => boolean = () => false) =>
  (x: number, y: number, z: number) => y < 10 || extra(x, y, z)

const settle = (s: ReturnType<typeof createLoco>, solid: any, frames = 30) => {
  for (let i = 0; i < frames; i++) tickLocomotion(s, input(), solid)
}

// ── run ramps, coasts, and never teleports to speed ──────────────────────────────────────────
{
  const solid = world()
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  tickLocomotion(s, input({ mvX: 1 }), solid)
  const v1 = Math.hypot(s.hvx, s.hvz)
  ok(v1 > 0 && v1 < RUN_SPEED * 0.5, `first frame of input is a ramp, not full speed (${v1.toFixed(2)})`)
  for (let i = 0; i < 120; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  ok(Math.abs(Math.hypot(s.hvx, s.hvz) - RUN_SPEED) < 0.1, 'sustained input reaches run speed')
  for (let i = 0; i < 120; i++) tickLocomotion(s, input(), solid)
  ok(Math.hypot(s.hvx, s.hvz) < 0.05, 'release coasts to a stop')
}

// ── ★ the vault: a 1-block rise blocks the run; JUMP into it mantles up (Alex, 07-08-07) ─────
{
  const solid = world((x, y) => x >= 3 && y < 11)     // a 1-block terrace at x=3
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 150; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  ok(s.px < 3 - 0.29 && s.py === 10, `★ walking into a 1-block rise STOPS — no auto-climb (x ${s.px.toFixed(2)})`)
  const speedBefore = RUN_SPEED  // was at full run when the wall killed hvx; rebuild a step of speed
  for (let i = 0; i < 30; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  ok(s.mantleT > 0 && s.vaulting, '★ jump at the step starts a vault, not a ballistic jump')
  let frames = 0
  while (s.mantleT > 0 && frames < 60) { tickLocomotion(s, input({ mvX: 1 }), solid); frames++ }
  ok(frames > 3, `the vault is eased over real frames (${frames}), not a snap`)
  ok(Math.abs(s.py - 11) < 0.01 && !s.airborne, `and lands standing on the step (feet ${s.py.toFixed(2)})`)
  ok(Math.hypot(s.hvx, s.hvz) > speedBefore * 0.5, `★ speed carries through the vault (${Math.hypot(s.hvx, s.hvz).toFixed(2)})`)
}

// ── ★ a staircase ladders under repeated jump presses ────────────────────────────────────────
{
  const stair = (x: number, y: number, _z: number) => x >= 3 && y < 10 + Math.min(4, Math.floor((x - 3) / 2) + 1)
  const solid = world(stair)
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  for (let step = 0; step < 4; step++) {
    for (let i = 0; i < 40; i++) tickLocomotion(s, input({ mvX: 1 }), solid)          // run to the face
    tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)                        // press
    for (let i = 0; i < 30; i++) tickLocomotion(s, input({ mvX: 1 }), solid)          // ride it out
  }
  ok(Math.abs(s.py - 14) < 0.05, `★ four presses climb four stairs (feet ${s.py.toFixed(2)})`)
}

// ── a 2-high face never vaults — that is climb country ───────────────────────────────────────
{
  const solid = world((x, y) => x >= 3 && y < 12)
  const s = createLoco(1.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 60; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  ok(!s.vaulting && s.airborne && s.vy > 0, '★ jump at a 2-high wall is a real jump, never a vault')
}

// ── slide is a burst that bleeds back; slide-hop pops it ─────────────────────────────────────
{
  const solid = world()
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 120; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  tickLocomotion(s, input({ mvX: 1, crouchKey: true }), solid)
  const slideV = Math.hypot(s.hvx, s.hvz)
  // One tick of bleed already applies on the entry tick (play3d does the same), hence the margin.
  ok(s.sliding && slideV >= SLIDE_SPEED - 0.15, `crouch at speed slides at ≈${SLIDE_SPEED} (${slideV.toFixed(2)})`)
  // eye dips over the slide
  for (let i = 0; i < 20; i++) tickLocomotion(s, input({ mvX: 1, crouchKey: true }), solid)
  ok(s.eye < (EYE_STAND + EYE_SLIDE) / 2, `eye dips into the slide (${s.eye.toFixed(2)})`)
  // slide-hop: jump mid-slide multiplies takeoff
  const before = Math.hypot(s.hvx, s.hvz)
  tickLocomotion(s, input({ mvX: 1, crouchKey: true, jumpKey: true }), solid)
  ok(s.justHopped && s.airborne, 'jump mid-slide is a slide-hop')
  ok(s.airSpeed > before * (SLIDEHOP_BOOST - 0.02), `the hop pops takeoff speed (${s.airSpeed.toFixed(2)} from ${before.toFixed(2)})`)
  // ...and it is NOT a dash: speed lives in the airborne momentum, not a ground teleport
  ok(s.vy > JUMP_V0 - 0.01, 'the hop is a real jump, not a ground dash')
}

// ── ★ wall jump: tap against a wall kicks up and away ────────────────────────────────────────
{
  const solid = world((x, y) => x >= 4 && y < 16)     // a tall wall at x=4
  const s = createLoco(2.5, 10, 0.5); settle(s, solid)
  // run at the wall and jump just before it
  for (let i = 0; i < 40; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)      // takeoff
  for (let i = 0; i < 12; i++) tickLocomotion(s, input({ mvX: 1 }), solid)  // fly into the wall
  ok(s.onWall || s.wallStick > 0, 'pressed into the wall mid-air registers contact')
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)      // tap = wall jump
  ok(s.justWallJumped, '★ Space tap on the wall is a wall jump')
  ok(s.hvx <= -WALLJUMP_PUSH + 0.01, `the kick pushes AWAY from the face (hvx ${s.hvx.toFixed(2)})`)
  ok(s.vy > 0, 'and upward')
}

// ── ★ climb: holding Space against a wall scrambles up, grip is finite ───────────────────────
{
  const solid = world((x, y) => x >= 4 && y < 16)
  const s = createLoco(3.2, 10, 0.5); settle(s, solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)      // leave the ground
  const holdFrames = Math.ceil((CLIMB_HOLD_MIN + 0.05) / DT)
  for (let i = 0; i < holdFrames; i++) tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  ok(s.climbing, '★ held Space against the wall climbs')
  const y0 = s.py
  for (let i = 0; i < 30; i++) tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  ok(s.py > y0, `climbing rises (${(s.py - y0).toFixed(2)})`)
  for (let i = 0; i < 200; i++) tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  ok(s.climbRise >= CLIMB_MAX_RISE || !s.climbing || s.hanging, 'grip is finite — no infinite scramble up one face')
}

// ── ★ mantle: a lip in reach during a held climb grabs and HANGS — never a snap ──────────────
{
  const solid = world((x, y) => x >= 4 && x < 6 && y < 12)   // a 2-high ledge at x=4
  const s = createLoco(3.2, 10, 0.5); settle(s, solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
  // One continuous loop — after topping out the walker keeps running and exits the far side of the
  // ledge, so everything must be observed in sequence, not in a second loop that starts too late.
  let hung = false, onTopInstantly = false, commitFrame = -1, topFrame = -1, stoodOnTop = false
  for (let i = 0; i < 120; i++) {
    tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)
    if (s.hanging) hung = true
    if (!hung && s.py >= 12 - 0.01) onTopInstantly = true
    if (hung && commitFrame < 0 && s.mantleT > 0) commitFrame = i
    if (commitFrame >= 0 && topFrame < 0 && s.py >= 12 - 0.01) topFrame = i
    if (topFrame >= 0 && !s.airborne) { stoodOnTop = true; break }
  }
  ok(hung, '★ the lip is grabbed into a hang')
  ok(!onTopInstantly, '★ never teleported on top without the hang')
  ok(commitFrame >= 0 && topFrame > commitFrame + 5, `★ pull-up is eased over real frames (${topFrame - commitFrame}), not a snap`)
  ok(stoodOnTop, 'and lands standing on the ledge')
}

// ── tap-jump near a wall is a pure jump — the Apex tap/hold line ─────────────────────────────
{
  const solid = world((x, y) => x >= 4 && y < 12)
  const s = createLoco(3.2, 10, 0.5); settle(s, solid)
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)   // tap...
  tickLocomotion(s, input({ mvX: 1 }), solid)                  // ...released
  ok(s.airborne && !s.hanging && !s.climbing, 'a jump tap into a wall neither hangs nor climbs')
}

// ── primitives hold their contracts ──────────────────────────────────────────────────────────
{
  const solid = world()
  ok(bodyFree(solid, 0.5, 0.5, 10), 'body fits in open air')
  ok(!bodyFree(solid, 0.5, 0.5, 9), 'body overlapping the floor does not')
  ok(floorProbe(solid, 0.5, 0.5, 10) === 10, 'floor probe finds the floor under the feet')
  ok(floorProbe(solid, 0.5, 0.5, 30) === null, 'no floor within range reads as none — never a phantom')
}

console.log(`\nlocomotion: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the walker moves like play3d')
