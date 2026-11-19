// THE KEEPER'S BODY (BETA M29): the signed-off mock's keeper() + headAndFace() (docs/looks/keeper-creator.html, HAIR v3,
// floating limbs for every keeper) ported to a builder the game can use: the creator's preview, the Character doll, the
// third-person body and (slice 3) a remote keeper. The cartoon rig: 1:3, cel shading (a 3-step toon ramp), an ink hull.
// ★ ORIGIN AT THE FEET (the mock centred the figure for its stage); parts are NAMED (hand-l/-r, foot-l/-r, head, body) so a
// caller can move them. Materials are shared by colour across every figure built (a crowd of keepers costs no extra programs).
import * as THREE from 'three'
import { OPT, type Look } from './keeper-look'

const grad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t
})()
const SPH = new THREE.SphereGeometry(1, 20, 14), BOX = new THREE.BoxGeometry(1, 1, 1)
const LOCK = new THREE.LatheGeometry([[0, 0], [0.5, 0.05], [0.55, 0.22], [0.45, 0.5], [0.25, 0.78], [0.08, 0.95], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
const CAP = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)
/** a pointed ear: a petal (round at the root, a tip at the top); shared with the NPC rig (folk-model.tsx) */
export const EAR = new THREE.LatheGeometry([[0, -0.5], [0.45, -0.38], [0.5, -0.1], [0.36, 0.2], [0.14, 0.42], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
const SCARF_RING = new THREE.TorusGeometry(1, 0.45, 10, 24)
const EGG = [
  [[0, 0], [0.07, 0.03], [0.13, 0.15], [0.19, 0.42], [0.24, 0.74], [0.22, 0.92], [0.12, 1]],   // Broad
  [[0, 0], [0.16, 0.06], [0.2, 0.25], [0.17, 0.52], [0.19, 0.76], [0.18, 0.92], [0.09, 1]],    // Curved
].map(pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24))
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
export function buildKeeper(o: Look): KeeperBody {
  const g = new THREE.Group()
  const wide = [0.88, 1, 1.16][o.frame] ?? 1, tall = [0.9, 1, 1.1][o.frame] ?? 1
  const H = 0.5, B = 0.62 * tall, L = 0.55 * tall
  const skin = OPT.skin[o.skin], hair = OPT.hair[o.hair], top = OPT.topColor[o.topColor], acc = OPT.accent[o.accent], sc = OPT.scarf[o.scarf]
  // FLOATING LIMBS (Alex's doodle 11-18): an inverted-egg torso with no arms, a scarf over the shoulders with a tail down
  // one side, mitten hands hovering out at hip height, flat pebble feet well below, a big round head floating above.
  const base = L * 0.62, TB = B * 1.08, topY = base + TB, Hf = H * 1.15
  const body = new THREE.Group(); body.name = 'body'; g.add(body)
  put(body, EGG[o.torso] ?? EGG[0], top, [0, base, 0], [wide, TB, wide * 0.8])
  for (const s of [-1, 1] as const) {
    put(g, SPH, acc, [s * (0.29 * wide + 0.09), base + TB * 0.32, 0.03], [0.075, 0.1, 0.06], [0, 0, -s * 0.25], true, s < 0 ? 'hand-r' : 'hand-l')
    put(g, SPH, acc, [s * 0.17 * wide, 0.045, 0.06], [0.11, 0.045, 0.15], [0, s * 0.25, 0], true, s < 0 ? 'foot-r' : 'foot-l')
  }
  put(body, SCARF_RING, sc, [0, topY - 0.03, 0], [0.17 * wide, 0.17 * wide, 0.16], [Math.PI / 2, 0, 0])
  put(body, BOX, sc, [0.15 * wide, topY - 0.24, 0.15 * wide], [0.09, 0.38, 0.035], [0.12, 0, 0.42])
  const hy = topY + Hf * 0.5 + 0.07
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, hy, 0); g.add(head)
  headAndFace(head, o, Hf, hair, skin)
  return { group: g, height: hy + Hf * 0.6, headY: hy }
}

/** The head + hair v3 + face, built round (0,0,0) = the head's centre (the mock's hy, moved onto the head group). */
function headAndFace(g: THREE.Group, o: Look, H: number, hair: string, skin: string) {
  const hy = 0
  put(g, SPH, skin, [0, hy, 0], [H * 0.5, H * 0.55, H * 0.5])
  // the ears: Round = the mock's small round ones; Pointed (canon's default, Magii 11-19) = a small leaf tipped up and back
  if (OPT.ears[o.ears] === 'Pointed') for (const s of [-1, 1]) put(g, EAR, skin, [s * H * 0.49, hy + H * 0.02, -H * 0.02], [H * 0.09, H * 0.2, H * 0.05], [-0.35, 0, s * -0.55])
  else for (const s of [-1, 1]) put(g, SPH, skin, [s * H * 0.5, hy, 0], [H * 0.08, H * 0.12, H * 0.06])
  // ── HAIR v3 (Alex 11-19: the cap + blobs read bald / helmet-like): LOCKS, tapered petals rooted on the scalp, standing a
  //    little proud so the outline breaks; a small cap underneath fills the gaps. A style = which locks.
  const hs = OPT.hairStyle[o.hairStyle], R = H * 0.5
  put(g, CAP, hair, [0, hy + H * 0.02, -H * 0.02], [R * 1.05, H * 0.55 * 1.05, R * 1.05], [-0.4, 0, 0], true)
  const centre = new THREE.Vector3(0, hy, 0), DOWN = new THREE.Vector3(0, -1, 0)
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
  if (hs === 'Bun')     { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); put(g, SPH, hair, [0, hy + H * 0.5, -H * 0.24], [H * 0.21, H * 0.21, H * 0.21]) }
  if (hs === 'Tail')    { ring(10, 0.8, H * 0.28, H * 0.22, 0.06, 0, 0.7, 2 * Math.PI - 0.7, 0, 0.6); fringe(3, H * 0.24, 0, 0.8, 0.45); for (const d of [-0.2, 0, 0.2]) lock(back + d, 1.05, H * 0.8, H * 0.17, 0.15, 0, 0.9) }

  // ── FACE ──
  const INKC = '#1c1712', ey = hy + H * 0.02, ez = H * 0.47, eyes = OPT.eyes[o.eyes]
  const arc = (x: number, y: number, r: number, thick: number, span: number, rotZ: number, color = INKC) => flat(g, arcGeo(thick, span), color, [x, y, ez + H * 0.03], [r, r, r], [0, 0, rotZ])
  const ball = (x: number, y: number, sx: number, sy: number, color = INKC, dz = 0.03) => flat(g, SPH, color, [x, y, ez + H * dz], [sx, sy, H * 0.03])
  for (const s of [-1, 1]) {
    const ex = s * H * 0.17
    const kind = eyes === 'Wink' ? (s < 0 ? 'Round' : 'Happy') : eyes
    if (kind === 'Lines') flat(g, BOX, INKC, [ex * 0.8, ey + H * 0.03, ez + H * 0.02], [H * 0.035, H * 0.16, H * 0.02])
    else if (kind === 'Dots') ball(ex * 0.85, ey + H * 0.02, H * 0.045, H * 0.05)
    else if (kind === 'Sleepy') { flat(g, BOX, INKC, [ex, ey, ez + H * 0.02], [H * 0.13, H * 0.025, H * 0.02]); arc(ex, ey - H * 0.01, H * 0.065, 0.2, Math.PI, Math.PI) }
    else if (kind === 'Happy') arc(ex, ey - H * 0.03, H * 0.07, 0.22, Math.PI, 0)
    else {
      const big = kind === 'Bright' ? 1.2 : kind === 'Wide' ? 1.3 : 1, pupil = kind === 'Wide' ? 0.55 : 1
      ball(ex, ey, H * 0.11 * big, H * 0.14 * big, '#ffffff', -0.02)
      ball(ex, ey - H * 0.01, H * 0.065 * big * pupil, H * 0.09 * big * pupil)
      if (kind === 'Bright') ball(ex + H * 0.02, ey + H * 0.03, H * 0.02, H * 0.02, '#ffffff', 0.06)
    }
    const brows = OPT.brows[o.brows]
    if (brows !== 'None') flat(g, BOX, hair, [ex, ey + H * 0.18, ez + H * 0.02], [H * 0.16, H * (brows === 'Bold' ? 0.045 : 0.025), H * 0.02], [0, 0, s * 0.08])
  }
  put(g, SPH, '#d9a47c', [0, hy - H * 0.08, H * 0.5], [H * 0.05, H * 0.05, H * 0.05], null, false)
  const my = hy - H * 0.17, mouth = OPT.mouth[o.mouth]
  if (mouth === 'Smile') arc(H * 0.06, my + H * 0.01, H * 0.09, 0.18, Math.PI * 0.7, Math.PI * 1.15)
  if (mouth === 'Grin') { ball(0, my - H * 0.01, H * 0.11, H * 0.05, '#ffffff', 0.0); arc(0, my + H * 0.02, H * 0.12, 0.16, Math.PI, Math.PI) }
  if (mouth === 'Smirk') arc(H * 0.08, my + H * 0.02, H * 0.08, 0.18, Math.PI * 0.45, Math.PI * 1.35)
  if (mouth === 'Flat') flat(g, BOX, INKC, [0, my, ez + H * 0.03], [H * 0.12, H * 0.022, H * 0.02])
  if (mouth === 'Open') ball(0, my - H * 0.01, H * 0.045, H * 0.06, '#5a2a22')
  if (mouth === 'Cat') for (const s of [-1, 1]) arc(s * H * 0.04, my + H * 0.015, H * 0.04, 0.22, Math.PI, Math.PI)
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
