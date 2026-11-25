// THE WALKER HOLLOW'S BODY (BETA M163 s1; the sim's 'shambler'). Pure three, no React. Alex LOCKED the look 11-25 (CANON
// design-briefs/hollows.md banner): a slim melting figure, a dome head running into wide shoulders, arms that end in drips
// (no fingers), heavy heels; near-black, wet, no hue of its own (hollow-goop.ts's surface), no face, no kit, no glow.
// One smooth skin: a distance field of melted limbs, meshed ONCE (surface nets) and shared by every Walker; each one is a
// SkinnedMesh on eight bones = one draw, as the lumps were. The MOTION is the rooted sprout's, number for number (hollow-body.ts poseSprout).
// HITS: the sim's points (combat.ts HEAD_Y / BODY_Y / LEG_Y); walker-body.test.ts holds the drawn skin to them.
import * as THREE from 'three'
import type { SproutPose } from './hollow-body'

export const WALKER_HEAD = 1.55          // = combat.ts HEAD_Y: the middle of the dome
export const WALKER_CORE = 0.98          // the seed, in the chest: where the drips shed from (and gather back to)
export const BONES = ['root', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR'] as const
export type WalkerBone = typeof BONES[number]
type V = [number, number, number]
/** where each bone turns (feet on y = 0, +z its front; L = -x) */
export const PIVOT: Record<WalkerBone, V> = { root: [0, 0, 0], head: [0, 1.36, 0], armL: [-0.24, 1.22, -0.03], armR: [0.24, 1.22, -0.03], foreL: [-0.337, 0.95, -0.02], foreR: [0.337, 0.95, -0.02], legL: [-0.105, 0.64, 0], legR: [0.105, 0.64, 0] }
const PARENT: Partial<Record<WalkerBone, WalkerBone>> = { foreL: 'armL', foreR: 'armR' }

// ── the shape ──
/** a limb: a cone with round ends, radius ra at a .. rb at b; `flat` squeezes it front to back */
interface Limb { bone: WalkerBone; a: V; b: V; ra: number; rb: number; flat?: number }
const both = (bone: 'arm' | 'fore' | 'leg', a: V, b: V, ra: number, rb: number, flat?: number): Limb[] => [-1, 1].map(s => ({ bone: `${bone}${s < 0 ? 'L' : 'R'}` as WalkerBone, a: [a[0] * s, a[1], a[2]] as V, b: [b[0] * s, b[1], b[2]] as V, ra, rb, flat }))
export const LIMBS: Limb[] = [
  { bone: 'head', a: [0, 1.575, -0.02], b: [0, 1.53, -0.035], ra: 0.168, rb: 0.165 },               // the dome, hanging forward
  { bone: 'head', a: [0, 1.5, -0.045], b: [0, 1.3, -0.06], ra: 0.155, rb: 0.185 },                // and its neckless run into the shoulders
  { bone: 'root', a: [-0.2, 1.24, -0.04], b: [0.2, 1.24, -0.04], ra: 0.1, rb: 0.1 },    // the wide shoulders
  { bone: 'root', a: [0, 1.22, -0.02], b: [0, 0.8, 0.015], ra: 0.175, rb: 0.15, flat: 1.25 },
  { bone: 'root', a: [0, 0.82, 0.015], b: [0, 0.66, 0], ra: 0.15, rb: 0.145, flat: 1.25 },
  ...both('arm', [0.255, 1.21, -0.03], [0.335, 0.97, -0.02], 0.088, 0.06),
  ...both('fore', [0.338, 0.95, -0.02], [0.375, 0.68, 0.0], 0.066, 0.1),                        // a sack of it, sagging to the wrist
  ...both('fore', [0.375, 0.68, 0.0], [0.375, 0.53, 0.0], 0.097, 0.045),                           // and running out: no hand
  ...both('leg', [0.1, 0.68, 0], [0.13, 0.42, 0.035], 0.098, 0.074),
  ...both('leg', [0.13, 0.42, 0.03], [0.185, 0.12, -0.03], 0.076, 0.122),                              // the shin flares down
  ...both('leg', [0.185, 0.09, -0.06], [0.195, 0.065, 0.12], 0.125, 0.1),                           // the heavy heel, the blunt toe
]
/** the drips that hang off it: [bone, top, length, radius] (L side; mirrored with a little less, so no two match) */
const DRIPS: [WalkerBone, V, number, number][] = [
  ['foreL', [-0.375, 0.51, 0.0], 0.2, 0.022], ['foreL', [-0.345, 0.57, -0.03], 0.11, 0.024], ['foreR', [0.37, 0.51, 0.01], 0.16, 0.024], ['foreR', [0.405, 0.58, -0.03], 0.1, 0.02],
  ['armL', [-0.325, 0.93, -0.02], 0.15, 0.016], ['armR', [0.325, 0.93, -0.02], 0.1, 0.018], ['root', [0.0, 0.58, 0.01], 0.1, 0.022],
]
function limb(L: Limb, x: number, y: number, z: number): number {
  const f = L.flat ?? 1, ax = L.a[0], ay = L.a[1], az = L.a[2] * f, bx = L.b[0] - ax, by = L.b[1] - ay, bz = L.b[2] * f - az
  const px = x - ax, py = y - ay, pz = z * f - az, t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)))
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (L.ra + (L.rb - L.ra) * t)
}
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }
const SETS = BONES.map(b => LIMBS.filter(l => l.bone === b))
/** how far (x, y, z) is from the skin (below 0 = inside). Pure. */
export function walkerField(x: number, y: number, z: number): number {
  const g = (b: number, k: number) => SETS[b].reduce((m, l) => smin(m, limb(l, x, y, z), k), 9)
  let d = smin(g(0, 0.14), g(1, 0.1), 0.13)
  for (const s of [0, 1]) { d = smin(d, smin(g(2 + s, 0.05), g(4 + s, 0.07), 0.07), 0.1); d = smin(d, g(6 + s, 0.09), 0.07) }
  // runs of it down the skin: shallow, so the outline melts without growing lumps
  return Math.max(d + 0.006 * Math.sin(x * 34 + z * 21 + Math.sin(y * 5) * 1.5) * Math.sin(y * 7 + 1), -y)
}

