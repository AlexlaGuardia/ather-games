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

/** The surface under x, z. `y` is a HINT (the car's height): with more than one surface at a spot (a bridge deck
 *  over water, a span over a road) the ground answers the highest one the car can be on (at or a step below y). A
 *  plain heightmap ignores it. Called without y: the highest surface (spawn, placement). */
export type Ground = (x: number, z: number, y?: number) => number

export interface CourserTune {
  top: number          // m/s, flat-ground top speed under full throttle (where power meets air drag)
  power: number        // m²/s³: a constant-POWER engine, accel = power / speed (a real car's curve: it pulls
                       // hard low down and tapers toward top speed; the old linear falloff ran out of breath early)
  traction: number     // m/s², the most the tyres put down off the line (caps power at low speed)
  brake: number        // m/s²
  reverseTop: number
  reverse: number
  roll: number         // m/s², rolling resistance when coasting
  air: number          // quadratic drag coefficient (spec-derived: power / top³, so top speed is exact)
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
  suspVy: number       // m/s, the most UPWARD speed riding the ground can give the body (the suspension soaks the rest)
  steep: number        // rise/run past which a face costs speed instead of being climbed
  steepScrub: number   // 1/s per unit of slope past `steep`
  // ── the DRIFT STATE (Alex 11-13: "tap the handbrake while going fast enough… that slippy slidy feel"). A TAP at
  // speed while steering starts it; then Space is free: steering sets the angle, throttle holds it and the speed. ──
  driftMin: number      // m/s, the least speed a tap starts a drift at (below it a tap is a brake)
  driftAngle: number    // rad, the slip angle a drift settles at with the stick neutral-in-the-turn
  driftRange: number    // rad, ± how far steering into / against the turn moves that angle
  driftLat: number      // × latMax: how hard the PATH curves in a drift. ABOVE 1 on purpose: a drift is how you take a corner
                        // tighter than grip allows (at 0.95 a 2 s drift turned only 55°, a lazy 60 m arc)
  driftYawK: number     // 1/s, how firmly the body is held at its angle (the auto-countersteer)
  driftDrag: number     // m/s², what a drift costs on throttle (small: a drift keeps its speed)
  driftCoast: number    // m/s², what it costs off throttle
  gripReturn: number    // s, grip ramps back over this after a drift, so the exit never snaps
  gravity: number
}

/** The handling half of a tune; the speed half (top, power, traction, air, brake) comes from a SPEC sheet. */
const HANDLING = {
  reverseTop: 9, reverse: 6, roll: 1.2,
  wheelbase: 2.5, maxSteer: 0.6, steerFall: 12, steerRate: 7,
  grip: 9, gripHb: 0.9, yawFollow: 10, yawFollowHb: 4.5, hbYawBoost: 2.2, hbDecel: 3.5, latMax: 14,
  suspVy: 5, steep: 0.6, steepScrub: 18,
  driftMin: 14, driftAngle: 0.52, driftRange: 0.23, driftLat: 1.5, driftYawK: 6, driftDrag: 0.8, driftCoast: 3, gripReturn: 0.35,
  gravity: 22,          // heavier than 9.8 on purpose: arcade jumps that come down with authority
}

// ── SPEC SHEETS: a courser described the way a person describes a car. Upgrades change the sheet; the physics is
// solved from it (Alex 11-13: "collect and customize these as well as performance… base 0-60 in 5-6 s like a stock
// average car"). Units are the ones on a sticker: seconds, mph, feet. ──
export interface CourserSpec {
  zeroTo60: number      // s, 0-60 mph on flat ground, full throttle
  topMph: number        // flat-ground top speed
  brake60ft: number     // 60-0 mph stopping distance, feet
  traction: number      // m/s², launch grip (a stock car ~7; slicks more)
  grip: number          // × the base cornering grip (tyres)
  handling: number      // × steering response (the Driver's Rune)
}
export const DARTER_STOCK: CourserSpec = { zeroTo60: 5.5, topMph: 112, brake60ft: 100, traction: 7, grip: 1, handling: 1 }

