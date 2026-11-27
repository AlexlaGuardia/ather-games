// BETA M154 follow-up (keeper merge): npx tsx src/app/shimmer/open/shared/keeper-merge.test.ts
// A merged keeper (mergeKeeper after buildKeeper) draws <= CAP meshes, looks the same (every triangle in the same place, same
// colour, same facing), and keeps its moving parts moving on their own (poseKeeper still moves the head / hands / feet).
import * as THREE from 'three'
import { FRIEND_LOOKS, friendProportions } from './friend-looks'
import { FRIEND_IDS } from './friend-figure'
import { buildKeeper, poseKeeper, type KeeperBody } from './keeper-figure'
import { DEFAULT_LOOK, OPT, type Look } from './keeper-look'
import { mergeKeeper, meshCount, KEEPER_MOVERS } from './keeper-merge'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const CAP = 20

/** a figure's look as numbers, per colour + material kind: triangle count, world-space vertex sum, signed volume (facing) */
function fingerprint(g: THREE.Object3D) {
  g.updateMatrixWorld(true)
  const out = new Map<string, { tris: number; sx: number; sy: number; sz: number; vol: number }>()
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], c = new THREE.Color()
  g.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return
    const mat = m.material as THREE.MeshBasicMaterial, kind = `${mat.type}|${mat.side}`
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    const pos = geo.attributes.position, col = geo.attributes.color
    for (let i = 0; i < pos.count; i += 3) {
      for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos as THREE.BufferAttribute, i + j).applyMatrix4(m.matrixWorld)
      if (col && mat.vertexColors) c.fromBufferAttribute(col as THREE.BufferAttribute, i); else c.copy(mat.color)
      const key = `${kind}|${c.getHexString()}`
      let e = out.get(key); if (!e) out.set(key, e = { tris: 0, sx: 0, sy: 0, sz: 0, vol: 0 })
      e.tris++
      for (const p of v) { e.sx += p.x; e.sy += p.y; e.sz += p.z }
      e.vol += v[0].dot(new THREE.Vector3().crossVectors(v[1], v[2])) / 6
    }
  })
  return out
}
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))
function same(name: string, a: ReturnType<typeof fingerprint>, b: ReturnType<typeof fingerprint>) {
  ok(a.size === b.size, `${name}: ${a.size} colour/kind buckets before, ${b.size} after`)
  for (const [k, e] of a) {
    const f = b.get(k)
    if (!f) { ok(false, `${name}: bucket ${k} lost in the merge`); continue }
    ok(e.tris === f.tris, `${name}: ${k} ${e.tris} triangles before, ${f.tris} after`)
    ok(near(e.sx, f.sx) && near(e.sy, f.sy) && near(e.sz, f.sz), `${name}: ${k} moved (vertex sum ${e.sx.toFixed(3)},${e.sy.toFixed(3)},${e.sz.toFixed(3)} -> ${f.sx.toFixed(3)},${f.sy.toFixed(3)},${f.sz.toFixed(3)})`)
    ok(near(e.vol, f.vol, 1e-3), `${name}: ${k} facing / volume changed (${e.vol.toFixed(5)} -> ${f.vol.toFixed(5)})`)
  }
}

const cases: [string, () => KeeperBody][] = [
  ...FRIEND_IDS.map(id => [`friend ${id}`, () => buildKeeper(FRIEND_LOOKS[id].look, friendProportions(id), FRIEND_LOOKS[id].dress)] as [string, () => KeeperBody]),
  ['default keeper', () => buildKeeper(DEFAULT_LOOK)],
  // every head, torso, scarf and hair style once (the heaviest lock sets included)
  ...OPT.hairStyle.map((_, i) => [`hair ${OPT.hairStyle[i]}`, () => buildKeeper({ ...DEFAULT_LOOK, head: 0, hairStyle: i })] as [string, () => KeeperBody]),
  ...Array.from({ length: 9 }, (_, i) => [`head ${i}`, () => buildKeeper({ ...DEFAULT_LOOK, head: i } as Look)] as [string, () => KeeperBody]),
  ...Array.from({ length: 6 }, (_, i) => [`torso ${i} scarf ${i}`, () => buildKeeper({ ...DEFAULT_LOOK, torso: i, scarfStyle: i } as Look)] as [string, () => KeeperBody]),
]
const report: string[] = []
for (const [name, make] of cases) {
  const raw = make(), before = meshCount(raw.group), fpA = fingerprint(raw.group)
  const k = mergeKeeper(make()), after = meshCount(k.group)
  if (name.startsWith('friend') || name === 'default keeper') report.push(`${name}: ${before} -> ${after} meshes`)
  ok(after <= CAP, `${name}: ${after} meshes after the merge (cap ${CAP})`)
  ok(before > after, `${name}: the merge saved nothing (${before} -> ${after})`)
  same(name, fpA, fingerprint(k.group))
  ok(k.height === raw.height && k.headY === raw.headY, `${name}: height / headY changed`)
  // the movers are still there, each holding its own merged meshes, and poseKeeper still moves them alone
  for (const n of KEEPER_MOVERS) {
    const p = k.group.getObjectByName(n)
    ok(!!p && p.parent === k.group, `${name}: mover '${n}' lost`)
    ok(!!p && p.children.some(c => c.userData.merged), `${name}: mover '${n}' holds no merged mesh (its part would not move)`)
  }
  const head = k.group.getObjectByName('head')!, hand = k.group.getObjectByName('hand-l')!
  const hy = head.position.y, hz = hand.position.z
  poseKeeper(k, 0.9, 1)
  ok(head.position.y !== hy, `${name}: poseKeeper no longer bobs the head`)
  ok(hand.position.z !== hz, `${name}: poseKeeper no longer swings the hand`)
  const rootMerged = k.group.children.filter(c => c.userData.merged).length
  ok(rootMerged >= 1 && rootMerged <= 4, `${name}: ${rootMerged} static merged meshes on the root`)
}
// the pose moved the parts but not the merged static body: it sits on the root, which poseKeeper never touches
console.log(report.join('\n'))
console.log(`keeper-merge: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.slice(0, 30).join('\n')); process.exit(1) }
