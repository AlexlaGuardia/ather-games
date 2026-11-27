// THE CARTOON HEADS (BETA M216 s2a, Alex 11-26; locked sheet athernyx 7a49931 assets/concept-1672/keeper-head-cartoon/
// heads-LOCKED.png + NOTES.md). Four heads A-D, each male + female: big sharp eyes, NO nose, a small mouth set low, anime
// hair, small pointed ears. Built as the notes say: the dials' head mesh (headShapeGeo, the same one every face uses), the
// face = flat decals (eyes + brows + mouth) on its surface, the hair = separate chunky locks (keeper-figure.ts headAndFace).
// ★ ONE SOURCE PER PROPORTION (M216 s1 hard rule): a head is a SHAPE only. It carries no head size, chin taper, chin length,
//   eye size, eye spacing, eye height or mouth height: those are the body bench's dials, the same for every head. The eye
//   outlines live in a unit box (scaled by the one shared CARTOON eye size x the Eye size dial), every head's eyes sit on
//   the one shared CARTOON place + the Eye spacing / Eye height dials, every mouth on the one CARTOON mouth line + Mouth
//   height. keeper-one-source.test.ts fails if a head carries a dial-owned key or moves an eye / mouth off the shared place.
//   The sheet's different jaws (A oval, B V chin, C square, D heart) are STARTING DIALS the bench copies onto the sliders
//   when a head is picked (the bench's HEAD_STARTS), never baked here.
import * as THREE from 'three'
import { boostAt, surf, type EyeDials, type HeadShape } from './keeper-faces'

type P2 = readonly [number, number]
/** an eye outline in a unit box (x -0.5 inner corner .. 0.5 outer corner, y -0.5..0.5): the top edge and the bottom edge,
 *  each from the inner corner to the outer corner */
export interface EyeOutline { top: readonly P2[]; bottom: readonly P2[]; crease?: boolean }
export const EYE_OUTLINES = {
  almond: { top: [[-0.5, 0], [-0.3, 0.4], [0.1, 0.5], [0.4, 0.42], [0.56, 0.32]], bottom: [[-0.5, 0], [-0.2, -0.38], [0.2, -0.42], [0.45, -0.12], [0.56, 0.32]] },
  wedge: { top: [[-0.5, 0.02], [0.1, 0.24], [0.56, 0.42]], bottom: [[-0.5, 0.02], [-0.08, -0.42], [0.3, -0.3], [0.56, 0.42]] },
  tall: { top: [[-0.42, 0.34], [-0.2, 0.5], [0.3, 0.5], [0.46, 0.38]], bottom: [[-0.42, 0.34], [-0.46, -0.2], [-0.2, -0.5], [0.25, -0.5], [0.46, -0.2], [0.46, 0.38]] },
  hooded: { top: [[-0.5, 0], [-0.1, 0.16], [0.3, 0.18], [0.56, 0.08]], bottom: [[-0.5, 0], [-0.15, -0.4], [0.25, -0.4], [0.56, 0.08]], crease: true },
} as const satisfies Record<string, EyeOutline>
export type EyeKind = keyof typeof EYE_OUTLINES
export type MouthKind = 'line' | 'smirk' | 'open' | 'cat'

/** one head's SHAPE (the sheet's column + row). No size, no place: see the header. */
export interface CartoonHead {
  letter: 'A' | 'B' | 'C' | 'D'; sex: 'M' | 'F'
  eyes: EyeKind; iris: string
  /** brow line: thickness as a share of the brow band, tilt (rad, + = outer end up), arch */
  brow: { bold: number; tilt: number; arch: number }
  mouth: MouthKind; lips: boolean
  hair: 'A-M' | 'A-F' | 'B-M' | 'B-F' | 'C-M' | 'C-F' | 'D-M' | 'D-F'
}
/** index = Look.head - 1 (OPT.head: A male, A female, B male, ... D female) */
export const CARTOON_HEADS: readonly CartoonHead[] = [
  { letter: 'A', sex: 'M', eyes: 'almond', iris: '#c8861e', brow: { bold: 1, tilt: -0.12, arch: 0.1 }, mouth: 'line', lips: false, hair: 'A-M' },
  { letter: 'A', sex: 'F', eyes: 'almond', iris: '#c8861e', brow: { bold: 0.6, tilt: -0.06, arch: 0.2 }, mouth: 'line', lips: true, hair: 'A-F' },
  { letter: 'B', sex: 'M', eyes: 'wedge', iris: '#3f8f52', brow: { bold: 0.9, tilt: 0.14, arch: 0 }, mouth: 'smirk', lips: false, hair: 'B-M' },
  { letter: 'B', sex: 'F', eyes: 'wedge', iris: '#3f8f52', brow: { bold: 0.6, tilt: 0.1, arch: 0.05 }, mouth: 'smirk', lips: true, hair: 'B-F' },
  { letter: 'C', sex: 'M', eyes: 'tall', iris: '#3d6fc4', brow: { bold: 1, tilt: 0.04, arch: 0.25 }, mouth: 'open', lips: false, hair: 'C-M' },
  { letter: 'C', sex: 'F', eyes: 'tall', iris: '#3d6fc4', brow: { bold: 0.6, tilt: 0.04, arch: 0.3 }, mouth: 'open', lips: false, hair: 'C-F' },
  { letter: 'D', sex: 'M', eyes: 'hooded', iris: '#2a9aa0', brow: { bold: 0.8, tilt: 0, arch: 0 }, mouth: 'cat', lips: false, hair: 'D-M' },
  { letter: 'D', sex: 'F', eyes: 'hooded', iris: '#2a9aa0', brow: { bold: 0.6, tilt: 0, arch: 0.05 }, mouth: 'cat', lips: true, hair: 'D-F' },
]
export const cartoonHead = (head: number): CartoonHead | null => CARTOON_HEADS[head - 1] ?? null

