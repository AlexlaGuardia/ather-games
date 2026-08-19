// Tree oracle. Run: npx tsx src/app/shimmer/voxel/trees.test.ts
//
// Vegetation fails in ways that look like scenery until you walk into them: a trunk floating a block
// above the ground, a canopy sheared flat at a column border, leaves eating the terrain they landed
// on. All three read as "the art is wrong" and none of them show in a material census.

import { AIR, Section } from './section'
import { MAT, TURF } from './depth'
import { SECTION, makeColumn } from './column'
import { WOOD, SPECIES, treeStartsAt, treeScanRadius, DEFAULT_TREES, growTree, crownAt } from './trees'
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
  // ⚠ [384,192] RETIRED 2026-08-15 (the bubble wiring): 429 blocks from the origin puts it inside
  // the keeper's fold, where the Wilds deliberately generates nothing — so it went bare for the
  // same reason the 2026-08-07 originals did, one cause over. [-576,384] replaces it: forestness
  // 1.00, 692 blocks out, 106 wood voxels crossing the shared column.
  for (const [bx, bz] of [[-576, 384], [1728, 192], [960, 384], [2688, 0]] as const) {
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
      // ⚠ WIDENED TO `TURF`, NOT WEAKENED (2026-08-19, the character layer). This read
      // `!== MAT.TOPSOIL` when topsoil was the world's only ground; the claim being made has always
      // been "a trunk stands on ground that grows", and TURF is now the definition of that. The
      // refusals it exists for are all still refusals — sand, stone, scree and marsh mud are every
      // one of them outside the set, which is checked explicitly below so this cannot rot into a
      // test that passes because the set grew.
      if (!TURF.has(col.get(x, h, z))) wrongGround++
    }
  }
  ok(checked > 10, 'the ground check found trunks')
  ok(wrongGround === 0, `★ every trunk stands on ground that grows, never sand or stone (${wrongGround} wrong)`)
  for (const bad of [MAT.SAND, MAT.STONE, MAT.SCREE, MAT.MARSH_MUD, MAT.WATER, MAT.GREY_SOIL])
    ok(!TURF.has(bad), `TURF still refuses ${bad} — the planter's allowlist has not gone soft`)
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
  // ⚠ WINDOW WIDENED 40 → 56 ON 2026-08-19 (slice ②), and the reason is the feature, not the test.
  // Land character multiplies the trunk count, and most of what it multiplies is DOWN: a barrens
  // is 0.15, a crag 0, a tableland 0.45, while the wooded lands stay at 1.0-1.18. So the world has
  // roughly a fifth fewer trees than it did and every one of them came out of open country, which
  // is precisely the "or no trees" Alex asked for. The same 40x40 window fell from >800 trunks to
  // 625. Lowering the threshold instead would have quietly weakened a mix assert that wants a big
  // sample to be meaningful — the fix for a thinner world is a wider window, not a smaller claim.
  for (let cx = 0; cx < 56; cx++) for (let cz = 0; cz < 56; cz++)
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

// ── 10. ★ maxSpread is a CONTRACT, and it is now measured rather than trusted ────────────────
// `treeScanRadius` derives the planter's scan margin from `maxSpread`, so a canopy that reaches
// further than the number claims is simply MISSING from the neighbouring column — a tree sliced
// flat down a column border, which reads as an art bug and is a generation one.
//
// ⚠ Nothing checked this before. Test 2's assert compares the margin against the number; it has no
// opinion about whether the trees agree with it. That was survivable while a crown was one centred
// ellipsoid of exactly `radius` — the lobed crown (2026-08-13) hangs satellites OFF the trunk, so
// the reach is an emergent sum of offset + warped radius and no longer readable off the config.
{
  const S = 64                        // wide enough that nothing clips: reach is asserted at ≤ 7
  const CENTRE = 32
  let worst = 0, worstWho = ''
  for (const sp of SPECIES) {
    for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
      for (let k = 0; k < 24; k++) {
        const stack = [new Section(S), new Section(S), new Section(S)]
        const c = { sections: stack, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }
        growTree(c, { x: CENTRE, z: CENTRE, species: sp, height: h, seed: (k * 2654435761 + h) | 0 }, 20)
        for (let si = 0; si < stack.length; si++) {
          const d = stack[si].data
          for (let i = 0; i < d.length; i++) {
            if (!isWood(d[i])) continue
            const x = i % S, z = ((i / S) | 0) % S
            const reach = Math.max(Math.abs(x - CENTRE), Math.abs(z - CENTRE))
            if (reach > worst) { worst = reach; worstWho = `${sp.id} h${h}` }
          }
        }
      }
    }
  }
  ok(worst > 0, `the reach check actually grew trees (${worst})`)
  ok(worst <= CFG.maxSpread,
    `★ no canopy reaches past maxSpread=${CFG.maxSpread} (worst ${worst} on ${worstWho})`)
}

