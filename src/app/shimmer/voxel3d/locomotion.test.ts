// Locomotion oracle. Run: npx tsx src/app/shimmer/voxel3d/locomotion.test.ts
//
// Movement bugs are feel bugs, and feel bugs get reported as vibes ("it's a dash now"). These
// asserts pin the behaviours behind the vibes: each one is a verb a player counts on, run against
// a synthetic grid where the answer is knowable.

import {
  createLoco, tickLocomotion, bodyFree, floorProbe,
  RUN_SPEED, JUMP_V0, SLIDE_SPEED, SLIDEHOP_BOOST, WALLJUMP_PUSH,
  CLIMB_HOLD_MIN, CLIMB_MAX_RISE, EYE_STAND, EYE_SLIDE, type LocoInput,
  CELL_EMPTY, CELL_SOLID, CELL_WATER, SWIM_SPEED, SWIM_UP, SWIM_IDLE_SINK, TREAD_SINK_CAP,
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
  tickLocomotion(s, input({ mvX: 1 }), solid)
  // The blink regression: the lerp divided by MANTLE_TIME while the vault set VAULT_TIME, so the
  // ease began ~47% complete and ~70% of the height landed on frame one (Alex: "it just blinks
  // up"). One frame in, the rise must still be a beginning, not most of the climb.
  ok(s.py - 10 < 0.2, `★ the first vault frame is a beginning, not a blink (rose ${(s.py - 10).toFixed(2)})`)
  let frames = 1
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

// ── ★ the combo: HELD jump chains vault into vault up a tight staircase ──────────────────────
{
  // 1-block steps every single column — too tight to rebuild a run between presses, exactly the
  // shape the chain exists for. One held press must flow all the way up.
  const stair = (x: number, y: number, _z: number) => x >= 3 && y < 10 + Math.min(4, x - 2)
  const solid = world(stair)
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 60; i++) tickLocomotion(s, input({ mvX: 1 }), solid)            // run to the face
  for (let i = 0; i < 150; i++) tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)  // HOLD
  ok(Math.abs(s.py - 14) < 0.05, `★ one held jump chains up all four stairs (feet ${s.py.toFixed(2)})`)
  // ...and a TAP still climbs exactly one
  const s2 = createLoco(0.5, 10, 0.5); settle(s2, solid)
  for (let i = 0; i < 60; i++) tickLocomotion(s2, input({ mvX: 1 }), solid)
  tickLocomotion(s2, input({ mvX: 1, jumpKey: true }), solid)                         // tap
  for (let i = 0; i < 12; i++) tickLocomotion(s2, input({ mvX: 0 }), solid)           // release both
  ok(Math.abs(s2.py - 11) < 0.05, `a tap climbs exactly one (feet ${s2.py.toFixed(2)})`)
}

