// THE FLIT'S POSE AND WHAT A ROUND CAN HIT ON IT (BETA M120 s3c; Alex 11-24: 'Keep, but bigger hit area': shots on the wings
// and tail count too). ★ PURE: no three, no React. ONE pose for both sides: combat.ts steps it, flit-body.ts draws it, so a
// round meets the wing where the wing IS (a beat included). The hit area = the old 0.5 m core sphere + thin capsules on the
// wings, the tail, the legs and the reach. ROUNDS ONLY: casts, splash, touch and steering keep their own sizes.

/** the core sphere, unchanged since M120 s1 */
export const FLIT_HIT_R = 0.5
/** `zip` / `tell` 0..1; `bank` -1..1 = sideways of the move (local +x), `kick` 0..1 = a shot just left; `knock` = a hit */
export interface FlitPose { t: number; zip: number; tell: number; bank: number; kick: number; knock: number }
/** the pose as the sim carries it on a Hollow: + where it was and the shots it had on the last step */
export interface FlitStep extends FlitPose { x: number; z: number; shots: number }
/** the tail's segments from the waist: [radius, half length] */
export const ABD = [[0.075, 0.1], [0.13, 0.11], [0.14, 0.12], [0.11, 0.11], [0.06, 0.13]] as const
/** how far through the wind-up the tell pose is complete (then it HOLDS there until the burst is out) */
export const TELL_FULL = 0.45
export const mix3 = (h: number, z: number, t: number, zip: number, tell: number) => { const g = h + (z - h) * zip; return g + (t - g) * tell }

/** the wing's elevation (radians up from flat) this frame: pair 0 = fore, 1 = hind. Checks + tests read the same number. */
export function wingLift(P: FlitPose, pair: 0 | 1): number {
  const beat = Math.sin(P.t * 58 + pair * 1.9) * 0.85 + 0.15, still = (pair ? -0.16 : 0.2) + Math.sin(P.t * 1.4 + pair) * 0.035
  const up = (pair ? 0.95 : 1.25) + Math.sin(P.t * 2.2) * 0.02
  return mix3(still, beat, up, P.zip, P.tell)
}
export const wingSweep = (P: FlitPose, pair: 0 | 1) => mix3(pair ? 0.6 : 0.12, pair ? 0.5 : 0.1, pair ? 0.55 : 0.2, P.zip, P.tell)
export const WING_L = [0.78, 0.56] as const
export const bodyPitch = (P: FlitPose) => mix3(0.06 + Math.sin(P.t * 0.65) * 0.03, 0.3, -0.22, P.zip, P.tell) - 0.18 * P.kick - 0.5 * P.knock
export const bodyRoll = (P: FlitPose) => -P.bank * 0.5 * P.zip * (1 - P.tell)
/** the tail's first angle (0 = straight back, PI/2 = down, PI = forward) and its bend per segment */
export const tailBase = (P: FlitPose) => mix3(0.35, -0.08, 0.85, P.zip, P.tell) + Math.sin(P.t * 1.3) * 0.03 * (1 - P.tell)
export const tailBend = (P: FlitPose) => mix3(0.17, 0.03 + Math.sin(P.t * 9) * 0.05, 0.56, P.zip, P.tell)

