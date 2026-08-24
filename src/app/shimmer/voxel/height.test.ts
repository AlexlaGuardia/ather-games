// Terrain height oracle. Run: npx tsx src/app/shimmer/voxel/height.test.ts
//
// ⚠ GREEN HERE IS NOT ENOUGH, AND THAT IS THE POINT OF THIS COMMENT. The 2D generator's 27 asserts
// were all green over a map of ruler-straight 5-wide highways — "connected" and "crossable" were
// both true and the map was still wrong. Terrain is judged by LOOKING at it. These asserts exist to
// catch the things an eye cannot check (determinism across engines, clamping, the datum not quietly
// lying) — not to certify that the world reads well.

import {
  columnHeight, heightFields, peaksValleys, DEFAULT_HEIGHT,
  CONTINENT_SPLINE, EROSION_SPLINE,
} from './height'
import { spline, fbm2, warped2, hash2 } from './noise'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number, m: string) =>
  ok(Math.abs(a - b) <= tol, `${m} (got ${a.toFixed(2)}, want ${b}±${tol})`)

const SEED = 1337
const C = DEFAULT_HEIGHT

// ── 1. determinism — the property the whole chunk pipeline rests on ──────────────────────────
// Canon calls the Wilds persistent. A generator that drifts moves the world under saved positions,
// and it also breaks the TS-vs-Rust diff that makes "portable" a test rather than a promise.
{
  for (let i = 0; i < 500; i++) {
    const x = (i * 733) % 5000 - 2500, z = (i * 1279) % 5000 - 2500
    if (columnHeight(x, z, SEED) !== columnHeight(x, z, SEED)) { fails.push(`nondeterministic at ${x},${z}`); break }
  }
  pass++
  ok(hash2(12, 34, 7) === hash2(12, 34, 7), 'hash is stable')
  ok(hash2(12, 34, 7) !== hash2(12, 34, 8), 'seed changes the hash')
  // Order-independence: a column must not care what was generated before it.
  const a = columnHeight(100, 100, SEED)
  columnHeight(-9999, 4242, SEED); columnHeight(7, 7, SEED)
  ok(columnHeight(100, 100, SEED) === a, 'a column is independent of generation order')
}

// ── 2. different seeds are different worlds ──────────────────────────────────────────────────
{
  let same = 0
  for (let i = 0; i < 400; i++) {
    const x = i * 13, z = i * 29
    if (columnHeight(x, z, 1) === columnHeight(x, z, 2)) same++
  }
  ok(same < 200, `seeds 1 and 2 produce different terrain (${same}/400 columns matched)`)
}

// ── 3. clamping — nothing may reach the cloud floor or the ceiling ───────────────────────────────────
{
  let lo = 0, hi = 0
  for (let i = 0; i < 40000; i++) {
    const h = columnHeight((i * 977) % 9000 - 4500, (i * 1583) % 9000 - 4500, SEED)
    if (h < 1) lo++
    if (h > C.worldHeight - 2) hi++
  }
  ok(lo === 0, `no column below y=1 (the cloud floor stays reachable) — ${lo} violations`)
  ok(hi === 0, `no column at the world ceiling — ${hi} violations`)
}

