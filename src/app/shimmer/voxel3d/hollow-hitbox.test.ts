// Hollow hitbox oracle. Run: npx tsx src/app/shimmer/voxel3d/hollow-hitbox.test.ts
//
// `HOLLOW_FORMS[f].hitLo/hitHi` claim to be the drawn body's vertical span relative to `st.y`. This
// measures the SHIPPED mesh (`createHollowMeshBody`, the one `VoxelWorld` spawns) across the walk
// cycle and holds the constants to it FROM BOTH SIDES: they must cover the body (or a head shot
// misses) and they must not exceed it by more than a hand (or the column is a barn door and a
// miss no longer means anything). One side alone is satisfied by any large enough number.
//
// ⚠ Bounds are taken over the DRAW RANGE of every mesh in the group, not `Box3.setFromObject`,
// which reads the whole preallocated buffer (see hollow-meta.test.ts for the alarm that caused).

import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHollowMeshBody, updateHollowMeshBody } from './hollow-mesh'
import { HOLLOW_FORMS, FORM_ORDER } from './hollows'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

function bounds(g: THREE.Group): THREE.Box3 {
  g.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  let n = 0
  g.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible) return
    let p: THREE.Object3D | null = m
    while (p) { if (!p.visible) return; p = p.parent }
    const pos = m.geometry.getAttribute('position')
    if (!pos) return
    const count = Math.min(m.geometry.drawRange.count, pos.count)
    for (let i = 0; i < count; i++) { box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)); n++ }
  })
  ok(n > 50, `the body actually has drawn vertices (${n})`)
  return box
}

const SLACK_COVER = 0.06   // the constants may under-cover by at most this (animation jitter)
const SLACK_LOOSE = 0.35   // and over-cover by at most this

for (const form of FORM_ORDER) {
  const f = HOLLOW_FORMS[form]
  let lo = Infinity, hi = -Infinity
  for (const t of [0, 0.4, 0.9, 1.7]) for (const speed of [0, 1]) {
    const g = createHollowMeshBody(form)
    updateHollowMeshBody(g, t, form, speed)
    const b = bounds(g)
    // the mesh is drawn at `st.y - hover`, so local y - hover is the span relative to st.y
    lo = Math.min(lo, b.min.y - f.hover); hi = Math.max(hi, b.max.y - f.hover)
  }
  console.log(`  ${form.padEnd(8)} drawn span rel st.y ${lo.toFixed(2)} .. ${hi.toFixed(2)}   declared ${f.hitLo} .. ${f.hitHi}`)
  ok(f.hitLo <= lo + SLACK_COVER, `★★ ${form}: hitLo ${f.hitLo} covers the drawn bottom ${lo.toFixed(2)}`)
  ok(f.hitHi >= hi - SLACK_COVER, `★★ ${form}: hitHi ${f.hitHi} covers the drawn top ${hi.toFixed(2)} — or a head shot misses`)
  ok(f.hitLo >= lo - SLACK_LOOSE, `★ ${form}: hitLo ${f.hitLo} is not fitted loose below the body (${lo.toFixed(2)})`)
  ok(f.hitHi <= hi + SLACK_LOOSE, `★ ${form}: hitHi ${f.hitHi} is not fitted loose above the body (${hi.toFixed(2)}) — a barn door makes a miss meaningless`)
}

// ── the wiring: the shot site measures against the column, and the marble is gone ─────────────
{
  const src = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  ok(/const mesh = createHollowMeshBody\(form\)/.test(src), 'the world spawns the mesh this file measured (if red, re-point the instrument)')
  ok(/const hp = hollowHitPoint\(sh\.x, sh\.y, sh\.z, sh\.dx, sh\.dy, sh\.dz, step, st\)\n\s*if \(hp\.dist < formOf\(st\)\.radius\)/.test(src),
     '★★ the round is tested against the body COLUMN (hollowHitPoint.dist vs the form radius)')
  ok(!/segmentDist\(sh\.x, sh\.y, sh\.z, sh\.dx, sh\.dy, sh\.dz, step, st\.x, st\.y, st\.z\)/.test(src),
     '★★ the one-sphere-at-the-feet test is gone')
  ok(/m\.position\.set\(st\.x, hp\.testY, st\.z\)/.test(src), 'the hit flash sits where the round met the column, not at the feet')
}

console.log(fails.length ? `❌ hollow-hitbox: ${pass} pass, ${fails.length} fail\n  - ${fails.join('\n  - ')}` : `✅ hollow-hitbox: ${pass} pass, 0 fail`)
if (fails.length) process.exit(1)
