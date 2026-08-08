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
//   vault      jump next to a 1-block rise = a quick eased mantle onto it, speed carried through
//              (Alex, playtest 2026-08-07: the AUTOMATIC step-up "was breaking the movement" —
//              climbing a block is a deliberate press now, one press per block, so a staircase
//              ladders under repeated jumps. A 2-high face never vaults; that is climb country.)
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
export const WALL_FACING = 0.5      // camera-forward · wall-cardinal for a CLIMB or a GRAB — both
                                    // belong to the wall directly ahead of your eyes, never a face
                                    // you happen to be strafing into or a 2-high block beside your
                                    // jump (Alex, 07-08-07, both rulings)
export const VAULT_TIME = 0.16      // quick — a vault is a step with intent, not a climb animation
export const VAULT_REACH = 0.55     // how close the face must be (beyond the body radius) to vault
export const VAULT_FACING = 0.4     // camera-forward · step-direction must exceed this — the vault
                                    // is an INTERACTION with a ledge you are LOOKING AT (Alex,
                                    // 07-08-07), never a side effect of brushing one sideways
export const COYOTE_TIME = 0.12     // jump grace after the ground drops away. Stepped terrain makes
                                    // every downhill run a chain of micro-falls, and without this a
                                    // jump pressed between two 1-block descents simply vanished —
                                    // Alex: "i tried jumping as i ran down a hill and nothing
                                    // would happen"

// ── swimming (2026-08-08 — the probe learned what water IS) ─────────────────────────────────
export const SWIM_SPEED = 3.4       // drag-dominated — half a run, deliberate
export const SWIM_ACCEL = 5
export const SWIM_UP = 3.6          // Space climbs the water
export const SWIM_SINK = 2.8        // crouch dives
export const SWIM_IDLE_SINK = 0.5   // hands-off drift: down, slowly — water is patient, not a floor
export const SWIM_DRAG = 5
export const TREAD_SINK_CAP = 1.8   // water catches a fall fast — no crater dives from a cliff

// ── half-steps (2026-08-08, the half-slab pass) ─────────────────────────────
// The grounded floor capture widens to this so a +0.5 surface is WALKED onto — that is the slab's
// whole mechanic (stairs without a press). A full block's +1 top stays out of reach: the vault
// ruling ("going up a block is always a deliberate press") is untouched, because only fractional
// surfaces can exist inside this band. Airborne landing keeps the tiny FLOOR_CAPTURE — the
// falling-past-a-lip pop this band would reintroduce is exactly what 07-08-07 ruled out.
export const STEP_CAPTURE = 0.55

export const BODY_R = 0.3           // the old walker's half-width, kept — the world was built around it
export const BODY_H = 1.75
export const EYE_STAND = 1.62       // camera sits this far above the feet (the old walker's eye)
export const EYE_SLIDE = 1.02       // eye height mid-slide/crouch
// How far above the feet the floor probe may CAPTURE a surface. Small on purpose: at 1.05 this was
// the automatic step-up (and it also popped a falling player up onto lips they fell past), which
// playtest ruled out — going up a block is the vault now, always a deliberate press.
const FLOOR_CAPTURE = 0.1

export type Solid = (x: number, y: number, z: number) => boolean

/**
 * ── ★ THE CELL PROBE (2026-08-08) — the probe's question grew from "solid?" to "what IS this" ──
 * A boolean probe cannot say "water" (you waded riverbeds like a submarine with legs) and cannot
 * say "half" (the slab problem). The probe now returns a CODE; booleans are still accepted and
 * normalised at the boundary, so every existing caller and every feel test keeps speaking boolean.
 * CELL_HALF is live (same day, the half-slab pass): bodyFree blocks only its lower half,
 * floorProbe supports at +0.5, and the grounded STEP_CAPTURE walks up half-rises. Wall, climb,
 * grab and vault verbs stay FULL-only — a slab is a step, never a wall.
 */
