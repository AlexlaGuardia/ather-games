// Water depth-attenuation oracle. Run: npx tsx src/app/shimmer/voxel/water-depth.test.ts
//
// ── ★★ WHAT THIS FILE EXISTS TO PROTECT (2026-08-21) ─────────────────────────────────────────
// Water shipped at one flat opacity, so a ford and a basin read identically. Depth attenuation
// fixes that, and it has exactly three ways to fail silently:
//
//  1. **The number never reaches the live path.** A day was lost on 2026-08-20 to precisely this:
//     the sloped-sheet seed was stamped inside `generateColumn`, the host rebuilds a fresh `Column`
//     from posted voxels, and the feature was inert on prod while every oracle stayed green —
//     because every oracle reached a column through the one door the game does not use. So the
//     cross-column case below meshes columns the way `VoxelWorld` does, not the way a fixture does.
//  2. **A corner disagrees with itself.** Two columns share a lattice corner; if they compute
//     different depths there, the shoreline gradient tears at every column boundary. Measured: with
//     the diagonal neighbours withheld the worst seam moves 0.081 in alpha, which is visible. That
//     mutation is asserted here, not just run once in a script.
//  3. **Absence reads as zero.** Depth 0 renders as nearly invisible water, so a missing depth
//     field would DELETE the rivers. The `-1` sentinel is what makes a missed hand-off degrade to
//     the previous flat look instead, and it has to survive every hop.

import { Column, generateColumn, meshColumn, refreshUniform, SECTION, DEFAULT_COLUMN } from './column'
import { greedyMesh, createMeshScratch } from './greedy'
import { Section } from './section'
import { MAT } from './depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number, m: string) =>
  ok(Math.abs(a - b) <= tol, `${m} (got ${a.toFixed(4)}, want ${b}±${tol})`)

const SEED = 1337
const AIR = 0
/** Mirrors `mesh-bridge.ts`. Duplicated on purpose: `voxel/` may not import render code, and the
 *  assert below pins the two together so a change to one fails here rather than drifting. */
const WATER_ABSORB = 0.505
const WATER_BASE_ALPHA = 0.78
const alpha = (d: number) => (d < 0 ? WATER_BASE_ALPHA : 1 - Math.exp(-WATER_ABSORB * d))

// ── 1. the curve is pinned to the MEDIAN depth, not to the deepest water ─────────────────────
// The measurement that set this: 141,331 real water-surface cells, 91.3% of them 3 blocks or less,
// median 3. A ramp spread over the 0..12 range the basins occupy would thin nine tenths of the
// world's water below what it replaced — a fix shipping as a regression everywhere it is seen.
{
  near(alpha(3), WATER_BASE_ALPHA, 0.01, 'median depth 3 keeps the opacity that shipped before this')
  ok(alpha(1) < 0.45, 'depth 1 is genuinely shallow — a waterline you can see through')
  ok(alpha(8) > 0.97, 'depth 8 is genuinely deep — you cannot see the bottom')
  ok(alpha(1) < alpha(2) && alpha(2) < alpha(3) && alpha(3) < alpha(8), 'monotone in depth')
  ok(alpha(1000) <= 1, 'saturates — no depth overshoots opaque, so no clamp is load-bearing')
  ok(alpha(-1) === WATER_BASE_ALPHA, 'the no-data sentinel keeps the flat opacity, NOT clear water')
}

// ── 2. depth is counted from CELLS, so a dug pool and a generated basin are the same question ──
{
  const col = new Column(0, 0, DEFAULT_COLUMN)
  // stone floor at y=0..9, water 10..13, air above => depth 4 everywhere in the column
  for (let y = 0; y <= 13; y++) {
    const sec = col.sections[(y / SECTION) | 0]
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      sec.set(x, y % SECTION, z, y <= 9 ? MAT.STONE : MAT.WATER)
  }
  // ⚠ NOT OPTIONAL-CHAINED. The first draft wrote `col.recomputeUniform?.()`, which is not a
  // method on Column — so it silently did nothing and the test passed anyway, because a fresh
  // column's uniform table is all -1 (mixed) and the per-cell path happens to be correct. A
  // green assert resting on a call that never ran is the fixture lying about what it set up.
  refreshUniform(col)
  const sections = meshColumn(col, {})
  let surfaceDepths: number[] = []
  for (const sm of sections) for (let v = 0; v < sm.mesh.materials.length; v++) {
    if (sm.mesh.materials[v] !== MAT.WATER) continue
    if (sm.mesh.normals[v * 3 + 1] < 0.5) continue          // top faces only
    surfaceDepths.push(sm.mesh.waterDepth[v])
  }
  ok(surfaceDepths.length > 0, 'a 4-deep pool emits a water surface at all')
  // Interior corners see four water cells of depth 4; the ring is dry, so edge corners average down.
  ok(Math.max(...surfaceDepths) === 4, `interior corners read the true depth 4 (got ${Math.max(...surfaceDepths)})`)
  ok(Math.min(...surfaceDepths) < 4, 'a corner touching dry land reads shallower — the shoreline gradient')
  ok(Math.min(...surfaceDepths) >= 0, 'depth never goes negative on real water')
}

