// The BAKED SCULPTS standing in for station boxes — the half `modelFits` cannot see.
// Run: npx tsx src/app/shimmer/voxel3d/station-sculpt.test.ts
//
// ★ WHY THIS FILE EXISTS AT ALL. `station-models.test.ts` § 2 checks that every BOX is inside the
// unit cell, and a model whose shape is a sculpt has no boxes — so every loop in `modelFits` runs
// zero times and it returns ok. That is the exact failure INSTRUMENTS.md names: a guard that
// cannot see its subject reports on nothing, in green. This one reads the SHIPPED VERTICES, which
// is the only instrument that can answer the question the box check was asking.
import * as THREE from 'three'
import { MAT, MODELLED_MATS } from '../voxel/depth'
import { blockDef } from '../voxel/registry'
import { TILE_MATERIALS } from './tex/tiles'
import { EMISSIVE } from './attrs'
import { modelOf } from './station-models'
import { SCULPTS, buildStationGeometry } from './station-mesh'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const sculpted = [...MODELLED_MATS].filter(m => modelOf(m).sculpt)
ok(sculpted.length >= 1, '§0 at least one station is a sculpt (or this whole file is measuring nothing)')

// ── §1 every node resolves, and the cell contains every VERTEX ────────────────────────────────
for (const mat of sculpted) {
  const name = blockDef(mat)?.name ?? String(mat)
  const sc = modelOf(mat).sculpt!
  for (const sp of sc.parts) {
    const make = SCULPTS[sc.model]?.[sp.node]
    ok(!!make, `§1 ${name}: sculpt '${sc.model}' resolves node '${sp.node}'`)
    if (!make) continue
    const g = make()
    // ★ THE CEILING IS THE MODEL'S OWN (2026-09-23), exactly as `modelFits`' is. A tall station
    // owns the cell above it too, so the bench's box is 1x2x1 — and a SHORT sculpt is still
    // measured against 1, which is what keeps this a containment test rather than one that
    // relaxed for every vessel the day one object grew. A blanket 2 here would have retired the
    // invisible-wall guard for the cauldron, the mortar, the bowl and the still in one line.
    const ceil = modelOf(mat).tall ? 2 : 1
    // The renderer's own shift — authored about the cell centre, built about its min corner. The
    // check runs on the SAME coordinates the world draws, not on the authoring frame.
    g.translate(0.5, 0, 0.5)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    let bad = 0
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
    for (let i = 0; i < pos.count; i++) {
      const v = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]) }
      if (v[0] < -1e-6 || v[0] > 1 + 1e-6 || v[1] < -1e-6 || v[1] > ceil + 1e-6 || v[2] < -1e-6 || v[2] > 1 + 1e-6) bad++
    }
    ok(bad === 0, `§1 ★ ${name}/${sp.node}: every vertex inside the cell (${bad} outside, ceiling ${ceil}) — a leak is the invisible-wall bug`)
    console.log(`   ${name}/${sp.node}: ${pos.count / 3} tris  x ${lo[0].toFixed(3)}..${hi[0].toFixed(3)}  y ${lo[1].toFixed(3)}..${hi[1].toFixed(3)}  z ${lo[2].toFixed(3)}..${hi[2].toFixed(3)}`)
    ok(sp.top === undefined || TILE_MATERIALS.includes(sp.top), `§1 ${name}/${sp.node}: its top tile exists`)
    ok(sp.side === undefined || TILE_MATERIALS.includes(sp.side), `§1 ${name}/${sp.node}: its side tile exists`)
  }
}

