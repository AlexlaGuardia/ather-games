// npx tsx docs/looks/m202-luminara-line-2026-11-27/tools/three-check-ground.mts <earth|water> : the EGG forms (M202 v2, Alex 11-28: they lose their flight):
// her rigged glb through three GLTFLoader and the game's own makeRigBody (read only). GROUNDED: no hover / wing bones, the rig look not a hoverer,
// every clip's lowest point ON the ground (-3..+15 mm) and every blend over -5 mm (the game's ground keep handles the rest); the glow part `lamp` mounts.
import fs from 'node:fs'; import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { makeRigBody, rigCount } from '../../../../src/app/shimmer/open/ather/spirit-rig-body'
import { RIG_CLIPS } from '../../../../src/app/shimmer/open/ather/spirit-rig'
import { SECOND_FORMS } from '../../../../src/app/shimmer/open/ather/spirit-models'
import { LUMINARA_UNIT } from '../../../../src/app/shimmer/open/ather/spirit-base-preview'
const EL = (process.argv[2] ?? 'earth') as 'earth', LOOK = SECOND_FORMS.firefly![EL]!
;(globalThis as any).self = globalThis
const f = new URL(`../${LOOK.name}-rigged.glb`, import.meta.url).pathname, b = fs.readFileSync(f)
new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', (g: any) => {
  let bad = 0; const ck = (n: string, ok: boolean, d = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n, d) }
  const mv = (clip: string, bn: string) => g.animations.find((a: any) => a.name === clip)?.tracks.some((t: any) => t.name.startsWith(bn + '.') && t.values.length > 3 && Math.max(...t.values) - Math.min(...t.values) > 1e-2)
  ck('clips', [...RIG_CLIPS].every(c => g.animations.some((a: any) => a.name === c)), g.animations.map((a: any) => `${a.name} ${a.duration.toFixed(3)} s`).join(', '))
  ck('nodes', ['body', 'eyes', 'lamp', 'b_root', 'b_hips', 'b_abd', 'b_chest', 'b_neck', 'b_head', 'b_lids', 'b_lids_r', 'b_leg_l', 'b_leg_r'].every(n => g.scene.getObjectByName(n)))
  ck('no hover / wing / antenna / arm bone (wingless, grounded)', !['b_hover', 'b_fw_l', 'b_hw_l', 'b_ant_l', 'b_arm_l'].some(n => g.scene.getObjectByName(n)))
  for (const bn of ['b_leg_l', 'b_leg_r']) ck(`walk + run step ${bn}`, !!mv('walk', bn) && !!mv('run', bn))
  const H = LUMINARA_UNIT, rig: any = LOOK.rig, M = () => new THREE.MeshBasicMaterial()
  ck('the rig look is grounded (no hover, no fly, no own culling)', !rig.hover && !rig.cull && !rig.fly)
  const r = makeRigBody(g, rig, { skin: M(), glow: M(), halo: M(), eye: M() }, 'lamp'), v = new THREE.Vector3(), o = { look: 0, sniff: 0, tilt: 0 }
  ck('the glow part `lamp` mounts', !!r.meshes.lamp)
  const scan = () => { let lo = 9, hi = -9, z0 = 9, z1 = -9; r.root.updateMatrixWorld(true); for (const p of ['body', 'eyes', 'lamp']) { const n = r.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { r.at(p, i, v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z) } } return { lo: lo * H, hi: hi * H, len: (z1 - z0) * H } }
  for (const c of RIG_CLIPS) { const sp = c === 'walk' ? .5 : c === 'run' ? 1.2 : 0; for (let k = 0; k < 60; k++) r.step(1 / 30, c, sp / 30, H, o); let lo = 9, hi = 0, len = 0; for (let k = 0; k < 40; k++) { r.step(.131, c, sp * .131, H, o); const s = scan(); lo = Math.min(lo, s.lo); hi += s.hi / 40; len += s.len / 40 } ck(`game body plays ${c} on the ground`, lo > -.003 && lo < .015, `lowest ${(lo * 1000).toFixed(1)} mm, mean top ${hi.toFixed(3)}, nose to tail ${len.toFixed(3)} m`) }
  const at: string[] = []
  for (const [a, c] of [['idle', 'lie'], ['lie', 'idle'], ['lie', 'run'], ['run', 'lie'], ['sit', 'lie'], ['idle', 'run'], ['idle', 'sit'], ['sit', 'idle'], ['sit', 'walk'], ['sit', 'run'], ['idle', 'walk'], ['walk', 'run'], ['run', 'walk'], ['run', 'idle'], ['run', 'sit']] as const) { const mvv = (x: string) => x === 'run' ? .13 : x === 'walk' ? .027 : 0; let worst = 9
    for (let t = 0; t < 4; t++) { for (let k = 0; k < 40 + t * 3; k++) r.step(1 / 30, a, mvv(a), H, o); for (let k = 0; k < 24; k++) { r.step(1 / 30, c, mvv(c), H, o); worst = Math.min(worst, scan().lo) } } at.push(`${a}>${c} ${(worst * 1000).toFixed(1)}`) }
  ck('every blend stays over -5 mm (the game\'s ground keep lifts the rest)', at.every(x => +x.split(' ')[1] > -5), at.join(', '))
  r.dispose(); ck('disposed', rigCount.live === 0); process.exit(bad ? 1 : 0) }, (e: any) => { console.error(e); process.exit(1) })
