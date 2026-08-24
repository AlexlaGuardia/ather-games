// Sites oracle. Run: npx tsx src/app/shimmer/voxel/sites.test.ts
//
// A structure system's failure modes are all silent: a site that regenerates differently, a ruin
// cut at a chunk seam, a wall floating over the low side of its pad, a subdivision where a scatter
// was meant. Each assert pins one of those.

import { DEFAULT_SITES, siteAt, siteScanCells } from './sites'
import { ruinPlan } from './ruins'
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
  // Density: a scatter, not a subdivision and not a myth — asserted PER AREA, not per cell (a
  // per-cell bound silently retunes itself whenever `spacing` changes the denominator). The band
  // is wide because terrain retunes legitimately move pad share; the point is the ORDER of
  // magnitude: roughly one ruin per 1000² of country, never ten, never none.
  const per1k = sites / ((Math.sqrt(cells) * CFG.spacing * 16 / 1000) ** 2)
  ok(sites > 3, `sites actually occur (${sites} in ${cells} cells)`)
  ok(per1k > 0.3 && per1k < 3, `sites stay a scatter (${per1k.toFixed(2)} per 1000² of country)`)
  console.log(`  (density: ${sites} sites ≈ ${per1k.toFixed(2)} per 1000²)`)
}

// ── 4. placement is WIRED to building — and that is where this file's job now ends ────────────
// ⚠ THIS SECTION USED TO ASSERT THE RUIN'S GEOMETRY: it walked the 11×11 footprint perimeter and
// counted standing wall against gaps. That assert did not become wrong, it became UNAIMED — the
// jigsaw assembler (2026-08-24) rolls a start piece that may be a 5×5 cell or a 3×5 corridor, so
// the old perimeter is mostly open ground now and "29 open vs 11 standing" is the correct reading
// of a world that changed. A location that expired, not an assertion that was false.
//
// The ruin's own geometry — variety, the envelope, doorways, nothing floating, and the seam test
// taken THROUGH `placeSites` rather than around it — is `ruins.test.ts`, where it is mutation
// tested. What belongs here is the join: a site that exists must put something in the world, or
// placement and building have silently come apart and each half's suite stays green.
{
  let site = null as ReturnType<typeof siteAt>
  for (let cz = -80; cz <= 80 && !site; cz++) for (let cx = -80; cx <= 80 && !site; cx++) {
    site = siteAt(SEED, cx, cz)
  }
  ok(!!site, 'found a site to generate')
  if (site) {
    const ox = Math.floor(site.x / SECTION) * SECTION, oz = Math.floor(site.z / SECTION) * SECTION
    const col = makeColumn(ox, oz, SEED)
    // ⚠ THE FIRST VERSION OF THIS ASSERT COUNTED STONE ANYWHERE IN THE COLUMN, and it passed with
    // `buildRuin` mutated OUT of `placeSites` entirely — the world is made of stone, so "there is
    // stone here" is satisfied by the mountain. It has to name cells the RUIN claims: the plan's
    // own wall perimeter, in the column that owns them.
    let built = 0, claimed = 0
    for (const p of ruinPlan(site, SEED)) {
      for (let z = p.z0; z <= p.z1; z++) for (let x = p.x0; x <= p.x1; x++) {
        if (x !== p.x0 && x !== p.x1 && z !== p.z0 && z !== p.z1) continue
        if (x < ox || x >= ox + SECTION || z < oz || z >= oz + SECTION) continue
        claimed++
        const m = col.get(x - ox, p.floor + 1, z - oz)
        if (m === MAT.STONE || m === MAT.RUBBLE) built++
      }
    }
    ok(claimed > 10, `the plan claims wall cells in this column (${claimed})`)
    ok(built > claimed / 3, `placement is wired to building (${built} of ${claimed} claimed cells stand)`)
    ok(columnHeight(site.x, site.z, SEED) >= site.floor, 'the site still sits on the pad it was chosen for')
  }
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ something stood here — ${pass} passed`)
