// Rivers oracle. Run: npx tsx src/app/shimmer/voxel/rivers.test.ts
//
// A river is three claims: the channel is CARVED (the surface dips along the weirdness zero-line),
// the water FILLS to one below the banks (never over them, never a dry ditch at full depth), and
// the world's consumers respect it (sand bed, no trees standing in the water, wadeable collision
// is the walker's side). Each is checkable against the pure functions; the look is the map's job.

import { riverness, riverCarve, riverField, waterLevelAt, RIVER_FULL, RIVER_EDGE, RIVER_DEPTH, columnHeight } from './height'
import { materialAt, MAT, DEFAULT_DEPTH } from './depth'
import { makeColumn, SECTION } from './column'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

// ── 1. the band is a band ───────────────────────────────────────────────────────────────────────
{
  ok(riverness(0) === 1, 'mid-channel at the zero-line')
  ok(riverness(RIVER_EDGE) === 0 && riverness(-RIVER_EDGE) === 0, 'dry exactly at the edge')
  ok(riverness(RIVER_FULL) === 1, 'full channel through the whole inner band')
  ok(riverness(0.5) === 0 && riverness(-0.9) === 0, 'ridges are dry')
  let mono = true
  for (let i = 1; i < 60; i++) {
    if (riverness(RIVER_FULL + (i / 60) * (RIVER_EDGE - RIVER_FULL)) >
        riverness(RIVER_FULL + ((i - 1) / 60) * (RIVER_EDGE - RIVER_FULL))) mono = false
  }
  ok(mono, 'the bank profile fades monotonically')
}

// ── 2. carve and fill agree with the WATER TABLE, everywhere a river exists ─────────────────────
{
  let rivers = 0, wet = 0, dryDitch = 0, overTable = 0, sandBed = 0, bedChecked = 0, bars = 0
  for (let i = 0; i < 60000 && rivers < 400; i++) {
    const x = (i * 337) % 9000 - 4500, z = (i * 811) % 9000 - 4500
    const carve = riverCarve(x, z, SEED)
    if (carve < 2) continue
    rivers++
    const h = columnHeight(x, z, SEED)
    if (h <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight) continue   // sea swallows the river
    const table = waterLevelAt(x, z, SEED)
    if (table >= h + 1) {
      // Bed below the table: MUST hold water at the bed and MUST NOT above the table.
      if (materialAt(x, h + 1, z, SEED, h) === MAT.WATER) wet++
      else dryDitch++
      if (materialAt(x, table + 1, z, SEED, h) === MAT.WATER) overTable++
    } else {
      bars++    // a high spot inside the band — a sandbar, legal and wanted; bounded below
    }
    bedChecked++
    if (materialAt(x, h, z, SEED, h) === MAT.SAND) sandBed++
  }
  ok(rivers >= 400, `rivers occur (${rivers} carved columns found)`)
  ok(wet > 0 && dryDitch === 0, `every below-table channel holds water (${wet} wet, ${dryDitch} dry)`)
  ok(overTable === 0, `water never rises over the table (${overTable})`)
  ok(bedChecked > 0 && sandBed === bedChecked, `the bed is sand (${sandBed}/${bedChecked})`)
  ok(bars < bedChecked * 0.5, `sandbars are the exception, not the river (${bars}/${bedChecked})`)
}

// ── 2b. ★ PONDS ARE FLAT — the water table's whole claim ────────────────────────────────────────
{
  // Find wide full-channel pools and check the WATER SURFACE span across each: the old per-column
  // fill (banks − 1) undulated with the ground ("highs and lows in a pond"); the table may drift
  // at most ~a voxel across a pond's width.
  let pools = 0, flat = 0
  for (let i = 0; i < 60000 && pools < 25; i++) {
    const x = (i * 733) % 8000 - 4000, z = (i * 389) % 8000 - 4000
    if (riverCarve(x, z, SEED) < RIVER_DEPTH) continue
    // A pool: full carve across a 16-block square (skinny channel segments don't qualify).
    let wide = true
    for (const [dx, dz] of [[8, 0], [-8, 0], [0, 8], [0, -8]] as const)
      if (riverCarve(x + dx, z + dz, SEED) < RIVER_DEPTH) { wide = false; break }
    if (!wide) continue
    const h0 = columnHeight(x, z, SEED)
    if (h0 <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight) continue
    pools++
    let mn = Infinity, mx = -Infinity
    for (let dz = -8; dz <= 8; dz += 2) for (let dx = -8; dx <= 8; dx += 2) {
      const t = waterLevelAt(x + dx, z + dz, SEED)
      if (t < mn) mn = t
      if (t > mx) mx = t
    }
    if (mx - mn <= 1) flat++
  }
  ok(pools >= 10, `found pools to check (${pools})`)
  ok(flat === pools, `every pond surface is flat to within one voxel (${flat}/${pools})`)
}

