// ather/hollow-body.ts: Alex's pick A (rooted sprout) as lumps: the head where the sim aims, feet on the ground, the caster
// floating dense only at the reach, and the wind-up GATHERING in and RISING (the tell he picked).
import * as THREE from 'three'
import { sprout, poseSprout, WALKER_HEAD } from './hollow-body'
import { HEAD_Y, BODY_Y } from './combat'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const posed = (kind: 'shambler' | 'floater', p: Partial<{ t: number; tell: number; fall: number; walk: number; knock: number }> = {}) => {
  const S = sprout(kind), out = S.lumps.map(() => new THREE.Matrix4()); poseSprout(S, { t: 0, tell: 0, fall: 0, walk: 0, knock: 0, ...p }, out)
  const box = new THREE.Box3(), v = new THREE.Vector3()
  out.forEach((m, i) => { const L = S.lumps[i]; for (const sx of [-1, 1]) for (const sy of [-1, 1]) { v.set(sx, sy, 0).applyMatrix4(m); box.expandByPoint(v); v.set(0, sy, sx).applyMatrix4(m); box.expandByPoint(v) } void L })
  return { S, box, size: box.getSize(new THREE.Vector3()) }
}
ok(WALKER_HEAD === HEAD_Y, 'the walker\'s head is built on the sim\'s HEAD_Y (headshots land on it)')
{ const { S, box, size } = posed('shambler')
  ok(Math.abs(S.head - HEAD_Y) < 1e-9, `head pivot at ${S.head.toFixed(2)} m`)
  ok(box.min.y > -0.08 && box.min.y < 0.08, `feet on the ground (min y ${box.min.y.toFixed(2)})`)
  ok(box.max.y > HEAD_Y && box.max.y < HEAD_Y + 0.5, `top of the head just over HEAD_Y (${box.max.y.toFixed(2)})`)
  ok(S.core > BODY_Y * 0.7 && S.core < BODY_Y * 1.6, `the seed sits in the chest, near BODY_Y (${S.core.toFixed(2)})`)
  ok(size.x > 0.6 && size.x < 1.6, `rooted-sprout wide (${size.x.toFixed(2)} m)`)
  ok(S.lumps.length <= 20, `${S.lumps.length} lumps (one instanced draw)`)
  ok(S.lumps.some(l => l.bone === 'legL') && S.lumps.some(l => l.bone === 'legR'), 'a walker has legs') }
{ const { S, box } = posed('floater')
  ok(S.floats && !S.lumps.some(l => l.bone === 'legL'), 'the caster has no legs: it never got its stem down')
  const reach = S.lumps.filter(l => l.bone === 'armR')[0], other = S.lumps.filter(l => l.bone === 'armL')[0]
  ok(reach.sx > other.sx * 1.8, 'the caster is dense only at its reaching arm')
  ok(box.min.y < 0 && box.max.y > 0, 'a floater is centred on its body (the sim hovers it)') }
{ const rest = posed('shambler'), tell = posed('shambler', { tell: 1 })
  ok(tell.box.max.y > rest.box.max.y + 0.15, `the tell RISES (${rest.box.max.y.toFixed(2)} -> ${tell.box.max.y.toFixed(2)})`)
  ok(tell.size.x < rest.size.x * 0.85, `the tell GATHERS in (${rest.size.x.toFixed(2)} -> ${tell.size.x.toFixed(2)})`)
  const fall = posed('shambler', { fall: 1 }), knock = posed('shambler', { knock: 1 })
  ok(fall.box.max.z > rest.box.max.z + 0.3, 'the lunge falls FORWARD (+z is its face)')
  ok(knock.box.min.z < rest.box.min.z - 0.2, 'a hit knocks it BACK') }
{ const a = posed('shambler', { t: 0, walk: 1 }), b = posed('shambler', { t: 0.3, walk: 1 })
  ok(!a.box.equals(b.box), 'it moves on its own clock (never a statue)') }
console.log(`hollow-body: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
