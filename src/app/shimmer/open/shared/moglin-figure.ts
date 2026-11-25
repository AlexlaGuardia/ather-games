// THE GLADE'S NAMED MOGLINS (BETA M162; looks LOCKED by Alex 11-25, CANON characters/moonwell-folk.md › Look in the game). Pure
// geometry on the chibi Moglin's joints (moglin-model.tsx), the friends' way (friend-figure.ts): each joint MERGED to one vertex-
// coloured toon mesh + one ink hull. The card beats the pictures: no metal (cord + wooden toggles), no tail, never grey.
// A look = colours + `dress` (its clothes, on the body) + what it carries. Faces +Z, feet at y 0, the wearer's left is +x.
import * as THREE from 'three'
import { Mould, buf, turn, tube, band, radAt, BOOTFOOT, ROUND, type Prof, type V3, type FriendJoint } from './friend-figure'
import type { MoglinAction } from './moglin-model'

export type MoglinLook = 'hazel' | 'sax' | 'yarrow'
export const MOGLIN_LOOKS: readonly MoglinLook[] = ['hazel', 'sax', 'yarrow']
/** the Glade's folk ids are `moonwell:<name>` (moonwell-glade.ts); nobody else has a look of their own */
export const moglinLook = (id: string): MoglinLook | null => MOGLIN_LOOKS.find(k => id === `moonwell:${k}`) ?? null

export type MoglinJoint = 'body' | 'head' | 'earL' | 'earR' | 'armL' | 'armR' | 'legL' | 'legR'
export interface MoglinFigure {
  joints: Record<MoglinJoint, FriendJoint>
  face: THREE.BufferGeometry; eyes: THREE.BufferGeometry; eyesAt: V3
  /** both paws stay on what it carries */
  holds: { pitch: number; roll: number } | null
  /** 1 = the free leg swing; less under a skirt */
  stride: number
}
/** toon + ink for eight joints, the face lines, the eyes (the plain chibi: 48 meshes) */
export const MOGLIN_LOOK_CALLS = 8 * 2 + 2

type Pose = { roll: number; bob: number; headPitch: number; headRoll: number; earDroop: number; aL: [number, number]; aR: [number, number]; lL: number; lR: number }
/** carrying, the paws stay on the load (a wave frees the waving one); else the pose as it is */
export function holdPose(p: Pose, h: MoglinFigure['holds'], action: MoglinAction): Pose {
  if (!h) return p
  return { ...p, aL: [h.pitch, -h.roll], aR: action === 'wave' ? p.aR : [h.pitch, h.roll] }
}

export const LOOK_COLOR = {
  hazel: { fur: '#b57230', light: '#fff0d2', eye: '#6b3f1c', cloth: '#a98552', clothDark: '#7d5f38', belt: '#5c3820', cord: '#a8855c', toggle: '#7a5230', plank: '#d9ab66', plankEdge: '#a97a3e' },
  sax: { fur: '#cf8a48', light: '#fbf0da', eye: '#7a4a20', cloth: '#a85f30', clothDark: '#7a3a1b', belt: '#4a3528', toggle: '#4f3322', stone: '#fff6e6' },
  yarrow: { fur: '#ffce8c', light: '#fff0d0', eye: '#4a2e1c', cloth: '#84632f', clothDark: '#5f4520', cord: '#96713f', jar: '#c4703a', cork: '#f3d8a6' },
} as const
const INK = '#1c1712', NOSE = '#dd7a68', EAR_IN = '#de8474', EAR_DARK = '#4a2a1e', BLUSH = '#ec8a5e'
const T = 0.0075   // the ink line
/** fur comes in many locks, so a cheap one */
const LOCK = turn([[0, 0], [0.5, 0.12], [0.4, 0.5], [0, 1]], 0, Math.PI * 2, 5)

