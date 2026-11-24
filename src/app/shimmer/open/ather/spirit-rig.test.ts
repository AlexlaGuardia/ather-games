// BETA M132 s2: the rigged Manalotl. Run: npx tsx src/app/shimmer/open/ather/spirit-rig.test.ts
// Reads the SHIPPED glb with three's own loader and drives the real body (spirit-rig-body.ts) with the real trot.
import * as fs from 'fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CADENCE_MAX, FADE, RIG_CLIPS, fadeWeights, gaitCycles, groundMoved, rigClip, strideLen, type RigClip } from './spirit-rig'
import { makeRigBody, rigCount, type RigBody, type RigGltf } from './spirit-rig-body'
import { MANALOTL_RIG, SPIRIT_MODELS, SPIRIT_RIGS, rigLook } from './spirit-models'
import { makeTrot, type SpiritNav, type TrotPose } from './spirit-trot'
import { GROWN } from '../../sprites/creature-size'
;(globalThis as unknown as { self: unknown }).self = globalThis
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const L = SPIRIT_RIGS.axolotl!, R = L.rig!, RA = R.runAt

// ── 1. clip choice, per trot state ──
const P = (mode: TrotPose['mode'], sit = 0) => ({ mode, sit })
for (const [m, sit, v, turn, want] of [['trot', 0, 0.42, 0, 'walk'], ['trot', 0, 0.62, 0, 'run'], ['follow', 0, 3, 0, 'run'], ['follow', 0, 0, 0, 'idle'], ['follow', 1, 0, 0, 'sit'], ['follow', 0, 0, 1, 'walk'],
  ['perch', 1, 0, 0, 'sit'], ['sit', 1, 0, 0, 'sit'], ['look', 0, 0, 0, 'idle'], ['sniff', 0, 0, 0, 'idle'], ['tilt', 0, 0, 0, 'idle'], ['check', 0, 0, 0, 'idle'], ['happy', 0, 0, 0, 'idle'],
  ['play', 0, 0.275, 0, 'walk'], ['play', 0, 0.575, 0, 'run'], ['hopDown', 0, 0, 0, 'run'], ['hopUp', 1, 0.4, 0, 'run']] as const)
  ok(rigClip(P(m, sit), v, turn, 'idle', RA) === want, `${m} sit ${sit} at ${v} m/s turn ${turn} plays ${want}, got ${rigClip(P(m, sit), v, turn, 'idle', RA)}`)
ok(rigClip(P('trot'), 0.47, 0, 'run', RA) === 'run' && rigClip(P('trot'), 0.47, 0, 'walk', RA) === 'walk', 'between the two speeds she keeps the gait she has (no flicker)')

// ── 2. feet by ground covered ──
const str = strideLen(R.clipV.walk, 0.5787, L.h)
ok(Math.abs(gaitCycles(0.42 / 60, 1 / 60, str).cycles * str - 0.42 / 60) < 1e-9, 'the clip moves on exactly the ground she covered: timeScale = real speed / clip speed')
ok(Math.abs(gaitCycles(0.42 / 60, 1 / 60, str).cycles * 0.5787 * 60 - 0.42 / (R.clipV.walk * L.h)) < 1e-3, 'as a timeScale: 0.42 m/s over the clip speed at her size')
ok(gaitCycles(4 / 60, 1 / 60, str).capped && Math.abs(gaitCycles(4 / 60, 1 / 60, str).cycles * 60 - CADENCE_MAX) < 1e-9, 'a 4 m/s catch-up caps at CADENCE_MAX strides/s and says so')
ok(gaitCycles(-0.01, 1 / 60, str).cycles < 0, 'backing off plays the gait backwards')
ok(groundMoved(0, 0.01, 0, 0) === 0.01 && groundMoved(0, -0.01, 0, 0) === -0.01 && Math.abs(groundMoved(0.01, 0, 0, 0) - 0.01) < 1e-12, 'forward +, backward -, sideways +')
ok(groundMoved(5, 0, 0, 0) === 0 && groundMoved(0, 0, 0, 0.1) > 0, 'a set-down is no step; a turn on the spot steps')
{ let w: Record<RigClip, number> = { idle: 1, walk: 0, run: 0, sit: 0 }, worst = 0
  for (const [c, n] of [['walk', 4], ['sit', 20], ['run', 50], ['idle', 2], ['sit', 60]] as const) for (let i = 0; i < n; i++) { w = fadeWeights(w, c, 1 / 60); worst = Math.max(worst, Math.abs(RIG_CLIPS.reduce((a, k) => a + w[k], 0) - 1), ...RIG_CLIPS.map(k => -w[k])) }
  ok(worst < 1e-9, `weights always sum to 1 (a clip always plays): off by ${worst}`); ok(w.sit === 1 && w.idle === 0, 'a fade ends')
  let n = 0; w = { idle: 0, walk: 0, run: 0, sit: 1 }; while (w.sit > 0 && n < 200) { w = fadeWeights(w, 'idle', 1 / 60); n++ } ok(n / 60 > 0.3 && n / 60 < 1, `getting up takes ${(n / 60).toFixed(2)} s, not a pop`)
  n = 0; w = { idle: 1, walk: 0, run: 0, sit: 0 }; while (w.sit < 1 && n < 200) { w = fadeWeights(w, 'sit', 1 / 60); n++ } ok(Math.abs(n / 60 - FADE.sit) < 0.05, `lying down takes ${(n / 60).toFixed(2)} s`) }

