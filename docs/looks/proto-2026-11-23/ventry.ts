import * as THREE from 'three'
import { buildVulnyx } from './vulnyx'
const W = 1400, Hh = 520
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, Hh); document.body.appendChild(r.domElement)
r.setScissorTest(true)
const view = (bg: number, yaw: number, vx: number, camY = 0.3, dist = 2.1, side = false) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(1.5, 2.5, 3); scene.add(d)
  const v = buildVulnyx(); v.group.rotation.y = yaw; scene.add(v.group)
  const c = new THREE.PerspectiveCamera(30, 350 / 520, 0.05, 20); c.position.set(side ? dist : 0.07, camY + 0.05, side ? 0 : dist); c.lookAt(side ? 0 : 0.07, camY, 0)
  r.setViewport(vx, 0, 350, Hh); r.setScissor(vx, 0, 350, Hh); r.render(scene, c)
}
view(0x1e140a, 0.0, 350); view(0x1e140a, 0.55, 700); view(0xefe4cc, -0.6, 1050)
;(window as any).__done = true
