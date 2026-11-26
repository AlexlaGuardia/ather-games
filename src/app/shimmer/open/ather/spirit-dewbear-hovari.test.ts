// BETA M173 s2: the Dewbear (walks) + the Hovari (hovers). Run: npx tsx src/app/shimmer/open/ather/spirit-dewbear-hovari.test.ts
// Reads the SHIPPED glbs with three's own loader and drives the real body (spirit-rig-body.ts) with the real trot.
import * as fs from 'fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GROWN } from '../../sprites/creature-size'
import { RIG_CLIPS, gaitCycles, rigClip, strideLen, type RigClip } from './spirit-rig'
import { makeRigBody, rigCount, type RigBody, type RigGltf } from './spirit-rig-body'
import { HOVARI_UNIT, SPIRIT_MODELS, SPIRIT_RIGS, rigLook, spiritModelFor } from './spirit-models'
import { DEWBEAR_URL } from './blue-look'
import { makeTrot, type SpiritNav } from './spirit-trot'
import { makeFormation } from '../shared/follow-formation'
;(globalThis as unknown as { self: unknown }).self = globalThis
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const NO = { look: 0, sniff: 0, tilt: 0 }, ROOT = `${__dirname}/../../../../..`
const same = (a: string, b: string) => fs.readFileSync(`${ROOT}/${a}`).equals(fs.readFileSync(`${ROOT}/${b}`))
const D = SPIRIT_RIGS['water-bear']!, DR = D.rig!, H = SPIRIT_RIGS.hummingbird!, HR = H.rig!

// 1 registered for every keeper (the rigged switch is the one every keeper has), the approved v2 glbs byte for byte
ok(spiritModelFor('water-bear') === SPIRIT_MODELS['water-bear'] && spiritModelFor('hummingbird') === SPIRIT_MODELS.hummingbird, 'both have a model (no orb)')
ok(rigLook('water-bear', SPIRIT_MODELS['water-bear']!, true) === D && rigLook('hummingbird', SPIRIT_MODELS.hummingbird!, true) === H, 'rigged = the switch on')
ok(same(`public${D.url}`, 'docs/looks/dewbear-2026-11-24/dewbear-v2-rigged.glb') && same(`public${SPIRIT_MODELS['water-bear']!.url}`, 'docs/looks/dewbear-2026-11-24/dewbear-v2.glb'), 'Dewbear: the approved v2, byte for byte')
ok(same(`public${H.url}`, 'docs/looks/hovari-2026-11-24/hovari-v2-rigged.glb') && same(`public${SPIRIT_MODELS.hummingbird!.url}`, 'docs/looks/hovari-2026-11-24/hovari-v2.glb'), 'Hovari: the approved v2, byte for byte')
ok(D.url === DEWBEAR_URL, 'the Dewbear wears the very glb Blue wears (one download)')
ok(!DR.fly && !DR.hover && !DR.cull && DR.lie === true && D.trot.planted === 1 && D.trot.hopH === 0, 'the Dewbear walks: no flight, no hover, no hop')
ok(!HR.fly && !!HR.hover && !!HR.cull && H.trot.planted === 1, 'the Hovari hovers (no take-off / landing flight: she is never down)')
ok(Math.abs(D.h - GROWN['water-bear'].height) < 1e-9 && SPIRIT_MODELS['water-bear']!.h === GROWN['water-bear'].height, 'Dewbear grown 0.50 m')
ok(Math.abs(HOVARI_UNIT / 0.3 * GROWN.hummingbird.length! - 0.219) < 1e-9, 'Hovari: 0.30 m beak to tail = canon length')
// manner: the Dewbear slow and sturdy (slower than the Manalotl's legs? no: slower than the Vulnyx, calmer turns); the Hovari quick and precise
{ const d = D.trot, h = H.trot, v = SPIRIT_RIGS.fox!.trot, o = SPIRIT_RIGS.owl!.trot
  ok(d.speed! < (v.speed ?? 1.15) * 0.7 && d.dash! < (v.dash ?? 1.7) * 0.7 && d.turnK! < 6 && d.sitS![0] > 5, `Dewbear slow and sturdy (${d.speed} / ${d.dash} m/s, turn ${d.turnK})`)
  ok(h.dash! > (v.dash ?? 1.7) && h.turnK! > 12 && h.glance! < o.glance! / 2 && h.glanceHold![1] < 1 && h.checkS![1] < 1, `Hovari quick and precise (dash ${h.dash}, glance ${h.glance} s)`) }

