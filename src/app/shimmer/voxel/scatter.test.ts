// Scatter oracle. Run: npx tsx src/app/shimmer/voxel/scatter.test.ts
//
// ── ★★ THE ONE ASSERT THIS FILE EXISTS FOR IS A SHAPE ASSERT, NOT A COUNT ──────────────────────
// The character layer shipped a marsh that looked like a lino floor with 225 green asserts behind
// it, because every one of them measured *how much* and none measured *what shape*. Scatter has
// exactly the same exposure and it is concentrated in one kind: a fallen log placed per-cell is a
// floating pebble that passes every density bound in this file.
//
// So §3 measures MEAN MAX RUN — the chessboard stated as a number. A per-cell roll scores ~1.0-1.3
// no matter how the density is tuned; a log has to score near its own length. The control is run
// against the SAME density so the two cannot be confused for a tuning difference. Everything else
// here is ordinary bounds work; that section is the one that would have caught the bug.
//
// Second thing worth knowing: §2 derives the dial ceilings from the table rather than trusting the
// constants. A dial raised above its ceiling is silently CLIPPED by the cheap gate — the number in
// the table stops being the number in the world and nothing errors.

import {
  SCATTER, SCATTER_DRESS, scatterAt, scatterCharacterAt,
  ROCK_DENSITY, DEADFALL_DENSITY, MUSHROOM_DENSITY,
  MAX_ROCK_K, MAX_DEADFALL_K, MAX_MUSHROOM_K,
  DEADFALL_MIN_LEN, DEADFALL_MAX_LEN, DEADFALL_MEAN_LEN,
  CLUMP_SCALE, CLUMP_EDGE, CLUMP_OUTSIDE, OPEN_SHADE, SCATTER_CEIL_GATE, clumpAt, type ScatterDials,
} from './scatter'
import { LAND_IDS, landMix, dominantLand, type LandId } from './character'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
// ⚠ BLOCK BODY, NOT A CHAINED EXPRESSION ARROW, AND IT COST TWO ATTEMPTS. Both
// `: (() => ScatterDials) => …` and `(): ScatterDials => ({…})` nested inside an outer arrow parse
// as FUNCTION TYPES in tsc, which then swallows the object literal as a type. The tell is
// `TS1003: Identifier expected` pointing at a perfectly ordinary `0`.
// ★ AND `npx tsx` RAN ALL THREE VERSIONS HAPPILY — esbuild strips types, it does not check them.
// A green test run is not a typecheck; `npx tsc --noEmit` is the instrument for that question.
const only = (d: Partial<ScatterDials>) => {
  const full: ScatterDials = { rockK: 0, deadfallK: 0, mushroomK: 0, ...d }
  return () => full
}

// ── 1. determinism, and it answers to the seed ──────────────────────────────────────────────────
{
  const dials = only({ rockK: 2, deadfallK: 2, mushroomK: 2 })
  const a = scatterAt(731, -412, SEED, dials)
  const b = scatterAt(731, -412, SEED, dials)
  ok(JSON.stringify(a) === JSON.stringify(b), 'scatterAt is deterministic')

  let differs = 0
  for (let i = 0; i < 4000; i++) {
    const x = 900 + i, z = -300 + (i % 37)
    const p = scatterAt(x, z, SEED, dials)?.kind ?? 0
    const q = scatterAt(x, z, SEED + 1, dials)?.kind ?? 0
    if (p !== q) differs++
  }
  ok(differs > 0, 'scatter answers to the seed')

  // A variant that never moves is a renderer that draws every stone identically.
  const vs = new Set<number>()
  for (let i = 0; i < 20000 && vs.size < 5; i++) {
    const s = scatterAt(2000 + i, 500, SEED, dials)
    if (s) vs.add(s.variant)
  }
  ok(vs.size >= 5, 'spots carry distinct variants')
}

// ── 2. the ceilings track the table (a clipped dial is a silent tuning lie) ──────────────────────
{
  const maxOf = (pick: (d: ScatterDials) => number): number =>
    Math.max(...LAND_IDS.map(id => pick(SCATTER_DRESS[id])))
  ok(maxOf(d => d.rockK) === MAX_ROCK_K, `MAX_ROCK_K tracks the table (${maxOf(d => d.rockK)} vs ${MAX_ROCK_K})`)
  ok(maxOf(d => d.deadfallK) === MAX_DEADFALL_K, `MAX_DEADFALL_K tracks the table (${maxOf(d => d.deadfallK)} vs ${MAX_DEADFALL_K})`)
  ok(maxOf(d => d.mushroomK) === MAX_MUSHROOM_K, `MAX_MUSHROOM_K tracks the table (${maxOf(d => d.mushroomK)} vs ${MAX_MUSHROOM_K})`)

  // Every land is present and finite — a missing key is a land that silently sheds nothing.
  ok(LAND_IDS.every(id => {
    const d = SCATTER_DRESS[id]
    return d && [d.rockK, d.deadfallK, d.mushroomK].every(v => Number.isFinite(v) && v >= 0)
  }), 'every land has finite non-negative dials')
}

