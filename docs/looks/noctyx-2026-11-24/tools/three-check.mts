// npx tsx docs/looks/noctyx-2026-11-24/tools/three-check.mts : noctyx-rigged.glb through three GLTFLoader and the game own makeRigBody (read only)
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody, rigCount } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { RIG_CLIPS } from '../../../../src/app/shimmer/open/ather/spirit-rig'
;(globalThis as any).self = globalThis
const f = new URL('../noctyx-rigged.glb', import.meta.url).pathname, b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  let bad = 0; const ck = (n: string, ok: boolean, d = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
  ck('clips', [...RIG_CLIPS, 'lie', 'glide', 'hang'].every(c => g.animations.some((a: any) => a.name === c)), g.animations.map((a: any) => `${a.name} ${a.duration.toFixed(3)} s`).join(', '))
  ck('nodes', ['body', 'eyes', 'b_neck', 'b_head', 'b_root', 'b_lids', 'b_arm1_l'].every(n => g.scene.getObjectByName(n)))
  const H = .45, rig: any = { glbLen: .64, pivot: { x: 0, z: 0 }, clipV: { walk: .55 / H, run: 2.8 / H }, runAt: [1, .85], hull: .024, neck: 'b_neck', head: 'b_head' }, M = () => new THREE.MeshBasicMaterial()
  const r = makeRigBody(g, rig, { skin: M(), glow: null, halo: M(), eye: M() }), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  const scan = () => { let lo = 9, hi = -9, z0 = 9, z1 = -9; r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { r.at(p, i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z) } } return { lo: lo * H, hi: hi * H, len: (z1 - z0) * H } }
  for (const c of RIG_CLIPS) { const sp = c === 'walk' ? .55 : c === 'run' ? 2.8 : 0; for (let k = 0; k < 60; k++) r.step(1 / 30, c, sp / 30, H, o); let lo = 9, hi = 0, len = 0; for (let k = 0; k < 40; k++) { r.step(.131, c, sp * .131, H, o); const s = scan(); lo = Math.min(lo, s.lo); hi += s.hi / 40; len += s.len / 40 } ck(`game body plays ${c}`, lo > -.002, `lowest ${(lo * 1000).toFixed(1)} mm, mean height ${hi.toFixed(3)}, nose to tail ${len.toFixed(3)} m, cap bit ${r.state().capped}`) }
  for (const sp of [4.2, 6.5]) { r.step(1 / 60, 'run', sp / 60, H, o); ck(`fly at ${sp} m/s: cadence cap not hit`, !r.state().capped) }
  let lo = 9; const at: string[] = []
  for (const [a, c] of [['idle', 'lie'], ['lie', 'idle'], ['lie', 'run'], ['run', 'lie'], ['sit', 'lie'], ['idle', 'run'], ['idle', 'sit'], ['sit', 'idle'], ['sit', 'walk'], ['sit', 'run'], ['idle', 'walk'], ['walk', 'run'], ['run', 'walk'], ['run', 'idle'], ['run', 'sit']] as const) { const mv = (x: string) => x === 'run' ? .06 : x === 'walk' ? .018 : 0; let worst = 9
    for (let t = 0; t < 4; t++) { for (let k = 0; k < 40 + t * 3; k++) r.step(1 / 30, a, mv(a), H, o); for (let k = 0; k < 24; k++) { r.step(1 / 30, c, mv(c), H, o); worst = Math.min(worst, scan().lo) } } at.push(`${a}>${c} ${(worst * 1000).toFixed(1)}`) }
  ck('no blend sinks a foot (the game\'s own ground keep on)', at.every(x => +x.split(' ')[1] > -2.5), at.join(', '))
  for (const [cl, dt] of [['glide', .13], ['hang', .31]] as const) { const mx = new THREE.AnimationMixer(r.root); r.mixer.stopAllAction(); r.root.position.y = 0; const ac = mx.clipAction(g.animations.find((a: any) => a.name === cl)); ac.play(); lo = 9; let hi = 0; for (let k = 0; k < 26; k++) { mx.setTime(k * dt); const q = scan(); lo = Math.min(lo, q.lo); hi = Math.max(hi, q.hi) } ck(`${cl} plays (raw: not a game clip yet)`, lo > -.002 && (cl !== 'hang' || hi < .4975), `lowest ${(lo * 1000).toFixed(1)} mm, top ${hi.toFixed(3)} m`); ac.stop() }
  r.dispose(); ck('disposed', rigCount.live === 0); process.exit(bad ? 1 : 0) }, (e: any) => { console.error(e); process.exit(1) })
