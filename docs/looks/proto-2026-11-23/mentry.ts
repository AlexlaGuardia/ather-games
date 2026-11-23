// M102 spirit #2 Manalotl look proof: renders the game-ready glb with the SAME material recipe as
// src/app/shimmer/open/ather/spirit-model.tsx (toon 3-step on sRGB->linear vertex colours, warm emissive floor, gold fresnel
// rim, pale translucent BackSide hull at 1.06, eye mesh unlit raw). Per-species dials (hull/emissive tint, frill glow) are the
// only additions; a `frills` node gets the same toon + a stronger rosy emissive (the brief's element-expression point).
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const W = window as unknown as { __glb: string; __done?: boolean; __tris?: number; __cfg: Cfg }
type Cfg = { emissive: string; emI: number; glow: string; frillEm: string; frillI: number; pulse: number }
const C = W.__cfg
const grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true
const lin = (geo: THREE.BufferGeometry) => {   // verbatim from spirit-model.tsx
  const g = geo.clone(), a = g.getAttribute('color'); if (!a) return g
  const out = new Float32Array(a.count * 3), c = new THREE.Color()
  for (let i = 0; i < a.count; i++) { c.setRGB(a.getX(i), a.getY(i), a.getZ(i), THREE.SRGBColorSpace); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3)); return g
}
const rim = (m: THREE.Material) => { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
  gl_FragColor.rgb += vec3(1.0, 0.86, 0.32) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.45;`) } }
const buf = Uint8Array.from(atob(W.__glb), c => c.charCodeAt(0)).buffer
new GLTFLoader().parse(buf, '', gltf => {
  const scene = gltf.scene
  const body = scene.getObjectByName('body') as THREE.Mesh, frills = scene.getObjectByName('frills') as THREE.Mesh, eyes = scene.getObjectByName('eyes') as THREE.Mesh
  const bb = new THREE.Box3().setFromObject(scene), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2
  const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, emissive: C.emissive, emissiveIntensity: C.emI }); rim(skin)
  const frill = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, emissive: C.frillEm, emissiveIntensity: C.frillI * C.pulse }); rim(frill)
  const halo = new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.38, side: THREE.BackSide, depthWrite: false, toneMapped: false })
  const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  const make = () => {
    const g = new THREE.Group(), s = new THREE.Group(); s.position.set(-cx, 0, -cz); g.add(s)
    const bg = lin(body.geometry), fg = lin(frills.geometry)
    s.add(new THREE.Mesh(bg, skin), new THREE.Mesh(fg, frill), new THREE.Mesh(eyes.geometry, eye))
    for (const geo of [bg, fg]) { const h = new THREE.Mesh(geo, halo); h.scale.setScalar(1.06); h.position.set(-cx * 0.06, -0.03, -cz * 0.06); s.add(h) }
    return g
  }
  W.__tris = [body, frills, eyes].reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3), 0)
  const views: [string, number, number, number, number][] = [['front', 0, 2.9, 0.55, 0.45], ['tq', -40, 2.9, 0.55, 0.45], ['side', -90, 2.9, 0.45, 0.45], ['face', -12, 2.3, 0.45, 0.52]]
  for (const [id, deg, D, camY, ty] of views) {
    const cv = document.getElementById(id) as HTMLCanvasElement
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.setSize(520, 520); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#1d1a17')
    sc.add(new THREE.AmbientLight(0xffffff, 0.9)); const dl = new THREE.DirectionalLight(0xfff0d0, 1.8); dl.position.set(1.5, 3, 3); sc.add(dl)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshLambertMaterial({ color: '#3a3326' })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; sc.add(ground)
    sc.add(make())
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50), a = deg * Math.PI / 180
    cam.position.set(Math.sin(a) * D, camY + 0.3, Math.cos(a) * D); cam.lookAt(0, ty, 0); r.render(sc, cam)
  }
  W.__done = true
}, e => { console.error(String(e)); W.__done = true })
