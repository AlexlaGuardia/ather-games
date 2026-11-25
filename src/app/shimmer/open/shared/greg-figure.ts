// GREGORY (BETA M166, look LOCKED by Alex 11-25; CANON characters/gregory.md + design-briefs/gregory-look.md: the
// shopkeeper-uncle, round, short, spectacles, waistcoat over shirtsleeves, a pencil behind one ear; the locked pictures add
// the short white beard and the green of the waistcoat). Pure geometry in M154's style (friend-figure.ts Mould: a merged
// vertex-coloured toon mesh + one ink hull a joint, GREG_CALLS draw calls where FolkModel paid two a part).
// Faces +Z, feet at y 0, the wearer's left is +x. He SITS too: `sit` holds the two bent legs (thigh along the bench, shin down).
import * as THREE from 'three'
import { Mould, buf, tube, turn, radAt, ROUND, LOCK, CAP, DARK, boot, ears, face, hand, done, type FriendFigure, type FriendJoint, type Prof, type V3 } from './friend-figure'

export const GREG_COLOR = {
  skin: '#f4b08c', nose: '#ee9a86', hair: '#f6f3ea', eye: '#3a2a20', shirt: '#f7ecc8', vest: '#8a9550', trouser: '#9a7c4c', cuff: '#7d6239',
  boot: '#96683a', button: '#2b2218', pencil: '#f2bd1c', specs: '#3a2c22', crinkle: '#b9765c',
} as const
export interface GregFigure extends FriendFigure { sit: { legL: FriendJoint; legR: FriendJoint } }
/** toon + ink for six joints, the face lines, the eyes: standing or seated */
export const GREG_CALLS = 6 * 2 + 2
/** how far ahead of the hip a seated knee is (the bench's front edge is 0.35 m out) */
export const GREG_KNEE = 0.4
/** which side the pencil sits: his RIGHT ear (the pictures), -x */
export const PENCIL_SIDE = -1

const HY = 1.3, HIP = 0.5, SH = 1.075, ZS = 0.9, LEG_X = 0.125, ARM_X = 0.295
/** the waistcoat: a round belly, widest a little under the middle */
export const GREG_TORSO: Prof = [[0.262, 0.44], [0.292, 0.54], [0.302, 0.68], [0.292, 0.82], [0.258, 0.95], [0.212, 1.05], [0.15, 1.115], [0.07, 1.15]]