function mats() { const m = () => new THREE.MeshBasicMaterial(); return { skin: m(), glow: m(), halo: m(), eye: m() } }
const v = new THREE.Vector3()
function rigged(gltf: RigGltf, L: typeof D, glow?: string) {
  const b = makeRigBody(gltf, L.rig!, mats(), glow), g = new THREE.Group(), sc = new THREE.Group()
  sc.scale.setScalar(L.h); sc.position.set(-L.rig!.pivot.x * L.h, 0, -L.rig!.pivot.z * L.h); sc.add(b.root); g.add(sc)
  const at0 = (x: number, y: number, z: number, yaw = 0) => { g.position.set(x, y, z); g.rotation.y = yaw; g.updateMatrixWorld(true) }
  const box = () => { g.updateMatrixWorld(true); const bb = new THREE.Box3(); for (const p of Object.keys(b.meshes).filter(n => !/Hull$/.test(n))) { const n = b.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) bb.expandByPoint(b.at(p, i, v)) } return bb }
  return { b, g, at0, box }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

// 2 the Dewbear: her size, her feet, the ground
function dewbear(gltf: RigGltf) {
  const { b, at0, box } = rigged(gltf, D)
  ok(b.bones.length === 33 && Object.keys(b.meshes).join() === 'body,bodyHull,eyes' && gltf.animations.some(a => a.name === 'lie'), `Dewbear: 33 bones, body + hull + eyes, a lie clip (${b.bones.length}, ${Object.keys(b.meshes)})`)
  at0(0, 0, 0); const len: number[] = [], top: number[] = []
  for (let k = 0; k < 64; k++) { b.step(1 / 8, 'idle', 0, D.h, NO); const bb = box(); len.push(bb.max.z - bb.min.z); top.push(bb.max.y) }
  console.log(`   Dewbear rigged: ${avg(top).toFixed(3)} m tall standing, ${avg(len).toFixed(3)} m nose to tail`)
  ok(Math.abs(avg(top) - GROWN['water-bear'].height) < 0.01 * GROWN['water-bear'].height, `Dewbear stands ${avg(top).toFixed(3)} m, canon 0.50`)
  ok(Math.abs(avg(len) / D.h - DR.glbLen) < 0.02, `Dewbear glbLen ${(avg(len) / D.h).toFixed(3)} (${DR.glbLen})`)
  // planted feet: her amble, her dash, the clip speeds, behind a keeper walking (4.2) and sprinting (6.5)
  const sole = (f: string) => { const bi = b.bones.findIndex(x => x.name === f), geo = b.meshes.body.geometry, si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), ps = geo.getAttribute('position'), all: number[] = []
    for (let i = 0; i < ps.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k); if (w > 0.99) all.push(i) }
    const lo = Math.min(...all.map(i => ps.getY(i))); return all.filter(i => ps.getY(i) < lo + 0.03) }
  const feet = b.bones.map(x => x.name).filter(n => /^b_foot\d_[lr]$/.test(n)), soles = Object.fromEntries(feet.map(f => [f, sole(f)]))
  ok(feet.length === 8 && feet.every(f => soles[f].length > 0), `eight feet with soles (${feet.length})`)
  for (const [clip, speed] of [['walk', D.trot.speed!], ['run', D.trot.dash!], ['walk', 1.0], ['run', 2.8], ['run', 4.2], ['run', 6.5], ['run', 9]] as const) for (const fps of [120, 60]) {
    for (let k = 0; k < 40; k++) b.step(1 / 60, clip, speed / 60, D.h, NO)
    let z = 0, drift = 0, held = 0, capped = 0, swing = 0; const tr: Record<string, { p: THREE.Vector3; rel: number }[]> = Object.fromEntries(feet.map(f => [f, []]))
    for (let k = 0; k < fps * 2; k++) { z += speed / fps; b.step(1 / fps, clip, speed / fps, D.h, NO); if (b.state().capped) capped++; at0(0, 0, z)
      for (const f of feet) { const c = new THREE.Vector3(); for (const i of soles[f]) c.add(b.at('body', i, v)); c.divideScalar(soles[f].length); tr[f].push({ p: c, rel: c.z - z }) } }
    for (const f of feet) { const lo = Math.min(...tr[f].map(q => q.p.y)), rel = tr[f].map(q => q.rel); swing = Math.max(swing, Math.max(...rel) - Math.min(...rel)); let from: THREE.Vector3 | null = null
      for (const q of tr[f]) { if (q.p.y < lo + 0.0015) { if (from) { held++; drift = Math.max(drift, Math.hypot(q.p.x - from.x, q.p.z - from.z)) } else from = q.p } else from = null } }
    if (fps === 60) console.log(`   Dewbear ${clip} ${speed} m/s: drift ${(drift * 1000).toFixed(1)} mm over ${held} held, swing ${(swing * 1000).toFixed(0)} mm, ${(speed / strideLen(DR.clipV[clip], gltf.animations.find(a => a.name === clip)!.duration, D.h)).toFixed(2)} strides/s, cap ${capped}`)
    ok(capped === 0, `Dewbear ${speed} m/s: the cap never bites (${capped})`); ok(drift < 0.006, `Dewbear ${clip} ${speed} m/s at ${fps} fps: planted foot drift ${(drift * 1000).toFixed(1)} mm`); ok(swing > 0.03, `Dewbear ${clip}: legs swing ${(swing * 1000).toFixed(0)} mm`)
  }
  // behind a keeper: how often her stubby legs hit the cap (= slide), stated
  for (const kv of [4.2, 6.5]) { const k = { x: 0, z: 0, yaw: 0 }, fm = makeFormation(() => [{ id: 's', kind: 'spirit', r: 0.3 }]), t = makeTrot({ home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: () => false, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }, 5, D.trot)
    t.follow(() => ({ ...k, slot: fm.last().slots.s })); let p = t.pose(), prev = { x: p.x, z: p.z }, cap = 0, moved = 0
    for (let i = 0; i < 60 * 12; i++) { if (i > 180) k.z -= kv / 60; fm.tick(k, 1 / 60); p = t.step(1 / 60); const d = Math.hypot(p.x - prev.x, p.z - prev.z); prev = { x: p.x, z: p.z }; if (i > 180 && d > 1e-4) { moved++; if (gaitCycles(d, 1 / 60, strideLen(DR.clipV.run, 0.22, D.h), DR.cadence).capped) cap++ } }
    console.log(`   Dewbear behind a ${kv} m/s keeper: the cap bites on ${cap} of ${moved} frames`)
    ok(moved > 200 && cap === 0, `Dewbear behind a ${kv} m/s keeper: the cap bites on ${cap} of ${moved} frames`) }
  // the ground: every clip alone, then every blend
  at0(40, 12, -30, 1); const mv: Record<RigClip, number> = { idle: 0, walk: 0.7, run: 2.8, sit: 0, lie: 0 }
  for (const c of RIG_CLIPS) { for (let k = 0; k < 45; k++) b.step(1 / 30, c, mv[c] / 30, D.h, NO); let lo = 9; for (let k = 0; k < 24; k++) { b.step(0.13, c, mv[c] * 0.13, D.h, NO); lo = Math.min(lo, box().min.y - 12) } ok(lo > -0.004, `Dewbear ${c}: lowest ${(lo * 1000).toFixed(1)} mm`) }
  { let lo = 9, why = ''
    for (const a of RIG_CLIPS) for (const c of RIG_CLIPS) if (a !== c) { for (let k = 0; k < 43; k++) b.step(1 / 30, a, mv[a] / 30, D.h, NO); for (let k = 0; k < 20; k++) { b.step(1 / 30, c, mv[c] / 30, D.h, NO); const l = box().min.y - 12; if (l < lo) { lo = l; why = `${a}>${c}` } } }
    console.log(`   Dewbear blends: lowest ${(lo * 1000).toFixed(1)} mm (${why})`); ok(lo > -0.01, `Dewbear: a blend sinks her ${(lo * 1000).toFixed(1)} mm (${why})`) }
  // her trot: no hop, not sideways, she walks more than she runs
  const nav: SpiritNav = { home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: (x, z2) => Math.hypot(x, z2) > 8, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }
  for (const seed of [1, 7, 42]) { const t = makeTrot(nav, seed, D.trot); let side = 0, up = 0, moved = 0, prev = { ...t.pose() }, clip: RigClip = 'idle'; const seen = new Set<RigClip>(), dt = 1 / 60
    for (let k = 0; k < 60 * 120; k++) { const p = t.step(dt), d = Math.hypot(p.x - prev.x, p.z - prev.z)
      if (p.mode === 'trot') { const a = Math.atan2(p.x - prev.x, p.z - prev.z), w = p.yaw - p.look; if (Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w))) > 0.6) side += d; moved += d; up = Math.max(up, p.y) }
      clip = rigClip(p, d / dt, 0, clip, DR.runAt, DR.lie); seen.add(clip); prev = { ...p } }
    ok(moved > 5 && up === 0 && side < moved * 0.08, `Dewbear seed ${seed}: ${moved.toFixed(0)} m, y ${up}, ${(side / moved * 100).toFixed(1)}% sideways`); ok(['idle', 'walk', 'sit'].every(c => seen.has(c as RigClip)), `Dewbear seed ${seed}: clips ${[...seen]}`) }
  b.dispose()
}