// ── 11. ★ the crown is not a sphere — the lump is real, not decorative ───────────────────────
// The whole 2026-08-13 change is "these trees read as primitives". A silhouette dial that is wired
// up but has no effect would leave the forest looking identical while every other assert stayed
// green, so this measures the deviation directly: how much the canopy's horizontal half-width
// varies from layer to layer. A perfect ellipsoid varies smoothly and symmetrically; a lobed,
// warped crown does not.
{
  const S = 64, CENTRE = 32
  let asymmetric = 0, sampled = 0
  for (const sp of SPECIES) {
    for (let k = 0; k < 16; k++) {
      const stack = [new Section(S), new Section(S), new Section(S)]
      const c = { sections: stack, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }
      growTree(c, { x: CENTRE, z: CENTRE, species: sp, height: sp.maxHeight, seed: (k * 40503 + 7) | 0 }, 20)
      // Compare the canopy's extent on +x against -x, per layer. A centred ellipsoid is exactly
      // symmetric about the trunk; lobes and warp break that, and by more than one voxel.
      for (let y = 0; y < 3 * S; y++) {
        const sec = stack[(y / S) | 0], ly = y % S
        let px = 0, nx = 0, any = false
        for (let dx = -12; dx <= 12; dx++) {
          for (let dz = -12; dz <= 12; dz++) {
            if (!LEAVES.has(sec.get(CENTRE + dx, ly, CENTRE + dz))) continue
            any = true
            if (dx > 0) px = Math.max(px, dx); else if (dx < 0) nx = Math.max(nx, -dx)
          }
        }
        if (!any) continue
        sampled++
        if (px !== nx) asymmetric++
      }
    }
  }
  ok(sampled > 100, `the lump check found canopy layers to measure (${sampled})`)
  // ⚠ Deliberately a RATE, not a count, and the threshold is MEASURED against the old generator
  // rather than picked. The pre-change centred ellipsoid was not perfectly symmetric either — the
  // rim nibble deletes cells at random — so "any asymmetry at all" would have passed on the exact
  // shape this change exists to replace. Stashing trees.ts and running this same check against the
  // old file gives **33%**; the lobed, warped crown gives **53%**. 45% sits clear of both.
  ok(asymmetric / sampled > 0.45,
    `★ canopies are lopsided, not centred spheres (${(asymmetric / sampled * 100).toFixed(0)}% of layers)`)
}

// ── 12. ★ the crown DRAPES the trunk instead of perching on it ───────────────────────────────
// ⚠ THIS ASSERT EXISTS BECAUSE THE ONE ABOVE COULD NOT FAIL FOR THE RIGHT REASON. Deleting the
// satellite lobes outright left test 11 GREEN at 45% — the warp alone carries it — so half the
// change was covered by decoration. The lump and the lobes fix DIFFERENT halves of "a pole with a
// ball on it": the warp fixes the ball, the lobes fix the pole. They need separate oracles.
//
// What a satellite lobe is FOR is hanging canopy mass down the side of the upper trunk. So measure
// exactly that: how much of the tree is bare stem below the lowest leaf.
{
  const S = 64, CENTRE = 32, GROUND = 20
  let sum = 0, trees = 0
  for (const sp of SPECIES) {
    if (sp.foliage !== 'blob') continue          // lobes are the blob placer's; layered has its own profile
    for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
      for (let k = 0; k < 12; k++) {
        const stack = [new Section(S), new Section(S), new Section(S)]
        const c = { sections: stack, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }
        growTree(c, { x: CENTRE, z: CENTRE, species: sp, height: h, seed: (k * 22695477 + h * 13) | 0 }, GROUND)
        // The main lobe is centred on `top - 1`, so in the OLD generator the canopy's mass was
        // symmetric about that line by construction. Every satellite hangs below it. So the share
        // of leaf voxels sitting under the main lobe's centre is a direct readout of whether the
        // mass moved DOWN the trunk — which is the entire job of a satellite.
        const centreY = GROUND + 1 + h - 1
        let below = 0, all = 0
        for (let y = 0; y < 3 * S; y++) {
          const sec = stack[(y / S) | 0], ly = y % S
          for (let dx = -12; dx <= 12; dx++)
            for (let dz = -12; dz <= 12; dz++) {
              if (!LEAVES.has(sec.get(CENTRE + dx, ly, CENTRE + dz))) continue
              all++
              if (y < centreY) below++
            }
        }
        if (!all) continue
        sum += below / all
        trees++
      }
    }
  }
  ok(trees > 20, `the bare-stem check grew blob trees (${trees})`)
  // ⚠ Threshold MEASURED in all three states, not picked: pre-change generator **41.1%**, warp
  // with the satellites deleted **41.9%**, lobed crown **53.6%**. 48% sits clear of both sides,
  // and the deletion mutation goes red — which is the whole reason this assert exists.
  ok(sum / trees > 0.48,
    `★ foliage hangs down the trunk, not just over it (${(sum / trees * 100).toFixed(0)}% of mass below centre)`)
}

