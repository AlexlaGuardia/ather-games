// ather/flit-body.ts (BETA M120 s3): the floater's insect look, + s3c what a round hits on it. The solid middle stays inside
// the 0.5 m core, wings / tail / legs count too, the fight numbers are what M120 s1 shipped, three poses that read apart, no light of its own.
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { FLIT, FLIT_HIT_R, flitGeometry, flitMats, geoTris, poseFlit, wingLift, type FlitPose } from './flit-body'
import { flitHit, flitParts, FLIT_PARTS, FLIT_REACH } from './flit-pose'
import { FLOATER, newCombat, spawnHollow, stepCombat, type Terrain } from './combat'
import { sharedGoop, releaseGroundEnvs } from './hollow-goop'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const P = (p: Partial<FlitPose> = {}): FlitPose => ({ t: 0.4, zip: 0, tell: 0, bank: 0, kick: 0, knock: 0, ...p })
const posed = (p: Partial<FlitPose> = {}) => { const out = flitMats(); poseFlit(P(p), out); return out }
const at = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(m)
const span = (ms: THREE.Matrix4[], from = 0, to = ms.length) => { const b = new THREE.Box3(), v = new THREE.Vector3(); for (let i = from; i < to; i++) for (const a of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) b.expandByPoint(v.set(a[0], a[1], a[2]).applyMatrix4(ms[i])); return b }
const tail = (ms: THREE.Matrix4[]) => at(ms[FLIT.abd + FLIT.abdN - 1])
const hold = posed(), zip = posed({ zip: 1 }), tell = posed({ tell: 1 })
for (const [n, ms] of [['hold', hold], ['zip', zip], ['tell', tell]] as const) {
  ok(ms.length === FLIT.count && ms.every(m => m.elements.every(Number.isFinite) && Math.abs(m.determinant()) > 1e-9), `${n}: all ${FLIT.count} lumps written`)
  ok(span(ms, 0, 2).min.y < 0 && span(ms, 0, 2).max.y > 0, `${n}: centred on its body (the sim hovers it)`)
  for (let i = 0; i < 4; i++) ok(at(ms[i]).length() < FLIT_HIT_R, `${n}: solid lump ${i} inside the hit sphere (${at(ms[i]).length().toFixed(2)})`)
  const s = span(ms).getSize(new THREE.Vector3()); ok(s.x < 1.9 && s.y < 1.9 && s.z < 1.9, `${n}: small (${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)})`)
}
// the three poses read apart
ok(tail(hold).y < -0.2 && tail(hold).z < -0.4, `hold: the tail hangs behind (${tail(hold).y.toFixed(2)}, ${tail(hold).z.toFixed(2)})`)
ok(tail(zip).y > tail(hold).y + 0.15, 'zip: the tail streams out level')
ok(tail(tell).z > 0.05 && tail(tell).y < -0.3, `tell: the tail curls UNDER, toward the keeper (z ${tail(tell).z.toFixed(2)})`)
ok(wingLift(P({ tell: 1 }), 0) > 1 && Math.abs(wingLift(P(), 0)) < 0.4, 'tell: the wings snap up; hold: they lie out flat')
{ const lifts = (p: Partial<FlitPose>) => Array.from({ length: 60 }, (_, i) => wingLift(P({ ...p, t: i / 60 }), 0)), r = (a: number[]) => Math.max(...a) - Math.min(...a)
  ok(r(lifts({ zip: 1 })) > 1.2, `zip: the wings beat (${r(lifts({ zip: 1 })).toFixed(2)} rad)`); ok(r(lifts({})) < 0.12, `hold: the wings are held still (${r(lifts({})).toFixed(3)} rad)`) }
ok(!posed({ t: 0 })[0].equals(posed({ t: 0.5 })[0]), 'never a statue: the goop still works on its own clock')
{ const thick = (i: number) => new THREE.Vector3().setFromMatrixColumn(hold[i], 0).length()
  ok(thick(FLIT.armR) > thick(FLIT.armL) * 1.8, 'the caster is dense only at its reaching arm (brief Q2)') }
ok(at(tell[FLIT.armR + 2]).z > at(hold[FLIT.armR + 2]).z + 0.2, 'tell: the reach straightens toward the keeper')
ok(posed({ knock: 1 })[0].elements[14] < hold[0].elements[14] - 0.2, 'a hit knocks it BACK')
// cheap: one geometry, one material per ground, under the old body's triangles (8 lumps x 352)
ok(flitGeometry() === flitGeometry() && FLIT.count * geoTris(flitGeometry()) <= 8 * 352, `${FLIT.count} lumps, ${FLIT.count * geoTris(flitGeometry())} triangles (was 2816)`)
{ const a = sharedGoop('#9cc46a', false), b = sharedGoop('#9cc46a', false), z = sharedGoop('#777777', false)
  ok(a === b && a !== z, 'one material per ground colour, shared'); ok(a.emissive.getHex() === 0 && !a.emissiveMap, 'no emissive, ever')
  releaseGroundEnvs(); ok(sharedGoop('#9cc46a', false) !== a, 'freed when the Wilds are left') }
