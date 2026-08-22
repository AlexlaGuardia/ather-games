// What a load ring asks the flora renderer to draw, against its instance caps.
//
//   npx tsx scripts/flora-caps.mts [radius] [centreChunkX] [centreChunkZ]
//
// ★ WHY THIS EXISTS: `flora-mesh.ts` syncs instances into fixed-size pools and **stops quietly at
// the cap** — an overrun is a plant that exists in the voxel data, is breakable, and never draws.
// Indistinguishable from empty ground, so nobody finds it by playing. Found 2026-08-22 by Alex
// asking a plain question about instance counts: the herb pool ran to **199%** at radius 12 in
// woodland/basin/shore country, i.e. half the element herbs in the ring were invisible — and those
// four gate all four Infusions, hence all forty ruled second forms.
//
// ⚠⚠ IT IMPORTS `CAP` RATHER THAN KEEPING A COPY, AND THE FIRST VERSION DID KEEP ONE. Hub caught it
// within the hour: the moment the real pools were resized, this probe would have gone on printing
// `herb cap 4000` and calling a pool **199% over** that had just become 66% under — reporting the
// past with total confidence, about the exact number it had itself just corrected. **A probe that
// mirrors what it audits is the mirror shape pointed at an instrument**, and it is worse there than
// in a test, because a test at least fails when the world moves. This one would have kept passing.
//
// ⚠ AND IT REFUSES TO REPORT A VACUOUS ZERO. Centred on chunk 0,0 the first run printed a confident
// 0% of every cap — that coordinate is the fold's HOLLOW INTERIOR, and it has now eaten a merge-test
// fixture, a plot-vs-wilds afternoon and this probe, all on 2026-08-22. Beyond the all-zero guard it
// also names any pool the ring **cannot bound** (no supporting ground present), because a 0% that
// means "not measured here" reads exactly like a 0% that means "plenty of headroom".
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { biomeAt } from '../src/app/shimmer/voxel/biome'
import { DEFAULT_DEPTH, MAT } from '../src/app/shimmer/voxel/depth'
import { generatedAt } from '../src/app/shimmer/voxel/column'
import { isWildCrop, HERB_OF_GROUND, CROP_OF_GROUND } from '../src/app/shimmer/voxel/flora'
import { CAP } from '../src/app/shimmer/voxel3d/flora-mesh'

const SEED = 1337, S = 16
const R = Number(process.argv[2] ?? 12)
const CX = Number(process.argv[3] ?? 56), CZ = Number(process.argv[4] ?? 56)

const HERB = new Set(Object.values(HERB_OF_GROUND))
const kindOf = (m: number): keyof typeof CAP | null =>
  m === MAT.TUFT ? 'tuft' : m === MAT.TALL_GRASS ? 'tall' : m === MAT.FLOWER ? 'flower'
  : HERB.has(m) ? 'herb' : isWildCrop(m) ? 'crop'
  : m === MAT.LOOSE_ROCK ? 'rock' : m === MAT.DEADFALL ? 'log' : m === MAT.MUSHROOM ? 'shroom' : null

/** Which grounds can produce each pool at all — so a 0% can say WHY it is 0%. */
const SUPPORT: Partial<Record<keyof typeof CAP, string[]>> = {
  herb: Object.keys(HERB_OF_GROUND),
  crop: Object.keys(CROP_OF_GROUND),
}

const n: Record<string, number> = {}
const ground: Record<string, number> = {}
for (let gx = -R; gx <= R; gx++) for (let gz = -R; gz <= R; gz++) {
  const bx = (CX + gx) * S, bz = (CZ + gz) * S
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) {
    const wx = bx + x, wz = bz + z
    const h = columnHeight(wx, wz, SEED)
    ground[biomeAt(wx, wz, SEED, h, DEFAULT_DEPTH.seaLevel)] = (ground[biomeAt(wx, wz, SEED, h, DEFAULT_DEPTH.seaLevel)] ?? 0) + 1
    const k = kindOf(generatedAt(wx, h + 1, wz, SEED, h))
    if (k) n[k] = (n[k] ?? 0) + 1
  }
}
const cols = (2 * R + 1) ** 2
const gTotal = Object.values(ground).reduce((a, b) => a + b, 0)
const total = Object.values(n).reduce((a, b) => a + b, 0)

if (total === 0) {
  console.error(`MEASURED NOTHING at chunk ${CX},${CZ} — that is a probe in the void, not an empty world (chunk 0,0 is the fold's hollow interior). Pick real ground.`)
  process.exit(2)
}

console.log(`radius ${R} ring centred on chunk ${CX},${CZ} — ${cols.toLocaleString()} columns, seed ${SEED}\n`)
console.log('ground mix: ' + Object.entries(ground).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([g, c]) => `${g} ${((c / gTotal) * 100).toFixed(0)}%`).join(' · ') + '\n')
console.log('pool      wanted      cap    % of cap')
let over = 0, unbounded: string[] = []
for (const k of Object.keys(CAP) as (keyof typeof CAP)[]) {
  const c = n[k] ?? 0, cap = CAP[k], pct = (c / cap) * 100
  const sup = SUPPORT[k]
  const supported = !sup || sup.some(g => (ground[g] ?? 0) / gTotal > 0.01)
  if (c > cap) over++
  if (!supported) unbounded.push(k)
  console.log(`${k.padEnd(9)}${String(c).padStart(7)}${String(cap).padStart(9)}${pct.toFixed(0).padStart(9)}%`
    + (c > cap ? '   ⚠ OVER — the excess does not draw' : '')
    + (!supported ? `   ⚠ NOT BOUNDED HERE — no ${k} ground in this ring; this 0% means "not measured", not "safe"` : ''))
}
console.log(`\ntotal ${total.toLocaleString()} instances against ${Object.values(CAP).reduce((a, b) => a + b, 0).toLocaleString()} of capacity`
  + (over ? `  ·  ⚠ ${over} pool(s) OVER` : '  ·  no pool over')
  + (unbounded.length ? `  ·  ${unbounded.length} pool(s) unbounded by this ring` : ''))
if (over) process.exit(1)