/** THE ONE shared place + size for every cartoon head (fractions of the head size H). The dials move / scale from here. */
export const CARTOON = { eyeX: 0.19, eyeY: 0.0, eyeW: 0.22, eyeH: 0.14, browUp: 0.15, browW: 0.15, browTh: 0.032, mouthY: -0.24 } as const

const FLAT = new Map<string, THREE.MeshBasicMaterial>()
const flat = (c: string) => { let m = FLAT.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); FLAT.set(c, m) } return m }
const GEOS = new Map<string, THREE.BufferGeometry>()
const memo = (k: string, make: () => THREE.BufferGeometry) => { let g = GEOS.get(k); if (!g) { g = make(); GEOS.set(k, g) } return g }
const DISC = new THREE.CircleGeometry(1, 16)
const r4 = (v: number) => Math.round(v * 1e4) / 1e4

/** the eye white: the outline scaled to w x h, mirrored for the other side */
function whiteGeo(o: EyeOutline, w: number, h: number, s: number) {
  const sh = new THREE.Shape(), pts = [...o.top, ...[...o.bottom].reverse().slice(1, -1)]
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x * w * s, y * h) : sh.moveTo(x * w * s, y * h)))
  return new THREE.ShapeGeometry(sh)
}
/** a band of thickness th along a polyline (the lid line along the top edge, the crease) */
function bandGeo(line: readonly P2[], w: number, h: number, s: number, th: number, dy = 0) {
  const sh = new THREE.Shape()
  line.forEach(([x, y], i) => (i ? sh.lineTo(x * w * s, y * h + dy + th * 0.5) : sh.moveTo(x * w * s, y * h + dy + th * 0.5)))
  for (const [x, y] of [...line].reverse()) sh.lineTo(x * w * s, y * h + dy - th * 0.5)
  return new THREE.ShapeGeometry(sh)
}
function strip(w: number, th: number, arch: number) {
  const sh = new THREE.Shape(), n = 10, pts: [number, number][] = []
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([(u - 0.5) * w, arch * w * (1 - (2 * u - 1) ** 2) * 0.5]) }
  const tw = (i: number) => th * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.15)))
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y + tw(i) * 0.5) : sh.moveTo(x, y + tw(i) * 0.5)))
  for (let i = n; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1] - tw(i) * 0.5)
  return new THREE.ShapeGeometry(sh)
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3()
/** Draw cartoon head `head` (1-8)'s face on a head group centred at (0,0,0), head size H: two eye groups (eye-l / eye-r,
 *  boosted with distance like the face sets) and a mouth group ('mouth', every mesh tagged userData.mouth so the bench can
 *  swap it). `d` = the eye dials, `mouthLift` = the Mouth height dial (m), `shape` = the head's dials (decals follow it). */
