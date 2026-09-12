// ── EXPANSION LITTER — the ring a widening adds arrives with things in the way ──────────────────
// Run: npx tsx src/app/shimmer/voxel/plot-litter.test.ts
//
// Alex, 2026-09-12: "the home plot can be littered with things like the heap and other
// obstructions each time they expand" — dressing AND free materials. The rule is pure
// (`plot.ts › litterAt`), so this asks it directly, then asks the material function that the
// worker and the host both run, then reads the host for the four wires that make it real.
import { litterAt, litterDrops, withLitter, plotForTier, plotMaterialAt, plotHeight, plotThreshold, insideCore, caveAt, DEFAULT_PLOT, PLOT_TIERS } from './plot'
import { MAT } from './depth'
import { AIR } from './section'
import { WORLD_SEED as SEED } from '../voxel3d/world-seed'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly, noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const STEP = 3   // sample every third column; ~120k samples over the whole fold

/** Every littered column of a config, sampled. */
function litterOf(cfg: ReturnType<typeof plotForTier>) {
  const out: { x: number; z: number; m: number }[] = []
  for (let x = -520; x <= 520; x += STEP) for (let z = -520; z <= 520; z += STEP) {
    const m = litterAt(x, z, SEED, cfg); if (m) out.push({ x, z, m })
  }
  return out
}
const ringOf = (tier: number) => {
  let n = 0
  const cfg = plotForTier(tier), prev = plotForTier(tier - 1)
  for (let x = -520; x <= 520; x += STEP) for (let z = -520; z <= 520; z += STEP)
    if (insideCore(x, z, SEED, cfg) && !insideCore(x, z, SEED, prev)) n++
  return n
}

console.log('\n── 1. the ids are what the registry calls them ──')
ok(DEFAULT_PLOT.litter.heap === MAT.RUBBLE_HEAP, `litter.heap is RUBBLE_HEAP (${DEFAULT_PLOT.litter.heap} vs ${MAT.RUBBLE_HEAP})`)
ok(DEFAULT_PLOT.litter.deadfall === MAT.DEADFALL, `litter.deadfall is DEADFALL (${DEFAULT_PLOT.litter.deadfall} vs ${MAT.DEADFALL})`)

console.log('\n── 2. ★★ nothing is littered until the save says from which tier ──')
for (const t of [0, 1, 2]) ok(litterOf(plotForTier(t)).length === 0, `default config (from: Infinity) litters nothing at tier ${t}`)
ok(litterOf(withLitter(plotForTier(0), 1)).length === 0, '★ tier 0 — the starting garden — is never littered, even from 1')
ok(litterOf(withLitter(plotForTier(0), 0)).length === 0, '...and `from: 0` is clamped to 1, so it still is not')
ok(litterOf({ ...plotForTier(0), litter: { ...DEFAULT_PLOT.litter, from: 0 } }).length === 0, '★ and litterAt clamps on its own too — a hand-built config with from: 0 still spares tier 0')
ok(litterOf({ ...plotForTier(0), litter: { ...DEFAULT_PLOT.litter, from: -1 } }).length === 0, '...from: -1 as well')
ok(litterOf(withLitter(plotForTier(1), 2)).length === 0, '★ an older save at tier 1 (from: 2) keeps its tier-1 ring clean')
ok(litterOf(withLitter(plotForTier(2), 2)).length > 0, '...and gets litter on the tier-2 ring it has not built on yet')

console.log('\n── 3. ★★ the litter is in the NEW ring, and nowhere else ──')
for (const t of [1, 2]) {
  const cfg = withLitter(plotForTier(t), 1), prev = plotForTier(t - 1)
  const L = litterOf(cfg)
  ok(L.length > 0, `tier ${t} has litter at all (${L.length} samples)`)
  const outside = L.filter(l => !insideCore(l.x, l.z, SEED, cfg))
  const inner = L.filter(l => insideCore(l.x, l.z, SEED, prev))
  ok(outside.length === 0, `tier ${t}: none of it is off the island (${outside.length})`)
  ok(inner.length === 0, `★★ tier ${t}: none of it is on the previous tier's ground (${inner.length}) — that ground has houses on it`)
  // The threshold, at FULL resolution: the sampled sweep above would miss a 200-column disc.
  // Asserted with a positive control — litter must exist just outside the clearing, or the
  // clearing is "proved" by an empty neighbourhood.
  const th = plotThreshold(SEED, cfg)
  let nearDoor = 0, ringDoor = 0
  for (let x = th.x - 40; x <= th.x + 40; x++) for (let z = th.z - 40; z <= th.z + 40; z++) {
    const d = Math.hypot(x - th.x, z - th.z)
    if (d >= 40) continue
    // Force the roll so the clearing is tested on its own: a config with a carpet density.
    const m = litterAt(x, z, SEED, { ...cfg, litter: { ...cfg.litter, dense: 1, sparse: 1 } })
    if (d < cfg.litter.clearThreshold) nearDoor += m ? 1 : 0
    else ringDoor += m ? 1 : 0
  }
  ok(nearDoor === 0, `tier ${t}: the threshold is clear (${nearDoor} within ${cfg.litter.clearThreshold} under a carpet density)`)
  ok(ringDoor > 0, `tier ${t}: ...and the carpet exists just outside it (${ringDoor}) — the clearing is a rule, not an empty field`)
  const inCave = L.filter(l => { const h = plotHeight(l.x, l.z, SEED, cfg); return h !== null && caveAt(l.x, h + 1, l.z, SEED, cfg) !== null })
  ok(inCave.length === 0, `tier ${t}: nothing sits in the cave's mouth (${inCave.length})`)
  const share = L.length / ringOf(t)
  ok(share > 0.003 && share < 0.03, `tier ${t}: density is a scatter, not a carpet (${(share * 100).toFixed(2)}% of the ring)`)
  const heaps = L.filter(l => l.m === MAT.RUBBLE_HEAP).length / L.length
  ok(heaps > 0.4 && heaps < 0.8, `tier ${t}: heaps and deadfall both present (${(heaps * 100).toFixed(0)}% heaps)`)
}

