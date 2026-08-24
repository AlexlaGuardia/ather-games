// Read a ruin out of the GENERATOR, in world coordinates. Run: npx tsx scripts/ruin-shot.mts [n]
//
// ★ WHY THIS EXISTS AND A SCREENSHOT DOES NOT REPLACE IT (PATTERNS, 2026-08-22): an ambiguous
// picture of generated geometry is worth very little on its own — under-settled streaming, flora
// that trails the terrain by tens of seconds, and a prebuilt worker artifact that disagrees with
// source have each read as "the feature is broken" when the feature was fine. So pair any picture
// with a reading taken from the generator itself, in the same coordinates. This is that reading:
// the assembler's PLAN and the voxels a real column actually contains, printed side by side. If
// they ever disagree, the bug is between `ruinPlan` and `placeSites`, and this says so in one look.
//
//   #  stone wall     ·  rubble      +  doorway (the plan says open)      .  ground

import { siteAt } from '../src/app/shimmer/voxel/sites'
import { ruinPlan } from '../src/app/shimmer/voxel/ruins'
import { makeColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const want = Number(process.argv[2] ?? 3)

const sites = []
for (let cz = -60; cz <= 60 && sites.length < 400; cz++) for (let cx = -60; cx <= 60; cx++) {
  const s = siteAt(SEED, cx, cz); if (s) sites.push(s)
}
// Pick a spread of sizes so one run shows a lonely room AND a complex.
const bySize = new Map<number, typeof sites[0]>()
for (const s of sites) { const n = ruinPlan(s, SEED).length; if (!bySize.has(n)) bySize.set(n, s) }
const picks = [...bySize.entries()].sort((a, b) => a[0] - b[0]).filter((_, i, a) => i === 0 || i === (a.length >> 1) || i === a.length - 1).slice(0, want)

const cols = new Map<string, ReturnType<typeof makeColumn>>()
const colFor = (x: number, z: number) => {
  const ox = Math.floor(x / SECTION) * SECTION, oz = Math.floor(z / SECTION) * SECTION
  const k = `${ox},${oz}`
  if (!cols.has(k)) cols.set(k, makeColumn(ox, oz, SEED))
  return cols.get(k)!
}

for (const [n, site] of picks) {
  const parts = ruinPlan(site, SEED)
  const R = 24
  console.log(`\n── ruin at ${site.x},${site.z} — ${n} piece(s): ${parts.map(p => p.def.id).join(' + ')}`)
  console.log(`   floor ${site.floor}, columns ${new Set(parts.map(p => `${Math.floor(p.x0 / SECTION)},${Math.floor(p.z0 / SECTION)}`)).size}+`)
  let mismatch = 0
  for (let z = site.z - R; z <= site.z + R; z++) {
    let row = ''
    for (let x = site.x - R; x <= site.x + R; x++) {
      const owner = parts.find(p => p.x0 <= x && x <= p.x1 && p.z0 <= z && z <= p.z1)
      const col = colFor(x, z)
      const at = (y: number) => col.get(x - col.wx, y, z - col.wz)
      const isDoor = owner?.doors.some(d => d.x === x && d.z === z)
      const wall = owner && at(owner.floor + 1) === MAT.STONE
      const rub = owner && at(owner.floor) === MAT.RUBBLE
      // The plan says this is a doorway; the world must NOT have wall standing in it.
      if (isDoor && wall) mismatch++
      row += isDoor ? '+' : wall ? '#' : rub ? '·' : '.'
    }
    console.log('   ' + row)
  }
  console.log(`   plan-vs-voxels: ${mismatch === 0 ? 'agree' : `⚠ ${mismatch} doorways walled over`}`)
}
