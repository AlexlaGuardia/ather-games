// npx tsx docs/looks/m174-luminara-2026-11-27/tools/three-check.mts : luminara-rigged.glb through three GLTFLoader and the game own makeRigBody (read only).
// The Hovari hover contract (M173 s2): every clip and every blend hangs over 0.65 m, no clip keys b_hover, the game's `hover` rig field set; the glow part `lamp` mounts.
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody, rigCount } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { RIG_CLIPS } from '../../../../src/app/shimmer/open/ather/spirit-rig'
import { LUMINARA_RIG, LUMINARA_UNIT } from '../../../../src/app/shimmer/open/ather/spirit-base-preview'
;(globalThis as any).self = globalThis
const f = new URL('../luminara-rigged.glb', import.meta.url).pathname, b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  let bad = 0; const ck = (n: string, ok: boolean, d = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
  const mv = (clip: string, bn: string) => g.animations.find((a: any) => a.name === clip)?.tracks.some((t: any) => t.name.startsWith(bn + '.') && t.values.length > 3 && Math.max(...t.values) - Math.min(...t.values) > 1e-2)
  ck('clips', [...RIG_CLIPS].every(c => g.animations.some((a: any) => a.name === c)), g.animations.map((a: any) => `${a.name} ${a.duration.toFixed(3)} s`).join(', '))
  ck('nodes', ['body', 'eyes', 'lamp', 'b_neck', 'b_head', 'b_root', 'b_hover', 'b_hips', 'b_abd', 'b_chest', 'b_lids', 'b_lids_r', 'b_ant_l', 'b_ant2_r', 'b_fw_l', 'b_hw_r', 'b_arm_l'].every(n => g.scene.getObjectByName(n)))
  for (const bn of ['b_fw_l', 'b_hw_l', 'b_fw_r', 'b_hw_r']) ck(`wing ${bn} beats in every clip`, RIG_CLIPS.every(c => mv(c, bn)))
  for (const bn of ['b_ant2_l', 'b_ant2_r', 'b_abd']) ck(`idle moves ${bn} (antenna tips / the abdomen's lantern swing)`, !!mv('idle', bn))
  ck('no clip keys b_hover (the game may drive it)', g.animations.every((a: any) => !a.tracks.some((t: any) => t.name.startsWith('b_hover'))))
  const H = LUMINARA_UNIT, rig: any = LUMINARA_RIG, M = () => new THREE.MeshBasicMaterial()
  ck('the rig look is a hoverer (the Hovari contract) with its own culling', !!rig.hover && !!rig.cull && !rig.fly)
  const r = makeRigBody(g, rig, { skin: M(), glow: M(), halo: M(), eye: M() }, 'lamp'), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  ck('the glow part `lamp` mounts', !!r.meshes.lamp)
  const scan = () => { let lo = 9, hi = -9, z0 = 9, z1 = -9; r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes', 'lamp']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { r.at(p, i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z) } } return { lo: lo * H, hi: hi * H, len: (z1 - z0) * H } }
  for (const c of RIG_CLIPS) { const sp = c === 'walk' ? .8 : c === 'run' ? 4 : 0; for (let k = 0; k < 60; k++) r.step(1 / 30, c, sp / 30, H, o); let lo = 9, hi = 0, len = 0; for (let k = 0; k < 40; k++) { r.step(.131, c, sp * .131, H, o); const s = scan(); lo = Math.min(lo, s.lo); hi += s.hi / 40; len += s.len / 40 } ck(`game body plays ${c} in the air`, lo > .65, `lowest ${(lo * 1000).toFixed(1)} mm, mean top ${hi.toFixed(3)}, nose to tail ${len.toFixed(3)} m`) }
  for (const sp of [4.2, 6.5]) { r.step(1 / 60, 'run', sp / 60, H, o); ck(`dart at ${sp} m/s: cadence cap not hit`, !r.state().capped) }
  const at: string[] = []
  for (const [a, c] of [['idle', 'lie'], ['lie', 'idle'], ['lie', 'run'], ['run', 'lie'], ['sit', 'lie'], ['idle', 'run'], ['idle', 'sit'], ['sit', 'idle'], ['sit', 'walk'], ['sit', 'run'], ['idle', 'walk'], ['walk', 'run'], ['run', 'walk'], ['run', 'idle'], ['run', 'sit']] as const) { const mvv = (x: string) => x === 'run' ? .13 : x === 'walk' ? .027 : 0; let worst = 9
    for (let t = 0; t < 4; t++) { for (let k = 0; k < 40 + t * 3; k++) r.step(1 / 30, a, mvv(a), H, o); for (let k = 0; k < 24; k++) { r.step(1 / 30, c, mvv(c), H, o); worst = Math.min(worst, scan().lo) } } at.push(`${a}>${c} ${(worst * 1000).toFixed(1)}`) }
  ck('every blend stays over 0.65 m up (the game\'s own ground keep on: it never fires)', at.every(x => +x.split(' ')[1] > 650), at.join(', '))
  { r.root.updateMatrixWorld(true); const bb = new THREE.Box3(), c = new THREE.Sphere(new THREE.Vector3(...rig.cull.c), rig.cull.r), bx = new THREE.Box3(new THREE.Vector3(...rig.cull.min), new THREE.Vector3(...rig.cull.max)); let inS = true, inB = true
    for (const cl of RIG_CLIPS) for (let k = 0; k < 30; k++) { r.step(1 / 15, cl, 0, H, o); r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes', 'lamp']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i += 3) { r.at(p, i, v); v.divideScalar(1); bb.expandByPoint(v); if (!c.containsPoint(v)) inS = false; if (!bx.containsPoint(v)) inB = false } } }
    ck('her own culling sphere + box hold her in every clip', inS && inB, `bounds ${bb.min.toArray().map(x => x.toFixed(2))} .. ${bb.max.toArray().map(x => x.toFixed(2))}`) }
  r.dispose(); ck('disposed', rigCount.live === 0); process.exit(bad ? 1 : 0) }, (e: any) => { console.error(e); process.exit(1) })