console.log('\n── 4. it is the material function that places it — worker and host run the same one ──')
{
  const cfg = withLitter(plotForTier(1), 1)
  const l = litterOf(cfg).find(x => x.m === MAT.RUBBLE_HEAP)!
  const h = plotHeight(l.x, l.z, SEED, cfg)!
  ok(plotMaterialAt(l.x, h + 1, l.z, SEED, cfg) === MAT.RUBBLE_HEAP, '★ the heap is the voxel above the surface')
  ok(plotMaterialAt(l.x, h + 2, l.z, SEED, cfg) === AIR, 'and the one above that is air — litter is one block')
  ok(plotMaterialAt(l.x, h, l.z, SEED, cfg) === cfg.materials.topsoil, 'on the turf, which is untouched')
  ok(plotMaterialAt(l.x, h + 1, l.z, SEED, plotForTier(1)) === AIR, '★ the same column under the default config is air — the save decides')
  ok(litterAt(l.x, l.z, SEED, cfg) === litterAt(l.x, l.z, SEED, cfg), 'deterministic')
}

console.log('\n── 5. clearing pays ──')
ok(JSON.stringify(litterDrops(MAT.RUBBLE_HEAP)) === JSON.stringify([{ itemId: 'rubble', count: 3 }]), '★ a generated heap breaks into three rubble — what a crafted one costs')
ok(litterDrops(MAT.DEADFALL) === null, 'deadfall falls through to its registry drop')
ok(litterDrops(MAT.STONE) === null, 'stone is not litter')

console.log('\n── 6. the ladder: withLitter ──')
ok(withLitter(DEFAULT_PLOT, Number.NaN).litter.from === Infinity, 'NaN → no litter')
ok(withLitter(DEFAULT_PLOT, 0).litter.from === 1, '0 → 1 (tier 0 is never littered)')
ok(withLitter(DEFAULT_PLOT, 2).litter.from === 2 && withLitter(DEFAULT_PLOT, 2).capRadius === DEFAULT_PLOT.capRadius, 'sets only the litter')
ok(PLOT_TIERS.length >= 3, 'BLIND CHECK: three tiers on the ladder')

console.log('\n── 7. the host and the worker are wired ──')
{
  const host = noComments(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8'))
  const worker = noComments(readFileSync(join(process.cwd(), 'src/workers/voxel-gen.worker.ts'), 'utf8'))
  ok(host.includes("tier: plotTier.current, litterFrom: litterFrom.current })"), '★ every plot request carries litterFrom')
  ok(host.includes('litterFrom: litterFrom.current,'), 'the snapshot saves it')
  ok(host.includes('litterFrom.current = Math.max(1, Math.round(p.litterFrom ?? (plotTier.current + 1)))'), '★★ restore sets it ONCE with the older-save fallback (plotTier + 1)')
  ok((codeOnly(host).match(/withLitter\(plotForTier\(/g) || []).length === 4, `every host plot config goes through withLitter (${(codeOnly(host).match(/withLitter\(plotForTier\(/g) || []).length} of 4)`)
  ok(!/plotCfg\.current = plotForTier\(/.test(codeOnly(host)), 'no bare plotForTier reaches plotCfg')
  ok(worker.includes('${space}:${tier}:${litterFrom}:${key(cx, cz)}'), '★ the worker cache is keyed on it — a widened fold must not be served pre-litter columns')
  ok(worker.includes('withLitter(plotForTier(tier), litterFrom)'), 'the worker builds the same config')
  ok(host.includes('const litter = generated ? litterDrops(hit.material, plotCfg.current) : null'), '★ the break path pays litter only for a GENERATED cell')
  ok(host.includes('for (const d of litter ?? dropsFor(hit.material))'), '...and falls through to the registry otherwise')
}

console.log(`\nplot-litter: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
