// M102 Vulnyx v2 look-proof renderer (headless). Bundled to an IIFE and run by v2render.mts; not part of the game.
import * as THREE from 'three'
import { buildVulnyx2 } from './vulnyx2'
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1)
const BG = 0x20160b
function shot(id: string, w: number, h: number, setup: (s: THREE.Scene) => THREE.PerspectiveCamera) {
  r.setSize(w, h); const s = new THREE.Scene(); s.background = new THREE.Color(BG); const c = setup(s); r.render(s, c)
  const cv = document.getElementById(id) as HTMLCanvasElement; cv.width = w; cv.height = h; cv.getContext('2d')!.drawImage(r.domElement, 0, 0)
}
const fox = (yaw: number) => { const v = buildVulnyx2(); v.group.rotation.y = yaw; return v }
const cam = (fov: number, a: number, p: [number, number, number], t: [number, number, number]) => { const c = new THREE.PerspectiveCamera(fov, a, 0.02, 80); c.position.set(...p); c.lookAt(...t); return c }
const W = (window as any)
const yawF = W.__yawF ?? -0.22
shot('front', 520, 520, s => { s.add(fox(yawF).group); return cam(20, 1, [0, 0.42, 2.25], [0.05, 0.33, 0]) })
shot('tq', 520, 520, s => { s.add(fox(-0.85).group); return cam(20, 1, [0, 0.5, 2.25], [0.0, 0.33, 0]) })
shot('face', 520, 520, s => { s.add(fox(yawF).group); return cam(20, 1, [0, 0.44, 1.2], [0.0, 0.43, 0]) })
shot('game', 390, 844, s => {
  s.background = new THREE.Color(0x9fc7e0); s.add(new THREE.HemisphereLight(0xffffff, 0x556644, 1))
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x7da35a })); gr.rotation.x = -Math.PI / 2; s.add(gr)
  const k = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.26, 4, 12), new THREE.MeshLambertMaterial({ color: 0x6b7a99 })); k.position.set(-0.7, 0.85, 0.3); s.add(k)
  const v = fox(-0.9); v.group.position.set(0.25, 0, 0.6); s.add(v.group)
  return cam(64, 390 / 844, [0, 2.4, 6.6], [0, 1.0, 0])
})
W.__tris = buildVulnyx2().tris
W.__done = true
