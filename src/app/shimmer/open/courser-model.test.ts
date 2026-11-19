// courser-model.ts: Alex's M35 pick (Darter carriage-born, every other kind chunky); every courser shows its canon parts.
import * as THREE from 'three'
import { buildCourser, animateCourser, STYLE_OF, type CourserKind } from './courser-model'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const look = (kind: CourserKind) => ({ kind, body: '#3f7a52', cabin: '#1d3326', len: 1, wide: 1, tall: 1 })
ok(STYLE_OF.darter === 'carriage' && STYLE_OF.hauler === 'chunky' && STYLE_OF.scrambler === 'chunky' && STYLE_OF.skitter === 'chunky', "Alex's pick: Darter carriage, the rest chunky")
for (const k of ['darter', 'hauler', 'scrambler', 'skitter'] as CourserKind[]) {
  const r = buildCourser(look(k))
  ok(r.wheels.length === (k === 'skitter' ? 2 : 4) && r.front.length === (k === 'skitter' ? 1 : 2), `${k}: wheels + steering fronts`)
  ok(r.trims.length >= 2 && !!r.core && !!r.rune, `${k}: channel trim, mana core and driver's rune are all there`)
  const box = new THREE.Box3().setFromObject(r.root), size = box.getSize(new THREE.Vector3())
  ok(Math.abs(box.min.y) < 0.05, `${k}: sits on the ground (min y ${box.min.y.toFixed(2)})`)
  ok(r.front.every(w => w.position.z < 0), `${k}: the steering wheels are at the FRONT (-z)`)
  ok(size.z > size.x, `${k}: longer than it is wide`)
  let meshes = 0; r.root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++ })
  ok(meshes < 90, `${k}: ${meshes} meshes (a budget, not a target)`)
  const spin = r.wheels[0].getObjectByName('spin')!, c0 = (r.core.material as THREE.MeshBasicMaterial).color.clone()
  animateCourser(r, 1.2, 0.3, 90, 2, 0.016)
  ok(Math.abs(spin.rotation.x + 1.2) < 1e-9 && Math.abs(r.front[0].rotation.y + 0.3) < 1e-9, `${k}: wheels roll and the fronts steer`)
  animateCourser(r, 1.2, 0.3, 0, 2, 0.016); const slow = (r.core.material as THREE.MeshBasicMaterial).color.r
  animateCourser(r, 1.2, 0.3, 100, 2, 0.016); const fast = (r.core.material as THREE.MeshBasicMaterial).color.r
  ok(fast > slow && !!c0, `${k}: the core brightens with speed`)
}
const darter = buildCourser(look('darter')), hauler = buildCourser(look('hauler'))
ok(hauler.R > darter.R * 1.2, 'chunky wheels are visibly bigger than the carriage-born darter\'s')
console.log(`courser-model: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
