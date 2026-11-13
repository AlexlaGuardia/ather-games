// A COURSER's handling — the manalic car (CANON_GAPS › the open world's MAP, RULED 2026-11-13: the family is
// Coursers, kinds named by function; this first one is the DARTER, the coupe). OPEN_WORLD_PLAN.md › P5.
//
// ★ PURE and DETERMINISTIC, like the walker: no three.js, no clock. The page steps it at a fixed rate, the
// test steps it the same way, and one day `breach-server` can step it too.
//
// The model is the arcade classic, chosen for FEEL over realism:
//   · velocity lives in the WORLD; each step it is split into forward + lateral against the body's heading.
//   · steering sets a target yaw rate (the bicycle model: v·tan(steer)/wheelbase); the body turns toward it.
//   · GRIP kills lateral velocity. Turn faster than grip can follow and the car slides. That's the drift,
//     and it falls out of the model rather than being scripted.
//   · the handbrake drops rear grip and lets the yaw run ahead, so the tail steps out on command.
//   · the ground is a height function. Grounded, the car rides it; if the ground falls away faster than
//     gravity can follow (a ramp's lip), the car leaves it and flies until it lands.
//
// Numbers are a first pass for Alex to judge, not tuned truth. They live in one table on purpose.

export type Ground = (x: number, z: number) => number

export interface CourserTune {
  top: number          // m/s, flat-ground top speed under full throttle
  engine: number       // m/s², launch acceleration (falls off toward top)
  brake: number        // m/s²
  reverseTop: number
  reverse: number
  roll: number         // m/s², rolling resistance when coasting
  air: number          // quadratic drag coefficient
  wheelbase: number    // m
  maxSteer: number     // rad at standstill
  steerFall: number    // m/s at which max steer has halved (less twitch at speed)
  steerRate: number    // 1/s, how fast the wheel follows the stick
  grip: number         // 1/s, lateral velocity decay with all four tyres biting
  gripHb: number       // 1/s, same with the handbrake up
  yawFollow: number    // 1/s, body yaw rate → target
  yawFollowHb: number
  hbYawBoost: number   // handbrake multiplies the target yaw rate (the tail steps out)
  hbDecel: number      // m/s², the handbrake also scrubs speed
  latMax: number       // m/s², the most sideways pull the tyres give: caps the turn rate at speed
  gravity: number
}

export const DARTER: CourserTune = {
  top: 44, engine: 11, brake: 22, reverseTop: 9, reverse: 6,
  roll: 1.2, air: 0.0009,
  wheelbase: 2.5, maxSteer: 0.6, steerFall: 12, steerRate: 7,
  grip: 9, gripHb: 0.9, yawFollow: 10, yawFollowHb: 4.5, hbYawBoost: 2.2, hbDecel: 3.5, latMax: 14,
  gravity: 22,          // heavier than 9.8 on purpose: arcade jumps that come down with authority
}

export interface Courser {
  x: number; y: number; z: number
  yaw: number           // 0 faces −z (the walker's convention)
  vx: number; vy: number; vz: number
  yawRate: number
  steer: number         // current wheel angle, rad
  airborne: boolean
  airT: number          // seconds in the air (this flight)
  landed: number        // impact speed of the last landing, m/s (decays; the camera's thump)
  wheelAngle: number    // accumulated wheel spin, rad (visual)
}

export interface CourserInput { throttle: number; steer: number; handbrake: boolean; dt: number }

export const WHEEL_R = 0.36

