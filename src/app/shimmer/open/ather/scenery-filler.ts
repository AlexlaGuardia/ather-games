// ── BETA M153 s1a+: THE FILLER SCENERY, BUILT IN CODE (Alex: generic filler is code). Geometry only; sizes + solidity: scenery.ts FILLER.
// Low-poly, faceted, flat colours in the vertices: one geometry per kind and ONE material for all of them, so a kind is one draw call
// however many stand. Every piece stands with its foot a little under y 0, so a slope shows no gap. Same shape every load (seeded).
// scenery-filler.test.ts holds each to its size and its triangle budget.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type G = THREE.BufferGeometry
/** a seeded 0..1 stream, so a piece never changes between loads */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const lin = (hex: string) => new THREE.Color(hex)
/** flat colour per FACE: `pick(centre, normal, n)` */
function paint(g0: G, pick: (c: THREE.Vector3, n: THREE.Vector3, k: number) => THREE.Color): G {
  const g = g0.index ? g0.toNonIndexed() : g0; g.deleteAttribute('uv'); g.computeVertexNormals()
  const p = g.getAttribute('position'), col = new Float32Array(p.count * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  for (let k = 0; k < p.count; k += 3) {
    a.fromBufferAttribute(p, k); b.fromBufferAttribute(p, k + 1); c.fromBufferAttribute(p, k + 2)
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize()
    const q = pick(a.add(b).add(c).divideScalar(3), n, k / 3)
    for (let i = 0; i < 3; i++) { col[(k + i) * 3] = q.r; col[(k + i) * 3 + 1] = q.g; col[(k + i) * 3 + 2] = q.b }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g
}
/** one colour, each face a touch lighter or darker */
function tone(g: G, hex: string, r: () => number, spread = 0.12): G { const base = lin(hex); return paint(g, () => base.clone().multiplyScalar(1 - spread / 2 + r() * spread)) }
const join = (gs: G[]): G => { const g = mergeGeometries(gs); gs.forEach(x => x.dispose()); if (!g) throw new Error('filler: merge'); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g }
const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0, ry = 0): G => new THREE.BoxGeometry(w, h, d).rotateZ(rz).rotateY(ry).translate(x, y, z)

// ── rocks: an icosphere with its points pushed in and out, squashed, cut flat by the ground; the big one is three stones. Top faces moss.
function stone(r: () => number, w: number, d: number, h: number, sink: number, moss: boolean, detail = 1): G {
  const g0 = new THREE.IcosahedronGeometry(1, detail), p = g0.getAttribute('position'), push = new Map<string, number>(), v = new THREE.Vector3()
  for (let k = 0; k < p.count; k++) {   // the same point is many vertices: one push per point, so no cracks
    v.fromBufferAttribute(p, k); const id = [v.x, v.y, v.z].map(n => n.toFixed(3)).join()
    let m = push.get(id); if (m === undefined) { m = 0.78 + r() * 0.34; push.set(id, m) }
    v.multiplyScalar(m); p.setXYZ(k, v.x, v.y, v.z)
  }
  g0.computeBoundingBox(); const b = g0.boundingBox!, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3())
  g0.translate(-c.x, -b.min.y, -c.z).scale(w / s.x, (h + sink) / s.y, d / s.z).translate(0, -sink, 0)
  const grey = lin('#a59e92'), dark = lin('#8a8378'), green = lin('#80994f')
  return paint(g0, (f, n) => { const t = Math.max(0, Math.min(1, f.y / h)), q = dark.clone().lerp(grey, 0.35 + t * 0.65).multiplyScalar(0.92 + r() * 0.16); return moss && n.y > 0.72 && f.y > h * 0.55 && r() < 0.7 ? q.lerp(green, 0.6) : q })
}
function rock(size: 's' | 'm' | 'l'): G {
  const r = rng({ s: 11, m: 29, l: 47 }[size])
  if (size === 's') return join([stone(r, 0.5, 0.42, 0.3, 0.14, false)])
  if (size === 'm') return join([stone(r, 1.2, 1, 0.8, 0.4, true), stone(r, 0.46, 0.4, 0.24, 0.14, false, 0).translate(0.5, 0, 0.36)])
  return join([stone(r, 2, 1.75, 1.75, 0.48, true), stone(r, 1.1, 1, 0.8, 0.4, true).rotateY(0.8).translate(0.85, 0, 0.5), stone(r, 0.6, 0.5, 0.35, 0.15, false, 0).translate(-0.8, 0, 0.7)])
}

