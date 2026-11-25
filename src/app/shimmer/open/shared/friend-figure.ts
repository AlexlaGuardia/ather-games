// BONN, OTTO, TESS, GROWN (BETA M154, looks LOCKED by Alex 11-25; CANON characters/{bonn,otto,tess}.md › Look). Pure geometry:
// a figure is a few JOINTS, each MERGED to one vertex-coloured toon mesh + one ink hull (so a whole figure is FRIEND_CALLS draw
// calls, where FolkModel pays two per part, ~36). Same ramp, ink and joints as folk-model.tsx; friend-model.tsx poses it.
// Faces +Z, feet at y 0: the wearer's left is +x. Card notes beat the pictures: pointed ear tips, no earring, Otto fair +
// fingerless gloves + sandy-copper hair, Tess hazel-eyed with her trousers in her boots.
import * as THREE from 'three'
import { EAR } from './keeper-figure'

export type FriendId = 'bonn' | 'otto' | 'tess'
export const FRIEND_IDS: readonly FriendId[] = ['bonn', 'otto', 'tess']
export const isFriend = (id: string): id is FriendId => (FRIEND_IDS as readonly string[]).includes(id)
export type JointName = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'
export interface FriendJoint { at: V3; toon: THREE.BufferGeometry; ink: THREE.BufferGeometry }
export interface FriendFigure {
  joints: Record<JointName, FriendJoint>
  /** drawn unlit: the face's lines (on the head) and the eyes (their own origin, a blink squashes them) */
  face: THREE.BufferGeometry; eyes: THREE.BufferGeometry; eyesAt: V3
  /** bare crown (no hair / hood) and shoulder line, metres */
  crown: number; shoulderW: number
}
/** toon + ink for six joints, the face lines, the eyes */
export const FRIEND_CALLS = 6 * 2 + 2

type V3 = [number, number, number]
const INK_T = 0.011   // the outline's thickness (m), the same on every part (the pictures' thin line)

export const FRIEND_COLOR = {
  bonn: { skin: '#a9653c', hair: '#3b2a20', eye: '#3f9a4c', tunic: '#dba11c', cuff: '#b9ad93', trouser: '#6b4630', boot: '#cf8f1c', leather: '#70401f' },
  otto: { skin: '#ffd2b0', hair: '#c8824a', eye: '#7a4f2c', shirt: '#5f8048', apron: '#a8682c', kerchief: '#c4592c', trouser: '#4b4d5a', boot: '#75432c', leather: '#54321f', glove: '#5d4230' },
  tess: { skin: '#ffdcc2', hair: '#221d1f', eye: '#665631', coat: '#e2c68e', coatIn: '#b09058', scarf: '#a587c2', trouser: '#484c52', boot: '#a8642b', leather: '#8a4726' },
} as const
export const TESS_BLUSH = '#d2917f'   // drawn unlit, so deeper here than it reads
const SOLE = '#3a2a20', METAL = '#b9a888', DARK = '#1c1712'

