// THE FLOATER'S BODY (BETA M120 s3; player-facing name Flit, hollow-names.ts). Pure three, no React.
// CANON design-briefs/hollows.md + CANON_GAPS (05f3d0d: "the floater as an insect silhouette: YES... never a face you could
// love"): the same ONE grey goop on a nucleus (the thorax = the seed, the densest point), a segmented tail of a body that thins
// away from it, thin hanging legs, four wing smears, and the caster's law kept: the RIGHT reach is its only dense limb. No face,
// no eyes, no colour, no emissive: the surface is hollow-goop.ts's, shared. LOOK ONLY: what a round can hit (the 0.5 m
// core + capsules on wings, tail, legs) and the pose itself live in flit-pose.ts; flit-body.test.ts holds the two together.
// Three poses blended here: ZIP (wings beat wide, the tail streams back, it banks into the move), HOLD (wings out flat and
// still, the tail hanging, legs dangling), TELL (wings snap up together, the tail curls under to point at the keeper, the reach
// straightens). Every part is one instance of one low lumpy sphere: one draw per Hollow, as before.
import * as THREE from 'three'
import { lumpyShape } from './hollow-body'
import { ABD, WING_L, bodyPitch, bodyRoll, mix3, tailBase, tailBend, wingLift, wingSweep, type FlitPose } from './flit-pose'   // M120 s3c: the pose + the hit area are the sim's
export { FLIT_HIT_R, TELL_FULL, wingLift, type FlitPose } from './flit-pose'

/** the lumps in the order poseFlit writes them */
export const FLIT = { head: 1, abd: 2, abdN: 5, legs: 7, legN: 8, armR: 15, armL: 18, feel: 20, wings: 22, count: 26 } as const

const V = () => new THREE.Vector3()
const _m = new THREE.Matrix4(), _body = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = V(), _s = V()
const _a = V(), _b = V(), _d = V(), _n = V(), _c = V(), _mid = V(), UP = new THREE.Vector3(0, 1, 0)

