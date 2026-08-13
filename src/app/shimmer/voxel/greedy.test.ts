// Greedy mesher oracle. Run: npx tsx src/app/shimmer/voxel/greedy.test.ts
//
// A mesher is the class of thing whose bugs look like art: a dropped face is a hole you see through
// the world, a mis-wound quad is a wall invisible from one side. Both read as "the renderer is
// broken". So the properties get asserted arithmetically here, where a hole is a failed number
// rather than something to notice by eye later.

import { AIR, Section } from './section'
import { greedyMesh, TRUNK_WIDTH } from './greedy'
import { WOOD } from './trees'

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

// ── 11. THE LEAF PASS (2026-08-12) ───────────────────────────────────────────────────────────
// Leaves left the greedy sweep and come back as crossed quads. The failure that matters is not
// "the canopy looks wrong" — it is that a leaf silently stops being a BLOCK. Chopping, drops, the
// light BFS and collision all read the same voxels, and none of them go through this file; a change
// here that made leaves disappear from the world data would take the forestry economy with it.
{
  const S = 8
  const s = new Section(S)
  s.set(4, 4, 4, WOOD.GOLDWOOD_LEAVES)
  const r = greedyMesh(s)
  eq(r.quads, 2, 'a lone leaf emits two crossed quads, not six cube faces')

  // Both quads must stand upright and span the cell: a cross that collapsed to a plane, or one
  // drawn flat, reads as a floating card rather than foliage.
  let vertical = 0, spans = 0
  for (let q = 0; q < r.quads; q++) {
    if (r.normals[q * 12 + 1] === 0) vertical++
    let lo = Infinity, hi = -Infinity
    for (let k = 0; k < 4; k++) {
      const vy = r.positions[q * 12 + k * 3 + 1]
      lo = Math.min(lo, vy); hi = Math.max(hi, vy)
    }
    if (Math.abs(hi - lo - 1) < 1e-6) spans++
  }
  eq(vertical, 2, 'both leaf quads are upright')
  eq(spans, 2, 'and each spans the full height of its cell')

  // The two quads must not be coplanar, or the "cross" is one doubled surface.
  //
  // ⚠ COMPARE THE WHOLE NORMAL, NOT ITS X (fixed 2026-08-12). This asserted `|n0.x - n1.x| > 1e-6`,
  // which is a proxy that a correct cross can fail: two perpendicular quads share an x component
  // whenever the cross sits at 45°, which is precisely where the old fixed-yaw pass put every one
  // of them. It passed only because it was comparing -0.7071 against +0.7071 — a sign, not an
  // orientation. Now that yaw is hashed per cell it would have false-failed on 1 cell in 1024.
  const dot = r.normals[0] * r.normals[12] + r.normals[1] * r.normals[13] + r.normals[2] * r.normals[14]
  ok(Math.abs(dot) < 1e-6, 'the two quads face different ways — it is a cross, not a doubled plane')
  for (let q = 0; q < 2; q++) {
    const nx = r.normals[q * 12], ny = r.normals[q * 12 + 1], nz = r.normals[q * 12 + 2]
    ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-6, 'and each quad carries a UNIT normal')
  }
}
{
  // ★ THE CROSSES MUST DISAGREE WITH EACH OTHER, or the canopy is a lattice of the identical X on a
  // perfect grid and reads as a textured slab — half of why the trees looked like umbrellas. This
  // is the assertion that would catch someone "simplifying" the hash back to a constant yaw.
  const S = 16
  const s = new Section(S)
  for (let y = 2; y < 14; y++) for (let z = 2; z < 14; z++) for (let x = 2; x < 14; x++)
    s.set(x, y, z, WOOD.GOLDWOOD_LEAVES)
  const r = greedyMesh(s)
  const yaws = new Set<number>()
  for (let q = 0; q < r.quads; q++) yaws.add(Math.round(Math.atan2(r.normals[q * 12 + 2], r.normals[q * 12]) * 200))
  ok(yaws.size > 40, `★ leaf crosses vary in orientation (${yaws.size} distinct yaws), not one repeated X`)

  // ★ AND THE HASH IS WORLD-STABLE. Same cells, different section origin ⇒ a different arrangement;
  // if `origin` were ignored the identical 16-block pattern would tile across every section, which
  // is a bigger repeat than the one the jitter was added to break.
  const shifted = greedyMesh(s, undefined, undefined, null, [16, 0, 0])
  let moved = 0
  for (let i = 0; i < r.positions.length; i++) if (Math.abs(r.positions[i] - shifted.positions[i]) > 1e-6) moved++
  ok(moved > 0, '★ the leaf hash follows world position — sections do not all draw the same pattern')

  // ── ★ EVERY LEAF DRAWS, INTERIOR INCLUDED (2026-08-13) ────────────────────────────────────────
  // This assert used to demand the OPPOSITE — only the 12³ − 10³ shell — guarding a cull that
  // skipped any leaf walled in on all six sides. Alex: *"the foliage is too sparse so the trunk is
  // clearly visible through the leaves."* The cull's premise was that a neighbour hides you, and a
  // crossed cutout quad hides almost nothing: it is two vertical planes in a cube, roughly half
  // gap. So the cull was deleting a third of the Thicket's canopy — 9,796 of 29,393 voxels — and
  // all of it interior, which is precisely the depth the eye looks through the rim to find.
  //
  // The assert is inverted rather than deleted, because the number is still the thing worth
  // pinning: a canopy's quad count must be exactly 2 per leaf voxel, no cull, nothing merged.
  eq(r.quads, 12 * 12 * 12 * 2, '★ every leaf voxel draws — a cutout cross cannot hide the one behind it')

  // ★ AND THE ENCLOSURE COUNT IS WHAT MAKES THAT AFFORDABLE TO LOOK AT. It stopped being a cull and
  // is now purely depth shading: an interior leaf draws DARK (ao 1) and a rim leaf draws lit (ao 3),
  // so the fuller crown reads as a lit shell over a mass rather than as a solid green cube. If this
  // regresses to one flat tone, the canopy goes back to reading as geometry — the umbrella again.
  const shades = new Set<number>()
  for (let v = 0; v < r.quads * 4; v++) shades.add(r.ao[v])
  ok(shades.has(1) && shades.has(3), `★ interior leaves shade dark and rim leaves light (got ${[...shades].sort()})`)
}
{
  // ★ A LEAF NO LONGER HIDES WHAT IS BEHIND IT. Leaves read as AIR to the sweep, so a trunk beside
  // one must draw the bark the canopy used to bury. If this regresses, trees develop holes where
  // foliage touches wood — visible only from inside a canopy, which is where nobody screenshots.
  const S = 8
  const bare = new Section(S)
  bare.set(4, 4, 4, WOOD.GOLDWOOD_LOG)
  const clothed = new Section(S)
  clothed.set(4, 4, 4, WOOD.GOLDWOOD_LOG)
  clothed.set(5, 4, 4, WOOD.GOLDWOOD_LEAVES)
  const a = greedyMesh(bare), b = greedyMesh(clothed)
  let logA = 0, logB = 0
  for (let q = 0; q < a.quads; q++) if (a.materials[q * 4] === WOOD.GOLDWOOD_LOG) logA++
  for (let q = 0; q < b.quads; q++) if (b.materials[q * 4] === WOOD.GOLDWOOD_LOG) logB++
  eq(logB, logA, 'a leaf beside a log hides none of the log — it is see-through to the sweep')
}
{
  // Canopy depth: a buried leaf must shade darker than one on the rim, or the whole canopy reads
  // as one flat colour and the crossed quads have bought nothing.
  const S = 8
  const s = new Section(S)
  for (let y = 3; y <= 5; y++) for (let z = 3; z <= 5; z++) for (let x = 3; x <= 5; x++)
    s.set(x, y, z, WOOD.GOLDWOOD_LEAVES)
  const r = greedyMesh(s)
  let darkest = 3, brightest = 0
  for (let i = 0; i < r.ao.length; i++) { darkest = Math.min(darkest, r.ao[i]); brightest = Math.max(brightest, r.ao[i]) }
  eq(brightest, 3, 'the rim of a canopy is fully lit')
  ok(darkest < 3, 'and the middle of it is not')
}
{
  // ★ THE ONE THAT GUARDS THE ECONOMY. The mesher may say what it likes about leaves; the SECTION
  // must still hold them, or chopping, drops and persistence lose their subject. Cheap to assert,
  // and it is the assertion that would catch someone "cleaning up" by deleting leaf voxels.
  const S = 8
  const s = new Section(S)
  s.set(4, 4, 4, WOOD.GOLDWOOD_LEAVES)
  greedyMesh(s)
  eq(s.get(4, 4, 4), WOOD.GOLDWOOD_LEAVES, 'meshing does not consume the leaf — it is still a block')
}