export const CELL_EMPTY = 0
export const CELL_SOLID = 1
export const CELL_WATER = 2
export const CELL_HALF = 3
export type CellProbe = (x: number, y: number, z: number) => boolean | number

export interface LocoState {
  px: number; py: number; pz: number      // py = FEET, not eye — eye is derived (py + eye)
  hvx: number; hvz: number; vy: number
  eye: number
  airborne: boolean
  coyoteT: number
  slideT: number; crouchHeld: boolean
  airSpeed: number; prevMvX: number; prevMvZ: number
  landGrace: number; landSpeed: number
  jumpHeld: boolean; spaceHeldT: number
  climbRise: number
  onWall: boolean; wallNX: number; wallNZ: number; wallCX: number; wallCZ: number
  wallStick: number; wallLock: number
  hanging: boolean; hangT: number; hangLock: number
  hangLipX: number; hangLipY: number; hangLipZ: number; hangCX: number; hangCZ: number
  mantleT: number; mantleDur: number
  mFromX: number; mFromY: number; mFromZ: number; mToX: number; mToY: number; mToZ: number
  /** True while the mantle lerp is a VAULT — speed is carried through instead of the ledge settle. */
  vaulting: boolean; carryVX: number; carryVZ: number
  /** Set for one tick when a verb fires — the host reads these for HUD/FX and they self-clear. */
  justWallJumped: boolean; justHopped: boolean
  sliding: boolean; crouching: boolean; climbing: boolean
  /** Body submerged — the swim physics own this tick. The host reads it for HUD/FX. */
  swimming: boolean
}

export function createLoco(px: number, feetY: number, pz: number): LocoState {
  return {
    px, py: feetY, pz, hvx: 0, hvz: 0, vy: 0, eye: EYE_STAND,
    airborne: true, coyoteT: 0, slideT: 0, crouchHeld: false, airSpeed: 0, prevMvX: 0, prevMvZ: 0,
    landGrace: 0, landSpeed: 0, jumpHeld: false, spaceHeldT: 0, climbRise: 0,
    onWall: false, wallNX: 0, wallNZ: 0, wallCX: 0, wallCZ: 0, wallStick: 0, wallLock: 0,
    hanging: false, hangT: 0, hangLock: 0, hangLipX: 0, hangLipY: 0, hangLipZ: 0, hangCX: 0, hangCZ: 0,
    mantleT: 0, mantleDur: MANTLE_TIME, mFromX: 0, mFromY: 0, mFromZ: 0, mToX: 0, mToY: 0, mToZ: 0,
    vaulting: false, carryVX: 0, carryVZ: 0,
    justWallJumped: false, justHopped: false, sliding: false, crouching: false, climbing: false,
    swimming: false,
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

/** True when the body (feet at feetY) fits at (x, z). Accepts the raw cell probe: a CELL_HALF
 *  cell blocks only its lower half, so a body standing ON a slab (feet at +0.5) is clear. */
export function bodyFree(probe: CellProbe, x: number, z: number, feetY: number): boolean {
  const y0 = Math.floor(feetY + 0.01)
  const y1 = Math.floor(feetY + BODY_H - 0.01)
  for (let vy = y0; vy <= y1; vy++)
    for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R]) {
      const v = probe(Math.floor(x + dx), vy, Math.floor(z + dz))
      if (v === true || v === CELL_SOLID) return false
      if (v === CELL_HALF && feetY + 0.01 < vy + 0.5) return false
    }
  return true
}

/** Highest supporting surface under the footprint at or just below the feet, or null. Full cells
 *  support at +1, half cells at +0.5 — the slab's standing height. The capture band above the
 *  feet defaults tiny (FLOOR_CAPTURE); the GROUNDED pass widens it to STEP_CAPTURE so a half-rise
 *  is a step, not a wall — while a full block's +1 stays out of reach and stays a vault. */
