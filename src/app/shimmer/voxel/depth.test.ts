// Depth-rule oracle. Run: npx tsx src/app/shimmer/voxel/depth.test.ts
//
// The depth rule decides what every voxel under the sky is made of. Its failures are quiet: a
// missing cloud floor is a hole you fall out of the world through, an inverted layer order puts
// stone above soil and reads as "the textures are wrong", and stray air below the surface looks
// exactly like a cave the carvers did not generate. All three are cheap to assert and expensive
// to notice.

import { columnHeight, riverCarve, waterSurfaceAt, poolDepthAt, DEFAULT_HEIGHT } from './height'
import { roadAt } from './story-path'
import { holdIndexAt } from './holds'
import { materialAt, fillColumn, slopeAt, MAT, DEFAULT_DEPTH } from './depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const D = DEFAULT_DEPTH
const H = DEFAULT_HEIGHT
const at = (x: number, y: number, z: number) => materialAt(x, y, z, SEED, columnHeight(x, z, SEED))

// A spread of columns reused by several checks — deterministic, not random.
const COLS: [number, number][] = []
for (let i = 0; i < 600; i++) COLS.push([(i * 977) % 4000 - 2000, (i * 1583) % 4000 - 2000])

// ── 1. determinism ───────────────────────────────────────────────────────────────────────────
{
  let bad = 0
  for (const [x, z] of COLS.slice(0, 120)) for (const y of [1, 60, 130, 161, 200]) if (at(x, y, z) !== at(x, y, z)) bad++
  ok(bad === 0, 'materialAt is deterministic')
}

// ── 2. the floor of the world is solid ───────────────────────────────────────────────────────
// Not cosmetic: an air voxel at y=0 is a hole a player falls through forever.
{
  let bad = 0
  for (const [x, z] of COLS) if (at(x, 0, z) !== MAT.PACKED_CLOUD) bad++
  ok(bad === 0, `y=0 is always packed cloud (${bad} violations)`)
  let ragged = 0
  for (const [x, z] of COLS) if (at(x, 1, z) === MAT.PACKED_CLOUD) ragged++
  ok(ragged > 0 && ragged < COLS.length, 'the cloud floor is ragged, not a flat plane')
}

// ── 3. above the surface is sky, or water in a basin ─────────────────────────────────────────
{
  let bad = 0, wet = 0
  for (const [x, z] of COLS) {
    const h = columnHeight(x, z, SEED)
    for (const y of [h + 1, h + 4, h + 30]) {
      if (y >= H.worldHeight) continue
      const m = materialAt(x, y, z, SEED, h)
      // Bridges + holds (2026-08-08): the generator holds structure above the surface in exactly
      // two places — plank/stone in the road corridor (bridges), stone/lantern in a hold's bbox
      // (walls, keep, gate lights). Anything built above ground OUTSIDE those is still a bug.
      const bridge = (m === MAT.PLANKS || m === MAT.STONE) && roadAt(x, z, SEED)
      const hold = (m === MAT.STONE || m === MAT.MANA_LANTERN) && holdIndexAt(x, z) >= 0
      if (m !== MAT.AIR && m !== MAT.WATER && !bridge && !hold) bad++
      // Water above sea level is legal in exactly two places: a river channel or pond filled to
      // the water table (height.ts waterLevelAt — a body of water has ONE level), and a hot-spring
      // pool filled to one below its own terrace rim (height.ts poolDepthAt, 2026-08-08).
      if (m === MAT.WATER) {
        wet++
        const riverTop = riverCarve(x, z, SEED) >= 1 ? waterSurfaceAt(x, z, SEED) : -1
        const pd = poolDepthAt(x, z, SEED)
        const poolTop = pd >= 1 ? h + pd - 1 : -1
        if (y > D.seaLevel && y > riverTop && y > poolTop) bad++
      }
    }
  }
  ok(bad === 0, `above the surface is only air or water, and water stays under sea level or inside a river (${bad} violations)`)
  ok(wet > 0, 'some basins actually hold water')
}

// ── 4. the surface voxel is solid, and there is NO air below it ──────────────────────────────
// The depth rule must produce a completely solid column. Caves are carvers' job, and a stray air
// pocket here would be indistinguishable from one — which is how you ship a cave system nobody
// generated and cannot tune.
{
  let hollow = 0, softTop = 0
  for (const [x, z] of COLS.slice(0, 200)) {
    const h = columnHeight(x, z, SEED)
    if (materialAt(x, h, z, SEED, h) === MAT.AIR) softTop++
    for (let y = 0; y <= h; y++) if (materialAt(x, y, z, SEED, h) === MAT.AIR) { hollow++; break }
  }
  ok(softTop === 0, 'the surface voxel is never air')
  ok(hollow === 0, `no air anywhere below the surface — caves are the carvers' job (${hollow} columns)`)
}

