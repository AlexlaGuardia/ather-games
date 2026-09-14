// Flora oracle. Run: npx tsx src/app/shimmer/voxel/flora.test.ts
//
// The selection field's claims: healthy open country grows a real ground cover, flowers come in
// drifts (dense inside, absent outside), the Meadows are the flower country, the Thicket floor is
// sparse, greyfield cores grow NOTHING, and the whole thing is deterministic. Densities are build
// dials — the bounds here are wide enough to retune without touching the test.

import { floraAt, flowerForm, driftAt, FLORA, DRIFT_EDGE, DRIFT_CORE } from './flora'
import { greyness } from './biome'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

/** Count kinds over a square. */
function census(cx: number, cz: number, half: number, step = 1) {
  const n = { total: 0, tuft: 0, tall: 0, flower: 0 }
  for (let dz = -half; dz <= half; dz += step) for (let dx = -half; dx <= half; dx += step) {
    n.total++
    const f = floraAt(cx + dx, cz + dz, SEED)
    if (!f) continue
    if (f.kind === FLORA.TUFT) n.tuft++
    else if (f.kind === FLORA.TALL) n.tall++
    else if (f.kind === FLORA.FLOWER) n.flower++
  }
  return n
}

// ── 1. healthy wild country grows cover; the mix is sane ────────────────────────────────────────
{
  // Wild land south of the garden — outside every zone, mostly healthy.
  const n = census(300, 2600, 400, 2)
  const cover = (n.tuft + n.tall + n.flower) / n.total
  ok(cover > 0.08 && cover < 0.45, `wild ground carries cover (${(cover * 100).toFixed(1)}%)`)
  ok(n.tuft > n.tall * 2, `tufts are the filler, tall grass the accent (${n.tuft} vs ${n.tall})`)
}

// ── 2. flowers live in drifts — and a drift has a CORE (mats) and an EDGE (bushes) ────────────
{
  let core = 0, coreN = 0, edge = 0, edgeN = 0, outDrift = 0, outDriftN = 0
  let coreMats = 0, edgeBushes = 0, outSingles = 0
  for (let dz = -400; dz <= 400; dz += 2) for (let dx = -400; dx <= 400; dx += 2) {
    const x = 300 + dx, z = 2600 + dz
    if (greyness(x, z, SEED) > 0.05) continue
    const d = driftAt(x, z, SEED)
    const f = floraAt(x, z, SEED)
    const isFlower = f?.kind === FLORA.FLOWER ? 1 : 0
    const form = isFlower ? flowerForm(x, z, SEED) : 0
    if (d > DRIFT_CORE) { core += isFlower; coreN++; if (form === FLORA.BLOOM_MAT) coreMats++ }
    else if (d > DRIFT_EDGE) { edge += isFlower; edgeN++; if (form === FLORA.BLOOM_BUSH) edgeBushes++ }
    else { outDrift += isFlower; outDriftN++; if (form === FLORA.FLOWER) outSingles++ }
  }
  ok(coreN > 200 && edgeN > 200, `the sample actually crosses drifts (${coreN} core, ${edgeN} edge cells)`)
  // A mat covers its cell, so a core at a quarter of cells reads as a carpet; stems needed more.
  ok(core / coreN > 0.2, `drift cores are carpeted (${((core / coreN) * 100).toFixed(1)}%)`)
  ok(edge / edgeN > 0.01 && edge / edgeN < core / coreN, `drift edges are sparser than cores (${((edge / edgeN) * 100).toFixed(1)}%)`)
  // ★ SINGLES (2026-09-14): a lone wildflower may grow ANYWHERE green now — that is the third
  // form — but it is the rare one. Under 2% of open cells, or the drift stopped being a place.
  ok(outDrift > 0, `singles exist outside drifts (${outDrift} in ${outDriftN})`)
  ok(outDrift / outDriftN < 0.02, `and they are rare (${((outDrift / outDriftN) * 100).toFixed(2)}%)`)
  // The form follows the field: every core flower is a mat, every edge flower a bush, every
  // open-ground flower a single (mist can promote open ground to mat, so that one is ≥, not ==).
  ok(coreMats === core, `every core flower is a mat (${coreMats}/${core})`)
  ok(edgeBushes === edge, `every edge flower is a bush (${edgeBushes}/${edge})`)
  ok(outSingles >= outDrift * 0.8, `open-ground flowers are singles (${outSingles}/${outDrift})`)
}

// ── 3. zone character: Meadows bloom, the Thicket floor is dim and sparse ───────────────────────
{
  const meadow = census(-2150, 700, 350, 2)
  const thicket = census(-2000, -1150, 350, 2)
  const wild = census(300, 2600, 350, 2)
  const cov = (n: ReturnType<typeof census>) => (n.tuft + n.tall + n.flower) / n.total
  ok(cov(meadow) > cov(wild) * 1.3, `the Meadows are the flower country (${(cov(meadow) * 100).toFixed(1)}% vs wild ${(cov(wild) * 100).toFixed(1)}%)`)
  ok(cov(thicket) < cov(wild) * 0.6, `the Thicket floor is sparse (${(cov(thicket) * 100).toFixed(1)}%)`)
}

// ── 4. drained ground grows nothing ─────────────────────────────────────────────────────────────
{
  let onGrey = 0, greyN = 0
  for (let dz = -1200; dz <= 1200; dz += 6) for (let dx = -1200; dx <= 1200; dx += 6) {
    const x = 800 + dx, z = 4200 + dz            // the rim country, where grey is fed
    if (greyness(x, z, SEED) < 0.9) continue
    greyN++
    if (floraAt(x, z, SEED)) onGrey++
  }
  ok(greyN > 200, `the sample found greyfield core (${greyN} cells)`)
  ok(onGrey === 0, `greyfield core grows nothing (${onGrey}/${greyN})`)
}

// ── 5. deterministic ────────────────────────────────────────────────────────────────────────────
{
  const a = floraAt(123, -456, SEED), b = floraAt(123, -456, SEED)
  ok(JSON.stringify(a) === JSON.stringify(b), 'same coordinate, same answer, forever')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the ground cover grows where life is — ${pass} passed`)
