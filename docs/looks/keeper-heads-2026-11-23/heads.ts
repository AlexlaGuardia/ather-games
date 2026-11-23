// M116 PROTO (not wired into the game): keeper heads, take 2. TODAY's head stays the base (hub 11-23: "the heads are
// already pretty close"): the live buildKeeper() body + hair, ONE universal head size for all 6 models, and four adult
// face sets (A-D) drawn on the same head sphere. The head + hair + face are a PROTO COPY of keeper-figure.ts headAndFace()
// (same toon ramp, ink hull, hair v3) with the face parameterised; 'today' renders the live builder untouched.
import * as THREE from 'three'
import { buildKeeper } from '/root/ather-games/src/app/shimmer/open/shared/keeper-figure'
import { OPT, type Look } from '/root/ather-games/src/app/shimmer/open/shared/keeper-look'
import { proportionsFor, type Proportions } from '/root/ather-games/src/app/shimmer/open/shared/keeper-proportions'

/** ONE head size for every model: the mean of today's six saved sizes (headW 0.74-0.80 -> 0.785, headH 0.71-0.82 -> 0.772),
 *  rounded down a touch so the larger frames keep the smaller-head read Alex dialled in on the bench. */
export const UNIVERSAL = { headW: 0.78, headH: 0.76 }

export interface Face {
  label: string; note: string
  jaw: number; chin: number          // chin taper (the live M103 dial) + extra lower-face length (adult = longer lower face)
  eyeX: number; eyeY: number; eyeW: number; eyeH: number; tilt: number   // almond eye, x spacing, size, outer-corner lift (rad)
  lid: number; wing: number; lower: number   // upper-lid line thickness, how far it runs past the outer corner, lower lash line
  iris: number; hi: boolean                  // iris height as a share of the eye, a catch-light
  brow: { y: number; w: number; th: number; tilt: number; arch: number }
  nose: 'dot' | 'wedge' | 'bridge'; mouthW: number; mouthY: number; mouth: Mouth
}
/** M116b mouth options (Alex 11-23: "a few options for the MOUTHS"): adult, small, toon. 'line' / 'soft' / 'smirk' are the
 *  sheet-1 mouths; the M-prefixed five are the options sheet. */
export type Mouth = 'line' | 'soft' | 'smirk' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5'
export const MOUTHS: [Mouth, string][] = [['M1', '1  Neutral line'], ['M2', '2  Slight smile'], ['M3', '3  Soft full lips'], ['M4', '4  Smirk'], ['M5', '5  Closed calm']]
export const FACES: Record<'A' | 'B' | 'C' | 'D', Face> = {
  A: { label: 'A  Soft almond', note: 'light chin taper, almond eyes, thin arched brows', jaw: 0.35, chin: 0.05,
    eyeX: 0.165, eyeY: 0.0, eyeW: 0.15, eyeH: 0.085, tilt: 0.06, lid: 0.022, wing: 0.01, lower: 0, iris: 0.95, hi: true,
    brow: { y: 0.16, w: 0.15, th: 0.02, tilt: 0.06, arch: 0.25 }, nose: 'dot', mouthW: 0.08, mouthY: -0.2, mouth: 'soft' },
  B: { label: 'B  Keen', note: 'tapered chin, narrow upswept eyes with a winged lid, straight low brows', jaw: 0.6, chin: 0.08,
    eyeX: 0.165, eyeY: 0.0, eyeW: 0.16, eyeH: 0.068, tilt: 0.17, lid: 0.03, wing: 0.035, lower: 0, iris: 1.05, hi: true,
    brow: { y: 0.12, w: 0.16, th: 0.028, tilt: -0.12, arch: 0 }, nose: 'wedge', mouthW: 0.07, mouthY: -0.22, mouth: 'line' },
  C: { label: 'C  Calm', note: 'half-lidded almond eyes, soft high brows, nose line, a small smile', jaw: 0.45, chin: 0.06,
    eyeX: 0.165, eyeY: -0.005, eyeW: 0.145, eyeH: 0.08, tilt: 0.04, lid: 0.04, wing: 0.012, lower: 0.012, iris: 1.0, hi: false,
    brow: { y: 0.17, w: 0.15, th: 0.022, tilt: 0.1, arch: 0.35 }, nose: 'bridge', mouthW: 0.09, mouthY: -0.21, mouth: 'smirk' },
  D: { label: 'D  Strong', note: 'long tapered jaw, small set eyes, heavy low brows, nose bridge', jaw: 0.75, chin: 0.12,
    eyeX: 0.155, eyeY: -0.01, eyeW: 0.125, eyeH: 0.06, tilt: 0.05, lid: 0.03, wing: 0.015, lower: 0.01, iris: 1.05, hi: false,
    brow: { y: 0.105, w: 0.17, th: 0.04, tilt: -0.16, arch: 0 }, nose: 'bridge', mouthW: 0.11, mouthY: -0.24, mouth: 'line' },
}

