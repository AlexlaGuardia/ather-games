// KEEPER FACES, take 2 (BETA M116, Alex 11-23: "I do like the new eyes and brows" ... "we need OPTIONS for the character
// creation"). The four adult eye + brow sets from the options sheet (docs/looks/keeper-heads-2026-11-23/keeper-heads-options.png,
// proto heads.ts FACES A-D), ported for the live builder. Look.face 0 = Classic (today's head + the Eyes / Brows rows, so an
// old keeper is untouched); 1-4 = a set: the ONE universal head size, the set's chin, almond eyes + brows drawn as decals on
// the head surface. The Mouth row still draws the mouth (mouth options are their own next slice).
// ★ GAME-DISTANCE BOOST: at 5 m the adult eyes are a few px and vanish (sprites-M116 note). Each eye (white, iris, pupil,
//   lids, brow) lives in its own group centred on the eye; the eye white's onBeforeRender reads the camera distance and scales
//   that group 1x at <= BOOST_NEAR m up to BOOST_MAX at >= BOOST_FAR m, about the eye's own centre (so it bolds in place and
//   never drifts across the face). The creator preview (close) is always 1x. One frame of lag; costs a few matrix updates.
import * as THREE from 'three'

/** the universal head (sprites-M116: mean of the six saved sizes, a touch smaller), used by every face set */
export const UNIVERSAL_HEAD = { headW: 0.78, headH: 0.76 } as const
export const BOOST_NEAR = 2.5, BOOST_FAR = 7, BOOST_MAX = 1.6

export interface FaceSet {
  jaw: number; chin: number
  eyeX: number; eyeY: number; eyeW: number; eyeH: number; tilt: number
  lid: number; wing: number; lower: number; iris: number; hi: boolean
  brow: { y: number; w: number; th: number; tilt: number; arch: number }
}
/** index = Look.face - 1 (Soft, Keen, Calm, Strong = sheet A-D, numbers copied from the proto) */
export const FACE_SETS: readonly FaceSet[] = [
  { jaw: 0.35, chin: 0.05, eyeX: 0.165, eyeY: 0.0, eyeW: 0.15, eyeH: 0.085, tilt: 0.06, lid: 0.022, wing: 0.01, lower: 0, iris: 0.95, hi: true,
    brow: { y: 0.16, w: 0.15, th: 0.02, tilt: 0.06, arch: 0.25 } },
  { jaw: 0.6, chin: 0.08, eyeX: 0.165, eyeY: 0.0, eyeW: 0.16, eyeH: 0.068, tilt: 0.17, lid: 0.03, wing: 0.035, lower: 0, iris: 1.05, hi: true,
    brow: { y: 0.12, w: 0.16, th: 0.028, tilt: -0.12, arch: 0 } },
  { jaw: 0.45, chin: 0.06, eyeX: 0.165, eyeY: -0.005, eyeW: 0.145, eyeH: 0.08, tilt: 0.04, lid: 0.04, wing: 0.012, lower: 0.012, iris: 1.0, hi: false,
    brow: { y: 0.17, w: 0.15, th: 0.022, tilt: 0.1, arch: 0.35 } },
  { jaw: 0.75, chin: 0.12, eyeX: 0.155, eyeY: -0.01, eyeW: 0.125, eyeH: 0.06, tilt: 0.05, lid: 0.03, wing: 0.015, lower: 0.01, iris: 1.05, hi: false,
    brow: { y: 0.105, w: 0.17, th: 0.04, tilt: -0.16, arch: 0 } },
]
export const faceSet = (face: number): FaceSet | null => FACE_SETS[face - 1] ?? null

/** the eye-group scale for a camera distance d (m): 1 near, BOOST_MAX far, smooth between */
export function boostAt(d: number) {
  const t = Math.min(1, Math.max(0, (d - BOOST_NEAR) / (BOOST_FAR - BOOST_NEAR)))
  return 1 + (BOOST_MAX - 1) * t * t * (3 - 2 * t)
}