// ── 4. ★ the datum must MEAN average ground level ────────────────────────────────────────────
// DATUM_CALIBRATION is a measured constant. Untested, it rots the first time a spline is retuned
// and the doc quietly starts lying about where the ground is.
{
  const hs: number[] = []
  for (let i = 0; i < 40000; i++) hs.push(columnHeight((i * 977) % 4000 - 2000, (i * 1583) % 4000 - 2000, SEED))
  hs.sort((a, b) => a - b)
  const median = hs[Math.floor(hs.length / 2)]
  near(median, C.datum, 4, '★ median ground level sits on the datum')

  // ── ⚠⚠ THE ASSERT THAT STOOD HERE COULD NOT FAIL, AND REMOVING IT IS THE HONEST FIX ─────────
  // It read `ok(DATUM_CALIBRATION !== 0, 'the calibration constant is applied')` — and note the
  // import went with it, because a constant a file only mentions in prose is not a dependency.
  // was inside the tolerated tsc baseline for weeks: TS2367, *"types '0.5' and '0' have no
  // overlap"* — the constant is literal-typed, so the comparison is decided at compile time and
  // the assert is a `true` wearing a sentence.
  //
  // ★ AND WIDENING THE TYPE TO SILENCE TS WOULD HAVE BEEN THE CHEAPEST LIE. The comparison would
  // then be legal and STILL never fail, because the thing it guards cannot be varied from a test:
  // `DATUM_CALIBRATION` is a module constant, not a `HeightConfig` field, deliberately (it is a
  // property of the splines, not of the seed).
  //
  // ★★ WORSE, AND THIS IS THE ACTUAL FINDING: NO ASSERT OVER HEIGHTS CAN SEE IT AT ITS CURRENT
  // VALUE. Calibration is 0.5 and `columnHeight` returns ROUNDED integers, so zeroing it moves the
  // median by less than one voxel — measured across four seeds, the median does not move at all.
  // The constant has been re-measured down (10 → 3.5 → 0.5) as the splines improved, and it has
  // shrunk below the resolution of the world it corrects. The guard did not rot; the thing it
  // guards became too small to guard. Say that in the file rather than keep a green tick that
  // means nothing.
  //
  // What IS load-bearing is the claim above — the median sits on the datum — and the doc's own
  // words say it is *"a property of the splines, not of the seed"*, so it is asserted across seeds
  // now instead of on one. THAT is what a bad re-measure breaks, and it fires at the scale that
  // actually matters (mutation-tested: calibration at 10 trips it on every seed).
  for (const s2 of [7, 42, 555]) {
    const h2: number[] = []
    for (let i = 0; i < 20000; i++) h2.push(columnHeight((i * 977) % 4000 - 2000, (i * 1583) % 4000 - 2000, s2))
    h2.sort((a, b) => a - b)
    near(h2[h2.length >> 1], C.datum, 4, `★ median ground sits on the datum for seed ${s2} too`)
  }

  // Character checks — loose bounds, because this is taste, not correctness. They exist to catch a
  // retune that accidentally flattens the world or turns it into spikes, not to pin the look.
  // Upper bound loosened 0.92 → 0.98 with the plains pass: flattening a third of the country
  // toward benches concentrates ground near the datum BY DESIGN (Alex asked for it). What the
  // bound still catches is a world with no vertical life at all — see also the range assert below.
  const within = hs.filter(h => Math.abs(h - C.datum) <= 25).length / hs.length
  // 0.98 → 0.995 with worldgen v2: the tended zones concentrate MORE country near the datum by
  // design. The range assert below still requires real mountains somewhere.
  ok(within > 0.55 && within < 0.995, `most country is near the datum but not all of it (${(within * 100).toFixed(0)}%)`)
  ok(hs[hs.length - 1] - hs[0] > 80, `the world has real vertical range (${hs[hs.length - 1] - hs[0]} voxels)`)
}

// ── 5. continuity — terrain, not noise ───────────────────────────────────────────────────────
// A heightfield that jumps every column is a spike field. Bounded adjacent steps are what make it
// country you can walk. Checked on BOTH axes: an x-only check passed a generator that was smooth
// along one axis and shredded along the other.
{
  let big = 0, tot = 0, maxStep = 0
  for (let i = 0; i < 20000; i++) {
    const x = (i * 137) % 4000 - 2000, z = (i * 283) % 4000 - 2000
    const h = columnHeight(x, z, SEED)
    for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
      const d = Math.abs(h - columnHeight(x + dx, z + dz, SEED))
      tot++; if (d > 2) big++
      if (d > maxStep) maxStep = d
    }
  }
  ok(big / tot < 0.10, `adjacent columns rarely jump more than 2 (${(100 * big / tot).toFixed(2)}%)`)
  // 18, was 12: the land-around-water model cuts GORGES where a river crosses high country, and a
  // gorge wall is a legitimate sheer face (it shows cliff stone). What this still catches is a
  // spike field — noise-scale garbage, not landform-scale drama.
  ok(maxStep <= 18, `no adjacent column is a sheer cliff (max step ${maxStep})`)
}

// ── 6. ★ height must not be a function of a biome id ─────────────────────────────────────────
// Structurally guaranteed — there is no biome parameter — so this asserts the STRUCTURE instead of
// the behaviour: the height function's inputs are exactly (x, z, seed, cfg).
{
  // Function.length counts only parameters BEFORE the first defaulted one, so (x, z, seed) is 3 —
  // `cfg` is defaulted and invisible here. The assertion that matters is that the count is 3 and
  // not 4: a fourth required parameter would be something new being threaded in, and a biome id is
  // exactly the thing that would arrive that way.
  ok(columnHeight.length === 3, 'columnHeight takes (x, z, seed) plus an optional config — no biome input exists')
  const f = heightFields(500, 500, SEED)
  ok(['continentalness', 'erosion', 'weirdness'].every(k => k in f), 'the three continuous fields are exposed for biome to reuse')
  ok(f.continentalness >= 0 && f.continentalness <= 1, 'continentalness normalised')
  ok(f.weirdness >= -1 && f.weirdness <= 1, 'weirdness is signed')
}

