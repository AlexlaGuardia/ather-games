// VULNYX (fox) base form, code-built prototype. Built against CANON design-briefs/base-forms.md §1 + the locked Glim ref
// (assets/glim-reference-test/glim_lumin_01.png). Young kit, knee-high (~0.65 m), sitting. Origin between the paws, facing +z.
// Spirit look (shared design law): woven from light (self-lit + a soft gold halo instead of an ink hull), glowing eyes,
// golden particle trails, 2-3 colours. Parts are NAMED so a caller can animate them (ear-l/r, tail, head).
import * as THREE from 'three'

const grad = (() => { const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t })()
const SPH = new THREE.SphereGeometry(1, 24, 16), CONE = new THREE.ConeGeometry(1, 1, 18, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14)
const EGG = new THREE.LatheGeometry([[0, 0], [0.55, 0.08], [0.9, 0.3], [1, 0.55], [0.85, 0.82], [0.5, 0.97], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 24)

export const VULNYX = { gold: '#ffd02e', goldDeep: '#d99a1c', cream: '#fff1c9', pink: '#e9a091', eye: '#e08a1e', nose: '#2a1c12', halo: '#ffd75e' }

const mats = new Map<string, THREE.Material>()
/** the spirit body: toon-stepped, but self-lit so it reads as light rather than a solid */
const body = (c: string, glow = 0.42) => { const k = `b${c}${glow}`; let m = mats.get(k); if (!m) { const t = new THREE.MeshToonMaterial({ color: c, gradientMap: grad, emissive: new THREE.Color(c), emissiveIntensity: glow }); m = t; mats.set(k, m) } return m }
const flatM = (c: string) => { const k = `f${c}`; let m = mats.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); mats.set(k, m) } return m }
/** the halo: a back-face shell, additive, so every edge blooms gold instead of carrying a black ink line */
const HALO = new THREE.MeshBasicMaterial({ color: VULNYX.halo, side: THREE.BackSide, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })

type V3 = [number, number, number]
function part(host: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scale: V3, rot: V3 = [0, 0, 0], halo = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot); host.add(m)
  if (halo) { const h = new THREE.Mesh(geo, HALO); h.position.copy(m.position); h.scale.copy(m.scale).multiplyScalar(1.09); h.rotation.copy(m.rotation); host.add(h) }
  return m
}

export interface SpiritFigure { group: THREE.Group; height: number; tick: (t: number) => void }

