// Tree oracle. Run: npx tsx src/app/shimmer/voxel/trees.test.ts
//
// Vegetation fails in ways that look like scenery until you walk into them: a trunk floating a block
// above the ground, a canopy sheared flat at a column border, leaves eating the terrain they landed
// on. All three read as "the art is wrong" and none of them show in a material census.

import { AIR } from './section'
import { MAT } from './depth'
import { SECTION, makeColumn } from './column'
import { WOOD, SPECIES, treeStartsAt, treeScanRadius, DEFAULT_TREES } from './trees'
import { columnHeight } from './height'
import { breakSeconds, blockDef } from './registry'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const CFG = DEFAULT_TREES
const LOGS = new Set<number>(SPECIES.map(s => s.log))
const LEAVES = new Set<number>(SPECIES.map(s => s.leaves))
const isWood = (m: number) => LOGS.has(m) || LEAVES.has(m)

// Sites are FILTERED to wooded, dry, tree-friendly ground (mask ≥ 0.6, surface above the beach,
// not drained) rather than taken blind: the biome layer and the plains pass both move where trees
// live, and a blind pseudo-random sample kept starving the trunk asserts below their minimums
// every time the terrain was retuned. The filter reads the same pure fields the planter reads, so
// it tracks any future retune for free.
import { forestness, greyness } from './biome'
import { DEFAULT_DEPTH } from './depth'
const SITES: [number, number][] = []
for (let i = 0; SITES.length < 40 && i < 4000; i++) {
  const ox = (i * 197) % 6000, oz = (i * 331) % 6000
  const cx = ox / SECTION, cz = oz / SECTION
  if (forestness(SEED, cx, cz) < 0.6) continue
  if (greyness(ox + 8, oz + 8, SEED) > 0) continue
  if (columnHeight(ox + 8, oz + 8, SEED) <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight + 1) continue
  SITES.push([ox, oz])
}

// ── 1. determinism and order-independence ────────────────────────────────────────────────────
{
  const a = makeColumn(512, 768, SEED)
  makeColumn(-9999, 4444, SEED)
  const b = makeColumn(512, 768, SEED)
  let diff = 0
  for (let i = 0; i < a.sections.length; i++) for (let k = 0; k < a.sections[i].data.length; k++)
    if (a.sections[i].data[k] !== b.sections[i].data[k]) diff++
  ok(diff === 0, 'a wooded column generates identically regardless of what came before it')
}

// ── 2. ★ in_square — every trunk origin lies inside the column that OWNS it ──────────────────
// This is the entire anti-double-generation story: exactly one column rolls a given tree, so there
// is no cross-column "already placed?" lookup to get wrong.
{
  let escaped = 0, total = 0
  // Sampled in WILD country (east of spawn, short of Mana Springs): the calmed spawn zones now
  // deliberately carry few trees, and this check needs volume, not any particular place.
  for (let cx = 40; cx < 70; cx++) for (let cz = 0; cz < 30; cz++) {
    for (const st of treeStartsAt(SEED, cx, cz, SECTION, CFG)) {
      total++
      if (st.x < cx * SECTION || st.x >= (cx + 1) * SECTION) escaped++
      if (st.z < cz * SECTION || st.z >= (cz + 1) * SECTION) escaped++
    }
  }
  ok(total > 500, `the in_square check sampled real trees (${total})`)
  ok(escaped === 0, `★ every trunk origin is inside its owning column (${escaped} escapes)`)
  ok(treeScanRadius(SECTION, CFG) * SECTION >= CFG.maxSpread, 'the scan margin covers the widest canopy')
}

