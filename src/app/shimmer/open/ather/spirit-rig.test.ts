// BETA M132 s2 + M102: the rigged Manalotl and the rigged Vulnyx, the same path. Run: npx tsx src/app/shimmer/open/ather/spirit-rig.test.ts
// Reads the SHIPPED glb with three's own loader and drives the real body (spirit-rig-body.ts) with the real trot.
import * as fs from 'fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CADENCE_MAX, FADE, RIG_CLIPS, STAND, fadeWeights, gaitCycles, groundMoved, rigClip, strideLen, type RigClip } from './spirit-rig'
import { makeRigBody, rigCount, type RigBody, type RigGltf } from './spirit-rig-body'
import { MANALOTL_RIG, SPIRIT_MODELS, SPIRIT_RIGS, rigLook } from './spirit-models'
import { makeTrot, type SpiritNav, type TrotPose } from './spirit-trot'
import { makeFormation } from '../shared/follow-formation'
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
{ let w: Record<RigClip, number> = { ...STAND }, worst = 0
  for (const [c, n] of [['walk', 4], ['sit', 20], ['run', 50], ['idle', 2], ['sit', 60]] as const) for (let i = 0; i < n; i++) { w = fadeWeights(w, c, 1 / 60); worst = Math.max(worst, Math.abs(RIG_CLIPS.reduce((a, k) => a + w[k], 0) - 1), ...RIG_CLIPS.map(k => -w[k])) }
  ok(worst < 1e-9, `weights always sum to 1 (a clip always plays): off by ${worst}`); ok(w.sit === 1 && w.idle === 0, 'a fade ends')
  let n = 0; w = { ...STAND, idle: 0, sit: 1 }; while (w.sit > 0 && n < 200) { w = fadeWeights(w, 'idle', 1 / 60); n++ } ok(n / 60 > 0.3 && n / 60 < 1, `getting up takes ${(n / 60).toFixed(2)} s, not a pop`)
  n = 0; w = { ...STAND }; while (w.sit < 1 && n < 200) { w = fadeWeights(w, 'sit', 1 / 60); n++ } ok(Math.abs(n / 60 - FADE.sit) < 0.05, `lying down takes ${(n / 60).toFixed(2)} s`) }

// ── 3. the switch: off = the very same look object ──
ok(rigLook('axolotl', SPIRIT_MODELS.axolotl!, false) === SPIRIT_MODELS.axolotl && rigLook('axolotl', SPIRIT_MODELS.axolotl!, true) === L, 'off = today\'s Manalotl, on = the rigged one')
ok(rigLook('fox', SPIRIT_MODELS.fox!, false) === SPIRIT_MODELS.fox && rigLook('fox', SPIRIT_MODELS.fox!, true) === SPIRIT_RIGS.fox, 'off = today\'s Vulnyx, on = the rigged one')
ok(SPIRIT_MODELS.fox!.rig === undefined && SPIRIT_MODELS.fox!.trot.planted === undefined && SPIRIT_MODELS.fox!.url === '/open/spirits/vulnyx.glb' && SPIRIT_MODELS.fox!.ears === true, 'today\'s Vulnyx carries none of it')
ok(rigLook('owl', SPIRIT_MODELS.fox!, true) === SPIRIT_MODELS.fox, 'a species with no rig keeps the look it has')
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
}
// ── 5. the Vulnyx: the same body, the same clip rule, her own numbers ──
const FX = SPIRIT_RIGS.fox!, FR = FX.rig!, NO = { look: 0, sniff: 0, tilt: 0 }
for (const [m, sit, lie, v0, turn, want] of [['trot', 0, false, 1.3, 0, 'run'], ['trot', 0, false, 1.92, 0, 'run'], ['trot', 0, false, 0.4, 0, 'walk'], ['follow', 0, false, 4.2, 0, 'run'], ['follow', 0, false, 0, 0, 'idle'], ['follow', 0, false, 0, 1, 'walk'],
  ['follow', 1, false, 0, 0, 'sit'], ['follow', 1, true, 0, 0, 'lie'], ['perch', 1, false, 0, 0, 'sit'], ['sit', 1, false, 0, 0, 'sit'], ['look', 0, false, 0, 0, 'idle'], ['sniff', 0, false, 0, 0, 'idle'], ['happy', 0, false, 0, 0, 'idle'],
  ['play', 0, false, 1.4, 0, 'run'], ['hopDown', 0, false, 0, 0, 'run'], ['hopUp', 1, true, 0, 0, 'run']] as const) {
  const got = rigClip({ mode: m, sit, lie }, v0, turn, 'idle', FR.runAt, FR.lie); ok(got === want, `Vulnyx ${m} sit ${sit} lie ${lie} at ${v0} plays ${want}, got ${got}`) }
