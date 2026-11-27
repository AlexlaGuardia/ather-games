// npx tsx docs/looks/m174-croakling-2026-11-27/tools/three-check.mts : croakling-rigged.glb through three GLTFLoader and the game own makeRigBody (read only)
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody, rigCount } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { RIG_CLIPS } from '../../../../src/app/shimmer/open/ather/spirit-rig'
;(globalThis as any).self = globalThis
const f = new URL('../croakling-rigged.glb', import.meta.url).pathname, b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  let bad = 0; const ck = (n: string, ok: boolean, d = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
  const mv = (bn: string) => g.animations.find((a: any) => a.name === 'idle')?.tracks.some((t: any) => t.name.startsWith(bn + '.') && t.values.length > 3 && Math.max(...t.values) - Math.min(...t.values) > 1e-2)
  for (const bn of ['b_lure', 'b_lure2', 'b_lure3']) ck(`the lure (canon signature) has its own bone ${bn} and idle moves it`, !!g.scene.getObjectByName(bn) && !!mv(bn))
  { const orb = new THREE.Vector3(), lo = new THREE.Vector3(9, 9, 9), hi = new THREE.Vector3(-9, -9, -9), mx = new THREE.AnimationMixer(g.scene), ac = mx.clipAction(g.animations.find((a: any) => a.name === 'idle')); ac.play(); const b3 = g.scene.getObjectByName('b_lure3')
    for (let k = 0; k < 80; k++) { mx.update(.1); g.scene.updateMatrixWorld(true); b3.getWorldPosition(orb); lo.min(orb); hi.max(orb) } mx.stopAllAction(); g.scene.traverse((o: any) => { if (o.isBone && o.userData.rest) { o.position.copy(o.userData.rest[0]); o.quaternion.copy(o.userData.rest[1]) } })
    ck('idle swings the lantern tip through space (three AnimationMixer, world travel of b_lure3)', hi.distanceTo(lo) > .02, `travel ${hi.distanceTo(lo).toFixed(3)} glb units`) } ck('clips', [...RIG_CLIPS].every(c => g.animations.some((a: any) => a.name === c)), g.animations.map((a: any) => `${a.name} ${a.duration.toFixed(3)} s`).join(', '))
  ck('nodes', ['body', 'eyes', 'b_neck', 'b_head', 'b_root', 'b_lids', 'b_lids_r', 'b_throat', 'b_hips', 'b_chest', 'b_arm_l', 'b_paw_r', 'b_thigh_r', 'b_foot_l'].every(n => g.scene.getObjectByName(n)))
  const H = .4015, rig: any = { glbLen: 0.732, pivot: { x: 0, z: 0 }, clipV: { walk: .55 / H, run: 2.4 / H }, runAt: [0.9, 0.75], hull: .024, neck: 'b_neck', head: 'b_head', lie: true, cadence: 12 }, M = () => new THREE.MeshBasicMaterial()
  const r = makeRigBody(g, rig, { skin: M(), glow: null, halo: M(), eye: M() }), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  const scan = () => { let lo = 9, hi = -9, z0 = 9, z1 = -9; r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { r.at(p, i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z) } } return { lo: lo * H, hi: hi * H, len: (z1 - z0) * H } }
  for (const c of RIG_CLIPS) { const sp = c === 'walk' ? .55 : c === 'run' ? 2.4 : 0; for (let k = 0; k < 60; k++) r.step(1 / 30, c, sp / 30, H, o); let lo = 9, hi = 0, len = 0; for (let k = 0; k < 40; k++) { r.step(.131, c, sp * .131, H, o); const s = scan(); lo = Math.min(lo, s.lo); hi += s.hi / 40; len += s.len / 40 } ck(`game body plays ${c}`, lo > -.002, `lowest ${(lo * 1000).toFixed(1)} mm, mean height ${hi.toFixed(3)}, nose to tail ${len.toFixed(3)} m, cap bit ${r.state().capped}`) }
  for (const [c, sp] of [['walk', 1.15], ['run', 1.92], ['run', 2.8], ['run', 3.3]] as const) { r.step(1 / 60, c, sp / 60, H, o); ck(`${c} at ${sp} m/s: cadence cap not hit`, !r.state().capped) }
  for (const sp of [4.2, 6.5]) { r.step(1 / 60, 'run', sp / 60, H, o); console.log('NOTE run at', sp, 'm/s: cap hit', r.state().capped) }
  let lo = 9; const at: string[] = []
  for (const [a, c] of [['idle', 'lie'], ['lie', 'idle'], ['lie', 'run'], ['run', 'lie'], ['sit', 'lie'], ['idle', 'run'], ['idle', 'sit'], ['sit', 'idle'], ['sit', 'walk'], ['sit', 'run'], ['idle', 'walk'], ['walk', 'run'], ['run', 'walk'], ['run', 'idle'], ['run', 'sit']] as const) { const mv = (x: string) => x === 'run' ? .09 : x === 'walk' ? .033 : 0; let worst = 9
    for (let t = 0; t < 4; t++) { for (let k = 0; k < 40 + t * 3; k++) r.step(1 / 30, a, mv(a), H, o); for (let k = 0; k < 24; k++) { r.step(1 / 30, c, mv(c), H, o); worst = Math.min(worst, scan().lo) } } at.push(`${a}>${c} ${(worst * 1000).toFixed(1)}`) }
  ck('no blend sinks a foot (the game\'s own ground keep on)', at.every(x => +x.split(' ')[1] > -2.5), at.join(', '))
  r.dispose(); ck('disposed', rigCount.live === 0); process.exit(bad ? 1 : 0) }, (e: any) => { console.error(e); process.exit(1) })
