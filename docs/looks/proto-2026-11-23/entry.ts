import * as THREE from 'three'
import { buildKeeper } from '/root/ather-games/src/app/shimmer/open/shared/keeper-figure'
import { buildKeeper as buildAnime } from './keeper-anime'
import { DEFAULT_LOOK } from '/root/ather-games/src/app/shimmer/open/shared/keeper-look'
const W = 1200, Hh = 700
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, Hh); r.setClearColor(0xefe4cc); document.body.appendChild(r.domElement)
const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 0.6)); const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(2, 3, 4); scene.add(d)
const looks = [DEFAULT_LOOK, { ...DEFAULT_LOOK, hairStyle: 5, hair: 0, skin: 0, scarf: 1 }]
const place = (o: THREE.Object3D, x: number, yaw: number) => { o.position.x = x; o.rotation.y = yaw; scene.add(o) }
let x = -2.6
for (const lk of looks) {
  place(buildKeeper(lk).group, x, 0); place(buildKeeper(lk).group, x + 0.75, 0.6)
  place(buildAnime(lk).group, x + 1.7, 0); place(buildAnime(lk).group, x + 2.45, 0.6)
  x += 3.2
}
r.setScissorTest(true)
const shot = (cx: number, cy: number, hw: number, hh: number, vx: number, vy: number, vw: number, vh: number) => {
  const c = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 50); c.position.set(cx, cy, 10); c.lookAt(cx, cy, 0)
  r.setViewport(vx, vy, vw, vh); r.setScissor(vx, vy, vw, vh); r.render(scene, c)
}
shot(0.6, 1.05, 3.6, 1.2, 0, 300, 1200, 400)       // full bodies (top band)
shot(-1.3, 1.38, 1.0, 0.36, 0, 0, 600, 300)         // heads close: look 1 (classic | anime)
shot(1.9, 1.38, 1.0, 0.36, 600, 0, 600, 300)        // heads close: look 2; (window as any).__done = true
