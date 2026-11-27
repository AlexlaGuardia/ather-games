// THE KEEPER'S BODY (BETA M29): the signed-off mock's keeper() + headAndFace() (docs/looks/keeper-creator.html, HAIR v3,
// floating limbs for every keeper) ported to a builder the game can use: the creator's preview, the Character doll, the
// third-person body and (slice 3) a remote keeper. The cartoon rig: 1:3, cel shading (a 3-step toon ramp), an ink hull.
// ★ ORIGIN AT THE FEET (the mock centred the figure for its stage); parts are NAMED (hand-l/-r, foot-l/-r, head, body) so a
// caller can move them. Materials are shared by colour across every figure built (a crowd of keepers costs no extra programs).
import * as THREE from 'three'
import { OPT, type Look } from './keeper-look'
import { proportionsFor, type Proportions } from './keeper-proportions'
import { faceSet, headShapeGeo, drawFaceSet, surf, type HeadShape } from './keeper-faces'
import { cartoonHead, drawCartoonFace } from './keeper-heads'
import { torsoGeo, drawScarf, drawBelt, apronGeo } from './keeper-bodies'
import type { CartoonHead } from './keeper-heads'

/** BETA M154: a NAMED keeper's own dress over a Look (Bonn, Otto, Tess: friend-looks.ts). Exact colours off the card (the
 *  creator's palette has no sandy-copper) and a few SHAPE-only extras the locked looks need. ★ Never a size or a place: every
 *  extra is a shape scaled by the head / torso it sits on, and the dials move it with them (keeper-one-source.test.ts 8). */
export type HairShape = typeof OPT.hairStyle[number] | CartoonHead['hair'] | 'Coily'
export interface KeeperDress {
  skin?: string; hair?: string; iris?: string; top?: string; hand?: string; foot?: string; belt?: string
  /** a colour, or null = no scarf at all (Bonn's open neck) */
  scarf?: string | null
  /** a lock set over the head's own (Coily = Bonn's big coily hair) */
  hairStyle?: HairShape
  /** a hood over the head, open at the face, this colour (Tess) */
  hood?: string
  /** goggles pushed up on the brow (Otto) */
  goggles?: boolean
  /** a work apron over the torso's front, this colour (Otto) */
  apron?: string
}

const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t
})()
const SPH = new THREE.SphereGeometry(1, 20, 14), BOX = new THREE.BoxGeometry(1, 1, 1)
const LOCK = new THREE.LatheGeometry([[0, 0], [0.5, 0.05], [0.55, 0.22], [0.45, 0.5], [0.25, 0.78], [0.08, 0.95], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
const CAP = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)
/** M154: a hood = a sphere shell with the face's opening cut out of its front (+z is phi = PI / 2 in three's sphere) */
const HOOD = new THREE.SphereGeometry(1, 24, 14, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.88)
/** a pointed ear: a petal (round at the root, a tip at the top); shared with the NPC rig (folk-model.tsx) */
export const EAR = new THREE.LatheGeometry([[0, -0.5], [0.45, -0.38], [0.5, -0.1], [0.36, 0.2], [0.14, 0.42], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
/** M103 chin taper + M216 chin length: ONE head geometry for every face, from the dials only (0 + 0 = the plain sphere SPH) */
const headGeo = (p: HeadShape) => headShapeGeo(p.jaw, p.chin, SPH)
const ARCS = new Map<string, THREE.TorusGeometry>()
const arcGeo = (thick: number, span: number) => { const k = `${thick}|${span.toFixed(4)}`; let g = ARCS.get(k); if (!g) { g = new THREE.TorusGeometry(1, thick, 6, 18, span); ARCS.set(k, g) } return g }

const INK = new THREE.MeshBasicMaterial({ color: 0x1b140e, side: THREE.BackSide })
const TOON = new Map<string, THREE.MeshToonMaterial>(), FLAT = new Map<string, THREE.MeshBasicMaterial>()
const toon = (c: string) => { let m = TOON.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }); TOON.set(c, m) } return m }
const flatM = (c: string) => { let m = FLAT.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); FLAT.set(c, m) } return m }