// ── the live material recipe (keeper-figure.ts): 3-step toon ramp, an inverted ink hull, flat ink for the face ──
const grad = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t })()
const SPH = new THREE.SphereGeometry(1, 20, 14), BOX = new THREE.BoxGeometry(1, 1, 1)
const LOCK = new THREE.LatheGeometry([[0, 0], [0.5, 0.05], [0.55, 0.22], [0.45, 0.5], [0.25, 0.78], [0.08, 0.95], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
const CAP = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)
const EAR = new THREE.LatheGeometry([[0, -0.5], [0.45, -0.38], [0.5, -0.1], [0.36, 0.2], [0.14, 0.42], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
const INK = new THREE.MeshBasicMaterial({ color: 0x1b140e, side: THREE.BackSide })
const TOON = new Map<string, THREE.Material>(), FLAT = new Map<string, THREE.Material>()
const toon = (c: string) => { let m = TOON.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }); TOON.set(c, m) } return m }
const flatM = (c: string) => { let m = FLAT.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); FLAT.set(c, m) } return m }
type V3 = [number, number, number]
function put(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3, scale: V3, rot?: V3 | null, ink = true) {
  const m = new THREE.Mesh(geo, toon(color)); m.position.set(...pos); m.scale.set(...scale); if (rot) m.rotation.set(...rot); g.add(m)
  if (ink) { const o = new THREE.Mesh(geo, INK); o.position.copy(m.position); o.scale.copy(m.scale).multiplyScalar(1.07); o.rotation.copy(m.rotation); g.add(o) }
}

/** the head sphere with the live chin taper, plus `chin` = extra length on the lower half (0 = the live headGeo exactly) */
function headGeo(jaw: number, chin: number) {
  const g = new THREE.SphereGeometry(1, 24, 18), pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); if (y >= 0) continue
    const t = -y, f = 1 - jaw * 0.42 * Math.pow(t, 1.4)
    pos.setXYZ(i, pos.getX(i) * f, y * (1 + jaw * 0.1 + chin), pos.getZ(i) * (1 - jaw * 0.22 * Math.pow(t, 1.4)))
  }
  g.computeVertexNormals(); return g
}
/** where the (tapered) head surface is at face point (x, y), head-local, radii rx = 0.5H, ry = 0.55H */
function surf(H: number, f: Face, x: number, y: number): { z: number; yaw: number; pitch: number } {
  const rx = H * 0.5, ry = H * 0.55
  let yn = y / ry, fx = 1, fz = 1
  if (yn < 0) { yn = y / (ry * (1 + f.jaw * 0.1 + f.chin)); const t = -yn; fx = 1 - f.jaw * 0.42 * Math.pow(t, 1.4); fz = 1 - f.jaw * 0.22 * Math.pow(t, 1.4) }
  const xn = x / (rx * fx), zn = Math.sqrt(Math.max(0.02, 1 - xn * xn - yn * yn))
  return { z: zn * rx * fz, yaw: Math.atan2(xn, zn) * 0.9, pitch: -Math.atan2(yn, zn) * 0.5 }
}

function almond(w: number, h: number, tilt: number, s: number) {
  // inner corner at x=0, outer corner at x=w (mirrored by s), the outer corner lifted by tilt; upper curve fuller than lower
  const sh = new THREE.Shape(), ox = w, oy = Math.tan(tilt) * w
  sh.moveTo(0, 0)
  sh.bezierCurveTo(w * 0.2, h * 0.95, w * 0.7, h * 0.95 + oy * 0.6, ox, oy)
  sh.bezierCurveTo(w * 0.75, -h * 0.55 + oy * 0.4, w * 0.25, -h * 0.6, 0, 0)
  const g = new THREE.ShapeGeometry(sh, 16); g.translate(-w * 0.5, -oy * 0.5, 0); if (s < 0) g.scale(-1, 1, 1); return g
}
function strip(w: number, th: number, arch: number) {   // a curved bar (lid / brow), centred, arching up by `arch` * w
  const sh = new THREE.Shape(), n = 10
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) { const u = i / n, x = (u - 0.5) * w, y = arch * w * (1 - (2 * u - 1) ** 2) * 0.5; pts.push([x, y]) }
  pts.forEach(([x, y], i) => { const tw = th * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.15))); i ? sh.lineTo(x, y + tw * 0.5) : sh.moveTo(x, y + tw * 0.5) })
  for (let i = n; i >= 0; i--) { const [x, y] = pts[i]; const tw = th * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.15))); sh.lineTo(x, y - tw * 0.5) }
  return new THREE.ShapeGeometry(sh)
}

