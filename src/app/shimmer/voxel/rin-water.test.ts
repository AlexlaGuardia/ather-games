// The rinning-water oracle. Run: npx tsx src/app/shimmer/voxel/rin-water.test.ts
//
// This file guards a PLACEMENT rule, and placement rules fail in a way play does not show: a
// fishing spot in the wrong water still looks like a fishing spot. Two specific failures it exists
// to catch, both of which have already happened once each in this codebase to something else:
//
//   1. ★ SPECKLE. A per-column roll scatters single castable cells and reads as static on the water
//      — the same failure that rendered the marsh as a lino floor on 2026-08-19, where every assert
//      measured HOW MUCH accent and none measured WHAT SHAPE. §3 measures shape, in run lengths.
//   2. ★ DRIFT. Placement written against ground MATERIAL is silently re-decided by the next ground
//      dressing pass. §4 holds the rule that this file reads the river field and not the ground.
//
// ⚠ FIXTURES ARE ANCHORED AWAY FROM (0,0) ON PURPOSE. The fold has grown over the origin — the home
// plot covers it entirely now — so a probe anchored there measures plot geometry while claiming to
// measure terrain, and it fails by CRASHING rather than by asserting, which reads as a broken test
// rather than a broken world (slump.test.ts, same day). Sample far out in open country.

import { rinSpotAt, rinKindAt, isWaterColumn, livelyAt, RIN_NONE, RIN_POND, RIN_STREAM, RIN_LAKE, SPOT_SCALE, LIVELY_EDGE } from './rin-water'
import { columnHeight, riverCarve, waterSurfaceAt, RIVER_DEPTH } from './height'
import { DEFAULT_DEPTH } from './depth'

const SEED = 1337
const FAR = 4096          // open country, well clear of the fold at the origin
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. THE GATE IS HONEST — every spot is on water, and water is the only thing it admits ───────
{
  let spots = 0, drySpots = 0, kindMismatch = 0, waterCols = 0
  for (let i = 0; i < 60000; i++) {
    const x = FAR + (i * 37) % 900, z = FAR + Math.floor(i / 900) * 7
    if (isWaterColumn(x, z, SEED)) waterCols++
    const s = rinSpotAt(x, z, SEED)
    if (!s) continue
    spots++
    if (!isWaterColumn(x, z, SEED)) drySpots++
    if (s.kind !== rinKindAt(x, z, SEED)) kindMismatch++
  }
  ok(spots > 50, `found rinning spots to check (${spots})`)
  ok(drySpots === 0, `★ no rinning spot on dry land (${drySpots})`)
  ok(spots === waterCols, `★★ ALL water is castable — depletion paces rinning, not spot rarity (${spots}/${waterCols})`)
  ok(kindMismatch === 0, `spot kind always agrees with rinKindAt (${kindMismatch})`)
}

// ── 2. THE THREE KINDS ARE REACHABLE, AND EACH IS THE WATER IT CLAIMS ───────────────────────────
{
  const seen = new Set<number>()
  let lakeAboveSea = 0, pondTooShallow = 0, streamNotCarved = 0
  for (let i = 0; i < 200000; i++) {
    const x = FAR + (i * 53) % 2000, z = FAR + Math.floor(i / 2000) * 11
    const k = rinKindAt(x, z, SEED)
    if (k === RIN_NONE) continue
    seen.add(k)
    const h = columnHeight(x, z, SEED)
    if (k === RIN_LAKE && h > DEFAULT_DEPTH.seaLevel) lakeAboveSea++
    if (k === RIN_POND && riverCarve(x, z, SEED) < RIVER_DEPTH) pondTooShallow++
    if (k === RIN_STREAM && riverCarve(x, z, SEED) < 1) streamNotCarved++
  }
  // A lake needs a basin in the sample; if the sampled country has none this is vacuous, so it is
  // asserted as "at least the two river kinds", with the lake checked only where one occurs.
  ok(seen.has(RIN_POND) && seen.has(RIN_STREAM), `pond and stream both occur (${[...seen].join(',')})`)
  ok(lakeAboveSea === 0, `★ every lake spot is genuinely below sea level (${lakeAboveSea})`)
  ok(pondTooShallow === 0, `★ every pond spot is genuinely full-depth channel (${pondTooShallow})`)
  ok(streamNotCarved === 0, `every stream spot is genuinely in a channel (${streamNotCarved})`)
}