type V3 = [number, number, number]
function put(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3, scale: V3, rot?: V3 | null, ink = true, name?: string) {
  const host = name ? new THREE.Group() : g
  if (name) { host.name = name; host.position.set(...pos); g.add(host) }
  const m = new THREE.Mesh(geo, toon(color))
  if (!name) m.position.set(...pos)
  m.scale.set(...scale); if (rot) m.rotation.set(...rot); host.add(m)
  if (ink) { const o = new THREE.Mesh(geo, INK); o.position.copy(m.position); o.scale.copy(m.scale).multiplyScalar(1.07); o.rotation.copy(m.rotation); host.add(o) }
  return host
}
function flat(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3, scale: V3, rot?: V3) {
  const m = new THREE.Mesh(geo, flatM(color)); m.position.set(...pos); m.scale.set(...scale); if (rot) m.rotation.set(...rot); g.add(m)
}

export interface KeeperBody { group: THREE.Group; height: number; headY: number }

/** Build a keeper. The group's origin is between the feet; `height` is the crown, `headY` the head's centre. */
export function buildKeeper(o: Look, p0: Proportions = proportionsFor(o), dress: KeeperDress = {}): KeeperBody {
  const g = new THREE.Group()
  // M216: every face (Classic or a set) is sized and shaped by the model's dials ONLY: a set brings eyes + brows, never a size
  const p = p0
  const wide = [0.88, 1, 1.16][o.frame] ?? 1, tall = [0.9, 1, 1.1][o.frame] ?? 1
  const H = 0.5, B = 0.62 * tall, L = 0.55 * tall
  const skin = dress.skin ?? OPT.skin[o.skin], hair = dress.hair ?? OPT.hair[o.hair], top = dress.top ?? OPT.topColor[o.topColor], acc = OPT.accent[o.accent]
  const sc = dress.scarf === undefined ? OPT.scarf[o.scarf] : dress.scarf, handC = dress.hand ?? acc, footC = dress.foot ?? acc
  // FLOATING LIMBS (Alex's doodle 11-18): an inverted-egg torso with no arms, a scarf over the shoulders with a tail down
  // one side, mitten hands hovering out at hip height, flat pebble feet well below, a big round head floating above.
  // M103: every term below is today's body times a dial at 1 (or plus a dial at 0), so the defaults change nothing
  const tw = wide * p.torsoW, base = L * 0.62 * p.legs, TB = B * 1.08 * p.torsoL, topY = base + TB, Hf = H * 1.15, sf = p.scarf
  const body = new THREE.Group(); body.name = 'body'; g.add(body)
  // M216 s2b: the torso is one of the six locked shapes (keeper-bodies.ts), a unit outline sized here by the dials only
  put(body, torsoGeo(o.torso), top, [0, base, 0], [tw, TB, wide * 0.8 * p.torsoD])
  if (dress.apron) put(body, apronGeo(o.torso), dress.apron, [0, base, 0], [tw, TB, wide * 0.8 * p.torsoD], null, true, 'apron')
  for (const s of [-1, 1] as const) {
    put(g, SPH, handC, [s * (0.29 * tw + 0.09 + p.handX), base + TB * 0.32 + p.handY, 0.03 + p.handZ], [0.075 * p.hand, 0.1 * p.hand, 0.06 * p.hand], [0, 0, -s * 0.25], true, s < 0 ? 'hand-r' : 'hand-l')
    put(g, SPH, footC, [s * (0.17 * wide + p.footX), 0.045 * p.foot, 0.06], [0.11 * p.foot, 0.045 * p.foot, 0.15 * p.foot], [0, s * 0.25, 0], true, s < 0 ? 'foot-r' : 'foot-l')
  }
  // M216 s2b: the scarf shape (Scarf shape row) + the belt (Belt row), each sized and placed by the dials (keeper-bodies.ts)
  if (sc) drawScarf(body, put, o.scarfStyle, sc, topY, tw, sf)
  drawBelt(body, put, o.torso, o.belt, dress.belt ?? acc, base, TB, tw, wide * 0.8 * p.torsoD, p)
  // a longer chin (the Chin length dial) is absorbed by lifting the head, so the neck gap stays the model's
  const hy = topY + Hf * 0.5 * p.headH + 0.07 + p.neck + Hf * 0.55 * p.chin * p.headH * 0.6
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, hy, 0); g.add(head)
  // head width / height scale the head group, so hair + face + ears keep their places on it
  if (p.headW !== 1 || p.headH !== 1) head.scale.set(p.headW, p.headH, p.headW)
  headAndFace(head, o, Hf, hair, skin, p, dress)
  return { group: g, height: hy + Hf * 0.6 * p.headH, headY: hy }
}

