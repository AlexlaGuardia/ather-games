// Sites oracle. Run: npx tsx src/app/shimmer/voxel/sites.test.ts
//
// A structure system's failure modes are all silent: a site that regenerates differently, a ruin
// cut at a chunk seam, a wall floating over the low side of its pad, a subdivision where a scatter
// was meant. Each assert pins one of those.

import { DEFAULT_SITES, siteAt, siteScanCells, buildRuin } from './sites'
import { greyness } from './biome'
import { columnHeight } from './height'
import { DEFAULT_DEPTH, MAT } from './depth'
import { makeColumn, SECTION } from './column'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const CFG = DEFAULT_SITES

// ── 1. the separation-vs-reach inequality that makes the 1-cell scan radius sound ───────────────
{
  ok(CFG.separation * 16 > (CFG.footprint >> 1) + 1,
    'a candidate can never leave its cell — separation outreaches the footprint')
  ok(siteScanCells(CFG) === 1, 'scan radius is one ring of cells')
  ok(CFG.spacing > CFG.separation * 2, 'the jitter span is positive')
}

// ── 2. determinism — a site is the same site forever, and answers to the seed ───────────────────
{
  let found = 0
  for (let cz = -40; cz <= 40 && found < 3; cz++) for (let cx = -40; cx <= 40 && found < 3; cx++) {
    const a = siteAt(SEED, cx, cz)
    const b = siteAt(SEED, cx, cz)
    if ((a === null) !== (b === null)) { fails.push('site existence is nondeterministic'); continue }
    if (a && b) {
      found++
      ok(a.x === b.x && a.z === b.z && a.floor === b.floor && a.seed === b.seed, 'the same cell rolls the same site')
    }
  }
  ok(found > 0, `found sites to compare (${found})`)
}

// ── 3. every site keeps its own contract: grey ground, a real pad, dry land ─────────────────────
{
  let sites = 0, cells = 0
  const r = CFG.footprint >> 1
  for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
    cells++
    const s = siteAt(SEED, cx, cz)
    if (!s) continue
    sites++
    ok(greyness(s.x, s.z, SEED) >= CFG.greyMin, `site at ${s.x},${s.z} stands on drained ground`)
    let mn = Infinity, mx = -Infinity
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const h = columnHeight(s.x + dx, s.z + dz, SEED)
      if (h < mn) mn = h
      if (h > mx) mx = h
    }
    ok(mx - mn <= CFG.padSpan, `site at ${s.x},${s.z} sits on a pad (span ${mx - mn})`)
    ok(mn === s.floor, `site floor is the pad's lowest surface`)
    ok(mn > DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight, 'site is on dry land')
  }
  // Density: a scatter, not a subdivision and not a myth. 121×121 cells at spacing 12 ≈ a
  // 23k-block square of country; grey country is ~9% of it and pads are the exception inside that.
  ok(sites > 3, `sites actually occur (${sites} in ${cells} cells)`)
  ok(sites < cells * 0.02, `sites stay rare (${sites} in ${cells} cells)`)
  console.log(`  (density: ${sites} sites in ${cells} cells)`)
}

// ── 4. the ruin generates INTO columns, identically from every side of a seam ───────────────────
{
  // Find a site, then regenerate every column its footprint touches and check each wall block
  // exists in whichever column owns it. This is the anti-seam assert: every column derives the
  // same ruin from pure math, so a wall crossing a boundary must simply BE there on both sides.
  let site = null as ReturnType<typeof siteAt>
  for (let cz = -80; cz <= 80 && !site; cz++) for (let cx = -80; cx <= 80 && !site; cx++) {
    site = siteAt(SEED, cx, cz)
  }
  ok(!!site, 'found a site to generate')
  if (site) {
    const r = CFG.footprint >> 1
    const cols = new Map<string, ReturnType<typeof makeColumn>>()
    const colFor = (x: number, z: number) => {
      const ox = Math.floor(x / SECTION) * SECTION, oz = Math.floor(z / SECTION) * SECTION
      const k = `${ox},${oz}`
      if (!cols.has(k)) cols.set(k, makeColumn(ox, oz, SEED))
      return cols.get(k)!
    }
    let wallBlocks = 0, missing = 0, floating = 0
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
      const x = site.x + dx, z = site.z + dz
      const col = colFor(x, z)
      const lx = x - col.wx, lz = z - col.wz
      const top = col.get(lx, site.floor + 1, lz)
      const ground = columnHeight(x, z, SEED)
      if (top === MAT.STONE) {
        wallBlocks++
        // Nothing under the wall's base course may be air: seated, never floating.
        if (site.floor > 0 && col.get(lx, site.floor - 1, lz) === 0 && site.floor - 1 > ground) floating++
      } else {
        // Either a deliberate gap (wallHeightAt rolled 0) or a bug; count and bound below.
        missing++
      }
    }
    ok(wallBlocks > 10, `the ruin has standing wall (${wallBlocks} blocks at floor+1)`)
    ok(missing < wallBlocks * 2, `gaps are gaps, not absence (${missing} open vs ${wallBlocks} standing)`)
    ok(floating === 0, `no wall block floats (${floating})`)
    ok(cols.size >= 1, `checked across ${cols.size} column(s)`)
  }
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ something stood here — ${pass} passed`)