export function floorProbe(probe: CellProbe, x: number, z: number, feetY: number, capture = FLOOR_CAPTURE): number | null {
  const top = Math.floor(feetY + capture)
  const bottom = Math.floor(feetY - 1.4)
  for (let vy = top; vy >= bottom; vy--) {
    let best: number | null = null
    for (const dx of [-BODY_R, BODY_R]) for (const dz of [-BODY_R, BODY_R]) {
      const v = probe(Math.floor(x + dx), vy, Math.floor(z + dz))
      const t = (v === true || v === CELL_SOLID) ? vy + 1 : v === CELL_HALF ? vy + 0.5 : null
      if (t !== null && t <= feetY + capture && (best === null || t > best)) best = t
    }
    if (best !== null) return best
  }
  return null
}

/**
 * A vaultable 1-block step directly ahead: its face within reach, its top standable, and NOT a
 * taller wall (a 2-high face is climb country, never a vault). Returns the landing, or null.
 */
function vaultTarget(solid: Solid, px: number, pz: number, feetY: number, cardX: number, cardZ: number):
  { x: number; y: number; z: number } | null {
  if (cardX === 0 && cardZ === 0) return null
  const bx = Math.floor(px + cardX * (BODY_R + VAULT_REACH))
  const bz = Math.floor(pz + cardZ * (BODY_R + VAULT_REACH))
  if (bx === Math.floor(px) && bz === Math.floor(pz)) return null   // no new column in reach
  const fy = Math.floor(feetY + 0.01)
  if (!solid(bx, fy, bz)) return null                               // nothing to step onto
  if (solid(bx, fy + 1, bz) || solid(bx, fy + 2, bz)) return null   // taller than one block
  const to = { x: px + cardX * 0.85, y: fy + 1, z: pz + cardZ * 0.85 }
  return bodyFree(solid, to.x, to.z, to.y) ? to : null
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

export function tickLocomotion(s: LocoState, input: LocoInput, probe: CellProbe): void {
  const dt = Math.min(input.dt, 0.05)          // a stutter frame must not launch a huge step
  const { mvX, mvZ, crouchKey, jumpKey } = input
  const hasInput = (mvX !== 0 || mvZ !== 0)
  s.justWallJumped = false; s.justHopped = false

  // Normalise at the boundary: booleans stay valid (every feel test, unchanged), codes add water.
  // CELL_HALF collides as full until the half-slab pass teaches ground height fractions.
  const solid: Solid = (x, y, z) => { const v = probe(x, y, z); return v === true || v === CELL_SOLID || v === CELL_HALF }
  const waterAt = (x: number, y: number, z: number) => probe(x, y, z) === CELL_WATER

  // ── swimming ────────────────────────────────────────────────────────────────────────────────
  // Submerged = chest AND feet in water: the swim physics own the whole tick, and every ground/
  // wall/ledge verb stands down (you cannot slide, vault or bhop through a pond). Feet-only =
  // TREADING: normal physics with two amendments below — the water caps a fall, and it counts as
  // perpetual coyote ground, which is what makes "swim to the bank and hop out" a plain jump.
  const fx = Math.floor(s.px), fz = Math.floor(s.pz)
  const chestIn = waterAt(fx, Math.floor(s.py + 1.0), fz)
  const feetIn = waterAt(fx, Math.floor(s.py + 0.2), fz)
  s.swimming = chestIn && feetIn
  if (s.swimming) {
    s.sliding = false; s.crouching = false; s.climbing = false; s.onWall = false
    s.hanging = false; s.mantleT = 0; s.vaulting = false; s.slideT = 0
    s.airborne = true                      // leaving the water without a jump is a fall, correctly
    const k = Math.min(1, dt * SWIM_ACCEL)
    s.hvx += (mvX * SWIM_SPEED - s.hvx) * k
    s.hvz += (mvZ * SWIM_SPEED - s.hvz) * k
    const vTarget = jumpKey ? SWIM_UP : crouchKey ? -SWIM_SINK : -SWIM_IDLE_SINK
    s.vy += (vTarget - s.vy) * Math.min(1, dt * SWIM_DRAG)
    const nx = s.px + s.hvx * dt
    if (bodyFree(probe, nx, s.pz, s.py)) s.px = nx; else s.hvx = 0
    const nz = s.pz + s.hvz * dt
    if (bodyFree(probe, s.px, nz, s.py)) s.pz = nz; else s.hvz = 0
    const ny = s.py + s.vy * dt
    if (bodyFree(probe, s.px, s.pz, ny)) s.py = ny; else s.vy = 0
    s.jumpHeld = jumpKey; s.landGrace = 0; s.coyoteT = 0
    s.eye += (EYE_STAND - s.eye) * 0.25
    return
  }
  if (feetIn) {
    if (s.vy < -TREAD_SINK_CAP) s.vy = -TREAD_SINK_CAP        // the water catches the fall
    if (s.vy <= 0) s.coyoteT = COYOTE_TIME                    // water is jumpable ground, always
  }

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
  // Facing gates the climb exactly as it gates the grab: you scramble up what you LOOK at. A wall
  // you are merely strafe-pressed against is collision, not a ladder.
  const wallFaced = s.onWall && (input.fwdX * s.wallCX + input.fwdZ * s.wallCZ) > WALL_FACING
  s.climbing = s.airborne && wallFaced && climbActive && s.climbRise < CLIMB_MAX_RISE

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

  // ── horizontal apply, axis-separated. A 1-block rise BLOCKS — going up it is the vault. ─────
  // A HALF rise is a step (2026-08-08): a blocked grounded move retries with the feet lifted
  // onto a ≤0.5 surface at the target. Full blocks fail the rise check by a whole half-block,
  // so the vault ruling cannot be re-armed from here.
  const stepped = (tx: number, tz: number): boolean => {
    if (s.airborne) return false
    const ft = floorProbe(probe, tx, tz, s.py, STEP_CAPTURE)
    if (ft === null || ft <= s.py || ft - s.py > 0.5 + 1e-6) return false
    if (!bodyFree(probe, tx, tz, ft)) return false
    s.py = ft
    return true
  }
  if ((s.hvx !== 0 || s.hvz !== 0) && s.mantleT <= 0 && !s.hanging) {
    const nx = s.px + s.hvx * dt
    if (bodyFree(probe, nx, s.pz, s.py) || stepped(nx, s.pz)) s.px = nx; else s.hvx = 0
    const nz = s.pz + s.hvz * dt
    if (bodyFree(probe, s.px, nz, s.py) || stepped(s.px, nz)) s.pz = nz; else s.hvz = 0
  }

  // ── vertical ────────────────────────────────────────────────────────────────────────────────
  const jumpEdge = jumpKey && !s.jumpHeld
  // Grounded widens the capture so half-surfaces are steps; airborne keeps it tiny (no lip-pop).
  const floorTop = floorProbe(probe, s.px, s.pz, s.py, s.airborne ? FLOOR_CAPTURE : STEP_CAPTURE)

  // Mantle target: over the wall's own cardinal when we have one, else the dominant input axis.
  const useWallCard = (s.onWall || s.wallStick > 0) && (s.wallCX !== 0 || s.wallCZ !== 0)
  const gx = hasInput ? mvX : input.fwdX, gz = hasInput ? mvZ : input.fwdZ
  const cardX = useWallCard ? s.wallCX : Math.abs(gx) >= Math.abs(gz) ? (Math.sign(gx) || 1) : 0
  const cardZ = useWallCard ? s.wallCZ : Math.abs(gx) >= Math.abs(gz) ? 0 : (Math.sign(gz) || 1)

  if (s.hangLock > 0) s.hangLock -= dt
  // ★ A GRAB NEEDS THE WALL, NOT A DIRECTION. The first cut probed whatever column the input's
  // dominant axis (or the camera, with no input) pointed at — so a jump beside any block that
  // happened to be 2-high could snatch a hang out of the air. Now a hang can only target the wall
  // being CLIMBED: real contact (or the breath of coyote after it), that wall's own cardinal, and
  // the camera facing it. Off-wall jumps never grab; that is what the vault and the jump are for.
  if (!s.hanging && s.mantleT <= 0 && s.hangLock <= 0 && climbActive && s.airborne) {
    const hasCard = (s.onWall || s.wallStick > 0) && (s.wallCX !== 0 || s.wallCZ !== 0)
    const faced = hasCard && (input.fwdX * s.wallCX + input.fwdZ * s.wallCZ) > WALL_FACING
    if (faced) {
      const bx = Math.floor(s.px) + s.wallCX, bz = Math.floor(s.pz) + s.wallCZ
      const lip = lipAt(solid, bx, bz, s.py)
      if (lip !== null) {
        s.hanging = true; s.hangT = 0
        s.hangLipX = bx + 0.5; s.hangLipY = lip; s.hangLipZ = bz + 0.5
        s.hangCX = s.wallCX; s.hangCZ = s.wallCZ
        s.climbRise = 0
      }
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
  } else if (s.airborne && jumpEdge && s.coyoteT > 0 && !s.hanging && s.mantleT <= 0 && !s.climbing) {
    // Coyote jump: the ground JUST left (a downhill micro-fall, a ledge a frame ago) — honour the
    // press as the ground jump it was meant to be. The wall jump wins when both are live.
    s.vy = JUMP_V0
    s.airSpeed = Math.max(Math.hypot(s.hvx, s.hvz), hasInput ? RUN_SPEED : 0)
    s.coyoteT = 0
  }
  if (s.coyoteT > 0) s.coyoteT -= dt

  if (s.mantleT > 0) {
    // Commit pull-up: eased, up-biased so it reads up-then-forward. Never a snap.
    // ⚠ Divide by the duration THIS lerp was started with. The vault sets a shorter timer than the
    // climb-mantle, and dividing by the constant meant a vault began its ease ~47% complete — ~70%
    // of the height applied on frame one. That was the "sometimes it just blinks up": the full
    // mantle (0.30s) divided correctly and read as a hop; every vault (0.16s) snapped.
    s.mantleT -= dt
    const t = 1 - Math.max(0, s.mantleT) / s.mantleDur
    const e = t * t * (3 - 2 * t)
    const eUp = Math.min(1, e * 1.5)
    s.px = s.mFromX + (s.mToX - s.mFromX) * e
    s.pz = s.mFromZ + (s.mToZ - s.mFromZ) * e
    s.py = s.mFromY + (s.mToY - s.mFromY) * eUp
    s.vy = 0
    if (s.mantleT <= 0) {
      s.px = s.mToX; s.py = s.mToY; s.pz = s.mToZ
      s.airborne = false; s.climbRise = 0
      if (s.vaulting) {
        // A vault is part of the RUN — the speed you brought to the step leaves with you.
        s.hvx = s.carryVX; s.hvz = s.carryVZ; s.vaulting = false
        // ★ THE COMBO (Alex, 07-08-07): jump still HELD + another faced single directly ahead =
        // chain straight into the next vault, so a staircase is one held flow instead of a press
        // per block. Tap still climbs exactly one; releasing the key ends the chain wherever it
        // is. Terminates by construction — every link needs its own 1-block step to exist.
        if (jumpKey && hasInput && (input.fwdX * cardX + input.fwdZ * cardZ) > VAULT_FACING) {
          const next = vaultTarget(solid, s.px, s.pz, s.py, cardX, cardZ)
          if (next) {
            s.mFromX = s.px; s.mFromY = s.py; s.mFromZ = s.pz
            s.mToX = next.x; s.mToY = next.y; s.mToZ = next.z
            s.mantleT = VAULT_TIME; s.mantleDur = VAULT_TIME; s.vaulting = true
            const carry = Math.max(Math.hypot(s.carryVX, s.carryVZ), RUN_SPEED * 0.6)
            s.carryVX = mvX * carry; s.carryVZ = mvZ * carry
            s.hangCX = cardX; s.hangCZ = cardZ
          }
        }
      } else {
        const settle = RUN_SPEED * 0.4
        s.hvx = s.hangCX * settle; s.hvz = s.hangCZ * settle
      }
    }
  } else if (s.hanging) {
    // Hang: gripped at the lip. A guaranteed beat, THEN input decides — in = pull up, away = drop.
    s.vy = 0
    s.py = s.hangLipY - HANG_DROP
    s.hangT += dt
    if (s.hangT >= HANG_MIN && intoLedge > HANG_COMMIT) {
      s.mFromX = s.px; s.mFromY = s.py; s.mFromZ = s.pz
      s.mToX = s.hangLipX; s.mToY = s.hangLipY; s.mToZ = s.hangLipZ
      s.mantleT = MANTLE_TIME; s.mantleDur = MANTLE_TIME; s.hanging = false
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
      if (s.vy > 0 && !bodyFree(probe, s.px, s.pz, ny)) s.vy = 0   // head into a ceiling
      else s.py = ny
    }
    if (s.vy <= 0 && floorTop !== null && s.py <= floorTop) {
      s.py = floorTop; s.vy = 0; s.airborne = false; s.climbRise = 0
      s.landGrace = BHOP_WINDOW; s.landSpeed = Math.hypot(s.hvx, s.hvz)
    }
  } else if (jumpEdge) {
    // ★ THE VAULT COMES FIRST (Alex, playtest 2026-08-07: "if you have a 1 block, the jump does a
    // mantle"). Pressing jump INTO a 1-block step climbs it — one press per block, so a staircase
    // ladders and a slope of steps is a rhythm, not a pogo. No step in reach (or moving away from
    // it, or sliding — a slide-hop must stay a hop) = the ballistic jump, unchanged.
    const facing = input.fwdX * cardX + input.fwdZ * cardZ > VAULT_FACING
    const vt = !s.sliding && hasInput && facing ? vaultTarget(solid, s.px, s.pz, s.py, cardX, cardZ) : null
    if (vt) {
      s.mFromX = s.px; s.mFromY = s.py; s.mFromZ = s.pz
      s.mToX = vt.x; s.mToY = vt.y; s.mToZ = vt.z
      s.mantleT = VAULT_TIME; s.mantleDur = VAULT_TIME; s.vaulting = true
      // Carry along the INPUT direction, floored at a brisk walk: by the time you vault you are
      // usually pressed against the face and the wall has already zeroed hvel — carrying THAT
      // would end every stair at a dead stop, which un-does the rhythm the vault exists for.
      const carry = Math.max(Math.hypot(s.hvx, s.hvz), RUN_SPEED * 0.6)
      s.carryVX = mvX * carry; s.carryVZ = mvZ * carry
      s.hangCX = cardX; s.hangCZ = cardZ         // mantle lerp reads these on completion
    } else {
      s.airborne = true; s.vy = JUMP_V0
      let takeoff = Math.max(Math.hypot(s.hvx, s.hvz), hasInput ? RUN_SPEED : 0)
      if (s.sliding) { takeoff = Math.min(SPEED_CAP, Math.hypot(s.hvx, s.hvz) * SLIDEHOP_BOOST); s.justHopped = true }
      else if (s.landGrace > 0) takeoff = Math.min(SPEED_CAP, Math.max(takeoff, s.landSpeed * BHOP_KEEP))
      s.airSpeed = takeoff
      if (s.sliding) s.slideT = 0
    }
  } else if (floorTop === null || floorTop < s.py - FALL_OFF) {
    s.airborne = true; s.vy = 0; s.airSpeed = Math.hypot(s.hvx, s.hvz)   // walked off a ledge
    s.coyoteT = COYOTE_TIME     // ...and the jump you press a hair late still belongs to the ground
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