/** The head + hair v3 + face, built round (0,0,0) = the head's centre (the mock's hy, moved onto the head group). */
function headAndFace(g: THREE.Group, o: Look, H: number, hair: string, skin: string, p: Proportions, dress: KeeperDress = {}) {
  const hy = 0, ea = p.ear, ei = p.eye
  const ch = cartoonHead(o.head)   // M216 s2a: a cartoon head draws its own eyes / brows / mouth / hair shape (keeper-heads.ts)
  const fs = ch ? null : faceSet(o.face)
  const r2 = (v: number) => Math.round(v * 100) / 100, shape: HeadShape = { jaw: r2(p.jaw), chin: r2(p.chin) }   // the geometry's rounding
  put(g, headGeo(shape), skin, [0, hy, 0], [H * 0.5, H * 0.55, H * 0.5])
  // the nose + Mouth row sit on the round head's front; dz = how far the tapered / longer head's front moved there (0 at 0 + 0)
  const dz = (y: number) => surf(H, shape, 0, y).z - surf(H, { jaw: 0, chin: 0 }, 0, y).z
  // the ears: Round = the mock's small round ones; Pointed (canon's default, Magii 11-19) = a small leaf tipped up and back
  if (OPT.ears[o.ears] === 'Pointed') for (const s of [-1, 1]) put(g, EAR, skin, [s * H * 0.49, hy + H * 0.02, -H * 0.02], [H * 0.09 * ea, H * 0.2 * ea, H * 0.05 * ea], [-0.35, 0, s * -0.55])
  else for (const s of [-1, 1]) put(g, SPH, skin, [s * H * 0.5, hy, 0], [H * 0.08 * ea, H * 0.12 * ea, H * 0.06 * ea])
  // ── HAIR v3 (Alex 11-19: the cap + blobs read bald / helmet-like): LOCKS, tapered petals rooted on the scalp, standing a
  //    little proud so the outline breaks; a small cap underneath fills the gaps. A style = which locks.
  const hs: HairShape | 'Hooded' = dress.hood ? 'Hooded' : dress.hairStyle ?? (ch ? ch.hair : OPT.hairStyle[o.hairStyle]), R = H * 0.5
  // M225: every hair piece (cap + locks, every style) rides ONE group the Hair size / height / forward dials move (1 / 0 / 0 = as before)
  const hg = new THREE.Group(); hg.name = 'hair'; g.add(hg)
  if (p.hairSize !== 1) hg.scale.setScalar(p.hairSize)
  if (p.hairY || p.hairZ) hg.position.set(0, p.hairY, p.hairZ)
  put(hg, CAP, hair, [0, hy + H * 0.02, -H * 0.02], [R * 1.05, H * 0.55 * 1.05, R * 1.05], [-0.4, 0, 0], true)
  const centre = new THREE.Vector3(0, hy, 0), DOWN = new THREE.Vector3(0, -1, 0)
  const lock = (a: number, p: number, len: number, wid: number, lift = 0.15, sweep = 0, grav = 0.6) => {
    const n = new THREE.Vector3(Math.sin(p) * Math.sin(a), Math.cos(p), Math.sin(p) * Math.cos(a)).normalize()
    const root = centre.clone().add(new THREE.Vector3(n.x * R * 0.98, n.y * H * 0.55 * 0.98, n.z * R * 0.98))
    const down = new THREE.Vector3(Math.cos(p) * Math.sin(a), -Math.sin(p), Math.cos(p) * Math.cos(a)).normalize()
    const side = new THREE.Vector3().crossVectors(n, down).normalize()
    const dir = down.clone().multiplyScalar(Math.max(0, 1 - grav)).addScaledVector(DOWN, grav).addScaledVector(n, lift).addScaledVector(side, sweep).normalize()
    const z = new THREE.Vector3().crossVectors(side, dir).normalize(), x = new THREE.Vector3().crossVectors(dir, z).normalize()
    const m = new THREE.Mesh(LOCK, toon(hair)); m.matrixAutoUpdate = false
    m.matrix.makeBasis(x.multiplyScalar(wid), dir.multiplyScalar(len), z.multiplyScalar(wid * 0.45)).setPosition(root); hg.add(m)
    const o2 = new THREE.Mesh(LOCK, INK); o2.matrixAutoUpdate = false
    o2.matrix.copy(m.matrix).multiply(new THREE.Matrix4().makeScale(1.12, 1.06, 1.25)); hg.add(o2)
  }
  const ring = (count: number, p: number, len: number, wid: number, lift: number, sweep = 0, from = -Math.PI, to = Math.PI, jit = 0, grav = 0.6) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1), a = from + (to - from) * t, j = jit ? Math.sin(i * 12.9898) * jit : 0
      lock(a, p, len * (1 + j), wid, lift, sweep, grav)
    }
  }
  const back = Math.PI
  const fringe = (n: number, len: number, sweep = 0, grav = 0.75, spread = 0.65, jit = 0) => ring(n, 0.42, len, H * 0.2, 0.12, sweep, -spread, spread, jit, grav)
  if (hs === 'Short')   { ring(10, 0.8, H * 0.3, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(4, H * 0.28) }
  if (hs === 'Tousled') { ring(11, 0.75, H * 0.4, H * 0.22, 0.25, 0, 0.6, 2 * Math.PI - 0.6, 0.3, 0.45); fringe(5, H * 0.38, 0.3, 0.55, 0.7, 0.3); for (const a of [-0.5, 0.4, 2.6]) lock(a, 0.2, H * 0.24, H * 0.14, 0.75, 0.2, 0) }
  if (hs === 'Spiky')   { ring(9, 0.6, H * 0.34, H * 0.18, 0.7, 0, -Math.PI, Math.PI, 0.15, 0); ring(4, 0.22, H * 0.3, H * 0.17, 0.85, 0, -2.4, 2.4, 0, 0) }
  if (hs === 'Swept')   { ring(10, 0.8, H * 0.32, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(5, H * 0.5, 0.9, 0.35, 0.7) }
  if (hs === 'Bob')     { ring(14, 0.95, H * 0.62, H * 0.27, 0.22, 0, 0.95, 2 * Math.PI - 0.95, 0, 0.75); fringe(5, H * 0.32, 0, 0.8, 0.75) }
  if (hs === 'Long')    { ring(14, 0.95, H * 1.15, H * 0.27, 0.2, 0, 1.0, 2 * Math.PI - 1.0, 0.1, 0.85); fringe(5, H * 0.34, 0.2, 0.8, 0.75) }
  if (hs === 'Bun')     { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); put(hg, SPH, hair, [0, hy + H * 0.5, -H * 0.24], [H * 0.21, H * 0.21, H * 0.21]) }
  // M216 s2a: the cartoon heads' hair (sheet NOTES.md, column A-D x male / female), chunky locks like every style above
  if (hs === 'A-M') { ring(10, 0.85, H * 0.3, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); ring(5, 0.35, H * 0.44, H * 0.17, 0.9, 0.35, -1.3, 1.3, 0.15, 0); fringe(4, H * 0.3, 0.25, 0.75) }
  if (hs === 'A-F') { ring(12, 0.95, H * 1.1, H * 0.26, 0.2, 0, 1.0, 2 * Math.PI - 1.0, 0.1, 0.85); for (const s of [-1, 1]) lock(s * 0.95, 0.9, H * 1.2, H * 0.2, 0.1, 0, 0.95); fringe(4, H * 0.36, 0.6, 0.6, 0.6); for (const a of [-0.2, 0.25]) lock(a, 0.15, H * 0.3, H * 0.13, 0.9, 0, 0) }
  if (hs === 'B-M') { ring(10, 0.8, H * 0.3, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(5, H * 0.42, 0.9, 0.4, 0.7); ring(3, 0.5, H * 0.42, H * 0.15, 0.85, 0.3, 2.3, 4.0, 0.1, 0); lock(0.3, 0.2, H * 0.34, H * 0.15, 0.85, 0.4, 0) }
  if (hs === 'B-F') { ring(14, 0.95, H * 1.15, H * 0.27, 0.2, 0, 1.0, 2 * Math.PI - 1.0, 0.1, 0.85); fringe(5, H * 0.5, 0.9, 0.4, 0.7); for (const s of [-1, 1]) lock(s * 0.9, 0.95, H * 1.1, H * 0.2, 0.1, 0, 0.9) }
  if (hs === 'C-M') { ring(10, 0.85, H * 0.22, H * 0.22, 0.08, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); ring(7, 0.4, H * 0.34, H * 0.15, 1.0, 0, -1.4, 1.4, 0, 0); fringe(3, H * 0.2, 0, 0.8, 0.5) }
  if (hs === 'C-F') { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(4, H * 0.28, 0.5, 0.7, 0.55); for (const s of [-1, 1]) lock(s * 0.85, 0.9, H * 0.7, H * 0.16, 0.1, 0, 0.9); put(hg, SPH, hair, [H * 0.2, hy + H * 0.48, -H * 0.12], [H * 0.13, H * 0.13, H * 0.13]); for (const d of [-0.15, 0, 0.15]) lock(1.9 + d, 0.6, H * 0.95, H * 0.18, 0.9, 0.3, 0.35) }
  if (hs === 'D-M') { ring(11, 0.75, H * 0.38, H * 0.22, 0.25, 0, 0.6, 2 * Math.PI - 0.6, 0.3, 0.45); for (const a of [-0.4, 0.5]) lock(a, 0.15, H * 0.3, H * 0.14, 0.85, 0.2, 0); fringe(4, H * 0.32, 0.2, 0.6, 0.6, 0.2); for (const s of [-1, 1]) lock(s * 1.15, 0.8, H * 0.8, H * 0.08, 0.7, s * 0.5, 0.3) }
  if (hs === 'D-F') { ring(14, 0.95, H * 0.62, H * 0.27, 0.22, 0, 0.95, 2 * Math.PI - 0.95, 0, 0.75); fringe(6, H * 0.3, 0, 0.85, 0.8); for (const s of [-1, 1]) lock(s * 0.95, 0.95, H * 0.72, H * 0.18, 0.1, 0, 0.9) }
  // M154: Bonn's big coily hair: a full round cloud well past the head, short curls standing out all over it, the face clear
  if (hs === 'Coily')   { put(hg, SPH, hair, [0, hy + H * 0.1, -H * 0.24], [R * 1.42, H * 0.55 * 1.2, R * 1.12]); for (const [n, ph, len] of [[18, 1.45, 0.3], [16, 1.05, 0.32], [12, 0.62, 0.3], [6, 0.25, 0.28]] as const) ring(n, ph, H * len, H * 0.24, 1, 0, ph > 1 ? 1.25 : ph > 0.5 ? 0.9 : -Math.PI, ph > 1 ? 2 * Math.PI - 1.25 : ph > 0.5 ? 2 * Math.PI - 0.9 : Math.PI, 0.25, 0) }
  // M154: under a hood only the face-framing hair shows: a short fringe + a lock down each cheek (Tess, the sheet's bob)
  if (hs === 'Hooded')  { fringe(5, H * 0.3, 0, 0.85, 0.7); for (const s of [-1, 1]) lock(s * 0.85, 0.95, H * 0.5, H * 0.2, 0.05, 0, 0.9) }
  if (hs === 'Tail')    { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); for (const d of [-0.2, 0, 0.2]) lock(back + d, 1.05, H * 0.8, H * 0.17, 0.15, 0, 0.9) }

  // ── FACE ──
  const INKC = '#1c1712', ey = hy + H * 0.02 + p.eyeLift, ez = H * 0.47, eyes = OPT.eyes[o.eyes]
  const arc = (x: number, y: number, r: number, thick: number, span: number, rotZ: number, color = INKC) => flat(g, arcGeo(thick, span), color, [x, y, ez + H * 0.03], [r, r, r], [0, 0, rotZ])
  const ball = (x: number, y: number, sx: number, sy: number, color = INKC, dz = 0.03) => flat(g, SPH, color, [x, y, ez + H * dz], [sx, sy, H * 0.03])
  const tag = (from: number, face: string) => { for (const c of g.children.slice(from)) c.userData.face ??= face }
  const f0 = g.children.length
  if (ch) drawCartoonFace(g, o.head, H, hair, skin, true, shape, { eye: ei, gap: p.eyeGap, y: p.eyeLift }, p.mouthLift, dress.iris)
  tag(f0, 'cartoon')
  // M154: Tess's hood (a shell round the head, open at the face, its point at the back) + Otto's goggles up on the brow
  if (dress.hood) { const hood = put(g, HOOD, dress.hood, [0, hy + H * 0.04, -H * 0.03], [R * 1.22, H * 0.55 * 1.2, R * 1.22], [-0.25, 0, 0], true, 'hood'); put(hood, LOCK, dress.hood, [0, H * 0.42, -H * 0.42], [H * 0.3, H * 0.34, H * 0.22], [-2.0, 0, 0]) }
  // M227 (Alex 11-27 "bonn and tess have a second set of eyes"): the goggles are dress, NOT a face: they used to sit in this
  // face chain, so a goggled keeper skipped the classic eyes while a cartoon head without goggles (Bonn, Tess) drew its own
  // eyes AND the classic ones. ONE face source per head now; head.userData.faces = the sources that really drew eye meshes
  // (each source's meshes are tagged userData.face as they are added; the unit test + prod check read it).
  if (dress.goggles) { const gg = new THREE.Group(); gg.name = 'goggles'; g.add(gg); put(gg, arcGeo(0.06, Math.PI * 2), '#54321f', [0, hy + H * 0.3, 0], [R * 1.04, R * 1.04, R * 1.04], [Math.PI / 2 - 0.35, 0, 0], false); for (const s of [-1, 1]) { put(gg, arcGeo(0.32, Math.PI * 2), '#9c8a5a', [s * H * 0.15, hy + H * 0.36, H * 0.42], [H * 0.1, H * 0.1, H * 0.1], [-0.55, 0, 0]); flat(gg, SPH, '#8fb6c4', [s * H * 0.15, hy + H * 0.36, H * 0.42], [H * 0.08, H * 0.08, H * 0.02], [-0.55, 0, 0]) } }
  const f1 = g.children.length
  if (ch) { /* the cartoon face above is the whole face */ }
  else if (fs) drawFaceSet(g, o.face, H, hair, OPT.brows[o.brows] !== 'None', shape, { eye: ei, gap: p.eyeGap, y: p.eyeLift })
  else for (const s of [-1, 1]) {
    const ex = s * (H * 0.17 + p.eyeGap)
    const kind = eyes === 'Wink' ? (s < 0 ? 'Round' : 'Happy') : eyes
    if (kind === 'Lines') flat(g, BOX, INKC, [ex * 0.8, ey + H * 0.03, ez + H * 0.02], [H * 0.035 * ei, H * 0.16 * ei, H * 0.02])
    else if (kind === 'Dots') ball(ex * 0.85, ey + H * 0.02, H * 0.045 * ei, H * 0.05 * ei)
    else if (kind === 'Sleepy') { flat(g, BOX, INKC, [ex, ey, ez + H * 0.02], [H * 0.13, H * 0.025, H * 0.02]); arc(ex, ey - H * 0.01, H * 0.065, 0.2, Math.PI, Math.PI) }
    else if (kind === 'Happy') arc(ex, ey - H * 0.03, H * 0.07, 0.22, Math.PI, 0)
    else {
      const big = (kind === 'Bright' ? 1.2 : kind === 'Wide' ? 1.3 : 1) * ei, pupil = kind === 'Wide' ? 0.55 : 1
      ball(ex, ey, H * 0.11 * big, H * 0.14 * big, '#ffffff', -0.02)
      ball(ex, ey - H * 0.01, H * 0.065 * big * pupil, H * 0.09 * big * pupil)
      if (kind === 'Bright') ball(ex + H * 0.02, ey + H * 0.03, H * 0.02, H * 0.02, '#ffffff', 0.06)
    }
    const brows = OPT.brows[o.brows]
    if (brows !== 'None') flat(g, BOX, hair, [ex, ey + H * 0.18, ez + H * 0.02], [H * 0.16, H * (brows === 'Bold' ? 0.045 : 0.025), H * 0.02], [0, 0, s * 0.08])
  }
  tag(f1, fs ? 'set' : 'classic')
  g.userData.faces = [...new Set(g.children.map(c => c.userData.face).filter(Boolean))]
  if (ch) return   // a cartoon head: NO nose (the locked sheet), its own mouth already drawn (drawCartoonFace)
  put(g, SPH, '#d9a47c', [0, hy - H * 0.08, H * 0.5 + dz(hy - H * 0.08)], [H * 0.05, H * 0.05, H * 0.05], null, false)
  const m0 = g.children.length   // M116c: the Mouth row's meshes are tagged userData.mouth (the body bench swaps them)
  const my = hy - H * 0.17 + p.mouthLift, mouth = OPT.mouth[o.mouth]
  if (mouth === 'Smile') arc(H * 0.06, my + H * 0.01, H * 0.09, 0.18, Math.PI * 0.7, Math.PI * 1.15)
  if (mouth === 'Grin') { ball(0, my - H * 0.01, H * 0.11, H * 0.05, '#ffffff', 0.0); arc(0, my + H * 0.02, H * 0.12, 0.16, Math.PI, Math.PI) }
  if (mouth === 'Smirk') arc(H * 0.08, my + H * 0.02, H * 0.08, 0.18, Math.PI * 0.45, Math.PI * 1.35)
  if (mouth === 'Flat') flat(g, BOX, INKC, [0, my, ez + H * 0.03], [H * 0.12, H * 0.022, H * 0.02])
  if (mouth === 'Open') ball(0, my - H * 0.01, H * 0.045, H * 0.06, '#5a2a22')
  if (mouth === 'Cat') for (const s of [-1, 1]) arc(s * H * 0.04, my + H * 0.015, H * 0.04, 0.22, Math.PI, Math.PI)
  const mz = dz(my)
  for (const c of g.children.slice(m0)) { c.userData.mouth = true; if (mz) c.position.z += mz }
}