export function buildVulnyx(): SpiritFigure {
  const g = new THREE.Group(), C = VULNYX
  // ── body: a sitting egg leaning back, haunches out to the sides, a cream bib down the chest ──
  const torso = new THREE.Group(); torso.name = 'body'; g.add(torso)
  part(torso, EGG, body(C.gold), [0, 0.04, -0.02], [0.125, 0.25, 0.115], [-0.22, 0, 0])
  for (const s of [-1, 1]) part(torso, SPH, body(C.gold), [s * 0.085, 0.09, -0.06], [0.075, 0.085, 0.1])
  part(torso, SPH, body(C.cream, 0.5), [0, 0.2, 0.065], [0.08, 0.1, 0.06], [0.2, 0, 0], false)
  // front legs: straight posts into round paws
  for (const s of [-1, 1]) {
    part(torso, CYL, body(C.gold), [s * 0.048, 0.075, 0.07], [0.027, 0.12, 0.03])
    part(torso, SPH, body(C.gold), [s * 0.052, 0.022, 0.095], [0.04, 0.026, 0.05])
    part(torso, SPH, body(C.gold), [s * 0.11, 0.025, 0.02], [0.045, 0.028, 0.06])   // hind paws peeking out
  }
  // ── tail: a big flame-shaped brush sweeping up behind, cream at the tip ──
  const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(0.09, 0.05, -0.1); g.add(tail)
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.03, -0.05), new THREE.Vector3(0.24, 0.14, -0.06), new THREE.Vector3(0.28, 0.3, -0.03), new THREE.Vector3(0.22, 0.45, 0.0), new THREE.Vector3(0.13, 0.5, 0.02)])
  const N = 18
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), p = curve.getPoint(t), r = 0.022 + Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.06 + t * 0.012
    part(tail, SPH, body(t > 0.78 ? C.cream : C.gold, t > 0.78 ? 0.55 : 0.42), [p.x, p.y, p.z], [r, r * 1.1, r])
  }
  for (const [t, a] of [[0.35, 1], [0.55, -1], [0.7, 1]] as const) {   // flame tufts off the brush
    const p = curve.getPoint(t)
    part(tail, CONE, body(C.gold), [p.x + a * 0.06, p.y, p.z], [0.022, 0.07, 0.022], [0, 0, -a * 1.1])
  }
  // ── head ──
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 0.36, 0.035); head.scale.setScalar(1.38); g.add(head)
  part(head, SPH, body(C.gold), [0, 0, 0], [0.125, 0.11, 0.115])
  for (const s of [-1, 1]) {
    // cheek tufts: the ref's triangular fluff out to the sides, cream underneath
    part(head, CONE, body(C.gold), [s * 0.115, -0.05, 0.01], [0.03, 0.065, 0.035], [0, 0, s * 2.1])
    part(head, CONE, body(C.cream, 0.5), [s * 0.085, -0.07, 0.05], [0.025, 0.05, 0.03], [0, 0, s * 2.3], false)
    // ears: tall, tipped out, pink inside
    const ear = new THREE.Group(); ear.name = s < 0 ? 'ear-r' : 'ear-l'; ear.position.set(s * 0.075, 0.075, -0.01); ear.rotation.set(-0.12, 0, -s * 0.32); head.add(ear)
    part(ear, CONE, body(C.gold), [0, 0.085, 0], [0.055, 0.17, 0.03])
    part(ear, CONE, body(C.pink, 0.3), [0, 0.075, 0.018], [0.034, 0.12, 0.012], [0, 0, 0], false)
  }
  // muzzle: a short cream snout with the black nose
  part(head, SPH, body(C.cream, 0.5), [0, -0.045, 0.085], [0.065, 0.045, 0.06], [0, 0, 0], false)
  part(head, SPH, flatM(C.nose), [0, -0.03, 0.142], [0.018, 0.013, 0.012], [0, 0, 0], false)
  // eyes: big amber almonds with a dark lash line + a highlight; the amber GLOWS (the "window to the Ather")
  const ez = 0.1
  for (const s of [-1, 1]) {
    const ex = s * 0.052, ey = 0.012
    part(head, SPH, flatM('#fff8e6'), [ex, ey, ez], [0.027, 0.025, 0.014], [0, s * 0.35, s * 0.1], false)
    part(head, SPH, new THREE.MeshBasicMaterial({ color: C.eye }), [ex - s * 0.002, ey - 0.002, ez + 0.006], [0.022, 0.024, 0.012], [0, s * 0.35, 0], false)
    part(head, SPH, flatM('#1a0f08'), [ex - s * 0.002, ey - 0.003, ez + 0.012], [0.011, 0.014, 0.008], [0, s * 0.35, 0], false)
    part(head, SPH, flatM('#ffffff'), [ex - s * 0.01, ey + 0.009, ez + 0.018], [0.006, 0.006, 0.004], [0, 0, 0], false)
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.0042, 6, 16, Math.PI * 0.95), flatM('#3a230f'))   // upper lash: an arc hugging the eye top
    lid.position.set(ex, ey + 0.001, ez + 0.009); lid.rotation.set(0, s * 0.35, Math.PI * 0.03 + (s > 0 ? -0.08 : 0.08)); head.add(lid)
    part(head, CYL, flatM('#3a230f'), [ex + s * 0.028, ey + 0.012, ez + 0.004], [0.0035, 0.016, 0.0035], [0, s * 0.35, -s * 0.9], false)   // outer flick
  }
  // the smile: a thin dark arc under the nose
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0035, 6, 16, Math.PI * 0.8), flatM('#3a230f'))
  smile.position.set(0, -0.06, 0.135); smile.rotation.set(0.2, 0, Math.PI + Math.PI * 0.1); head.add(smile)
  // ── golden particles drifting up off the body (canon: trails that fade into particles) ──
  const P = 70, pos = new Float32Array(P * 3), seed = Array.from({ length: P }, (_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12345.678 % 1, Math.sin(i * 39.425) * 9876.54 % 1])
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d')!; const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c) })()
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.03, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C.halo }))
  g.add(pts)
  const tick = (t: number) => {
    for (let i = 0; i < P; i++) {
      const [a, b, c] = seed[i].map(Math.abs), life = (t * 0.25 + a) % 1
      const ang = b * Math.PI * 2, rad = 0.12 + c * 0.14
      pos[i * 3] = Math.cos(ang) * rad + Math.sin(t + i) * 0.01; pos[i * 3 + 1] = 0.05 + life * 0.75; pos[i * 3 + 2] = Math.sin(ang) * rad - 0.05
    }
    pg.attributes.position.needsUpdate = true
    head.rotation.z = Math.sin(t * 1.3) * 0.04; tail.rotation.z = Math.sin(t * 1.7) * 0.08
    g.position.y = Math.sin(t * 2) * 0.006   // a breath, not a bob
  }
  tick(1.3)
  return { group: g, height: 0.7, tick }
}