const MPH = 0.44704, FT = 0.3048
/** Time to 60 mph for a power figure (same sim, same step the game runs). */
function timeTo60(power: number, top: number, traction: number): number {
  const air = power / (top * top * top)
  let v = 0, t = 0
  while (v < 60 * MPH && t < 30) { v += (Math.min(traction, power / Math.max(v, 1)) - air * v * v) / 120; t += 1 / 120 }
  return t
}
/** Solve a tune from a spec sheet: power by bisection to hit the 0-60, air drag so top speed lands exactly. */
export function tuneFromSpec(spec: CourserSpec): CourserTune {
  const top = spec.topMph * MPH
  // ⚠ 0-60 is NOT monotonic in power: drag is set from power (so top speed lands exactly) while traction caps the
  // launch, so past a point more power only adds drag and the car gets SLOWER off the line. A plain bisection over
  // [10, 5000] walked off the wrong side and solved a car that topped out at 30 mph. Find the fastest achievable
  // 0-60 first, then bisect on the low-power side of it (the honest branch: a quicker sticker needs more power).
  let best = 10, bestT = Infinity
  for (let p = 10; p <= 5000; p *= 1.05) { const tt = timeTo60(p, top, spec.traction); if (tt < bestT) { bestT = tt; best = p } }
  let lo = 10, hi = best
  if (spec.zeroTo60 <= bestT) lo = hi = best          // quicker than this traction + top can do: the best it CAN do
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (timeTo60(mid, top, spec.traction) > spec.zeroTo60) lo = mid; else hi = mid }
  const power = (lo + hi) / 2
  const v60 = 60 * MPH
  return {
    ...HANDLING,
    top, power, traction: spec.traction, air: power / (top * top * top),
    brake: (v60 * v60) / (2 * spec.brake60ft * FT),
    latMax: HANDLING.latMax * spec.grip, grip: HANDLING.grip * spec.grip,
    steerRate: HANDLING.steerRate * spec.handling, yawFollow: HANDLING.yawFollow * spec.handling,
  }
}
export const DARTER: CourserTune = tuneFromSpec(DARTER_STOCK)

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
  drift: boolean        // in the drift state
  driftDir: number      // +1 drifting left (yaw increasing), −1 right
  driftT: number        // seconds in this drift
  coastT: number        // seconds off throttle while drifting
  straightT: number     // seconds with the stick centred while drifting
  gripRamp: number      // 0→1 after a drift ends: grip returning
  hbPrev: boolean       // last tick's handbrake, to see a TAP
}

export interface CourserInput {
  throttle: number; steer: number; handbrake: boolean; dt: number
  /** Grip of the surface under the car, 1 = paved. Trails and grass are looser (the page reads it off the map). */
  surface?: number
}

export const WHEEL_R = 0.36

export function createCourser(x: number, z: number, yaw: number, ground: Ground): Courser {
  return { x, y: ground(x, z), z, yaw, vx: 0, vy: 0, vz: 0, yawRate: 0, steer: 0, airborne: false, airT: 0, landed: 0, wheelAngle: 0,
    drift: false, driftDir: 0, driftT: 0, coastT: 0, straightT: 0, gripRamp: 1, hbPrev: false }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

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

export function tickCourser(c: Courser, inp: CourserInput, groundAt: Ground, t: CourserTune = DARTER): void {
  // every probe this tick asks for the surface the car is ON (its height as the hint), so a deck carries it and the
  // water below never pulls it through
  const ground: Ground = (x, z) => groundAt(x, z, c.y)
  const dt = inp.dt
  const throttle = clamp(inp.throttle, -1, 1), steerIn = clamp(inp.steer, -1, 1)
  const surf = clamp(inp.surface ?? 1, 0.3, 1.2)
  const tap = inp.handbrake && !c.hbPrev
  c.hbPrev = inp.handbrake
  c.gripRamp = Math.min(1, c.gripRamp + dt / t.gripReturn)
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
  let vF = c.vx * fx + c.vz * fz, vL = c.vx * rx + c.vz * rz

  // the wheel follows the stick, and turns less the faster you go
  const steerTarget = steerIn * t.maxSteer / (1 + Math.abs(vF) / t.steerFall)
  c.steer += (steerTarget - c.steer) * Math.min(1, dt * t.steerRate)
  c.landed = Math.max(0, c.landed - dt * 30)

  // ── enter the drift: a TAP of the handbrake, fast enough, with a direction held ──
  if (!c.airborne && !c.drift && tap && vF > t.driftMin && Math.abs(steerIn) > 0.3) {
    c.drift = true; c.driftDir = -Math.sign(steerIn); c.driftT = 0; c.coastT = 0; c.straightT = 0
  }
  if (c.drift && c.airborne && c.airT > 0.3) endDrift(c)

  if (!c.airborne && c.drift) {
    // ── THE DRIFT: the PATH curves at a rate the stick sets; the BODY is held at a slip angle to that path ──
    let sp = Math.hypot(c.vx, c.vz)
    let path = Math.atan2(-c.vx, -c.vz)                                  // travel heading, in yaw's convention
    const into = clamp(-steerIn * c.driftDir, -1, 1)                      // +1 steering into the turn, −1 against it
    const angle = t.driftAngle + into * t.driftRange
    const omega = c.driftDir * t.latMax * surf * t.driftLat * (0.75 + 0.35 * into) / Math.max(6, sp)
    path += omega * dt
    // speed: throttle holds it, lifting costs it, braking ends the drift (below)
    const hA = ground(c.x - Math.sin(path), c.z - Math.cos(path)), hB = ground(c.x + Math.sin(path), c.z + Math.cos(path))
    const slopeA = Number.isFinite(hA) && Number.isFinite(hB) ? -t.gravity * ((hA - hB) / 2) * 0.55 : 0
    let a = throttle > 0 ? throttle * Math.min(t.traction, t.power / Math.max(sp, 1)) * 0.85 : -t.driftCoast
    a += slopeA - t.driftDrag - t.air * sp * sp
    sp = Math.max(0, sp + a * dt)
    c.vx = -Math.sin(path) * sp; c.vz = -Math.cos(path) * sp
    // the body: pulled toward path + angle, turning WITH the path (this is the auto-countersteer)
    const err = wrap(path + c.driftDir * angle - c.yaw)
    const wantRate = clamp(err * t.driftYawK + omega, -4, 4)
    c.yawRate += (wantRate - c.yawRate) * Math.min(1, dt * 12)
    c.yaw += c.yawRate * dt
    // the front wheels show the countersteer
    c.steer += (c.driftDir * 0.32 - c.steer) * Math.min(1, dt * t.steerRate)
    // ── leave it: too slow, braking, off throttle a moment, or the stick centred a moment ──
    c.driftT += dt
    c.coastT = throttle > 0 ? 0 : c.coastT + dt
    c.straightT = Math.abs(steerIn) < 0.15 ? c.straightT + dt : 0
    if (sp < 8 || throttle < 0 || c.coastT > 0.4 || c.straightT > 0.3) endDrift(c)
    rideGround(c, dt, ground, t)
  } else if (!c.airborne) {
    // ── engine, brake, reverse ──
    let aF = 0
    if (throttle > 0) aF = vF < -0.5 ? t.brake * throttle : throttle * Math.min(t.traction, t.power / Math.max(vF, 1))
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
    const cap = t.latMax * surf / Math.max(4, Math.abs(vF))
    yawTarget = clamp(yawTarget, -cap, cap)
    if (inp.handbrake) yawTarget *= t.hbYawBoost
    c.yawRate += (yawTarget - c.yawRate) * Math.min(1, dt * (inp.handbrake ? t.yawFollowHb : t.yawFollow))
    c.yaw += c.yawRate * dt

    // ── grip: lateral velocity bleeds away; less of it at high speed so a hard turn becomes a slide ──
    // after a drift the grip comes back over `gripReturn` instead of snapping the tail in
    const grip = (inp.handbrake ? t.gripHb : t.grip) * surf * (0.15 + 0.85 * c.gripRamp) / (1 + Math.max(0, Math.abs(vF) - 22) / 12)
    vL *= Math.exp(-dt * grip)

    // velocity back to the world on the OLD basis; the new yaw re-splits it next step (that IS the drift)
    c.vx = fx * vF + rx * vL
    c.vz = fz * vF + rz * vL
    rideGround(c, dt, ground, t)
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
      // land MOVING WITH THE GROUND: its vertical rate along the travel, not 0. With vy = 0 on a downhill the very
      // next tick read the slope as a lip and launched again: a chain of hops down every hill past ~5% (11-14,
      // found when the autopilot hopped 3 s straight down to the Rune Hold bridge).
      const hA = ground(c.x + c.vx * dt, c.z + c.vz * dt)
      c.y = h; c.vy = Number.isFinite(hA) ? Math.min((hA - h) / dt, t.suspVy) : 0; c.airborne = false
      // a hard landing scrubs a little speed; a clean one barely
      const keep = 1 - Math.min(0.25, c.landed * 0.012)
      c.vx *= keep; c.vz *= keep
    }
  }

  const { fwd } = bodySpeeds(c)
  c.wheelAngle += (fwd / WHEEL_R) * dt
}