ok(rigClip({ mode: 'follow', sit: 1, lie: true }, 0, 0, 'idle', RA, R.lie) === 'sit', 'a nap is the sit clip where the glb has no lie (the Manalotl)')
ok(FX.trot.hopH === 0 && FX.trot.squash === 0 && FX.trot.stretch === 0 && FX.trot.lean === 0 && FX.trot.planted === 1, 'no hop fighting the gait')
for (const k of ['speed', 'dash', 'playH', 'happyH', 'glance', 'lookS', 'toyLean'] as const) ok(JSON.stringify(FX.trot[k]) === JSON.stringify(SPIRIT_MODELS.fox!.trot[k]), `her manner is unchanged: ${k}`)

function vulnyx(gltf: RigGltf) {
  const made0 = rigCount.made, b = makeRigBody(gltf, FR, mats()), g = new THREE.Group(), sc = new THREE.Group()
  sc.scale.setScalar(FX.h); sc.position.set(-FR.pivot.x * FX.h, 0, -FR.pivot.z * FX.h); sc.add(b.root); g.add(sc)
  const at0 = (x: number, y: number, z: number, yaw: number) => { g.position.set(x, y, z); g.rotation.y = yaw; g.updateMatrixWorld(true) }
  const box = () => { g.updateMatrixWorld(true); const bb = new THREE.Box3(); for (const p of ['body', 'eyes']) { const n = b.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) bb.expandByPoint(b.at(p, i, v)) } return bb }
  ok(b.bones.length === 24 && new Set(Object.values(b.meshes).map(m => m.skeleton)).size === 1 && Object.keys(b.meshes).join() === 'body,bodyHull,eyes', `Vulnyx: 24 bones, one skeleton, body + hull + eyes, no glow part (${b.bones.length}, ${Object.keys(b.meshes)})`)
  ok(!!b.bones.find(x => x.name === FR.neck) && !!b.bones.find(x => x.name === FR.head) && gltf.animations.some(a => a.name === 'lie'), 'Vulnyx: neck, head, lie clip')
  const len: number[] = [], top: number[] = [], avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  for (let k = 0; k < 64; k++) { b.step(1 / 8, 'idle', 0, FX.h, NO); const bb = box(); len.push(bb.max.z - bb.min.z); top.push(bb.max.y) }
  console.log(`   Vulnyx rigged: ${avg(top).toFixed(3)} m tall standing, ${avg(len).toFixed(3)} m nose to tail`)
  ok(Math.abs(avg(top) - GROWN.fox.height) < 0.01 * GROWN.fox.height, `Vulnyx stands ${avg(top).toFixed(3)} m, canon ${GROWN.fox.height}`)
  ok(Math.abs(avg(len) / FX.h - FR.glbLen) < 0.01, `Vulnyx glbLen ${(avg(len) / FX.h).toFixed(3)}`); ok(Math.abs(avg(len) - 1.03) < 0.02, `Vulnyx ${avg(len).toFixed(3)} m nose to tail (1.03)`)
  // planted feet: her walk, her trot speeds, her own run speed, a keeper's walk (4.2) and sprint (6.5)
  const sole = (f: string) => { const bi = b.bones.findIndex(x => x.name === `b_${f}_paw`), geo = b.meshes.body.geometry, si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), ps = geo.getAttribute('position'), all: number[] = []
    for (let i = 0; i < ps.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k); if (w > 0.99) all.push(i) }
    const lo = Math.min(...all.map(i => ps.getY(i))); return all.filter(i => ps.getY(i) < lo + 0.03) }
  const soles = Object.fromEntries(['fl', 'fr', 'hl', 'hr'].map(f => [f, sole(f)]))
  for (const [clip, speed] of [['walk', 0.55], ['run', 1.3], ['run', 1.92], ['run', 2.8], ['run', 4.2], ['run', 6.5], ['run', 9]] as const) for (const fps of [120, 60]) {
    for (let k = 0; k < 40; k++) b.step(1 / 60, clip, speed / 60, FX.h, NO)
    let z = 0, drift = 0, capped = 0, swing = 0, held = 0, tail = 0; const tr: Record<string, { p: THREE.Vector3; rel: number }[]> = { fl: [], fr: [], hl: [], hr: [] }
    for (let k = 0; k < fps * 2; k++) { z += speed / fps; b.step(1 / fps, clip, speed / fps, FX.h, NO); if (b.state().capped) capped++; at0(0, 0, z, 0)
      const a = b.bones.find(x => x.name === 'b_tail1')!.getWorldPosition(v), e = b.bones.find(x => x.name === 'b_tail4')!.getWorldPosition(v2); tail = Math.max(tail, Math.abs(Math.atan2(e.x - a.x, -(e.z - a.z))))
      for (const f in tr) { const c = new THREE.Vector3(); for (const i of soles[f]) c.add(b.at('body', i, v)); c.divideScalar(soles[f].length); tr[f].push({ p: c, rel: c.z - z }) } }
    for (const f in tr) { const lo = Math.min(...tr[f].map(q => q.p.y)), rel = tr[f].map(q => q.rel); swing = Math.max(swing, Math.max(...rel) - Math.min(...rel)); let from: THREE.Vector3 | null = null
      for (const q of tr[f]) { if (q.p.y < lo + 0.0015) { if (from) { held++; drift = Math.max(drift, Math.hypot(q.p.x - from.x, q.p.z - from.z)) } else from = q.p } else from = null } }
    console.log(`   Vulnyx ${clip} ${speed} m/s ${fps} fps: drift ${(drift * 1000).toFixed(1)} mm over ${held} held, swing ${(swing * 1000).toFixed(0)} mm, ${(speed / strideLen(FR.clipV[clip], gltf.animations.find(a => a.name === clip)!.duration, FX.h)).toFixed(2)} strides/s, cap ${capped}`)
    ok(capped === 0, `Vulnyx ${speed} m/s: the cap never bites`); ok(drift < 0.006 && (held > 0 || fps < 120), `Vulnyx ${clip} ${speed} m/s at ${fps} fps: planted foot drift ${(drift * 1000).toFixed(1)} mm (${held})`); ok(swing > 0.15, `Vulnyx ${clip}: legs swing ${(swing * 1000).toFixed(0)} mm`); ok(tail < 0.35, `Vulnyx ${clip}: tail ${(tail * 57.3).toFixed(0)} deg off behind`)
  }
  // behind a keeper walking and sprinting straight: the cap never bites on her own follow (it bit on 416 of 539 sprint frames at 5.5)
  for (const kv of [4.2, 6.5]) { const k = { x: 0, z: 0, yaw: 0 }, fm = makeFormation(() => [{ id: 's', kind: 'spirit', r: 0.3 }]), t = makeTrot({ home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: () => false, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }, 5, FX.trot)
    t.follow(() => ({ ...k, slot: fm.last().slots.s })); let p = t.pose(), prev = { x: p.x, z: p.z }, cap = 0, moved = 0
    for (let i = 0; i < 60 * 12; i++) { if (i > 180) k.z -= kv / 60; fm.tick(k, 1 / 60); p = t.step(1 / 60); const d = Math.hypot(p.x - prev.x, p.z - prev.z); prev = { x: p.x, z: p.z }; if (i > 180 && d > 1e-4) { moved++; if (gaitCycles(d, 1 / 60, strideLen(FR.clipV.run, 0.4325, FX.h), FR.cadence).capped) cap++ } }
    ok(cap === 0 && moved > 200, `Vulnyx behind a ${kv} m/s keeper: the cap bites on ${cap} of ${moved} frames`) }
  // the ground: every clip, then every blend (her lowest vertex, all of them, on a turned body standing on a hill)
  at0(40, 12, -30, 1)
  const mv: Record<RigClip, number> = { idle: 0, walk: 0.55, run: 2.8, sit: 0, lie: 0 }
  for (const c of RIG_CLIPS) { for (let k = 0; k < 45; k++) b.step(1 / 30, c, mv[c] / 30, FX.h, NO); let lo = 9; for (let k = 0; k < 24; k++) { b.step(0.13, c, mv[c] * 0.13, FX.h, NO); lo = Math.min(lo, box().min.y - 12) } ok(lo > -0.003, `Vulnyx ${c}: lowest ${(lo * 1000).toFixed(1)} mm`); ok(b.state().lift === 0, `Vulnyx ${c} alone: no lift`) }
  { let lo = 9, hi = 0, why = ''
    for (const a of RIG_CLIPS) for (const c of RIG_CLIPS) if (a !== c) { for (let k = 0; k < 43; k++) b.step(1 / 30, a, mv[a] / 30, FX.h, NO); for (let k = 0; k < 20; k++) { b.step(1 / 30, c, mv[c] / 30, FX.h, NO); hi = Math.max(hi, b.state().lift * FX.h); const l = box().min.y - 12; if (l < lo) { lo = l; why = `${a}>${c}` } } }
    console.log(`   Vulnyx blends: lowest ${(lo * 1000).toFixed(1)} mm (${why}), lifted up to ${(hi * 1000).toFixed(0)} mm`)
    ok(lo > -0.01, `Vulnyx: a blend sinks her ${(lo * 1000).toFixed(1)} mm (${why}), spec 20`); ok(hi > 0.02 && hi < 0.09, `Vulnyx: the lift is the dip, not more (${(hi * 1000).toFixed(0)} mm)`) }
  for (let k = 0; k < 60; k++) b.step(1 / 30, 'lie', 0, FX.h, NO); { const y = box().max.y - 12; ok(y < 0.6, `lying she is low (${y.toFixed(2)} m)`) }
  // her trot: no hop, not sideways, every clip she has of her own
  const nav: SpiritNav = { home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: (x, z2) => Math.hypot(x, z2) > 8, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }
  for (const seed of [1, 7, 42]) { const t = makeTrot(nav, seed, FX.trot); let side = 0, up = 0, moved = 0, prev = { ...t.pose() }, clip: RigClip = 'idle'; const seen = new Set<RigClip>(), dt = 1 / 60
    for (let k = 0; k < 60 * 120; k++) { const p = t.step(dt), d = Math.hypot(p.x - prev.x, p.z - prev.z)
      if (p.mode === 'trot') { const a = Math.atan2(p.x - prev.x, p.z - prev.z), w = p.yaw - p.look; if (Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w))) > 0.6) side += d; moved += d; up = Math.max(up, p.y) }
      clip = rigClip(p, d / dt, 0, clip, FR.runAt, FR.lie); seen.add(clip); prev = { ...p } }
    ok(moved > 10 && up === 0 && side < moved * 0.08, `Vulnyx seed ${seed}: ${moved.toFixed(0)} m, y ${up}, ${(side / moved * 100).toFixed(1)}% sideways`); ok(['idle', 'walk', 'run', 'sit'].every(c => seen.has(c as RigClip)) && !seen.has('lie'), `Vulnyx seed ${seed}: clips ${[...seen]}`) }
  // an idle skit's nap = lie, on the real trot
  { const t = makeTrot(nav, 3, FX.trot), slot = { x: 1, z: 1, face: 0, act: undefined as 'lie' | undefined }; t.follow(() => ({ x: 0, z: 0, yaw: 0, slot })); let p = t.pose()
    for (let k = 0; k < 180; k++) p = t.step(1 / 60); ok(!p.lie, 'stood by: not lying'); slot.act = 'lie'; for (let k = 0; k < 180; k++) p = t.step(1 / 60)
    ok(p.lie && rigClip(p, 0, 0, 'idle', FR.runAt, FR.lie) === 'lie', 'a nap skit lies her down'); t.follow(null); p = t.step(1 / 60); ok(!p.lie, 'and it ends with the follow') }
  b.dispose(); ok(rigCount.live === 0 && rigCount.made === made0 + 1, `Vulnyx despawned ${JSON.stringify(rigCount)}`)
}
const load = (url: string) => new Promise<RigGltf>((res, rej) => { const buf = fs.readFileSync(`${__dirname}/../../../../../public${url}`); new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', g => res(g as unknown as RigGltf), rej) })
load(L.url).then(g => { main(g); return load(FX.url) }).then(g => { vulnyx(g); console.log(`spirit-rig: ${pass}/${fails.length}`); if (fails.length) { for (const f of fails) console.error('   x ' + f); process.exit(1) } }).catch(e => { console.error(e); process.exit(1) })
