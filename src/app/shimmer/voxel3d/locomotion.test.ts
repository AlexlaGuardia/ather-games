// Locomotion oracle. Run: npx tsx src/app/shimmer/voxel3d/locomotion.test.ts
//
// Movement bugs are feel bugs, and feel bugs get reported as vibes ("it's a dash now"). These
// asserts pin the behaviours behind the vibes: each one is a verb a player counts on, run against
// a synthetic grid where the answer is knowable.

import {
  createLoco, tickLocomotion, bodyFree, floorProbe,
  RUN_SPEED, WALK_SPEED, SPRINT_RAMP, SLIDE_MIN_SPEED, SLIDE_BOOST, SPEED_CAP,
  WALL_CATCH_TIME, WALL_CATCH_MIN, WALL_CATCH_SPEED, WALL_CATCH_SLIDE, WALLJUMP_UP, WALLJUMP_STEER,
  JUMP_V0, SLIDE_SPEED, SLIDEHOP_BOOST, WALLJUMP_PUSH,
  CLIMB_HOLD_MIN, CLIMB_MAX_RISE, EYE_STAND, EYE_SLIDE, eyeY, STEP_SMOOTH_MAX, DRAINED_SPEED,
  CROUCH_SPEED, type LocoInput,
  CELL_EMPTY, CELL_SOLID, CELL_WATER, CELL_HALF, SWIM_SPEED, SWIM_UP, SWIM_IDLE_SINK, TREAD_SINK_CAP,
  launchKeeper, blinkKeeper,
} from './locomotion'
import { hollowTouching, HOLLOW_SPEED, HOLLOW_HP, DRAIN_TIME, UNIMPAIRED } from './hollows'
import { codeOnly, blockAt } from '../testing/guard'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HELD } from '@/lib/input/actions'

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

