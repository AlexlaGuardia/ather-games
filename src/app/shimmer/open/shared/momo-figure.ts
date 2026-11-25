// MOMO, BONN'S DUSKPUFF (BETA M155 s2; look LOCKED by Alex 11-25, CANON design-briefs/momo-duskpuff.md). Pure geometry off the locked
// drawing's own numbers (momo/draw_momo.py, 250 px = the body's half width): an orb, two flush ears, two eyes, two little feet. No
// mouth, no nose, no glow. Cat-sized. Faces +Z, feet at y 0. MOMO_CALLS draw calls: one toon mesh, one ink hull, one unlit (eyes + rim).
import * as THREE from 'three'
import { Mould, buf, type V3 } from './friend-figure'

/** metres a drawing pixel: the orb is 0.36 m wide */
export const PX = 0.18 / 250
export const MOMO_CALLS = 3
/** the drawing's colours; the toon ramp + the scene's light take about 2.8x off, so what is LIT is painted up by that (LIT, DARK, EAR; RIM too, over it) */
export const MOMO_COLOR = { ink: '#080710', lit: '#211e3a', dark: '#16142a', rim: '#302c52', ear: '#282444', eye: '#f5b840', iris: '#cc761c', glint: '#fffaec' }
const LIT = '#38344e', DARK = '#282538', EAR = '#48425e', RIM = '#4a4470'
const C = MOMO_COLOR, BODY = { y: 274, rx: 250, ry: 235, rz: 250 }
export const MOMO_HEIGHT = (482 + 48) * PX
const v = (x: number, y: number, z: number): V3 => [x * PX, y * PX, z * PX]
const ORB = new THREE.SphereGeometry(1, 24, 18), SMALL = new THREE.SphereGeometry(1, 14, 10)

/** a point of the orb's skin, `lift` px out: `a` = the turn from the front (+ = the wearer's left), `h` = px above the middle */
function skin(a: number, h: number, lift: number): V3 {
  const k = Math.sqrt(Math.max(0, 1 - (h / BODY.ry) ** 2))
  return v(Math.sin(a) * (BODY.rx * k + lift), BODY.y + h * (1 + lift / BODY.ry), Math.cos(a) * (BODY.rz * k + lift))
}
/** a ring (r0..r1 of an rx/ry ellipse) laid on the skin */
function ring(m: Paint, color: string, a: number, h: number, rx: number, ry: number, r0: number, r1: number, lift: number, seg = 24) {
  const b = m.p.length / 3, col = new THREE.Color(color)
  for (let k = 0; k <= seg; k++) for (const r of [r0, r1]) { const t = (k / seg) * Math.PI * 2; m.p.push(...skin(a + Math.cos(t) * rx * r / BODY.rx, h + Math.sin(t) * ry * r, lift)); m.c.push(col.r, col.g, col.b) }
  for (let k = 0; k < seg; k++) { const i = b + k * 2; m.i.push(i, i + 1, i + 3, i, i + 3, i + 2) }
}
interface Paint { p: number[]; c: number[]; i: number[] }
/** the eye's bands never overlap, so nothing fights for depth: ink, gold, amber, pupil; the glint is a little further out */
export const EYE = { a: 0.43, h: 5, rx: 68, ry: 68 }
function eye(m: Paint, s: number) {
  const a = s * EYE.a, o = (r: number) => r / EYE.rx
  ring(m, C.ink, a, EYE.h, EYE.rx, EYE.ry, 1, o(EYE.rx + 8), 4)
  ring(m, C.eye, a, EYE.h, EYE.rx, EYE.ry, 0.72, 1, 4)
  ring(m, C.iris, a, EYE.h, EYE.rx, EYE.ry, 0.47, 0.72, 4)
  ring(m, C.ink, a, EYE.h, EYE.rx, EYE.ry, 0, 0.47, 4)
  // the glint is at the drawing's upper right, the same side on both (facing +z, the viewer's right is +x)
  ring(m, C.glint, a + 0.24 * EYE.rx / BODY.rx, EYE.h + 0.28 * EYE.ry, EYE.rx, EYE.ry, 0, 0.17, 6, 14)
}
/** the drawing's rim: a thin arc high on the viewer's left, from the front and from the back */
function rim(m: Paint, back: boolean) {
  const b = m.p.length / 3, col = new THREE.Color(RIM), n = 14
  for (let k = 0; k <= n; k++) {
    const t = (205 + (262 - 205) * k / n) * Math.PI / 180, taper = Math.sin(Math.PI * k / n)
    for (const w of [-4.5 * taper, 4.5 * taper]) {
      const x = Math.cos(t) * (212 + w), y = -Math.sin(t) * (200 + w)   // seen from the front the viewer's left is -x; from behind it is +x
      const z = BODY.rz * Math.sqrt(Math.max(0, 1 - (x / BODY.rx) ** 2 - (y / BODY.ry) ** 2)), l = 1.012
      m.p.push(...v(x * l * (back ? -1 : 1), BODY.y + y * l, (z * l) * (back ? -1 : 1))); m.c.push(col.r, col.g, col.b)
    }
  }
  for (let k = 0; k < n; k++) { const i = b + k * 2; m.i.push(i, i + 1, i + 3, i, i + 3, i + 2) }
}
export interface MomoFigure { toon: THREE.BufferGeometry; ink: THREE.BufferGeometry; paint: THREE.BufferGeometry }
let made: MomoFigure | null = null
export function momoFigure(): MomoFigure {
  if (made) return made
  const m = new Mould(8 * PX)
  m.add(ORB, LIT, v(0, BODY.y, 0), v(BODY.rx, BODY.ry, BODY.rz))
  for (const s of [-1, 1]) {
    m.add(SMALL, DARK, v(s * 165, 482, -20), v(50, 48, 40))
    m.add(SMALL, EAR, v(s * 166, 478, 8), v(30, 28, 16), [0, 0, 0], false)
    m.add(SMALL, DARK, v(s * 82, 36, 30), v(62, 28, 80))
    m.add(SMALL, LIT, v(s * 82, 44, 44), v(38, 22, 50), [0, 0, 0], false)
  }
  const p: Paint = { p: [], c: [], i: [] }
  eye(p, -1); eye(p, 1); rim(p, false); rim(p, true)
  return (made = { toon: m.toon(), ink: m.ink(), paint: buf(p.p, p.i, undefined, p.c) })
}