/** write every lump's matrix (local to the Hollow's group: +z is the way it faces) into `out`. Allocation-free. */
export function poseFlit(P: FlitPose, out: THREE.Matrix4[]): void {
  const ph = P.t * 1.3, zip = P.zip, tell = P.tell
  _body.compose(_p.set(0, 0.05 * tell, -0.12 * P.kick - 0.25 * P.knock), _q.setFromEuler(_e.set(bodyPitch(P), 0, bodyRoll(P))), _s.setScalar(1 + Math.sin(ph) * 0.02))
  let i = 0
  const wob = () => Math.sin(P.t * 2.2 + i * 1.7) * 0.06   // each lump on its own clock: the body never holds a crisp shape
  const ball = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) => {
    const w = wob(); out[i++].compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, rz)), _s.set(sx * (1 + w), sy * (1 - w * 0.8), sz * (1 + w))).premultiply(_body)
  }
  const bar = (r: number) => {   // _a .. _b
    const w = wob(); _d.subVectors(_b, _a); const L = _d.length() || 1e-6; _d.divideScalar(L)
    out[i++].compose(_mid.addVectors(_a, _b).multiplyScalar(0.5), _q.setFromUnitVectors(UP, _d), _s.set(r * (1 + w), L * 0.56, r * (1 + w))).premultiply(_body)
  }
  // the nucleus (gathers in on the tell), and the head: a low lump that only tilts
  const g = 1 - 0.1 * tell
  ball(0, 0, 0, 0.19 * g, 0.18 * (1 + 0.1 * tell), 0.22 * g)
  ball(0, 0.03 - 0.03 * tell, 0.29, 0.115, 0.1, 0.13, Math.sin(ph * 0.3) * 0.1 + 0.25 * tell, Math.sin(ph * 0.4) * 0.2)
  // the segmented tail: a chain from the waist; 0 = straight back, PI/2 = straight down, PI = forward
  let th = tailBase(P), y = -0.02, z = -0.14
  const bend = tailBend(P)
  for (const [r, l] of ABD) {
    const dy = -Math.sin(th), dz = -Math.cos(th), st = l * 0.8
    ball(0, y + dy * st, z + dz * st, r, r * 0.94, l * 1.15, -th); y += dy * st * 2; z += dz * st * 2; th += bend
  }
  // four thin hanging legs (mid, hind), knee out and foot down; streaming back in a zip, drawn in for the tell
  for (const sx of [-1, 1]) for (const hind of [0, 1]) {
    const z0 = 0.04 - hind * 0.14, sway = Math.sin(P.t * 1.7 + hind + sx) * 0.02
    _a.set(sx * 0.11, -0.08, z0)
    _b.set(sx * mix3(0.34, 0.26, 0.2, zip, tell), mix3(-0.02, -0.1, -0.14, zip, tell), z0 + mix3(0.05 - hind * 0.12, -0.16, 0.02, zip, tell)); bar(0.03)
    _a.copy(_b)
    _b.set(sx * mix3(0.36, 0.22, 0.1, zip, tell) + sway, mix3(-0.4, -0.18, -0.3, zip, tell), z0 + mix3(0.02 - hind * 0.2, -0.5, 0.04, zip, tell) + sway); bar(0.022)
  }
  // the reach: the caster's one dense limb (right), held folded, straight at the keeper on the tell; the left barely there
  for (const [sx, r] of [[1, 0.055], [-1, 0.024]] as const) {
    _a.set(sx * 0.1, -0.06, 0.16); _b.set(sx * mix3(0.2, 0.17, 0.13, zip, tell), mix3(0.0, -0.1, -0.03, zip, tell), mix3(0.34, 0.3, 0.42, zip, tell)); bar(r)
    _a.copy(_b); _b.set(sx * mix3(0.13, 0.12, 0.07, zip, tell), mix3(-0.26, -0.2, 0.0, zip, tell), mix3(0.44, 0.16, 0.72, zip, tell)); bar(r * 0.85)
    if (sx > 0) ball(_b.x, _b.y, _b.z, 0.075 * (1 + 0.35 * tell), 0.075 * (1 + 0.35 * tell), 0.085)
  }
  for (const sx of [-1, 1]) { _a.set(sx * 0.04, 0.09, 0.36); _b.set(sx * mix3(0.16, 0.12, 0.2, zip, tell), mix3(0.27, 0.2, 0.36, zip, tell), mix3(0.6, 0.3, 0.46, zip, tell)); bar(0.016) }
  // four wing smears: long flat lumps off the top of the nucleus
  for (const pair of [0, 1] as const) for (const sx of [-1, 1]) {
    const lift = wingLift(P, pair), sweep = wingSweep(P, pair), L = WING_L[pair], chord = pair ? 0.12 : 0.15
    _d.set(sx * Math.cos(lift) * Math.cos(sweep), Math.sin(lift), -Math.cos(lift) * Math.sin(sweep)).normalize()
    _c.set(0, 0, -1).addScaledVector(_d, _d.z).normalize(); _n.crossVectors(_c, _d).normalize()
    _m.makeBasis(_d, _n, _c); _q.setFromRotationMatrix(_m); const w = wob()
    _p.set(sx * 0.1, 0.13, 0.05 - pair * 0.13).addScaledVector(_d, L * 0.5)
    out[i++].compose(_p, _q, _s.set(L * 0.5, 0.014, chord * (1 + w))).premultiply(_body)
  }
}
export const flitMats = () => Array.from({ length: FLIT.count }, () => new THREE.Matrix4())

/** one low lumpy sphere shared by every part of every Flit (90 triangles; the walkers' is 352). Cached. */
let GEO: THREE.BufferGeometry | null = null
export const flitGeometry = (): THREE.BufferGeometry => (GEO ??= lumpyShape(9, 6))
export const geoTris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3