/** what stepFlit reads of a Hollow */
export interface FlitBodyState { id: number; x: number; z: number; yaw: number; state: string; t: number; zx?: number; shots?: number; hitFlash: number; flit?: FlitStep }
/** One step of a Flit's pose, read straight off the sim (a party guest has no zip spot: from how fast the body moves). */
export function stepFlit(h: FlitBodyState, dt: number, clock: number, charge: number): void {
  const P = (h.flit ??= { t: 0, zip: 0, tell: 0, bank: 0, kick: 0, knock: 0, x: NaN, z: NaN, shots: 0 }), e = 1 - Math.exp(-dt * 14)
  const vx = Number.isNaN(P.x) || dt <= 0 ? 0 : (h.x - P.x) / dt, vz = Number.isNaN(P.z) || dt <= 0 ? 0 : (h.z - P.z) / dt, v = Math.hypot(vx, vz)
  P.x = h.x; P.z = h.z
  const zipTo = h.state !== 'chase' ? 0 : h.zx !== undefined ? 1 : Math.max(0, Math.min(1, (v - 3.5) / 3))
  P.zip += (zipTo - P.zip) * e
  const side = v > 0.2 ? (vx * Math.cos(h.yaw) - vz * Math.sin(h.yaw)) / v : 0   // the move along the body's own +x
  P.bank += (side - P.bank) * e
  const raw = h.state === 'charge' ? Math.max(0, Math.min(1, (1 - h.t / charge) / TELL_FULL)) : 0, tellTo = raw * raw * (3 - 2 * raw)
  P.tell += (tellTo - P.tell) * (tellTo > P.tell ? 1 : e)   // held through the burst; the let-go eases
  if ((h.shots ?? 0) < P.shots) P.kick = 1
  P.shots = h.shots ?? 0; P.kick *= Math.exp(-dt * 12)
  P.knock = Math.min(1, h.hitFlash * 8); P.t = clock + h.id * 1.3
}

/** capsules: 4 wings, 2 of tail, 4 legs, 2 reach. Each = ax ay az bx by bz r, in the BODY frame (before pitch / roll / yaw). */
export const FLIT_PARTS = 12
/** no part reaches further than this from the middle (the broad phase) */
export const FLIT_REACH = 1.4
const R_WING = 0.13, R_TAIL = 0.13, R_LEG = 0.07, R_REACH = 0.08
const parts = new Float64Array(FLIT_PARTS * 7)
export function flitParts(P: FlitPose): Float64Array {
  const { zip, tell } = P
  let n = 0
  const put = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) => { parts[n++] = ax; parts[n++] = ay; parts[n++] = az; parts[n++] = bx; parts[n++] = by; parts[n++] = bz; parts[n++] = r }
  // the wings: root to (nearly) tip, so the round end sits on the drawn tip
  for (let pair = 0 as 0 | 1; ; pair = 1) {
    const li = wingLift(P, pair), sw = wingSweep(P, pair), L = WING_L[pair] - R_WING * 0.5, dx = Math.cos(li) * Math.cos(sw), dy = Math.sin(li), dz = -Math.cos(li) * Math.sin(sw), z = 0.05 - pair * 0.13
    for (let sx = -1; sx <= 1; sx += 2) put(sx * 0.1, 0.13, z, sx * (0.1 + dx * L), 0.13 + dy * L, z + dz * L, R_WING)
    if (pair) break
  }
  // the tail: waist to the third segment's end, then to the (nearly) tip
  let th = tailBase(P), y = -0.02, z = -0.14, y0 = y, z0 = z
  const bend = tailBend(P)
  for (let k = 0; k < ABD.length; k++) {
    const st = ABD[k][1] * 1.6; y -= Math.sin(th) * st; z -= Math.cos(th) * st; th += bend
    if (k === 2 || k === 4) { put(0, y0, z0, 0, y, z, k === 2 ? R_TAIL : R_TAIL * 0.85); y0 = y; z0 = z }
  }
  for (let sx = -1; sx <= 1; sx += 2) {
    // the legs below the knee (above it they are inside the core)
    for (let hind = 0; hind < 2; hind++) {
      const lz = 0.04 - hind * 0.14
      put(sx * mix3(0.34, 0.26, 0.2, zip, tell), mix3(-0.02, -0.1, -0.14, zip, tell), lz + mix3(0.05 - hind * 0.12, -0.16, 0.02, zip, tell),
        sx * mix3(0.36, 0.22, 0.1, zip, tell), mix3(-0.4, -0.18, -0.3, zip, tell), lz + mix3(0.02 - hind * 0.2, -0.5, 0.04, zip, tell), R_LEG)
    }
    put(sx * mix3(0.2, 0.17, 0.13, zip, tell), mix3(0, -0.1, -0.03, zip, tell), mix3(0.34, 0.3, 0.42, zip, tell),
      sx * mix3(0.13, 0.12, 0.07, zip, tell), mix3(-0.26, -0.2, 0, zip, tell), mix3(0.44, 0.16, 0.72, zip, tell), R_REACH)
  }
  return parts
}

