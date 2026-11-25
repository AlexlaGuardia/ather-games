// THE GLADE'S CENTRE GATE (BETA M165 s1; look LOCKED by Alex 11-25; canon world/gates.md "the spiral and the frame": framed = kept).
// Pure geometry: two living trunks whose inner strands braid into one arch over a pale stone plinth, and the spiral of light inside.
// The Glade's gate ONLY: a keeper's own cluster keeps plot-scene.tsx's gold ring. Local frame: +Z = the gate's face, the origin where
// the gold ring's group stands (GATE_BASE under the Green's ground). Looks only: the walker's box, E, travel + markers are plot.ts / page.tsx's.
import * as THREE from 'three'
import { Mould, type V3 } from '../shared/friend-figure'

/** the plinth's foot is sunk this far under the ground (plot-scene's gate did the same) */
export const GATE_BASE = 0.4
/** the plinth: the old stone's footprint, but the locked look's low slab (18 cm over the ground). Nobody bumps it: plot.ts FIXED's box for
 *  the gate sits at -Infinity (the island has no ground out at the Green), so a keeper walks over it as they walked through the old one */
export const PLINTH = { top: 1.6, foot: 1.8, h: 0.58 }
/** the light: its middle and how far it reaches; the opening the trunks leave is OPEN wide and reaches up to APEX */
export const LIGHT = { y: 3.05, r: 1.8 }
export const OPEN = 3.1, APEX = 4.95
/** toon + ink + light */
export const GATE_CALLS = 3
export const GATE_COLOR = { bark: '#8d6248', deep: '#6f4b3a', strand: '#c98a4c', strandLo: '#a96d3f', stone: '#e2d8c2', stoneLo: '#cbbfa6', leaf: ['#4f8f56', '#6aa85c', '#85bd62'], gold: '#ffd35c', white: '#fffbe8' }
const C = GATE_COLOR

/** a tapering limb through `pts`; `r` = its radius at each of them */
export function limb(pts: V3[], r: number[], sides = 8, perSpan = 4): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), n = (pts.length - 1) * perSpan
  const pos: number[] = [], nor: number[] = [], idx: number[] = []
  const side = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), t = new THREE.Vector3(), o = new THREE.Vector3(), q = new THREE.Vector3()
  for (let k = 0; k <= n; k++) {
    const f = k / n, at = curve.getPoint(f), s = Math.min(f * (r.length - 1), r.length - 1 - 1e-6), i = Math.floor(s), rad = r[i] + (r[i + 1] - r[i]) * (s - i)
    curve.getTangent(f, t); side.crossVectors(t, up).normalize(); up.crossVectors(side, t).normalize()   // the last ring's frame, carried on
    for (let a = 0; a < sides; a++) {
      const w = (a / sides) * Math.PI * 2; o.copy(side).multiplyScalar(Math.cos(w)).addScaledVector(up, Math.sin(w)); q.copy(at).addScaledVector(o, rad)
      pos.push(q.x, q.y, q.z); nor.push(o.x, o.y, o.z)
      if (k < n) { const b = k * sides + a, c = k * sides + (a + 1) % sides; idx.push(b, b + sides, c, c, b + sides, c + sides) }
    }
  }
  const at = curve.getPoint(1); curve.getTangent(1, t); pos.push(at.x, at.y, at.z); nor.push(t.x, t.y, t.z)
  for (let a = 0; a < sides; a++) idx.push(n * sides + a, (n + 1) * sides, n * sides + (a + 1) % sides)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx)
  return g
}