// ── 7. peaks-and-valleys: PV = 1 − |3|w| − 2| ────────────────────────────────────────────────
{
  near(peaksValleys(0), -1, 1e-9, 'PV(0) is a trough')
  near(peaksValleys(2 / 3), 1, 1e-9, 'PV(±2/3) is a ridge crest')
  near(peaksValleys(-2 / 3), 1, 1e-9, 'PV is symmetric in sign')
  near(peaksValleys(1), 0, 1e-9, 'PV(±1) is neutral')
  let lo = 0
  for (let i = 0; i <= 1000; i++) { const v = peaksValleys(-1 + i / 500); if (v < -1.0001 || v > 1.0001) lo++ }
  ok(lo === 0, 'PV stays within [-1,1]')
}

// ── 8. spline sanity ─────────────────────────────────────────────────────────────────────────
{
  ok(spline(CONTINENT_SPLINE, -5) === CONTINENT_SPLINE[0].val, 'spline clamps below its domain')
  ok(spline(CONTINENT_SPLINE, 5) === CONTINENT_SPLINE[CONTINENT_SPLINE.length - 1].val, 'spline clamps above its domain')
  // Monotone increasing: more continental must never mean lower ground, or coastlines invert.
  let prev = -Infinity, bad = 0
  for (let i = 0; i <= 200; i++) { const v = spline(CONTINENT_SPLINE, i / 200); if (v < prev - 1e-9) bad++; prev = v }
  ok(bad === 0, 'the continent spline is monotone — more continental is never lower')
  // Erosion must be monotone DECREASING: more worn is never more jagged.
  prev = Infinity; bad = 0
  for (let i = 0; i <= 200; i++) { const v = spline(EROSION_SPLINE, i / 200); if (v > prev + 1e-9) bad++; prev = v }
  ok(bad === 0, 'the erosion spline is monotone decreasing — more worn is never more jagged')
}

// ── 9. noise is in range and actually varies ─────────────────────────────────────────────────
{
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < 5000; i++) { const v = fbm2(i * 0.37, i * 0.71, SEED); mn = Math.min(mn, v); mx = Math.max(mx, v) }
  ok(mn >= 0 && mx <= 1, `fbm stays in [0,1] (${mn.toFixed(3)}..${mx.toFixed(3)})`)
  ok(mx - mn > 0.35, 'fbm actually varies')
  // The warp must change the field, or the domain-warp call is decorative.
  let diff = 0
  for (let i = 0; i < 300; i++) { const x = i * 0.3, z = i * 0.7
    if (Math.abs(warped2(x, z, SEED) - fbm2(x, z, SEED)) > 1e-6) diff++ }
  ok(diff > 250, 'domain warping actually displaces the field')
}

// ── 10. ★ structure pads exist — the plains pass's whole claim ───────────────────────────────
// A pad = a 12×12 window spanning ≤1 voxel: ground a building sits on without looking sloppy and
// fragmented (Alex, 2026-08-07). Before the plains field this measured 1.0%. The window lesson
// applies: measure over ≥1200 units of country or the sample fits inside one flatness feature and
// the number is noise about a single blob.
{
  const N = 1200, S = 3
  const hs = new Int16Array((N / S) * (N / S))
  const W = N / S
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) hs[z * W + x] = columnHeight(x * S - N / 2, z * S - N / 2, SEED)
  // Sampled at stride 3, a 4×4 sample block covers a 12×12 window: span ≤1 on the samples is a
  // slightly loose read of the true pad, fine for a share-level assert.
  let hit = 0, tot = 0
  for (let z = 0; z + 4 < W; z += 2) for (let x = 0; x + 4 < W; x += 2) {
    let mn = 32767, mx = -32768
    for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) {
      const v = hs[(z + dz) * W + x + dx]; if (v < mn) mn = v; if (v > mx) mx = v
    }
    tot++; if (mx - mn <= 1) hit++
  }
  const share = hit / tot
  ok(share > 0.04, `structure pads are a real feature of the country (${(share * 100).toFixed(1)}% of 12×12 windows ≈ level)`)
  ok(share < 0.5, `...but the world is not a parking lot (${(share * 100).toFixed(1)}%)`)
}

console.log(`\nterrain height: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the heightfield is sound — now go LOOK at it (scripts/terrain-profile)')
