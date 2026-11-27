// npx tsx docs/looks/m202-hovari-redo-2026-11-27/tools/idle-tall.mts <form-rigged.glb> : her body's mean height over the idle clip
// (top - lowest of the skinned body, every 3rd vertex: the same read as scripts/m202-forms-check.mts), glb units = HOV_GLB_TALL
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { HOVARI_RIG } from '../../../../src/app/shimmer/open/ather/spirit-models'
;(globalThis as any).self = globalThis
const f = process.argv[2], CL = process.argv[3] ?? 'idle', b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  const H = 1, rig: any = process.env.GAME_RIG ? HOVARI_RIG : { glbLen: .92, pivot: { x: 0, z: 0 }, clipV: { walk: .8 / .219, run: 4 / .219 }, runAt: [1, .85], hull: .024, neck: 'b_neck', head: 'b_head' }, M = () => new THREE.MeshBasicMaterial()
  const r = makeRigBody(g, rig, { skin: M(), glow: M(), halo: M(), eye: M() }, 'shimmer'), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  for (let k = 0; k < 60; k++) r.step(1 / 30, CL, CL === 'walk' ? .027 : 0, H, o)
  let sum = 0, n = 0; const ps = r.meshes.body.geometry.getAttribute('position')
  for (let k = 0; k < 400; k++) { r.step(1 / 60, CL, CL === 'walk' ? .013 : 0, H, o); r.root.updateMatrixWorld(true); let lo = 1e9, hi = -1e9; for (let i = 0; i < ps.count; i += 3) { r.at('body', i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y) } sum += hi - lo; n++ }
  console.log(f.split('/').pop(), CL, (sum / n).toFixed(3)); r.dispose(); process.exit(0) }, (e: any) => { console.error(e); process.exit(1) })