// ── 3. ★★ SHAPE: A LOG IS A RUN, A STONE IS NOT ────────────────────────────────────────────────
// Mean MAX run — for each occupied cell, the longer of its X-run and its Z-run, averaged. An
// axis-aligned log scores near its length whichever way it lies; a per-cell roll cannot.
{
  const N = 420
  const field = (dials: () => ScatterDials, kind: number): boolean[][] => {
    const g: boolean[][] = []
    for (let ix = 0; ix < N; ix++) {
      const row: boolean[] = []
      for (let iz = 0; iz < N; iz++) row.push(scatterAt(6000 + ix, 6000 + iz, SEED, dials)?.kind === kind)
      g.push(row)
    }
    return g
  }
  const meanMaxRun = (g: boolean[][]): { mean: number; cells: number } => {
    let total = 0, cells = 0
    const runThrough = (get: (k: number) => boolean, at: number, len: number): number => {
      let lo = at; while (lo > 0 && get(lo - 1)) lo--
      let hi = at; while (hi < len - 1 && get(hi + 1)) hi++
      return hi - lo + 1
    }
    for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
      if (!g[ix][iz]) continue
      const rx = runThrough(k => g[k][iz], ix, N)
      const rz = runThrough(k => g[ix][k], iz, N)
      total += Math.max(rx, rz); cells++
    }
    return { mean: cells ? total / cells : 0, cells }
  }

  const logs = meanMaxRun(field(only({ deadfallK: MAX_DEADFALL_K }), SCATTER.DEADFALL))
  // The control: a per-cell kind tuned to the SAME coverage, so the only difference is the
  // mechanism. Rock at the density deadfall actually achieves.
  const equivRockK = (DEADFALL_DENSITY * MAX_DEADFALL_K) / ROCK_DENSITY
  const pebbles = meanMaxRun(field(only({ rockK: equivRockK }), SCATTER.ROCK))

  ok(logs.cells > 400, `deadfall actually places (${logs.cells} cells in ${N}x${N})`)
  ok(pebbles.cells > 400, `the per-cell control places comparably (${pebbles.cells} cells)`)
  ok(pebbles.mean < 1.45, `★ control confirms a per-cell roll scores ~1 (${pebbles.mean.toFixed(2)})`)
  ok(logs.mean > DEADFALL_MIN_LEN * 0.75,
    `★★ a fallen log is a RUN, not a pebble (mean max run ${logs.mean.toFixed(2)}, min len ${DEADFALL_MIN_LEN})`)
  ok(logs.mean > pebbles.mean * 2,
    `★★ logs and pebbles are different SHAPES at the same density (${logs.mean.toFixed(2)} vs ${pebbles.mean.toFixed(2)})`)
  ok(logs.mean < DEADFALL_MAX_LEN * 1.6,
    `logs do not fuse into hedgerows (${logs.mean.toFixed(2)} vs max len ${DEADFALL_MAX_LEN})`)

  // And the other two must NOT be runs — their real grain is one cell, and a stone that came out
  // in rows would be the accent chessboard wearing a new name.
  const stones = meanMaxRun(field(only({ rockK: MAX_ROCK_K }), SCATTER.ROCK))
  ok(stones.mean < 1.5, `★ a stone stays a single block (${stones.mean.toFixed(2)})`)
}

// ── 4. the cheap gate does not clip: measured coverage tracks the tuned number ──────────────────
// If the gate were tighter than the ladder, the lands the table says carry the most would quietly
// carry less — the exact failure the gate's own comment warns about.
{
  const N = 300
  const cover = (dials: () => ScatterDials, kind: number): number => {
    let n = 0
    for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
      if (scatterAt(-4000 + ix, 2200 + iz, SEED, dials)?.kind === kind) n++
    }
    return n / (N * N)
  }
  // Rock is the clean one to measure: no shade, no clump, no life term.
  // ★ THE STRUCTURAL ASSERT, and it is the one that bites. The gate must DOMINATE the ladder's own
  // maximum; anything less clips. A coverage measurement cannot stand in for this — a gate tightened
  // by half moved rock coverage only 18%, which sat inside the tolerance and the mutation SURVIVED.
  const ladderMax = ROCK_DENSITY * MAX_ROCK_K + MUSHROOM_DENSITY * MAX_MUSHROOM_K
  ok(SCATTER_CEIL_GATE >= ladderMax,
    `★★ the cheap gate dominates the ladder — nothing is silently clipped (${SCATTER_CEIL_GATE} >= ${ladderMax})`)

  const got = cover(only({ rockK: MAX_ROCK_K }), SCATTER.ROCK)
  const want = ROCK_DENSITY * MAX_ROCK_K
  ok(got > want * 0.90 && got < want * 1.10,
    `★ rock coverage at the ceiling dial is not clipped by the gate (${(got * 100).toFixed(2)}% vs ${(want * 100).toFixed(2)}%)`)

  // Halving the dial must halve the coverage — proves the dial is live, not decorative.
  const half = cover(only({ rockK: MAX_ROCK_K / 2 }), SCATTER.ROCK)
  ok(half > got * 0.38 && half < got * 0.62, `★ the dial is linear (${(half / got).toFixed(2)}x at half)`)

  // A zero dial means none at all, not "a few" — the crag's whole character rests on this.
  ok(cover(only({ rockK: 0 }), SCATTER.ROCK) === 0, '★ a zero dial sheds nothing whatsoever')
  ok(cover(only({ deadfallK: 0 }), SCATTER.DEADFALL) === 0, '★ deadfallK 0 places no logs at all')
}