// ── the head: one surface S(yaw, lat) the mask, eyes, nose and mouth are laid on ────────────────────────────────────────────
const RX = 0.285, RY = 0.222, RZ = 0.225, HC = 0.228
function S(a: number, b: number, lift = 0): V3 {
  const c = Math.pow(Math.max(0, Math.cos(b)), 0.78), s = Math.sin(b)
  const jowl = 1.0 + 0.1 * Math.exp(-(((b + 0.4) / 0.42) ** 2)) - 0.13 * Math.max(0, s)
  const snout = 0.06 * Math.exp(-((a / 0.4) ** 2) - ((b + 0.3) / 0.3) ** 2)
  const n = new THREE.Vector3(c * Math.sin(a) / RX, s / RY, c * Math.cos(a) / RZ).normalize().multiplyScalar(lift)
  return [RX * jowl * c * Math.sin(a) + n.x, HC + RY * s + n.y, RZ * c * Math.cos(a) + snout + n.z]
}
function headGeo() {
  const U = 36, V = 20, p: number[] = [], i: number[] = []
  for (let v = 0; v <= V; v++) for (let u = 0; u < U; u++) p.push(...S(u / U * Math.PI * 2, (v / V - 0.5) * Math.PI))
  for (let v = 0; v < V; v++) for (let u = 0; u < U; u++) { const A = v * U + u, B = v * U + (u + 1) % U, C = A + U, D = B + U; i.push(A, B, C, B, D, C) }
  const g = buf(p, i); g.computeVertexNormals(); return g
}
/** a shape laid on the face: centre (yaw, lat), its reach at each angle */
function patch(a0: number, b0: number, da: number, db: number, lift: number, edge: (th: number) => number = () => 1, seg = 26) {
  const p: number[] = [...S(a0, b0, lift)], i: number[] = [], R = 4
  for (let r = 1; r <= R; r++) for (let k = 0; k < seg; k++) { const th = k / seg * Math.PI * 2, q = r / R * edge(th); p.push(...S(a0 + Math.cos(th) * da * q, b0 + Math.sin(th) * db * q, lift)) }
  for (let k = 0; k < seg; k++) { const n = (k + 1) % seg; i.push(0, 1 + k, 1 + n); for (let r = 0; r < R - 1; r++) { const A = 1 + r * seg + k, B = 1 + r * seg + n; i.push(A, A + seg, B, B, A + seg, B + seg) } }
  const g = buf(p, i); g.computeVertexNormals(); return g
}
/** the pale lower face: from the bridge under the eyes, out across the cheeks, down under the chin */
function maskGeo() {
  const U = 60, V = 7, p: number[] = [], i: number[] = []
  const top = (a: number) => { const q = Math.abs(a); return (q < 0.32 ? -0.1 - q * 0.22 : q < 0.95 ? -0.17 - (q - 0.32) * 0.22 : q < 1.45 ? -0.309 + (q - 0.95) * 0.36 : -0.129 - (q - 1.45) * 0.9) }
  for (let u = 0; u <= U; u++) { const a = (u / U - 0.5) * 3.9, t = top(a) + (u % 2 ? 0.022 : -0.022); for (let v = 0; v <= V; v++) p.push(...S(a, -1.5 + (Math.max(-1.45, t) + 1.5) * v / V, 0.004)) }
  for (let u = 0; u < U; u++) for (let v = 0; v < V; v++) { const A = u * (V + 1) + v, B = A + V + 1; i.push(A, B, A + 1, B, B + 1, A + 1) }
  const g = buf(p, i); g.computeVertexNormals(); return g
}
const line = (pts: readonly (readonly [number, number])[], r: number, lift = 0.005, seg = 14) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(...S(a, b, lift)))), seg, r, 5)
/** a lock of fur: root at `at`, its tip along `dir` */
function lock(m: Mould, color: string, at: V3, dir: V3, len: number, w: number, ink = true) {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()))
  m.add(LOCK, color, at, [w, len, w * 0.6], [e.x, e.y, e.z], ink)
}
function headParts(C: { fur: string; light: string; eye: string }) {
  const head = new Mould(T), on = new Mould(), eyes = new Mould(), EB = 0.03
  head.add(headGeo(), C.fur).add(maskGeo(), C.light, undefined, undefined, undefined, false)
  for (const s of [-1, 1]) {
    head.add(patch(s * 0.47, EB + 0.1, 0.3, 0.4, 0.003, th => 1 - 0.06 * Math.cos(th * 2)), C.light, undefined, undefined, undefined, false)
    on.add(patch(s * 0.7, -0.25, 0.21, 0.115, 0.009), BLUSH, undefined, undefined, undefined, false)
    const e = (c: string, da: number, db: number, lift: number, a = 0, b = 0) => eyes.add(patch(s * 0.47 + a, EB + b, da, db, lift, undefined, 20), c, undefined, undefined, undefined, false)
    e(INK, 0.222, 0.262, 0.006); e('#fff8ea', 0.2, 0.238, 0.0075); e(C.eye, 0.178, 0.226, 0.009, -s * 0.012); e(INK, 0.142, 0.182, 0.0105, -s * 0.012, 0.02); e('#ffffff', 0.05, 0.064, 0.012, 0.045, 0.1)
    eyes.add(line([[s * 0.6, EB + 0.19], [s * 0.7, EB + 0.16], [s * 0.78, EB + 0.2]], 0.005), INK, undefined, undefined, undefined, false)   // a lash
    on.add(line([[s * 0.36, 0.62], [s * 0.44, 0.66], [s * 0.52, 0.62]], 0.0035), INK, undefined, undefined, undefined, false)
    // the smile's halves, the whiskers
    on.add(line([[0, -0.36], [s * 0.1, -0.43], [s * 0.24, -0.42], [s * 0.34, -0.33]], 0.0055), INK, undefined, undefined, undefined, false)
    for (const [k, b, dy] of [[0, -0.24, 0.02], [1, -0.32, -0.03], [2, -0.4, -0.085]] as const) {
      const p = new THREE.Vector3(...S(s * 0.5, b, 0.004)), q = p.clone().add(new THREE.Vector3(s * 0.13, 0.012 + dy * 0.4, 0.03)), w = p.clone().add(new THREE.Vector3(s * (0.23 - k * 0.02), dy - 0.012, 0.015))
      on.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p, q, w), 8, 0.0028, 4), INK, undefined, undefined, undefined, false)
    }
    // cheek fur, jowl to chin
    for (const [a, b, len] of [[1.5, -0.18, 0.075], [1.72, -0.42, 0.085], [1.45, -0.55, 0.07], [1.7, -0.75, 0.07], [1.4, -0.9, 0.055]] as const) lock(head, a > 1.6 || b > -0.3 ? C.fur : C.light, S(s * a, b, -0.03), [s, -0.75 + b * 0.5, -0.25], len, 0.07)
    for (const [a, b] of [[2.05, -0.3], [2.1, -0.6], [2.5, -0.55]] as const) lock(head, C.fur, S(s * a, b, -0.03), [s * 0.8, -0.8, -0.7], 0.075, 0.07)
  }
  on.add(line([[0, -0.24], [0, -0.36]], 0.0045), INK, undefined, undefined, undefined, false)
  const N = S(0, -0.17)
  head.add(new THREE.SphereGeometry(1, 12, 9), NOSE, [0, N[1], N[2] - 0.004], [0.048, 0.024, 0.026]); head.add(new THREE.ConeGeometry(1, 1, 10), NOSE, [0, N[1] - 0.022, N[2] + 0.002], [0.04, 0.05, 0.022], [Math.PI, 0, 0], false)
  on.ball('#f6c0b2', [0, N[1] + 0.011, N[2] + 0.015], [0.016, 0.006, 0.005], undefined, false)
  // the crown tuft
  for (let k = -3; k <= 3; k++) lock(head, C.fur, [k * 0.028, HC + RY - 0.022 - k * k * 0.003, 0.02 - (k % 2) * 0.02], [k * 0.3, 1, 0.12], 0.085 - Math.abs(k) * 0.009, 0.05)
  return { head, on, eyes, ey: S(0.47, EB)[1] }
}
/** an ear: a broad leaf, its tip up +y (the joint turns it out); pink inside, dark in its inner fold, fur on its top edge */
function ear(C: { fur: string }, s: number) {
  const m = new Mould(T), L = 0.37
  const W: Prof = [[0, -0.02], [0.085, 0.0], [0.118, 0.09], [0.112, 0.16], [0.085, 0.235], [0.045, 0.31], [0.012, 0.36], [0, L]]
  m.add(turn(W, 0, Math.PI * 2, 18), C.fur, [0, 0, -0.01], [1, 1, 0.3], [0, 0, 0])
  const inn = (c: string, dx: number, k: number, z: number, h: number) => m.add(turn(W.map(([r, y]) => [r * k, y * h + 0.035] as const), 0, Math.PI * 2, 16), c, [s * dx, 0, z], [1, 1, 0.22], [0, 0, 0], false)
  inn(EAR_DARK, 0.006, 0.8, 0.008, 0.8); inn(EAR_IN, 0.026, 0.66, 0.0145, 0.82)
  for (let k = 0; k < 4; k++) lock(m, C.fur, [-s * (0.106 - k * 0.022), 0.07 + k * 0.062, -0.008], [-s * 0.3, 1, 0], 0.085 - k * 0.008, 0.032)
  for (let k = 0; k < 2; k++) lock(m, C.fur, [s * (0.104 - k * 0.04), 0.1 + k * 0.1, -0.008], [s * 0.35, 1, 0], 0.07, 0.03)
  for (let k = 0; k < 3; k++) lock(m, C.fur, [-s * (0.06 - k * 0.012), 0.03 + k * 0.045, 0.018], [s * 0.6, 0.8, 0.12], 0.07, 0.03, false)   // the tuft in the fold
  return m
}
/** turned a little outward, so it reads from the side too */
const open = (J: FriendJoint, s: number): FriendJoint => { J.toon.rotateY(s * 0.5); J.ink.rotateY(s * 0.5); return J }