// ── 3. the channel is genuinely lower than its banks ────────────────────────────────────────────
{
  // Walk transects: mid-channel must sit below the AVERAGE of its two opposite banks on the same
  // axis. One-sided comparison measured the terrain's own slope, not the river (a bench edge or
  // downhill drift 24 blocks out legitimately puts dry ground below mid-channel — first version
  // of this assert failed 40% on exactly that). Averaging opposite banks cancels linear slope, so
  // what is left is the dip the river itself carved.
  let checked = 0, sunk = 0
  for (let i = 0; i < 40000 && checked < 60; i++) {
    const x = (i * 613) % 8000 - 4000, z = (i * 227) % 8000 - 4000
    if (Math.abs(riverField(x, z, SEED)) > 0.003) continue    // dead centre only
    const h = columnHeight(x, z, SEED)
    if (h <= DEFAULT_DEPTH.seaLevel + 2) continue
    for (const axis of [[1, 0], [0, 1]] as const) {
      let plus: number | null = null, minus: number | null = null
      for (let d = 4; d <= 60 && (plus === null || minus === null); d++) {
        if (plus === null && riverCarve(x + axis[0] * d, z + axis[1] * d, SEED) === 0)
          plus = columnHeight(x + axis[0] * d, z + axis[1] * d, SEED)
        if (minus === null && riverCarve(x - axis[0] * d, z - axis[1] * d, SEED) === 0)
          minus = columnHeight(x - axis[0] * d, z - axis[1] * d, SEED)
      }
      if (plus !== null && minus !== null) {
        checked++
        if ((plus + minus) / 2 > h) sunk++
        break
      }
    }
  }
  ok(checked >= 30, `found transects to check (${checked})`)
  // 0.75, not higher, and honestly: measured 80% — the rest are bench edges and cliff country
  // where an 8-voxel terrain step drowns a 3-voxel channel. This is a CHARACTER bound (does the
  // river read sunk in ordinary country); water containment is §2's job and holds at zero.
  ok(sunk / Math.max(1, checked) > 0.75, `mid-channel sits below the mean of its banks (${sunk}/${checked})`)
}

// ── 4. no tree stands in the channel (generation-level, not just a rule on paper) ───────────────
{
  // Find a column containing full channel, generate it, and assert no log sits over water/sand
  // inside the carved band.
  let colChecked = 0, treesInWater = 0
  for (let i = 0; i < 30000 && colChecked < 6; i++) {
    const wx = Math.floor(((i * 991) % 6000 - 3000) / SECTION) * SECTION
    const wz = Math.floor(((i * 449) % 6000 - 3000) / SECTION) * SECTION
    if (riverCarve(wx + 8, wz + 8, SEED) < 2) continue
    const col = makeColumn(wx, wz, SEED)
    colChecked++
    for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
      if (riverCarve(wx + lx, wz + lz, SEED) < 1) continue
      const h = columnHeight(wx + lx, wz + lz, SEED)
      const above = col.get(lx, h + 1, lz)
      // logs are 32/34/36/38 — anything woody standing on the bed is a planted-in-river bug
      if (above >= 32 && above <= 39 && above % 2 === 0) treesInWater++
    }
  }
  ok(colChecked > 0, `generated river columns to inspect (${colChecked})`)
  ok(treesInWater === 0, `no trunk stands in a river channel (${treesInWater})`)
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 10)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the water lies in the valleys — ${pass} passed`)
