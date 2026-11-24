// npx tsx docs/looks/rig-2026-11-24/tools/three-check.mts : the rigged glbs read by three's own GLTFLoader (what the game uses).
// 1 rest pose vs the live glb, vertex by vertex · 2 does a hull mesh that SHARES the skeleton follow (and what becomes of its
// 1.06 scale) · 3 nothing through the ground under AnimationMixer · 4 CPU ms for 20 bodies. Exits 1 on a failed check.
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
;(globalThis as any).self = globalThis
const here = new URL('..', import.meta.url).pathname, live = new URL('../../../../public/open/spirits/', import.meta.url).pathname
const load = (p: string) => new Promise<any>((ok, no) => { const b = fs.readFileSync(p); new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', ok, no) })
let bad = 0; const check = (n: string, ok: boolean, d: string) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
const v = new THREE.Vector3(), at = (m: THREE.SkinnedMesh, i: number) => { v.fromBufferAttribute(m.geometry.getAttribute('position') as any, i); m.applyBoneTransform(i, v); return v.clone().applyMatrix4(m.matrixWorld) }
async function main() {
for (const [n, H] of [['vulnyx', .70], ['manalotl', .90 / 1.29]] as const) {
  const A = await load(live + n + '.glb'), B = await load(here + n + '-rigged.glb'); B.scene.updateMatrixWorld(true)
  let worst = 0; A.scene.traverse((o: any) => { if (!o.isMesh) return; const m = B.scene.getObjectByName(o.name), p = o.geometry.getAttribute('position'); m.skeleton.update(); for (let i = 0; i < p.count; i++) worst = Math.max(worst, at(m, i).distanceTo(new THREE.Vector3().fromBufferAttribute(p, i))) })
  check(n + ' rest pose = live glb', worst < 1e-5, `max vertex difference ${(worst * H * 1000).toExponential(2)} mm`)
  const body = B.scene.getObjectByName('body') as THREE.SkinnedMesh, hull = new THREE.SkinnedMesh(body.geometry, body.material as any); hull.scale.setScalar(1.06); body.parent!.add(hull); hull.updateMatrixWorld(true); hull.bind(body.skeleton, new THREE.Matrix4())
  const mix = new THREE.AnimationMixer(B.scene), clip = (c: string) => B.animations.find((a: any) => a.name === c)
  mix.clipAction(clip('run')).play(); mix.setTime(clip('run').duration * .4); B.scene.updateMatrixWorld(true)
  let hd = 0, mv = 0; const rest = new THREE.Vector3(); for (let i = 0; i < 1800; i += 3) { hd = Math.max(hd, at(hull, i).distanceTo(at(body, i))); mv = Math.max(mv, at(body, i).distanceTo(rest.fromBufferAttribute(body.geometry.getAttribute('position') as any, i))) }
  check(n + ' hull sharing the skeleton follows the body', mv > .05 && hd < 1e-4, `body moved up to ${mv.toFixed(2)} units, hull off it by ${hd.toExponential(1)} (so the 1.06 mesh scale is CANCELLED in attached bind mode: s2 must push the hull out along normals in its shader)`)
  for (const c of ['idle', 'walk', 'run', 'sit']) { mix.stopAllAction(); mix.clipAction(clip(c)).reset().play(); let lo = 9; for (let k = 0; k < 24; k++) { mix.setTime(clip(c).duration * k / 24); B.scene.updateMatrixWorld(true); for (let i = 0; i < body.geometry.getAttribute('position').count; i++) lo = Math.min(lo, at(body, i).y) }
    check(`${n} ${c} nothing through the ground`, lo * H > -.004, `lowest ${(lo * H * 1000).toFixed(1)} mm`) }
  const N = 20, list = Array.from({ length: N }, (_, i) => { const s = clone(B.scene), m = new THREE.AnimationMixer(s); m.clipAction(clip('run')).play(); m.setTime(i * .03); const sk: THREE.Skeleton[] = []; s.traverse((o: any) => { if (o.isSkinnedMesh && !sk.includes(o.skeleton)) sk.push(o.skeleton) }); return { s, m, sk } })
  const one = () => { for (const b of list) { b.m.update(1 / 60); b.s.updateMatrixWorld(true); for (const k of b.sk) k.update() } }; for (let i = 0; i < 100; i++) one(); const t = performance.now(); for (let i = 0; i < 300; i++) one()
  console.log('NOTE', n, `20 bodies CPU ${((performance.now() - t) / 300).toFixed(2)} ms/frame on this box's node (mixer + matrices + ${list[0].sk.length} skeleton(s) each)`)
}
process.exit(bad ? 1 : 0) }
main()