const REST: FlitPose = { t: 0, zip: 0, tell: 0, bank: 0, kick: 0, knock: 0 }
/** Does the segment (a round's step) touch the Flit: its core, a wing, the tail, a leg? Cheap: two sphere tests first. */
export function flitHit(h: { x: number; y: number; z: number; yaw: number; flit?: FlitPose }, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const d2 = pointSeg2(h.x, h.y, h.z, ax, ay, az, bx, by, bz)
  if (d2 < FLIT_HIT_R * FLIT_HIT_R) return true
  if (d2 > FLIT_REACH * FLIT_REACH) return false
  // the round into the body's frame: undo yaw, the offset, the pitch, the roll (poseFlit: T * Rx(pitch) * Rz(roll))
  const P = h.flit ?? REST, cy = Math.cos(h.yaw), sy = Math.sin(h.yaw), pt = bodyPitch(P), cp = Math.cos(pt), sp = Math.sin(pt), rl = bodyRoll(P), cr = Math.cos(rl), sr = Math.sin(rl)
  const oy = 0.05 * P.tell, oz = -0.12 * P.kick - 0.25 * P.knock
  const lx = (x: number, z: number) => x * cy - z * sy, lz = (x: number, z: number) => x * sy + z * cy
  const A0 = lx(ax - h.x, az - h.z), A1 = ay - h.y - oy, A2 = lz(ax - h.x, az - h.z) - oz, B0 = lx(bx - h.x, bz - h.z), B1 = by - h.y - oy, B2 = lz(bx - h.x, bz - h.z) - oz
  const a1 = A1 * cp + A2 * sp, a2 = -A1 * sp + A2 * cp, b1 = B1 * cp + B2 * sp, b2 = -B1 * sp + B2 * cp
  const ux = A0 * cr + a1 * sr, uy = -A0 * sr + a1 * cr, vx = B0 * cr + b1 * sr, vy = -B0 * sr + b1 * cr
  const q = flitParts(P)
  for (let i = 0; i < q.length; i += 7) if (segSeg2(ux, uy, a2, vx, vy, b2, q[i], q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5]) < q[i + 6] * q[i + 6]) return true
  return false
}

const c01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v
function pointSeg2(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz, t = l2 > 0 ? c01(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2) : 0
  const x = ax + dx * t - px, y = ay + dy * t - py, z = az + dz * t - pz
  return x * x + y * y + z * z
}
/** squared distance between two segments (p..q) and (a..b); Ericson, Real-Time Collision Detection 5.1.9 */
export function segSeg2(px: number, py: number, pz: number, qx: number, qy: number, qz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const d1x = qx - px, d1y = qy - py, d1z = qz - pz, d2x = bx - ax, d2y = by - ay, d2z = bz - az, rx = px - ax, ry = py - ay, rz = pz - az
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz
  if (a < 1e-12) return pointSeg2(px, py, pz, ax, ay, az, bx, by, bz)
  if (e < 1e-12) return pointSeg2(ax, ay, az, px, py, pz, qx, qy, qz)
  const c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b
  let s = den > 1e-12 ? c01((b * f - c * e) / den) : 0, t = (b * s + f) / e
  if (t < 0) { t = 0; s = c01(-c / a) } else if (t > 1) { t = 1; s = c01((b - c) / a) }
  const x = rx + d1x * s - d2x * t, y = ry + d1y * s - d2y * t, z = rz + d1z * s - d2z * t
  return x * x + y * y + z * z
}
