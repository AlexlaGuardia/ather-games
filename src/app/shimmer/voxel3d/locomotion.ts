// The voxel walker's locomotion — play3d's Apex-lineage movement, re-grounded on block collision.
//
// ★ PURE. No three, no react, no DOM. Positions are plain numbers, the world is an injected
// `solid(x,y,z)` probe — so the whole state machine runs against a synthetic grid in a test, and a
// feel bug can be reproduced as an assert instead of a repro video.
//
// ── PROVENANCE (2026-08-07, Alex: "slide jump became a dash · climbing and wall jumping are
// non-existent") ─────────────────────────────────────────────────────────────────────────────
// Every constant below is play3d's (`Shimmer3D.tsx`, Alex-tuned across the crucible sessions) —
// copied, not invented, because the FEEL is the ruled thing and the numbers are the feel. Tier
// units ≈ voxel blocks (both 1 world unit), so they carry unscaled. What could NOT carry is
// collision: play3d resolves against tile heightmaps + segs; here everything is the one `solid`
// probe. Same split as the guns (engine/weapons.ts shares maths, each walker owns its hits).
// The old voxel walker was a placeholder — instant velocity, Shift = ×2.4 sprint. THAT was the
// "dash": Shift is crouch/slide in play3d, and muscle memory pressed it expecting a slide.
//
// ── The verbs ────────────────────────────────────────────────────────────────────────────────
//   run        auto-run with an accel ramp; friction coast on release; backpedal caps to a walk
//   slide      crouch at speed = a speed burst that bleeds back to run; eye dips
//   slide-hop  jump mid-slide pops takeoff speed ×1.12 (capped)
//   bhop       jump within 0.15s of landing chains the landing speed (×0.97 fatigue)
//   lurch      a sharp new air-input snaps momentum toward it once, at a small speed cost
//   step-up    1-block rises are FLOOR, not wall — grounded movement walks over them (NEW here;
//              play3d's canStep did this for tiles, the placeholder walker never had it)
//   climb      airborne + push into a 2-high face + HOLD Space ≥0.18s = scramble up; grip is a
//              distance budget (2.5) refilled on landing
//   mantle     a lip in reach during a held climb = GRAB and HANG; push in to pull up (eased,
//              0.3s — never a snap), push away to drop. Tap-jump never mantles.
//   wall jump  tap Space against a wall (0.18s coyote after leaving it) = kick up and away;
//              re-grip locked 0.22s so the push actually separates

export const RUN_SPEED = 6.5
export const BACK_SPEED = 3.5
export const CROUCH_SPEED = 2.6
export const GROUND_ACCEL = 7
export const GROUND_FRICTION = 13
export const GRAVITY = 22
export const JUMP_V0 = 7.4          // apex ≈ 1.24 blocks — clears a 1-block step with a tap
export const SLIDE_SPEED = 10
export const SLIDE_MIN_SPEED = 3.8
export const SLIDE_TIME = 0.6
export const AIR_CONTROL = 0.4
export const SLIDEHOP_BOOST = 1.12
export const SPEED_CAP = 14
export const BHOP_WINDOW = 0.15
export const BHOP_KEEP = 0.97
export const LURCH_TURN = 0.64
export const LURCH_STRENGTH = 0.65
export const LURCH_KEEP = 0.93
export const FALL_OFF = 0.32
export const CLIMB_SPEED = 2.5
export const CLIMB_STRAFE = 1.6
export const CLIMB_MAX_RISE = 2.5
export const MANTLE_REACH = 1.4
export const WALLJUMP_UP = 7.0
export const WALLJUMP_PUSH = 6.0
export const WALL_COYOTE = 0.18
export const WALLJUMP_LOCK = 0.22
export const CLIMB_HOLD_MIN = 0.18
export const HANG_DROP = 0.9
export const MANTLE_TIME = 0.30
export const HANG_MIN = 0.22
export const HANG_COMMIT = 0.35

export const BODY_R = 0.3           // the old walker's half-width, kept — the world was built around it
export const BODY_H = 1.75
export const EYE_STAND = 1.62       // camera sits this far above the feet (the old walker's eye)
export const EYE_SLIDE = 1.02       // eye height mid-slide/crouch
const STEP_UP = 1.05                // grounded movement treats solids up to this above the feet as floor