// ── 3. ★★ LIVELINESS IS A PLACE, NOT A SPECKLE — the assert that measures SHAPE, not amount ─────
// The failure this catches: a per-column roll. Its tell is a mean run length near 1 — the chessboard
// stated as a number rather than as an adjective. Walk scanlines through water and measure how long
// liveliness stays on once it starts. A field-driven answer runs for many blocks; a per-column roll
// cannot exceed ~1/(1-p) by construction.
//
// ⚠ THIS ASSERT OUTLIVED THE THING IT WAS WRITTEN FOR, ON PURPOSE. It first guarded a castability
// gate; that gate is gone (all water is castable now, depletion paces instead). The shape rule was
// never really about the gate — it is about rise-marks reading as a stretch of living water rather
// than as static on the surface — so it moved to the field that kept the job.
{
  let runs = 0, runBlocks = 0, longest = 0
  for (let row = 0; row < 400; row++) {
    const z = FAR + row * 13
    let run = 0
    for (let x = FAR; x < FAR + 1200; x++) {
      const wet = isWaterColumn(x, z, SEED)
      const on = wet && livelyAt(x, z, SEED)
      if (on) { run++ }
      else if (run > 0) { runs++; runBlocks += run; longest = Math.max(longest, run); run = 0 }
    }
    if (run > 0) { runs++; runBlocks += run; longest = Math.max(longest, run) }
  }
  const mean = runs ? runBlocks / runs : 0
  ok(runs > 20, `found lively runs to measure (${runs})`)
  ok(mean > 6, `★★ liveliness is a PLACE — mean run ${mean.toFixed(2)} blocks (a per-column roll gives ~1)`)
  ok(longest > 20, `★ some stretch of water is a real living bank (longest run ${longest})`)
}

// ── 4. ★★ PLACEMENT DOES NOT READ THE GROUND — the anti-drift rule, held as source ──────────────
// The rule is architectural, so it is asserted against the source rather than against behaviour:
// a material test cannot be caught by sampling, because it agrees with the field test right up
// until someone re-dresses the ground. TURF is named explicitly — it answers "can a plant stand
// here", MARSH_MUD is deliberately outside it, and a marsh is prime rinning water that grows
// nothing at all. The two predicates disagree there on purpose.
{
  const src = require('fs').readFileSync('src/app/shimmer/voxel/rin-water.ts', 'utf8')
  const code = src.split('\n').filter((l: string) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
  ok(!/\bTURF\b/.test(code), '★★ placement never consults TURF (it answers a different question)')
  ok(!/MAT\.(TOPSOIL|MARSH_MUD|SAND|LUSH_TURF)/.test(code), '★★ placement never tests a ground material')
  ok(/riverCarve|riverField/.test(code), 'placement asks the river field, which cannot drift')
}

// ── 5. DETERMINISM + THE SURFACE IS THE WATER TABLE'S, NEVER GUESSED ────────────────────────────
{
  let wrongSurface = 0, unstable = 0, checked = 0
  for (let i = 0; i < 40000; i++) {
    const x = FAR + (i * 41) % 700, z = FAR + Math.floor(i / 700) * 9
    const a = rinSpotAt(x, z, SEED)
    if (!a) continue
    checked++
    if (a.surfaceY !== waterSurfaceAt(x, z, SEED)) wrongSurface++
    const b = rinSpotAt(x, z, SEED)
    if (b?.variant !== a.variant || b?.kind !== a.kind || b?.lively !== a.lively) unstable++
  }
  ok(checked > 30, `spots to check for surface + determinism (${checked})`)
  ok(wrongSurface === 0, `★ surfaceY is the water table's answer, never a guess (${wrongSurface})`)
  ok(unstable === 0, `pure — same column, same answer (${unstable})`)
}

// ── 6. QUIET WATER IS STILL FISHABLE, AND BOTH KINDS OF WATER EXIST ─────────────────────────────
// ★ The rule that keeps the gate from growing back: a spot must be returned for lively AND quiet
// water alike. If someone ever re-couples castability to the field, this goes red.
{
  ok(LIVELY_EDGE > 0 && LIVELY_EDGE < 1, `LIVELY_EDGE is a real threshold (${LIVELY_EDGE})`)
  ok(SPOT_SCALE > 90, `★ lively regions are coarser than a flower drift (${SPOT_SCALE} > 90)`)
  let quietFishable = 0, livelyFishable = 0
  for (let i = 0; i < 120000; i++) {
    const x = FAR + (i * 29) % 1500, z = FAR + Math.floor(i / 1500) * 7
    const s = rinSpotAt(x, z, SEED)
    if (!s) continue
    if (s.lively) livelyFishable++; else quietFishable++
  }
  ok(quietFishable > 100, `★★ QUIET water is fishable water (${quietFishable} quiet spots)`)
  ok(livelyFishable > 100, `lively water exists too (${livelyFishable})`)
}

console.log(fails.length ? `❌ ${fails.length} failed:\n  ${fails.join('\n  ')}` : `✅ the water knows where it can be fished — ${pass} passed`)
process.exit(fails.length ? 1 : 0)
