// Greedy mesher oracle. Run: npx tsx src/app/shimmer/voxel/greedy.test.ts
//
// A mesher is the class of thing whose bugs look like art: a dropped face is a hole you see through
// the world, a mis-wound quad is a wall invisible from one side. Both read as "the renderer is
// broken". So the properties get asserted arithmetically here, where a hole is a failed number
// rather than something to notice by eye later.

import { AIR, Section } from './section'
import { greedyMesh } from './greedy'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const eq = (a: number, b: number, msg: string) => ok(a === b, `${msg} (got ${a}, want ${b})`)

const solid = (S: number, fn: (x: number, y: number, z: number) => boolean) => {
  const s = new Section(S)
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (fn(x, y, z)) s.set(x, y, z, 1)
  return s
}

// ── 1. empty ────────────────────────────────────────────────────────────────────────────────
{
  const r = greedyMesh(new Section(16))
  eq(r.quads, 0, 'empty section emits no quads')
  eq(r.faces, 0, 'empty section has no visible faces')
}

// ── 2. fully solid => exactly 6 quads, and that IS the greedy win ───────────────────────────
// Every interior face is hidden; each outer face is one S*S rectangle. A naive mesher would emit
// 6*S*S here (6144 at S=32). If this ever returns more than 6 the merge step has regressed.
for (const S of [4, 16, 32]) {
  const r = greedyMesh(solid(S, () => true))
  eq(r.quads, 6, `solid ${S}^3 merges to 6 quads`)
  eq(r.faces, 6 * S * S, `solid ${S}^3 has 6*S*S visible faces before merging`)
}

// ── 3. a single voxel ───────────────────────────────────────────────────────────────────────
{
  const s = new Section(8)
  s.set(3, 3, 3, 1)
  const r = greedyMesh(s)
  eq(r.quads, 6, 'one voxel is a cube of 6 quads')
}

// ── 4. a one-thick floor: top, bottom, and four edge strips ─────────────────────────────────
{
  const S = 16
  const r = greedyMesh(solid(S, (_x, y) => y === 0))
  eq(r.quads, 6, 'a 1-thick floor is 6 quads (top, bottom, 4 edges)')
  eq(r.faces, 2 * S * S + 4 * S, 'floor visible-face count')
}

// ── 5. checkerboard is the worst case: nothing merges ───────────────────────────────────────
{
  const S = 16
  const r = greedyMesh(solid(S, (x, y, z) => (x + y + z) % 2 === 0))
  eq(r.quads, r.faces, 'checkerboard cannot merge — quads == faces')
  ok(r.quads > 0, 'checkerboard emits geometry')
}

// ── 6. invariants that must hold for ANY section ────────────────────────────────────────────
{
  let rng = 12345
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let t = 0; t < 12; t++) {
    const S = 16
    const s = new Section(S)
    for (let i = 0; i < s.data.length; i++) if (rand() < 0.4) s.data[i] = 1 + Math.floor(rand() * 3)
    const r = greedyMesh(s)
    ok(r.quads <= r.faces, `trial ${t}: merging never increases quad count`)
    eq(r.positions.length, r.quads * 12, `trial ${t}: 4 verts * xyz per quad`)
    eq(r.normals.length, r.quads * 12, `trial ${t}: normals match positions`)
    eq(r.materials.length, r.quads * 4, `trial ${t}: one material per vertex`)
    eq(r.indices.length, r.quads * 6, `trial ${t}: two triangles per quad`)
    let bad = 0
    for (let i = 0; i < r.materials.length; i++) if (r.materials[i] === AIR) bad++
    eq(bad, 0, `trial ${t}: no quad is made of air`)
    let oob = 0
    for (let i = 0; i < r.indices.length; i++) if (r.indices[i] >= r.quads * 4) oob++
    eq(oob, 0, `trial ${t}: every index is in range`)
  }
}

// ── 7. materials do not merge across each other ─────────────────────────────────────────────
// Two different materials sharing a plane must stay two quads, or ore silently wears stone's skin.
{
  const S = 8
  const s = new Section(S)
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) s.set(x, 0, z, x < S / 2 ? 1 : 2)
  const r = greedyMesh(s)
  ok(r.quads > 6, 'a two-material floor cannot merge into a one-material floor')
  const mats = new Set(Array.from(r.materials))
  ok(mats.has(1) && mats.has(2), 'both materials survive into the mesh')
}

// ── 8. neighbour sampling closes the seam ───────────────────────────────────────────────────
// A solid section whose neighbours are ALSO solid has no exposed faces at all. Getting this wrong
// is what draws a wall between every pair of chunks — invisible in a single-section test.
{
  const S = 16
  const r = greedyMesh(solid(S, () => true), () => 1)
  eq(r.quads, 0, 'a solid section inside solid neighbours emits nothing')
}

console.log(`\ngreedy mesher: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the mesher is sound')
