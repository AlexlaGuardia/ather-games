// M116 sheet renderer (headless; bundled to an IIFE by render.mts). Not part of the game.
import * as THREE from 'three'
import { protoKeeper, FACES, type Face } from './heads'
import { DEFAULT_LOOK, type Look } from '/root/ather-games/src/app/shimmer/open/shared/keeper-look'
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1)
const BG = 0xefe4cc
const light = (s: THREE.Scene) => { s.add(new THREE.AmbientLight(0xffffff, 0.6)); const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(2, 3, 4); s.add(d) }
function shot(id: string, w: number, h: number, setup: (s: THREE.Scene) => THREE.Camera) {
  r.setSize(w, h); const s = new THREE.Scene(); s.background = new THREE.Color(BG); light(s); const c = setup(s); r.render(s, c)
  const cv = document.getElementById(id) as HTMLCanvasElement; cv.width = w; cv.height = h; cv.getContext('2d')!.drawImage(r.domElement, 0, 0)
}
const cam = (fov: number, a: number, p: [number, number, number], t: [number, number, number]) => { const c = new THREE.PerspectiveCamera(fov, a, 0.02, 80); c.position.set(...p); c.lookAt(...t); return c }
// male = Broad torso, female = Curved torso, both Medium frame (the default keeper); Round eyes on TODAY so a full face shows
const MALE: Look = { ...DEFAULT_LOOK, eyes: 2 }, FEMALE: Look = { ...DEFAULT_LOOK, torso: 1, hairStyle: 5, hair: 0, skin: 2, scarf: 1, topColor: 3, eyes: 2 }
const headY = (g: THREE.Group) => { g.updateMatrixWorld(true); return (g.getObjectByName('head') as THREE.Object3D).getWorldPosition(new THREE.Vector3()).y }
const W = window as any
const rows: [string, Face | null][] = [['T', null], ...(Object.entries(FACES) as [string, Face][])]
for (const [k, f] of rows) {
  for (const [sex, lk] of [['m', MALE], ['f', FEMALE]] as const) {
    for (const [view, yaw] of [['front', 0], ['tq', -0.65]] as const) {
      shot(`${k}-${sex}-${view}`, 260, 260, s => { const g = protoKeeper(lk, f); g.rotation.y = yaw; s.add(g); const hy = headY(g); return cam(18, 1, [0, hy + 0.04, 2.0], [0, hy - 0.03, 0]) })
    }
  }
  // game distance: both keepers 5 m out, eye-height camera (1.55 m), fov 70, 1:1 phone px (390 wide)
  shot(`${k}-game`, 390, 844, s => {
    s.background = new THREE.Color(0x9fc7e0)
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x7da35a })); gr.rotation.x = -Math.PI / 2; s.add(gr)
    const a = protoKeeper(MALE, f); a.position.set(-0.45, 0, 0); a.rotation.y = -0.3; s.add(a)
    const b = protoKeeper(FEMALE, f); b.position.set(0.45, 0, 0); b.rotation.y = 0.3; s.add(b)
    return cam(70, 390 / 844, [0, 1.55, 5], [0, 1.2, 0])
  })
}
// the six models: today's per-model head vs the universal head (face A)
const SIX: Look[] = [0, 1, 2].flatMap(fr => [0, 1].map(t => ({ ...MALE, frame: fr, torso: t, ...(t ? { hairStyle: 5, hair: 0, skin: 2, scarf: 1, topColor: 3 } : {}) })))
for (const [id, f] of [['six-today', null], ['six-uni', FACES.A]] as const) {
  shot(id, 1300, 420, s => { SIX.forEach((lk, i) => { const g = protoKeeper(lk, f); g.position.x = (i - 2.5) * 0.85; s.add(g) }); const c = new THREE.OrthographicCamera(-3.87, 3.87, 1.25, -1.25, 0.1, 50); c.position.set(0, 1.2, 10); c.lookAt(0, 1.2, 0); return c })
}
W.__done = true