export function createCourser(x: number, z: number, yaw: number, ground: Ground): Courser {
  return { x, y: ground(x, z), z, yaw, vx: 0, vy: 0, vz: 0, yawRate: 0, steer: 0, airborne: false, airT: 0, landed: 0, wheelAngle: 0 }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Forward speed (signed) and lateral speed against the body. */
export function bodySpeeds(c: Courser): { fwd: number; lat: number } {
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
  return { fwd: c.vx * fx + c.vz * fz, lat: c.vx * rx + c.vz * rz }
}

/** Slip angle in radians: how far the travel direction is from where the nose points. */
export function slipAngle(c: Courser): number {
  const { fwd, lat } = bodySpeeds(c)
  return Math.hypot(fwd, lat) < 2 ? 0 : Math.atan2(Math.abs(lat), Math.abs(fwd))
}

export function tickCourser(c: Courser, inp: CourserInput, ground: Ground, t: CourserTune = DARTER): void {
  const dt = inp.dt
  const throttle = clamp(inp.throttle, -1, 1), steerIn = clamp(inp.steer, -1, 1)
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
  let vF = c.vx * fx + c.vz * fz, vL = c.vx * rx + c.vz * rz

  // the wheel follows the stick, and turns less the faster you go
  const steerTarget = steerIn * t.maxSteer / (1 + Math.abs(vF) / t.steerFall)
  c.steer += (steerTarget - c.steer) * Math.min(1, dt * t.steerRate)
  c.landed = Math.max(0, c.landed - dt * 30)

  if (!c.airborne) {
    // ── engine, brake, reverse ──
    let aF = 0
    if (throttle > 0) aF = vF < -0.5 ? t.brake * throttle : t.engine * throttle * Math.max(0, 1 - vF / t.top)
    else if (throttle < 0) aF = vF > 0.5 ? t.brake * throttle : t.reverse * throttle * Math.max(0, 1 + vF / t.reverseTop)
    // ── slope: gravity along the nose ──
    const hA = ground(c.x + fx, c.z + fz), hB = ground(c.x - fx, c.z - fz)
    const slopeA = Number.isFinite(hA) && Number.isFinite(hB) ? -t.gravity * ((hA - hB) / 2) * 0.55 : 0
    aF += slopeA
    // ── resistances ──
    if (throttle === 0 && Math.abs(vF) > 0.05) aF -= Math.sign(vF) * t.roll
    if (inp.handbrake && Math.abs(vF) > 0.05) aF -= Math.sign(vF) * t.hbDecel
    aF -= t.air * vF * Math.abs(vF)
    const before = vF
    vF += aF * dt
    // brakes and drag stop the car; they never push it backwards
    if (throttle >= 0 && before > 0 && vF < 0 && throttle === 0) vF = 0
    if (throttle <= 0 && before < 0 && vF > 0 && throttle === 0) vF = 0
    if (throttle > 0 && before < 0 && vF > 0) vF = 0
    if (throttle < 0 && before > 0 && vF < 0) vF = 0
    if (throttle === 0 && Math.abs(vF) < 0.15 && Math.abs(slopeA) < t.roll) vF = 0   // settles, never creeps; a real slope still rolls it

    // ── yaw: the bicycle model sets where the body wants to turn ──
    // (positive steer = right = yaw decreasing, in the walker's convention)
    let yawTarget = -vF * Math.tan(c.steer) / t.wheelbase
    // ...but the tyres can only pull so hard sideways: at speed the turn rate is capped by grip
    const cap = t.latMax / Math.max(4, Math.abs(vF))
    yawTarget = clamp(yawTarget, -cap, cap)
    if (inp.handbrake) yawTarget *= t.hbYawBoost
    c.yawRate += (yawTarget - c.yawRate) * Math.min(1, dt * (inp.handbrake ? t.yawFollowHb : t.yawFollow))
    c.yaw += c.yawRate * dt

    // ── grip: lateral velocity bleeds away; less of it at high speed so a hard turn becomes a slide ──
    const grip = (inp.handbrake ? t.gripHb : t.grip) / (1 + Math.max(0, Math.abs(vF) - 22) / 12)
    vL *= Math.exp(-dt * grip)

    // velocity back to the world on the OLD basis; the new yaw re-splits it next step (that IS the drift)
    c.vx = fx * vF + rx * vL
    c.vz = fz * vF + rz * vL
    const hOld = ground(c.x, c.z)
    c.x += c.vx * dt; c.z += c.vz * dt
    const hNew = ground(c.x, c.z)
    const rideVy = (hNew - hOld) / dt
    // the lip: the ground drops away faster than gravity can pull the car down onto it → fly
    if (Number.isFinite(hNew) && rideVy < c.vy - t.gravity * dt - 0.5) {
      c.airborne = true; c.airT = 0
      c.y += c.vy * dt
    } else {
      c.vy = Number.isFinite(rideVy) ? rideVy : 0
      c.y = Number.isFinite(hNew) ? hNew : c.y
    }
  } else {
    // ── flight: ballistic, a touch of air steer so a jump is not a cutscene ──
    c.airT += dt
    c.vy -= t.gravity * dt
    c.yawRate += (-steerIn * 0.9 - c.yawRate) * Math.min(1, dt * 2)
    c.yaw += c.yawRate * dt
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt
    const h = ground(c.x, c.z)
    if (Number.isFinite(h) && c.y <= h) {
      c.landed = Math.max(0, -c.vy)
      c.y = h; c.vy = 0; c.airborne = false
      // a hard landing scrubs a little speed; a clean one barely
      const keep = 1 - Math.min(0.25, c.landed * 0.012)
      c.vx *= keep; c.vz *= keep
    }
  }

  const { fwd } = bodySpeeds(c)
  c.wheelAngle += (fwd / WHEEL_R) * dt
}