// ── 5. mushrooms clump, stones do not ──────────────────────────────────────────────────────────
// ★★ THIS SECTION IS REWRITTEN AROUND A MUTATION THAT SURVIVED THE FIRST ONE. The obvious test —
// spatial dispersion of mushrooms vs a kind that does not clump — passes with the clump field
// REPLACED BY A PER-CELL HASH, because mushrooms also multiply shade and life, and canopy alone
// overdisperses them enough to satisfy it. That test measured the forest and called it fungus.
//
// So bucket cells by the clump field ITSELF and compare density inside against outside. That ratio
// is the mechanism's own number (1 / CLUMP_OUTSIDE) and nothing else in the pipeline can fake it.
{
  const N = 420
  let inside = 0, insideN = 0, outside = 0, outsideN = 0
  const dials = only({ mushroomK: MAX_MUSHROOM_K })
  for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
    const x = 1200 + ix, z = -5000 + iz
    const hit = scatterAt(x, z, SEED, dials)?.kind === SCATTER.MUSHROOM
    if (clumpAt(x, z, SEED) > CLUMP_EDGE) { insideN++; if (hit) inside++ }
    else { outsideN++; if (hit) outside++ }
  }
  ok(insideN > 2000 && outsideN > 2000, `both sides of the clump edge are sampled (${insideN} in / ${outsideN} out)`)
  const dIn = inside / insideN, dOut = outside / outsideN
  const ratio = dOut > 0 ? dIn / dOut : Infinity
  const wantRatio = 1 / CLUMP_OUTSIDE
  ok(ratio > wantRatio * 0.5,
    `★★ mushrooms are dense INSIDE a clump and sparse outside (${ratio.toFixed(1)}x, mechanism says ${wantRatio.toFixed(1)}x)`)
  // ★ AND THE LONE MUSHROOM SURVIVES. `CLUMP_OUTSIDE` is not zero on purpose — a hard edge would
  // put a contour around every patch, which is the one thing this whole layer of the world refuses.
  ok(dOut > 0, '★ a lone mushroom still comes up outside a clump — the patch has no hard edge')

  // Stones must NOT respond to the mushroom field at all. If they did, the clump would be a global
  // "more scatter here" field rather than a mycelium, and every kind would pool in the same places.
  let rIn = 0, rInN = 0, rOut = 0, rOutN = 0
  const rd = only({ rockK: MAX_ROCK_K })
  for (let ix = 0; ix < N; ix++) for (let iz = 0; iz < N; iz++) {
    const x = 1200 + ix, z = -5000 + iz
    const hit = scatterAt(x, z, SEED, rd)?.kind === SCATTER.ROCK
    if (clumpAt(x, z, SEED) > CLUMP_EDGE) { rInN++; if (hit) rIn++ }
    else { rOutN++; if (hit) rOut++ }
  }
  const rRatio = (rIn / rInN) / (rOut / rOutN)
  ok(rRatio > 0.85 && rRatio < 1.18,
    `★★ stones ignore the mycelium — the clump is a mushroom cause, not a scatter field (${rRatio.toFixed(2)}x)`)

  // ★★ AND THE FIELD ITSELF MUST BE A PLACE, NOT SPECKLE — a second mutation caught this gap.
  // The ratio assert above buckets by `clumpAt` AND is multiplied by `clumpAt`, so it passes even
  // when the field is replaced by a per-cell hash: the two halves simply agree with each other
  // about noise. Autocorrelation is the claim that a clump is a PATCH you can walk into — cells
  // one apart must resemble each other far more than cells a clump-width apart.
  const meanStep = (d: number): number => {
    let t = 0
    const M = 4000
    for (let i = 0; i < M; i++) {
      const x = 1200 + i, z = -5000 + (i % 53)
      t += Math.abs(clumpAt(x + d, z, SEED) - clumpAt(x, z, SEED))
    }
    return t / M
  }
  const near = meanStep(1), far = meanStep(CLUMP_SCALE)
  ok(near < far * 0.5,
    `★★ a clump is a PLACE, not speckle (neighbour delta ${near.toFixed(3)} vs ${far.toFixed(3)} a clump-width away)`)
}

