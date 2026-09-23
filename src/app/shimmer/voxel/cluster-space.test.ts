// Run: npx tsx src/app/shimmer/voxel/cluster-space.test.ts
// ★ The claim this file exists to prove: your quarter IS your plot, moved by whole columns — so your
// saved plot edits can load into it unchanged. Asserted block for block against the real generators.
import { SECTION } from './column'
import { plotMaterialAt, plotForTier, DEFAULT_PLOT, PLOT_TIERS } from './plot'
import { clusterMaterialAt } from './cluster-column'
import { DEFAULT_CLUSTER, QUARTERS, MIN_OFFSET, quarterCentre } from './cluster'
import { MAT } from './depth'
import {
  quarterShift, plotColumnOf, clusterColumnOf, cellIsMine, standInCluster, STAND_IN_SEED_BASE,
} from './cluster-space'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// §1 the shift is whole columns, and it is the quarter's centre.
ok(DEFAULT_CLUSTER.offset % SECTION === 0, `§1 ★ offset ${DEFAULT_CLUSTER.offset} is column-aligned`)
ok(DEFAULT_CLUSTER.offset >= MIN_OFFSET(), '§1 and still at or past the safety bound')
for (const q of QUARTERS) {
  const s = quarterShift(q), c = quarterCentre(q, DEFAULT_CLUSTER)
  ok(s.dcx * SECTION === c.x && s.dcz * SECTION === c.z, `§1 ${q}: the shift lands the plot's origin on the quarter's centre`)
  const g = clusterColumnOf(3, -7, q), p = plotColumnOf(g.gx, g.gz, q)
  ok(p.px === 3 && p.pz === -7, `§1 ${q}: column maps round-trip`)
}
let threw = false
try { quarterShift('ne', { ...DEFAULT_CLUSTER, offset: 500 }) } catch { threw = true }
ok(threw, '§1 ★ a misaligned offset refuses loudly instead of shearing everybody\'s garden')

// §2 ★★ BLOCK FOR BLOCK: my quarter's ground == my solo plot's ground, wherever the cell is mine.
const SEED = 1337
for (let tier = 0; tier < PLOT_TIERS.length; tier++) {
  for (const q of ['ne', 'sw'] as const) {
    const cfg = standInCluster(q, SEED, tier)
    const plot = plotForTier(tier, DEFAULT_PLOT)
    const { dcx, dcz } = quarterShift(q, cfg)
    let compared = 0, differ = 0, wallOnly = 0, notMine = 0, firstBad = ''
    let rng = 12345 + tier * 7
    const rnd = () => { rng = (rng * 1103515245 + 12345) >>> 0; return rng / 0x100000000 }
    for (let i = 0; i < 700; i++) {
      const x = Math.floor((rnd() * 2 - 1) * PLOT_TIERS[tier]), z = Math.floor((rnd() * 2 - 1) * PLOT_TIERS[tier])
      const cx = x + dcx * SECTION, cz = z + dcz * SECTION
      if (!cellIsMine(cx, cz, q, cfg)) { notMine++; continue }
      for (let y = 60; y <= 110; y += 1) {
        const a = plotMaterialAt(x, y, z, SEED, plot), b = clusterMaterialAt(cx, y, cz, cfg)
        compared++
        if (a === b) continue
        // ★ THE ONE DESIGNED DIFFERENCE: the cloud wall. A plot walls its own coast; a cluster walls
        // its OUTLINE and parts the wall where a lane leaves (one fold, one wall). So a wall cell can
        // be cloud on one side and air on the other. The wall cannot be broken, so no edit ever
        // lands there; anything ELSE differing is a real mismatch.
        if ((a === MAT.PACKED_CLOUD && b === MAT.AIR) || (a === MAT.AIR && b === MAT.PACKED_CLOUD)) { wallOnly++; continue }
        differ++; if (!firstBad) firstBad = `(${x},${y},${z}) plot ${a} vs cluster ${b}`
      }
    }
    ok(compared > 5000, `§2 tier ${tier} ${q}: a real sample (${compared} cells)`)
    ok(differ === 0, `§2 ★★ tier ${tier} ${q}: the quarter IS the plot where it is mine (${differ} differ ${firstBad})`)
    ok(wallOnly <= compared * 0.01, `§2 tier ${tier} ${q}: the wall is the only designed difference, and it is a thin ring (${wallOnly}/${compared})`)
    if (tier === PLOT_TIERS.length - 1) ok(notMine > 0, `§2 at max tier some of the plot's square is NOT mine in a cluster (reserved Green, air) — ${notMine}`)
  }
}

// §3 a mate's ground and the Green are not mine.
{
  const cfg = standInCluster('ne', SEED, 2)
  const other = quarterCentre('sw', cfg)
  ok(!cellIsMine(other.x, other.z, 'ne', cfg), '§3 a mate\'s fold centre is read-only to me')
  ok(!cellIsMine(0, 0, 'ne', cfg), '§3 the Green is nobody\'s plot')
  const mine = quarterCentre('ne', cfg)
  ok(cellIsMine(mine.x, mine.z, 'ne', cfg), '§3 my own centre is mine')
}

// §4 stand-ins can never pass for a person.
{
  const cfg = standInCluster('nw', SEED, 1)
  ok(cfg.slots.nw?.seed === SEED, '§4 my slot carries my seed')
  ok(QUARTERS.filter(q => q !== 'nw').every(q => (cfg.slots[q]?.seed ?? 0) >= STAND_IN_SEED_BASE), '§4 ★ every other slot is a marked stand-in')
}

if (fails.length) { console.error(`cluster-space: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`cluster-space: ${pass}/${pass} pass`)