/** the head sphere with the chin taper + `chin` = extra lower-face length (chin 0 = keeper-figure's headGeo exactly) */
const HEADS = new Map<string, THREE.BufferGeometry>()
export function faceHeadGeo(jaw: number, chin: number) {
  const key = `${jaw}|${chin}`
  let g = HEADS.get(key)
  if (!g) {
    g = new THREE.SphereGeometry(1, 20, 14); const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); if (y >= 0) continue
      const t = -y, f = 1 - jaw * 0.42 * Math.pow(t, 1.4)
      pos.setXYZ(i, pos.getX(i) * f, y * (1 + jaw * 0.1 + chin), pos.getZ(i) * (1 - jaw * 0.22 * Math.pow(t, 1.4)))
    }
    g.computeVertexNormals(); HEADS.set(key, g)
  }
  return g
}
/** the head surface at face point (x, y), head-local, for a head of size H (radii 0.5H, 0.55H) */
function surf(H: number, f: FaceSet, x: number, y: number) {
  const rx = H * 0.5, ry = H * 0.55
  let yn = y / ry, fx = 1, fz = 1
  if (yn < 0) { yn = y / (ry * (1 + f.jaw * 0.1 + f.chin)); const t = -yn; fx = 1 - f.jaw * 0.42 * Math.pow(t, 1.4); fz = 1 - f.jaw * 0.22 * Math.pow(t, 1.4) }
  const xn = x / (rx * fx), zn = Math.sqrt(Math.max(0.02, 1 - xn * xn - yn * yn))
  return { z: zn * rx * fz, yaw: Math.atan2(xn, zn) * 0.9, pitch: -Math.atan2(yn, zn) * 0.5 }
}
function almond(w: number, h: number, tilt: number, s: number) {
  const sh = new THREE.Shape(), oy = Math.tan(tilt) * w
  sh.moveTo(0, 0)
  sh.bezierCurveTo(w * 0.2, h * 0.95, w * 0.7, h * 0.95 + oy * 0.6, w, oy)
  sh.bezierCurveTo(w * 0.75, -h * 0.55 + oy * 0.4, w * 0.25, -h * 0.6, 0, 0)
  const g = new THREE.ShapeGeometry(sh, 16); g.translate(-w * 0.5, -oy * 0.5, 0); if (s < 0) g.scale(-1, 1, 1); return g
}
function strip(w: number, th: number, arch: number) {
  const sh = new THREE.Shape(), n = 10, pts: [number, number][] = []
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([(u - 0.5) * w, arch * w * (1 - (2 * u - 1) ** 2) * 0.5]) }
  const tw = (i: number) => th * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.15)))
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y + tw(i) * 0.5) : sh.moveTo(x, y + tw(i) * 0.5)))
  for (let i = n; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1] - tw(i) * 0.5)
  return new THREE.ShapeGeometry(sh)
}
const DISC = new THREE.CircleGeometry(1, 16)
const FLAT2 = new Map<string, THREE.MeshBasicMaterial>()
const flat2 = (c: string) => { let m = FLAT2.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); FLAT2.set(c, m) } return m }
const GEOS = new Map<string, THREE.BufferGeometry>()
const memo = (k: string, make: () => THREE.BufferGeometry) => { let g = GEOS.get(k); if (!g) { g = make(); GEOS.set(k, g) } return g }

const _a = new THREE.Vector3(), _b = new THREE.Vector3()
/** Draw face set `face` (1-4) on a head group whose centre is (0,0,0), head size H. brows false = Brows row 'None'. */
export function drawFaceSet(g: THREE.Group, face: number, H: number, hair: string, brows: boolean) {
  const f = faceSet(face); if (!f) return
  const INKC = '#1c1712', IRIS = '#3b2a1e', LID = '#15100c'
  for (const s of [-1, 1]) {
    const ex = s * H * f.eyeX, ey = H * f.eyeY, w = H * f.eyeW, h = H * f.eyeH, c = surf(H, f, ex, ey)
    // the eye group sits on the surface at the eye centre; every part is placed relative to it, so a scale bolds in place
    const eye = new THREE.Group(); eye.name = s < 0 ? 'eye-r' : 'eye-l'; eye.position.set(ex, ey, c.z); g.add(eye)
    const decal = (geo: THREE.BufferGeometry, color: string, x: number, y: number, dz: number, rotZ = 0, sx = 1, sy = 1) => {
      const p = surf(H, f, x, y), m = new THREE.Mesh(geo, flat2(color))
      m.position.set(x - ex, y - ey, p.z - c.z + H * dz); m.rotation.set(p.pitch, p.yaw, rotZ, 'YXZ'); m.scale.set(sx, sy, 1); eye.add(m)
      return m
    }
    const white = decal(memo(`al${face}${s}${H}`, () => almond(w, h, f.tilt, s)), '#fbf6ee', ex, ey, 0.012)
    white.onBeforeRender = (_r, _s, cam) => {
      const d = cam.getWorldPosition(_a).distanceTo(eye.getWorldPosition(_b)), k = boostAt(d)
      if (Math.abs(eye.scale.x - k) > 0.01) { eye.scale.setScalar(k); eye.updateMatrixWorld(true) }
    }
    const ih = h * f.iris, iw = ih * 0.78, ix = ex - s * w * 0.04, iy = ey - h * 0.05
    decal(DISC, IRIS, ix, iy, 0.02, 0, iw * 0.5, ih * 0.5)
    decal(DISC, '#0d0907', ix, iy, 0.026, 0, iw * 0.24, ih * 0.27)
    if (f.hi) decal(DISC, '#ffffff', ix + s * iw * 0.18, ey + ih * 0.15, 0.032, 0, H * 0.014, H * 0.014)
    decal(memo(`lid${face}${H}`, () => strip(w * 1.06 + H * f.wing, H * f.lid, 0.22)), LID, ex + s * H * f.wing * 0.5, ey + h * 0.45, 0.036, s * f.tilt * 1.2)
    if (f.lower) decal(memo(`low${face}${H}`, () => strip(w * 0.6, H * f.lower, -0.12)), '#5a3a2a', ex + s * w * 0.12, ey - h * 0.42, 0.03, s * f.tilt * 0.5)
    if (brows) {
      const bx = s * H * (f.eyeX + 0.01), by = ey + H * f.brow.y
      decal(memo(`br${face}${H}`, () => strip(H * f.brow.w, H * f.brow.th, f.brow.arch)), hair, bx, by, 0.04, s * f.brow.tilt)
      decal(memo(`bi${face}${H}`, () => strip(H * f.brow.w * 1.06, H * f.brow.th * 1.5, f.brow.arch)), INKC, bx, by, 0.038, s * f.brow.tilt)
    }
  }
}