// ── ★ THE TRUNK PASS — a log draws thinner than its cell ─────────────────────────────────────────
// Alex asked for a trunk 15% thinner. A voxel cannot be thinner, so the mesher draws it inset, and
// these are the two ways that goes wrong invisibly: a box that is the WRONG SIZE (nobody eyeballs
// 0.85 against 1.0 in a screenshot) and a face wound backwards (a wall you cannot see from outside,
// which reads as "the tree has a hole in it" from exactly one angle).
{
  const S = 16
  const s = new Section(S)
  s.set(8, 8, 8, WOOD.GOLDWOOD_LOG)
  const r = greedyMesh(s)
  eq(r.quads, 6, 'a lone log draws all six of its faces')

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (let v = 0; v < r.quads * 4; v++) {
    minX = Math.min(minX, r.positions[v * 3]);     maxX = Math.max(maxX, r.positions[v * 3])
    minY = Math.min(minY, r.positions[v * 3 + 1]); maxY = Math.max(maxY, r.positions[v * 3 + 1])
    minZ = Math.min(minZ, r.positions[v * 3 + 2]); maxZ = Math.max(maxZ, r.positions[v * 3 + 2])
  }
  ok(Math.abs((maxX - minX) - TRUNK_WIDTH) < 1e-6, `★ the trunk is TRUNK_WIDTH across in X (got ${(maxX - minX).toFixed(3)})`)
  ok(Math.abs((maxZ - minZ) - TRUNK_WIDTH) < 1e-6, `★ ... and in Z (got ${(maxZ - minZ).toFixed(3)})`)
  // ⚠ HEIGHT MUST STAY A FULL CELL. Shrinking it too would open a ring of gaps between every log of
  // a trunk — the same trap the leaf pass's vertical jitter carries a warning about.
  ok(Math.abs((maxY - minY) - 1) < 1e-6, '★ but a FULL cell tall — a shrunk height gaps every join')
  // The box is centred: it must not drift off its own cell, or a trunk leans away from its roots.
  ok(Math.abs((minX + maxX) / 2 - 8.5) < 1e-6, 'and centred on its cell in X')
  ok(Math.abs((minZ + maxZ) / 2 - 8.5) < 1e-6, 'and centred on its cell in Z')

  // ★ WINDING: the geometric normal of each quad must equal the normal it declares. A face wound
  // the other way is culled by the GPU and simply is not there, from outside only.
  let wound = 0
  for (let q = 0; q < r.quads; q++) {
    const p = q * 12
    const ux = r.positions[p + 3] - r.positions[p], uy = r.positions[p + 4] - r.positions[p + 1], uz = r.positions[p + 5] - r.positions[p + 2]
    const vx = r.positions[p + 9] - r.positions[p], vy = r.positions[p + 10] - r.positions[p + 1], vz = r.positions[p + 11] - r.positions[p + 2]
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    const len = Math.hypot(cx, cy, cz)
    const dot = (cx / len) * r.normals[p] + (cy / len) * r.normals[p + 1] + (cz / len) * r.normals[p + 2]
    if (dot > 0.999) wound++
  }
  eq(wound, 6, '★ every trunk face is wound to match the normal it declares')
}
{
  // ★ A TRUNK'S INTERIOR JOINS DO NOT DRAW. Three stacked logs are 3x4 sides plus one cap at each
  // end — 14, not 18. This is the assert that fails if someone "simplifies" the log-neighbour test
  // away, which would cost 4 quads per log of every trunk in the world and be invisible on screen.
  const S = 16
  const s = new Section(S)
  for (let y = 6; y <= 8; y++) s.set(8, y, 8, WOOD.SHIMMEROAK_LOG)
  const r = greedyMesh(s)
  eq(r.quads, 3 * 4 + 2, '★ a stacked trunk skips the faces between its own logs')
}
{
  // ★ AND THE GROUND UNDER A THIN TRUNK IS NOW VISIBLE. A log reads as AIR to the sweep (it is not
  // a unit cube any more), so soil beside one draws the face the full-width log used to bury —
  // which is exactly what you must see through the 15% that was taken away.
  const S = 16
  const s = new Section(S)
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) s.set(x, 6, z, 3)   // a floor
  const bare = greedyMesh(s).quads
  s.set(8, 7, 8, WOOD.GOLDWOOD_LOG)                                          // a trunk standing on it
  const withLog = greedyMesh(s).quads
  // Exactly the log's own six faces and not one more: because a log reads as AIR to the sweep, the
  // floor's top stays ONE merged rectangle running clean under the trunk. A full-size log would
  // have occluded the cell beneath it and punched a hole in that rectangle, splitting it into
  // several — so this number is also the assert that the trunk is genuinely out of the sweep.
  eq(withLog, bare + 6, '★ a thin trunk leaves the ground under it whole, and visible')
}

console.log(`\ngreedy mesher: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the mesher is sound')