export function drawCartoonFace(g: THREE.Group, head: number, H: number, hair: string, skin: string, brows: boolean, shape: HeadShape, d: EyeDials, mouthLift: number, iris?: string) {
  const c = cartoonHead(head); if (!c) return
  const f = { jaw: Math.round(shape.jaw * 100) / 100, chin: Math.round(shape.chin * 100) / 100 }
  const o: EyeOutline = EYE_OUTLINES[c.eyes], INK = '#1c1712'
  const w = r4(H * CARTOON.eyeW * d.eye), h = r4(H * CARTOON.eyeH * d.eye)
  const ymax = Math.max(...o.top.map(p => p[1])), ymin = Math.min(...o.bottom.map(p => p[1]))
  for (const s of [-1, 1]) {
    const ex = s * (H * CARTOON.eyeX + d.gap), ey = H * CARTOON.eyeY + d.y, cs = surf(H, f, ex, ey)
    const eye = new THREE.Group(); eye.name = s < 0 ? 'eye-r' : 'eye-l'; eye.position.set(ex, ey, cs.z); g.add(eye)
    const decal = (geo: THREE.BufferGeometry, color: string, x: number, y: number, dz: number, sx = 1, sy = 1, rotZ = 0) => {
      const p = surf(H, f, x, y), m = new THREE.Mesh(geo, flat(color))
      m.position.set(x - ex, y - ey, p.z - cs.z + H * dz); m.rotation.set(p.pitch, p.yaw, rotZ, 'YXZ'); m.scale.set(sx, sy, 1); eye.add(m)
      return m
    }
    const white = decal(memo(`w${c.eyes}${s}|${w}|${h}`, () => whiteGeo(o, w, h, s)), '#fbf6ee', ex, ey, 0.012)
    white.onBeforeRender = (_r, _s, cam) => {
      const k = boostAt(cam.getWorldPosition(_a).distanceTo(eye.getWorldPosition(_b)))
      if (Math.abs(eye.scale.x - k) > 0.01) { eye.scale.setScalar(k); eye.updateMatrixWorld(true) }
    }
    // iris + pupil fill the outline's open height, nudged inward (a sharp look), highlight up and out
    const ih = (ymax - ymin) * h * 0.92, iw = Math.min(ih * 0.82, w * 0.5), iy = ey + (ymax + ymin) * 0.5 * h, ix = ex - s * w * 0.06
    decal(DISC, iris ?? c.iris, ix, iy, 0.02, iw * 0.5, ih * 0.5)
    decal(DISC, '#0d0907', ix, iy, 0.026, iw * 0.26, ih * 0.3)
    decal(DISC, '#ffffff', ix + s * iw * 0.2, iy + ih * 0.2, 0.032, H * 0.013, H * 0.013)
    decal(memo(`l${c.eyes}${s}|${w}|${h}`, () => bandGeo(o.top, w * 1.04, h, s, H * 0.022)), INK, ex, ey, 0.036)
    if (o.crease) decal(memo(`c${c.eyes}${s}|${w}|${h}`, () => bandGeo(o.top, w * 0.9, h, s, H * 0.01, h * 0.32)), INK, ex, ey, 0.034)
    if (brows) {
      const by = ey + H * CARTOON.browUp, bx = ex + s * H * 0.01, th = H * CARTOON.browTh * c.brow.bold
      decal(memo(`b${head}|${H}`, () => strip(H * CARTOON.browW, th, c.brow.arch)), hair, bx, by, 0.04, 1, 1, s * c.brow.tilt)
      decal(memo(`bi${head}|${H}`, () => strip(H * CARTOON.browW * 1.06, th * 1.5, c.brow.arch)), INK, bx, by, 0.038, 1, 1, s * c.brow.tilt)
    }
  }
  // ── the mouth: one group on the shared mouth line + the Mouth height dial; the head picks only its shape ──
  const my = H * CARTOON.mouthY + mouthLift, ms = surf(H, f, 0, my)
  const mouth = new THREE.Group(); mouth.name = 'mouth'; mouth.position.set(0, my, ms.z); mouth.userData.mouth = true; g.add(mouth)
  const lip = '#' + new THREE.Color(skin).lerp(new THREE.Color('#c0565a'), 0.5).getHexString()
  const md = (geo: THREE.BufferGeometry, color: string, x: number, y: number, dz: number, sx = 1, sy = 1, rotZ = 0) => {
    const p = surf(H, f, x, my + y), m = new THREE.Mesh(geo, flat(color))
    m.position.set(x, y, p.z - ms.z + H * dz); m.rotation.set(p.pitch, p.yaw, rotZ, 'YXZ'); m.scale.set(sx, sy, 1); m.userData.mouth = true; mouth.add(m)
  }
  if (c.mouth === 'line') md(memo(`ml${H}`, () => strip(H * 0.085, H * 0.018, -0.12)), INK, 0, 0, 0.02)
  if (c.mouth === 'smirk') { md(memo(`ms${H}`, () => strip(H * 0.08, H * 0.018, -0.3)), INK, H * 0.012, 0, 0.02, 1, 1, 0.16); md(memo(`mk${H}`, () => strip(H * 0.024, H * 0.01, -0.5)), INK, H * 0.055, H * 0.012, 0.02, 1, 1, 0.9) }
  if (c.mouth === 'open') { md(DISC, '#5a2a22', 0, 0, 0.018, H * 0.042, H * 0.026); md(DISC, '#d9787a', 0, -H * 0.012, 0.022, H * 0.026, H * 0.012) }
  if (c.mouth === 'cat') for (const s of [-1, 1]) md(memo(`mc${H}`, () => strip(H * 0.04, H * 0.014, -0.7)), INK, s * H * 0.018, 0, 0.02)
  if (c.lips) md(DISC, lip, 0, -H * 0.018, 0.016, H * 0.022, H * 0.009)
}
