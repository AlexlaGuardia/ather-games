// THE HOLLOW'S BODY: ROOTED SPROUT (BETA M34, Alex picked option A on docs/looks/hollows.html, 11-19). Pure three, no React.
// CANON design-briefs/hollows.md: ONE grey substance gathered on a NUCLEUS (an abandoned Mana Seed), three amounts of it, never
// three designs: the walkers have plantigrade heel-heavy legs because they gathered enough to need them; the caster never got
// its stem down, so it floats, dense only at the reaching hand. No face (the head only TILTS), no kit, no menace posing: it RISES
// toward you like a sprout toward light. The TELL (Alex's pick): the whole body draws IN toward its core and rises tall, then
// falls forward onto you.
// Built as LUMPS: every lump is one instance of one lumpy sphere, posed per frame here, drawn as ONE InstancedMesh per Hollow
// (combat-layer.tsx). Game kinds: 'shambler' = the stalker's amount; the 'floater' (the caster's) has its own body since M120 s3:
// flit-body.ts (the warden is not in the field yet).
// The sim's hit points are fixed (combat.ts HEAD_Y 1.55 / BODY_Y 0.85), so the walker is scaled to put its head-lump there.
import * as THREE from 'three'
import type { HollowKind } from './combat'

export type Bone = 'root' | 'legL' | 'legR' | 'armL' | 'armR' | 'head'
export interface Lump { bone: Bone; x: number; y: number; z: number; sx: number; sy: number; sz: number; seed: number }
export type SproutKind = Exclude<HollowKind, 'floater'>
export interface Sprout { lumps: Lump[]; pivots: Record<Exclude<Bone, 'root'>, THREE.Vector3>; core: number; head: number }

/** the board's option A numbers (docs/looks/hollows.html) */
const A = { h: 1.0, w: 1.0, leg: 0.42, arm: 0.55, armDrop: 0.95, coreY: 0.85, hunch: 0.15 }
export const DENSITY: Record<SproutKind, number> = { shambler: 0.6, crawler: 0.8 }
/** the walker's head-lump sits on the sim's HEAD_Y (1.55) */
export const WALKER_HEAD = 1.55

/** the lumps of one Hollow of `kind`, in its LOCAL space (feet on y=0) */
export function sprout(kind: SproutKind): Sprout {
  if (kind === 'crawler') return crawlerSprout()
  const density = DENSITY[kind]
  const H0 = A.h * (0.82 + density * 0.18), W = A.w * (0.55 + density * 0.55)
  const legH0 = A.leg * H0, core0 = A.coreY * H0, head0 = core0 + 0.52 * H0
  const k = WALKER_HEAD / head0                       // the scale that puts the head where the sim aims
  const H = H0 * k, legH = legH0 * k, coreY = core0 * k, headY = head0 * k, Wk = W * k
  const lumps: Lump[] = []
  let seed = 0
  const add = (bone: Bone, x: number, y: number, z: number, sx: number, sy: number, sz: number) => lumps.push({ bone, x, y, z, sx, sy, sz, seed: seed++ })
  // the seed: the densest point, deep in the chest
  add('root', 0, coreY, 0, 0.2 * Wk, 0.22 * Wk, 0.2 * Wk)
  // the torso: lumps thinning upward from the hips to the shoulders
  const n = 4, y0 = legH + 0.12 * k, y1 = coreY + 0.32 * H
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1), y = y0 + f * (y1 - y0), r = 0.27 * Wk * (1 - f * 0.25) * (i === 1 ? 1.08 : 1)
    add('root', i % 2 ? 0.03 * k : -0.03 * k, y, A.hunch * f * 0.25 * k, r, r * 1.15, r * 0.9)
  }
  // the head: a lump that only tilts (no face, ever)
  const hr = 0.17 * Math.max(0.8, W) * k
  add('head', 0, 0, 0, hr, hr * 1.12, hr)
  const pivots = {
    head: new THREE.Vector3(0, headY, A.hunch * 0.3 * k),
    legL: new THREE.Vector3(-0.13 * Wk, legH, 0), legR: new THREE.Vector3(0.13 * Wk, legH, 0),
    armL: new THREE.Vector3(-0.27 * Wk, coreY + 0.28 * H, 0.02), armR: new THREE.Vector3(0.27 * Wk, coreY + 0.28 * H, 0.02),
  }
  for (const b of ['legL', 'legR'] as const) {   // plantigrade, heavy in the heel
    add(b, 0, -legH * 0.45, 0, 0.1 * Wk, legH * 0.55, 0.11 * Wk)
    add(b, 0, -legH + 0.05 * k, 0.05 * k, 0.13 * Wk, 0.07 * k, 0.19 * Wk)
  }
  for (const b of ['armL', 'armR'] as const) {               // hanging forward
    const L = A.arm * H, th = 0.07 * Math.max(0.8, W) * k
    add(b, 0, -L * 0.45 * A.armDrop, 0.05 * k, th, L * 0.5, th)
    add(b, 0, -L * 0.92 * A.armDrop, 0.08 * k, th * 1.35, th * 1.5, th * 1.35)
  }
  return { lumps, pivots, core: coreY, head: headY }
}