// ── the body every look shares: `wide` its girth (the cloth follows it) ─────────────────────────────────────────────────────
const ZS = 0.9
const TORSO: Prof = [[0.06, 0.09], [0.13, 0.115], [0.163, 0.18], [0.163, 0.25], [0.146, 0.32], [0.118, 0.375], [0.085, 0.41], [0.07, 0.44]]
const grow = (p: Prof, k: number, d = 0): Prof => p.map(([r, y]) => [r * k + d, y])
/** the torso's slice y0..y1, `d` proud of the fur */
function slice(P: Prof, y0: number, y1: number, d: number): Prof { return [[radAt(P, y0) + d, y0], ...P.filter(([, y]) => y > y0 && y < y1).map(([r, y]) => [r + d, y] as const), [radAt(P, y1) + d, y1]] }
const at = (P: Prof, a: number, y: number, d = 0): V3 => { const r = radAt(P, y) + d; return [Math.sin(a) * r, y, Math.cos(a) * r * ZS] }
/** a cloth shell, thick enough to see from inside */
function cloth(m: Mould, pr: Prof, color: string, a0 = 0, a1 = Math.PI * 2) {
  const loop: Prof = [...pr, ...[...pr].reverse().map(([r, y]) => [r - 0.012, y] as const), pr[0]]
  m.add(turn(loop, a0, a1, 30), color, [0, 0, 0], [1, 1, ZS])
  if (a1 - a0 < 6.2) for (const a of [a0, a1]) m.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pr.map(([r, y]) => new THREE.Vector3(Math.sin(a) * (r - 0.006), y, Math.cos(a) * (r - 0.006) * ZS))), 8, 0.008, 5), color)   // its turned edge
}
/** a row of stitches at height y */
function stitch(m: Mould, pr: Prof, y: number, color: string, a0: number, a1: number, n: number) { for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) / n * (a1 - a0), p = at(pr, a, y, 0.001); m.add(ROUND, color, p, [0.0075, 0.0022, 0.003], [0, a, 0], false) } }
/** a strap over a shoulder, front to back, s = side */
function strap(m: Mould, color: string, s: number, w: number, P: Prof, yf: number, yb: number, x = 0.085) {
  const f = at(P, s * 0.55, yf, 0.008), b = at(P, Math.PI - s * 0.55, yb, 0.008)
  m.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([f, [s * x, 0.37, 0.085], [s * x, 0.402, 0.02], [s * x, 0.385, -0.06], b].map(v => new THREE.Vector3(...v as V3))), 14, w, 6), color)
}
const toggle = (m: Mould, color: string, p: V3) => { m.ball(color, p, [0.017, 0.017, 0.011]); m.ball(INK, [p[0], p[1], p[2] + 0.009], [0.005, 0.005, 0.004], undefined, false) }
/** a cord's hanging end: a twist and its tassel */
function tassel(m: Mould, color: string, p: V3, len: number, lean: number) {
  m.add(tube([[0.009, 0], [0.011, len * 0.5], [0.009, len]], 8), color, [p[0], p[1] - len, p[2]], [1, 1, 1], [0, 0, lean]); m.ball(color, [p[0], p[1] - len, p[2]], [0.013, 0.011, 0.012]); m.add(new THREE.ConeGeometry(0.017, 0.035, 8), color, [p[0], p[1] - len - 0.02, p[2]])
}
interface Look { wide: number; stride: number; holds: MoglinFigure['holds']; dress: (m: Mould, P: Prof) => void }