// ── 3. ★ THE SEAM — a canopy crossing a border must be identical from either alignment ───────
// Same property the carvers needed, and the same reason: how the world is diced into columns must
// be invisible in the result. Columns at ox and ox+SECTION-1 overlap in exactly one world column.
{
  let mismatch = 0, wood = 0, checked = 0
  // Sites picked to sit INSIDE the woodland mask (forestness ≥ 0.9) with wood actually crossing the
  // shared column — the originals went bare when forests became patchy (2026-08-07) and a seam test
  // over bare ground proves nothing, which is exactly what its own guard assert said.
  for (const [bx, bz] of [[384, 192], [1728, 192], [960, 384], [2688, 0]] as const) {
    const a = makeColumn(bx, bz, SEED)
    const b = makeColumn(bx + SECTION - 1, bz, SEED)
    for (let y = 1; y < 250; y++) for (let z = 0; z < SECTION; z++) {
      const va = a.get(SECTION - 1, y, z)
      const vb = b.get(0, y, z)
      checked++
      if (isWood(va)) wood++
      if (va !== vb) mismatch++
    }
  }
  ok(checked > 10000, 'the seam check sampled the shared column')
  ok(wood > 0, `canopies really do cross the shared column (${wood} wood voxels — a seam test over bare ground proves nothing)`)
  ok(mismatch === 0, `★ the same world voxel is identical from either column alignment (${mismatch} disagreements)`)
}

// ── 4. ★ trunks stand ON the ground, not in it and not above it ──────────────────────────────
{
  let floating = 0, buried = 0, trunks = 0
  for (const [ox, oz] of SITES.slice(0, 20)) {
    const col = makeColumn(ox, oz, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = columnHeight(ox + x, oz + z, SEED)
      // the voxel directly above the surface is where a trunk base belongs
      if (!LOGS.has(col.get(x, h + 1, z))) continue
      trunks++
      if (col.get(x, h, z) === AIR) floating++          // nothing underneath it
      if (LOGS.has(col.get(x, h - 1, z))) buried++      // trunk continues below the surface
    }
  }
  ok(trunks > 10, `found trunk bases to check (${trunks})`)
  ok(floating === 0, `★ no trunk floats above the ground (${floating})`)
  ok(buried === 0, `★ no trunk is buried in the ground (${buried})`)
}

// ── 5. trees only grow on topsoil ────────────────────────────────────────────────────────────
// Sand, stone and water staying bare is what makes woodland read as woodland rather than as noise.
{
  let wrongGround = 0, checked = 0
  for (const [ox, oz] of SITES.slice(0, 25)) {
    const col = makeColumn(ox, oz, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = columnHeight(ox + x, oz + z, SEED)
      if (!LOGS.has(col.get(x, h + 1, z))) continue
      checked++
      // The surface under a trunk is overwritten by nothing, so it should still be topsoil.
      if (col.get(x, h, z) !== MAT.TOPSOIL) wrongGround++
    }
  }
  ok(checked > 10, 'the ground check found trunks')
  ok(wrongGround === 0, `★ every trunk stands on topsoil, never sand or stone (${wrongGround} wrong)`)
}

// ── 6. leaves never eat terrain or logs ──────────────────────────────────────────────────────
// A canopy that overwrites the hillside behind it carves a hole nobody can explain.
{
  let eaten = 0
  for (const [ox, oz] of SITES.slice(0, 20)) {
    const bare = makeColumn(ox, oz, SEED)   // same seed, so terrain is identical
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = columnHeight(ox + x, oz + z, SEED)
      // Below the surface, nothing may be wood — trees are strictly an above-ground feature.
      for (let y = 1; y <= h; y++) if (isWood(bare.get(x, y, z))) eaten++
    }
  }
  ok(eaten === 0, `★ no wood is written at or below the surface (${eaten} voxels)`)
}