/** Idle float for the limbs: the hands bob and drift, the head bobs a touch; `walk` 0..1 swings the hands and lifts the feet.
 *  Rest positions are read once from the built figure (userData.rest). Mutates the group's named parts. */
export function poseKeeper(k: KeeperBody, t: number, walk = 0) {
  const g = k.group
  for (const name of ['hand-l', 'hand-r', 'foot-l', 'foot-r', 'head']) {
    const p = g.getObjectByName(name); if (!p) continue
    const rest = (p.userData.rest ??= p.position.clone()) as THREE.Vector3
    const s = name.endsWith('-l') ? 1 : -1
    if (name.startsWith('hand')) p.position.set(rest.x, rest.y + Math.sin(t * 1.6 + s) * 0.025, rest.z + Math.sin(t * 7 * walk + (s > 0 ? 0 : Math.PI)) * 0.14 * walk)
    else if (name.startsWith('foot')) p.position.set(rest.x, rest.y + Math.max(0, Math.sin(t * 7 * walk + (s > 0 ? Math.PI : 0))) * 0.08 * walk, rest.z + Math.sin(t * 7 * walk + (s > 0 ? Math.PI : 0)) * 0.12 * walk)
    else p.position.set(rest.x, rest.y + Math.sin(t * 1.3) * 0.015, rest.z)
  }
}