const DRESS: Record<MoglinLook, Look> = {
  // canvas apron (bib + shoulder straps, open behind below the belt), a cord belt tied in front; square planks on both paws
  hazel: { wide: 1, stride: 0.6, holds: { pitch: -1.12, roll: 0.12 }, dress: (m, P) => {
    const C = LOOK_COLOR.hazel, SK: Prof = [[0.205, 0.112], [0.195, 0.155], [0.176, 0.215]]
    cloth(m, slice(P, 0.2, 0.352, 0.014), C.cloth); cloth(m, SK, C.cloth, -1.75, 1.75)
    stitch(m, SK, 0.124, C.clothDark, -1.65, 1.65, 26); stitch(m, slice(P, 0.2, 0.352, 0.014), 0.34, C.clothDark, -0.6, 0.6, 9)
    for (const s of [-1, 1]) { strap(m, C.cloth, s, 0.02, P, 0.335, 0.33); toggle(m, C.toggle, at(P, s * 0.56, 0.335, 0.03)) }
    m.add(band(grow(P, 1, 0.014), ZS, () => 0.212, 0.036, 0.012), C.belt)
    const k = at(P, 0.16, 0.212, 0.034)
    for (const [dx, dy, r] of [[-0.024, 0.006, 0.5], [0.022, 0.004, -0.5]] as const) m.add(new THREE.TorusGeometry(0.022, 0.008, 6, 14), C.cord, [k[0] + dx, k[1] + dy, k[2]], [1.25, 0.8, 1], [0, 0.15, r])
    m.ball(C.cord, k, [0.016, 0.016, 0.014]); tassel(m, C.cord, [k[0] + 0.004, k[1], k[2] + 0.004], 0.06, 0.05); tassel(m, C.cord, [k[0] + 0.036, k[1], k[2]], 0.048, -0.1)
    // the planks: three square boards, stacked flat
    for (let q = 0; q < 3; q++) {
      const y = 0.283 + q * 0.026, z = 0.228, ry = [0.06, -0.12, 0.16][q]
      m.add(new THREE.BoxGeometry(1, 1, 1), q === 1 ? C.plankEdge : C.plank, [0, y, z], [0.195, 0.022, 0.185], [0.04, ry, 0])
      if (q === 2) for (const gx of [-0.05, 0.015, 0.065]) m.add(ROUND, C.plankEdge, [gx, y + 0.0115, z], [0.0025, 0.001, 0.078], [0.04, ry, 0], false)
    }
  } },
  // broad; a rust apron worn whole, dark cord round it and slung across his back, a coil at his hip; the squared pale stone
  sax: { wide: 1.14, stride: 0.6, holds: { pitch: -1.05, roll: 0.02 }, dress: (m, P) => {
    const C = LOOK_COLOR.sax, SK: Prof = [[0.232, 0.112], [0.222, 0.155], [0.2, 0.215]], TOP = slice(P, 0.2, 0.362, 0.014)
    cloth(m, TOP, C.cloth); cloth(m, SK, C.cloth); stitch(m, SK, 0.124, C.clothDark, -Math.PI, Math.PI, 40); stitch(m, TOP, 0.35, C.clothDark, -0.6, 0.6, 9)
    for (const s of [-1, 1]) { strap(m, C.cloth, s, 0.026, P, 0.345, 0.345, 0.1); toggle(m, C.toggle, at(P, s * 0.6, 0.345, 0.032)) }
    m.add(band(grow(P, 1, 0.014), ZS, () => 0.212, 0.032, 0.012), C.belt)
    // the sling: right shoulder (-x) to the left hip behind, so it goes round the back half only
    const q: V3[] = [[-0.1, 0.375, 0.07], [-0.11, 0.405, 0.0], [-0.06, 0.36, -0.115], [0.06, 0.28, -0.175], [0.15, 0.22, -0.145], [0.2, 0.205, -0.06]]
    m.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(q.map(v => new THREE.Vector3(...v))), 18, 0.014, 6), C.belt)
    const h = at(P, -1.1, 0.185, 0.045)   // the coil at his right hip
    for (const [dy, r, rx] of [[0, 0.046, 0.2], [0.014, 0.04, -0.15], [-0.016, 0.05, 0.4]] as const) m.add(new THREE.TorusGeometry(r, 0.0095, 6, 18), C.belt, [h[0], h[1] + dy, h[2]], [1, 0.55, 1], [rx, -0.9, 0.2])
    m.add(tube([[0.011, 0], [0.013, 0.07]], 8), C.belt, [h[0] + 0.01, h[1] - 0.095, h[2] + 0.025], [1, 1, 1], [0, 0, 0.12])
    const p = at(SK, -0.62, 0.15, 0.004); m.add(ROUND, C.cloth, p, [0.05, 0.036, 0.008], [-0.15, -0.62, 0])   // the pocket
    m.add(new THREE.BoxGeometry(1, 1, 1), C.stone, [0, 0.262, 0.242], [0.185, 0.18, 0.062], [-0.08, 0, 0])
  } },
  // a short open vest, a jar in its pocket, a cord belt of corked clay jars
  yarrow: { wide: 0.96, stride: 1, holds: null, dress: (m, P) => {
    const C = LOOK_COLOR.yarrow, V = slice(P, 0.2, 0.395, 0.016), G = 0.6
    const belly = turn(slice(P, 0.125, 0.4, 0.003), -G - 0.15, G + 0.15, 12); m.add(belly, C.light, [0, 0, 0], [1, 1, ZS], [0, 0, 0], false)
    cloth(m, V, C.cloth, G, Math.PI * 2 - G)
    m.add(turn(slice(P, 0.2, 0.232, 0.021), G, Math.PI * 2 - G, 26), C.cloth, [0, 0, 0], [1, 1, ZS]); stitch(m, V, 0.24, C.clothDark, G + 0.06, Math.PI * 2 - G - 0.06, 34)
    for (const s of [-1, 1]) { m.add(ROUND, C.cloth, at(P, s * 0.62, 0.37, 0.018), [0.03, 0.03, 0.009], [-0.5, s * 0.62, s * 0.5]) }
    for (const y of [0.186, 0.172]) m.add(band(grow(P, 1, 0.004), ZS, () => y, 0.014, 0.012), C.cord)
    const jar = (a: number, y: number, k: number, d: number) => { const p = at(P, a, y, d)
      m.add(tube([[0.02 * k, 0], [0.032 * k, 0.015 * k], [0.034 * k, 0.04 * k], [0.02 * k, 0.06 * k], [0.023 * k, 0.07 * k]], 12), C.jar, [p[0], p[1] - 0.06 * k, p[2]])
      m.add(tube([[0.02 * k, 0.066 * k], [0.023 * k, 0.094 * k]], 10), C.cork, [p[0], p[1] - 0.06 * k, p[2]]) }
    for (const a of [-1.05, -0.5, 0.5, 1.05]) jar(a, 0.16, 0.92, 0.042)
    jar(-0.72, 0.34, 0.7, 0.026)   // in the vest
  } },
}
function build(id: MoglinLook): MoglinFigure {
  const C = LOOK_COLOR[id], L = DRESS[id], P = grow(TORSO, L.wide), body = new Mould(T), HIP = 0.13, SX = 0.128 * L.wide, SY = 0.35
  body.add(tube(P, 24), C.fur, [0, 0, 0], [1, 1, ZS])
  L.dress(body, P)
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lock(body, C.fur, [s * 0.14 * L.wide, 0.15 - k * 0.02, -0.02 + k * 0.03], [s, -0.6, 0], 0.045, 0.04)   // the hips' fur
  const leg = (s: number) => { const m = new Mould(T)
    m.add(tube([[0.05, -0.115], [0.056, -0.06], [0.066, 0], [0.05, 0.05]], 12), C.fur)
    m.add(BOOTFOOT, C.fur, [0, -HIP + 0.03, 0.03], [0.064, 0.05, 0.082])
    for (const k of [-1, 1]) m.add(ROUND, INK, [k * 0.02, -HIP + 0.04, 0.094], [0.0028, 0.014, 0.012], [-0.5, k * 0.2, 0], false)
    lock(m, C.fur, [s * 0.05, -0.04, 0], [s, -0.8, -0.1], 0.04, 0.035); return m }
  const arm = (s: number) => { const m = new Mould(T), w = 0.9 + (L.wide - 0.9) * 0.8
    m.add(tube([[0.034 * w, -0.145], [0.046 * w, -0.11], [0.05 * w, -0.05], [0.046 * w, -0.005], [0.03 * w, 0.03]], 12), C.fur)
    m.ball(C.fur, [0, -0.158, 0.004], [0.041, 0.042, 0.043])
    for (const k of [-1, 1]) m.add(ROUND, INK, [k * 0.0135, -0.185, 0.026], [0.0024, 0.013, 0.012], [0.6, 0, 0], false)
    for (let k = 0; k < 3; k++) lock(m, C.fur, [s * 0.036, -0.05 - k * 0.035, -0.012], [s, -0.9, -0.5], 0.042, 0.035)
    return m }
  const h = headParts(C)
  return {
    joints: {
      body: body.joint([0, 0, 0]), head: h.head.joint([0, 0.41, 0]),
      earL: open(ear(C, -1).joint([-0.195, HC + 0.065, -0.02]), -1), earR: open(ear(C, 1).joint([0.195, HC + 0.065, -0.02]), 1),
      armL: arm(-1).joint([-SX, SY, 0.02]), armR: arm(1).joint([SX, SY, 0.02]), legL: leg(-1).joint([-0.078 * L.wide, HIP, 0]), legR: leg(1).joint([0.078 * L.wide, HIP, 0]),
    },
    // the eyes' own origin is their height, so a blink squashes them where they are
    face: h.on.toon(), eyes: h.eyes.toon().translate(0, -h.ey, 0), eyesAt: [0, h.ey, 0], holds: L.holds, stride: L.stride,
  }
}
const made = new Map<MoglinLook, MoglinFigure>()
/** The figure, built once a page. */
export function moglinFigure(id: MoglinLook): MoglinFigure { let f = made.get(id); if (!f) { f = build(id); made.set(id, f) } return f }
