// ── WHAT DOES IT TAKE TO MAKE THE TWILIGHT THICKET READ AS TWILIGHT? ──────────────────────────
//
// Run: npx tsx scripts/thicket-close.mts
//
// ★ CANON RULED THIS AND THE BUILD DOES NOT HONOUR IT. `CANON/game/shimmer-geography.md:1051`
// describes twilight-thicket as *"closed canopy, dim floor, a permanent twilight"*, and the ruling
// is load-bearing rather than decorative: Athowl and Noctyx are placed there as the canon nocturnal
// pair, and Luminara "because living light belongs where there is dark to answer".
// `scripts/canopy-floor.mts` measures the shipped Thicket at 28.7% canopy coverage and 71.3% of its
// floor at FULL daylight. That is drift, and `npm run canon` cannot see it — the gate covers names
// and rosters, and says so itself: no gate reads prose.
//
// ⚠ THE CEILING IS THE PROBLEM, NOT THE SETTING. Tree count is
// `meadowPerColumn + forestness * (perColumn - meadowPerColumn)`, so at DEFAULT_TREES.perColumn 1.7
// even a forestness of 1.0 yields 1.7 trunks per 16x16 column. Mean crown radius across the four
// ruled species is ~3.5, i.e. ~39 cells, so ~26% coverage is the ARITHMETIC CEILING of the current
// config. The zone's `forest: 0.97` is already almost maxed; turning it to 1.0 buys nothing. No
// value of the existing knob can produce a closed canopy, which is why this is a new knob and not
// a tuning change.
//
// This sweeps candidate densities through the REAL generator (makeColumn takes a ColumnConfig) and
// the REAL light field, and reports the three things the decision needs: how closed the roof is,
// how dim the floor is, and how walkable the ground stays. A thicket you cannot walk through is a
// different defect, and canon calls this place an "optional cozy pocket".
import { makeColumn, SECTION, DEFAULT_COLUMN } from '../src/app/shimmer/voxel/column'
import { DEFAULT_TREES } from '../src/app/shimmer/voxel/trees'
import { isSolid } from '../src/app/shimmer/voxel/depth'
import { isLeafMat } from '../src/app/shimmer/voxel/trees'
import { computeRenderLight, li } from '../src/app/shimmer/voxel/render-light'
import { newLightRing, recenterRing, nextDirtyColumn, incomingFor, publishSpill } from '../src/app/shimmer/voxel/render-light-ring'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { ZONE_ANCHORS } from '../src/app/shimmer/voxel/zones'

const SEED = 1337
const R = 4
const Z = ZONE_ANCHORS.find(a => a.id === 'twilight-thicket')!
const CX = Math.floor(Z.x / SECTION), CZ = Math.floor(Z.z / SECTION)
const SHIPPED_CEILING = Z.treeCeiling

// ⚠⚠ THE SWEEP MUST DRIVE THE ZONE'S CEILING, NOT `cfg.perColumn`. Once `treeCeiling` exists on
// the anchor, `zoneTreeCeiling` OVERRIDES cfg inside the Thicket — so a sweep that varies
// `cfg.perColumn` here reports the SAME row seven times and reads as a plateau. That is the
// tuning-change-disarms-the-guard shape: nothing touches the sweep, and it stops measuring.
function run(perColumn: number, radiusK: number) {
  Z.treeCeiling = perColumn
  const cfg = {
    ...DEFAULT_COLUMN,
    trees: {
      ...DEFAULT_TREES,
      species: DEFAULT_TREES.species.map(s => ({ ...s, radius: Math.round(s.radius * radiusK) })),
      maxRadius: Math.ceil(DEFAULT_TREES.maxRadius * radiusK),
    },
  }
  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  const colAt = (cx: number, cz: number) => {
    const k = `${cx},${cz}`
    let c = cols.get(k)
    if (!c) { c = makeColumn(cx * SECTION, cz * SECTION, SEED, cfg); cols.set(k, c) }
    return c
  }
  const matAt = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= 256) return 0
    const cx = Math.floor(x / SECTION), cz = Math.floor(z / SECTION)
    return colAt(cx, cz).get(x - cx * SECTION, y, z - cz * SECTION)
  }
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) colAt(CX + dx, CZ + dz)

  const ring = newLightRing()
  recenterRing(ring, CX, CZ)
  const fields = new Map<string, ReturnType<typeof computeRenderLight>>()
  let passes = 0
  for (;;) {
    const c = nextDirtyColumn(ring)
    if (!c || ++passes > 4000) break
    const f = computeRenderLight(c.cx * SECTION, c.cz * SECTION, matAt, incomingFor(ring, c.cx, c.cz))
    publishSpill(ring, c.cx, c.cz, f.spill)
    fields.set(`${c.cx},${c.cz}`, f)
  }

  let total = 0, canopied = 0, fullSky = 0, dim = 0, trunkCells = 0
  let skySum = 0
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const f = fields.get(`${CX + dx},${CZ + dz}`)
    if (!f) continue
    const bx = (CX + dx) * SECTION, bz = (CZ + dz) * SECTION
    for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
      const stand = columnHeight(bx + lx, bz + lz, SEED) + 1
      if (stand >= 255) continue
      // ⚠ a cell a keeper cannot occupy is not floor — canopy-floor.mts learned this the hard way,
      // where every "dark" cell turned out to be solid at standing height.
      if (isSolid(matAt(bx + lx, stand, bz + lz))) { trunkCells++; continue }
      total++
      const sky = f.sky[li(lx, stand, lz)]
      skySum += sky
      if (sky >= 15) fullSky++
      if (sky <= 9) dim++
      let leaf = false
      for (let yy = stand + 1; yy < Math.min(256, stand + 40) && !leaf; yy++) if (isLeafMat(matAt(bx + lx, yy, bz + lz))) leaf = true
      if (leaf) canopied++
    }
  }
  const pc = (n: number) => `${(100 * n / total).toFixed(1)}%`
  console.log(`perColumn ${String(perColumn).padStart(5)}  radiusK ${radiusK.toFixed(2)}  |  ` +
    `canopy ${pc(canopied).padStart(6)}  full-sky ${pc(fullSky).padStart(6)}  dim(<=9) ${pc(dim).padStart(6)}  ` +
    `mean sky ${(skySum / total).toFixed(1).padStart(4)}  |  blocked ground ${(100 * trunkCells / (total + trunkCells)).toFixed(1)}%`)
}

console.log(`twilight-thicket (${Z.x},${Z.z})  forest ${Z.forest}   canon: "closed canopy, dim floor, a permanent twilight"\n`)
console.log(`SHIPPED CEILING ${SHIPPED_CEILING} (the control — must match canopy-floor.mts at the same sha):`)
run(SHIPPED_CEILING ?? DEFAULT_TREES.perColumn, 1)
console.log('\ncandidates:')
for (const [p, k] of [[1.7, 1], [9, 1], [12, 1], [16, 1], [20, 1], [26, 1]] as [number, number][]) run(p, k)
Z.treeCeiling = SHIPPED_CEILING
console.log(`\n⚠ readings taken at sha ${process.env.SWEEP_SHA ?? '(unstated)'} — the leaf rule moved`)
console.log(`  under this file once already (hub 4b242fc, "a canopy shades, it does not switch the`)
console.log(`  sun off"), which retired an earlier sweep. Cite the sha, not the afternoon.`)