// ── 6. the blend is a ramp, not a step ─────────────────────────────────────────────────────────
// The sibling law's continuous half. A density that BLENDS has a gradient that shrinks as the
// sample spacing shrinks; a density rolled per land would jump the same amount at any spacing.
// ⚠ This asserts the SCALING, not a threshold — a sharper blend is still a ramp, and a fixed
// |delta| bound went red on exactly that mistake during slice ②.
{
  const walk = (step: number): number => {
    let worst = 0
    let prev = scatterCharacterAt(-2000, 3000, SEED).rockK
    for (let i = 1; i <= 220; i++) {
      const v = scatterCharacterAt(-2000 + i * step, 3000, SEED).rockK
      worst = Math.max(worst, Math.abs(v - prev))
      prev = v
    }
    return worst
  }
  const coarse = walk(8), fine = walk(1)
  ok(fine < coarse * 0.7, `★★ the dials blend — the gradient scales with spacing (${fine.toFixed(3)} @1 vs ${coarse.toFixed(3)} @8)`)
  ok(coarse > 0.01, `the walk actually crosses country (max step ${coarse.toFixed(3)})`)
}

// ── 7. every land gets its own character, deep inside itself ───────────────────────────────────
// Same shape as character.test.ts §: find a column each land genuinely dominates and check the
// blended dials arrive near that land's own row rather than the world's average.
{
  const found = new Map<LandId, { x: number; z: number; t: number }>()
  for (let z = -3200; z <= 3200 && found.size < LAND_IDS.length; z += 40) {
    for (let x = -3200; x <= 3200; x += 40) {
      const { id, t } = dominantLand(landMix(x, z, SEED))
      const cur = found.get(id)
      if (!cur || t > cur.t) found.set(id, { x, z, t })
    }
  }
  for (const id of LAND_IDS) {
    const site = found.get(id)
    if (!site || site.t < 0.55) continue   // some lands never dominate strongly; §6 covers the blend
    const want = SCATTER_DRESS[id]
    const got = scatterCharacterAt(site.x, site.z, SEED)
    ok(got.rockK > want.rockK * 0.6 - 0.05 && got.rockK < want.rockK * 1.5 + 0.25,
      `★ ${id} deep inside itself gets its own stones (${got.rockK.toFixed(2)} vs ${want.rockK})`)
    ok(got.mushroomK > want.mushroomK * 0.6 - 0.05 && got.mushroomK < want.mushroomK * 1.5 + 0.35,
      `★ ${id} gets its own mushrooms (${got.mushroomK.toFixed(2)} vs ${want.mushroomK})`)
  }

  // The two statements the table makes loudest, checked as ORDER rather than as absolute numbers —
  // ordering survives retuning, a magic constant does not.
  const rank = (pick: (d: ScatterDials) => number): LandId[] =>
    [...LAND_IDS].sort((a, b) => pick(SCATTER_DRESS[b]) - pick(SCATTER_DRESS[a]))
  ok(rank(d => d.rockK)[0] === 'crag', '★ crag is the stoniest country in the table')
  ok(rank(d => d.deadfallK)[0] === 'deepwood', '★ deepwood sheds the most wood')
  ok(rank(d => d.mushroomK)[0] === 'deepwood', '★ deepwood carries the most fungus')
  ok(SCATTER_DRESS.crag.deadfallK === 0 && SCATTER_DRESS.crag.mushroomK === 0,
    '★★ a crag sheds no wood and grows no fungus — nothing stands on it and nothing lives on it')
}

// ── 8. the log's own numbers ───────────────────────────────────────────────────────────────────
{
  ok(DEADFALL_MIN_LEN >= 2, 'a log is at least two cells — a one-cell log is the pebble by definition')
  ok(DEADFALL_MAX_LEN >= DEADFALL_MIN_LEN, 'the length band is not inverted')
  ok(DEADFALL_MEAN_LEN === (DEADFALL_MIN_LEN + DEADFALL_MAX_LEN) / 2,
    'the anchor-rate divisor is the real mean length — otherwise coverage drifts from the tuned density')
  ok(OPEN_SHADE > 0 && OPEN_SHADE < 1,
    '★ the shade floor is open — a hard canopy cut would put a dead contour at every forest edge')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the ground carries what it sheds — ${pass} passed. Now go LOOK at it (:3200 /shimmer)`)
