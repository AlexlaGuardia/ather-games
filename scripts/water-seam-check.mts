// Throwaway measurement (2026-08-21): does the per-vertex water depth AGREE across a column seam?
//
// The whole design rests on one claim — a lattice corner's depth is a pure function of world
// position, so two columns sharing it compute the identical number. That claim is why `Neighbours`
// grew diagonals. It is cheap to assert and expensive to assume, so this measures it on real
// terrain: mesh every column with its full 8-neighbourhood, collect every water vertex by WORLD
// position, and report the worst disagreement — in blocks of depth AND in the alpha it would draw.
import { Column, generateColumn, meshColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const R = Number(process.argv[2] ?? 6)
const ORIGIN_X = Number(process.argv[3] ?? 0)
const ORIGIN_Z = Number(process.argv[4] ?? 0)
const ABSORB = 0.505
// `--no-diag` withholds the diagonal columns — the mutation this probe exists to catch. If the
// numbers do not move when the diagonals go away, the probe cannot see the property it asserts.
const NO_DIAG = process.argv.includes('--no-diag')
const alpha = (d: number) => (d < 0 ? 0.78 : 1 - Math.exp(-ABSORB * d))

const cols = new Map<string, Column>()
const key = (cx: number, cz: number) => `${cx},${cz}`
for (let cz = -R - 1; cz <= R + 1; cz++) for (let cx = -R - 1; cx <= R + 1; cx++)
  cols.set(key(cx, cz), generateColumn(new Column((ORIGIN_X + cx) * SECTION, (ORIGIN_Z + cz) * SECTION), SEED))

// world "x,y,z" -> depths seen there, one per meshing column
const seen = new Map<string, { d: number; from: string }[]>()
let waterVerts = 0
for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
  const c = cols.get(key(cx, cz))!
  const n = (dx: number, dz: number) => cols.get(key(cx + dx, cz + dz)) ?? null
  const sections = meshColumn(c, {
    negX: n(-1, 0), posX: n(1, 0), negZ: n(0, -1), posZ: n(0, 1),
    ...(NO_DIAG ? {} : { negXnegZ: n(-1, -1), posXnegZ: n(1, -1), negXposZ: n(-1, 1), posXposZ: n(1, 1) }),
  })
  for (const sm of sections) {
    const m = sm.mesh
    for (let v = 0; v < m.materials.length; v++) {
      if (m.materials[v] !== MAT.WATER) continue
      waterVerts++
      const wx = sm.wx + m.positions[v * 3]
      const wy = sm.wy + m.positions[v * 3 + 1]
      const wz = sm.wz + m.positions[v * 3 + 2]
      const k = `${wx.toFixed(3)},${wy.toFixed(3)},${wz.toFixed(3)}`
      const arr = seen.get(k) ?? []
      arr.push({ d: m.waterDepth[v], from: key(cx, cz) })
      seen.set(k, arr)
    }
  }
}

let shared = 0, disagree = 0, worstD = 0, worstA = 0, worstKey = ''
for (const [k, arr] of seen) {
  const froms = new Set(arr.map(a => a.from))
  if (froms.size < 2) continue          // only one column ever meshed this point
  shared++
  const ds = arr.map(a => a.d)
  const spread = Math.max(...ds) - Math.min(...ds)
  const aSpread = Math.max(...ds.map(alpha)) - Math.min(...ds.map(alpha))
  if (spread > 1e-6) {
    disagree++
    if (aSpread > worstA) { worstA = aSpread; worstD = spread; worstKey = k }
  }
}
console.log(`\n=== water depth across column seams, seed ${SEED}, ${(2 * R + 1) ** 2} columns meshed ===`)
console.log(`water vertices           ${waterVerts}`)
console.log(`distinct world points    ${seen.size}`)
console.log(`points meshed by 2+ cols ${shared}`)
console.log(`  of those, DISAGREEING  ${disagree}  (${shared ? ((disagree / shared) * 100).toFixed(3) : '0'}%)`)
console.log(`worst depth spread       ${worstD.toFixed(4)} blocks`)
console.log(`worst ALPHA spread       ${worstA.toFixed(4)}   ${worstKey}`)
// Depth VARIETY at the shared points: agreement is meaningless if every shared corner is the same
// number. A control has to be verified, not named.
const sharedDepths = new Set<string>()
for (const [, arr] of seen) if (new Set(arr.map(a => a.from)).size >= 2) for (const a of arr) sharedDepths.add(a.d.toFixed(2))
console.log(`distinct depths at seams ${sharedDepths.size}  [${[...sharedDepths].sort((a, b) => +a - +b).join(' ')}]`)
if (NO_DIAG) console.log('   ^ run WITHOUT diagonals (mutation)')
// ⚠ A PROBE THAT SAMPLED NOTHING MUST NOT REPORT SUCCESS. The first run of this script printed a
// green tick over ZERO water vertices, because spawn is dry (only 20 of 2401 columns near origin
// hold water at all). An empty sample is the failure mode that looks exactly like a pass.
if (waterVerts === 0 || shared === 0) {
  console.log(`\n❌ NOTHING MEASURED — ${waterVerts} water vertices, ${shared} shared points. Point this at water.`)
  process.exit(1)
}
console.log(worstA < 0.004 ? '\n✅ seams agree — depth is a pure function of world position' : '\n❌ seams disagree — the corner rule is not position-pure')