let GEO: THREE.BufferGeometry | null = null
/** the one skin every Walker wears. Cached. */
export const walkerGeometry = (): THREE.BufferGeometry => (GEO ??= build())
function build(h = 0.05): THREE.BufferGeometry {
  const lo: V = [-0.6, -0.06, -0.32], N: V = [Math.ceil(1.2 / h), Math.ceil(1.9 / h), Math.ceil(0.68 / h)]
  const [nx, ny, nz] = N, id = (i: number, j: number, k: number) => i + nx * (j + ny * k), F = new Float32Array(nx * ny * nz)
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = walkerField(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h)
  const pos: number[] = [], idx: number[] = [], at = new Map<number, number>()
  const n = new THREE.Vector3(), grad = (x: number, y: number, z: number) => { const e = 0.004; return n.set(walkerField(x + e, y, z) - walkerField(x - e, y, z), walkerField(x, y + e, z) - walkerField(x, y - e, z), walkerField(x, y, z + e) - walkerField(x, y, z - e)).normalize() }
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let c = 0, x = 0, y = 0, z = 0
    const v = (q: number) => F[id(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2))]
    for (let q = 0; q < 8; q++) for (const b of [1, 2, 4]) { if (q & b) continue; const A = v(q), B = v(q | b); if ((A < 0) === (B < 0)) continue
      const t = A / (A - B); x += (q & 1) + (b === 1 ? t : 0); y += ((q >> 1) & 1) + (b === 2 ? t : 0); z += (q >> 2) + (b === 4 ? t : 0); c++ }
    if (!c) continue
    let X = lo[0] + (i + x / c) * h, Y = lo[1] + (j + y / c) * h, Z = lo[2] + (k + z / c) * h
    for (let s = 0; s < 2; s++) { const d = walkerField(X, Y, Z); grad(X, Y, Z); X -= n.x * d * 0.8; Y -= n.y * d * 0.8; Z -= n.z * d * 0.8 }   // onto the true skin
    at.set(id(i, j, k), pos.length / 3); pos.push(X, Math.max(0, Y), Z)
  }
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { const [p, q, r, s] = [a, b, c, d].map(m => at.get(m)!); if (flip) idx.push(p, r, q, p, s, r); else idx.push(p, q, r, p, r, s) }
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)] < 0
    if (a !== F[id(i + 1, j, k)] < 0) quad(id(i, j - 1, k - 1), id(i, j, k - 1), id(i, j, k), id(i, j - 1, k), !a)
    if (a !== F[id(i, j + 1, k)] < 0) quad(id(i - 1, j, k - 1), id(i - 1, j, k), id(i, j, k), id(i, j, k - 1), !a)
    if (a !== F[id(i, j, k + 1)] < 0) quad(id(i - 1, j - 1, k), id(i, j - 1, k), id(i, j, k), id(i - 1, j, k), !a)
  }
  const nor: number[] = [], si: number[] = [], sw: number[] = [], m = pos.length / 3
  for (let q = 0; q < m; q++) {
    const x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2]
    grad(x, y, z); nor.push(n.x, n.y, n.z)
    const ds = SETS.map((ls, b) => ({ b, d: ls.reduce((mm, l) => Math.min(mm, limb(l, x, y, z)), 9) })).sort((p, r) => p.d - r.d).slice(0, 4)
    const w = ds.map(e => Math.exp(-(e.d - ds[0].d) / 0.035)), sum = w.reduce((p, r) => p + r, 0)
    ds.forEach((e, t) => { si.push(e.b); sw.push(w[t] / sum) })
  }
  for (const [bone, top, len, r] of DRIPS) {                 // the hanging drips: a thread and its bead
    const prof: [number, number][] = [[1.3, 0.04], [0.55, -0.12], [0.38, -0.6], [0.95, -0.85], [0.7, -0.96], [0, -1]], R = 6, base = pos.length / 3, b = BONES.indexOf(bone)
    prof.forEach(([pr, py], a) => { for (let q = 0; q <= R; q++) { const t = q / R * Math.PI * 2; pos.push(top[0] + Math.cos(t) * pr * r, top[1] + py * len, top[2] + Math.sin(t) * pr * r); const ny2 = a >= 3 ? -(a - 2) * 0.4 : 0; n.set(Math.cos(t), ny2, Math.sin(t)).normalize(); nor.push(n.x, n.y, n.z); si.push(b, 0, 0, 0); sw.push(1, 0, 0, 0) } })
    for (let a = 0; a < prof.length - 1; a++) for (let q = 0; q < R; q++) { const p = base + a * (R + 1) + q; idx.push(p, p + 1, p + R + 1, p + 1, p + R + 2, p + R + 1) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6); g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.4), new THREE.Vector3(0.6, 1.8, 0.4))
  return g
}