// ── the mould: collect parts, merge with vertex colours; the ink hull pushes each part's smoothed normals out by INK_T ─────
const SPH = new THREE.SphereGeometry(1, 14, 10)
/** the coils: many, so cheap */
const COIL = new THREE.SphereGeometry(1, 9, 7)
class Mould {
  p: number[] = []; n: number[] = []; c: number[] = []; i: number[] = []; ip: number[] = []; ii: number[] = []
  add(geo: THREE.BufferGeometry, color: string, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], ink = true) {
    const g = geo.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)))
    const P = g.attributes.position, N = g.attributes.normal, col = new THREE.Color(color), b = this.p.length / 3
    const idx = g.index ? [...g.index.array] : [...Array(P.count).keys()]
    for (let k = 0; k < P.count; k++) { this.p.push(P.getX(k), P.getY(k), P.getZ(k)); this.n.push(N.getX(k), N.getY(k), N.getZ(k)); this.c.push(col.r, col.g, col.b) }
    for (const k of idx) this.i.push(b + k)
    if (ink) {   // smoothed across split corners, so a box's hull has no gaps
      const key = (k: number) => `${P.getX(k).toFixed(4)},${P.getY(k).toFixed(4)},${P.getZ(k).toFixed(4)}`, sum = new Map<string, THREE.Vector3>()
      for (let k = 0; k < P.count; k++) { const q = key(k), v = sum.get(q) ?? new THREE.Vector3(); v.add(new THREE.Vector3(N.getX(k), N.getY(k), N.getZ(k))); sum.set(q, v) }
      for (const v of sum.values()) if (v.lengthSq() > 1e-8) v.normalize()
      const ib = this.ip.length / 3
      for (let k = 0; k < P.count; k++) { const v = sum.get(key(k))!; this.ip.push(P.getX(k) + v.x * INK_T, P.getY(k) + v.y * INK_T, P.getZ(k) + v.z * INK_T) }
      for (const k of idx) this.ii.push(ib + k)
    }
    g.dispose()
    return this
  }
  ball(color: string, pos: V3, scale: V3, rot?: V3, ink = true) { return this.add(SPH, color, pos, scale, rot, ink) }
  toon() { return buf(this.p, this.i, this.n, this.c) }
  ink() { return buf(this.ip, this.ii) }
  joint(at: V3): FriendJoint { return { at, toon: this.toon(), ink: this.ink() } }
}
function buf(p: number[], i: number[], n?: number[], c?: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  if (n) g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3))
  if (c) g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
  g.setIndex(i); return g
}
type Prof = readonly (readonly [number, number])[]   // [radius, y], bottom to top
/** a turned shape; a0..a1 = only that arc (0 = the front, +x a quarter round) */
const turn = (prof: Prof, a0 = 0, a1 = Math.PI * 2, seg = 20) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg, a0, a1 - a0)
/** closed both ends */
const tube = (prof: Prof, seg = 14) => turn([[0, prof[0][1]], ...prof, [0, prof[prof.length - 1][1]]], 0, Math.PI * 2, seg)
const radAt = (prof: Prof, y: number) => {
  for (let k = 1; k < prof.length; k++) { const [r0, y0] = prof[k - 1], [r1, y1] = prof[k]; if (y >= y0 && y <= y1) return y1 === y0 ? r1 : r0 + (r1 - r0) * (y - y0) / (y1 - y0) }
  return y < prof[0][1] ? prof[0][0] : prof[prof.length - 1][0]
}
/** a belt / strap: a solid ribbon round a turned body (`zs` its depth). yAt gives its height at each angle; `t` stands proud. */
export function band(prof: Prof, zs: number, yAt: (a: number) => number, w: number, t = 0.014, seg = 36) {
  const p: number[] = [], idx: number[] = []
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, y = yAt(a)
    for (const [dy, out] of [[-w / 2, 0], [w / 2, 0], [w / 2, 1], [-w / 2, 1]] as const) {
      const r = radAt(prof, y + dy) + (out ? t : -0.01); p.push(Math.sin(a) * r, y + dy, Math.cos(a) * (r * zs + (out ? t * (1 - zs) : 0)))
    }
    if (k < seg) for (let e = 0; e < 4; e++) { const A = k * 4 + e, B = k * 4 + (e + 1) % 4, C = A + 4, D = B + 4; idx.push(A, B, C, B, D, C) }
  }
  const g = buf(p, idx); g.computeVertexNormals(); return g
}
/** slung from the left shoulder (+x) to the right hip */
const sling = (lo: number, hi: number) => (a: number) => lo + (hi - lo) * (Math.sin(a) * 0.5 + 0.5)
const BOOTFOOT = (() => {   // a round toe on a flat floor
  const g = new THREE.SphereGeometry(1, 16, 12), P = g.attributes.position
  for (let k = 0; k < P.count; k++) if (P.getY(k) < -0.15) P.setY(k, -0.15)
  g.computeVertexNormals(); return g
})()
const ROUND = (() => {   // a soft box
  const g = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4), P = g.attributes.position, v = new THREE.Vector3()
  for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k); const q = v.clone().clampScalar(-0.72, 0.72); v.sub(q).normalize().multiplyScalar(0.28).add(q); P.setXYZ(k, v.x, v.y, v.z) }
  g.computeVertexNormals(); return g
})()
/** a hair lock: root at the origin, its tip up +y */
const LOCK = new THREE.LatheGeometry([[0, 0], [0.5, 0.05], [0.55, 0.22], [0.45, 0.5], [0.25, 0.78], [0.08, 0.95], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 8)
const CAP = (t: number) => new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, t)