/** M120 s2 the MERGING Hollow at mass 1 (canon c01931e: low, plated, many-legged; the drawn size grows with its mass on the
 *  page, combat.ts crawlerScale). Flat overlapping plate-lumps down the back (combat.ts CRAWLER.bodyY 0.35 is its middle), a
 *  low front lump that only tilts (no face), and three short legs a side hung on the leg bones so the stride scuttles them. */
function crawlerSprout(): Sprout {
  const lumps: Lump[] = []
  let seed = 0
  const add = (bone: Bone, x: number, y: number, z: number, sx: number, sy: number, sz: number) => lumps.push({ bone, x, y, z, sx, sy, sz, seed: seed++ })
  add('root', 0, 0.36, 0, 0.2, 0.18, 0.2)                                   // the seed
  for (let i = 0; i < 4; i++) { const z = 0.42 - i * 0.28, w = 0.42 - Math.abs(i - 1.3) * 0.06
    add('root', 0, 0.36 + (i === 1 ? 0.05 : 0), z, w, 0.16, 0.2) }          // the plates
  add('head', 0, 0, 0, 0.16, 0.12, 0.15)
  for (const b of ['legL', 'legR'] as const) { const sx = b === 'legL' ? -1 : 1
    for (let i = 0; i < 3; i++) add(b, sx * 0.12, -0.12, 0.3 - i * 0.3, 0.16, 0.05, 0.05) }
  const pivots = {
    head: new THREE.Vector3(0, 0.34, 0.62),
    legL: new THREE.Vector3(-0.34, 0.24, 0), legR: new THREE.Vector3(0.34, 0.24, 0),
    armL: new THREE.Vector3(-0.3, 0.3, 0.4), armR: new THREE.Vector3(0.3, 0.3, 0.4),
  }
  return { lumps, pivots, core: 0.36, head: 0.34 }
}

/** what the body is doing this frame. `tell` 0..1 = through the wind-up (gathers in, rises); `fall` 0..1 = the lunge falling
 *  forward; `walk` 0..1 = stride amount; `knock` 0..1 = a hit's knock-back; `t` = seconds (the wobble clock). */
export interface SproutPose { t: number; tell: number; fall: number; walk: number; knock: number }

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _body = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3()
/** write each lump's matrix (local to the Hollow's group) into `out`. Allocation-free. */
export function poseSprout(S: Sprout, P: SproutPose, out: THREE.Matrix4[]): void {
  const ph = P.t * 1.3
  // the whole body: sag + re-gather (always losing itself), the wind-up gathering IN and rising, the fall, the knock
  const gather = P.tell, sy = (1 - Math.sin(ph) * 0.035) * (1 + 0.22 * gather), sxz = (1 + Math.sin(ph) * 0.03) * (1 - 0.28 * gather)
  const lean = 0.15 * 0.4 + Math.sin(ph * 0.5) * 0.04 - 0.25 * gather + 0.7 * P.fall - 0.5 * P.knock
  const bodyM = _body.compose(_p.set(0, 0, 0.35 * P.fall - 0.25 * P.knock), _q.setFromEuler(_e.set(lean, 0, 0)), _s.set(sxz, sy, sxz))
  const stride = Math.sin(P.t * 5.5) * 0.45 * P.walk
  const boneRot: Record<Bone, [number, number, number]> = {
    root: [0, 0, 0], head: [Math.sin(ph * 0.3) * 0.08, 0, Math.sin(ph * 0.4) * 0.25],
    legL: [stride, 0, 0], legR: [-stride, 0, 0],
    armL: [-0.25 + Math.sin(ph) * 0.05 - stride * 0.6, 0, -0.12], armR: [-0.25 + Math.sin(ph + 1) * 0.05 + stride * 0.6, 0, 0.12],
  }
  S.lumps.forEach((L, i) => {
    // each lump wobbles on its own clock: the body never holds a crisp shape
    const w = Math.sin(P.t * 2.2 + L.seed * 1.7) * 0.07
    _m.compose(_p.set(L.x, L.y, L.z), _q.identity(), _s.set(L.sx * (1 + w), L.sy * (1 - w * 0.8), L.sz * (1 + w)))
    if (L.bone !== 'root') {
      const pv = S.pivots[L.bone], r = boneRot[L.bone]
      _b.compose(pv, _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(1, 1, 1))
      _m.premultiply(_b)
    }
    out[i].copy(_m).premultiply(bodyM)
  })
}

/** the one shared lump: a lumpy sphere (goop is never a clean ball), its underside drawn down a little like a drip. Cached. */
let LUMPY: THREE.BufferGeometry | null = null
export const lumpyGeometry = (): THREE.BufferGeometry => (LUMPY ??= lumpyShape(16, 12))
/** the lumpy sphere at a given fineness (flit-body.ts draws its many thin parts with a coarser one) */
export function lumpyShape(w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h), v = new THREE.Vector3(), a = g.attributes.position
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i)
    const n = 1 + 0.09 * Math.sin(v.x * 5.1 + v.y * 2.3) * Math.cos(v.z * 4.7 - v.y * 3.1) + 0.05 * Math.sin(v.y * 9 + v.x * 3)
    v.multiplyScalar(n); if (v.y < -0.4) v.y -= (-v.y - 0.4) * 0.35
    a.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals(); return g
}