// 3 the Hovari: she hangs at eye level in every clip and every blend, inside her own culling, wings by time
function hovari(gltf: RigGltf) {
  const { b, at0, box } = rigged(gltf, H, 'shimmer'), V = HR.hover!
  ok(b.bones.length === 24 && Object.keys(b.meshes).join() === 'body,bodyHull,shimmer,shimmerHull,eyes', `Hovari: 24 bones, body + shimmer + eyes (${b.bones.length}, ${Object.keys(b.meshes)})`)
  at0(0, 0, 0); const lo: number[] = [], top: number[] = []
  for (let k = 0; k < 64; k++) { b.step(1 / 8, 'idle', 0, H.h, NO); const bb = box(); lo.push(bb.min.y); top.push(bb.max.y) }
  console.log(`   Hovari idle: lowest ${Math.min(...lo).toFixed(3)} m, top ${Math.max(...top).toFixed(3)} m`)
  ok(Math.abs(Math.min(...lo) - V.low * H.h) < 0.03 && Math.abs(Math.max(...top) - V.top * H.h) < 0.03, `the pick band = her hover (${Math.min(...lo).toFixed(3)}..${Math.max(...top).toFixed(3)} vs ${(V.low * H.h).toFixed(3)}..${(V.top * H.h).toFixed(3)})`)
  ok(Math.abs(avg(lo) - 0.9) < 0.06, `she hovers about 0.9 m up (Alex 11-24): ${avg(lo).toFixed(3)}`)
  const ball = b.meshes.body.boundingSphere!, bx = b.meshes.body.boundingBox!   // what three culls her by
  ok(ball.radius === HR.cull!.r && bx.min.y === HR.cull!.min[1] && Object.values(b.meshes).every(m => m.boundingSphere === ball), 'every part culls by her own sphere and box')
  const mv: Record<RigClip, number> = { idle: 0, walk: 0.8, run: 4, sit: 0, lie: 0 }; let low = 9, out = 0, why = ''
  const inside = () => { for (const p of Object.keys(b.meshes).filter(n => !/Hull$/.test(n))) { const m = b.meshes[p], n = m.geometry.getAttribute('position').count
    for (let i = 0; i < n; i += 7) { m.geometry.getAttribute('position'); v.fromBufferAttribute(m.geometry.getAttribute('position') as THREE.BufferAttribute, i); m.applyBoneTransform(i, v); if (!bx.containsPoint(v) || ball.distanceToPoint(v) > 0) out++ } } }
  for (const a of RIG_CLIPS) for (const c of RIG_CLIPS) { for (let k = 0; k < 43; k++) b.step(1 / 30, a, mv[a] / 30, H.h, NO); for (let k = 0; k < 20; k++) { b.step(1 / 30, c, mv[c] / 30, H.h, NO); const l = box().min.y; if (l < low) { low = l; why = `${a}>${c}` } if (k % 5 === 0) inside() } }
  console.log(`   Hovari: lowest of every clip and blend ${low.toFixed(3)} m (${why}); ${out} sampled vertices outside her culling`)
  ok(low > 0.7, `she never comes down: lowest ${low.toFixed(3)} m (${why})`); ok(out === 0, `her culling holds every clip (${out} out)`); ok(b.state().lift === 0, 'the ground keep never lifts her')
  // wings by time (Alex 11-24 'wing pace fast'): a stopped drift still beats at the clip's own pace or faster, a fast dart at most flap[1]
  for (const c of ['walk', 'run'] as const) { for (let k = 0; k < 30; k++) b.step(1 / 60, c, 0, H.h, NO); const r0 = b.state().rate
    for (let k = 0; k < 30; k++) b.step(1 / 60, c, 9 / 60, H.h, NO); const r9 = b.state().rate
    ok(r0 >= 1 && Math.abs(r0 - V.flap[0]) < 1e-6 && Math.abs(r9 - V.flap[1]) < 1e-6, `${c}: wings ${r0.toFixed(2)}x stopped, ${r9.toFixed(2)}x at 9 m/s`) }
  b.dispose()
}
const load = (url: string) => new Promise<RigGltf>((res, rej) => { const buf = fs.readFileSync(`${ROOT}/public${url}`); new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', g => res(g as unknown as RigGltf), rej) })
const made0 = rigCount.made
load(D.url).then(g => { dewbear(g); return load(H.url) }).then(g => { hovari(g)
  ok(rigCount.live === 0 && rigCount.made === made0 + 2, `despawned ${JSON.stringify(rigCount)}`)
  console.log(`spirit-dewbear-hovari: ${pass}/${fails.length}`); if (fails.length) { for (const f of fails) console.error('   x ' + f); process.exit(1) } }).catch(e => { console.error(e); process.exit(1) })