// the sim's numbers are M120 s1's, whatever the body looks like
ok(FLOATER.hp === 30 && FLOATER.damage === 6 && FLOATER.splash === 3 && FLOATER.shots === 3 && FLOATER.charge === 0.7 && FLOATER.hover === 2.2 && FLOATER.zipSpeed === 9, 'the fight numbers are M120 s1\'s')
ok(FLIT_HIT_R === 0.5, 'the core sphere is the one this body was built to')
// M120 s3c: WHAT A ROUND HITS. A point round dropped on each drawn lump, in every pose (beats included), turned any way: it hits
// the wings (root to near the tip), the tail, the feet, the reach; just past them it misses. `ray` = a short step through q along d.
type V3 = THREE.Vector3
const hbody = (p: FlitPose, yaw = 0, x = 0, y = 0, z = 0) => ({ x, y, z, yaw, flit: p })
const yawed = (v: V3, yaw: number) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
const touch = (p: FlitPose, q: V3, yaw = 0) => { const w = yawed(q, yaw).add(new THREE.Vector3(3, 2, -7)); return flitHit(hbody(p, yaw, 3, 2, -7), w.x, w.y, w.z, w.x + 1e-4, w.y, w.z) }
const along = (m: THREE.Matrix4, col: 0 | 1 | 2, k: number) => at(m).add(new THREE.Vector3().setFromMatrixColumn(m, col).multiplyScalar(k))
const POSES: [string, FlitPose][] = [['rest', P()], ...[0, 0.03, 0.06, 0.09].map((t, i) => [`zip beat ${i}`, P({ t: 1 + t, zip: 1, bank: i % 2 ? 0.9 : -0.9 })] as [string, FlitPose]), ['tell', P({ tell: 1 })], ['half tell', P({ tell: 0.5, zip: 0.3 })], ['kick', P({ tell: 1, kick: 1 })], ['knock', P({ knock: 1 })]]
for (const [n, p] of POSES) {
  const ms = flitMats(); poseFlit(p, ms)
  for (const yaw of [0, 0.7, 2.6, -1.9]) {
    let wings = 0, tailN = 0, feet = 0
    for (let k = 0; k < 4; k++) for (const f of [-0.6, 0, 0.5, 0.93]) wings += +touch(p, along(ms[FLIT.wings + k], 0, f), yaw)
    for (let k = 0; k < FLIT.abdN; k++) tailN += +touch(p, at(ms[FLIT.abd + k]), yaw)
    for (let k = 0; k < FLIT.legN; k++) feet += +touch(p, k % 2 ? along(ms[FLIT.legs + k], 1, 0.85) : at(ms[FLIT.legs + k]), yaw)   // odd = below the knee: its foot
    ok(wings === 16 && tailN === 5 && feet === 8 && touch(p, at(ms[FLIT.armR + 2]), yaw), `${n} yaw ${yaw}: wings ${wings}/16, tail ${tailN}/5, legs ${feet}/8, reach`)
    ok([0, 1, 2, 3].every(k => !touch(p, along(ms[FLIT.wings + k], 0, 1.5), yaw)) && !touch(p, along(ms[FLIT.abd + 4], 2, -2.6), yaw), `${n} yaw ${yaw}: past a wing tip and past the tail is a miss`)
  }
}
// it FOLLOWS the pose: the tell's wing is not where the hold's was, and the gaps between the parts stay gaps
{ const tip = along(hold[FLIT.wings + 2 - 1], 0, 0.8), up = along(tell[FLIT.wings + 1], 0, 0.8)
  ok(touch(P(), tip) && !touch(P({ tell: 1 }), tip) && touch(P({ tell: 1 }), up) && !touch(P(), up), 'the wing a round meets moves with the pose')
  ok(touch(P(), tail(hold)) && !touch(P({ tell: 1 }), tail(hold)), 'the tail too')
  ok(!touch(P(), new THREE.Vector3(0.55, 0, -0.85)) && !touch(P(), new THREE.Vector3(0, 0.62, 0)), 'between wing and tail, and over its back, is still a miss') }
// the broad phase never cuts a part off, and every part is thin
for (const [n, p] of POSES) { const q = flitParts(p); ok(q.length === FLIT_PARTS * 7, 'parts'); let far = 0, fat = 0
  for (let i = 0; i < q.length; i += 7) { fat = Math.max(fat, q[i + 6]); for (const o of [0, 3]) far = Math.max(far, Math.hypot(q[i + o], q[i + o + 1], q[i + o + 2]) + q[i + 6]) }
  ok(far + 0.37 * Math.max(p.kick * 0.33, p.knock * 0.68) + 0.05 * p.tell <= FLIT_REACH && fat <= 0.13, `${n}: furthest ${far.toFixed(2)} (broad phase ${FLIT_REACH}), thickest ${fat}`) }