/** a V lying on a turned body's front: its point at y0, opening to `half` rad at y1, `out` proud of the surface */
export function vee(prof: Prof, y0: number, y1: number, half: number, out: number, rows = 8) {
  const p: number[] = [], idx: number[] = []
  for (let k = 0; k <= rows; k++) { const y = y0 + (y1 - y0) * k / rows, r = radAt(prof, y) + out
    for (const q of [-1, 0, 1]) { const a = q * half * k / rows; p.push(Math.sin(a) * r, y, Math.cos(a) * r) }
    if (k < rows) for (const e of [0, 1]) { const A = k * 3 + e, B = A + 1, C2 = A + 3, D = C2 + 1; idx.push(A, B, C2, B, D, C2) } }
  const g = buf(p, idx); g.computeVertexNormals(); return g
}
function build(): GregFigure {
  const C = GREG_COLOR, body = new Mould(), head = new Mould(), T = GREG_TORSO
  const front = (y: number, out = 0.004) => radAt(T, y) * ZS + out
  body.add(tube(T, 26), C.vest, [0, 0, 0], [1, 1, ZS])
  body.ball(C.trouser, [0, 0.43, 0], [0.25, 0.1, 0.22])   // the seat of the trousers, under the hem
  body.add(tube([[0.085, 1.09], [0.08, 1.2]]), C.skin)
  // shirt at the neck: the V the waistcoat leaves, its two buttons, a collar's two points
  body.add(vee(T, 0.88, 1.085, 0.5, 0.012), C.shirt, [0, 0, 0], [1, 1, ZS], [0, 0, 0], false)
  for (const y of [1.04, 0.97]) body.ball(C.cuff, [0, y, front(y, 0.014)], [0.008, 0.008, 0.005], undefined, false)
  for (const s of [-1, 1]) body.add(ROUND, C.shirt, [s * 0.075, 1.118, 0.112], [0.058, 0.02, 0.04], [0.75, s * 0.45, s * -0.35])
  body.add(new THREE.TorusGeometry(1, 0.3, 6, 18), C.shirt, [0, 1.14, -0.02], [0.095, 0.1, 0.07], [Math.PI / 2 - 0.2, 0, 0])
  // the waistcoat's front edge, three dark buttons, the notch at the hem; a seam down the back
  const line = (a: number, y0: number, y1: number) => body.add(turn([...T.filter(([, y]) => y > y0 && y < y1).map(([r, y]) => [r + 0.003, y] as const)], a - 0.012, a + 0.012, 2), DARK, [0, 0, 0], [1, 1, ZS], [0, 0, 0], false)
  line(0, 0.46, 0.9); line(Math.PI, 0.46, 1.1)
  for (const y of [0.9, 0.75, 0.6]) body.ball(C.button, [0.028, y, front(y)], [0.014, 0.014, 0.008], undefined, false)
  body.add(new THREE.ConeGeometry(1, 1, 3), C.trouser, [0, 0.475, front(0.475, 0.002)], [0.05, 0.08, 0.012], [0.12, Math.PI, 0], false)
  const leg = (sit: boolean) => () => { const m = new Mould()
    m.add(tube([[0.088, -0.335], [0.132, -0.3], [0.14, -0.18], [sit ? 0.118 : 0.132, sit ? 0.06 : 0], ...(sit ? [] : [[0.11, 0.05] as const])]), C.trouser)
    m.add(tube([[0.09, -0.365], [0.098, -0.35], [0.094, -0.325]]), C.cuff)
    boot(m, C.boot, -HIP, 0.17, 0.076, [0.086, 0.08, 0.15])
    if (sit) {   // the knee, and the thigh back along the bench to the hip
      m.ball(C.trouser, [0, 0.06, 0], [0.12, 0.112, 0.12])
      m.add(tube([[0.118, 0], [0.122, 0.2], [0.116, GREG_KNEE]]), C.trouser, [0, 0.06, -GREG_KNEE], [1, 1, 1], [Math.PI / 2, 0, 0])
    }
    return m }
  const arm = (s: number) => { const m = new Mould()   // sleeves rolled to the elbow
    m.add(tube([[0.074, -0.3], [0.086, -0.22], [0.088, -0.08], [0.08, 0], [0.058, 0.04], [0.026, 0.06]]), C.shirt)
    m.add(tube([[0.074, -0.345], [0.09, -0.33], [0.092, -0.285], [0.08, -0.27]]), C.shirt)
    m.add(tube([[0.05, -0.5], [0.062, -0.4], [0.064, -0.3]]), C.skin); hand(m, C.skin, -0.545, 0.056, s); return m }
  const F = face(head, { rx: 0.166, ry: 0.185, skin: C.skin, hair: C.hair, eye: C.eye, eyeW: 0.026, eyeH: 0.029, brow: 0.013, lash: false, mouth: 'small', nose: 1 }, 0.08)
  const rz = 0.166 * 0.98, ex = 0.166 * 0.4, ey = F.ey
  head.ball(C.nose, [0, -0.045, rz * 1.0], [0.04, 0.036, 0.04])   // the big round nose
  for (const s of [-1, 1]) head.ball(C.skin, [s * 0.085, -0.05, rz * 0.72], [0.05, 0.042, 0.04], undefined, false)   // full cheeks
  ears(head, C.skin, 0.166, -0.02, 1.15)
  // spectacles: two round rims on the nose, a bridge, an arm back to each ear
  const RIM = new THREE.TorusGeometry(1, 0.085, 5, 20)
  for (const s of [-1, 1]) {
    head.add(RIM, C.specs, [s * ex * 1.02, ey - 0.002, rz * 0.93 + 0.022], [0.05, 0.05, 0.05], [0, s * 0.3, 0], false)
    head.add(ROUND, C.specs, [s * 0.148, ey + 0.004, 0.075], [0.004, 0.004, 0.085], [0, s * 0.16, 0], false)
    for (const a of [0.42, -0.42]) F.on.add(ROUND, C.crinkle, [s * 0.128, ey - 0.004, 0.108], [0.016, 0.0022, 0.003], [0, s * 0.95, s * a], false)   // the crinkle at each eye
  }
  head.add(ROUND, C.specs, [0, ey + 0.006, rz * 0.93 + 0.034], [0.022, 0.004, 0.004], [0, 0, 0], false)
  // white hair: swept up off the brow and back, full at the sides, down to the collar behind
  head.add(CAP(Math.PI * 0.55), C.hair, [0, 0.03, -0.03], [0.184, 0.192, 0.188], [-0.55, 0, 0])
  head.ball(C.hair, [0, 0.135, -0.035], [0.15, 0.085, 0.16]); head.ball(C.hair, [0.02, 0.158, 0.06], [0.105, 0.05, 0.07], [-0.25, 0, 0.08])   // the swept-up top, a wave at the front
  const lock = (a: number, t: number, len: number, w: number, up: number, back: number) => {
    const n = new THREE.Vector3(Math.sin(t) * Math.sin(a), Math.cos(t), Math.sin(t) * Math.cos(a)), dir = n.clone().multiplyScalar(0.45).add(new THREE.Vector3(0, up, -back)).normalize()
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
    head.add(LOCK, C.hair, [n.x * 0.16, 0.03 + n.y * 0.17, n.z * 0.16 - 0.03], [w, len, w], [e.x, e.y, e.z])
  }
  for (let k = 0; k < 5; k++) lock(-0.5 + k * 0.25, 0.5, 0.085 + (k % 2) * 0.012, 0.1, 0.35, 0.8)   // feathered back off the brow
  for (const s of [-1, 1]) {
    head.ball(C.hair, [s * 0.162, 0.03, -0.055], [0.055, 0.1, 0.115])   // full over the ears
    for (let k = 0; k < 3; k++) lock(s * (1.7 + k * 0.32), 1.2 + k * 0.12, 0.075, 0.085, -0.15, 0.55)
  }
  for (let k = 0; k < 7; k++) lock(Math.PI - 0.9 + k * 0.3, 1.62, 0.085, 0.1, -1.2, 0.3)   // the nape, to the collar
  head.ball(C.hair, [0, -0.02, -0.075], [0.168, 0.17, 0.125])
  // the beard: short and full, ear to ear under the jaw, and a moustache over it
  head.ball(C.hair, [0, -0.124, 0.045], [0.154, 0.108, 0.132])
  for (let k = 0; k < 9; k++) { const a = -1.3 + k * 0.325; head.add(LOCK, C.hair, [Math.sin(a) * 0.132, -0.15 - Math.cos(a) * 0.012, 0.03 + Math.cos(a) * 0.105], [0.085, 0.085 + Math.cos(a) * 0.03, 0.07], [Math.PI - 0.12 * Math.cos(a), 0, Math.sin(a) * 0.35]) }
  for (const s of [-1, 1]) { head.ball(C.hair, [s * 0.15, -0.06, 0.03], [0.03, 0.07, 0.06]); head.ball(C.hair, [s * 0.046, -0.09, rz * 0.93 + 0.004], [0.052, 0.022, 0.03], [0, s * 0.3, s * -0.32]) }
  head.ball(C.nose, [0, -0.122, rz * 0.9 + 0.012], [0.022, 0.009, 0.012], undefined, false)   // the lip, under the moustache
  // the pencil, behind his right ear, point down and forward
  const px = PENCIL_SIDE * 0.222
  head.add(tube([[0.008, -0.06], [0.008, 0.06]], 6), C.pencil, [px, 0.005, 0.035], [1, 1, 1], [0.5, 0, PENCIL_SIDE * -0.1])
  head.add(new THREE.ConeGeometry(1, 1, 6), DARK, [px + PENCIL_SIDE * 0.007, -0.058, 0.001], [0.008, 0.022, 0.008], [Math.PI + 0.5, 0, PENCIL_SIDE * -0.1], false)
  const f = done(body, head, arm, leg(false), F, HY, HIP, SH, ARM_X, LEG_X, 0.2)
  const sl = leg(true)
  return { ...f, sit: { legL: sl().joint([-LEG_X, HIP, GREG_KNEE]), legR: sl().joint([LEG_X, HIP, GREG_KNEE]) } }
}
let made: GregFigure | null = null
/** The figure, built once a page. */
export const gregFigure = (): GregFigure => (made ??= build())
export type { V3 }