export type Solid = (x: number, y: number, z: number) => boolean

export interface LocoState {
  px: number; py: number; pz: number      // py = FEET, not eye — eye is derived (py + eye)
  hvx: number; hvz: number; vy: number
  eye: number
  airborne: boolean
  slideT: number; crouchHeld: boolean
  airSpeed: number; prevMvX: number; prevMvZ: number
  landGrace: number; landSpeed: number
  jumpHeld: boolean; spaceHeldT: number
  climbRise: number
  onWall: boolean; wallNX: number; wallNZ: number; wallCX: number; wallCZ: number
  wallStick: number; wallLock: number
  hanging: boolean; hangT: number; hangLock: number
  hangLipX: number; hangLipY: number; hangLipZ: number; hangCX: number; hangCZ: number
  mantleT: number; mFromX: number; mFromY: number; mFromZ: number; mToX: number; mToY: number; mToZ: number
  /** Set for one tick when a verb fires — the host reads these for HUD/FX and they self-clear. */
  justWallJumped: boolean; justHopped: boolean
  sliding: boolean; crouching: boolean; climbing: boolean
}

export function createLoco(px: number, feetY: number, pz: number): LocoState {
  return {
    px, py: feetY, pz, hvx: 0, hvz: 0, vy: 0, eye: EYE_STAND,
    airborne: true, slideT: 0, crouchHeld: false, airSpeed: 0, prevMvX: 0, prevMvZ: 0,
    landGrace: 0, landSpeed: 0, jumpHeld: false, spaceHeldT: 0, climbRise: 0,
    onWall: false, wallNX: 0, wallNZ: 0, wallCX: 0, wallCZ: 0, wallStick: 0, wallLock: 0,
    hanging: false, hangT: 0, hangLock: 0, hangLipX: 0, hangLipY: 0, hangLipZ: 0, hangCX: 0, hangCZ: 0,
    mantleT: 0, mFromX: 0, mFromY: 0, mFromZ: 0, mToX: 0, mToY: 0, mToZ: 0,
    justWallJumped: false, justHopped: false, sliding: false, crouching: false, climbing: false,
  }
}

export interface LocoInput {
  /** Normalized wish direction on the ground plane (0,0 = no input). */
  mvX: number; mvZ: number
  /** Camera basis on the ground plane — backpedal detection and climb strafing need it. */
  fwdX: number; fwdZ: number; rightX: number; rightZ: number
  jumpKey: boolean
  crouchKey: boolean
  dt: number
}

/** True when the body (feet at feetY) fits at (x, z). `stepAllow` lifts the tested bottom so
 *  grounded movement reads a low rise as floor rather than wall. */
export function bodyFree(solid: Solid, x: number, z: number, feetY: number, stepAllow = 0): boolean {
  const y0 = Math.floor(feetY + 0.01 + stepAllow)
  const y1 = Math.floor(feetY + BODY_H - 0.01)
  for (let vy = y0; vy <= y1; vy++)
    for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R])
      if (solid(Math.floor(x + dx), vy, Math.floor(z + dz))) return false
  return true
}

/** Highest supporting surface under the footprint within step range of the feet, or null. */
export function floorProbe(solid: Solid, x: number, z: number, feetY: number): number | null {
  const top = Math.floor(feetY + STEP_UP)
  const bottom = Math.floor(feetY - 1.4)
  for (let vy = top; vy >= bottom; vy--) {
    let support = false
    for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R])
      if (solid(Math.floor(x + dx), vy, Math.floor(z + dz))) { support = true; break }
    if (!support) continue
    const floorTop = vy + 1
    if (floorTop <= feetY + STEP_UP) return floorTop
  }
  return null
}

/** A standable lip on the column (bx, bz): solid below, two clear above, within grab reach. */
function lipAt(solid: Solid, bx: number, bz: number, feetY: number): number | null {
  const lo = Math.floor(feetY + 1.05)          // must be a REAL rise — a walkable step never grabs
  const hi = Math.floor(feetY + MANTLE_REACH)
  for (let vy = lo; vy <= hi; vy++) {
    if (solid(bx, vy - 1, bz) && !solid(bx, vy, bz) && !solid(bx, vy + 1, bz)) return vy
  }
  return null
}