// ── 3. the switch: off = the very same look object ──
ok(rigLook('axolotl', SPIRIT_MODELS.axolotl!, false) === SPIRIT_MODELS.axolotl && rigLook('axolotl', SPIRIT_MODELS.axolotl!, true) === L, 'off = today\'s Manalotl, on = the rigged one')
ok(rigLook('fox', SPIRIT_MODELS.fox!, true) === SPIRIT_MODELS.fox, 'the Vulnyx is the same either way')
ok(SPIRIT_MODELS.axolotl!.rig === undefined && SPIRIT_MODELS.axolotl!.trot.planted === undefined && SPIRIT_MODELS.axolotl!.url === '/open/spirits/manalotl.glb', 'today\'s Manalotl carries none of it')
ok(L.trot.hopH === 0 && L.trot.squash === 0 && L.trot.speed === 0.42 && L.trot.dash === 0.62, 'she ambles: no hop, no squash, her own speeds')

// ── 4. the real glb ──
function mats() { const m = () => new THREE.MeshBasicMaterial(); return { skin: m(), glow: m(), halo: m(), eye: m() } }
const v = new THREE.Vector3(), v2 = new THREE.Vector3()
function place(b: RigBody, g: THREE.Group, x: number, z: number, yaw: number) { g.position.set(x, 0, z); g.rotation.y = yaw; g.updateMatrixWorld(true); void b }
function holder(b: RigBody) { const g = new THREE.Group(), s = new THREE.Group(); s.scale.setScalar(L.h); s.position.set(-R.pivot.x * L.h, 0, -R.pivot.z * L.h); s.add(b.root); g.add(s); return g }
function full(b: RigBody) { const bb = new THREE.Box3(); for (const p of ['body', 'frills', 'eyes']) { const n = b.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) bb.expandByPoint(b.at(p, i, v)) } return bb }
function main(gltf: RigGltf) {
  const b = makeRigBody(gltf, R, mats(), 'frills'), g = holder(b)
  const sk = new Set(Object.values(b.meshes).map(m => m.skeleton))
  ok(sk.size === 1 && Object.keys(b.meshes).length === 5 && b.bones.length === 27, `one skeleton for ${Object.keys(b.meshes).length} meshes (${sk.size}), ${b.bones.length} bones`)
  ok(!!b.bones.find(x => x.name === R.neck) && !!b.bones.find(x => x.name === R.head), 'the neck and head bones are there')
  ok(b.meshes.bodyHull.geometry === b.meshes.body.geometry && !!b.meshes.body.geometry.getAttribute('hullN'), 'the hull shares the body and has its own normals')
  // size: standing, over a whole idle clip
  const len: number[] = [], top: number[] = [], pl: number[] = []
  for (let k = 0; k < 64; k++) { b.step(1 / 8, 'idle', 0, L.h, { look: 0, sniff: 0, tilt: 0 }); g.updateMatrixWorld(true); const bb = full(b); len.push(bb.max.z - bb.min.z); top.push(bb.max.y); const s = b.size(L.h); pl.push(Math.abs(s.len - 2 * R.hull * L.h - (bb.max.z - bb.min.z))) }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length, gl = GROWN.axolotl.length!
  console.log(`   Manalotl rigged: ${avg(len).toFixed(3)} m nose to tail standing (${Math.min(...len).toFixed(3)}..${Math.max(...len).toFixed(3)}), ${avg(top).toFixed(3)} m tall (${Math.min(...top).toFixed(3)}..${Math.max(...top).toFixed(3)}), glb scale ${L.h.toFixed(4)}`)
  ok(Math.abs(avg(len) - gl) < 0.01 * gl, `she stands ${avg(len).toFixed(3)} m nose to tail, canon ${gl}`)
  ok(avg(top) > 0.33 && avg(top) < 0.45, `height ${avg(top).toFixed(3)} near canon 0.35`)
  ok(Math.max(...pl) < 0.012, `the probe's cheap box agrees with every vertex (${Math.max(...pl).toFixed(4)} m)`)

  // planted feet: a straight amble and a straight run, at three frame rates. A sole vertex is planted while it is in the bottom 4 mm
  const sole = (f: string) => { const bi = b.bones.findIndex(x => x.name === `b_${f}_paw`), geo = b.meshes.body.geometry, si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), ps = geo.getAttribute('position'), all: number[] = []
    for (let i = 0; i < ps.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k); if (w > 0.99) all.push(i) }
    const lo = Math.min(...all.map(i => ps.getY(i))); return all.filter(i => ps.getY(i) < lo + 0.03) }
  for (const [clip, speed] of [['walk', 0.42], ['run', 0.62]] as const) for (const fps of [60, 24, 10]) {
    for (let k = 0; k < 40; k++) b.step(1 / 30, clip, speed / 30, L.h, { look: 0, sniff: 0, tilt: 0 })
    let z = 0, drift = 0, legs = 0; const st: Record<string, { y0: number; from: THREE.Vector3 | null; ys: number[]; zs: number[] }> = {}
    for (const f of ['fl', 'fr', 'hl', 'hr']) st[f] = { y0: Infinity, from: null, ys: [], zs: [] }
    const track: Record<string, { p: THREE.Vector3; rel: number; x: number }[]> = { fl: [], fr: [], hl: [], hr: [] }
    for (let k = 0; k < fps * 3; k++) { z += speed / fps; b.step(1 / fps, clip, speed / fps, L.h, { look: 0, sniff: 0, tilt: 0 }); place(b, g, 0, z, 0)
      for (const f in st) { const c = new THREE.Vector3(); const s = sole(f).slice(0, 12); for (const i of s) c.add(b.at('body', i, v)); c.divideScalar(s.length); track[f].push({ p: c, rel: c.z - z, x: 0 }) } }
    for (const f in track) { const lo = Math.min(...track[f].map(q => q.p.y)); legs = Math.max(legs, Math.max(...track[f].map(q => q.rel)) - Math.min(...track[f].map(q => q.rel))); let from: THREE.Vector3 | null = null
      for (const q of track[f]) { if (q.p.y < lo + 0.002) { if (from) drift = Math.max(drift, Math.hypot(q.p.x - from.x, q.p.z - from.z)); else from = q.p } else from = null } }
    ok(drift < 0.006, `${clip} ${speed} m/s at ${fps} fps: planted foot drift ${(drift * 1000).toFixed(1)} mm`); ok(legs > 0.06, `${clip}: the legs swing ${(legs * 1000).toFixed(0)} mm`)
    if (fps === 60) console.log(`   ${clip} ${speed} m/s: planted drift ${(drift * 1000).toFixed(1)} mm, leg swing ${(legs * 1000).toFixed(0)} mm, ${(speed / strideLen(R.clipV[clip], gltf.animations.find(a => a.name === clip)!.duration, L.h)).toFixed(2)} strides/s`)
  }
  place(b, g, 0, 0, 0)
  // tail behind while walking: from the tail's root to its tip, in plan
  { let worst = 0; for (let k = 0; k < 40; k++) { b.step(1 / 30, 'walk', 0.42 / 30, L.h, { look: 0, sniff: 0, tilt: 0 }); g.updateMatrixWorld(true); const a = b.bones.find(x => x.name === 'b_tail1')!.getWorldPosition(v), e = b.bones.find(x => x.name === 'b_tail7')!.getWorldPosition(v2); worst = Math.max(worst, Math.abs(Math.atan2(e.x - a.x, -(e.z - a.z)))) }
    ok(worst < 0.35, `the tail trails behind: up to ${(worst * 57.3).toFixed(1)} deg off straight back`) }
  // head turns on top of a clip, and come off again (nothing accumulates)
  { const head = b.bones.find(x => x.name === R.head)!, run = (o: { look: number; sniff: number; tilt: number }, n: number) => { for (let k = 0; k < n; k++) b.step(1 / 30, 'sit', 0, L.h, o); g.updateMatrixWorld(true); return head.getWorldQuaternion(new THREE.Quaternion()) }
    run({ look: 0, sniff: 0, tilt: 0 }, 90); const t0 = b.state(); void t0
    const q1 = run({ look: 0.5, sniff: 0, tilt: 0.8 }, 1), q2 = run({ look: 0.5, sniff: 0, tilt: 0.8 }, 60), q3 = run({ look: 0, sniff: 0, tilt: 0 }, 210)
    ok(q1.angleTo(q2) < 0.4, `a held look does not wind up (${q1.angleTo(q2).toFixed(2)} rad over 2 s)`); ok(q3.angleTo(q2) > 0.2, 'and it comes off') }
  // nothing under the ground: every clip + the sniff at its deepest
  for (const [c, o] of [['idle', { look: 0, sniff: 0, tilt: 0 }], ['idle', { look: 0.5, sniff: 1, tilt: 0 }], ['sit', { look: 0.5, sniff: 0, tilt: 1 }], ['walk', { look: 0, sniff: 0, tilt: 0 }]] as const) {
    for (let k = 0; k < 40; k++) b.step(1 / 30, c, c === 'walk' ? 0.014 : 0, L.h, o); let lo = 9, hi = 0
    for (let k = 0; k < 16; k++) { b.step(0.4, c, c === 'walk' ? 0.01 : 0, L.h, o); g.updateMatrixWorld(true); const bb = full(b); lo = Math.min(lo, bb.min.y); hi = Math.max(hi, bb.max.y) }
    ok(lo > -0.006, `${c} ${JSON.stringify(o)} lowest ${(lo * 1000).toFixed(1)} mm`)
  }
  // blends sit <-> stand: nothing far under the ground on the way
  { let lo = 9; for (let r = 0; r < 2; r++) for (const c of ['sit', 'idle'] as const) for (let k = 0; k < 40; k++) { b.step(1 / 30, c, 0, L.h, { look: 0, sniff: 0, tilt: 0 }); if (k % 3) continue; g.updateMatrixWorld(true); lo = Math.min(lo, full(b).min.y) } ok(lo > -0.02, `lying down / getting up: lowest ${(lo * 1000).toFixed(1)} mm`) }

  // two stand together, each on her own; both gone after dispose
  const b2 = makeRigBody(gltf, R, mats(), 'frills'), g2 = holder(b2)
  for (let k = 0; k < 60; k++) { b.step(1 / 30, 'sit', 0, L.h, { look: 0, sniff: 0, tilt: 0 }); b2.step(1 / 30, 'idle', 0, L.h, { look: 0, sniff: 0, tilt: 0 }) }
  g.updateMatrixWorld(true); g2.updateMatrixWorld(true)
  const z = (x: RigBody) => { const bb = full(x); return bb.max.z - bb.min.z }
  ok(b.bones[5] !== b2.bones[5] && z(b2) - z(b) > 0.2 && b.meshes.body.geometry === b2.meshes.body.geometry, `one lies while the other stands (${z(b).toFixed(2)} / ${z(b2).toFixed(2)} m), one geometry`)
  b2.skeleton.computeBoneTexture(); let texGone = 0; b2.skeleton.boneTexture!.addEventListener('dispose', () => texGone++)
  b.dispose(); b2.dispose(); b2.dispose()
  ok(rigCount.live === 0 && rigCount.disposed === 2 && rigCount.made === 2, `despawned: ${JSON.stringify(rigCount)}`); ok(texGone === 1 && b2.skeleton.boneTexture === null, 'the bone texture is freed'); ok((b2.mixer as unknown as { _actions: unknown[] })._actions.length === 0 && !b2.root.parent, 'the mixer is empty and the body is out of the scene')

  // the trot with her dials: never sideways while ambling off, never moving while lying; y stays 0 on the ground
  const nav: SpiritNav = { home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: (x, z2) => Math.hypot(x, z2) > 8, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }
  for (const seed of [1, 7, 42]) { const tr = makeTrot(nav, seed, L.trot); let side = 0, lie = 0, up = 0, moved = 0, prev = { ...tr.pose() }, seen = new Set<RigClip>(), clip: RigClip = 'idle'; const dt = 1 / 60
    for (let k = 0; k < 60 * 120; k++) { const p = tr.step(dt), d = Math.hypot(p.x - prev.x, p.z - prev.z)
      if (p.mode === 'trot') { const a = Math.atan2(p.x - prev.x, p.z - prev.z), off = Math.abs(Math.atan2(Math.sin(a - (p.yaw - p.look)), Math.cos(a - (p.yaw - p.look)))); if (off > 0.6) side += d; if (p.sit > 0.5) lie += d; moved += d; up = Math.max(up, p.y) }
      clip = rigClip(p, d / dt, 0, clip, RA); seen.add(clip); prev = { ...p } }
    ok(moved > 3, `seed ${seed}: she gets about (${moved.toFixed(1)} m)`); ok(side < moved * 0.08, `seed ${seed}: ${(side / moved * 100).toFixed(1)}% of her way is sideways`); ok(lie < 0.02, `seed ${seed}: she lies and moves ${lie.toFixed(3)} m`); ok(up === 0, `seed ${seed}: no hop in her amble`)
    ok(seen.size === 4, `seed ${seed}: all four clips over two minutes (${[...seen]})`) }
  console.log(`spirit-rig: ${pass}/${fails.length}`); if (fails.length) { for (const f of fails) console.error('   x ' + f); process.exit(1) }
}
const buf = fs.readFileSync(`${__dirname}/../../../../../public${L.url}`)
new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', g => main(g as unknown as RigGltf), e => { console.error(e); process.exit(1) })