// ── ★ wall jump: kicks up and away — but ONLY if you are not asking to go UP the wall ────────
// ⚠⚠ THIS BLOCK'S CONTRACT CHANGED ON 2026-08-28 (Alex's ruling) AND THE OLD ASSERT WENT RED.
// It used to read `mvX: 1` — pushing INTO the face — and assert that the tap kicked you off. That
// WAS the shipped behaviour and it was the bug: the wall-jump was the only wall verb with no
// facing condition, so it caught every case the climb refused and launched the keeper along the
// wall's grid cardinal. Reported as *"upon reaching the top it jumps to the left (sometimes to the
// right)"* — sideways because the push is a grid axis while the player reads it in camera space.
// The red was a contract change, not a regression; it is rewritten rather than deleted, and the
// kick is still proved — through the inputs that now mean "kick".
{
  const solid = world((x, y) => x >= 4 && y < 16)     // a tall wall at x=4
  /** Fly into the wall, then press jump with `mv` — returns whether the kick fired. */
  const atWall = (mvX: number, mvZ: number) => {
    const s = createLoco(2.5, 10, 0.5); settle(s, solid)
    for (let i = 0; i < 40; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
    tickLocomotion(s, input({ mvX: 1, jumpKey: true }), solid)      // takeoff
    for (let i = 0; i < 12; i++) tickLocomotion(s, input({ mvX: 1 }), solid)  // fly into the wall
    const contact = s.onWall || s.wallStick > 0
    for (let i = 0; i < 3; i++) tickLocomotion(s, input({ mvX, mvZ }), solid) // settle the new wish
    tickLocomotion(s, input({ mvX, mvZ, jumpKey: true }), solid)
    return { contact, fired: s.justWallJumped, hvx: s.hvx, hvz: s.hvz, vy: s.vy }
  }
  const away = atWall(-1, 0)
  ok(away.contact, 'pressed into the wall mid-air registers contact')
  ok(away.fired, '★ jump while moving AWAY from the face is a wall jump')
  ok(away.hvx <= -WALLJUMP_PUSH + 0.01, `the kick pushes AWAY from the face (hvx ${away.hvx.toFixed(2)})`)
  ok(away.vy > 0, 'and upward')

  // ★★ THE STRAFE IS THE CASE THAT CAUGHT MY OWN FIX. The first cut refused the kick whenever the
  // inward component was `> 0`, and `Math.cos(Math.PI/2)` is 6.1e-17 — so moving exactly along the
  // face read as pushing into it and the kick died for every keyboard strafe against an
  // axis-aligned wall, which is the commonest way anyone sets one up. Hence WALLJUMP_INTO.
  // ⚠⚠ THE WISH IS BUILT WITH `Math.cos`, NOT WRITTEN AS `0`, AND THAT IS THE ENTIRE ASSERT.
  // My first version passed `(0, 1)` — an exact integer zero — so `dot > 0` was false and the
  // assert passed against the very bug it was written for. A real strafe comes out of a camera
  // basis, where `Math.cos(Math.PI/2)` is 6.1e-17 and `> 0` is TRUE. Written the tidy way this
  // could not fail; written the way the game produces it, it catches a zero threshold.
  const perp = Math.PI / 2
  const along = atWall(Math.cos(perp), Math.sin(perp)), alongB = atWall(Math.cos(perp), -Math.sin(perp))
  ok(along.fired && alongB.fired, '⚠ the kick died for a strafe — float noise on an exactly-perpendicular wish read as pushing in')

  // ★ and the fix itself: asking to go UP the wall never launches you OFF it.
  const into = atWall(1, 0)
  ok(!into.fired, '⚠⚠ pushing INTO the face still wall-jumps — this is the reported sideways launch')
  const graze = atWall(Math.cos(80 * Math.PI / 180), Math.sin(80 * Math.PI / 180))
  ok(!graze.fired, '⚠⚠ a GRAZING push into the face still launches — that band is where the throw is most sideways')
  ok(Math.hypot(into.hvx, into.hvz) < WALLJUMP_PUSH * 0.5, 'refusing the kick must not leave the launch velocity behind')
}

// ── ★★ THE CLIMB SURVIVES A BRIEF RELEASE, AND A TAP STILL CANNOT CLIMB ──────────────────────
// The second half of the same report. Releasing Space zeroed `spaceHeldT` instantly, so a 33ms
// chatter dropped `climbActive`, dropped `s.climbing` — one of the terms holding the wall-jump off
// — and the re-press arrived as a fresh edge with `wallStick` alive. A pump mid-climb threw the
// keeper off the wall at every height, including the frame before the lip.
{
  const solid = world((x, y) => x >= 3 && y < 13)     // a 3-high wall: climb country
  /** Hold forward+jump up the wall, optionally releasing jump for `gap` frames at frame `at`. */
  const climb = (at: number, gap: number) => {
    const s = createLoco(2.0, 10, 0.5); settle(s, solid)
    for (let i = 0; i < 40; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
    let kicked = false, climbFrames = 0
    for (let i = 0; i < 120; i++) {
      const jumpKey = !(i >= at && i < at + gap)
      tickLocomotion(s, input({ mvX: 1, jumpKey }), solid)
      if (s.justWallJumped) kicked = true
      if (s.climbing) climbFrames++
    }
    return { kicked, py: s.py, climbFrames }
  }
  const clean = climb(999, 0)
  ok(clean.py >= 12.95, `★ an uninterrupted climb tops out (feet ${clean.py.toFixed(2)})`)
  for (const at of [22, 30, 38, 44]) {
    const pumped = climb(at, 2)
    ok(!pumped.kicked, `⚠⚠ a 2-frame release at f${at} threw the keeper off the wall — the reported bug`)
    ok(pumped.py >= 12.95, `a pumped climb still tops out at f${at} (feet ${pumped.py.toFixed(2)})`)
  }
  /**
   * ★★ AND WHAT `CLIMB_REGRIP` ITSELF IS WORTH — MEASURED, BECAUSE THE FIRST ASSERT FOR IT COULD
   * NOT FAIL. Removing the regrip did not change a single outcome above: every climb still topped
   * out and none was kicked, because a climb only engages while the wish pushes INTO the wall, and
   * pushing in is exactly what the facing gate now refuses. The wall-jump fix fully covers the
   * reported symptom on its own. What the regrip changes is that an interrupted climb does not
   * have to RE-CLIMB ground it already covered: at a 100ms gap it spends 20 climbing frames
   * against 24 without. That is the stall a player feels, it is the only thing this constant buys,
   * and it is what gets asserted — not the bug, which something else fixed.
   */
  const gap = climb(20, 6)
  ok(!gap.kicked, 'a longer release must still not launch the keeper')
  ok(gap.climbFrames <= clean.climbFrames + 2,
     `⚠ an interrupted climb re-climbed ground it had covered (${gap.climbFrames} frames vs ${clean.climbFrames} clean) — the regrip window is not holding`)
  // ⚠ AND THE GRACE MUST NOT LET A TAP ACCUMULATE. If a release merely PAUSED the counter, repeated
  // taps would cross CLIMB_HOLD_MIN on the third one and "a tap is always a ballistic jump, never a
  // mantle" would stop being true — which is the 2026-08-07 lunge bug coming back through the door
  // built to stop it. Below the threshold a release must still zero instantly.
  {
    const s = createLoco(2.0, 10, 0.5); settle(s, solid)
    for (let i = 0; i < 40; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
    let climbed = false
    for (let i = 0; i < 120; i++) {
      tickLocomotion(s, input({ mvX: 1, jumpKey: (i % 10) < 4 }), solid)   // 4-frame taps
      if (s.climbing) climbed = true
    }
    ok(!climbed, '⚠⚠ repeated taps accumulated into a climb — the regrip grace leaked past an engaged hold')
  }
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

// ── half slabs — CELL_HALF collides at half height (2026-08-08) ──────────────────────────────
{
  // Floor at y<10, a slab occupying cell y=10 at x>=3: top surface at 10.5.
  const slabWorld = (x: number, y: number, z: number): number =>
    y < 10 ? CELL_SOLID : (y === 10 && x >= 3 && Math.abs(z) < 20) ? CELL_HALF : CELL_EMPTY

  // Walking onto a slab is a STEP, not a wall and not a vault.
  const s = createLoco(0.5, 10, 0.5); settle(s, slabWorld)
  for (let i = 0; i < 200; i++) tickLocomotion(s, input({ mvX: 1 }), slabWorld)
  ok(s.px > 4, `a half-rise is walked onto, no press needed (x ${s.px.toFixed(2)})`)
  ok(Math.abs(s.py - 10.5) < 0.05, `standing height on a slab is +0.5 (feet ${s.py.toFixed(2)})`)
  ok(!s.vaulting, 'no vault fired — the slab is a step, not a ledge')

  // Standing ON the slab, the body is free (the lower-half rule).
  ok(bodyFree(slabWorld, 4.5, 0.5, 10.5), 'a body standing on a slab is clear of it')
  ok(!bodyFree(slabWorld, 4.5, 0.5, 10.0), 'a body inside the slab half is blocked')

  // A slab under the ceiling: 1.25 of clearance does not fit a 1.75 body.
  const lowRoom = (x: number, y: number, z: number): number =>
    y < 10 ? CELL_SOLID : y === 11 && x >= 3 ? CELL_HALF : CELL_EMPTY
  ok(!bodyFree(lowRoom, 3.5, 0.5, 10), 'a slab overhead blocks a standing body underneath')

  // A full block stays a vault: STEP_CAPTURE must not have re-armed the auto step-up.
  const terrace = world((x, y) => x >= 3 && y < 11)
  const t = createLoco(0.5, 10, 0.5); settle(t, terrace)
  for (let i = 0; i < 200; i++) tickLocomotion(t, input({ mvX: 1 }), terrace)
  ok(t.py === 10 && t.px < 3, '★ a FULL block still stops the run — the vault ruling holds')

  // Slab as a stair: ground → slab → full block, walked without a single press.
  const stairway = (x: number, y: number, z: number): number =>
    y < 10 ? CELL_SOLID : (y === 10 && x >= 3 && x < 5) ? CELL_HALF : (y === 10 && x >= 5) ? CELL_SOLID : CELL_EMPTY
  const w = createLoco(0.5, 10, 0.5); settle(w, stairway)
  for (let i = 0; i < 260; i++) tickLocomotion(w, input({ mvX: 1 }), stairway)
  ok(w.px > 6 && Math.abs(w.py - 11) < 0.05, `slab stairs: ground→slab→block in one walk (x ${w.px.toFixed(1)}, feet ${w.py.toFixed(2)})`)
}

// ── step smoothing — the feet snap, the EYE climbs (2026-08-11, Alex: "it feels jagged") ─────
{
  const slabWorld = (x: number, y: number, z: number): number =>
    y < 10 ? CELL_SOLID : (y === 10 && x >= 3 && Math.abs(z) < 20) ? CELL_HALF : CELL_EMPTY

  // Walk into the slab one tick at a time and catch the frame the feet rise.
  const s = createLoco(0.5, 10, 0.5); settle(s, slabWorld)
  let stepFrame = -1
  const eyes: number[] = []
  for (let i = 0; i < 200; i++) {
    const before = s.py
    tickLocomotion(s, input({ mvX: 1 }), slabWorld)
    if (stepFrame < 0 && s.py > before + 0.4) stepFrame = i
    if (stepFrame >= 0) eyes.push(eyeY(s))
  }
  ok(stepFrame >= 0, 'the feet still snap the whole half-block in one tick — physics is exact')
  // ★ THE BUG: without smoothing the camera jumped the whole 0.5 on that one frame. The bound is
  // a QUARTER of the rise — the step frame has to be the start of a climb, not most of one.
  ok(eyes[0] - (10 + EYE_STAND) < 0.125, `★ the eye does NOT teleport with the feet (${(eyes[0] - 10 - EYE_STAND).toFixed(3)} of 0.5 on the step frame)`)
  ok(s.stepSmooth === 0, 'the debt is fully paid back — no permanent camera offset')
  ok(Math.abs(eyes[eyes.length - 1] - (10.5 + EYE_STAND)) < 1e-6, 'the eye ends exactly where the body is')

  // Monotonic: a smoothed rise that dips is a different kind of jag.
  let dips = 0
  for (let i = 1; i < eyes.length; i++) if (eyes[i] < eyes[i - 1] - 1e-9) dips++
  ok(dips === 0, `the eye only ever rises through a step (${dips} dips)`)

  // ...and it gets there quickly. A slow float is its own feel bug.
  const settledAt = eyes.findIndex(e => e > 10.5 + EYE_STAND - 0.02)
  ok(settledAt >= 0 && settledAt < 0.35 * 60, `the eye catches up in ~${(settledAt / 60).toFixed(2)}s, not a float`)

  // ★ FRAME-RATE INDEPENDENT. The eye ease beside it is a per-frame factor; this must not be, or
  // a 144Hz machine climbs a step in half the time a 60Hz one does.
  const climbAt = (dt: number) => {
    const w = createLoco(0.5, 10, 0.5); settle(w, slabWorld, Math.ceil(0.5 / dt))
    let t = 0
    for (let i = 0; i < 600; i++) {
      tickLocomotion(w, input({ mvX: 1, dt }), slabWorld)
      if (w.py > 10.4) { t += dt; if (w.stepSmooth === 0) return t }
    }
    return -1
  }
  const t60 = climbAt(1 / 60), t144 = climbAt(1 / 144)
  ok(t60 > 0 && Math.abs(t60 - t144) < 0.05, `same climb time at 60 and 144fps (${t60.toFixed(3)}s vs ${t144.toFixed(3)}s)`)

  // ── ★ THE FLIGHT, not the single stair. A 0.5-per-column staircase run at full speed lands each
  // rise while the last one is still being paid off, which is where the first cut fell over.
  const stairs = (x: number, y: number, _z: number): number => {
    const top = 10 + Math.max(0, Math.min(8, Math.floor(x - 2))) * 0.5
    return y + 1 <= top ? CELL_SOLID : y + 0.5 <= top ? CELL_HALF : CELL_EMPTY
  }
  const r = createLoco(0.5, 10, 0.5); settle(r, stairs)
  let worst = 0, jump = 0, prevEye = eyeY(r), climbed = 0
  for (let i = 0; i < 300; i++) {
    tickLocomotion(r, input({ mvX: 1 }), stairs)
    worst = Math.max(worst, r.stepSmooth)
    const e = eyeY(r)
    if (r.py > 10) jump = Math.max(jump, e - prevEye)
    prevEye = e
  }
  climbed = r.py - 10
  ok(climbed >= 3.5, `the staircase is actually climbed (${climbed.toFixed(1)} blocks)`)
  // ★ THE CLAMP MUST NOT BIND. Clamping discards owed height, and discarded height is a pop —
  // which is the bug, not the fix. If this fails, raise STEP_SMOOTH_MAX; do not accept the clamp.
  ok(worst < STEP_SMOOTH_MAX, `★ the debt cap never binds at run speed (worst ${worst.toFixed(3)} of ${STEP_SMOOTH_MAX})`)
  // And the payoff: no frame of the whole flight moves the eye more than a fifth of a slab.
  ok(jump < 0.11, `★ no jolt anywhere on the flight (biggest single frame ${jump.toFixed(3)})`)

  // ── ★ DOWN IS THE MIRROR OF UP (Alex: "make the descent glue too, same as going up") ────────
  // A 0.5 drop used to exceed FALL_OFF, so every stair down was a 0.21s ballistic fall that hit
  // -6.2 u/s and slammed to zero in a single frame. Same staircase, walked back down.
  const d = createLoco(9.5, 14, 0.5); settle(d, stairs, 40)
  let airFrames = 0, drop = 0, hover = 0, descended = 0
  let pe = eyeY(d)
  for (let i = 0; i < 220; i++) {
    tickLocomotion(d, input({ mvX: -1, fwdX: -1 }), stairs)
    if (d.airborne) airFrames++
    else if (floorProbe(stairs, d.px, d.pz, d.py, 0.55) !== d.py) hover++
    const e = eyeY(d)
    if (d.px < 9) drop = Math.min(drop, e - pe)
    pe = e
  }
  descended = 14 - d.py
  ok(descended >= 3.5, `the staircase is walked back down (${descended.toFixed(1)} blocks)`)
  ok(airFrames === 0, `★ a half-block descent GLUES — not one airborne frame in the flight (${airFrames})`)
  // The old code eased the BODY down, so the feet spent frames hovering over the floor they stood
  // on. The feet are now exact every grounded frame and the eye alone carries the lag.
  ok(hover === 0, `★ the feet are never hovering above the floor they stand on (${hover} frames)`)
  ok(Math.abs(drop) < 0.11, `★ and no jolt going down either (biggest single frame ${drop.toFixed(3)})`)

  // A FULL block still falls — widening FALL_OFF must not have glued the world flat.
  const cliff = world((x, y) => x < 3 && y < 11)
  const c = createLoco(1.5, 11, 0.5); settle(c, cliff)
  let fell = false
  for (let i = 0; i < 60; i++) { tickLocomotion(c, input({ mvX: 1 }), cliff); if (c.airborne) fell = true }
  ok(fell, '★ a 1-block drop is still a FALL — the downhill coyote ruling is untouched')

  // Same time down at 60 and 144fps, same as up.
  const fallAt = (dt: number) => {
    const w = createLoco(4.9, 11, 0.5); settle(w, stairs, Math.ceil(0.7 / dt))
    let t = 0
    for (let i = 0; i < 900; i++) {
      tickLocomotion(w, input({ mvX: -1, fwdX: -1, dt }), stairs)
      if (w.py < 10.9) { t += dt; if (w.stepSmooth === 0) return t }
    }
    return -1
  }
  const d60 = fallAt(1 / 60), d144 = fallAt(1 / 144)
  ok(d60 > 0 && Math.abs(d60 - d144) < 0.05, `the descent costs the same at 60 and 144fps (${d60.toFixed(3)}s vs ${d144.toFixed(3)}s)`)
}

// ── ★ THE HOLLOW'S DRAIN — the night costs speed, never the run itself ──────────────────────
{
  const solid = world()

  // Baseline: a clean run reaches RUN_SPEED (asserted at the top of this file too).
  const s = createLoco(0.5, 10, 0.5); settle(s, solid)
  for (let i = 0; i < 200; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  const clean = Math.hypot(s.hvx, s.hvz)

  // Drained: the same run is capped, and the cap is the ONLY thing that changed.
  s.drainT = DRAIN_TIME
  for (let i = 0; i < 120; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  const drained = Math.hypot(s.hvx, s.hvz)
  ok(drained < clean - 1, `a touched keeper is slowed (${drained.toFixed(2)} vs ${clean.toFixed(2)})`)
  ok(Math.abs(drained - DRAINED_SPEED) < 0.1, `...to exactly DRAINED_SPEED (${drained.toFixed(2)})`)

  // ★ THE RULING, AS AN ASSERT. shimmer-geography.md: a keeper who runs, ESCAPES — "menace, not
  // a wall". Drop the drained speed below the Hollow's own glide and one touch is a death
  // sentence by arithmetic, and nothing else in the codebase would complain.
  ok(DRAINED_SPEED > HOLLOW_SPEED, `★ a drained keeper can still outrun a Hollow (${DRAINED_SPEED} > ${HOLLOW_SPEED}) — menace, not a wall`)

  // It wears off, and it wears off on the clock rather than on distance. Re-armed first: the
  // cap check above already spent 2s of the timer.
  s.drainT = DRAIN_TIME
  let t = 0
  while (s.drainT > 0 && t < 10) { tickLocomotion(s, input({ mvX: 1 }), solid); t += DT }
  ok(Math.abs(t - DRAIN_TIME) < 0.1, `the drain expires on its own clock (${t.toFixed(2)}s of ${DRAIN_TIME})`)
  for (let i = 0; i < 200; i++) tickLocomotion(s, input({ mvX: 1 }), solid)
  ok(Math.abs(Math.hypot(s.hvx, s.hvz) - clean) < 0.1, 'and the full run comes back — a drain is never permanent')

  // ★ A CAP, NOT A MULTIPLIER. A crouch is already slower than the drain; being touched must not
  // make a crouching keeper FASTER. This is the failure a `* 0.65` would have shipped silently.
  const c = createLoco(0.5, 10, 0.5); settle(c, solid)
  c.drainT = DRAIN_TIME
  for (let i = 0; i < 200; i++) tickLocomotion(c, input({ mvX: 1, crouchKey: true }), solid)
  ok(Math.hypot(c.hvx, c.hvz) <= CROUCH_SPEED + 0.05, `★ the drain never speeds anything UP (crouch ${Math.hypot(c.hvx, c.hvz).toFixed(2)} <= ${CROUCH_SPEED})`)

  // The touch test itself: it has to be able to reach you, and a guttering one must not.
  const hw = { id: 'h', x: 10, y: 11, z: 10, form: 'stalker' as const, hp: HOLLOW_HP, gutter: 0, phase: 0 }
  ok(hollowTouching(hw, 10.4, hw.y, 10.1, UNIMPAIRED), 'a Hollow on the keeper is touching her')
  ok(!hollowTouching(hw, 13, hw.y, 10, UNIMPAIRED), 'one across the clearing is not')
  hw.gutter = 1
  ok(!hollowTouching(hw, 10.5, hw.y, 10.2, UNIMPAIRED), '★ a guttered Hollow cannot touch — dawn ends the threat, not just the body')
  hw.gutter = 0; hw.hp = 0
  ok(!hollowTouching(hw, 10.5, hw.y, 10.2, UNIMPAIRED), '★ nor can a dispersed one — no drain from something already gone')
}

// ── ★ SYSTEM 4: A CAST MOVES THE KEEPER (2026-08-15) ─────────────────────────────────────────
// ★★ THE FIRST ASSERT IS THE WHOLE REASON `launchKeeper` LIVES IN locomotion.ts. Setting hvx/hvz
// without `airSpeed` passes any single-frame check and is then ERASED: the airborne branch
// renormalises horizontal velocity to `airSpeed` on every tick the player holds a movement key. So
// the launch dies the instant a finger touches W, nothing throws, and the bug presents as
// "Overcharge works unless you're moving" — which is the hardest possible thing to report.
{
  const solid = world()

  // 1. A launch survives HELD INPUT, which is the case the naive version fails.
  {
    const s = createLoco(0, 10, 0); settle(s, solid)
    launchKeeper(s, 1, 0, 17, 4.2)
    for (let i = 0; i < 6; i++) tickLocomotion(s, input({ mvX: 1 }), solid)   // holding forward
    ok(Math.hypot(s.hvx, s.hvz) > RUN_SPEED * 2,
      `★ a launch survives held input (${Math.hypot(s.hvx, s.hvz).toFixed(1)} vs run ${RUN_SPEED}) — this is the airSpeed coupling`)
  }

  // 2. ...and it actually carries you further than a sprinting jump would.
  {
    const a = createLoco(0, 10, 0); settle(a, solid)
    for (let i = 0; i < 90; i++) tickLocomotion(a, input({ mvX: 1, jumpKey: i === 0 }), solid)
    const b = createLoco(0, 10, 0); settle(b, solid)
    launchKeeper(b, 1, 0, 17, 4.2)
    for (let i = 0; i < 90; i++) tickLocomotion(b, input({ mvX: 1 }), solid)
    ok(b.px > a.px * 1.5, `★ Overcharge crosses ground a running jump cannot (${b.px.toFixed(1)} vs ${a.px.toFixed(1)})`)
  }

  // 3. UPDRAFT IS VERTICAL: it must gain real height and barely move you sideways, or it is
  //    Overcharge with different numbers and canon's two moves have collapsed into one.
  {
    const s = createLoco(0, 10, 0); settle(s, solid)
    const y0 = s.py, x0 = s.px
    launchKeeper(s, 1, 0, 2.5, 13.5)
    let peak = s.py
    for (let i = 0; i < 120; i++) { tickLocomotion(s, input(), solid); peak = Math.max(peak, s.py) }
    ok(peak - y0 > 3.5, `★ Updraft is high ground on demand (+${(peak - y0).toFixed(1)} blocks)`)
    ok(Math.abs(s.px - x0) < peak - y0, '★ ...and it lifts more than it throws — not a second Overcharge')
  }

  // 4. A JUMP MUST STILL BE A JUMP. The launch shares `vy`/`airSpeed` with the jump code, so the
  //    cheapest way to break the feel contract is to make an ordinary hop suddenly enormous.
  {
    const s = createLoco(0, 10, 0); settle(s, solid)
    const y0 = s.py
    let peak = s.py
    for (let i = 0; i < 120; i++) { tickLocomotion(s, input({ jumpKey: i === 0 }), solid); peak = Math.max(peak, s.py) }
    ok(peak - y0 < 2, `an ordinary jump is untouched (+${(peak - y0).toFixed(2)} blocks)`)
  }

  // 5. ★★ VERTICAL IS A FLOOR: `max(up, vy)`. Three cases, and the middle one is the assert that
  //    matters — `vy > 0` alone was VACUOUS, because a plain assignment passes it too. Mutation
  //    caught that, and chasing it found the implementation had the same hole as the test: it read
  //    `max(up, vy + up)`, which when falling is just `up`, i.e. an assignment wearing an addition.
  {
    // (a) mid-fall gets the FULL lift, not lift-minus-your-fall.
    const fall = createLoco(0, 30, 0)
    for (let i = 0; i < 30; i++) tickLocomotion(fall, input(), solid)
    ok(fall.vy < -5, `precondition: falling fast (vy=${fall.vy.toFixed(1)})`)
    launchKeeper(fall, 1, 0, 2.5, 13.5)
    const rest = createLoco(0, 10, 0); settle(rest, solid)
    launchKeeper(rest, 1, 0, 2.5, 13.5)
    ok(Math.abs(fall.vy - rest.vy) < 1e-9,
      `★ a mid-fall Updraft lifts exactly as hard as one from standing (${fall.vy.toFixed(1)} vs ${rest.vy.toFixed(1)})`)

    // (b) an existing CLIMB is never cut — Updraft off the top of an Overcharge must not brake you.
    const rising = createLoco(0, 10, 0); settle(rising, solid)
    rising.vy = 20
    launchKeeper(rising, 1, 0, 2.5, 13.5)
    ok(rising.vy === 20, `★ ...and never slows a keeper already rising faster (vy=${rising.vy})`)

    // (c) ...nor does it STACK into the skybox.
    const chained = createLoco(0, 10, 0); settle(chained, solid)
    launchKeeper(chained, 1, 0, 2.5, 13.5)
    launchKeeper(chained, 1, 0, 2.5, 13.5)
    ok(chained.vy === 13.5, `★ ...and two in a row do not compound (vy=${chained.vy})`)
  }

  // 5d. ★ BOTH HORIZONTAL COMPONENTS ARE LIVE. Every assert above launches along +x, so `hvz` was
  //     never exercised — a mutation scaling it by 0.2 came back GREEN. An axis-aligned fixture
  //     tests half a vector, and the half it skips is the one a real player is almost always on.
  {
    const s = createLoco(0, 10, 0); settle(s, solid)
    launchKeeper(s, 1, 1, 17, 0)                       // 45°, deliberately unnormalised input
    ok(Math.abs(Math.hypot(s.hvx, s.hvz) - 17) < 1e-6,
      `★ a diagonal launch has the SPEED it was given, not √2 times it (${Math.hypot(s.hvx, s.hvz).toFixed(2)})`)
    ok(Math.abs(s.hvx - s.hvz) < 1e-9, '★ ...split evenly across both axes')
  }

  // 6. THE BLINK ARRIVES, AND ARRIVES STOPPED. Velocity carried through a blink would slide you off
  //    the ledge you just aimed at.
  {
    const s = createLoco(0, 10, 0); settle(s, solid)
    for (let i = 0; i < 30; i++) tickLocomotion(s, input({ mvX: 1 }), solid)   // running
    ok(Math.hypot(s.hvx, s.hvz) > 1, 'precondition: moving before the blink')
    const moved = blinkKeeper(s, s.px + 12, s.pz, () => 10, solid)
    ok(moved > 11, `★ Thunder Step covers its range (${moved.toFixed(1)})`)
    ok(Math.hypot(s.hvx, s.hvz) < 1e-6, '★ ...and arrives STOPPED, not sliding')
  }

  // 7. ★★ IT GOES THROUGH THE WALL, AND NEVER INSIDE IT — and the first half of that is a design
  //    call this oracle originally got wrong, which is why it is written down here.
  //
  //    The first version of this assert demanded the blink stop SHORT of a wall, and it failed:
  //    the keeper arrived cleanly on the far side. That is correct and the assert was the thing
  //    that was wrong. Canon calls Thunder Step *"vanish into vapor, return on a crack of
  //    lightning"* — the distance between is never crossed, so there is nothing to be blocked BY,
  //    and *"masters… strike from behind the fog"* only reads if you can get behind things. A blink
  //    that a wall stops is a dash with extra mana, which is exactly the flattening the 08-14 Apex
  //    pass caught ("I picked the mechanism on the shelf over the one in the sentence").
  //
  //    So the back-search's job is NOT line-of-sight. It is the guarantee that wherever you arrive,
  //    a body fits — which is the half that must never fail.
  {
    const wall = world((x) => x >= 6 && x <= 8)          // a solid slab at x 6..8, full height
    const s = createLoco(0, 10, 0); settle(s, wall)
    blinkKeeper(s, 12, 0, () => 10, wall)
    ok(s.px > 8, `★ a blink passes THROUGH a wall — it is a vanish, not a dash (x=${s.px.toFixed(1)})`)
    ok(bodyFree(wall, s.px, s.pz, s.py), '★ ...and wherever it lands, a body fits')
  }

  // 7b. ★ AIMED INTO THE ROCK ITSELF, it must fall back to somewhere free — this is the case the
  //     back-search exists for, and the one that would otherwise bury a keeper in a hillside.
  {
    const wall = world((x) => x >= 6 && x <= 8)
    const s = createLoco(0, 10, 0); settle(s, wall)
    blinkKeeper(s, 7, 0, () => 10, wall)                 // aim point is INSIDE the slab
    ok(bodyFree(wall, s.px, s.pz, s.py),
      `★ aimed into solid rock, it lands somewhere a body fits (x=${s.px.toFixed(1)})`)
    ok(s.px < 6, '...which means short of the slab, since there is no room within it')
  }

  // 8. Fully walled in, it refuses and says so (0) rather than throwing or half-moving. The
  //    caster's own cell is free by definition, so this is the honest floor of the search.
  {
    const boxed = world((x) => x >= 1)
    const s = createLoco(0, 10, 0); settle(s, boxed)
    const x0 = s.px
    ok(blinkKeeper(s, 12, 0, () => 10, boxed) === 0, '★ nowhere to land reports 0, it does not throw')
    ok(s.px === x0, '...and does not move you')
  }
}

// ── ★★★ THE WALKER MUST CONSUME THE BINDINGS, NOT THE RAW KEYBOARD ───────────────────────────
// `move.jump` and `move.slide` are `ActionId`s with correct keyboard AND pad defaults, and for
// months `VoxelWorld` fed this module `jumpKey: !!k.Space` / `crouchKey: !!k.ShiftLeft` — the raw
// key map. Two silent consequences: the settings panel offered "Jump" and "Slide" as rebindable
// and rebinding them configured nothing, and pad A / L3 never reached the walker, so a controller
// could steer the keeper and could not jump.
//
// ⚠⚠ NO EXISTING GUARD COULD SEE THIS, AND THAT IS THE POINT. `orphans()` and `padGaps()` ask
// whether a binding EXISTS; both existed and both were right. Nothing asked whether anything
// CONSUMES them — the same shape as `padPressed`, which was written, unit-tested, and imported by
// nothing. A binding is not wired because it is in the table.
{
  const file = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  // ★ `blockAt` slices the walker's own argument object by index and hands back BOTH forms, which
  // is exactly the split this guard needs — and the first version got it wrong. It matched the
  // action ids against `codeOnly`, which blanks STRING BODIES as well as comments, so
  // `heldNow.has('move.jump')` reads as `heldNow.has('')` and the guard went red against correct
  // code. Positive asserts read `raw`; negative asserts read `code`, or the comment above
  // explaining the old `k.Space` read would fail the very check it documents.
  const call = blockAt(file, 'tickLocomotion(lc, {', '}, solidProbe)')
  ok(call.at >= 0, 'BLIND: could not locate the walker call — the asserts below measure nothing')
  ok(call.code.includes('heldNow.has('), 'BLIND: the argument slice does not look like the call site')

  for (const [field, action] of [['jumpKey', 'move.jump'], ['crouchKey', 'move.slide']] as [string, string][]) {
    ok(call.raw.includes(`${field}: heldNow.has('${action}')`),
       `⚠⚠ ${field} does not read ${action} through the bindings — rebinding it configures nothing and no pad can reach it`)
  }
  // ★ AND THE GENERAL FORM, so the next held verb cannot arrive unwired: nothing handed to the
  // walker may come from the raw key map. Negative, so it reads `code`.
  ok(!/\bk\.[A-Za-z]/.test(call.code), '⚠ a raw key read is back in the walker input — route it through heldNow')
  ok(HELD.includes('move.jump' as never), 'move.jump left the HELD set — this guard assumes it is polled, not edged')
}

// ── ★ THE SPRINT RAMP, AND THE SLIDE IT PAYS FOR (2026-08-31) ────────────────────────────────
// The verbs here are new but the SHAPE is the oldest lesson in this file: a burst that is always
// available is not a burst, it is a button. Every assert below is written so that deleting the
// ramp — not breaking it, DELETING it, which is what a future "simplify the movement code" pass
// would do — goes red naming the thing that was lost.
{
  const solid = world()
  const hold = (frames: number, extra: Partial<LocoInput> = {}) => {
    const s = createLoco(0.5, 10, 0.5); settle(s, solid)
    for (let i = 0; i < frames; i++) tickLocomotion(s, input({ mvX: 1, ...extra }), solid)
    return s
  }
  const spd = (s: ReturnType<typeof createLoco>) => Math.hypot(s.hvx, s.hvz)
  const RAMP_F = Math.round(SPRINT_RAMP * 60)

  // 1. A press buys the WALK, and only the walk. This is the assert the old build could not pass:
  //    it reached 95% of its single speed in 0.43s, so at 0.5s it was already done accelerating.
  // ⚠ THERE IS NO WALK PLATEAU AND THIS ASSERT IS WRITTEN KNOWING IT. The bank starts filling on
  //   the first frame of input, so WALK_SPEED is where the ramp BEGINS, not a state you sit in.
  //   My first cut asserted `|early - WALK_SPEED| < 0.15` and it went red at 4.82 — the assert was
  //   wrong, not the code. What is worth pinning is that half a second in you are still in the
  //   BOTTOM HALF of the climb, which is the property "the top is not simply handed over".
  const early = spd(hold(30))                                  // 0.5s — well past the 0.14s accel lag
  ok(early >= WALK_SPEED - 0.1,
     `★ the ramp starts AT the walk, never below it (${early.toFixed(2)} vs walk ${WALK_SPEED})`)
  ok(early < (WALK_SPEED + RUN_SPEED) / 2 + 0.2,
     `★ half a second in is still the bottom half of the ramp (${early.toFixed(2)}, midpoint ${((WALK_SPEED + RUN_SPEED) / 2).toFixed(2)})`)
  ok(early < RUN_SPEED - 1.5,
     `★ and the top is not simply handed over — the ramp exists (${early.toFixed(2)} vs run ${RUN_SPEED})`)

  // 2. It climbs, monotonically, and arrives. Sampled rather than end-checked: an end-check alone
  //    passes for a step function, which is the thing this is meant to stop being.
  const marks = [0.25, 0.5, 0.75, 1].map(f => spd(hold(Math.round(RAMP_F * f))))
  ok(marks.every((v, i) => i === 0 || v > marks[i - 1] + 0.1),
     `★ the ramp climbs the whole way, it does not step (${marks.map(v => v.toFixed(2)).join(' → ')})`)
  // ⚠ SAMPLED PAST SPRINT_RAMP, DELIBERATELY. The bank is full at 1.2s but hvel is still chasing
  //   it through GROUND_ACCEL's 0.14s lag, so the speed AT the ramp's end is 6.26, not 6.5. That
  //   is the two systems composing correctly; asserting equality at RAMP_F measures the lag and
  //   calls it a ramp bug. The reachability claim is what matters: held input does arrive.
  const settled = spd(hold(RAMP_F + 20))
  ok(Math.abs(settled - RUN_SPEED) < 0.1,
     `and sustained input does arrive at RUN_SPEED (${settled.toFixed(2)}, ~0.3s after the bank fills)`)
  ok(marks[1] < RUN_SPEED - 0.8,
     `★ halfway through the ramp is meaningfully short of the top — 1.2s is a duration you can feel (${marks[1].toFixed(2)})`)

  // 3. ★★ THE GATE. Alex's ruling in his own words: "using it before the peak is reached causes a
  //    dead slide". Before the ramp this could not be tested, because the gate was crossed 8
  //    frames after the first press and every input in this file cleared it by accident.
  const earlyS = hold(30)
  ok(spd(earlyS) < SLIDE_MIN_SPEED, `(premise) a walking keeper is below the gate (${spd(earlyS).toFixed(2)} < ${SLIDE_MIN_SPEED.toFixed(2)})`)
  tickLocomotion(earlyS, input({ mvX: 1, crouchKey: true }), solid)
  ok(!earlyS.sliding, '★★ crouch BEFORE the peak does not slide — the dead slide')
  ok(earlyS.crouching, '★ ...and it is not a no-op either: it crouches, so the press did something')
  for (let i = 0; i < 30; i++) tickLocomotion(earlyS, input({ mvX: 1, crouchKey: true }), solid)
  ok(spd(earlyS) < WALK_SPEED - 0.5,
     `★★ the early press COSTS speed rather than doing nothing (${spd(earlyS).toFixed(2)} → crouch)`)
  // and the bank is gone with it, so the mistake is paid for twice: you re-climb from zero.
  ok(earlyS.sprintT === 0, '★ an early slide press wipes the sprint bank — the ramp restarts')

  // 4. At the peak it slides, and the peak slide keeps the number it always had.
  const peakS = hold(RAMP_F + 10)
  ok(spd(peakS) > SLIDE_MIN_SPEED, `(premise) a sprinting keeper clears the gate (${spd(peakS).toFixed(2)})`)
  tickLocomotion(peakS, input({ mvX: 1, crouchKey: true }), solid)
  ok(peakS.sliding && spd(peakS) >= SLIDE_SPEED - 0.15,
     `★ crouch AT the peak still lands on ${SLIDE_SPEED} — earned now, not weaker (${spd(peakS).toFixed(2)})`)

  // 5. ★★★ A FASTER ENTRY MUST BUY A FASTER SLIDE. The old entry floored at SLIDE_SPEED, so every
  //    ground slide was exactly 10 however you came in — building speed first bought nothing, and
  //    THAT is what made the payoff feel flat. Restoring the floor makes these two equal.
  const chained = hold(RAMP_F + 10); chained.hvx = 12; chained.hvz = 0   // a bhop-chained entry
  tickLocomotion(chained, input({ mvX: 1, crouchKey: true }), solid)
  ok(spd(chained) > spd(peakS) + 0.5,
     `★★★ entering above the ramp slides FASTER than entering at it (${spd(chained).toFixed(2)} vs ${spd(peakS).toFixed(2)})`)
  ok(spd(chained) <= SPEED_CAP + 1e-6, `and the cap is still the only ceiling (${spd(chained).toFixed(2)})`)
  // ⚠⚠ AND THE CASE THAT ACTUALLY PINS THE ORIGINAL BUG, WHICH THE ASSERT ABOVE DOES NOT. The
  //    sweep caught this: `chained` enters at 12, and the OLD `max(SLIDE_SPEED, curSpeed * 1.35)`
  //    scales there too (16.2), so restoring the floor tripped only the cap. The floor's real
  //    damage lives BELOW 7.41, where every ground entry was clamped to exactly 10 — so the two
  //    entries that must differ are two entries a keeper can actually reach on foot.
  const barely = hold(RAMP_F + 10); const k = (SLIDE_MIN_SPEED + 0.05) / spd(barely)
  barely.hvx *= k; barely.hvz *= k                             // just over the gate, on the ground
  tickLocomotion(barely, input({ mvX: 1, crouchKey: true }), solid)
  ok(barely.sliding && spd(barely) < spd(peakS) - 0.4,
     `★★★ a bare-minimum entry slides SLOWER than a peak one (${spd(barely).toFixed(2)} vs ${spd(peakS).toFixed(2)}) — under the old floor both were exactly ${SLIDE_SPEED}`)

  // 6. ★★ THE BACK DOOR. The jump takeoff floored at RUN_SPEED, so press-and-hop minted the full
  //    sprint in the air a tenth of a second after the first input — the cheapest way to skip the
  //    entire ramp, and invisible to every assert above because they never leave the ground.
  const hopper = hold(12)                                      // 0.2s: barely moving
  tickLocomotion(hopper, input({ mvX: 1, jumpKey: true }), solid)
  ok(hopper.airborne && hopper.airSpeed < WALK_SPEED + 0.1,
     `★★ a jump cannot mint the sprint — it floors at the walk (airSpeed ${hopper.airSpeed.toFixed(2)})`)

  // 7. ...but it must CARRY what was actually earned, or the chain this system is built on dies.
  const sprintHop = hold(RAMP_F + 10)
  tickLocomotion(sprintHop, input({ mvX: 1, jumpKey: true }), solid)
  ok(sprintHop.airSpeed > RUN_SPEED - 0.2,
     `★ an earned sprint carries into the air intact (${sprintHop.airSpeed.toFixed(2)})`)
  // ⚠ TICK PAST THE LANDING, NOT UP TO IT. The sweep caught this too: a 40-frame flight lands on
  //   almost exactly the last frame, so the assert sampled the instant of touchdown — before the
  //   ground target had any frames to pull the speed down. A drained bank and a frozen one are
  //   identical at that instant, and the mutation SURVIVED. Land first, then give it 20 frames.
  let air = 0
  while (sprintHop.airborne && air < 120) { tickLocomotion(sprintHop, input({ mvX: 1 }), solid); air++ }
  ok(!sprintHop.airborne, `(premise) the hop lands within a second (${air} frames)`)
  for (let i = 0; i < 20; i++) tickLocomotion(sprintHop, input({ mvX: 1 }), solid)
  ok(spd(sprintHop) > RUN_SPEED - 0.3,
     `★★ and landing does NOT dump you back to a walk — the bank is frozen in the air, not drained (${spd(sprintHop).toFixed(2)})`)

  // 8. The drain's band. Two inequalities, not the coincidence that they currently share a number:
  //    below the walk a drain is a wall again by another door; at or above the run it costs nothing.
  ok(DRAINED_SPEED >= WALK_SPEED,
     `⚠ DRAINED_SPEED fell below the walk (${DRAINED_SPEED} < ${WALK_SPEED}) — that is "menace, not a wall" broken by a tuning number`)
  ok(DRAINED_SPEED < RUN_SPEED, `⚠ DRAINED_SPEED no longer costs the sprint (${DRAINED_SPEED} >= ${RUN_SPEED})`)
  ok(WALK_SPEED > HOLLOW_SPEED, `⚠ even a WALK must outpace the base glide (${WALK_SPEED} vs ${HOLLOW_SPEED})`)
  ok(WALK_SPEED < RUN_SPEED && SLIDE_BOOST > 1, 'the tiers are ordered and the slide is a boost')

  // 9. ★★★ A DRAINED KEEPER CANNOT SLIDE, AND THAT IS A BALANCE CHANGE NOBODY DESIGNED.
  //    It falls straight out of the arithmetic: the drain caps you at DRAINED_SPEED (4.2) and the
  //    gate now sits at RUN_SPEED * 0.92 (5.98), so once the cap has actually bitten there is no
  //    input that clears the gate. Get touched by a Hollow and you lose the slide outright until
  //    the drain wears off — not slowed, GONE. Pinned here because it is a real consequence of the
  //    gate and it should break loudly if anyone retunes either number into contradicting it.
  //    ⚠ It is only true once you have DECELERATED: a touch landing mid-sprint leaves hvel above
  //    the gate for a few frames, and a slide entered in that window is legal.
  const drained = hold(RAMP_F + 10)
  drained.drainT = DRAIN_TIME
  for (let i = 0; i < 60; i++) tickLocomotion(drained, input({ mvX: 1 }), solid)   // let the cap bite
  ok(Math.abs(spd(drained) - DRAINED_SPEED) < 0.15, `(premise) the drain has bitten (${spd(drained).toFixed(2)})`)
  tickLocomotion(drained, input({ mvX: 1, crouchKey: true }), solid)
  ok(!drained.sliding,
     `★★★ a drained keeper cannot reach the gate, so the slide is gone until it wears off (${DRAINED_SPEED} < ${SLIDE_MIN_SPEED.toFixed(2)})`)
}

// ── ★ THE GATE IS DERIVED, AND ONLY THE SOURCE CAN SAY SO ────────────────────────────────────
// A value check cannot tell `RUN_SPEED * 0.92` from a hand-written `5.98`: they are the same
// number today and they differ the moment anyone retunes the sprint — at which point the literal
// silently stops gating anything, and an un-gated slide looks EXACTLY like a working one. So this
// one assert reads the declaration itself. Mutation: write the literal, it goes red.
{
  const src = readFileSync(join(__dirname, 'locomotion.ts'), 'utf8')
  const code = codeOnly(src)
  const decl = code.match(/^export const SLIDE_MIN_SPEED\s*=\s*(.+)$/m)
  ok(!!decl, 'BLIND: could not find the SLIDE_MIN_SPEED declaration — this assert measures nothing')
  ok(!!decl && /\bRUN_SPEED\b/.test(decl[1]),
     `★★ SLIDE_MIN_SPEED must DERIVE from RUN_SPEED, not mirror it as a literal (found \`${decl?.[1]?.trim()}\`)`)
  // and the ramp's own two ends, for the same reason a mirror is worse than an omission.
  ok(/^export const WALK_SPEED\s*=/m.test(code), 'BLIND: WALK_SPEED declaration is gone — the ramp has no bottom')
  ok(/^export const SPRINT_RAMP\s*=/m.test(code), 'BLIND: SPRINT_RAMP declaration is gone — the ramp has no duration')
}

// ── ★★★ THE WALL CATCH (2026-09-01) — "the game is waiting for an input for a second" ────────
// Alex's three branches: no input → fall · forward → climb · jump → kick. The asserts below are
// written against the shape of the bug I ACTUALLY SHIPPED while building it, not against the
// design — see the guaranteed-pin assert, which is the one that would have caught me.
{
  const flat = (x: number, y: number, z: number) => y < 10 || (x >= 20 && y < 24)
  /** Drop the keeper at the wall carrying an exact speed; return it on the frame it is caught. */
  const catchAt = (v: number, feetY = 10, air = false) => {
    const s = createLoco(19.0, 10, 0.5)
    for (let i = 0; i < 10; i++) tickLocomotion(s, input(), flat)
    if (air) { s.py = feetY; s.airborne = true; s.vy = 0 }
    for (let i = 0; i < 90; i++) {
      if (s.wallCatchT <= 0) { s.hvx = v; s.hvz = 0 }
      tickLocomotion(s, input({ mvX: 1 }), flat)
      if (s.wallCatchT > 0) return s
    }
    return null
  }
  // ⚠ NULL-TOLERANT ON PURPOSE. The asserts below short-circuit on a null, but the template
  // literal in the MESSAGE is evaluated eagerly either way — so a strict `sp` makes a guard that
  // is correct at runtime fail to typecheck, and the tempting fix is a `!` that throws instead of
  // failing. That is the crash-not-fail bug this same block already learned once.
  const sp = (s: ReturnType<typeof createLoco> | null) => (s ? Math.hypot(s.hvx, s.hvz) : NaN)

  // 1. The gate. A walk must pass a wall without being pinned to it, or ordinary navigation
  //    becomes flypaper; a sprint must catch. DERIVED from RUN_SPEED, so retuning the ramp cannot
  //    silently start catching walkers.
  ok(catchAt(WALK_SPEED) === null, `★ a WALK is not caught — navigation is not flypaper (${WALK_SPEED} vs gate ${WALL_CATCH_SPEED.toFixed(2)})`)
  ok(catchAt(RUN_SPEED) !== null, '★ a SPRINT is caught — the catch is one more thing the ramp earns')

  // 2. ★★★ THE GUARANTEED PIN. THIS IS THE ASSERT THAT WOULD HAVE CAUGHT MY OWN FIRST CUT.
  //    You arrive holding forward, so on the frame the catch fires forward is STILL HELD. Without
  //    a minimum the climb branch resolves on that same frame and the beat never happens — measured
  //    at 0.00s pinned, and it LOOKED right, because a keeper who runs at a wall and climbs it is
  //    a sensible thing to watch. Only a frame dump said otherwise.
  {
    const s0 = catchAt(RUN_SPEED)
    // ⚠ NOT `!`. Removing the pin makes catchAt return null, and a non-null assertion THROWS —
    // which the mutation harness read as neither pass nor fail, i.e. as a survivor. A guard must
    // fail with a name, never crash. (PATTERNS 08-22: "a crash reads as neither pass nor fail".)
    ok(s0 !== null, '★★★ BLIND/FAIL: no catch survived a frame — the pin is gone and the beat never happens')
    const s = s0 ?? createLoco(0, 10, 0)
    let held = 0
    while (s.wallCatchT > 0 && held < 120) { tickLocomotion(s, input({ mvX: 1 }), flat); held++ }
    ok(held / 60 >= WALL_CATCH_MIN - 0.02,
       `★★★ holding FORWARD through the collision still pins for WALL_CATCH_MIN (${(held/60).toFixed(3)}s vs ${WALL_CATCH_MIN}) — without this the beat never happens`)
    ok(s.catchClimb, '★ ...and then it converts to a climb, which is Alex\'s forward branch')
  }

  // 3. No input → falls, after the full beat, having slipped rather than stuck.
  {
    const air = (x: number, y: number, z: number) => y < 0 || (x >= 20 && y < 40)
    const s = createLoco(19.0, 20, 0.5); s.airborne = true; s.vy = 0
    let caught = -1, released = -1, yC = 0, yR = 0
    for (let i = 0; i < 600; i++) {
      if (s.wallCatchT <= 0 && caught < 0) { s.hvx = RUN_SPEED; s.hvz = 0 }
      tickLocomotion(s, input(), air)                       // ⚠ no input at all
      if (s.wallCatchT > 0 && caught < 0) { caught = i; yC = s.py }
      if (caught >= 0 && released < 0 && s.wallCatchT <= 0) { released = i; yR = s.py }
      if (released >= 0 && !s.airborne) break
    }
    ok(caught >= 0, '(premise) an airborne keeper is caught by the wall')
    ok(Math.abs((released - caught) / 60 - WALL_CATCH_TIME) < 0.03,
       `★ no input holds the FULL beat then releases (${((released-caught)/60).toFixed(2)}s vs ${WALL_CATCH_TIME})`)
    ok(Math.abs((yC - yR) - WALL_CATCH_SLIDE * WALL_CATCH_TIME) < 0.05,
       `★ and it slips down the face rather than sticking (${(yC-yR).toFixed(2)} blocks)`)
    ok(s.py < yR - 1, `★ then FALLS — Alex's no-input branch (dropped to ${s.py.toFixed(2)} from ${yR.toFixed(2)})`)
  }

  // 4. ★★ THE KICK CARRIES WHAT YOU BROUGHT. The first cut had WALLJUMP_KEEP 0.92, and a sprint
  //    arrival (6.5 × 0.92 = 5.98) fell UNDER the 6.0 floor — so the kick came out at exactly the
  //    old constant and the "momentum fix" fixed nothing at the speed people actually arrive at.
  const kickFrom = (v: number) => {
    const s = catchAt(v); if (!s) return null
    for (let i = 0; i < 12; i++) tickLocomotion(s, input(), flat)     // sit in the beat, no input
    tickLocomotion(s, input({ mvX: -1, jumpKey: true }), flat)
    return s
  }
  const slow = kickFrom(WALL_CATCH_SPEED + 0.1), fast = kickFrom(RUN_SPEED), slid = kickFrom(SLIDE_SPEED)
  ok(!!slow && !!fast && !!slid, 'BLIND: an arrival was never caught — the kick asserts below measure nothing')
  ok(!!slow?.justWallJumped && !!fast?.justWallJumped && !!slid?.justWallJumped, '(premise) all three arrivals kick')
  ok(!!fast && !!slow && sp(fast) > sp(slow) + 0.15,
     `★★ a SPRINT arrival kicks harder than a crawling one (${sp(fast).toFixed(2)} vs ${sp(slow).toFixed(2)}) — both were exactly 6.00 before`)
  ok(!!slid && !!fast && sp(slid) > sp(fast) + 2,
     `★★ and a SLIDE arrival harder still (${sp(slid).toFixed(2)}) — the wall returns what you brought`)
  ok(!!fast && fast.vy > WALLJUMP_UP - 0.01, `the kick is a real jump (vy ${fast?.vy.toFixed(2)})`)

  // 5. Steering, and the thing steering must never do.
  {
    const away = kickFrom(RUN_SPEED)
    ok(!!away && away.hvx < 0, '★ the kick leaves the wall')
    const s = catchAt(RUN_SPEED) ?? createLoco(0, 10, 0)
    for (let i = 0; i < 12; i++) tickLocomotion(s, input(), flat)
    tickLocomotion(s, input({ mvX: 1, jumpKey: true }), flat)         // ask to go INTO the face
    ok(s.justWallJumped && s.hvx < 0,
       `★★ asking to kick INTO the wall still leaves it (hvx ${s.hvx.toFixed(2)})`)
    // ⚠⚠ AND THE HONEST NOTE ABOUT THE ASSERT ABOVE, found by the sweep: at WALLJUMP_STEER ≤ 1 the
    // inward-strip in kickOffWall is UNREACHABLE — the normal is a unit vector and the wish adds at
    // most STEER, so the sum can never point inward, and removing the strip SURVIVES the whole
    // oracle. The strip is a guard for a future STEER, not live code. Rather than pretend to test
    // it, pin the premise that makes it dead: raise STEER above 1 and this fails, which is exactly
    // when someone must go read the strip.
    ok(WALLJUMP_STEER <= 1,
       `⚠ WALLJUMP_STEER is ${WALLJUMP_STEER} — above 1 a wish CAN point the kick back into the wall, so kickOffWall's inward-strip stops being dead code and needs a real test`)
  }

  // 6. ⚠ THE CATCH MUST NOT EAT THE VAULT. A 1-block rise is a deliberate press (07-08-07) and a
  //    half-slab is a step; the catch takes only 2-high faces. If it ever widened, it would steal
  //    both verbs at exactly the speed they are most used, and a stolen vault reads as a stuck player.
  {
    const terrace = (x: number, y: number, z: number) => y < 10 || (x >= 20 && y < 11)
    const s = createLoco(19.0, 10, 0.5)
    for (let i = 0; i < 10; i++) tickLocomotion(s, input(), terrace)
    for (let i = 0; i < 40; i++) { if (s.wallCatchT <= 0) { s.hvx = RUN_SPEED; s.hvz = 0 } ; tickLocomotion(s, input({ mvX: 1 }), terrace) }
    ok(s.wallCatchT <= 0 && !s.catchClimb, '⚠ a 1-block rise does NOT catch — it is still the vault')
  }
}

// ── ★ THE SPEED LENS IS WIRED, AND WIRED TO SPEED ────────────────────────────────────────────
// A call-site reader, because there is no headless way to run that frame loop — same reasoning as
// channel-wiring.test.ts. Read against `codeOnly`, which blanks comments: the block ABOVE the lens
// explains why it must not read `sprintT`, and a bare negative regex would match that explanation
// and go red on accurate prose. That is the 08-22 canon-gate bug, and it is easier to walk into
// than it looks — this assert was written by someone who had just read the entry.
{
  const vw = codeOnly(readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8'))
  const lens = blockAt(vw, 'const lspd = Math.hypot(loco.current', 'cam.updateProjectionMatrix()')
  ok(lens.at >= 0, 'BLIND: could not locate the speed lens — every assert below measures nothing')
  ok((vw.match(/const wantFov =/g) ?? []).length === 1,
     'BLIND: wantFov is not assigned exactly once — the lens this reads may not be the one that runs')

  ok(/\(lspd - WALK_SPEED\)/.test(lens.code),
     '★★ the lens must derive from SPEED — a bank-derived lens announces a sprint the keeper does not have')
  ok(!/sprintT/.test(lens.code),
     '⚠ the lens reads the sprint BANK: it will widen while a wall, a backpedal or a drain holds the real speed down')
  ok(/ads\.current \? ADS_FOV :/.test(lens.code),
     '★ ADS still wins outright — a widened lens while aiming fights the zoom the player asked for')
  ok(/SPEED_LENS_PUSH/.test(lens.code) && /SPEED_LENS_MAX/.test(lens.code),
     'the lens is tuned by named constants, not by literals buried in the frame loop')
  // ⚠ AND IT MUST SIT UNDER THE CONTEXT-LOSS GATE (another window's a348cc2). A dead context
  // should not be running the lens either; asserting the ORDER, since both lines are in useFrame.
  const gate = vw.indexOf('if (ctxLost.current) return')
  ok(gate >= 0 && gate < lens.at,
     '⚠ the speed lens runs ABOVE the context-loss gate — it will keep animating on a dead canvas')
}

console.log(`\nlocomotion: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the walker moves like play3d')