function boot(m: Mould, color: string, y: number, h: number, r: number, foot: V3) {
  m.add(tube([[r * 0.95, y + 0.03], [r, y + h * 0.6], [r * 1.08, y + h]]), color)
  m.add(BOOTFOOT, color, [0, y + 0.034, foot[2] * 0.42], foot, [0, 0, 0])
  m.add(BOOTFOOT, SOLE, [0, y + 0.018, foot[2] * 0.42], [foot[0] * 1.04, 0.02, foot[2] * 1.03], [0, 0, 0], false)
  for (const k of [0, 1, 2]) m.add(ROUND, SOLE, [0, y + 0.075 + k * 0.026, r * 0.98 + (2 - k) * 0.012], [r * 0.42, 0.005, 0.008], [-0.4, 0, 0], false)
}
/** ears: the creator's petal, tip up and back (canon: small, pointed) */
const ears = (m: Mould, skin: string, rx: number, y: number, size = 1) => { for (const s of [-1, 1]) m.add(EAR, skin, [s * rx * 1.04, y, -0.01], [0.05 * size, 0.15 * size, 0.03 * size], [-0.25, 0, s * -0.55]) }
/** the adult head: an egg drawn in to a chin */
function headGeo(jaw: number) {
  const g = new THREE.SphereGeometry(1, 22, 16), P = g.attributes.position
  for (let k = 0; k < P.count; k++) { const y = P.getY(k); if (y < 0) { const f = 1 - jaw * Math.pow(-y, 1.5); P.setX(k, P.getX(k) * f); P.setZ(k, P.getZ(k) * (1 - jaw * 0.45 * -y)) } }
  g.computeVertexNormals(); return g
}
interface Face { rx: number; ry: number; skin: string; hair: string; eye: string; eyeW: number; eyeH: number; brow: number; lash: boolean; mouth: 'grin' | 'smile' | 'small'; nose: number }
/** Returns the flat meshes; the nose goes on the head mould. */
function face(head: Mould, f: Face, jaw: number) {
  const on = new Mould(), eyes = new Mould(), rz = f.rx * 0.98, ez = rz * 0.93, ex = f.rx * 0.4, ey = -f.ry * 0.06
  head.add(headGeo(jaw), f.skin, [0, 0, 0], [f.rx, f.ry, rz])
  head.ball(f.skin, [0, -f.ry * 0.28, rz * 0.97], [0.018 * f.nose, 0.022 * f.nose, 0.024 * f.nose], undefined, false)
  for (const s of [-1, 1]) {
    const tilt = s * 0.3, e = (c: string, dx: number, dy: number, w: number, h: number, dz: number) => eyes.ball(c, [s * ex + dx, dy, ez + dz], [w, h, 0.008], [0, tilt, 0], false)
    if (f.lash) e(DARK, s * 0.003, f.eyeH * 0.16, f.eyeW * 1.14, f.eyeH * 1.0, -0.006)
    e('#fffdf6', 0, 0, f.eyeW, f.eyeH, 0)
    e(f.eye, -s * f.eyeW * 0.06, -f.eyeH * 0.04, f.eyeW * 0.66, f.eyeH * 0.8, 0.0035)
    e(DARK, -s * f.eyeW * 0.06, -f.eyeH * 0.04, f.eyeW * 0.34, f.eyeH * 0.48, 0.006)
    e('#ffffff', f.eyeW * 0.2, f.eyeH * 0.28, f.eyeW * 0.2, f.eyeH * 0.22, 0.0085)
    if (!f.lash) e(f.hair, 0, f.eyeH * 1.02, f.eyeW * 1.0, f.eyeH * 0.14, 0.004)   // a lid line
    on.add(ROUND, f.hair, [s * ex * 1.02, ey + f.eyeH * 1.75, ez - 0.004], [f.eyeW * 1.02, f.brow, 0.008], [0, tilt, s * -0.1], false)
  }
  const my = -f.ry * 0.52, mz = rz * 0.865
  const arc = (r: number, th: number, span: number, y: number) => on.add(new THREE.TorusGeometry(1, th, 5, 16, span), DARK, [0, y, mz + 0.012], [r, r * 0.6, r * 0.5], [0.3, 0, -Math.PI / 2 - span / 2], false)
  if (f.mouth === 'grin') {
    const half = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    on.add(half, DARK, [0, my + 0.014, mz], [f.rx * 0.35, 0.042, 0.02], [0.25, 0, 0], false)
    on.add(half, '#fffaf0', [0, my + 0.011, mz + 0.004], [f.rx * 0.31, 0.033, 0.02], [0.25, 0, 0], false)
  } else if (f.mouth === 'smile') arc(0.04, 0.12, 1.9, my + 0.02)
  else arc(0.028, 0.14, 1.6, my + 0.016)
  return { on, eyes, ey }
}
const hand = (m: Mould, color: string, y: number, r: number, s: number) => { m.ball(color, [0, y, 0.005], [r * 0.82, r * 1.25, r * 0.95]); m.ball(color, [-s * r * 0.4, y + r * 0.3, r * 0.85], [r * 0.34, r * 0.62, r * 0.36], [0.4, 0, 0]) }
function satchel(m: Mould, leather: string, at: V3, s: V3, yaw: number) {
  m.add(ROUND, leather, at, s, [0, yaw, 0.06])
  const fx = Math.sin(yaw), fz = Math.cos(yaw)
  m.add(ROUND, leather, [at[0] + fx * s[2] * 0.75, at[1] + s[1] * 0.42, at[2] + fz * s[2] * 0.75], [s[0] * 1.06, s[1] * 0.58, s[2] * 0.5], [0, yaw, 0.06])
  m.ball(METAL, [at[0] + fx * s[2] * 1.3, at[1] + s[1] * 0.02, at[2] + fz * s[2] * 1.3], [0.012, 0.012, 0.008], undefined, false)
}
const buckle = (m: Mould, y: number, z: number, leather: string, k = 1) => { m.add(ROUND, METAL, [0, y, z], [0.036 * k, 0.03 * k, 0.008]); m.add(ROUND, leather, [0, y, z + 0.006], [0.022 * k, 0.016 * k, 0.007], [0, 0, 0], false) }