// the new effective size: the area a straight shot can hit, seen from the front / side / above (the old sphere: 0.785 m2)
{ const area = (p: FlitPose, ax: 0 | 1 | 2) => { let n = 0; const S = 0.03; for (let u = -1.4; u < 1.4; u += S) for (let v = -1.4; v < 1.4; v += S) { const a = [u, v, 0], b = [u, v, 0]; const o = [[2, 1, 0], [0, 2, 1], [0, 1, 2]][ax]; const A = [0, 0, 0], B = [0, 0, 0]; A[o[0]] = a[0]; A[o[1]] = a[1]; A[o[2]] = -3; B[o[0]] = b[0]; B[o[1]] = b[1]; B[o[2]] = 3; if (flitHit(hbody(p), A[0], A[1], A[2], B[0], B[1], B[2])) n++ } return n * S * S }
  for (const [n, p] of [['hold', P()], ['zip', P({ zip: 1 })], ['tell', P({ tell: 1 })]] as const) { const [s, t, f] = [area(p, 0), area(p, 1), area(p, 2)]; console.log(`  hit area ${n}: front ${f.toFixed(2)} m2, side ${s.toFixed(2)}, above ${t.toFixed(2)} (was 0.79 from anywhere)`); ok(f > 0.85 && f < 1.6 && s > 0.85 && s < 1.6 && t < 2, `${n}: bigger than the old sphere, under twice it seen level`) } }
// IN THE SIM: rounds through stepCombat, whose own pose step the test reads
{ const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain, far = { x: 40, y: 0, z: 40 }
  const shot = (q: [number, number, number], dir: 'x' | 'y') => { const c = newCombat(); const h = spawnHollow(c, T, 0, -10, 'floater'); h.x = 0; h.z = -10; h.yaw = 0; h.state = 'recover'; h.t = 9; h.hp = 30
    for (let k = 0; k < 30; k++) { h.state = 'recover'; h.t = 9; stepCombat(c, T, far, 1 / 60) }
    const [x, y, z] = [h.x + q[0], h.y + q[1], h.z + q[2]]
    c.rounds.push({ x: dir === 'x' ? x - 1.2 : x, y: dir === 'y' ? y + 1.2 : y, z, vx: dir === 'x' ? 150 : 0, vy: dir === 'y' ? -150 : 0, vz: 0, life: 1, dmg: 5, crit: 5 } as never); stepCombat(c, T, far, 1 / 60); return h.hp < 30 }
  ok(shot([0, 0.42, 0], 'x') && shot([0, -0.42, 0], 'x'), 'a round 0.42 m off its middle still hits'); ok(!shot([0, 0.62, 0], 'x'), 'a round 0.62 m over its middle still misses')
  ok(shot([0.78, 0, 0], 'y') && shot([-0.78, 0, 0], 'y'), 'a round on a wing tip hits (0.78 m out)'); ok(!shot([1.1, 0, 0], 'y'), '1.1 m out misses')
  const t = tail(hold); ok(shot([0, t.y, t.z], 'x'), `a round on the tail hits (${t.y.toFixed(2)}, ${t.z.toFixed(2)})`)
  // the sim's own pose: zip spread, tell complete before the first shot, beating
  const c = newCombat(3), h = spawnHollow(c, T, 0, -12, 'floater'); h.state = 'chase'; h.t = 0; let zipMax = 0, tellAt = 0; const lifts: number[] = []
  for (let k = 0; k < 60 * 12 && !c.spits.length; k++) { stepCombat(c, T, { x: 0, y: 0, z: 0 }, 1 / 60); zipMax = Math.max(zipMax, h.flit!.zip); if (h.flit!.zip > 0.8) lifts.push(wingLift(h.flit!, 0)) }
  tellAt = h.flit!.tell
  ok(zipMax > 0.9 && tellAt > 0.95 && Math.max(...lifts) - Math.min(...lifts) > 1, `the sim's pose: zip ${zipMax.toFixed(2)}, tell ${tellAt.toFixed(2)} at the first shot, wings beat`) }
// both sides read ONE pose
ok(/if \(flitHit\(h, ox, oy, oz, r\.x, r\.y, r\.z\)\)/.test(readFileSync(new URL('./combat.ts', import.meta.url), 'utf8')) && /if \(h\.flit\) Object\.assign\(P, h\.flit\)/.test(readFileSync(new URL('./combat-layer.tsx', import.meta.url), 'utf8')), 'combat.ts tests a round with flitHit; FlitBody draws Hollow.flit')
console.log(`flit-body: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
