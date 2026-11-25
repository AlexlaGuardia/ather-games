// BETA M173: Athowl + Noctyx. Run: npx tsx src/app/shimmer/open/ather/spirit-fly.test.ts
// Reads the SHIPPED glbs with three's own loader and drives the real body with the real trot.
import * as fs from 'fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GROWN } from '../../sprites/creature-size'
import { DEADZONE, DOWN, GROUNDED, flapCycles, flyClip, flyStep, travels, type FlyState } from './spirit-fly'
import { RIG_CLIPS, gaitCycles, rigClip, strideLen, type RigClip } from './spirit-rig'
import { makeRigBody, rigCount, type RigGltf } from './spirit-rig-body'
import { SPIRIT_MODELS, SPIRIT_RIGS, spiritModelFor } from './spirit-models'
import { makeTrot, type SpiritNav } from './spirit-trot'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
;(globalThis as unknown as { self: unknown }).self = globalThis
const SPS = ['owl', 'bat'] as const, NAME = { owl: 'athowl', bat: 'noctyx' } as const, NO = { look: 0, sniff: 0, tilt: 0 }

// 1 registered, every keeper's path, canon sizes; the walkers are not fliers
for (const sp of SPS) { const L = SPIRIT_RIGS[sp]!, M = spiritModelFor(sp)!
  ok(M === SPIRIT_MODELS[sp] && M.url === `/open/spirits/${NAME[sp]}.glb` && L.url === `/open/spirits/${NAME[sp]}-rigged.glb`, `${sp}: its own glbs`)
  ok(M.h === GROWN[sp].height && L.rig!.lie === true && !!L.rig!.fly && L.trot.planted === 1 && L.trot.hopH === 0, `${sp}: dials`)
  ok(fs.readFileSync(`${__dirname}/../../../../../public${L.url}`).equals(fs.readFileSync(`${__dirname}/../../../../../docs/looks/${NAME[sp]}-2026-11-24/${NAME[sp]}-rigged.glb`)), `${sp}: the approved glb, byte for byte`) }
ok(!SPIRIT_RIGS.fox!.rig!.fly && !SPIRIT_RIGS.axolotl!.rig!.fly, 'the Vulnyx and the Manalotl walk')
ok(spiritModelFor('rabbit') === null, 'a species with no model keeps the orb')
{ const o = SPIRIT_RIGS.owl!.rig!.fly!, b = SPIRIT_RIGS.bat!.rig!.fly!, to = SPIRIT_RIGS.owl!.trot, tb = SPIRIT_RIGS.bat!.trot
  ok(o.flap[1] < b.flap[1] && o.up < b.up && to.lookS![0] > tb.lookS![1] && to.glance! > tb.glance! * 2 && to.dash! < tb.dash!, 'Athowl calm, Noctyx quick') }

// 2 the height: up while she travels, down before she stands, the same at any frame rate
const F = SPIRIT_RIGS.owl!.rig!.fly!
ok(travels('run', 'trot') && travels('run', 'follow') && !travels('walk', 'trot') && !travels('run', 'hopUp') && !travels('run', 'play') && !travels('idle', 'follow'), 'what travels')
ok(flyClip('idle', 0.2) === 'run' && flyClip('sit', 0.06) === 'run' && flyClip('idle', 0) === 'idle' && flyClip('idle', DOWN) === 'idle', 'still up = still flying')
const run = (fps: number, secs: number, up: boolean, s: FlyState, near = 9) => { for (let i = 0; i < Math.round(fps * secs); i++) s = flyStep(s, F, up, near, 1 / fps); return s }
for (const fps of [120, 60, 10]) { const s = run(fps, 2, true, GROUNDED); ok(Math.abs(s.alt - F.alt * (1 - Math.exp(-2 * F.up))) < 1e-9, `up at ${fps} fps ${s.alt}`); const d = run(fps, 3, false, s); ok(d.alt === 0, `down to exactly 0 at ${fps} fps ${d.alt}`) }
// 3 the deadzone: held still inside it, a hysteresis on the way out, never for ever, and nothing on the ground
{ const top = run(60, 3, true, GROUNDED)
  let s = flyStep(top, F, false, DEADZONE.in - 0.01, 0.1); ok(s.alt === top.alt && s.inside, 'something walks through her: she holds')
  s = flyStep(s, F, false, (DEADZONE.in + DEADZONE.out) / 2, 0.1); ok(s.alt === top.alt, 'between in and out she still holds')
  ok(flyStep(top, F, false, (DEADZONE.in + DEADZONE.out) / 2, 0.1).alt < top.alt, 'but coming from outside she does not')
  s = flyStep(s, F, false, DEADZONE.out + 0.01, 0.1); ok(s.alt < top.alt && !s.inside, 'past out she goes on')
  ok(run(60, DEADZONE.hold + 3, false, top, 0.1).alt === 0, 'never held up for ever')
  const g = flyStep(GROUNDED, F, true, 0, 0.1); ok(g.alt > 0 && !g.inside, 'on the ground there is no deadzone (she may take off beside the keeper)')
  let y = top, flips = 0, last = 0; for (let i = 0; i < 85; i++) { const n = flyStep(y, F, i % 8 < 4, 0.64 - 0.1 * Math.cos(i), 1 / 60), dir = Math.sign(n.alt - y.alt); if (dir && last && dir !== last && true) flips++; if (dir) last = dir; y = n }
  ok(flips === 0 && y.alt === top.alt, `no jump in height while somebody brushes past (${flips})`) }
