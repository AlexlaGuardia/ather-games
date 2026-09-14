// The sloped water sheet is drawn IN the block its water occupies. Run: npx tsx src/app/shimmer/voxel/water-sheet-band.test.ts
//
// ── ★ THE FLOATING POND (Alex, 2026-09-14, near -3551 / 304) ──────────────────────────────────
// A pond hung ~17 blocks above its bed. The cells were right — `waterSurfaceAt` drops a body to
// its lowest shore bank when the water table sits above the banks — but `buildWaterSurface`
// handed the mesher the RAW table at every corner, and there the table (a 480-block mean) is 18
// blocks over the basin. Measured on the real seed: water top cell 100, sheet vertices at 118.
//
// This oracle meshes the REAL columns on the REAL seed and asserts, for every water top-face
// vertex, that it lies within one block of the plane of the water cells it sits over. It then
// meshes two columns that share an edge independently and asserts the shared corners agree —
// the clamp reads cell tops, and if either sharing column read a different set the sheet would
// crack at every column seam. Mutation (restore the raw table): §1 fires.
import { Column, generateColumn, meshColumn, SECTION, DEFAULT_COLUMN, type Neighbours } from './column'
import { MAT } from './depth'
import { WORLD_SEED as S } from '../voxel3d/world-seed'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const cache = new Map<string, Column>()
const gen = (x: number, z: number) => {
  const k = `${x},${z}`; let c = cache.get(k)
  if (!c) { c = generateColumn(new Column(x, z, DEFAULT_COLUMN), S); cache.set(k, c) }
  return c
}
const ring = (wx: number, wz: number): Neighbours => ({
  negX: gen(wx - SECTION, wz), posX: gen(wx + SECTION, wz), negZ: gen(wx, wz - SECTION), posZ: gen(wx, wz + SECTION),
  negXnegZ: gen(wx - SECTION, wz - SECTION), negXposZ: gen(wx - SECTION, wz + SECTION),
  posXnegZ: gen(wx + SECTION, wz - SECTION), posXposZ: gen(wx + SECTION, wz + SECTION),
})
/** Highest water cell per (x,z) in a column, world y, or -1. */
const waterTop = (col: Column): Int32Array => {
  const top = new Int32Array(SECTION * SECTION).fill(-1)
  for (let i = col.sections.length - 1; i >= 0; i--) {
    const u = col.uniform[i]
    if (u !== -1 && u !== MAT.WATER) continue
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      if (top[z * SECTION + x] >= 0) continue
      if (u === MAT.WATER) { top[z * SECTION + x] = (i + 1) * SECTION - 1; continue }
      for (let y = SECTION - 1; y >= 0; y--) if (col.sections[i].get(x, y, z) === MAT.WATER) { top[z * SECTION + x] = i * SECTION + y; break }
    }
  }
  return top
}
/** Water top-face vertices of a meshed column: world (x, y, z) per vertex. */
const sheetVerts = (col: Column, n: Neighbours): Array<[number, number, number]> => {
  const out: Array<[number, number, number]> = []
  for (const sm of meshColumn(col, n)) {
    const m = sm.mesh
    for (let v = 0; v < m.materials.length; v++) {
      if (m.materials[v] !== MAT.WATER || m.normals[v * 3 + 1] < 0.5) continue
      out.push([m.positions[v * 3] + sm.wx, m.positions[v * 3 + 1] + sm.wy, m.positions[v * 3 + 2] + sm.wz])
    }
  }
  return out
}

// ── §1 the pond Alex found, and its neighbourhood: no sheet vertex more than a block off its cells
{
  const cx0 = Math.floor(-3551 / SECTION) * SECTION, cz0 = Math.floor(304 / SECTION) * SECTION
  let waterCols = 0, verts = 0, worst = 0, worstAt = ''
  for (let dz = -6; dz <= 2; dz++) for (let dx = -4; dx <= 4; dx++) {
    const wx = cx0 + dx * SECTION, wz = cz0 + dz * SECTION
    const col = gen(wx, wz), top = waterTop(col)
    if (!top.some(t => t >= 0)) continue
    waterCols++
    for (const [x, y, z] of sheetVerts(col, ring(wx, wz))) {
      verts++
      // The plane of the cells this vertex sits over: a lattice corner touches up to four cells.
      let hi = -1
      for (let tz = -1; tz <= 0; tz++) for (let tx = -1; tx <= 0; tx++) {
        const lx = Math.round(x) - wx + tx, lz = Math.round(z) - wz + tz
        if (lx < 0 || lx >= SECTION || lz < 0 || lz >= SECTION) continue
        hi = Math.max(hi, top[lz * SECTION + lx] + 1)
      }
      if (hi < 0) continue
      const off = y - hi
      if (Math.abs(off) > Math.abs(worst)) { worst = off; worstAt = `${x},${z} plane ${hi} vertex ${y.toFixed(2)}` }
    }
  }
  ok(waterCols >= 8, `§1 the neighbourhood holds water (${waterCols} columns)`)
  ok(verts > 100, `§1 the sheet has vertices to judge (${verts})`)
  ok(worst <= 0.001 && worst >= -1.001, `§1 every sheet vertex lies within [plane − 1, plane] of its water cells — worst ${worst.toFixed(2)} at ${worstAt} (was +17: the floating pond)`)
}

// ── §2 two columns sharing an edge agree on every shared corner (the clamp cannot crack a seam)
{
  const wx = -3552, wz = 240
  const a = sheetVerts(gen(wx, wz), ring(wx, wz)), b = sheetVerts(gen(wx + SECTION, wz), ring(wx + SECTION, wz))
  const seam = wx + SECTION
  const ya = new Map<number, number>(), yb = new Map<number, number>()
  for (const [x, y, z] of a) if (Math.abs(x - seam) < 1e-6) ya.set(Math.round(z * 1000), y)
  for (const [x, y, z] of b) if (Math.abs(x - seam) < 1e-6) yb.set(Math.round(z * 1000), y)
  let shared = 0, cracks = 0
  for (const [k, y] of ya) { const y2 = yb.get(k); if (y2 === undefined) continue; shared++; if (Math.abs(y - y2) > 1e-4) cracks++ }
  ok(shared >= 4, `§2 the two columns share seam vertices (${shared})`)
  ok(cracks === 0, `§2 no crack along the seam — ${cracks} of ${shared} shared corners disagree`)
}

console.log(`water sheet band: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
