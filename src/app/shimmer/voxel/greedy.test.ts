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

// ── 9. the uniform fast path must be EQUIVALENT, not merely fast ────────────────────────────
// A uniform section skips every interior plane on the proof that they carry no faces. That proof
// holds — but only the boundary planes are still swept, so a bug here shows up as a MISSING WALL
// on one side of a solid region, which is the hardest kind of hole to notice by eye. Test it
// against mixed neighbours, where some sides are exposed and others are not.
{
  const S = 16
  const sec = solid(S, () => true)   // uniform: takes the fast path
  // Solid only on -x and +y; every other side is open. Expect exactly the 4 open faces.
  const mixed = (x: number, y: number, _z: number) => (x < 0 ? 1 : y >= S ? 1 : AIR)
  const r = greedyMesh(sec, mixed)
  // ★ THIS ASSERTION USED TO COUNT QUADS AND NOW COUNTS SIDES (2026-08-12, when AO landed).
  // The property it was written to defend is "no missing wall", and quad count was only ever a
  // proxy for it — a proxy that stopped being valid the moment corner AO could legitimately split
  // one wall into several rectangles. Counting DISTINCT FACE DIRECTIONS tests the actual property
  // and is immune to how finely the mesher chooses to subdivide.
  const sides = new Set<string>()
  for (let i = 0; i < r.quads; i++)
    sides.add(`${r.normals[i * 12]},${r.normals[i * 12 + 1]},${r.normals[i * 12 + 2]}`)
  eq(sides.size, 4, 'uniform section with 2 of 6 sides occluded emits exactly 4 distinct walls')
  // And the granularity is still pinned, because a merge regression that shattered every face into
  // single cells would pass the check above. Each of the 4 open walls borders BOTH occluders, so
  // each splits into 3 shading regions: a strip along -x, a strip along +y, and the bright field.
  eq(r.quads, 12, 'each open wall splits into exactly 3 AO regions (4 walls x 3)')

  // And the faces it does emit must be on the right sides: no quad may lie on an occluded plane.
  let wrong = 0
  for (let i = 0; i < r.quads; i++) {
    const nx = r.normals[i * 12], ny = r.normals[i * 12 + 1]
    if (nx === -1) wrong++          // -x is occluded
    if (ny === 1) wrong++           // +y is occluded
  }
  eq(wrong, 0, 'no quad faces an occluded side')

  // Per-axis: a uniform section occluded on ONE side of an axis still emits the opposite side.
  const oneSide = greedyMesh(sec, (x) => (x < 0 ? 1 : AIR))
  const oneSides = new Set<string>()
  for (let i = 0; i < oneSide.quads; i++)
    oneSides.add(`${oneSide.normals[i * 12]},${oneSide.normals[i * 12 + 1]},${oneSide.normals[i * 12 + 2]}`)
  eq(oneSides.size, 5, 'occluding a single side leaves the other five walls')
  // 4 walls border the single occluder and split in two; the wall OPPOSITE it touches nothing and
  // stays one quad. 4x2 + 1 = 9. That the opposite wall does not split is the useful half of this
  // number: it proves AO is reading the occluder's actual position, not darkening indiscriminately.
  eq(oneSide.quads, 9, 'four bordering walls split in two, the opposite wall stays whole')
}