export interface Walker { mesh: THREE.SkinnedMesh; bones: Record<WalkerBone, THREE.Bone>; dispose: () => void }
/** one Walker: its own bones on the shared skin (the material is the caller's, never disposed here) */
export function makeWalker(mat: THREE.Material): Walker {
  const bones = {} as Record<WalkerBone, THREE.Bone>
  for (const b of BONES) { const o = new THREE.Bone(), par = PARENT[b] ?? (b === 'root' ? null : 'root'); bones[b] = o; const p = PIVOT[b], q = par ? PIVOT[par] : [0, 0, 0]; o.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (par) bones[par].add(o) }
  const mesh = new THREE.SkinnedMesh(walkerGeometry(), mat); mesh.frustumCulled = false; mesh.add(bones.root); mesh.updateMatrixWorld(true)
  const sk = new THREE.Skeleton(BONES.map(b => bones[b])); mesh.bind(sk)
  return { mesh, bones, dispose: () => sk.dispose() }
}
/** the sprout's pose (poseSprout's numbers) on the bones. Allocation-free. */
export function poseWalker(B: Record<WalkerBone, THREE.Bone>, P: SproutPose): void {
  const ph = P.t * 1.3, g = P.tell
  const sy = (1 - Math.sin(ph) * 0.035) * (1 + 0.22 * g), sxz = (1 + Math.sin(ph) * 0.03) * (1 - 0.28 * g)
  B.root.position.set(0, 0, 0.35 * P.fall - 0.25 * P.knock); B.root.scale.set(sxz, sy, sxz)
  B.root.rotation.set(0.15 * 0.4 + Math.sin(ph * 0.5) * 0.04 - 0.25 * g + 0.7 * P.fall - 0.5 * P.knock, 0, 0)
  const stride = Math.sin(P.t * 5.5) * 0.45 * P.walk
  B.head.rotation.set(Math.sin(ph * 0.3) * 0.08, 0, Math.sin(ph * 0.4) * 0.25)
  B.legL.rotation.x = stride; B.legR.rotation.x = -stride
  B.armL.rotation.set(-0.1 + Math.sin(ph) * 0.05 - stride * 0.6, 0, 0); B.armR.rotation.set(-0.1 + Math.sin(ph + 1) * 0.05 + stride * 0.6, 0, 0)
  // the skin never holds a crisp shape: the ends sag and catch up, each on its own clock
  const w = (s: number) => Math.sin(P.t * 2.2 + s * 1.7) * 0.05
  B.foreL.rotation.x = -0.12 + w(1) - stride * 0.25; B.foreR.rotation.x = -0.12 + w(2) + stride * 0.25
  B.foreL.scale.set(1 + w(3), 1 - w(3), 1 + w(3)); B.foreR.scale.set(1 + w(4), 1 - w(4), 1 + w(4)); B.head.scale.set(1 + w(5) * 0.6, 1 - w(5) * 0.6, 1 + w(5) * 0.6)
}
/** the puddle it stands in: an uneven spill, one flat shared shape. Cached. */
let SPILL: THREE.ShapeGeometry | null = null
export function spillGeometry(): THREE.ShapeGeometry {
  if (SPILL) return SPILL
  const n = 22, pts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 0.53 + 0.1 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 3); return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r) })
  return (SPILL = new THREE.ShapeGeometry(new THREE.Shape().setFromPoints(new THREE.SplineCurve([...pts, pts[0]]).getPoints(44))))
}