// 4 wings beat by time, not by ground
ok(flapCycles(F, 0, 2.8, 0.43, 0.1) > 0 && Math.abs(flapCycles(F, 0, 2.8, 0.43, 0.1) - 0.1 / 0.43 * F.flap[0]) < 1e-9, 'a hover beats'); ok(Math.abs(flapCycles(F, 9, 2.8, 0.43, 0.1) - 0.1 / 0.43 * F.flap[1]) < 1e-9, 'a catch-up does not blur')

const mats = () => { const m = () => new THREE.MeshBasicMaterial(); return { skin: m(), glow: null, halo: m(), eye: m() } }
function body(sp: typeof SPS[number], gltf: RigGltf) {
  const L = SPIRIT_RIGS[sp]!, R = L.rig!, b = makeRigBody(gltf, R, mats()), v = new THREE.Vector3(), g = new THREE.Group(), sc = new THREE.Group()
  sc.scale.setScalar(L.h); sc.position.set(-R.pivot.x * L.h, 0, -R.pivot.z * L.h); sc.add(b.root); g.add(sc)
  const box = () => { g.updateMatrixWorld(true); const bb = new THREE.Box3(); for (const p of ['body', 'eyes']) { const n = b.meshes[p].geometry.getAttribute('position').count; for (let i = 0; i < n; i++) bb.expandByPoint(b.at(p, i, v)) } return bb }
  ok(Object.keys(b.meshes).join() === 'body,bodyHull,eyes' && new Set(Object.values(b.meshes).map(m => m.skeleton)).size === 1, `${sp}: body + hull + eyes, one skeleton`)
  ok(!!b.bones.find(x => x.name === R.neck) && !!b.bones.find(x => x.name === R.head) && RIG_CLIPS.every(c => gltf.animations.some(a => a.name === c)), `${sp}: neck, head, every clip`)
  let top = 0, len = 0; for (let k = 0; k < 64; k++) { b.step(1 / 8, 'idle', 0, L.h, NO); const bb = box(); top += bb.max.y / 64; len += (bb.max.z - bb.min.z) / 64 }
  ok(Math.abs(top - GROWN[sp].height) < 0.01 * GROWN[sp].height, `${sp} stands ${top.toFixed(3)}, canon ${GROWN[sp].height}`); ok(Math.abs(len / L.h - R.glbLen) < 0.01, `${sp} glbLen ${(len / L.h).toFixed(3)}`)
  // on the ground clips: lowest vertex at 0; the flight: clear of it by the clip's own height
  const lo: Record<string, number> = {}
  for (const c of RIG_CLIPS) { const m = c === 'walk' ? 0.55 : c === 'run' ? 1.9 : 0; for (let k = 0; k < 45; k++) b.step(1 / 30, c, m / 30, L.h, NO); lo[c] = 9; for (let k = 0; k < 30; k++) { b.step(0.13, c, m * 0.13, L.h, NO); lo[c] = Math.min(lo[c], box().min.y) } }
  for (const c of ['idle', 'walk', 'sit', 'lie']) ok(Math.abs(lo[c]) < 0.003, `${sp} ${c} on the ground ${lo[c].toFixed(4)}`); ok(lo.run > 0.1, `${sp} flies, lowest ${lo.run.toFixed(3)}`)
  // her hop: planted feet stay put in the world
  { const bi = ['b_foot_l', 'b_foot_r'].map(f => b.bones.findIndex(x => x.name === f)), geoB = b.meshes.body.geometry
    const pickFrom = (gg: THREE.BufferGeometry) => { const s2 = gg.getAttribute('skinIndex'), w2 = gg.getAttribute('skinWeight'), p2 = gg.getAttribute('position'); return bi.map(f => { const all: number[] = []; for (let i = 0; i < p2.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (s2.getComponent(i, k) === f) w += w2.getComponent(i, k); if (w > 0.95) all.push(i) } const l = Math.min(...all.map(i => p2.getY(i))); return { vs: all.filter(i => p2.getY(i) < l + 0.03) } }) }
    for (const sole of pickFrom(geoB)) { for (let k = 0; k < 40; k++) b.step(1 / 60, 'walk', 0.55 / 60, L.h, NO)
      let z = 0, drift = 0, held = 0; const tr: THREE.Vector3[] = []
      for (let k = 0; k < 240; k++) { z += 0.55 / 120; b.step(1 / 120, 'walk', 0.55 / 120, L.h, NO); g.position.z = z; g.updateMatrixWorld(true); const c = new THREE.Vector3(); for (const i of sole.vs) c.add(b.at('body', i, v)); tr.push(c.divideScalar(sole.vs.length)) }
      const l = Math.min(...tr.map(q => q.y)); let from: THREE.Vector3 | null = null; for (const q of tr) { if (q.y < l + 0.0015) { if (from) { held++; drift = Math.max(drift, Math.hypot(q.x - from.x, q.z - from.z)) } else from = q } else from = null }
      console.log(`   ${sp} hop 0.55 m/s: planted drift ${(drift * 1000).toFixed(1)} mm over ${held}`); ok(held > 20 && drift < 0.006, `${sp} hop: drift ${(drift * 1000).toFixed(1)} mm (${held})`) }
    g.position.z = 0
    // the top of her hop's pace (runAt) is inside the cadence cap
    ok(!gaitCycles(R.runAt[0] / 60, 1 / 60, strideLen(R.clipV.walk, gltf.animations.find(a => a.name === 'walk')!.duration, L.h), R.cadence).capped, `${sp}: her quickest hop is under the cap`) }
  // the wings beat while she hovers still, and as fast over slow ground as fast
  { for (let k = 0; k < 40; k++) b.step(1 / 60, 'run', 0, L.h, NO); const p0 = b.state().phase; b.step(1 / 60, 'run', 0, L.h, NO); ok(b.state().phase !== p0 && !b.state().capped, `${sp} hover beats`)
    for (let k = 0; k < 40; k++) b.step(1 / 60, 'run', 9 / 60, L.h, NO); ok(!b.state().capped && b.state().rate <= R.fly!.flap[1] + 1e-9, `${sp} at 9 m/s: ${b.state().rate}`) }
  // no blend (with the flight in it too) sinks her
  { let low = 9, why = ''; const mv: Record<RigClip, number> = { idle: 0, walk: 0.55, run: 1.9, sit: 0, lie: 0 }
    for (const a of RIG_CLIPS) for (const c of RIG_CLIPS) if (a !== c) { for (let k = 0; k < 43; k++) b.step(1 / 30, a, mv[a] / 30, L.h, NO); for (let k = 0; k < 20; k++) { b.step(1 / 30, c, mv[c] / 30, L.h, NO); const l = box().min.y; if (l < low) { low = l; why = `${a}>${c}` } } }
    console.log(`   ${sp} blends lowest ${(low * 1000).toFixed(1)} mm (${why})`); ok(low > -0.01, `${sp} blend ${(low * 1000).toFixed(1)} mm ${why}`) }
  // her real trot: she flies her runs, is on the ground at every beat that has had a second to land, and stands most of the time
  const nav: SpiritNav = { home: { x: 0, z: 0 }, rMin: 0.9, rMax: 1.5, blocked: (x, z) => Math.hypot(x, z) > 8, roam: { maxLeg: 4, away: 2 }, perch: { y: 0.5 } }
  for (const seed of [1, 7, 42]) { const t = makeTrot(nav, seed, L.trot), dt = 1 / 60; let clip: RigClip = 'idle', sv = 0, fly = GROUNDED, prev = { ...t.pose() }, hi = 0, still = 0, late = 0, stood = 0, hops = 0; const seen = new Set<RigClip>(), N = 60 * 180
    for (let k = 0; k < N; k++) { const p = t.step(dt), d = Math.hypot(p.x - prev.x, p.z - prev.z); sv += (d / dt - sv) * (1 - Math.exp(-dt * 14)); clip = rigClip(p, sv, 0, clip, R.runAt, R.lie)
      fly = flyStep(fly, R.fly!, travels(clip, p.mode) && sv > R.runAt[1], 9, dt); clip = flyClip(clip, fly.alt); seen.add(clip); hi = Math.max(hi, fly.alt)
      if (clip === 'run' && p.mode === 'trot') hops++
      if (d < 1e-5) { still += dt; stood++ } else still = 0
      if (still > 1 && fly.alt > DOWN) late++
      prev = { ...p } }
    ok(hi > R.fly!.alt * 0.5 && hops > 60, `${sp} seed ${seed}: up to ${hi.toFixed(2)} m`); ok(late === 0, `${sp} seed ${seed}: ${late} frames hanging a second after she stopped`); ok(stood / N > 0.45, `${sp} seed ${seed}: still ${(stood / N * 100).toFixed(0)}%`)
    ok(['idle', 'run', 'sit'].every(c => seen.has(c as RigClip)), `${sp} seed ${seed}: ${[...seen]}`); if (seed === 1) console.log(`   ${sp}: still ${(stood / N * 100).toFixed(0)}% of the time, up to ${hi.toFixed(2)} m over the clip's ${lo.run.toFixed(2)}`) }
  b.dispose(); ok(rigCount.live === 0, `${sp} despawned`)
}
const load = (url: string) => new Promise<RigGltf>((res, rej) => { const buf = fs.readFileSync(`${__dirname}/../../../../../public${url}`); new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', g => res(g as unknown as RigGltf), rej) })
load(SPIRIT_RIGS.owl!.url).then(g => { body('owl', g); return load(SPIRIT_RIGS.bat!.url) }).then(g => { body('bat', g); console.log(`spirit-fly: ${pass}/${pass + fails.length}`); if (fails.length) { for (const f of fails) console.error('   x ' + f); process.exit(1) } }).catch(e => { console.error(e); process.exit(1) })