/** a decal on the face: a flat mesh laid on the head surface at (x, y), turned to follow it, lifted dz */
function decal(g: THREE.Object3D, H: number, f: Face, geo: THREE.BufferGeometry, color: string, x: number, y: number, dz: number, rotZ = 0, sx = 1, sy = 1) {
  const s = surf(H, f, x, y), m = new THREE.Mesh(geo, flatM(color))
  m.position.set(x, y, s.z + H * dz); m.rotation.set(s.pitch, s.yaw, rotZ, 'YXZ'); m.scale.set(sx, sy, geo === SPH ? 0.0005 : 1); g.add(m)
}

function protoHead(g: THREE.Group, o: Look, H: number, f: Face) {
  const hair = OPT.hair[o.hair], skin = OPT.skin[o.skin]
  put(g, headGeo(f.jaw, f.chin), skin, [0, 0, 0], [H * 0.5, H * 0.55, H * 0.5])
  if (OPT.ears[o.ears] === 'Pointed') for (const s of [-1, 1]) put(g, EAR, skin, [s * H * 0.49, H * 0.02, -H * 0.02], [H * 0.09, H * 0.2, H * 0.05], [-0.35, 0, s * -0.55])
  else for (const s of [-1, 1]) put(g, SPH, skin, [s * H * 0.5, 0, 0], [H * 0.08, H * 0.12, H * 0.06])
  // ── HAIR v3, copied from keeper-figure.ts unchanged ──
  const hs = OPT.hairStyle[o.hairStyle], R = H * 0.5
  put(g, CAP, hair, [0, H * 0.02, -H * 0.02], [R * 1.05, H * 0.55 * 1.05, R * 1.05], [-0.4, 0, 0], true)
  const centre = new THREE.Vector3(0, 0, 0), DOWN = new THREE.Vector3(0, -1, 0)
  const lock = (a: number, p: number, len: number, wid: number, lift = 0.15, sweep = 0, grav = 0.6) => {
    const n = new THREE.Vector3(Math.sin(p) * Math.sin(a), Math.cos(p), Math.sin(p) * Math.cos(a)).normalize()
    const root = centre.clone().add(new THREE.Vector3(n.x * R * 0.98, n.y * H * 0.55 * 0.98, n.z * R * 0.98))
    const down = new THREE.Vector3(Math.cos(p) * Math.sin(a), -Math.sin(p), Math.cos(p) * Math.cos(a)).normalize()
    const side = new THREE.Vector3().crossVectors(n, down).normalize()
    const dir = down.clone().multiplyScalar(Math.max(0, 1 - grav)).addScaledVector(DOWN, grav).addScaledVector(n, lift).addScaledVector(side, sweep).normalize()
    const z = new THREE.Vector3().crossVectors(side, dir).normalize(), x = new THREE.Vector3().crossVectors(dir, z).normalize()
    const m = new THREE.Mesh(LOCK, toon(hair)); m.matrixAutoUpdate = false
    m.matrix.makeBasis(x.multiplyScalar(wid), dir.multiplyScalar(len), z.multiplyScalar(wid * 0.45)).setPosition(root); g.add(m)
    const o2 = new THREE.Mesh(LOCK, INK); o2.matrixAutoUpdate = false
    o2.matrix.copy(m.matrix).multiply(new THREE.Matrix4().makeScale(1.12, 1.06, 1.25)); g.add(o2)
  }
  const ring = (count: number, p: number, len: number, wid: number, lift: number, sweep = 0, from = -Math.PI, to = Math.PI, jit = 0, grav = 0.6) => {
    for (let i = 0; i < count; i++) { const t = count === 1 ? 0.5 : i / (count - 1), a = from + (to - from) * t, j = jit ? Math.sin(i * 12.9898) * jit : 0; lock(a, p, len * (1 + j), wid, lift, sweep, grav) }
  }
  const back = Math.PI
  const fringe = (n: number, len: number, sweep = 0, grav = 0.75, spread = 0.65, jit = 0) => ring(n, 0.42, len, H * 0.2, 0.12, sweep, -spread, spread, jit, grav)
  if (hs === 'Short')   { ring(10, 0.8, H * 0.3, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(4, H * 0.28) }
  if (hs === 'Tousled') { ring(11, 0.75, H * 0.4, H * 0.22, 0.25, 0, 0.6, 2 * Math.PI - 0.6, 0.3, 0.45); fringe(5, H * 0.38, 0.3, 0.55, 0.7, 0.3); for (const a of [-0.5, 0.4, 2.6]) lock(a, 0.2, H * 0.24, H * 0.14, 0.75, 0.2, 0) }
  if (hs === 'Spiky')   { ring(9, 0.6, H * 0.34, H * 0.18, 0.7, 0, -Math.PI, Math.PI, 0.15, 0); ring(4, 0.22, H * 0.3, H * 0.17, 0.85, 0, -2.4, 2.4, 0, 0) }
  if (hs === 'Swept')   { ring(10, 0.8, H * 0.32, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(5, H * 0.5, 0.9, 0.35, 0.7) }
  if (hs === 'Bob')     { ring(14, 0.95, H * 0.62, H * 0.27, 0.22, 0, 0.95, 2 * Math.PI - 0.95, 0, 0.75); fringe(5, H * 0.32, 0, 0.8, 0.75) }
  if (hs === 'Long')    { ring(14, 0.95, H * 1.15, H * 0.27, 0.2, 0, 1.0, 2 * Math.PI - 1.0, 0.1, 0.85); fringe(5, H * 0.34, 0.2, 0.8, 0.75) }
  if (hs === 'Bun')     { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); put(g, SPH, hair, [0, H * 0.5, -H * 0.24], [H * 0.21, H * 0.21, H * 0.21]) }
  if (hs === 'Tail')    { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); for (const d of [-0.2, 0, 0.2]) lock(back + d, 1.05, H * 0.8, H * 0.17, 0.15, 0, 0.9) }

  // ── FACE (the proto part) ──
  const INKC = '#1c1712', IRIS = '#3b2a1e', LID = '#15100c'
  for (const s of [-1, 1]) {
    const ex = s * H * f.eyeX, ey = H * f.eyeY, w = H * f.eyeW, h = H * f.eyeH
    decal(g, H, f, almond(w, h, f.tilt, s), '#fbf6ee', ex, ey, 0.012)
    const ih = h * f.iris, iw = ih * 0.78
    decal(g, H, f, SPH, IRIS, ex - s * w * 0.04, ey - h * 0.05, 0.02, 0, iw * 0.5, ih * 0.5)
    decal(g, H, f, SPH, '#0d0907', ex - s * w * 0.04, ey - h * 0.05, 0.026, 0, iw * 0.24, ih * 0.27)
    if (f.hi) decal(g, H, f, SPH, '#ffffff', ex - s * w * 0.04 + s * iw * 0.18, ey + ih * 0.15, 0.032, 0, H * 0.014, H * 0.014)
    // upper lid: a tapered bar along the top of the almond, running past the outer corner by `wing`
    const lw = w * 1.06 + H * f.wing
    decal(g, H, f, strip(lw, H * f.lid, 0.22), LID, ex + s * H * f.wing * 0.5, ey + h * 0.45 + Math.tan(f.tilt) * s * 0 , 0.036, s * f.tilt * 1.2)
    if (f.lower) decal(g, H, f, strip(w * 0.6, H * f.lower, -0.12), '#5a3a2a', ex + s * w * 0.12, ey - h * 0.42, 0.03, s * f.tilt * 0.5)
    // brows: hair coloured, tilt > 0 = outer end up
    decal(g, H, f, strip(H * f.brow.w, H * f.brow.th, f.brow.arch), hair, s * H * (f.eyeX + 0.01), ey + H * f.brow.y, 0.04, s * f.brow.tilt)
    decal(g, H, f, strip(H * f.brow.w * 1.06, H * f.brow.th * 1.5, f.brow.arch), INKC, s * H * (f.eyeX + 0.01), ey + H * f.brow.y, 0.038, s * f.brow.tilt)
  }
  const shade = '#b97f5c'
  if (f.nose === 'dot') decal(g, H, f, SPH, shade, 0, -H * 0.09, 0.02, 0, H * 0.022, H * 0.016)
  if (f.nose === 'wedge') { const t = new THREE.Shape(); t.moveTo(0, H * 0.04); t.lineTo(H * 0.03, -H * 0.02); t.lineTo(-H * 0.005, -H * 0.025); t.closePath(); decal(g, H, f, new THREE.ShapeGeometry(t), shade, H * 0.01, -H * 0.085, 0.02) }
  if (f.nose === 'bridge') { decal(g, H, f, strip(H * 0.1, H * 0.012, 0), shade, H * 0.02, -H * 0.05, 0.02, Math.PI / 2 - 0.15); decal(g, H, f, strip(H * 0.045, H * 0.014, -0.4), shade, H * 0.005, -H * 0.105, 0.02) }
  const my = H * f.mouthY, mw = H * f.mouthW
  if (f.mouth === 'line') decal(g, H, f, strip(mw, H * 0.016, -0.05), '#5a2f26', 0, my, 0.02)
  if (f.mouth === 'soft') decal(g, H, f, strip(mw, H * 0.016, -0.25), '#5a2f26', 0, my, 0.02)
  if (f.mouth === 'smirk') decal(g, H, f, strip(mw, H * 0.016, -0.3), '#5a2f26', H * 0.01, my, 0.02, 0.12)
  drawMouth(g, H, f, skin)
}
/** lip colour: the skin pulled toward a muted rose (works on light and dark skin) */
const lipOf = (skin: string, k: number) => '#' + new THREE.Color(skin).lerp(new THREE.Color('#8a3a34'), k).getHexString()
function drawMouth(g: THREE.Group, H: number, f: Face, skin: string) {
  const my = H * f.mouthY, mw = H * 0.1, LINE = '#4a2620'
  if (f.mouth === 'M1') decal(g, H, f, strip(mw * 0.95, H * 0.017, -0.03), LINE, 0, my, 0.02)
  if (f.mouth === 'M2') { decal(g, H, f, strip(mw, H * 0.017, -0.22), LINE, 0, my, 0.02); for (const s of [-1, 1]) decal(g, H, f, strip(H * 0.022, H * 0.01, -0.5), LINE, s * mw * 0.55, my + H * 0.006, 0.02, s * 0.9) }
  if (f.mouth === 'M3') {   // a small closed mouth with an upper + fuller lower lip in a tint of the skin, ink line between
    const up = new THREE.Shape(), w = mw * 0.55, h = H * 0.022
    up.moveTo(-w, 0); up.bezierCurveTo(-w * 0.6, h * 0.6, -w * 0.25, h * 1.1, 0, h * 0.7); up.bezierCurveTo(w * 0.25, h * 1.1, w * 0.6, h * 0.6, w, 0); up.lineTo(-w, 0)
    decal(g, H, f, new THREE.ShapeGeometry(up, 8), lipOf(skin, 0.45), 0, my, 0.018)
    decal(g, H, f, SPH, lipOf(skin, 0.35), 0, my - H * 0.016, 0.018, 0, w * 0.8, H * 0.017)
    decal(g, H, f, strip(w * 2.05, H * 0.011, -0.06), LINE, 0, my, 0.022)
  }
  if (f.mouth === 'M4') { decal(g, H, f, strip(mw * 0.9, H * 0.017, -0.12), LINE, H * 0.006, my, 0.02, 0.14); decal(g, H, f, strip(H * 0.026, H * 0.01, -0.5), LINE, mw * 0.5, my + H * 0.014, 0.02, 0.9) }
  if (f.mouth === 'M5') { decal(g, H, f, strip(mw * 0.7, H * 0.014, -0.1), LINE, 0, my, 0.02); decal(g, H, f, strip(mw * 0.42, H * 0.012, -0.25), lipOf(skin, 0.3), 0, my - H * 0.03, 0.018) }
}

/** A keeper on today's body. face null = TODAY (the live builder, per-model head size); else the universal head + face f. */
export function protoKeeper(o: Look, f: Face | null, universal = f !== null, over?: Proportions): THREE.Group {
  const p = over ? { ...over } : { ...proportionsFor(o) }
  if (universal) Object.assign(p, UNIVERSAL)
  if (f) p.jaw = f.jaw
  const k = buildKeeper(o, p)
  if (!f) return k.group
  const head = k.group.getObjectByName('head') as THREE.Group
  head.clear(); protoHead(head, o, 0.5 * 1.15, f)
  // the head centre rides on headH; a longer chin is absorbed by lifting it so the neck gap stays today's
  head.position.y += 0.575 * 0.55 * f.chin * p.headH * 0.6
  return k.group
}