// ── logs: bark round, pale ends with a ring
const BARK = '#735a39', CUT = '#b48d58', RING = '#8f6b3e'
function round(r: () => number, rad0: number, rad1: number, len: number, sides: number, segs: number, rough: number): G {   // along y, 0..len
  const g0 = new THREE.CylinderGeometry(rad1, rad0, len, sides, segs, true), p = g0.getAttribute('position'), push = new Map<string, number>()
  for (let k = 0; k < p.count; k++) { const id = [p.getX(k), p.getY(k), p.getZ(k)].map(n => n.toFixed(3)).join(); let m = push.get(id); if (m === undefined) { m = 1 - rough + r() * rough; push.set(id, m) }; p.setXYZ(k, p.getX(k) * m, p.getY(k) + len / 2, p.getZ(k) * m) }
  return g0
}
function cap(r: () => number, rad: number, sides: number, y: number, up: boolean): G[] {
  const disc = (q: number, dy: number, hex: string) => tone(new THREE.CircleGeometry(q, sides).rotateX(up ? -Math.PI / 2 : Math.PI / 2).translate(0, y + (up ? dy : -dy), 0), hex, r, 0.06)
  return [disc(rad, 0, CUT), disc(rad * 0.62, 0.006, RING), disc(rad * 0.46, 0.012, CUT)]
}
function logFallen(): G {
  const r = rng(71), R = 0.27
  const parts = [tone(round(r, R, R * 0.86, 2.4, 9, 4, 0.1), BARK, r, 0.22), ...cap(r, R * 0.95, 9, 0.02, false), ...cap(r, R * 0.82, 9, 2.38, true)]
  const body = join(parts).rotateZ(-Math.PI / 2).translate(-1.2, R * 0.82, 0)
  const twig = tone(round(r, 0.075, 0.05, 0.32, 6, 1, 0.05), BARK, r, 0.2).rotateX(0.75).rotateZ(-0.3).translate(0.35, R * 1.45, 0.1)
  const tip = tone(new THREE.CircleGeometry(0.05, 6).rotateX(-Math.PI / 2).translate(0, 0.32, 0), CUT, r, 0.05).rotateX(0.75).rotateZ(-0.3).translate(0.35, R * 1.45, 0.1)
  const moss = [[-0.7, 0.34], [-0.25, 0.26], [0.75, 0.3]].map(([x, w]) => tone(new THREE.IcosahedronGeometry(0.2, 0).scale(w / 0.2, 0.22, 0.75).translate(x, R * 1.72, 0.02), '#80994f', r, 0.2))
  return join([body, twig, tip, ...moss])
}
function stump(): G {
  const r = rng(83), parts = [tone(round(r, 0.36, 0.28, 0.55, 9, 2, 0.08).translate(0, -0.1, 0), BARK, r, 0.22), ...cap(r, 0.27, 9, 0.445, true)]
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r() * 0.5; parts.push(tone(new THREE.ConeGeometry(0.12, 0.44, 5).rotateZ(2.0).translate(-0.34, 0.07, 0).rotateY(a), BARK, r, 0.2)) }
  return join(parts)
}

// ── post-and-rail fence. A straight piece is FENCE_LEN long and ends on a post each end; a neighbour's post is the same post, so the
//    two run on as one fence (scenery.ts ends + endSnap put them there). Posts are square and true: two in one place show as one.
export const FENCE_LEN = 2
const WOOD = ['#a07e54', '#97764a']
const post = (x: number, z: number): G => join([paint(new THREE.BoxGeometry(0.15, 1.35, 0.15).translate(x, 0.375, z), (f, n) => lin(n.y > 0.5 ? CUT : Math.abs(n.x) > 0.5 ? '#8c6c45' : '#866641')), paint(new THREE.ConeGeometry(0.106, 0.08, 4).rotateY(Math.PI / 4).translate(x, 1.09, z), () => lin('#a5834f'))])
function rails(r: () => number, len: number): G[] {   // from x 0 to len
  return [0.42, 0.82].map((y, k) => tone(box(len, 0.12, 0.07, len / 2, y, 0), WOOD[k], r, 0.1))
}
function fence(): G { const r = rng(5); return join([post(-1, 0), post(1, 0), ...rails(r, FENCE_LEN).map(g => g.translate(-1, 0, 0))]) }
function fenceCorner(): G { const r = rng(6); return join([post(0, 0), post(1, 0), post(0, 1), ...rails(r, 1), ...rails(r, 1).map(g => g.rotateY(-Math.PI / 2))]) }
// ── a blank sign: a post, a planked board, no words
function sign(): G {
  const r = rng(9), parts = [tone(box(0.13, 1.85, 0.13, 0, 0.625, -0.02), '#866641', r, 0.1)]
  for (let k = 0; k < 3; k++) parts.push(tone(box(1.1, 0.185, 0.06, (k - 1) * 0.012, 1.0 + k * 0.2, 0.075, (k - 1) * 0.008), ['#a5834f', '#ad8b57', '#9c7b49'][k], r, 0.05))
  for (const x of [-0.42, 0.42]) parts.push(tone(box(0.075, 0.6, 0.035, x, 1.2, 0.118), '#7a5d3a', r, 0.06))
  return join(parts)
}

