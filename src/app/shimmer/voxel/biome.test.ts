// Biome oracle. Run: npx tsx src/app/shimmer/voxel/biome.test.ts
//
// The layer's job is places, and "places" is a statistics claim as much as a code claim: the world
// must be MOSTLY alive, greyfields must be the exception and must be LARGE, and every label must be
// reachable. These asserts pin the claims a screenshot can't — the map render (terrain-profile) is
// the other half of the review, and neither replaces the other.

import { DEFAULT_BIOME, biomeAt, forestness, greySurfaceAt, greyness, richness, speciesFactor, type BiomeId } from './biome'
import { columnHeight } from './height'
import { DEFAULT_DEPTH, materialAt, MAT } from './depth'
import { treeStartsAt, DEFAULT_TREES } from './trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const SEA = DEFAULT_DEPTH.seaLevel

// ── determinism — same coordinate, same answer, on any thread, in either engine ─────────────────
{
  const a = richness(4021, -1777, SEED)
  const b = richness(4021, -1777, SEED)
  ok(a === b, 'richness is deterministic')
  const h = columnHeight(4021, -1777, SEED)
  ok(biomeAt(4021, -1777, SEED, h, SEA) === biomeAt(4021, -1777, SEED, h, SEA), 'biomeAt is deterministic')
  ok(richness(4021, -1777, SEED + 1) !== a, 'richness answers to the seed')
}

// ── the label precedence is real: water beats grey beats relief beats cover ─────────────────────
{
  ok(biomeAt(0, 0, SEED, SEA - 5, SEA) === 'basin', 'underwater is basin regardless of fields')
  ok(biomeAt(0, 0, SEED, SEA + 1, SEA) === 'shore', 'the waterline band is shore')
}

// ── the world is MOSTLY ALIVE — grey is the exception, and it is a place, not freckles ──────────
{
  const N = 448                      // 448×448 columns at stride 4 → a 1792-block square country
  const stride = 4
  let land = 0, grey = 0
  const seen = new Map<BiomeId, number>()
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const x = ix * stride - (N * stride) / 2, z = iz * stride - (N * stride) / 2
      const h = columnHeight(x, z, SEED)
      const b = biomeAt(x, z, SEED, h, SEA)
      seen.set(b, (seen.get(b) ?? 0) + 1)
      if (h > SEA + DEFAULT_DEPTH.beachHeight) {
        land++
        if (greySurfaceAt(x, z, SEED)) grey++
      }
    }
  }
  const greyShare = grey / land
  ok(greyShare > 0.02 && greyShare < 0.16, `grey surface share ${(greyShare * 100).toFixed(1)}% is a presence, not a plague (2–16%)`)
  for (const id of ['basin', 'shore', 'greyfield', 'crag', 'highland', 'woodland', 'meadow'] as BiomeId[])
    ok((seen.get(id) ?? 0) > 0, `${id} exists somewhere in a 1792-block country`)
  const alive = (seen.get('meadow') ?? 0) + (seen.get('woodland') ?? 0)
  ok(alive > (seen.get('greyfield') ?? 0) * 3, 'living country dwarfs the drained country')
}

// ── the fringe gutters: partially-drained ground is a MIX of grey and living surface ────────────
{
  // Walk until we find fringe ground (0 < greyness < 1), then check both surfaces appear in it.
  let found = false
  outer: for (let z = -6000; z < 6000; z += 160) {
    for (let x = -6000; x < 6000; x += 160) {
      const gy = greyness(x, z, SEED)
      if (gy > 0.25 && gy < 0.75) {
        let greyN = 0, liveN = 0
        for (let dz = 0; dz < 12; dz++) for (let dx = 0; dx < 12; dx++)
          (greySurfaceAt(x + dx, z + dz, SEED) ? greyN++ : liveN++)
        if (greyN > 0 && liveN > 0) { found = true; break outer }
      }
    }
  }
  ok(found, 'the grey fringe is dithered — drained and living surface interleave')
}

