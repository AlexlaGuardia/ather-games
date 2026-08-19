// Quick profile of the character layer's land + ground distribution. Throwaway measurement tool.
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { materialAt, MAT, DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth'
import { landWeights, dominantLand, landRollAt, LAND_IDS } from '../src/app/shimmer/voxel/character'

const SEED = 1337
const R = Number(process.argv[2] ?? 1600)
const STEP = 4
const NAME: Record<number, string> = {}
for (const [k, v] of Object.entries(MAT)) NAME[v as number] = k

const land: Record<string, number> = {}
const dom: Record<string, number> = {}
const surf: Record<number, number> = {}
let n = 0
for (let z = -R; z <= R; z += STEP) for (let x = -R; x <= R; x += STEP) {
  const h = columnHeight(x, z, SEED)
  const m = materialAt(x, h, z, SEED, h)
  surf[m] = (surf[m] || 0) + 1
  n++
  if (h <= DEFAULT_DEPTH.seaLevel + DEFAULT_DEPTH.beachHeight) continue
  const d = dominantLand(landWeights(x, z, SEED)).id
  dom[d] = (dom[d] || 0) + 1
  const r = landRollAt(x, z, SEED)
  land[r] = (land[r] || 0) + 1
}
const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(1)}%`
const dt = Object.values(dom).reduce((a, b) => a + b, 0)
console.log(`\n=== ${2 * R}x${2 * R} around spawn, seed ${SEED}, ${n} columns ===`)
console.log('\nDOMINANT LAND (dry columns):')
for (const id of LAND_IDS) console.log(`  ${id.padEnd(10)} ${pct(dom[id] || 0, dt).padStart(6)}   rolled ${pct(land[id] || 0, dt).padStart(6)}`)
console.log('\nSURFACE BLOCK (all columns):')
for (const [m, c] of Object.entries(surf).sort((a, b) => b[1] - a[1]))
  console.log(`  ${(NAME[+m] ?? m).padEnd(14)} ${pct(c, n).padStart(6)}`)