function endDrift(c: Courser) { c.drift = false; c.gripRamp = 0; c.driftDir = 0 }

/** Move along the ground: steep faces cost speed, the suspension caps the lift, a lip launches. */
function rideGround(c: Courser, dt: number, ground: Ground, t: CourserTune) {
  const hOld = ground(c.x, c.z)
  // a STEEP face costs speed instead of being climbed (Alex 11-13: off the course into a bump "sends you flying";
  // a 45° face at 30 m/s was a 24 m ramp). Look one step ahead along the travel.
  const step = Math.hypot(c.vx, c.vz) * dt
  if (step > 1e-4) {
    const hAhead = ground(c.x + c.vx * dt, c.z + c.vz * dt)
    const slope = (hAhead - hOld) / step
    if (Number.isFinite(slope) && slope > t.steep) {
      const keep = Math.exp(-dt * t.steepScrub * (slope - t.steep))
      c.vx *= keep; c.vz *= keep
    }
  }
  c.x += c.vx * dt; c.z += c.vz * dt
  const hNew = ground(c.x, c.z)
  // the SUSPENSION: riding the ground can only lift the body so fast; above that the springs take it, so a bump
  // at speed is a jolt, not a launch (it gave the body the ground's full rate: 48 m in the air off a 1.2 m bump)
  const rideVy = Math.min((hNew - hOld) / dt, t.suspVy)
  // the lip: the ground drops away faster than gravity can pull the car down onto it → fly
  if (Number.isFinite(hNew) && rideVy < c.vy - t.gravity * dt - 0.5) {
    c.airborne = true; c.airT = 0
    c.y += c.vy * dt
  } else {
    c.vy = Number.isFinite(rideVy) ? rideVy : 0
    c.y = Number.isFinite(hNew) ? hNew : c.y
  }
}