// ── the band actually reaches the terrain: a greyfield core column SURFACES grey ────────────────
{
  let checked = false
  outer: for (let z = -8000; z < 8000; z += 64) {
    for (let x = -8000; x < 8000; x += 64) {
      if (greyness(x, z, SEED) >= 1) {
        const h = columnHeight(x, z, SEED)
        if (h > SEA + DEFAULT_DEPTH.beachHeight) {
          const m = materialAt(x, h, z, SEED, h)
          ok(m === MAT.GREY_SOIL || m === MAT.STONE, `greyfield core surfaces grey soil (or cliff rock), got material ${m}`)
          checked = true
          break outer
        }
      }
    }
  }
  ok(checked, 'found a dry greyfield-core column to check')
}

// ── trees refuse drained ground for free (PLANTABLE is topsoil-only) ────────────────────────────
{
  // A fully-drained column's trunks never land: verify at the planter level — any start whose
  // ground is grey would be rejected by plantTrees, so what we assert is the SURFACE, not the roll.
  let cols = 0, grounded = 0
  for (let cz = -400; cz < 400 && cols < 40; cz++) {
    for (let cx = -400; cx < 400 && cols < 40; cx++) {
      const x = cx * 16 + 8, z = cz * 16 + 8
      if (greyness(x, z, SEED) < 1) continue
      const h = columnHeight(x, z, SEED)
      if (h <= SEA + DEFAULT_DEPTH.beachHeight) continue
      cols++
      if (materialAt(x, h, z, SEED, h) === MAT.TOPSOIL) grounded++
    }
  }
  ok(cols > 0 && grounded === 0, `no drained-core column surface is plantable topsoil (${grounded}/${cols})`)
}

// ── species follow the country: the same four trees, different woods ────────────────────────────
{
  ok(speciesFactor('starwillow', SEED, 0, 0) >= 0.3, 'speciesFactor returns a sane multiplier')
  // Find a low-ground column and an upland column, then compare willow leanings directly.
  let lowC: [number, number] | null = null, highC: [number, number] | null = null
  for (let cz = -300; cz < 300 && !(lowC && highC); cz += 3) {
    for (let cx = -300; cx < 300 && !(lowC && highC); cx += 3) {
      const f = speciesFactor('starwillow', SEED, cx, cz)
      if (f >= 3 && !lowC) lowC = [cx, cz]
      if (f <= 0.3 && !highC) highC = [cx, cz]
    }
  }
  ok(!!lowC, 'starwillow country (low ground) exists')
  ok(!!highC, 'starwillow-hostile country (uplands) exists')
  if (lowC && highC) {
    const count = (c: [number, number]) => {
      let willows = 0, total = 0
      for (let d = 0; d < 60; d++) {
        for (const t of treeStartsAt(SEED, c[0] + (d % 8), c[1] + ((d / 8) | 0), 16, DEFAULT_TREES)) {
          total++
          if (t.species.id === 'starwillow') willows++
        }
      }
      return { willows, total }
    }
    const lo = count(lowC), hi = count(highC)
    ok(lo.total === 0 || hi.total === 0 || (lo.willows / Math.max(1, lo.total)) > (hi.willows / Math.max(1, hi.total)),
      `willow share leans to low ground (low ${lo.willows}/${lo.total} vs upland ${hi.willows}/${hi.total})`)
  }
}

// ── woodland mask still answers through its new home ────────────────────────────────────────────
{
  const f = forestness(SEED, 12, -7)
  ok(f >= 0 && f <= 1, 'forestness stays in [0,1]')
  ok(forestness(SEED, 12.5, -7.25) >= 0, 'fractional column coords are legal (the labeler uses them)')
  ok(biomeAt(0, 0, SEED, columnHeight(0, 0, SEED), SEA, DEFAULT_BIOME) !== undefined, 'label at spawn exists')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the country has places — ${pass} passed. Now go LOOK at the map (scripts/terrain-profile.mts)`)
