// M116b sheet renderer: mouth options + female torso options (headless; bundled to an IIFE by render2.mts). Not part of the game.
import * as THREE from 'three'
import { protoKeeper, FACES, MOUTHS, type Face } from './heads'
import { TORSOS, torsoKeeper } from './torso'
import { DEFAULT_LOOK, type Look } from '/root/ather-games/src/app/shimmer/open/shared/keeper-look'
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1)
const light = (s: THREE.Scene) => { s.add(new THREE.AmbientLight(0xffffff, 0.6)); const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(2, 3, 4); s.add(d) }
function shot(id: string, w: number, h: number, setup: (s: THREE.Scene) => THREE.Camera) {
  r.setSize(w, h); const s = new THREE.Scene(); s.background = new THREE.Color(0xefe4cc); light(s); const c = setup(s); r.render(s, c)
  const cv = document.getElementById(id) as HTMLCanvasElement; cv.width = w; cv.height = h; cv.getContext('2d')!.drawImage(r.domElement, 0, 0)
}
const cam = (fov: number, a: number, p: [number, number, number], t: [number, number, number]) => { const c = new THREE.PerspectiveCamera(fov, a, 0.02, 80); c.position.set(...p); c.lookAt(...t); return c }
const BUN = 6
const MALE: Look = { ...DEFAULT_LOOK, eyes: 2 }, FEMALE: Look = { ...DEFAULT_LOOK, torso: 1, hairStyle: 5, hair: 0, skin: 2, scarf: 1, topColor: 3, eyes: 2 }
const headY = (g: THREE.Group) => { g.updateMatrixWorld(true); return (g.getObjectByName('head') as THREE.Object3D).getWorldPosition(new THREE.Vector3()).y }
const ground = (s: THREE.Scene) => { s.background = new THREE.Color(0x9fc7e0); const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x7da35a })); gr.rotation.x = -Math.PI / 2; s.add(gr) }
// ── mouths: face A and D, male + female, close; then both faces at game distance ──
for (const [mk] of MOUTHS) {
  for (const fk of ['A', 'D'] as const) {
    const f: Face = { ...FACES[fk], mouth: mk }
    for (const [sex, lk] of [['m', MALE], ['f', FEMALE]] as const)
      shot(`m-${mk}-${fk}-${sex}`, 200, 200, s => { const g = protoKeeper(lk, f); s.add(g); const hy = headY(g); return cam(18, 1, [0, hy - 0.02, 1.25], [0, hy - 0.05, 0]) })
  }
  shot(`m-${mk}-game`, 390, 844, s => {
    ground(s)
    ;([[-0.9, MALE, 'A'], [-0.3, FEMALE, 'A'], [0.3, MALE, 'D'], [0.9, FEMALE, 'D']] as const).forEach(([x, lk, fk]) => { const g = protoKeeper(lk, { ...FACES[fk], mouth: mk }); g.position.x = x; s.add(g) })
    return cam(70, 390 / 844, [0, 1.55, 3], [0, 1.2, 0])
  })
}
// ── torsos: medium curved, front / side / 3/4 / back-3/4, + game distance next to a male ──
for (const o of TORSOS) {
  for (const [v, yaw] of [['front', 0], ['side', -Math.PI / 2], ['tq', -0.65]] as const)
    shot(`t-${o.key}-${v}`, 220, 330, s => { const g = torsoKeeper({ ...FEMALE, hairStyle: BUN }, o); g.rotation.y = yaw; if (v === 'side') for (const n of ['hand-l', 'hand-r']) g.getObjectByName(n)!.visible = false; s.add(g); g.updateMatrixWorld(true); const h = new THREE.Box3().setFromObject(g); const cy = (h.max.y + h.min.y) / 2; return cam(24, 220 / 330, [0, cy + 0.1, 3.4], [0, cy, 0]) })
  shot(`t-${o.key}-game`, 390, 844, s => {
    ground(s); const a = protoKeeper(MALE, FACES.A); a.position.x = -0.45; a.rotation.y = -0.3; s.add(a)
    const b = torsoKeeper(FEMALE, o); b.position.x = 0.45; b.rotation.y = 0.3; s.add(b)
    return cam(70, 390 / 844, [0, 1.55, 5], [0, 1.2, 0])
  })
}
;(window as any).__done = true
