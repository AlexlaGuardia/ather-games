// Hit-response oracle. Run: npx tsx src/app/shimmer/voxel3d/hollow-hit.test.ts
//
// The state half (hp, flinch, recoil, the caster interrupt, fray) is in hollows.test.ts. This is
// the LOOK and the WIRING: that fray actually reaches the skin, that a flinch actually tilts the
// body the way the round was going, that a host passing nothing gets the pose it always got
// byte-for-byte, and that the world's shot site routes through `hollowHit` with the head crit.

import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHollowMeshBody, updateHollowMeshBody, SKIN } from './hollow-mesh'
import { FORM_ORDER } from './hollows'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const positions = (g: THREE.Group): Float32Array => {
  const skin = g.getObjectByName(SKIN) as THREE.SkinnedMesh
  const pos = skin.geometry.getAttribute('position') as THREE.BufferAttribute
  return Float32Array.from(pos.array as Float32Array)
}
const pivotOf = (g: THREE.Group) => g.children.find(c => c.name === 'hollowPivot') as THREE.Group | undefined
const meanDiff = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length }

for (const form of FORM_ORDER) {
  const t = 0.7
  // ── control: no look === look with zeros, byte for byte ──────────────────────────────────
  const a = createHollowMeshBody(form); updateHollowMeshBody(a, t, form, 1)
  const b = createHollowMeshBody(form); updateHollowMeshBody(b, t, form, 1, true, { fray: 0, flinch: 0 })
  ok(meanDiff(positions(a), positions(b)) === 0, `${form}: a zero look is byte-identical to no look (the old pose is untouched)`)
  const pa = pivotOf(a), pb = pivotOf(b)
  ok(!!pa && !!pb, `${form}: the pivot is findable`)
  if (pa && pb) ok(pa.quaternion.equals(new THREE.Quaternion()) && pa.position.y === pb.position.y, `${form}: no flinch = identity pivot`)

  // ── fray reaches the skin, and monotonically ──────────────────────────────────────────────
  const rest = positions(a)
  const half = createHollowMeshBody(form); updateHollowMeshBody(half, t, form, 1, true, { fray: 0.5 })
  const gone = createHollowMeshBody(form); updateHollowMeshBody(gone, t, form, 1, true, { fray: 1 })
  const d0 = 0, d5 = meanDiff(positions(half), rest), d1 = meanDiff(positions(gone), rest)
  ok(d5 > d0 && d1 > d5, `★★ ${form}: the skin frays with lost hp (Δ half ${d5.toFixed(4)} → gone ${d1.toFixed(4)})`)
  ok(d1 < 0.25, `${form}: a fully frayed body is still a body, not noise (mean Δ ${d1.toFixed(3)})`)

  // ── flinch: buckle + tilt toward the round ─────────────────────────────────────────────────
  const f = createHollowMeshBody(form); updateHollowMeshBody(f, t, form, 1, true, { flinch: 1, fx: 1, fz: 0 })
  const pf = pivotOf(f)!
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pf.quaternion)
  ok(up.x > 0.3, `★★ ${form}: at flinch 1 the top tips toward the round (+x): up.x ${up.x.toFixed(2)}`)
  ok(pf.position.y < (pa?.position.y ?? 0) - 0.1, `${form}: and the body buckles (pivot y ${pf.position.y.toFixed(2)} vs ${pa?.position.y.toFixed(2)})`)
  const fz = createHollowMeshBody(form); updateHollowMeshBody(fz, t, form, 1, true, { flinch: 1, fx: 0, fz: -1 })
  const upz = new THREE.Vector3(0, 1, 0).applyQuaternion(pivotOf(fz)!.quaternion)
  ok(upz.z < -0.3 && Math.abs(upz.x) < 1e-6, `${form}: a round along −z tips the top toward −z (up.z ${upz.z.toFixed(2)})`)
  // the next frame with no flinch restores identity on the SAME body
  updateHollowMeshBody(f, t + 0.016, form, 1, true, { flinch: 0 })
  ok(pf.quaternion.equals(new THREE.Quaternion()), `${form}: the tilt is per-frame, not accumulated — flinch 0 restores identity`)
}

// ── the wiring ───────────────────────────────────────────────────────────────────────────────
{
  const src = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  ok(/const \{ dispersed \} = hollowHit\(st, sh\.dx, sh\.dz, hp\.head \? sh\.crit : sh\.dmg, hp\.head\)/.test(src),
     '★★ the shot site lands through hollowHit, the head zone pays the weapon crit, and the body is TOLD it was a head (the warden only reacts to those)')
  ok(/if \(dispersed\) \{/.test(src), 'the shard drops on the round that dispersed it, not on any round into a corpse')
  ok(/crit: w\.crit,/.test(src), '★ a gun round carries its weapon\'s crit')
  ok(/dmg: out\.placed\.damage, crit: out\.placed\.damage,/.test(src), 'a cast bolt carries its own damage as its crit (a bolt is a place, not a bullet)')
  ok(/\{ fray: hollowFray\(st\), flinch: st\.flinch, fx: st\.flinchX, fz: st\.flinchZ \}/.test(src),
     '★★ the mesh update is handed the body\'s fray and flinch every frame')
  // fields and burns stay raw hp: a field must not flinch a body sixty times a second
  ok(/st\.hp -= fd\.dps/.test(src) && /st\.hp -= ig\.burn/.test(src), 'fields and burns take hp directly, never through hollowHit (no seizure)')
  const shotLoop = src.slice(src.indexOf('// ── Hollows absorb rounds next'), src.indexOf('// ── ★★ AND HERE IS WHERE THE TWO KINDS OF ROUND'))
  ok(shotLoop.length > 100 && !/st\.hp -= /.test(shotLoop), 'and the shot loop itself never touches hp directly')
}

console.log(fails.length ? `❌ hollow-hit: ${pass} pass, ${fails.length} fail\n  - ${fails.join('\n  - ')}` : `✅ hollow-hit: ${pass} pass, 0 fail`)
if (fails.length) process.exit(1)
