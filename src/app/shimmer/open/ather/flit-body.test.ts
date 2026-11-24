// ather/flit-body.ts (BETA M120 s3): the floater's insect look, LOOK ONLY. The solid middle stays inside the sim's 0.5 m hit
// sphere, the sphere and the fight numbers are what M120 s1 shipped, three poses that read apart, no light of its own.
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { FLIT, FLIT_HIT_R, flitGeometry, flitMats, geoTris, poseFlit, wingLift, type FlitPose } from './flit-body'
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
ok(tail(tell).z > tail(hold).z + 0.4 && tail(tell).y < -0.3, `tell: the tail curls UNDER, toward the keeper (z ${tail(tell).z.toFixed(2)})`)
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
// LOOK ONLY: the sim's numbers and the sphere a round meets
ok(FLOATER.hp === 30 && FLOATER.damage === 6 && FLOATER.splash === 3 && FLOATER.shots === 3 && FLOATER.charge === 0.7 && FLOATER.hover === 2.2 && FLOATER.zipSpeed === 9, 'the fight numbers are M120 s1\'s')
ok(/h\.kind === 'floater'\) \{\n\s+if \(segDist2\(ox, oy, oz, r\.x, r\.y, r\.z, h\.x, h\.y, h\.z\) < 0\.5 \* 0\.5\)/.test(readFileSync(new URL('./combat.ts', import.meta.url), 'utf8')), 'combat.ts still meets a floater on a 0.5 m sphere at its middle')
ok(FLIT_HIT_R === 0.5, 'and that is the sphere this body is built to')
{ const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
  const shot = (off: number) => { const c = newCombat(); const h = spawnHollow(c, T, 0, -10, 'floater'); h.x = 0; h.z = -10; h.state = 'recover'; h.t = 9
    c.rounds.push({ x: h.x + off, y: h.y, z: -8.5, vx: 0, vy: 0, vz: -120, life: 1, dmg: 5, crit: 5 } as never); stepCombat(c, T, { x: 40, y: 0, z: 40 }, 1 / 60); return h.hp < 30 }
  ok(shot(0.45), 'a round 0.45 m off its middle hits'); ok(!shot(0.56), 'a round 0.56 m off misses (wings are not hit)') }
console.log(`flit-body: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