// ── 3. THE SENTINEL: no depth field must mean "as before", never "invisible" ──────────────────
// This is the fail-soft direction, and it is the whole reason -1 exists rather than 0.
{
  const sec = new Section(SECTION)
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
    sec.set(x, 0, z, MAT.STONE)
    sec.set(x, 1, z, MAT.WATER)
  }
  // greedyMesh with NO WaterSurface at all — the fixture case, and any caller predating the field.
  const m = greedyMesh(sec, () => AIR, createMeshScratch(SECTION))
  let waterVerts = 0, sentinel = 0
  for (let v = 0; v < m.materials.length; v++) {
    if (m.materials[v] !== MAT.WATER) continue
    waterVerts++
    if (m.waterDepth[v] === -1) sentinel++
  }
  ok(waterVerts > 0, 'fixture: the no-surface mesh still emits water')
  ok(sentinel === waterVerts, `every water vertex carries the -1 sentinel (got ${sentinel}/${waterVerts})`)
  // ⚠ The mutation that matters: writing 0 here instead of -1 would render these rivers as glass.
  ok(alpha(-1) > alpha(0) + 0.7, 'and the sentinel is worth ~0.78 of alpha over reading it as depth 0')
}

// ── 4. non-water vertices carry 0, and the scratch does not leak another column's water ───────
{
  const sec = new Section(SECTION)
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) sec.set(x, 0, z, MAT.STONE)
  const scratch = createMeshScratch(SECTION)
  // Mesh water FIRST so the scratch holds real depths, then mesh dry rock through the same scratch.
  const wet = new Section(SECTION)
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) { wet.set(x, 0, z, MAT.STONE); wet.set(x, 1, z, MAT.WATER) }
  greedyMesh(wet, () => AIR, scratch)
  const dry = greedyMesh(sec, () => AIR, scratch)
  let dirty = 0
  for (let v = 0; v < dry.materials.length; v++) if (dry.waterDepth[v] !== 0) dirty++
  ok(dirty === 0, `a dry section reads 0 on every vertex — no leak from the reused scratch (got ${dirty} dirty)`)
}

// ── 5. ★★ THE LOAD-BEARING ONE: a shared corner is a pure function of WORLD POSITION ──────────
// Meshed the way `VoxelWorld` meshes — full 8-neighbourhood, real generated terrain in a basin —
// because the failure this guards against is precisely "green through a door the game never opens".
{
  const OX = 100, OZ = -150, R = 3
  const cols = new Map<string, Column>()
  const key = (cx: number, cz: number) => `${cx},${cz}`
  for (let cz = -R - 1; cz <= R + 1; cz++) for (let cx = -R - 1; cx <= R + 1; cx++)
    cols.set(key(cx, cz), generateColumn(new Column((OX + cx) * SECTION, (OZ + cz) * SECTION), SEED))

  const collect = (withDiagonals: boolean) => {
    const seen = new Map<string, number[]>()
    for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
      const n = (dx: number, dz: number) => cols.get(key(cx + dx, cz + dz)) ?? null
      const sections = meshColumn(cols.get(key(cx, cz))!, {
        negX: n(-1, 0), posX: n(1, 0), negZ: n(0, -1), posZ: n(0, 1),
        ...(withDiagonals
          ? { negXnegZ: n(-1, -1), posXnegZ: n(1, -1), negXposZ: n(-1, 1), posXposZ: n(1, 1) }
          : {}),
      })
      for (const sm of sections) for (let v = 0; v < sm.mesh.materials.length; v++) {
        if (sm.mesh.materials[v] !== MAT.WATER) continue
        const k = `${sm.wx + sm.mesh.positions[v * 3]},${sm.wy + sm.mesh.positions[v * 3 + 1]},${sm.wz + sm.mesh.positions[v * 3 + 2]}`
        const arr = seen.get(k) ?? []
        arr.push(sm.mesh.waterDepth[v])
        seen.set(k, arr)
      }
    }
    let shared = 0, worst = 0
    const distinct = new Set<string>()
    for (const [, ds] of seen) {
      if (ds.length < 2) continue
      shared++
      for (const d of ds) distinct.add(d.toFixed(2))
      worst = Math.max(worst, Math.max(...ds.map(alpha)) - Math.min(...ds.map(alpha)))
    }
    return { shared, worst, variety: distinct.size }
  }

  const withDiag = collect(true)
  // ⚠ A CONTROL HAS TO BE VERIFIED, NOT NAMED. Zero disagreement is trivially true over zero shared
  // points, and it is also trivially true if every shared corner happens to hold the same number.
  // Both are asserted before the agreement claim is allowed to mean anything.
  ok(withDiag.shared > 50, `the fixture actually straddles seams (${withDiag.shared} shared points)`)
  ok(withDiag.variety > 10, `and the depths there genuinely vary (${withDiag.variety} distinct values)`)
  near(withDiag.worst, 0, 1e-9, 'two columns sharing a corner compute the IDENTICAL depth')

  // The mutation, run for real rather than reasoned about: withhold the diagonal columns and the
  // corner rule stops being position-pure. If this does NOT go red, the assert above is decoration.
  const noDiag = collect(false)
  ok(noDiag.worst > 0.01,
    `withholding the diagonals visibly tears the seam (${noDiag.worst.toFixed(4)} alpha) — so the assert above has teeth`)
}

