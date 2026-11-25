// npx tsx docs/looks/hovari-2026-11-24/tools/three-check.mts : hovari-rigged.glb through three GLTFLoader and the game own makeRigBody (read only)
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody, rigCount } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { RIG_CLIPS } from '../../../../src/app/shimmer/open/ather/spirit-rig'
;(globalThis as any).self = globalThis
const f = new URL('../hovari-rigged.glb', import.meta.url).pathname, b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  let bad = 0; const ck = (n: string, ok: boolean, d = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
  ck('clips', [...RIG_CLIPS, 'lie', 'glance'].every(c => g.animations.some((a: any) => a.name === c)), g.animations.map((a: any) => `${a.name} ${a.duration.toFixed(3)} s`).join(', '))
  ck('nodes', ['body', 'eyes', 'b_neck', 'b_head', 'b_root', 'b_lids', 'b_arm_l', 'b_hover', 'shimmer'].every(n => g.scene.getObjectByName(n)))
  const H = .230, rig: any = { glbLen: .92, pivot: { x: 0, z: 0 }, clipV: { walk: .8 / H, run: 4 / H }, runAt: [1, .85], hull: .024, neck: 'b_neck', head: 'b_head' }, M = () => new THREE.MeshBasicMaterial()
  const r = makeRigBody(g, rig, { skin: M(), glow: M(), halo: M(), eye: M() }, 'shimmer'), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  const scan = () => { let lo = 9, hi = -9, z0 = 9, z1 = -9; r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes', 'shimmer']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { r.at(p, i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z) } } return { lo: lo * H, hi: hi * H, len: (z1 - z0) * H } }
  for (const c of RIG_CLIPS) { const sp = c === 'walk' ? .8 : c === 'run' ? 4 : 0; for (let k = 0; k < 60; k++) r.step(1 / 30, c, sp / 30, H, o); let lo = 9, hi = 0, len = 0; for (let k = 0; k < 40; k++) { r.step(.131, c, sp * .131, H, o); const s = scan(); lo = Math.min(lo, s.lo); hi += s.hi / 40; len += s.len / 40 } ck(`game body plays ${c}`, lo > .35, `lowest ${(lo * 1000).toFixed(1)} mm, mean height ${hi.toFixed(3)}, nose to tail ${len.toFixed(3)} m, cap bit ${r.state().capped}`) }
  for (const sp of [4.2, 6.5]) { r.step(1 / 60, 'run', sp / 60, H, o); ck(`dart at ${sp} m/s: cadence cap not hit`, !r.state().capped) }
  let lo = 9; const at: string[] = []
  for (const [a, c] of [['idle', 'lie'], ['lie', 'idle'], ['lie', 'run'], ['run', 'lie'], ['sit', 'lie'], ['idle', 'run'], ['idle', 'sit'], ['sit', 'idle'], ['sit', 'walk'], ['sit', 'run'], ['idle', 'walk'], ['walk', 'run'], ['run', 'walk'], ['run', 'idle'], ['run', 'sit']] as const) { const mv = (x: string) => x === 'run' ? .13 : x === 'walk' ? .027 : 0; let worst = 9
    for (let t = 0; t < 4; t++) { for (let k = 0; k < 40 + t * 3; k++) r.step(1 / 30, a, mv(a), H, o); for (let k = 0; k < 24; k++) { r.step(1 / 30, c, mv(c), H, o); worst = Math.min(worst, scan().lo) } } at.push(`${a}>${c} ${(worst * 1000).toFixed(1)}`) }
  ck('every blend stays over 0.35 m up (the game\'s own ground keep on: it never fires)', at.every(x => +x.split(' ')[1] > 350), at.join(', '))
  { const mx = new THREE.AnimationMixer(r.root); r.mixer.stopAllAction(); r.root.position.y = 0; const ac = mx.clipAction(g.animations.find((a: any) => a.name === 'glance')); ac.play(); lo = 9; for (let k = 0; k < 26; k++) { mx.setTime(k * .07); lo = Math.min(lo, scan().lo) } ck('glance plays (raw: not a game clip yet)', lo > .35, `lowest ${(lo * 1000).toFixed(1)} mm`)
    ck('no clip keys b_hover (the game may drive it)', g.animations.every((a: any) => !a.tracks.some((t: any) => t.name.startsWith('b_hover'))))
    r.root.updateMatrixWorld(true); const c = new THREE.Vector3(); r.meshes.body.geometry.computeBoundingSphere(); c.copy(r.meshes.body.geometry.boundingSphere!.center); console.log('NOTE culling: the game sphere is (0, 0.45, -0.4) r 1.5; hers sits at', c.toArray().map((x: number) => x.toFixed(2)).join(', '), '(glb units): needs a per-rig sphere') }
  r.dispose(); ck('disposed', rigCount.live === 0); process.exit(bad ? 1 : 0) }, (e: any) => { console.error(e); process.exit(1) })