// ── plants: three-sided tapered blades (a blade has volume, so it lights from every side); a blade leans out and droops
function blade(r: () => number, len: number, w: number, lean: number, yaw: number, x: number, z: number, hex: string, tipHex: string): G {
  const g0 = new THREE.CylinderGeometry(0.001, w, len, 3, 2, true).translate(0, len / 2 - 0.06, 0), p = g0.getAttribute('position'), a = lin(hex), b = lin(tipHex)
  for (let k = 0; k < p.count; k++) { const t = Math.max(0, p.getY(k) / len); p.setX(k, p.getX(k) + lean * len * t * t); p.setY(k, p.getY(k) * (1 - Math.abs(lean) * 0.22 * t)) }
  const s = 0.94 + r() * 0.12
  return paint(g0, f => a.clone().lerp(b, Math.max(0, Math.min(1, f.y / len))).multiplyScalar(s)).rotateY(yaw).translate(x, 0, z)
}
function ring(r: () => number, n: number, rad: number, f: (k: number, a: number, x: number, z: number) => G[]): G[] {
  const out: G[] = []
  for (let k = 0; k < n; k++) { const a = k * 2.39996 + r() * 0.4, q = rad * Math.sqrt((k + 0.4) / n); out.push(...f(k, a, Math.cos(a) * q, Math.sin(a) * q)) }
  return out
}
function grass(): G { const r = rng(17); return join(ring(r, 22, 0.24, (k, a, x, z) => [blade(r, 0.5 + r() * 0.32, 0.04, 0.22 + r() * 0.4, -a, x, z, '#6a9a3f', k % 3 ? '#a6cf62' : '#c2dc7c')])) }
function reeds(): G {
  const r = rng(23)
  const stems = ring(r, 9, 0.36, (k, a, x, z) => {
    const h = 1.1 + r() * 0.5, tilt = 0.03 + r() * 0.07, out: G[] = [tone(new THREE.CylinderGeometry(0.014, 0.02, h + 0.2, 4, 1, true).translate(0, (h - 0.2) / 2, 0), '#86a657', r, 0.1)]
    if (k % 4 !== 3) out.push(tone(new THREE.CylinderGeometry(0.042, 0.046, 0.24, 6).translate(0, h - 0.04, 0), '#8a5a33', r, 0.16), tone(new THREE.ConeGeometry(0.012, 0.14, 4).translate(0, h + 0.15, 0), '#8a9a52', r, 0.1))
    return out.map(g => g.rotateZ(-tilt).rotateY(-a).translate(x, 0, z))
  })
  const leaves = ring(r, 17, 0.38, (_k, a, x, z) => [blade(r, 0.8 + r() * 0.5, 0.042, 0.12 + r() * 0.3, -a + r(), x, z, '#648c47', '#adc96e')])
  return join([...stems, ...leaves])
}
/** petals round a button; each head faces up and a little out */
function flowers(petal: string, heart: string, seed: number): G {
  const r = rng(seed)
  const heads = ring(r, 8, 0.27, (_k, a, x, z) => {
    const h = 0.22 + r() * 0.2, s = 0.85 + r() * 0.35, out: G[] = [tone(new THREE.CylinderGeometry(0.009, 0.012, h + 0.05, 3, 1, true).translate(0, (h - 0.05) / 2, 0), '#5c8a3c', r, 0.1)]
    const head: G[] = []
    for (let p = 0; p < 5; p++) head.push(tone(new THREE.OctahedronGeometry(0.058, 0).scale(1, 0.32, 0.66).rotateZ(0.28).translate(0.062, 0.012, 0).rotateY(p / 5 * Math.PI * 2), petal, r, 0.1))
    head.push(tone(new THREE.OctahedronGeometry(0.034, 0).scale(1, 0.7, 1).translate(0, 0.02, 0), heart, r, 0.1))
    out.push(...head.map(g => g.scale(s, s, s).rotateZ(-0.35).translate(0, h, 0)))
    return out.map(g => g.rotateY(-a).translate(x, 0, z))
  })
  const leaves = ring(r, 14, 0.3, (_k, a, x, z) => [blade(r, 0.22 + r() * 0.12, 0.04, 0.5 + r() * 0.4, -a, x, z, '#5f8f40', '#9cc962')])
  return join([...heads, ...leaves])
}

const MAKE: Readonly<Record<string, () => G>> = {
  'rock-small': () => rock('s'), 'rock-medium': () => rock('m'), 'rock-large': () => rock('l'),
  'log-fallen': logFallen, stump, fence, 'fence-corner': fenceCorner, sign, reeds, 'grass-tall': grass,
  'flowers-white': () => flowers('#f4f1e6', '#e8b93c', 31), 'flowers-yellow': () => flowers('#f2c63d', '#9a5f22', 37), 'flowers-violet': () => flowers('#9a78d6', '#f0d27a', 41),
}
export const FILLER_IDS = Object.keys(MAKE)
export function fillerGeometry(id: string): G { const f = MAKE[id]; if (!f) throw new Error(`no filler piece ${id}`); return f() }
let mat: THREE.MeshLambertMaterial | null = null
export const fillerMaterial = () => (mat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