// ── 5. layer ORDER — soil over stone over deep stone, never inverted ─────────────────────────
{
  let inverted = 0, checked = 0
  for (const [x, z] of COLS.slice(0, 300)) {
    const h = columnHeight(x, z, SEED)
    if (h <= D.seaLevel + D.beachHeight) continue          // beaches are sand all the way, skip
    let lastSoil = -1, firstStone = Infinity
    for (let y = h; y > h - 20 && y > 0; y--) {
      const m = materialAt(x, y, z, SEED, h)
      if (m === MAT.SUBSOIL || m === MAT.TOPSOIL) lastSoil = Math.max(lastSoil, h - y)
      if (m === MAT.STONE || m === MAT.DEEP_STONE) firstStone = Math.min(firstStone, h - y)
    }
    if (lastSoil >= 0 && firstStone < Infinity) { checked++; if (firstStone < lastSoil) inverted++ }
  }
  ok(checked > 50, 'the layer-order check actually sampled columns')
  ok(inverted === 0, `soil never appears below stone in the same column (${inverted} inversions)`)
}

// ── 6. deep stone is strictly deep ───────────────────────────────────────────────────────────
{
  let bad = 0
  for (const [x, z] of COLS) for (const y of [20, 80, 95, 100, 150]) {
    const m = at(x, y, z)
    if (m === MAT.DEEP_STONE && y >= D.deepStoneLevel) bad++
    if (m === MAT.STONE && y < D.deepStoneLevel && y > D.cloudFloorTop) bad++
  }
  ok(bad === 0, `the deep/shallow host split honours deepStoneLevel=${D.deepStoneLevel} (${bad} violations)`)
}

// ── 7. what the player walks on ──────────────────────────────────────────────────────────────
// Loose bounds — this is character, not correctness. It exists to catch a retune that turns the
// world to bare rock (an over-aggressive cliffSlope) or drowns it (a sea level above the datum).
{
  const surf: Record<number, number> = {}
  for (const [x, z] of COLS) { const h = columnHeight(x, z, SEED); const m = materialAt(x, h, z, SEED, h); surf[m] = (surf[m] || 0) + 1 }
  const n = COLS.length
  const soil = (surf[MAT.TOPSOIL] || 0) / n
  const sand = (surf[MAT.SAND] || 0) / n
  const rock = (surf[MAT.STONE] || 0) / n
  ok(soil > 0.6, `most of the world is walkable soil, not bare rock (${(soil * 100).toFixed(0)}%)`)
  ok(rock < 0.2, `bare rock is reserved for real cliffs (${(rock * 100).toFixed(0)}%)`)
  ok(sand > 0.02 && sand < 0.4, `coasts exist but the world is not a beach (${(sand * 100).toFixed(0)}%)`)
  ok((surf[MAT.AIR] || 0) === 0, 'no column has an air surface')
}

// ── 8. sea level must sit below the datum ────────────────────────────────────────────────────
// On the datum, half the world drowns by definition — the datum IS the median ground height.
{
  ok(D.seaLevel < H.datum, 'sea level is below the datum, or half the world is underwater by construction')
  let wet = 0
  for (const [x, z] of COLS) if (columnHeight(x, z, SEED) <= D.seaLevel) wet++
  const frac = wet / COLS.length
  // Lower bound eased again (1.5% → 1%) with worldgen v2: the tended zones flatten and lift big
  // tracts of the near-spawn sample window. Sea + rivers + ponds + the springs' coming pools are
  // the world's water; this bound only guards against a world with essentially none.
  // …and again (1% → 0.8%) 2026-08-08 with the wide river-approach band: levees now lift low
  // ground over the PROPER width, which shaved this near-spawn window to exactly the old floor.
  // Verified against five 400×400 windows before easing: 1.05 / 1.89 / 12.8 / 7.05 / 0.0% wet —
  // the world's water is regional and real; only this window rides the boundary.
  ok(frac > 0.008 && frac < 0.35, `water covers a plausible share of the world (${(frac * 100).toFixed(1)}%)`)
}

// ── 9. slope reads neighbouring COLUMNS, never neighbouring chunk state ──────────────────────
{
  ok(slopeAt(0, 0, SEED) >= 0, 'slope is non-negative')
  const a = slopeAt(500, 500, SEED)
  slopeAt(-9999, 9999, SEED)
  ok(slopeAt(500, 500, SEED) === a, 'slope is order-independent — it evaluates a pure function, not stored state')
}

// ── 10. fillColumn agrees with materialAt ────────────────────────────────────────────────────
// Two code paths that must never disagree: the per-voxel one used by tests and tools, and the
// bulk one the chunk builder will actually run.
{
  let bad = 0
  const out = new Uint16Array(64)
  for (const [x, z] of COLS.slice(0, 60)) {
    const h = columnHeight(x, z, SEED)
    fillColumn(out, 0, 1, x, z, 130, 194, SEED)
    for (let y = 130; y < 194; y++) if (out[y - 130] !== materialAt(x, y, z, SEED, h)) bad++
  }
  ok(bad === 0, `fillColumn matches materialAt voxel for voxel (${bad} mismatches)`)
}

console.log(`\ndepth rule: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the column is sound')