export function tickLocomotion(s: LocoState, input: LocoInput, solid: Solid): void {
  const dt = Math.min(input.dt, 0.05)          // a stutter frame must not launch a huge step
  const { mvX, mvZ, crouchKey, jumpKey } = input
  const hasInput = (mvX !== 0 || mvZ !== 0)
  s.justWallJumped = false; s.justHopped = false

  // ── crouch / slide ──────────────────────────────────────────────────────────────────────────
  const curSpeed = Math.hypot(s.hvx, s.hvz)
  if (crouchKey && !s.crouchHeld && !s.airborne && curSpeed > SLIDE_MIN_SPEED && s.slideT <= 0) {
    s.slideT = SLIDE_TIME
    const burst = Math.max(SLIDE_SPEED, curSpeed * 1.35) / Math.max(1e-6, curSpeed)
    s.hvx *= burst; s.hvz *= burst
  }
  s.crouchHeld = crouchKey
  s.sliding = s.slideT > 0 && !s.airborne
  if (s.sliding) s.slideT -= dt
  s.crouching = crouchKey && !s.sliding && !s.airborne

  // ── wall contact (climb + wall-jump) ────────────────────────────────────────────────────────
  if (s.wallLock > 0) s.wallLock -= dt
  s.onWall = false
  if (hasInput && s.wallLock <= 0) {
    const bx = Math.floor(s.px), bz = Math.floor(s.pz)
    const sx = Math.sign(mvX), sz = Math.sign(mvZ)
    const face = (dx: number, dz: number) =>
      solid(bx + dx, Math.floor(s.py + 0.5), bz + dz) && solid(bx + dx, Math.floor(s.py + 1.3), bz + dz)
    const xWall = sx !== 0 && face(sx, 0)
    const zWall = sz !== 0 && face(0, sz)
    let cx = 0, cz = 0
    if (xWall && (!zWall || Math.abs(mvX) >= Math.abs(mvZ))) cx = sx
    else if (zWall) cz = sz
    if (cx || cz) {
      s.onWall = true
      s.wallCX = cx; s.wallCZ = cz
      s.wallNX = -cx; s.wallNZ = -cz
    }
  }
  if (s.onWall) s.wallStick = WALL_COYOTE
  else if (s.wallStick > 0) s.wallStick -= dt

  // Tap vs hold: a jump tap never climbs and never mantles; a held Space does both.
  if (jumpKey) s.spaceHeldT += dt; else s.spaceHeldT = 0
  const climbActive = s.spaceHeldT >= CLIMB_HOLD_MIN
  s.climbing = s.airborne && s.onWall && climbActive && s.climbRise < CLIMB_MAX_RISE

  // ── horizontal velocity ─────────────────────────────────────────────────────────────────────
  if (s.hanging || s.mantleT > 0) {
    s.hvx = 0; s.hvz = 0
  } else if (s.climbing) {
    const strafe = Math.max(-1, Math.min(1, mvX * input.rightX + mvZ * input.rightZ))
    s.hvx = input.rightX * strafe * CLIMB_STRAFE
    s.hvz = input.rightZ * strafe * CLIMB_STRAFE
  } else if (s.airborne) {
    if (hasInput && s.airSpeed > 0.01) {
      const len = Math.hypot(s.hvx, s.hvz)
      let dx = len > 1e-3 ? s.hvx / len : mvX
      let dz = len > 1e-3 ? s.hvz / len : mvZ
      if ((s.prevMvX !== 0 || s.prevMvZ !== 0) && s.prevMvX * mvX + s.prevMvZ * mvZ < LURCH_TURN) {
        dx += (mvX - dx) * LURCH_STRENGTH; dz += (mvZ - dz) * LURCH_STRENGTH
        const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n
        s.airSpeed *= LURCH_KEEP
      }
      const t = Math.min(1, AIR_CONTROL * dt * 12)
      dx += (mvX - dx) * t; dz += (mvZ - dz) * t
      const n = Math.hypot(dx, dz) || 1
      s.hvx = (dx / n) * s.airSpeed; s.hvz = (dz / n) * s.airSpeed
    } else if (hasInput) {
      s.airSpeed = RUN_SPEED * 0.5
      s.hvx = mvX * s.airSpeed; s.hvz = mvZ * s.airSpeed
    }
  } else if (s.sliding) {
    // Live speed, not the pre-entry sample — the entry tick multiplied hvel into the burst, and
    // bleeding from the stale number would cancel the burst on the very frame it fired.
    const cs = Math.hypot(s.hvx, s.hvz)
    const speed = Math.max(RUN_SPEED, cs - (SLIDE_SPEED - RUN_SPEED) * (dt / SLIDE_TIME))
    if (hasInput && cs > 1e-3) {
      let dx = s.hvx / cs, dz = s.hvz / cs
      dx += (mvX - dx) * 0.05; dz += (mvZ - dz) * 0.05
      const n = Math.hypot(dx, dz) || 1
      s.hvx = (dx / n) * speed; s.hvz = (dz / n) * speed
    } else if (cs > 1e-6) {
      const f = speed / cs; s.hvx *= f; s.hvz *= f
    }
  } else {
    const backpedal = hasInput && (mvX * input.fwdX + mvZ * input.fwdZ) < -0.2
    const target = s.crouching ? CROUCH_SPEED : backpedal ? BACK_SPEED : RUN_SPEED
    const rate = Math.min(1, (hasInput ? GROUND_ACCEL : GROUND_FRICTION) * dt)
    s.hvx += ((hasInput ? mvX * target : 0) - s.hvx) * rate
    s.hvz += ((hasInput ? mvZ * target : 0) - s.hvz) * rate
  }

  // ── horizontal apply, axis-separated; grounded movement steps over 1-block rises ────────────
  if ((s.hvx !== 0 || s.hvz !== 0) && s.mantleT <= 0 && !s.hanging) {
    const stepAllow = !s.airborne && !s.crouching ? STEP_UP : 0
    const nx = s.px + s.hvx * dt
    if (bodyFree(solid, nx, s.pz, s.py)) s.px = nx
    else if (stepAllow && bodyFree(solid, nx, s.pz, s.py, stepAllow)) s.px = nx   // floor-follow lifts us
    else s.hvx = 0
    const nz = s.pz + s.hvz * dt
    if (bodyFree(solid, s.px, nz, s.py)) s.pz = nz
    else if (stepAllow && bodyFree(solid, s.px, nz, s.py, stepAllow)) s.pz = nz
    else s.hvz = 0
  }

  // ── vertical ────────────────────────────────────────────────────────────────────────────────
  const jumpEdge = jumpKey && !s.jumpHeld
  const floorTop = floorProbe(solid, s.px, s.pz, s.py)

  // Mantle target: over the wall's own cardinal when we have one, else the dominant input axis.
  const useWallCard = (s.onWall || s.wallStick > 0) && (s.wallCX !== 0 || s.wallCZ !== 0)
  const gx = hasInput ? mvX : input.fwdX, gz = hasInput ? mvZ : input.fwdZ
  const cardX = useWallCard ? s.wallCX : Math.abs(gx) >= Math.abs(gz) ? (Math.sign(gx) || 1) : 0
  const cardZ = useWallCard ? s.wallCZ : Math.abs(gx) >= Math.abs(gz) ? 0 : (Math.sign(gz) || 1)

  if (s.hangLock > 0) s.hangLock -= dt
  if (!s.hanging && s.mantleT <= 0 && s.hangLock <= 0 && climbActive && s.airborne) {
    const bx = Math.floor(s.px) + cardX, bz = Math.floor(s.pz) + cardZ
    const lip = lipAt(solid, bx, bz, s.py)
    if (lip !== null) {
      s.hanging = true; s.hangT = 0
      s.hangLipX = bx + 0.5; s.hangLipY = lip; s.hangLipZ = bz + 0.5
      s.hangCX = cardX; s.hangCZ = cardZ
      s.climbRise = 0
    }
  }
  const intoLedge = hasInput ? (mvX * s.hangCX + mvZ * s.hangCZ) : 0

  const wallJumping = s.airborne && jumpEdge && !s.hanging && s.mantleT <= 0 && !s.climbing && s.wallStick > 0
  if (wallJumping) {
    s.vy = WALLJUMP_UP
    s.hvx = s.wallNX * WALLJUMP_PUSH; s.hvz = s.wallNZ * WALLJUMP_PUSH
    s.airSpeed = WALLJUMP_PUSH
    s.wallStick = 0; s.wallLock = WALLJUMP_LOCK
    s.justWallJumped = true
  }

  if (s.mantleT > 0) {
    // Commit pull-up: eased, up-biased so it reads up-then-forward. Never a snap.
    s.mantleT -= dt
    const t = 1 - Math.max(0, s.mantleT) / MANTLE_TIME
    const e = t * t * (3 - 2 * t)
    const eUp = Math.min(1, e * 1.5)
    s.px = s.mFromX + (s.mToX - s.mFromX) * e
    s.pz = s.mFromZ + (s.mToZ - s.mFromZ) * e
    s.py = s.mFromY + (s.mToY - s.mFromY) * eUp
    s.vy = 0
    if (s.mantleT <= 0) {
      s.px = s.mToX; s.py = s.mToY; s.pz = s.mToZ
      s.airborne = false; s.climbRise = 0
      const settle = RUN_SPEED * 0.4
      s.hvx = s.hangCX * settle; s.hvz = s.hangCZ * settle
    }
  } else if (s.hanging) {
    // Hang: gripped at the lip. A guaranteed beat, THEN input decides — in = pull up, away = drop.
    s.vy = 0
    s.py = s.hangLipY - HANG_DROP
    s.hangT += dt
    if (s.hangT >= HANG_MIN && intoLedge > HANG_COMMIT) {
      s.mFromX = s.px; s.mFromY = s.py; s.mFromZ = s.pz
      s.mToX = s.hangLipX; s.mToY = s.hangLipY; s.mToZ = s.hangLipZ
      s.mantleT = MANTLE_TIME; s.hanging = false
    } else if (s.hangT >= HANG_MIN && intoLedge < -HANG_COMMIT) {
      s.hanging = false; s.hangLock = 0.35
      s.airborne = true; s.vy = 0
      s.hvx = -s.hangCX * 2.2; s.hvz = -s.hangCZ * 2.2
    }
  } else if (s.airborne) {
    if (wallJumping) { s.py += s.vy * dt }
    else if (s.climbing) { s.vy = CLIMB_SPEED; s.climbRise += CLIMB_SPEED * dt; s.py += s.vy * dt }
    else {
      s.vy -= GRAVITY * dt
      const ny = s.py + s.vy * dt
      if (s.vy > 0 && !bodyFree(solid, s.px, s.pz, ny)) s.vy = 0   // head into a ceiling
      else s.py = ny
    }
    if (s.vy <= 0 && floorTop !== null && s.py <= floorTop) {
      s.py = floorTop; s.vy = 0; s.airborne = false; s.climbRise = 0
      s.landGrace = BHOP_WINDOW; s.landSpeed = Math.hypot(s.hvx, s.hvz)
    }
  } else if (jumpEdge) {
    s.airborne = true; s.vy = JUMP_V0
    let takeoff = Math.max(Math.hypot(s.hvx, s.hvz), hasInput ? RUN_SPEED : 0)
    if (s.sliding) { takeoff = Math.min(SPEED_CAP, Math.hypot(s.hvx, s.hvz) * SLIDEHOP_BOOST); s.justHopped = true }
    else if (s.landGrace > 0) takeoff = Math.min(SPEED_CAP, Math.max(takeoff, s.landSpeed * BHOP_KEEP))
    s.airSpeed = takeoff
    if (s.sliding) s.slideT = 0
  } else if (floorTop === null || floorTop < s.py - FALL_OFF) {
    s.airborne = true; s.vy = 0; s.airSpeed = Math.hypot(s.hvx, s.hvz)   // walked off a ledge
  } else {
    s.py += (floorTop - s.py) * 0.25     // grounded: ease onto the floor — smooth step-up AND -down
    s.climbRise = 0
  }
  s.jumpHeld = jumpKey

  // Eye dips through slide/crouch, springs back standing. Derived, never part of collision.
  s.eye += (((s.sliding || s.crouching) ? EYE_SLIDE : EYE_STAND) - s.eye) * 0.25

  if (s.airborne && hasInput) { s.prevMvX = mvX; s.prevMvZ = mvZ } else { s.prevMvX = 0; s.prevMvZ = 0 }
  if (s.landGrace > 0) s.landGrace -= dt
}