// ── Bonn: slight, coily cloud of hair, mustard tunic ─────────────────────────────────────────────────────────────────────
function bonn(): FriendFigure {
  const C = FRIEND_COLOR.bonn, body = new Mould(), head = new Mould(), HY = 1.395, HIP = 0.66, SH = 1.115, zs = 0.68
  const T: Prof = [[0.198, 0.555], [0.186, 0.66], [0.148, 0.79], [0.15, 0.86], [0.168, 0.97], [0.168, 1.05], [0.14, 1.115], [0.07, 1.16], [0.052, 1.175]]
  body.add(tube(T, 22), C.tunic, [0, 0, 0], [1, 1, zs])
  body.add(tube([[0.05, 1.12], [0.046, 1.28]]), C.skin)
  body.add(new THREE.ConeGeometry(1, 1, 3), C.skin, [0, 1.11, 0.097], [0.046, 0.12, 0.014], [Math.PI - 0.42, 0, 0], false)   // the V neck
  body.add(new THREE.ConeGeometry(1, 1, 3), C.trouser, [0, 0.6, 0.126], [0.045, 0.15, 0.012], [-0.14, Math.PI, 0], false)   // the split hem
  body.add(band(T, zs, () => 0.79, 0.05), C.leather); buckle(body, 0.79, 0.117, C.leather)
  body.add(band(T, zs, sling(0.68, 1.12), 0.05, 0.02), C.leather)
  satchel(body, C.leather, [-0.185, 0.665, 0.06], [0.072, 0.082, 0.036], -0.75)
  const leg = () => { const m = new Mould()
    m.add(tube([[0.07, -0.415], [0.09, -0.37], [0.078, -0.2], [0.082, 0.02]]), C.trouser); m.add(tube([[0.07, -0.46], [0.079, -0.445], [0.078, -0.395]]), C.cuff)
    m.add(tube([[0.04, -0.56], [0.042, -0.43]]), C.skin); boot(m, C.boot, -HIP, 0.15, 0.055, [0.064, 0.066, 0.125]); return m }
  const arm = (s: number) => { const m = new Mould()
    m.add(tube([[0.06, -0.27], [0.068, -0.21], [0.055, -0.1], [0.056, -0.02], [0.046, 0.022], [0.022, 0.042]]), C.tunic); m.add(tube([[0.058, -0.315], [0.068, -0.295], [0.066, -0.245]]), C.cuff)
    m.add(tube([[0.028, -0.46], [0.036, -0.3]]), C.skin); hand(m, C.skin, -0.5, 0.044, s); return m }
  const F = face(head, { rx: 0.168, ry: 0.2, skin: C.skin, hair: C.hair, eye: C.eye, eyeW: 0.04, eyeH: 0.047, brow: 0.009, lash: true, mouth: 'grin', nose: 1 }, 0.36)
  ears(head, C.skin, 0.168, -0.03)
  // the hair: two lobes parted at the crown, coils round every edge (the picture's bell: widest at the jaw)
  for (const s of [-1, 1]) {
    head.ball(C.hair, [s * 0.085, 0.115, -0.07], [0.165, 0.165, 0.175])
    head.ball(C.hair, [s * 0.165, -0.01, -0.095], [0.16, 0.195, 0.15])
    for (let k = 0; k < 15; k++) {   // the outline: a bell, crown to nape, in small coils
      const t = k / 14, x = 0.045 + Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) * 0.275 - Math.max(0, t - 0.86) * 0.5, y = 0.24 - t * t * 0.42 - t * 0.01, q = 0.05 + (k * 7 % 3) * 0.008
      head.add(COIL, C.hair, [s * x, y, -0.06 - (k % 2) * 0.05], [q, q, q]); head.add(COIL, C.hair, [s * x * 0.93, y - 0.015, -0.14 + (k % 3) * 0.012], [q * 1.15, q * 1.1, q * 1.1])
    }
    for (let k = 0; k < 5; k++) head.add(COIL, C.hair, [s * (0.026 + k * 0.034), 0.168 - k * k * 0.0062, 0.1 - k * 0.011], [0.04, 0.042, 0.046])   // the parted front
    for (let k = 0; k < 4; k++) head.add(COIL, C.hair, [s * (0.186 + (k % 2) * 0.012), 0.06 - k * 0.058, 0.03 - k * 0.012], [0.046, 0.046, 0.05])   // temples, clear of the face
    for (let k = 0; k < 12; k++) head.add(COIL, C.hair, [s * (0.035 + (k % 3) * 0.085 + (k > 5 ? 0 : 0.03)), -0.15 + Math.floor(k / 3) * 0.095, -0.215 + (k % 3) * 0.018], [0.07, 0.066, 0.05])
  }
  head.ball(C.hair, [0, 0.0, -0.13], [0.2, 0.2, 0.115])
  return done(body, head, arm, leg, F, HY, HIP, SH, 0.172, 0.095, 0.2)
}
// ── Otto: broad, fair, goggles up, a maker's apron ───────────────────────────────────────────────────────────────────────
function otto(): FriendFigure {
  const C = FRIEND_COLOR.otto, body = new Mould(), head = new Mould(), HY = 1.455, HIP = 0.64, SH = 1.165, zs = 0.66
  const T: Prof = [[0.215, 0.6], [0.222, 0.8], [0.252, 0.98], [0.278, 1.08], [0.258, 1.16], [0.16, 1.215], [0.08, 1.24]]
  body.add(tube(T, 24), C.shirt, [0, 0, 0], [1, 1, zs]); body.add(tube([[0.085, 1.16], [0.08, 1.31]]), C.skin)
  const SK: Prof = [[0.262, 0.47], [0.255, 0.56], [0.236, 0.82]]
  body.add(tube(SK, 24), C.apron, [0, 0, 0], [1, 1, zs + 0.04])
  const bib = (h: number, half: number) => { const pr: Prof = [...T.filter(([, y]) => y >= 0.8 && y < h).map(([r, y]) => [r + 0.014, y] as const), [radAt(T, h) + 0.012, h]]; return turn(pr, -half, half, 10) }
  const dbl = (g: THREE.BufferGeometry, c: string, rotY = 0, k = 1) => body.add(g, c, [0, 0, 0], [k, 1, (zs + 0.03) * k], [0, rotY, 0], false)
  dbl(bib(1.1, 0.78), C.apron); dbl(bib(1.08, 0.72), C.apron, Math.PI); dbl(bib(1.108, 0.82), DARK, 0, 0.985); dbl(bib(1.088, 0.76), DARK, Math.PI, 0.985)   // the dark ones = its ink edge
  body.add(ROUND, C.leather, [0, 1.005, 0.186], [0.076, 0.056, 0.006], [0.1, 0, 0], false); body.add(ROUND, C.apron, [0, 1.002, 0.189], [0.07, 0.05, 0.006], [0.1, 0, 0], false)   // the pocket
  for (const s of [-1, 1]) {   // braces, over each shoulder
    const path = new THREE.CatmullRomCurve3([[s * 0.135, 1.06, 0.182], [s * 0.145, 1.15, 0.155], [s * 0.145, 1.21, 0.06], [s * 0.14, 1.215, -0.05], [s * 0.13, 1.15, -0.15], [s * 0.125, 1.04, -0.18]].map(v => new THREE.Vector3(...v as V3)))
    body.add(new THREE.TubeGeometry(path, 14, 0.024, 6), C.leather)
    body.ball(METAL, [s * 0.133, 1.07, 0.2], [0.014, 0.014, 0.01], undefined, false)
  }
  body.add(band(SK, zs + 0.04, () => 0.79, 0.058, 0.016), C.leather); buckle(body, 0.79, 0.186, C.leather, 1.25)
  satchel(body, C.leather, [-0.225, 0.7, 0.1], [0.05, 0.085, 0.034], -0.9)   // the tool pouch, a hammer's haft out of it
  body.add(tube([[0.016, 0], [0.018, 0.2]]), C.leather, [-0.22, 0.74, 0.1], [1, 1, 1], [0.1, 0, -0.5]); body.add(tube([[0.026, 0], [0.026, 0.05]]), C.leather, [-0.14, 0.895, 0.118], [1, 1, 1], [0.1, 0, -0.5])
  body.add(ROUND, C.leather, [0.14, 0.72, 0.165], [0.02, 0.055, 0.01], [0, 0.4, 0]); body.add(tube([[0.016, 0], [0.016, 0.1]]), METAL, [0.232, 0.72, 0.07], [1, 1, 1], [0, 0, -0.1])
  body.add(new THREE.TorusGeometry(1, 0.42, 8, 22), C.kerchief, [0, 1.255, 0.008], [0.108, 0.1, 0.1], [Math.PI / 2 + 0.12, 0, 0])
  body.add(new THREE.ConeGeometry(1, 1, 4), C.kerchief, [0, 1.15, 0.15], [0.125, 0.2, 0.045], [Math.PI - 0.24, 0, 0])
  const leg = () => { const m = new Mould()
    m.add(tube([[0.098, -0.43], [0.122, -0.39], [0.108, -0.2], [0.112, 0.04]]), C.trouser); boot(m, C.boot, -HIP, 0.23, 0.085, [0.095, 0.085, 0.155]); return m }
  const arm = (s: number) => { const m = new Mould()
    m.add(tube([[0.104, -0.23], [0.108, -0.17], [0.105, -0.06], [0.092, 0.005], [0.066, 0.045], [0.03, 0.066]]), C.shirt)
    m.add(tube([[0.056, -0.44], [0.075, -0.34], [0.07, -0.25], [0.08, -0.17]]), C.skin)
    m.add(tube([[0.066, -0.475], [0.076, -0.455], [0.073, -0.395]]), C.glove); hand(m, C.glove, -0.52, 0.064, s)
    for (const k of [-1, 0, 1]) m.ball(C.skin, [0, -0.588, k * 0.026], [0.022, 0.028, 0.016])   // fingerless: the tips
    m.ball(C.skin, [-s * 0.026, -0.535, 0.066], [0.017, 0.024, 0.018]); return m }
  const F = face(head, { rx: 0.172, ry: 0.196, skin: C.skin, hair: '#a5683c', eye: C.eye, eyeW: 0.032, eyeH: 0.036, brow: 0.013, lash: false, mouth: 'grin', nose: 1.35 }, 0.2)
  ears(head, C.skin, 0.172, -0.03, 0.95)
  for (const [x, y] of [[0.03, -0.045], [0.055, -0.055], [0.08, -0.047], [0.045, -0.075], [0.07, -0.078], [0, -0.04]]) for (const s of [-1, 1]) F.on.ball('#c98a5e', [s * x, y, 0.164 - x * x * 3.2], [0.0065, 0.0065, 0.006], undefined, false)
  head.add(CAP(Math.PI * 0.56), C.hair, [0, 0.028, -0.018], [0.184, 0.188, 0.182], [-0.6, 0, 0])
  const lock = (a: number, t: number, len: number, w: number, up: number, side = 0, ink = true) => {   // rooted on the scalp, tipped up and back
    const n = new THREE.Vector3(Math.sin(t) * Math.sin(a), Math.cos(t), Math.sin(t) * Math.cos(a)), dir = n.clone().add(new THREE.Vector3(Math.cos(a) * side, up, -0.12 - Math.sin(a) * side)).normalize()
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
    head.add(LOCK, C.hair, [n.x * 0.16, 0.02 + n.y * 0.175, n.z * 0.16 - 0.015], [w, len, w], [e.x, e.y, e.z], ink)
  }
  for (let k = 0; k < 10; k++) lock(-Math.PI + k * Math.PI / 5 + 0.2, 0.9, 0.11 + (k * 5 % 4) * 0.018, 0.1, 0.75, 0.3)   // tousled: uneven spikes, blown one way
  for (let k = 0; k < 6; k++) lock(k * Math.PI / 3 + 0.5, 0.5, 0.115 + (k * 3 % 4) * 0.02, 0.11, 0.5, 0.5)
  for (let k = 0; k < 3; k++) lock(k * 2.1 + 0.9, 0.16, 0.12, 0.11, 0.2, 0.8)
  for (let k = 0; k < 9; k++) lock(Math.PI - 1.0 + k * 0.25, 1.75, 0.07, 0.07, -2.2, 0, false)   // the nape, close cropped
  // goggles, pushed up
  head.add(band([[0.188, -0.1], [0.188, 0.2]], 0.97, a => 0.085 - 0.02 * Math.cos(a), 0.036, 0.008), C.leather, [0, 0, 0.002])
  for (const s of [-1, 1]) {
    head.add(new THREE.CylinderGeometry(1, 1.06, 1, 16), '#7a5a3a', [s * 0.07, 0.112, 0.163], [0.06, 0.05, 0.06], [Math.PI / 2 - 0.5, 0, -s * 0.3])
    head.add(new THREE.CylinderGeometry(1, 1, 1, 16), '#a9cbd8', [s * 0.076, 0.125, 0.187], [0.047, 0.016, 0.047], [Math.PI / 2 - 0.5, 0, -s * 0.3], false)
    head.ball('#e6f4f8', [s * 0.076 + 0.014, 0.148, 0.188], [0.012, 0.014, 0.008], undefined, false)
  }
  head.add(ROUND, C.leather, [0, 0.112, 0.18], [0.02, 0.012, 0.012])
  return done(body, head, arm, leg, F, HY, HIP, SH, 0.3, 0.128, 0.196)
}
// ── Tess: slight, pale, the long hooded coat ─────────────────────────────────────────────────────────────────────────────
function tess(): FriendFigure {
  const C = FRIEND_COLOR.tess, body = new Mould(), head = new Mould(), HY = 1.375, HIP = 0.6, SH = 1.095, zs = 0.72
  const T: Prof = [[0.232, 0.32], [0.215, 0.5], [0.162, 0.755], [0.158, 0.8], [0.17, 0.95], [0.165, 1.04], [0.135, 1.11], [0.06, 1.16]]
  body.add(tube(T, 22), C.coat, [0, 0, 0], [1, 1, zs]); body.add(tube([[0.046, 1.1], [0.044, 1.26]]), C.skin)
  body.add(ROUND, C.coatIn, [0, 0.53, 0.146], [0.004, 0.2, 0.012], [-0.14, 0, 0], false)   // the front opening
  for (const y of [0.68, 0.58, 0.48, 0.39]) body.ball(C.leather, [0.026, y, radAt(T, y) * zs + 0.002], [0.009, 0.009, 0.006], undefined, false)
  body.add(band(T, zs, () => 0.765, 0.05), C.leather); buckle(body, 0.765, 0.13, C.leather)
  body.add(band(T, zs, sling(0.62, 1.1), 0.05, 0.02), C.leather)
  satchel(body, C.leather, [-0.185, 0.6, 0.115], [0.072, 0.085, 0.034], -0.6)
  body.add(new THREE.TorusGeometry(1, 0.4, 8, 22), C.scarf, [0, 1.175, 0.015], [0.09, 0.088, 0.08], [Math.PI / 2 + 0.1, 0, 0])
  body.add(new THREE.TorusGeometry(1, 0.4, 8, 22), C.scarf, [0, 1.145, 0.03], [0.096, 0.094, 0.07], [Math.PI / 2 + 0.3, 0.1, 0])
  body.add(ROUND, C.scarf, [-0.03, 1.045, 0.142], [0.04, 0.105, 0.014], [0.06, 0, -0.05]); body.add(ROUND, C.scarf, [0.02, 1.07, 0.137], [0.034, 0.075, 0.014], [0.06, 0, 0.12])
  const leg = () => { const m = new Mould()
    m.add(tube([[0.058, -0.43], [0.078, -0.39], [0.074, -0.2], [0.074, 0.02]]), C.trouser); boot(m, C.boot, -HIP, 0.2, 0.06, [0.064, 0.066, 0.122]); return m }   // trousers INTO boots
  const arm = (s: number) => { const m = new Mould()
    m.add(tube([[0.074, -0.37], [0.064, -0.2], [0.055, -0.08], [0.054, -0.02], [0.044, 0.022], [0.022, 0.042]]), C.coat); m.add(tube([[0.074, -0.4], [0.082, -0.385], [0.08, -0.32]]), C.coat)
    hand(m, C.skin, -0.445, 0.042, s); return m }
  const F = face(head, { rx: 0.163, ry: 0.196, skin: C.skin, hair: C.hair, eye: C.eye, eyeW: 0.037, eyeH: 0.042, brow: 0.008, lash: true, mouth: 'small', nose: 0.85 }, 0.34)
  for (const s of [-1, 1]) F.on.ball(TESS_BLUSH, [s * 0.088, -0.07, 0.126], [0.026, 0.014, 0.008], [0, s * 0.6, 0], false)
  ears(head, C.skin, 0.168, -0.045, 0.9)
  // dark hair under the hood: a close cap, a parted fringe, a bob to the jaw behind the ears
  head.add(CAP(Math.PI * 0.5), C.hair, [0, 0.015, -0.012], [0.176, 0.196, 0.176], [-0.22, 0, 0], false)
  for (const [x, z, r, l] of [[-0.02, 0.152, 0.5, 0.11], [0.03, 0.152, -0.35, 0.11], [-0.075, 0.137, 0.35, 0.125], [0.085, 0.133, -0.3, 0.125], [-0.122, 0.1, 0.15, 0.15], [0.128, 0.098, -0.15, 0.15]] as const) head.add(LOCK, C.hair, [x, 0.175 - Math.abs(x) * 0.45, z - 0.028], [0.08, l, 0.05], [Math.PI - 0.22, 0, r * -0.6], false)
  for (const s of [-1, 1]) { head.add(LOCK, C.hair, [s * 0.165, 0.1, 0.03], [0.085, 0.27, 0.11], [Math.PI, 0, s * 0.04]); head.add(LOCK, C.hair, [s * 0.145, 0.06, -0.07], [0.12, 0.22, 0.14], [Math.PI, 0, 0]) }
  // the hood: a thick shell turned round the way she faces, drawn up to a peak and down onto the shoulders
  const hood = (rs: Prof, color: string, ink: boolean) => {
    const g = turn(rs, 0, Math.PI * 2, 30); g.rotateX(Math.PI / 2)   // its axis is now +z (the profile's y)
    const P = g.attributes.position
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k), up = Math.max(0, y), dn = Math.max(0, -y)
      const peak = up > 0.12 ? 1 - Math.min(0.75, (up - 0.12) * 4.2) : 1
      P.setXYZ(k, x * peak * (1 + dn * 0.35), y * (y > 0 ? 1.06 : z < 0.06 ? 1.12 : 1) + Math.max(0, up - 0.16) * 0.35, z - dn * 0.2 + up * 0.06)
    }
    g.computeVertexNormals(); head.add(g, color, [0, 0, -0.04], [1, 1, 1], [0, 0, 0], ink)
  }
  hood([[0, -0.235], [0.1, -0.225], [0.18, -0.175], [0.235, -0.08], [0.25, 0.02], [0.246, 0.09], [0.232, 0.118], [0.218, 0.112]], C.coat, true)
  hood([[0.218, 0.112], [0.222, 0.04], [0.215, -0.06], [0.17, -0.15], [0, -0.2]], C.coatIn, false)
  head.add(new THREE.ConeGeometry(1, 1, 10), C.coat, [0, 0.15, -0.215], [0.06, 0.13, 0.055], [-2.25, 0, 0], false)   // the hood's point, behind
  return done(body, head, arm, leg, F, HY, HIP, SH, 0.168, 0.095, 0.196)
}
function done(body: Mould, head: Mould, arm: (s: number) => Mould, leg: () => Mould, F: { on: Mould; eyes: Mould; ey: number }, HY: number, HIP: number, SH: number, armX: number, legX: number, ry: number): FriendFigure {
  return {
    joints: {
      body: body.joint([0, 0, 0]), head: head.joint([0, HY, 0]),
      armL: arm(-1).joint([-armX, SH, 0]), armR: arm(1).joint([armX, SH, 0]), legL: leg().joint([-legX, HIP, 0]), legR: leg().joint([legX, HIP, 0]),
    },
    face: F.on.toon(), eyes: F.eyes.toon(), eyesAt: [0, F.ey, 0], crown: HY + ry, shoulderW: armX * 2,
  }
}
const BUILD: Record<FriendId, () => FriendFigure> = { bonn, otto, tess }
const made = new Map<FriendId, FriendFigure>()
/** The figure, built once a page. */
export function friendFigure(id: FriendId): FriendFigure { let f = made.get(id); if (!f) { f = BUILD[id](); made.set(id, f) } return f }
