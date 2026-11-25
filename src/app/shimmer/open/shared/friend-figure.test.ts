// BETA M154: npx tsx src/app/shimmer/open/shared/friend-figure.test.ts
import * as THREE from 'three'
import { FRIEND_IDS, FRIEND_CALLS, FRIEND_COLOR, friendFigure, isFriend, band } from './friend-figure'
import { gladeKeepers } from '../ather/glade-cluster'
let n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { console.error('✗ ' + m); process.exitCode = 1 } }
ok(gladeKeepers().length === 3 && gladeKeepers().every(k => isFriend(k.id)), 'everyone the Glade stands as a friend has a figure (else the view draws nobody)')
ok(FRIEND_CALLS <= 36, 'no more draw calls than the old folk figure (~36)')
const has = (g: THREE.BufferGeometry, hex: string) => { const c = new THREE.Color(hex), a = g.attributes.color; for (let k = 0; k < a.count; k++) if (Math.abs(a.getX(k) - c.r) + Math.abs(a.getY(k) - c.g) + Math.abs(a.getZ(k) - c.b) < 1e-3) return true; return false }
for (const id of FRIEND_IDS) {
  const f = friendFigure(id)
  ok(f === friendFigure(id), `${id}: built once`)
  let tris = 0, lo = Infinity
  for (const J of Object.values(f.joints)) for (const g of [J.toon, J.ink]) {
    ok([...g.attributes.position.array].every(Number.isFinite), `${id}: finite`); tris += g.index!.count / 3
    if (g === J.toon) { g.computeBoundingBox(); lo = Math.min(lo, g.boundingBox!.min.y + J.at[1]) }
  }
  ok(tris < 40000, `${id}: ${tris} triangles`)
  ok(Math.abs(lo) < 0.02, `${id}: soles on the ground (${lo.toFixed(3)})`)
  ok(f.crown > 1.5 && f.crown < 1.72, `${id}: an adult's crown under the 1.75 m talk camera`)
  // the parts stand in: every locked colour is on the figure somewhere
  for (const [k, hex] of Object.entries(FRIEND_COLOR[id])) ok([...Object.values(f.joints).map(J => J.toon), f.face, f.eyes].some(g => has(g, hex)), `${id}: ${k}`)
  const outward = (() => { const g = f.joints.body.toon, P = g.attributes.position, N = g.attributes.normal, i = g.index!.array; let bad = 0
    for (let k = 0; k < i.length; k += 3) { const [a, b, c] = [0, 1, 2].map(q => new THREE.Vector3().fromBufferAttribute(P, i[k + q])), fn = b.clone().sub(a).cross(c.clone().sub(a)); if (fn.length() > 1e-9 && fn.dot(new THREE.Vector3().fromBufferAttribute(N, i[k])) < -1e-9) bad++ }
    return bad / (i.length / 3) })()
  ok(outward < 0.02, `${id}: faces wound with their normals (${(outward * 100).toFixed(1)}% wrong)`)
}
const [b, o, t] = FRIEND_IDS.map(friendFigure)
ok(o.shoulderW > 1.5 * Math.max(b.shoulderW, t.shoulderW), 'Otto is the broad one')
ok(o.crown > b.crown && b.shoulderW < 0.4, 'Bonn is small for her age still')
const L = (h: string) => { const c = new THREE.Color(h); return c.r + c.g + c.b }
ok(L(FRIEND_COLOR.otto.skin) > 2 * L(FRIEND_COLOR.bonn.skin), 'Otto is fair (Alex 11-25), Bonn warm brown')
ok(has(friendFigure('otto').joints.armL.toon, FRIEND_COLOR.otto.skin) && has(friendFigure('otto').joints.armL.toon, FRIEND_COLOR.otto.glove), 'fingerless gloves: skin and glove on one arm')
ok(!has(friendFigure('tess').joints.legL.toon, FRIEND_COLOR.tess.skin), "Tess's trousers go into her boots: no ankle shows")
ok(has(friendFigure('bonn').joints.legL.toon, FRIEND_COLOR.bonn.skin), "Bonn's are rolled above the boot")
const vol = (g: THREE.BufferGeometry) => { const P = g.attributes.position, i = g.index!.array; let v = 0; for (let k = 0; k < i.length; k += 3) { const [a, b, c] = [0, 1, 2].map(q => new THREE.Vector3().fromBufferAttribute(P, i[k + q])); v += a.dot(b.cross(c)) / 6 } return v }
ok(vol(band([[0.2, 0], [0.2, 1]], 0.7, () => 0.5, 0.05)) > 0, 'a strap is solid side out (inside out it drew as a black ring)')
const count = (g: THREE.BufferGeometry, hex: string) => { const c = new THREE.Color(hex), a = g.attributes.color; let k = 0; for (let q = 0; q < a.count; q++) if (Math.abs(a.getX(q) - c.r) + Math.abs(a.getY(q) - c.g) + Math.abs(a.getZ(q) - c.b) < 1e-3) k++; return k }
ok(count(o.joints.armL.toon, FRIEND_COLOR.otto.glove) > 350, 'the glove is the whole hand, not only its cuff')
console.log(`friend-figure: ${n} checks${process.exitCode ? ' FAIL' : ' ok'}`)