// ── 10. AMBIENT OCCLUSION (2026-08-12) ───────────────────────────────────────────────────────
// AO is the class of thing that looks plausible while being wrong: mirrored on back faces, applied
// to the wrong side of a wall, or quietly all-3 because a buffer never got written. Each of those
// ships as "the lighting looks a bit off" and nobody can say why. So assert the values.
{
  // A lone cube in open air is occluded by nothing. Every corner of every face must be full bright,
  // and this is also the guard against the whole feature silently degrading to zeros.
  const s = new Section(8)
  s.set(4, 4, 4, 1)
  const r = greedyMesh(s)
  eq(r.quads, 6, 'lone cube emits its 6 faces')
  eq(r.ao.length, r.quads * 4, 'one AO value per vertex')
  let dim = 0
  for (let i = 0; i < r.ao.length; i++) if (r.ao[i] !== 3) dim++
  eq(dim, 0, 'a cube alone in the air has no occluded corner')
}
{
  // Two cubes side by side along x. On the +y (top) face of each, the two corners over the shared
  // edge sit against a solid neighbour and must darken; the two outer corners must not.
  const s = new Section(8)
  s.set(4, 4, 4, 1)
  s.set(5, 4, 4, 1)
  const r = greedyMesh(s)
  let tops = 0, darkened = 0, bright = 0
  for (let q = 0; q < r.quads; q++) {
    if (r.normals[q * 12 + 1] !== 1) continue      // top faces only
    tops++
    for (let k = 0; k < 4; k++) (r.ao[q * 4 + k] < 3 ? () => darkened++ : () => bright++)()
  }
  ok(tops >= 1, 'the pair has a top face')
  eq(darkened, 0, 'a flat 1-high pair has nothing above it to occlude its top')
  ok(bright > 0, 'top corners are lit')

  // The vertical faces are where the neighbour shows up: the +z wall of the pair runs past both
  // cubes, and nothing occludes it either (still 1 high, nothing beside it in z).
  let sideDark = 0
  for (let q = 0; q < r.quads; q++) {
    if (r.normals[q * 12 + 2] !== 1) continue
    for (let k = 0; k < 4; k++) if (r.ao[q * 4 + k] < 3) sideDark++
  }
  eq(sideDark, 0, 'an isolated 2x1 wall has no occluders on its open side')
}
{
  // An inside corner: a floor with a wall rising out of it. The floor's top face, where it meets
  // the wall, must darken — this is the case AO exists for, and the one a player sees constantly.
  const S = 8
  const s = new Section(S)
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) s.set(x, 0, z, 1)   // floor at y=0
  for (let z = 0; z < S; z++) s.set(0, 1, z, 1)                                // wall at x=0, y=1
  const r = greedyMesh(s)
  let floorDark = 0, floorBright = 0
  for (let q = 0; q < r.quads; q++) {
    if (r.normals[q * 12 + 1] !== 1) continue
    // Only the floor's own top plane (y = 1), not the wall's top.
    if (r.positions[q * 12 + 1] !== 1) continue
    for (let k = 0; k < 4; k++) (r.ao[q * 4 + k] < 3 ? () => floorDark++ : () => floorBright++)()
  }
  ok(floorDark > 0, 'the floor darkens where a wall stands on it')
  ok(floorBright > 0, 'the floor away from the wall stays lit')

  // ★ AND THE SPLIT IS LOCAL. If AO were darkening the whole plane rather than the strip beside the
  // wall, floorDark would be everything and this would catch it — the failure mode where the world
  // just gets uniformly muddier and reads as a bad colour choice rather than a bug.
  ok(floorBright >= floorDark, 'most of an open floor is not in shadow')
}
{
  // Triangulation: whichever diagonal the flip picks, a quad's 6 indices must still describe two
  // triangles over exactly its own four vertices. A flip that dropped or repeated a corner would
  // render a torn face, and the tear only appears on asymmetrically-shaded quads.
  const S = 8
  const s = new Section(S)
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) s.set(x, 0, z, 1)
  s.set(3, 1, 3, 1)                     // a lone pillar: guarantees asymmetric corners nearby
  const r = greedyMesh(s)
  let bad = 0
  for (let q = 0; q < r.quads; q++) {
    const base = q * 4
    const used = new Set<number>()
    for (let i = 0; i < 6; i++) {
      const v = r.indices[q * 6 + i]
      if (v < base || v > base + 3) bad++
      used.add(v)
    }
    if (used.size !== 4) bad++          // both triangles together must touch all four corners
  }
  eq(bad, 0, 'every quad triangulates over its own four vertices, flipped or not')
}

{
  // ── ★ THE BACK FACE MUST NOT MIRROR ITS SHADING (added because the oracle MISSED it) ──────────
  // Front and back quads wind their corners in different orders, so the AO has to be reordered with
  // them. Writing the canonical order onto both mirrors every back face. Every test above passed
  // with that bug present — the counts, the splits and the inside corner are all symmetric enough
  // not to notice — which is exactly the shape of a defect that ships. Caught by mutating the line
  // and finding the suite still green.
  //
  // Setup: one cube, and one occluder touching only its +x side, one step toward -z. Nothing else
  // in the section, so every AO value has a hand-computable answer.
  const s = new Section(8)
  s.set(4, 4, 4, 1)      // the cube under test, spanning x,y,z in [4,5]
  s.set(5, 4, 3, 1)      // occluder: +x of the cube, and on the OPEN side of its -z face
  const r = greedyMesh(s)

  // Its -z face sits at z = 4 and is a BACK face. The occluder is at x+1, so the two corners on the
  // x = 5 edge darken and the two on x = 4 stay lit. Mirror the order and the darkening lands on
  // x = 4 instead — same values, same count, wrong side. Only position tells them apart.
  let checked = 0, misplaced = 0
  for (let q = 0; q < r.quads; q++) {
    if (r.normals[q * 12 + 2] !== -1) continue        // -z faces
    if (r.positions[q * 12 + 2] !== 4) continue       // ...belonging to the cube, not the occluder
    for (let k = 0; k < 4; k++) {
      const vx = r.positions[q * 12 + k * 3]
      const lit = r.ao[q * 4 + k] === 3
      checked++
      // x = 5 must be occluded, x = 4 must be lit.
      if ((vx === 5) === lit) misplaced++
    }
  }
  eq(checked, 4, 'found the cube -z face')
  eq(misplaced, 0, 'back-face AO lands on the corners nearest the occluder, not their mirror')
}

console.log(`\ngreedy mesher: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the mesher is sound')
