// Throwaway (2026-08-21): does the per-vertex water depth disagree ALONG a shared edge?
//
// water-depth.test.ts compares depths at IDENTICAL vertex positions and passes. That only proves
// C0 continuity at shared CORNERS. Greedy merging makes long quads, and a long quad's edge runs
// straight past the corners of the smaller quads beside it — a T-junction. Along that edge the big
// quad interpolates linearly between corners many cells apart, while its neighbour reads the true
// value at its own corner. They agree at the endpoints and can disagree everywhere between, which
// draws as a visible patch boundary exactly where the merge boundary is.
import { Column, generateColumn, meshColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const OX = Number(process.argv[2] ?? 9), OZ = Number(process.argv[3] ?? -30), R = 2
const ABSORB = 0.505
const alpha = (d: number) => (d < 0 ? 0.78 : 1 - Math.exp(-ABSORB * d))

const cols = new Map<string, Column>()
const key = (cx: number, cz: number) => `${cx},${cz}`
for (let cz = -R - 1; cz <= R + 1; cz++) for (let cx = -R - 1; cx <= R + 1; cx++)
  cols.set(key(cx, cz), generateColumn(new Column((OX + cx) * SECTION, (OZ + cz) * SECTION), SEED))

type V = { x: number; z: number; d: number }
const quads: V[][] = []
const vertAt = new Map<string, number>()   // "x,z" -> depth, for corners that are real vertices

for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
  const n = (dx: number, dz: number) => cols.get(key(cx + dx, cz + dz)) ?? null
  for (const sm of meshColumn(cols.get(key(cx, cz))!, {
    negX: n(-1, 0), posX: n(1, 0), negZ: n(0, -1), posZ: n(0, 1),
    negXnegZ: n(-1, -1), posXnegZ: n(1, -1), negXposZ: n(-1, 1), posXposZ: n(1, 1),
  })) {
    const m = sm.mesh
    for (let q = 0; q < m.quads; q++) {
      if (m.materials[q * 4] !== MAT.WATER) continue
      if (m.normals[q * 12 + 1] < 0.5) continue            // surface quads only
      const vs: V[] = []
      for (let k = 0; k < 4; k++) {
        const x = sm.wx + m.positions[q * 12 + k * 3]
        const z = sm.wz + m.positions[q * 12 + k * 3 + 2]
        const d = m.waterDepth[q * 4 + k]
        vs.push({ x, z, d })
        vertAt.set(`${x},${z}`, d)
      }
      quads.push(vs)
    }
  }
}

// For each quad edge, walk the integer lattice points strictly inside it. If such a point is a real
// vertex somewhere else, compare this quad's linear interpolation against that vertex's own depth.
let edges = 0, tj = 0, worstD = 0, worstA = 0, worstAt = ''
for (const vs of quads) {
  for (let e = 0; e < 4; e++) {
    const a = vs[e], b = vs[(e + 1) % 4]
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.max(Math.abs(dx), Math.abs(dz))
    if (len <= 1) continue                                  // no interior lattice point
    edges++
    for (let s = 1; s < len; s++) {
      const t = s / len
      const px = a.x + dx * t, pz = a.z + dz * t
      const own = vertAt.get(`${px},${pz}`)
      if (own === undefined) continue                       // nobody else has a vertex here
      tj++
      const interp = a.d + (b.d - a.d) * t
      const dd = Math.abs(interp - own)
      const da = Math.abs(alpha(interp) - alpha(own))
      if (da > worstA) { worstA = da; worstD = dd; worstAt = `${px},${pz}` }
    }
  }
}
console.log(`\n=== water surface T-junctions, seed ${SEED}, origin col ${OX},${OZ} ===`)
console.log(`surface quads          ${quads.length}`)
console.log(`edges longer than 1    ${edges}`)
console.log(`T-junction points      ${tj}`)
console.log(`worst depth mismatch   ${worstD.toFixed(3)} blocks`)
console.log(`worst ALPHA mismatch   ${worstA.toFixed(4)}   at ${worstAt}`)
// What would it COST to stop merging water surface quads? Count the cells they cover.
let cells = 0, maxRun = 0
for (const vs of quads) {
  const xs = vs.map(v => v.x), zs = vs.map(v => v.z)
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs)
  cells += Math.max(1, w) * Math.max(1, h)
  maxRun = Math.max(maxRun, w, h)
}
console.log(`\nmerge ratio            ${quads.length} quads cover ${cells} cells (${(cells / quads.length).toFixed(2)}x), longest run ${maxRun}`)
console.log(tj === 0 ? '\n(no T-junctions in this sample — inconclusive, try another origin)'
  : worstA < 0.01 ? '\n✅ edges agree' : '\n❌ EDGES DISAGREE — merged quads band the surface')
