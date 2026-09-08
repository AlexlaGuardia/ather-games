// ── Does the shipped render-light field black out a forest floor at noon? ──────────────────────
//
// `render-light.ts` decides opacity with `isSolid`. `light.ts` (the spawn field) decides it with
// "not AIR, not WATER, not a leaf". ⚠⚠ THOSE TWO RULES ARE INVERTED ON THE TWO CATEGORIES THAT
// MATTER: `SOLID_EXCEPT` is derived from `isPlant`/`isSapling`, so render-light lets light through
// grass and flowers and STOPS it at leaves, while the spawn field does the exact opposite.
//
// Neither is obviously wrong on its own. The consequence is: with leaves fully opaque and light
// reaching 15 blocks, a forest interior more than fifteen blocks from a canopy edge can only be lit
// from the side, so it lands at the shader's floor — a BLACK FOREST FLOOR AT NOON, on the surface,
// which is the one place this feature was supposed to leave untouched.
//
// This asks the generator in the same coordinates rather than photographing it, because the browser
// can only show the ring after it warms and the answer is wanted before that.
//
// Run: npx tsx scripts/canopy-light.mts
import { makeColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { isSolid, MAT } from '../src/app/shimmer/voxel/depth'
import { isLeafMat } from '../src/app/shimmer/voxel/trees'
import { computeRenderLight, li, MAX_LIGHT } from '../src/app/shimmer/voxel/render-light'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { newLightRing, recenterRing, nextDirtyColumn, incomingFor, publishSpill } from '../src/app/shimmer/voxel/render-light-ring'

const SEED = 1337
// Moonwell Glade's neighbourhood — the wooded ground a keeper actually spawns into.
const CX = Math.floor(-150 / SECTION), CZ = Math.floor(-640 / SECTION)

const cols = new Map<string, ReturnType<typeof makeColumn>>()
const colAt = (cx: number, cz: number) => {
  const k = `${cx},${cz}`
  let c = cols.get(k)
  if (!c) { c = makeColumn(cx * SECTION, cz * SECTION, SEED); cols.set(k, c) }
  return c
}
const matAt = (x: number, y: number, z: number): number => {
  if (y < 0 || y >= 256) return 0
  const cx = Math.floor(x / SECTION), cz = Math.floor(z / SECTION)
  return colAt(cx, cz).get(x - cx * SECTION, y, z - cz * SECTION)
}

// Settle a small ring so borders are real — a lone column reads its neighbours as dark and would
// exaggerate exactly the effect being measured.
const ring = newLightRing()
recenterRing(ring, CX, CZ)
const fields = new Map<string, ReturnType<typeof computeRenderLight>>()
let passes = 0
// ⚠ THE COLUMNS ARE GENERATED FIRST AND SEPARATELY. Timing the settle loop with generation inside
// it would measure terrain noise and call it lighting — the exact mistake the 09-08 bench made.
for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) colAt(CX + dx, CZ + dz)
let lightMs = 0
for (;;) {
  const c = nextDirtyColumn(ring)
  if (!c || ++passes > 2000) break
  const t0 = performance.now()
  const f = computeRenderLight(c.cx * SECTION, c.cz * SECTION, matAt, incomingFor(ring, c.cx, c.cz))
  lightMs += performance.now() - t0
  publishSpill(ring, c.cx, c.cz, f.spill)
  fields.set(`${c.cx},${c.cz}`, f)
}
console.log(`settled in ${passes} passes over ${ring.cols.size} columns`)
console.log(`light: ${lightMs.toFixed(0)}ms total, ${(lightMs / passes).toFixed(1)}ms per pass`)

// Walk the standing surface of the middle 3x3 and bucket the sky level one block above the ground.
const hist = new Map<number, number>()
let underCanopy = 0, canopyDark = 0, open = 0
for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
  const f = fields.get(`${CX + dx},${CZ + dz}`)
  if (!f) continue
  const col = colAt(CX + dx, CZ + dz)
  for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
    const wx = col.wx + lx, wz = col.wz + lz
    const h = columnHeight(wx, wz, SEED)
    const y = h + 1
    if (y >= 256) continue
    const sky = f.sky[li(lx, y, lz)]
    hist.set(sky, (hist.get(sky) ?? 0) + 1)
    // Is there a leaf anywhere above this spot?
    let leafAbove = false
    for (let yy = y + 1; yy < Math.min(256, y + 40); yy++) if (isLeafMat(matAt(wx, yy, wz))) { leafAbove = true; break }
    if (leafAbove) { underCanopy++; if (sky <= 3) canopyDark++ } else { open++ }
  }
}
console.log(`\nstanding cells: ${open} open sky, ${underCanopy} under a canopy`)
console.log(`under a canopy and sky <= 3 (i.e. near the shader floor): ${canopyDark}` +
  (underCanopy ? ` — ${(100 * canopyDark / underCanopy).toFixed(1)}% of canopied ground` : ''))
console.log('\nsky level one block above the generated surface:')
for (const lvl of [...hist.keys()].sort((a, b) => b - a)) {
  const n = hist.get(lvl)!
  console.log(`  ${String(lvl).padStart(2)}  ${String(n).padStart(5)}  ${'#'.repeat(Math.round(60 * n / (open + underCanopy)))}`)
}
const full = hist.get(MAX_LIGHT) ?? 0
const total = [...hist.values()].reduce((a, b) => a + b, 0)
console.log(`\n★ ${((100 * full) / total).toFixed(1)}% of standing ground is at FULL sky — the rest is darkened by this change.`)

// ── ⚠⚠ THE REAL QUESTION THE HISTOGRAM ABOVE RAISES ───────────────────────────────────────────
// 100% of standing ground at full sky, with 149 canopied cells in the sample, cannot be explained
// by leaves being transparent. So: what does the field think is INSIDE a tree?
{
  const f = fields.get(`${CX},${CZ}`)!
  const col = colAt(CX, CZ)
  let trunkCells = 0, trunkLit = 0, leafCells = 0, leafLit = 0
  for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
    const wx = col.wx + lx, wz = col.wz + lz
    const h = columnHeight(wx, wz, SEED)
    for (let y = h + 1; y < Math.min(256, h + 40); y++) {
      const m = matAt(wx, y, wz)
      if (m === 0) continue
      const lit = f.sky[li(lx, y, lz)]
      if (isLeafMat(m)) { leafCells++; if (lit === MAX_LIGHT) leafLit++ }
      else if (isSolid(m)) { trunkCells++; if (lit === MAX_LIGHT) trunkLit++ }
    }
  }
  console.log(`\nABOVE the generated surface, inside real geometry:`)
  console.log(`  solid (trunk/structure) cells: ${trunkCells}, of which the field calls FULLY LIT: ${trunkLit}`)
  console.log(`  leaf cells:                    ${leafCells}, of which the field calls FULLY LIT: ${leafLit}`)
  console.log(`\n★ If those are 100%, the seed pass writes sky 15 into every cell above the heightmap`)
  console.log(`  WITHOUT LOOKING AT THE MATERIAL — so nothing built or grown above the terrain`)
  console.log(`  surface can ever cast shade, a sealed player-built room included.`)
}