// ── 7. species mix tracks the weights ────────────────────────────────────────────────────────
// ⚠ Counted per TREE, not per voxel. Log voxels over-count tall species — shimmeroak makes more
// wood per trunk than goldwood — so a voxel census would report a mix that is not the mix.
{
  const count = new Map<string, number>()
  let total = 0
  for (let cx = 0; cx < 40; cx++) for (let cz = 0; cz < 40; cz++)
    for (const st of treeStartsAt(SEED, cx, cz, SECTION, CFG)) {
      count.set(st.species.id, (count.get(st.species.id) ?? 0) + 1)
      total++
    }
  ok(total > 800, `enough trees to judge the mix (${total})`)
  const wTotal = CFG.species.reduce((a, s) => a + s.weight, 0)
  let worst = 0
  for (const sp of CFG.species) {
    const got = (count.get(sp.id) ?? 0) / total
    worst = Math.max(worst, Math.abs(got - sp.weight / wTotal))
  }
  // ★ Weights are modulated BY PLACE since the biome layer (biome.ts speciesFactor): starwillow
  // crowds low ground, goldwood the hills, dawnwood the forest cores. So a GLOBAL census drifts
  // from the flat table by design — the tolerance is loose on purpose, and what it still pins is
  // the ORDER (common stays common, rare stays rare). Place-level leanings are biome.test.ts's.
  ok(worst < 0.15, `species stay near their base weights globally (worst deviation ${(worst * 100).toFixed(1)}pp)`)
  const shares = CFG.species.map(sp => (count.get(sp.id) ?? 0) / total)
  ok(shares[0] > shares[2] && shares[0] > shares[3], 'goldwood stays the common tree')
  ok(shares[3] < 0.15, 'dawnwood stays rare in a global census')
  ok((count.get('dawnwood') ?? 0) > 0, 'the rarest species still appears — rarity is a weight, not an absence')
}

// ── 8. the treeline is respected ─────────────────────────────────────────────────────────────
{
  let above = 0
  for (let cx = 0; cx < 60; cx++) for (let cz = 0; cz < 60; cz++)
    for (const st of treeStartsAt(SEED, cx, cz, SECTION, CFG)) {
      if (columnHeight(st.x, st.z, SEED) >= CFG.maxAltitude) {
        // a start above the treeline is fine — it must simply not have been PLANTED
        above++
      }
    }
  // Nothing to assert about starts; assert the world instead.
  let peakWood = 0
  for (const [ox, oz] of SITES) {
    const col = makeColumn(ox, oz, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = columnHeight(ox + x, oz + z, SEED)
      if (h < CFG.maxAltitude) continue
      if (LOGS.has(col.get(x, h + 1, z))) peakWood++
    }
  }
  ok(peakWood === 0, `★ nothing grows above the treeline at y=${CFG.maxAltitude} (${peakWood} trunks)`)
}

// ── 9. ★ the tool families are enforced — a spike will not cut a tree ────────────────────────
// `engine/tools.ts` rules blades→forestry and spikes→prospecting. The registry must make that real
// rather than restate it, or the two skills collapse into one.
{
  ok(breakSeconds(WOOD.GOLDWOOD_LOG, 3, 'prospecting') === Infinity, '★ a spike cannot cut goldwood')
  ok(breakSeconds(WOOD.GOLDWOOD_LOG, 1, 'forestry') < Infinity, 'a blade can')
  ok(breakSeconds(MAT.STONE, 3, 'forestry') === Infinity, '★ a blade cannot break stone')
  ok(breakSeconds(WOOD.STARWILLOW_LOG, 1, 'forestry') === Infinity, 'starwillow refuses a tier-1 blade')
  ok(breakSeconds(WOOD.STARWILLOW_LOG, 2, 'forestry') < Infinity, 'and yields to a tier-2 one')
  ok(breakSeconds(WOOD.DAWNWOOD_LOG, 2, 'forestry') === Infinity, 'dawnwood needs tier 3')
  ok(breakSeconds(WOOD.GOLDWOOD_LEAVES, 0, null) < Infinity, 'leaves come away by hand')

  // Every generated wood material must have a definition, or it is an unnamed unbreakable block.
  const missing = [...LOGS, ...LEAVES].filter(m => !blockDef(m))
  ok(missing.length === 0, `every wood material has a BlockDef (missing ${missing.join(',')})`)
  // A log drops a LOG since the refine layer (859aebb) — planks/branches are CRAFTED from it now.
  // (These two asserts said `goldwood_plank`/`starwillow_branch` until 2026-08-07: the refine
  // commit updated the registry + recipes tests but missed this file, so they were failing stale.)
  ok(blockDef(WOOD.GOLDWOOD_LOG)?.drops[0]?.itemId === 'goldwood_log', 'goldwood drops its raw log')
  ok(blockDef(WOOD.STARWILLOW_LOG)?.drops[0]?.itemId === 'starwillow_log', 'starwillow drops its raw log')
}

console.log(`\ntrees: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the forest stands')
