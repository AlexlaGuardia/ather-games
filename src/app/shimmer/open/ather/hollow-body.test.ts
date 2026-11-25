// ather/hollow-body.ts: the POOLER's lumps (the Walker left for walker-body.ts in M163, its asserts with it): low, on the
// ground, many-legged, and the wind-up GATHERING in and RISING.
import * as THREE from 'three'
import { sprout, poseSprout } from './hollow-body'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const posed = (p: Partial<{ t: number; tell: number; fall: number; walk: number; knock: number }> = {}) => {
  const S = sprout('crawler'), out = S.lumps.map(() => new THREE.Matrix4()); poseSprout(S, { t: 0, tell: 0, fall: 0, walk: 0, knock: 0, ...p }, out)
  const box = new THREE.Box3(), v = new THREE.Vector3()
  out.forEach(m => { for (const s of [-1, 1]) for (const a of [[s, 0, 0], [0, s, 0], [0, 0, s]]) box.expandByPoint(v.fromArray(a).applyMatrix4(m)) })
  return { S, box, size: box.getSize(new THREE.Vector3()) }
}
const rest = posed(), tell = posed({ tell: 1 }), fall = posed({ fall: 1 }), knock = posed({ knock: 1 })
ok(rest.S.lumps.length === 12, `${rest.S.lumps.length} lumps (one instanced draw)`)
ok(rest.box.max.y < 0.8 && rest.box.min.y > -0.08, `low, on the ground (${rest.box.min.y.toFixed(2)} .. ${rest.box.max.y.toFixed(2)})`)
ok(tell.box.max.y > rest.box.max.y + 0.05 && tell.size.x < rest.size.x * 0.85, 'the tell rises and gathers in')
ok(fall.box.max.z > rest.box.max.z + 0.2, 'the lunge falls FORWARD (+z is its face)'); ok(knock.box.min.z < rest.box.min.z - 0.1, 'a hit knocks it BACK')
ok(!posed({ t: 0, walk: 1 }).box.equals(posed({ t: 0.3, walk: 1 }).box), 'it moves on its own clock')
console.log(`hollow-body: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