// ── §2 ★ THE 60-DEGREE CONE: A PARTLY UP-FACING PART MUST NAME ITS `top` TILE ─────────────────
// The piece program picks its tile with a hard branch, `an.y > 0.5 ? vLayerTop : vLayerSide`, and
// that is a 60-degree CONE about vertical rather than a dominant-axis test. So a facet whose wall
// tips past ~30 degrees off plumb reads `top` — and a station's own top tile is frequently not
// clay (the cauldron's is the dark WATER DISC). Leaving `top` to default on a part that has any
// up- or down-facing facets is how water gets painted across a pot's shoulder.
// A part that is ENTIRELY up-facing is exempt: it IS a surface (the brew, a lid), and the default
// is the point of it. So the rule is about MIXED parts, which is where the mistake lives.
for (const mat of sculpted) {
  const name = blockDef(mat)?.name ?? String(mat)
  const sc = modelOf(mat).sculpt!
  for (const sp of sc.parts) {
    const make = SCULPTS[sc.model]?.[sp.node]
    if (!make) continue
    const g = make()
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3()
    let up = 0, total = 0
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2)
      ab.subVectors(b, a); ac.subVectors(c, a); n.crossVectors(ab, ac)
      if (n.lengthSq() < 1e-18) continue
      n.normalize()
      total++
      if (Math.abs(n.y) > 0.5) up++
    }
    const frac = total ? up / total : 0
    console.log(`   ${name}/${sp.node}: ${(frac * 100).toFixed(1)}% of facets take the TOP branch`)
    if (frac > 1e-9 && frac < 1 - 1e-9) {
      ok(sp.top !== undefined,
        `§2 ★ ${name}/${sp.node} is ${(frac * 100).toFixed(1)}% up-facing and must name its top tile — the default is the station's own, and a cauldron's is dark water`)
    }
  }
}

// ── §3 ★ THE MERGE INDEXES EVERY VERTEX — the silent-drop guard ───────────────────────────────
// A baked sculpt is NOT indexed; `BoxGeometry` is. The merged geometry carries ONE index, so a
// part that contributes no index entries contributes no TRIANGLES — it rides along referenced by
// nothing and draws as an empty object, with no error and every other guard green. An all-sculpt
// station would have rendered as thin air.
for (const mat of sculpted) {
  const name = blockDef(mat)?.name ?? String(mat)
  const g = buildStationGeometry(mat, modelOf(mat))
  const idx = g.getIndex()
  const verts = (g.getAttribute('position') as THREE.BufferAttribute).count
  ok(!!idx && idx.count > 0, `§3 ★ ${name}: the merged geometry has triangles at all`)
  ok(!!idx && idx.count >= verts, `§3 ★ ${name}: the index covers every vertex (${idx?.count} entries for ${verts} vertices)`)
  // position + normal are required; the layer attrs are written by the renderer for every part.
  // `uv` is deliberately NOT required — a lathe has no UV map and the piece program never reads
  // one. What IS required is that whatever ships covers every vertex: a partial attribute is a
  // misaligned buffer, and every vertex past the first part would sample someone else's row.
  for (const attr of ['normal', 'aLayerTop', 'aLayerSide', 'aEmissive']) {
    ok((g.getAttribute(attr) as THREE.BufferAttribute | undefined)?.count === verts,
      `§3 ${name}: ${attr} is present for every vertex`)
  }
  for (const attr of ['uv']) {
    const a = g.getAttribute(attr) as THREE.BufferAttribute | undefined
    ok(a === undefined || a.count === verts, `§3 ★ ${name}: ${attr} is absent or COMPLETE, never partial`)
  }
}

// ── §4 ★ THE LIT POT GLOWS WHERE THE BREW IS AND NOWHERE ELSE ─────────────────────────────────
// A part's glow defaults to `EMISSIVE[side ?? the station]`. The box cauldron wrote `side:
// MAT.CAULDRON` on its brew slab, which ALSO silenced it — EMISSIVE[CAULDRON] is unset, so the
// running cauldron's brew rendered dead from the day it stopped being a cube (09-15) while
// EMISSIVE[CAULDRON_LIT] = 0.7 sat unused and `paintCauldron` kept painting the alpha the shader
// multiplies by. Exactly what `piece-mesh.ts`'s header warns of. This is the guard that keeps it.
{
  const glowOf = (mat: number, node: string) => {
    const sp = modelOf(mat).sculpt!.parts.find(p => p.node === node)!
    return sp.glow ?? (EMISSIVE[sp.side ?? mat] ?? 0)
  }
  ok(glowOf(MAT.CAULDRON_LIT, 'Brew') === EMISSIVE[MAT.CAULDRON_LIT] && glowOf(MAT.CAULDRON_LIT, 'Brew') > 0,
    '§4 ★ the LIT brew glows at the block\'s own EMISSIVE — the liquid is the light source')
  ok(glowOf(MAT.CAULDRON_LIT, 'Body') === 0, '§4 ★ and the pot around it does not — a glowing pot is the opposite regression')
  ok(glowOf(MAT.CAULDRON, 'Brew') === 0, '§4 the IDLE cauldron\'s water glows not at all — it promises no brew')
  ok(glowOf(MAT.CAULDRON, 'Body') === 0, '§4 nor does the idle pot')
}

console.log(`station-sculpt: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
