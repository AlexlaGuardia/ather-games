// Flora oracle. Run: npx tsx src/app/shimmer/voxel/flora.test.ts
//
// The selection field's claims: healthy open country grows a real ground cover, flowers come in
// drifts (dense inside, absent outside), the Meadows are the flower country, the Thicket floor is
// sparse, greyfield cores grow NOTHING, and the whole thing is deterministic. Densities are build
// dials — the bounds here are wide enough to retune without touching the test.

import { floraAt, FLORA, DRIFT_SCALE, DRIFT_EDGE } from './flora'
import { value2 } from './noise'
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

// ── 2. flowers live in drifts ───────────────────────────────────────────────────────────────────
{
  let inDrift = 0, inDriftN = 0, outDrift = 0, outDriftN = 0
  for (let dz = -400; dz <= 400; dz += 2) for (let dx = -400; dx <= 400; dx += 2) {
    const x = 300 + dx, z = 2600 + dz
    if (greyness(x, z, SEED) > 0.05) continue
    const drifty = value2(x / DRIFT_SCALE, z / DRIFT_SCALE, SEED ^ 0xd21f7) > DRIFT_EDGE
    const f = floraAt(x, z, SEED)
    const isFlower = f?.kind === FLORA.FLOWER ? 1 : 0
    if (drifty) { inDrift += isFlower; inDriftN++ } else { outDrift += isFlower; outDriftN++ }
  }
  ok(inDriftN > 500, `the sample actually crosses drifts (${inDriftN} drift cells)`)
  ok(inDrift / inDriftN > 0.15, `drifts are dense with flowers (${((inDrift / inDriftN) * 100).toFixed(1)}%)`)
  ok(outDrift === 0, `no flowers outside a drift (${outDrift} strays in ${outDriftN})`)
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
