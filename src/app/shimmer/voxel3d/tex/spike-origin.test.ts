// Run: npx tsx src/app/shimmer/voxel3d/tex/spike-origin.test.ts
//
// ── ★★★ THE BENCH MUST HAVE SOMETHING ON IT ───────────────────────────────────────────────────
//
// `/shimmer/voxel3d/tex` built its 8x8 patch at world (0, 0) and rendered NOTHING: 64 columns
// generated, 0 meshes, 0 quads from 0 faces. The origin is the fold's HOLLOW — no ground at any
// altitude — so the page drew a blue screen and reported the emptiness as a statistic, in the same
// grey as the timings.
//
// ⚠⚠ IT COST A REAL ANSWER, WHICH IS WHY THIS FILE EXISTS. Alex was pointed at that page to judge
// the relief A/B and reported "it looks flat, the relief isnt doing much" — about a screen with no
// blocks on it. A dev page is LOOKED AT rather than asserted, so nothing was watching; and the same
// trap had already landed twice in this repo (a column oracle pinned at the origin, and the AO probe
// that returned 0 vertices there). Both of those were caught because a TEST noticed. This is that
// test for the page.
//
// ★ IT ASSERTS THE AFFORDANCE, NOT THE ADDRESS. Checking `ORIGIN_X !== 0` would pass for any of the
// other hollow spots — (256, 0) also meshes to zero. The question a bench asks is "is there enough
// world here to judge a texture on", so that is what is measured: geometry, and material variety.
import { makeColumn, meshColumn, SECTION } from '../../voxel/column'
import { createMeshScratch } from '../../voxel/greedy'
import { baseOf } from '../../voxel/depth'
import { SPIKE_ORIGIN_X, SPIKE_ORIGIN_Z, SPIKE_PATCH, SPIKE_SEED } from './spike-origin'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

/** The page's own pipeline, in the page's own shape. */
function patch(ox: number, oz: number) {
  const n = SPIKE_PATCH
  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++)
    cols.set(`${cx},${cz}`, makeColumn(ox + cx * SECTION, oz + cz * SECTION, SPIKE_SEED))
  const scratch = createMeshScratch(SECTION)
  let quads = 0, faces = 0, meshes = 0
  const mats = new Set<number>()
  for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) {
    for (const sm of meshColumn(cols.get(`${cx},${cz}`)!, {
      negX: cols.get(`${cx - 1},${cz}`) ?? null, posX: cols.get(`${cx + 1},${cz}`) ?? null,
      negZ: cols.get(`${cx},${cz - 1}`) ?? null, posZ: cols.get(`${cx},${cz + 1}`) ?? null,
    }, scratch)) {
      meshes++; quads += sm.mesh.quads; faces += sm.mesh.faces
      for (const m of sm.mesh.materials) mats.add(baseOf(m))
    }
  }
  return { meshes, quads, faces, materials: mats.size }
}

// ── 1. the shipped origin has a world on it ───────────────────────────────────────────────────
{
  const r = patch(SPIKE_ORIGIN_X, SPIKE_ORIGIN_Z)
  ok(r.quads > 0,
    `the spike origin (${SPIKE_ORIGIN_X}, ${SPIKE_ORIGIN_Z}) meshes to ZERO quads — the page renders a blue screen`)
  // Not merely non-zero: a patch clipping one corner of a hill would pass that and still be useless
  // to look at. Measured 90,828 quads / 426 meshes here; half of it is still a bench.
  ok(r.quads > 20000,
    `only ${r.quads} quads at the spike origin — too thin to judge a texture on (expected >20000)`)
  ok(r.meshes > 100, `only ${r.meshes} section meshes at the spike origin (expected >100)`)
  // ⚠ THE PROPERTY A TEXTURE BENCH ACTUALLY NEEDS. A patch of pure stone has plenty of quads and
  // tells you nothing about an atlas. Measured 23 distinct materials here, the most of anywhere
  // probed when this origin was chosen.
  ok(r.materials >= 10,
    `only ${r.materials} distinct materials at the spike origin — a texture bench needs variety (expected >=10)`)
}

// ── 2. ★ THE POSITIVE CONTROL, WHICH IS ALSO THE BUG ──────────────────────────────────────────
// If this ever stops meshing to zero, the fold's hollow has moved and the sentence in
// `spike-origin.ts` explaining why (0,0) is forbidden has silently stopped being true. Asserting the
// REASON, not just the remedy — a guard whose premise expires quietly is the thing this repo keeps
// paying for.
{
  const o = patch(0, 0)
  ok(o.quads === 0,
    `world origin now meshes to ${o.quads} quads — it is no longer the hollow, so the warning in ` +
    `spike-origin.ts about (0,0) is stale and this guard's premise needs re-checking`)
}

console.log(`\nspike origin: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the texture bench has a world on it')