// ── 13. ★ `crownAt` AGREES WITH THE CANOPY THE GENERATOR ACTUALLY GREW ───────────────────────
// `crownAt` exists so something outside the generator (the smooth-canopy renderer) can know where
// the foliage is without growing it. That makes it a SECOND SOURCE OF TRUTH about the same shape,
// and the whole file's history is other people's second sources quietly drifting.
//
// The failure it guards is nasty precisely because it is plausible: pass the rng's derived seed
// instead of the raw one, or forget that the centre is `top - 1`, and you get a perfectly
// well-formed crown hanging beside or above the tree it belongs to. Nothing throws. So: grow the
// tree for real, then check every lobe `crownAt` reports is actually sitting in leaves.
{
  const S = 64, CENTRE = 32, GROUND = 20
  let checked = 0, adrift = 0, worstMiss = ''
  for (const sp of SPECIES) {
    for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
      for (let k = 0; k < 8; k++) {
        const start = { x: CENTRE, z: CENTRE, species: sp, height: h, seed: (k * 69069 + h * 31) | 0 }
        const stack = [new Section(S), new Section(S), new Section(S)]
        const c = { sections: stack, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }
        growTree(c, start, GROUND)
        // ⚠ EVERY species must be describable now, layered and forking included. This assert used
        // to demand `null` for those two — correct while only the blob placer had a layout, and
        // immediately wrong once the tier stack and the fork limbs came off the rng stream too. A
        // renderer that covers 84% of the forest leaves the other 16% bare, which is not a spike,
        // it is a bug with a flag on it.
        const crown = crownAt(start, GROUND)
        if (!crown) { adrift++; worstMiss = `${sp.id} h${h} returned null`; continue }
        for (const lo of crown.lobes) {
          const x = crown.x + lo.dx, y = crown.y + lo.dy, z = crown.z + lo.dz
          const sec = stack[(y / S) | 0]
          if (!sec) { adrift++; continue }
          checked++
          // ⚠ THE CENTRE CELL IS NOT ALWAYS A LEAF, and the first cut of this assert failed 72
          // times on exactly that. The MAIN lobe is centred on `top - 1`, which is the trunk's own
          // topmost log — and `canLeaf` correctly refuses to overwrite a log. So the centre must be
          // WOOD (leaf or log), not specifically leaf.
          //
          // A centre test alone would then be weak, since a lobe drifting one block sideways still
          // lands on the trunk. So the real measure is mass: count the foliage the lobe should have
          // put down. A lobe placed in open air by a bad seed scores ~0 against a floor of r².
          const centre = sec.get(x, y % S, z)
          // ⚠ INTEGER BOUNDS. A layered tier's radius is fractional, and looping `ddy = -lo.r;
          // ddy <= lo.r; ddy++` walks fractional offsets — which index a voxel array at .585 and
          // read zero from everywhere. The test reported 720 lobes "adrift" from a generator that
          // was placing them perfectly.
          const R = Math.ceil(lo.r)
          let mass = 0
          for (let ddy = -R; ddy <= R; ddy++)
            for (let ddz = -R; ddz <= R; ddz++)
              for (let ddx = -R; ddx <= R; ddx++) {
                const yy = y + ddy
                const s2 = stack[(yy / S) | 0]
                if (s2 && LEAVES.has(s2.get(x + ddx, yy % S, z + ddz))) mass++
              }
          if (!LEAVES.has(centre) && !LOGS.has(centre)) { adrift++; worstMiss = `${sp.id} h${h} r${lo.r} centre=${centre}` }
          else if (mass <= lo.r * lo.r) { adrift++; worstMiss = `${sp.id} h${h} r${lo.r} mass=${mass}` }
        }
      }
    }
  }
  ok(checked > 100, `the crownAt check found lobes to verify (${checked})`)
  ok(adrift === 0, `★ every lobe crownAt reports lands in real foliage (${adrift} adrift, e.g. ${worstMiss})`)
}

console.log(`\ntrees: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the forest stands')
