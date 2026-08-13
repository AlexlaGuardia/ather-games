// The column-merge oracle. Run: npx tsx src/app/shimmer/voxel3d/merge.test.ts
//
// `concatAttrs` folds a column's per-section attribute buffers into one, so the renderer can spend
// one draw on a column instead of one per section. Every way it can go wrong is SILENT — nothing
// throws, nothing logs, the world just renders subtly (or catastrophically) misplaced:
//
//   · forget the Y lift and all 16 sections stack at the bottom of the column;
//   · apply it twice (here AND on the mesh) and the whole column floats;
//   · forget to shift the indices and every section after the first draws the FIRST section's
//     vertices — a shredded world that still passes a vertex-count check;
//   · let a per-vertex channel slip out of step with its vertex and the colours crawl.
//
// So the central assertion is not "the buffers are the right length". It is that the merged
// TRIANGLE SET, in column space, is exactly the union of the section triangle sets in column space.
// That one property catches all four failures at once, and it is the property the renderer relies
// on.

import { concatAttrs, buildAttrs, buildAttrsSplit, type MeshAttrs, type AttrPart } from './attrs'
import { makeColumn, meshColumn, SECTION } from '../voxel/column'
import { MAT } from '../voxel/depth'
import { isLeafMat } from '../voxel/trees'
import type { MeshResult } from '../voxel/greedy'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/**
 * A one-quad mesh at a known spot, with every channel set to a value derived from `tag` so a
 * channel that slips out of step with its vertex is visible rather than merely wrong.
 */
function quadAt(x: number, y: number, z: number, mat: number): MeshResult {
  const positions = new Float32Array([
    x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1,
  ])
  // +Y face. Normals must NOT be touched by the merge — only positions carry the offset.
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])
  return {
    positions,
    normals,
    materials: new Uint16Array([mat, mat, mat, mat]),
    ao: new Uint8Array([0, 1, 2, 3]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    quads: 1,
    faces: 1,
  }
}