/** one tree, s = +1 the +x side; the two are kin, not mirror images (`v` shifts the second a little) */
function tree(m: Mould, s: number) {
  const v = s > 0 ? 0 : 1, put = (color: string, pts: V3[], r: number[], sides = 8) => { const g = limb(pts.map(([x, y, z]) => [x * s, y, z]), r, sides); m.add(g, color) }
  // the trunk, leaning out of the arch into its own crown
  put(C.bark, [[2.75, 0.1, -0.05], [2.5, 1.2, 0], [2.36, 2.6, 0.02], [2.5, 4.1, -0.04], [2.85, 5.4, -0.1], [3.0 + v * 0.15, 6.9, -0.15]], [0.82, 0.56, 0.47, 0.42, 0.28, 0.1], 10)
  // the dark rib over the top, meeting the other tree's
  put(C.deep, [[2.32, 2.4, -0.16], [2.16, 3.7, -0.14], [1.66, 4.85, -0.1], [0.75, 5.5 + v * 0.06, 0.02], [-0.3, 5.62 - v * 0.08, 0.08], [-1.2, 5.28, 0.02]], [0.34, 0.33, 0.3, 0.27, 0.22, 0.07], 9)
  // the inner strands: three, twisting round each other up the inside of the arch and on past the middle (the fuse)
  for (let k = 0; k < 3; k++) {
    const path: [number, number][] = [[2.06, 0.15], [1.98, 1.0], [1.9, 2.0], [1.86, 3.0], [1.66, 4.0], [1.2, 4.78], [0.45, 5.2], [-0.4, 5.26], [-1.15, 4.94]]
    const w = (i: number) => k * (Math.PI * 2 / 3) + i * 0.95 + v
    put(k === 1 ? C.strandLo : C.strand, path.map(([x, y], i) => { const d = i === path.length - 1 ? 0.04 : 0.17, nx = x / Math.hypot(x, y - 3), ny = (y - 3) / Math.hypot(x, y - 3); const c = Math.cos(w(i)) * d + 0.08; return [x + nx * c, y + (y > 3 ? ny * c : 0), Math.sin(w(i)) * 0.26] as V3 }), [0.24, 0.2, 0.18, 0.17, 0.16, 0.15, 0.13, 0.11, 0.05], 7)
  }
  // roots: flat and wide outside, short toward the plinth so the way in is clear
  for (const [a, len, rr] of [[-0.15, 2.1, 0.3], [0.55, 1.7, 0.26], [-0.85, 1.6, 0.26], [1.35, 1.25, 0.24], [-1.6, 1.2, 0.24], [2.1, 0.7, 0.2], [-2.3, 0.7, 0.2]] as const) {
    const dx = Math.cos(a), dz = Math.sin(a), at = (d: number, y: number): V3 => [2.6 + dx * d, y, dz * d * 1.1]
    put(a * a > 1.5 ? C.strandLo : C.bark, [at(0.2, 1.25), at(0.5, 0.74), at(0.5 + len * 0.45, 0.46), at(0.5 + len, 0.33)], [rr * 0.8, rr, rr * 0.66, 0.05], 7)
  }
  // limbs into the crown
  put(C.bark, [[2.5, 3.9, 0], [3.3, 4.75, 0.1], [4.3, 5.2, 0.25], [5.3, 5.15 + v * 0.3, 0.3]], [0.3, 0.2, 0.14, 0.04], 7)
  put(C.bark, [[3.6, 4.9, 0.12], [4.2, 5.7, -0.1], [4.5, 6.5, -0.3]], [0.15, 0.11, 0.03], 6)
  put(C.deep, [[2.75, 5.0, -0.1], [2.1, 5.95, 0.2], [1.8 - v * 0.2, 6.9, 0.35]], [0.2, 0.14, 0.04], 6)
  put(C.deep, [[2.4, 3.7, -0.1], [2.8, 4.8, -0.9], [3.2, 5.8, -1.5]], [0.2, 0.15, 0.04], 6)
  put(C.deep, [[2.5, 3.9, 0.1], [2.9, 4.9, 0.8], [3.3, 5.9, 1.4]], [0.2, 0.15, 0.04], 6)
  // the crown: soft clumps on the limbs' ends, the middle over the arch left open
  const leaf = new THREE.IcosahedronGeometry(1, 2)
  const clumps: [number, number, number, number][] = [[3.05, 7.2, -0.2, 1.25], [2.0, 7.2, 0.4, 0.85], [4.5, 6.6, -0.3, 1.15], [5.2, 5.5, 0.35, 0.95], [3.3, 6.2, 1.5, 1.0], [3.2, 6.1, -1.6, 1.05], [4.1, 7.5, 0.4, 0.9]]
  clumps.forEach(([x, y, z, r], i) => m.add(leaf, C.leaf[(i + v) % 3], [(x + v * 0.1 * (i % 2)) * s, y + (v ? 0.15 * ((i % 3) - 1) : 0), z], [r * 1.12, r * 0.74, r], [0, i * 1.3 + v, 0]))
  leaf.dispose()
}

/** the light: a soft disc and the spiral on it, RGBA vertex colours, in the XY plane round (0, 0); it turns as one */
export function spiralLight(): THREE.BufferGeometry {
  const p: number[] = [], c: number[] = [], idx: number[] = [], gold = new THREE.Color(C.gold), white = new THREE.Color(C.white)
  const push = (x: number, y: number, z: number, k: THREE.Color, a: number) => { p.push(x, y, z); c.push(k.r, k.g, k.b, a); return p.length / 3 - 1 }
  const N = 40, rings: [number, number][] = [[0.35, 0.8], [0.7, 0.66], [0.9, 0.42], [1, 0]]
  const mid = push(0, 0, 0, white, 0.85); let prev = -1
  for (const [f, a] of rings) {
    const b = p.length / 3
    for (let k = 0; k < N; k++) { const w = (k / N) * Math.PI * 2; push(Math.cos(w) * LIGHT.r * f, Math.sin(w) * LIGHT.r * f, 0, gold, a) }
    for (let k = 0; k < N; k++) { const n = (k + 1) % N; if (prev < 0) idx.push(mid, b + k, b + n); else idx.push(prev + k, b + k, b + n, prev + k, b + n, prev + n) }
    prev = b
  }
  // the ribbon, a hair to each side of the disc (seen the same from both faces)
  const TURNS = 3.4, M = 130
  for (const z of [0.02, -0.02]) for (let k = 0; k <= M; k++) {
    const f = k / M, w = f * TURNS * Math.PI * 2, r = 0.06 + f * LIGHT.r * 0.9, half = 0.035 + 0.065 * Math.sin(Math.PI * Math.min(1, f * 1.15)), a = f < 0.75 ? 0.95 : 0.95 * (1 - f) / 0.25
    const i = push(Math.cos(w) * (r - half), Math.sin(w) * (r - half), z, white, a); push(Math.cos(w) * (r + half), Math.sin(w) * (r + half), z, white, a)
    if (k < M) idx.push(i, i + 1, i + 3, i, i + 3, i + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4)); g.setIndex(idx)
  return g
}
export interface GateFigure { toon: THREE.BufferGeometry; ink: THREE.BufferGeometry; light: THREE.BufferGeometry }
let made: GateFigure | null = null
export function gladeGateFigure(): GateFigure {
  if (made) return made
  const m = new Mould(0.035)
  const disc = new THREE.CylinderGeometry(PLINTH.top, PLINTH.foot, PLINTH.h - 0.1, 28)
  m.add(disc, C.stoneLo, [0, (PLINTH.h - 0.1) / 2, 0]); disc.dispose()
  const slab = new THREE.CylinderGeometry(PLINTH.top + 0.02, PLINTH.top + 0.1, 0.16, 28)
  m.add(slab, C.stone, [0, PLINTH.h - 0.08, 0]); slab.dispose()
  tree(m, 1); tree(m, -1)
  return (made = { toon: m.toon(), ink: m.ink(), light: spiralLight() })
}