// ── ★ the vault is an interaction: it needs the ledge FACED, not just leaned into ────────────
{
  const solid = world((x, y) => x >= 3 && y < 11)
  const s = createLoco(2.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  // pushing INTO the step but LOOKING away from it (backpedaling toward it): jump must stay a jump
  tickLocomotion(s, input({ mvX: 1, fwdX: -1, jumpKey: true }), solid)
  ok(!s.vaulting && s.airborne && s.vy > 0, '★ jump only vaults when the ledge is faced — otherwise it jumps')
}

// ── ★ coyote: a jump pressed during a downhill micro-fall still fires ────────────────────────
{
  // Running down stepped terrain is a chain of walk-offs; the press between two descents used to
  // vanish entirely (Alex: "i tried jumping as i ran down a hill and nothing would happen").
  const solid = world((x, y) => x < 3 && y < 11)      // a 1-block drop at x=3
  const s = createLoco(1.5, 11, 0.5); settle(s, solid)
  for (let i = 0; i < 60 && !s.airborne; i++) tickLocomotion(s, input({ mvX: 1 }), solid)  // run off the edge
  ok(s.airborne, 'walked off the drop into a micro-fall')
  tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)   // press a hair late
  ok(s.vy > JUMP_V0 * 0.8, `★ the late press still jumps — coyote honours it (vy ${s.vy.toFixed(2)})`)
  // ...but a genuinely airborne press, past the grace, stays dead. A deep shaft this time — the
  // 1-block drop above LANDS within the wait, and a grounded press is a legitimate jump.
  const deep = (x: number, y: number, _z: number) => x < 3 ? y < 11 : y < 2
  const s2 = createLoco(1.5, 11, 0.5); settle(s2, deep)
  for (let i = 0; i < 60 && !s2.airborne; i++) tickLocomotion(s2, input({ mvX: 1 }), deep)
  for (let i = 0; i < 20; i++) tickLocomotion(s2, input({ mvX: 1 }), deep)  // 0.33s of falling
  ok(s2.airborne, 'still falling past the grace window')
  const vyBefore = s2.vy
  tickLocomotion(s2, input({ mvX: 1, jumpKey: true }), deep)
  ok(s2.vy < vyBefore + 1, 'past the grace window the air press does nothing — no double jump')
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

// ── ★ a hang belongs to the wall you face — side blocks never snatch the grab ────────────────
{
  // A 2-high block BESIDE the jump (at +z). Push into it while LOOKING forward (+x), held Space:
  // this is exactly the "keeps grabbing adjacent blocks that happen to be 2 high" repro — the old
  // input-axis probe grabbed it; the contact+facing gate must not.
  const solid = world((x, y, z) => x >= 3 && x < 5 && z >= 2 && y < 12)
  const s = createLoco(3.5, 10, 0.5); settle(s, solid)
  let hung = false, climbed = false
  tickLocomotion(s, input({ mvZ: 1, jumpKey: true }), solid)     // jump with sideways push
  for (let i = 0; i < 60; i++) {
    tickLocomotion(s, input({ mvZ: 1, jumpKey: true }), solid)   // held Space, still looking +x
    if (s.hanging) hung = true
    if (s.climbing) climbed = true
  }
  ok(!hung, '★ a 2-high block beside the jump is never grabbed — the hang needs the faced wall')
  ok(!climbed, '★ nor climbed — a strafe-pressed wall is collision, not a ladder')
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

// ── swimming — the probe's water code owns the tick (2026-08-08) ─────────────────────────────
{
  // A pool: floor top at 4, water fills 4..12 in a wide basin; boolean-world elsewhere.
  const pool = (x: number, y: number, z: number): number =>
    y < 4 ? CELL_SOLID : (y < 12 && Math.abs(x) < 20 && Math.abs(z) < 20) ? CELL_WATER : CELL_EMPTY

  // Submerged, hands off: a slow drift down, never a plummet.
  const s = createLoco(0.5, 7, 0.5)
  tickLocomotion(s, input(), pool)
  ok(s.swimming, 'a submerged body is swimming')
  for (let i = 0; i < 60; i++) tickLocomotion(s, input(), pool)
  ok(s.vy < 0 && s.vy > -SWIM_IDLE_SINK * 1.2, `idle water is a drift, not a fall (vy ${s.vy.toFixed(2)})`)

  // Space climbs the water; crouch dives. (Half a second — long enough to reach swim-up speed,
  // short enough to stay submerged; past the surface the tread/bob loop owns vy.)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input({ jumpKey: true }), pool)
  ok(s.vy > SWIM_UP * 0.8, `holding jump swims up (vy ${s.vy.toFixed(2)})`)
  const yUp = s.py
  for (let i = 0; i < 60; i++) tickLocomotion(s, input({ crouchKey: true }), pool)
  ok(s.py < yUp, 'crouch dives')

  // Swim speed is capped well under a run — water is drag country.
  for (let i = 0; i < 180; i++) tickLocomotion(s, input({ mvX: 1 }), pool)
  const sv = Math.hypot(s.hvx, s.hvz)
  ok(sv > SWIM_SPEED * 0.8 && sv < RUN_SPEED * 0.7, `swim speed sits at SWIM_SPEED (${sv.toFixed(2)})`)

  // No ground verbs underwater: a slide cannot start, a wall is not grabbed.
  ok(!s.sliding && !s.onWall && !s.climbing && !s.hanging, 'ground and wall verbs stand down in water')

  // A fall into water is CAUGHT (treading cap), and treading is perpetual coyote ground:
  // the jump out of shallow water onto the bank is a plain jump.
  const t = createLoco(0.5, 20, 0.5)
  const shallow = (x: number, y: number, z: number): number =>
    y < 10 ? CELL_SOLID : y < 11 ? CELL_WATER : CELL_EMPTY
  for (let i = 0; i < 120; i++) tickLocomotion(t, input(), shallow)
  ok(t.vy >= -TREAD_SINK_CAP - 0.01, `water caps the fall (vy ${t.vy.toFixed(2)})`)
  ok(!t.swimming, 'feet-deep water is treading, not swimming')
  const beforeJump = t.py
  tickLocomotion(t, input({ jumpKey: true }), shallow)
  const rose = t.vy > 0 || t.py > beforeJump
  ok(rose, 'a jump from treading water fires (perpetual coyote)')
}

console.log(`\nlocomotion: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the walker moves like play3d')