/** Every triangle of an attrs set, in column space, as sorted comparable strings. */
function triangles(a: MeshAttrs, dy = 0): string[] {
  const out: string[] = []
  for (let t = 0; t < a.indices.length; t += 3) {
    const corners: string[] = []
    for (let c = 0; c < 3; c++) {
      const v = a.indices[t + c]
      corners.push(`${a.positions[v * 3].toFixed(3)},`
        + `${(a.positions[v * 3 + 1] + dy).toFixed(3)},`
        + `${a.positions[v * 3 + 2].toFixed(3)}`)
    }
    out.push(corners.join(' | '))
  }
  return out.sort()
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

// ── 1. nothing to merge ─────────────────────────────────────────────────────────────────────────
{
  ok(concatAttrs([]) === null, 'an empty list merges to null, so the caller skips geometry and draw')
}

// ── 2. ★ A SINGLE SECTION STILL GETS ITS LIFT ───────────────────────────────────────────────────
// The tempting shortcut is to hand a one-element list straight back to save a copy. That is wrong
// unless dy is zero, and dy is zero for exactly one of a column's sixteen sections — so the bug
// would hide everywhere except the ground floor.
{
  const one = buildAttrs(quadAt(0, 0, 0, MAT.STONE))
  const merged = concatAttrs([{ attrs: one, dy: 48 }])!
  ok(merged.positions[1] === 48, '★ a lone section is still lifted to its own altitude')
  ok(merged !== one, 'and the input is not handed back aliased')
  ok(one.positions[1] === 0, '★ nor mutated — the caller may still be holding it')
}

// ── 3. ★ THE CENTRAL PROPERTY: merged triangles == union of section triangles ────────────────────
{
  const parts: AttrPart[] = []
  const expected: string[] = []
  // Four sections at real column altitudes, each with a distinguishable quad position inside it.
  for (const [i, dy] of [0, 16, 32, 96].entries()) {
    const attrs = buildAttrs(quadAt(i * 2, i * 3, i, MAT.STONE))
    parts.push({ attrs, dy })
    expected.push(...triangles(attrs, dy))
  }
  const merged = concatAttrs(parts)!
  const got = triangles(merged)

  ok(merged.quads === 4, 'quads are conserved across the merge')
  ok(merged.positions.length === 4 * 4 * 3, 'and so is the vertex count')
  ok(sameSet(got, expected.sort()),
    '★ the merged triangle set is exactly the union of the section triangle sets, in column space')

  // The index shift specifically: with it forgotten, every triangle would reference vertices 0-3
  // and the max index would be 3 rather than 15.
  ok(Math.max(...merged.indices) === 15, '★ indices are shifted, not repeated per section')

  // Normals ride along untouched — the offset is a translation, and translating a normal would
  // light the world from a direction that changes with altitude.
  ok([...merged.normals].every((n, j) => n === (j % 3 === 1 ? 1 : 0)), 'normals are not offset')
}

// ── 4. per-vertex channels stay in step with their vertex ───────────────────────────────────────
{
  // Two sections of different materials: the colour of vertex N of section 2 must land at the
  // colour of vertex N + 4 of the merge, not somewhere else.
  const a = buildAttrs(quadAt(0, 0, 0, MAT.STONE))
  const b = buildAttrs(quadAt(0, 0, 0, MAT.WATER))
  const merged = concatAttrs([{ attrs: a, dy: 0 }, { attrs: b, dy: 16 }])!
  let aligned = true
  for (let j = 0; j < 4; j++) {
    for (let c = 0; c < 3; c++) {
      if (merged.colors[j * 3 + c] !== a.colors[j * 3 + c]) aligned = false
      if (merged.colors[(4 + j) * 3 + c] !== b.colors[j * 3 + c]) aligned = false
    }
    if (merged.emissive[j] !== a.emissive[j]) aligned = false
    if (merged.emissive[4 + j] !== b.emissive[j]) aligned = false
    if (merged.layers[j] !== a.layers[j]) aligned = false
    if (merged.layers[4 + j] !== b.layers[j]) aligned = false
  }
  ok(aligned, '★ colour, emissive and texture layer all stay with their own vertex')
}

// ── 5. UV — the leaf pass carries it, and a mixed list must not smear ───────────────────────────
{
  const leafA = buildAttrs(quadAt(0, 0, 0, MAT.STONE), true)
  const leafB = buildAttrs(quadAt(0, 0, 0, MAT.STONE), true)
  const withUV = concatAttrs([{ attrs: leafA, dy: 0 }, { attrs: leafB, dy: 16 }])!
  ok(withUV.uv?.length === 16, 'a leaf merge carries UVs for every vertex')
  ok([...withUV.uv!].every((v, j) => v === leafA.uv![j % 8]), 'and they are the per-corner pattern')

  const plain = concatAttrs([{ attrs: buildAttrs(quadAt(0, 0, 0, MAT.STONE)), dy: 0 }])!
  ok(plain.uv === undefined, 'a solid merge allocates no UV buffer at all')

  // The mixed case cannot arise from the current caller, which is exactly why it needs an assert:
  // if a future pass ever mixes, the failure must not be a section pinned to one texel.
  const mixed = concatAttrs([
    { attrs: buildAttrs(quadAt(0, 0, 0, MAT.STONE), true), dy: 0 },
    { attrs: buildAttrs(quadAt(0, 0, 0, MAT.STONE)), dy: 16 },
  ])!
  const tail = [...mixed.uv!.slice(8)]
  ok(tail.some(v => v !== 0), '★ a part with no UVs derives its corners rather than zero-filling')
  ok(sameSet([...new Set(tail.map(String))].sort(), ['0', '1']), 'and they are real corner UVs')
}

// ── 6. ★ THE REAL THING: a generated column, meshed, split and merged ───────────────────────────
// The unit checks above all assume section positions are section-LOCAL. That assumption is the
// whole basis for the Y lift, and it belongs to `meshColumn`, not to this file — so it gets checked
// against a real column rather than trusted.
{
  const col = makeColumn(0, 0, 4242)
  const sections = meshColumn(col)
  ok(sections.length > 1, 'a generated column meshes into several sections (fixture sanity)')

  const solids: AttrPart[] = [], waters: AttrPart[] = [], leaves: AttrPart[] = []
  const expect = { s: [] as string[], w: [] as string[], l: [] as string[] }
  let localOnly = true
  for (const sm of sections) {
    // Section-local, not world: every position must sit inside one section's own box.
    for (const p of sm.mesh.positions.slice(0, sm.mesh.quads * 12)) {
      if (p < -1 || p > SECTION + 1) localOnly = false
    }
    const split = buildAttrsSplit(sm.mesh, m => m === MAT.WATER, isLeafMat)
    if (split.solid) { solids.push({ attrs: split.solid, dy: sm.wy }); expect.s.push(...triangles(split.solid, sm.wy)) }
    if (split.water) { waters.push({ attrs: split.water, dy: sm.wy }); expect.w.push(...triangles(split.water, sm.wy)) }
    if (split.leaves) { leaves.push({ attrs: split.leaves, dy: sm.wy }); expect.l.push(...triangles(split.leaves, sm.wy)) }
  }
  ok(localOnly, '★ the mesher really does emit section-local positions — the premise of the lift')

  const mergedSolid = concatAttrs(solids)!
  ok(sameSet(triangles(mergedSolid), expect.s.sort()),
    '★ a real column\'s merged solid pass is triangle-for-triangle the sections it came from')
  ok(sections.length > solids.length || solids.length > 1,
    'and it collapsed more than one section into that single pass')

  if (waters.length) {
    ok(sameSet(triangles(concatAttrs(waters)!), expect.w.sort()), 'water merges the same way')
  } else pass++   // a dry column is a legitimate fixture, not a failure
  if (leaves.length) {
    ok(sameSet(triangles(concatAttrs(leaves)!), expect.l.sort()), 'so do leaves')
  } else pass++

  // ★ THE COUNT THAT IS THE POINT OF THE WHOLE CHANGE.
  const before = sections.reduce((n, sm) => {
    const s = buildAttrsSplit(sm.mesh, m => m === MAT.WATER, isLeafMat)
    return n + (s.solid ? 1 : 0) + (s.water ? 1 : 0) + (s.leaves ? 1 : 0)
  }, 0)
  const after = (solids.length ? 1 : 0) + (waters.length ? 1 : 0) + (leaves.length ? 1 : 0)
  ok(after <= 3, '★ a column costs at most three draws — one per pass')
  ok(after < before, `★ and fewer than it did per-section (${before} → ${after})`)
  console.log(`  column draw calls: ${before} → ${after}`)
}

console.log(`\n${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
