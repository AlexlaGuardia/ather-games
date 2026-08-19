// Column-generation cost — the number the character layer could plausibly move.
import { fillColumn, DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { surfaceBlockAt, landCharacter, landWeights } from '../src/app/shimmer/voxel/character'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const out = new Uint16Array(256)
const time = (fn: () => void, iters: number) => {
  for (let i = 0; i < iters / 4; i++) fn()          // warm
  const t0 = performance.now()
  for (let i = 0; i < iters; i++) fn()
  return (performance.now() - t0) / iters
}
// one 16x16 column, full height — what a chunk builder actually does
const N = 200
const col = () => {
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++)
    fillColumn(out, 0, 1, 900 + x, 900 + z, 0, 256, SEED)
}
console.log(`\nfull 16x16x256 column:      ${time(col, N).toFixed(2)} ms`)

const DRESS = landCharacter({
  topsoil: MAT.TOPSOIL, loam: MAT.FOREST_LOAM, lush: MAT.LUSH_TURF, mud: MAT.MARSH_MUD,
  dry: MAT.DRY_GRASS, highland: MAT.HIGHLAND_TURF, scree: MAT.SCREE,
  subsoil: MAT.SUBSOIL, stone: MAT.STONE,
})
const surf = () => { for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) surfaceBlockAt(900 + x, 900 + z, SEED, DRESS) }
const hgt = () => { for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) columnHeight(900 + x, 900 + z, SEED) }
const wts = () => { for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) landWeights(900 + x, 900 + z, SEED) }
console.log(`  of which 256x columnHeight: ${time(hgt, N * 20).toFixed(3)} ms`)
console.log(`  of which 256x surfaceBlock: ${time(surf, N * 20).toFixed(3)} ms`)
console.log(`     (256x landWeights alone: ${time(wts, N * 20).toFixed(3)} ms)\n`)