// ── 6. ★★★ THE SHEET DOES NOT MERGE, WHICH IS WHAT MAKES §5 MEAN ANYTHING ────────────────────
// §5 proves two columns agree at a shared CORNER. That is C0 continuity and it is NOT enough: a
// merged quad's EDGE runs past the corners of the smaller quads beside it, and along that edge the
// long quad interpolates between corners up to 16 cells apart while its neighbour reads the true
// value at its own corner. Measured before this assert existed: 399 such T-junctions in 25 columns,
// worst 0.806 blocks = **0.229 of alpha**, which draws as a quilt of flat rectangles with straight
// edges exactly on the merge boundaries. Every corner check in this file passed the whole time.
//
// The fix is structural rather than careful: every sheet quad is 1x1, so every edge has length 1
// and there is no interior point for anyone to disagree about. This asserts that property directly,
// because it is cheaper to check than the artifact and it cannot be satisfied accidentally.
{
  const OX = 9, OZ = -30, R = 1
  const cols = new Map<string, Column>()
  const key = (cx: number, cz: number) => `${cx},${cz}`
  for (let cz = -R - 1; cz <= R + 1; cz++) for (let cx = -R - 1; cx <= R + 1; cx++)
    cols.set(key(cx, cz), generateColumn(new Column((OX + cx) * SECTION, (OZ + cz) * SECTION), SEED))

  let sheetQuads = 0, merged = 0, longest = 0
  for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
    const n = (dx: number, dz: number) => cols.get(key(cx + dx, cz + dz)) ?? null
    for (const sm of meshColumn(cols.get(key(cx, cz))!, {
      negX: n(-1, 0), posX: n(1, 0), negZ: n(0, -1), posZ: n(0, 1),
      negXnegZ: n(-1, -1), posXnegZ: n(1, -1), negXposZ: n(-1, 1), posXposZ: n(1, 1),
    })) {
      const m = sm.mesh
      for (let q = 0; q < m.quads; q++) {
        if (m.materials[q * 4] !== MAT.WATER || m.normals[q * 12 + 1] < 0.5) continue
        sheetQuads++
        const xs = [0, 1, 2, 3].map(k => m.positions[q * 12 + k * 3])
        const zs = [0, 1, 2, 3].map(k => m.positions[q * 12 + k * 3 + 2])
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs)
        longest = Math.max(longest, w, h)
        if (w > 1 || h > 1) merged++
      }
    }
  }
  // ⚠ The fixture has to CONTAIN sheet, or "nothing merged" is true of nothing at all — the same
  // empty-sample trap that made a seam probe print a green tick over zero water vertices.
  ok(sheetQuads > 100, `the fixture actually holds a water sheet (${sheetQuads} surface quads)`)
  ok(merged === 0, `no sheet quad spans more than one cell (${merged} merged, longest run ${longest})`)
}

console.log(`\nwater depth: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ❌ ${f}`)
console.log(fails.length === 0 ? '✅ depth attenuation is sound' : '')
if (fails.length) process.exit(1)
