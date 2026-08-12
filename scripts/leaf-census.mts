// How many leaf voxels are actually on screen? Run: npx tsx scripts/leaf-census.mts [radius]
//
// ── ★ WHY MEASURE BEFORE BUILDING (2026-08-12) ─────────────────────────────────────────────────
// The plan is to stop greedy-meshing leaf voxels and draw them as instanced cross-quads instead,
// the way ground cover already works — so the canopy reads as foliage rather than as a green box,
// while leaves stay ordinary voxels and chopping, drops, light and persistence are untouched.
//
// That plan lives or dies on ONE number nobody has: how many leaf voxels sit inside a view radius.
// Ground cover gets away with instancing because it is sparse and one block tall. A canopy is a
// solid blob of radius 3-5 per tree, and a Thicket view could hold hundreds of trees. If the answer
// is ~20k this is the flora renderer again; if it is 500k it is a different feature and the right
// move is to find that out in a script rather than four hours into a rewrite.
//
// Counts the real generator's output — not an estimate from canopy radii, which would miss how
// often trees actually place and how much of a canopy overlaps its neighbour.

import { makeColumn, SECTION, DEFAULT_COLUMN } from '../src/app/shimmer/voxel/column'
import { WOOD } from '../src/app/shimmer/voxel/trees'

const RADIUS = Number(process.argv[2] ?? 6)      // settings.ts default viewRadius
// ★ SAMPLE THE WORST CASE, NOT THE CONVENIENT ONE. The origin is Moonwell Glade (open parkland);
// the Twilight Thicket at (-2000,-1150) is `forest: 0.97`, i.e. the densest canopy the world can
// generate. Measuring at spawn and calling it done would under-count by whatever the Thicket does.
const OX = Number(process.argv[3] ?? 0), OZ = Number(process.argv[4] ?? 0)
const SEED = 1337

const isLeaf = (m: number) => m >= WOOD.GOLDWOOD_LEAVES && m <= WOOD.DAWNWOOD_LEAVES && m % 2 === 1
const isLog = (m: number) => m >= WOOD.GOLDWOOD_LOG && m <= WOOD.DAWNWOOD_LOG && m % 2 === 0

// A "view" is the square of columns inside the radius, matching how the streamer loads them.
let leaves = 0, logs = 0, solid = 0, cols = 0
// Exposed = at least one of the six neighbours is air. Only these can ever produce a quad, so this
// is the number that actually decides the instance count — a leaf buried inside a canopy draws
// nothing today and must draw nothing after the change either.
let exposedLeaves = 0
const t0 = process.hrtime.bigint()

const grid: Record<string, ReturnType<typeof makeColumn>> = {}
for (let cz = -RADIUS; cz <= RADIUS; cz++) {
  for (let cx = -RADIUS; cx <= RADIUS; cx++) {
    grid[`${cx},${cz}`] = makeColumn((cx + OX) * SECTION, (cz + OZ) * SECTION, SEED)
    cols++
  }
}
const genMs = Number(process.hrtime.bigint() - t0) / 1e6

const H = DEFAULT_COLUMN.worldHeight
const at = (wx: number, y: number, wz: number): number => {
  if (y < 0 || y >= H) return 0
  const cx = Math.floor(wx / SECTION), cz = Math.floor(wz / SECTION)
  const col = grid[`${cx},${cz}`]
  if (!col) return 0
  return col.get(wx - cx * SECTION, y, wz - cz * SECTION)
}

for (const key of Object.keys(grid)) {
  const [cx, cz] = key.split(',').map(Number)
  const col = grid[key]
  for (let y = 0; y < H; y++) {
    for (let lz = 0; lz < SECTION; lz++) {
      for (let lx = 0; lx < SECTION; lx++) {
        const m = col.get(lx, y, lz)
        if (m === 0) continue
        solid++
        if (isLog(m)) logs++
        if (!isLeaf(m)) continue
        leaves++
        const wx = cx * SECTION + lx, wz = cz * SECTION + lz
        if (at(wx + 1, y, wz) === 0 || at(wx - 1, y, wz) === 0 ||
            at(wx, y + 1, wz) === 0 || at(wx, y - 1, wz) === 0 ||
            at(wx, y, wz + 1) === 0 || at(wx, y, wz - 1) === 0) exposedLeaves++
      }
    }
  }
}

const span = (RADIUS * 2 + 1)
console.log(`\nleaf census — seed ${SEED}, origin column (${OX},${OZ}), radius ${RADIUS} (${span}x${span} = ${cols} columns, ${span * SECTION} blocks across)`)
console.log(`  generated in            ${genMs.toFixed(0)} ms`)
console.log(`  solid voxels            ${solid.toLocaleString()}`)
console.log(`  log voxels              ${logs.toLocaleString()}`)
console.log(`  LEAF voxels             ${leaves.toLocaleString()}`)
console.log(`  leaf voxels EXPOSED     ${exposedLeaves.toLocaleString()}   <- the instance count that matters`)
console.log(`  per column              ${(exposedLeaves / cols).toFixed(1)} exposed leaves`)
console.log(`\n  for scale: the flora renderer already carries ~17,000 instances on this box.`)

// ── ★ WHAT THE CANOPY COSTS, MESHED FOR REAL ───────────────────────────────────────────────────
// ⚠ THIS BLOCK USED TO COMPARE THE MESHER AGAINST A HYPOTHETICAL THAT HAS SINCE SHIPPED, and once
// it shipped the comparison was the live mesher against itself — it printed "1.26x the current leaf
// cost" for a change that cost 1.06x. The original question was *should* leaves become cross-quads;
// they did, on 2026-08-12. The question now is what the canopy costs and how much of that the
// enclosure cull saves, so that is what it prints. A measurement script that outlives its question
// does not go quiet, it reports a wrong number confidently.
import { meshColumn, type Neighbours } from '../src/app/shimmer/voxel/column'
import { createMeshScratch } from '../src/app/shimmer/voxel/greedy'

const scratch = createMeshScratch(SECTION)
let leafQuads = 0, totalQuads = 0
for (const key of Object.keys(grid)) {
  const [cx, cz] = key.split(',').map(Number)
  const neigh: Neighbours = {
    px: grid[`${cx + 1},${cz}`], nx: grid[`${cx - 1},${cz}`],
    pz: grid[`${cx},${cz + 1}`], nz: grid[`${cx},${cz - 1}`],
  }
  for (const sm of meshColumn(grid[key], neigh, scratch)) {
    totalQuads += sm.mesh.quads
    for (let q = 0; q < sm.mesh.quads; q++) if (isLeaf(sm.mesh.materials[q * 4])) leafQuads++
  }
}
// Every leaf voxel would emit two crossed quads; the ones walled in on all six sides are culled,
// because they sit behind their own neighbours' crosses from every angle. That saving is what pays
// for a fuller crown, so it is worth printing next to the bill rather than buried in it.
const uncapped = leaves * 2
console.log(`\n  ── what the canopy costs, meshed for real ──`)
console.log(`  total quads in view     ${totalQuads.toLocaleString()}`)
console.log(`  LEAF quads             ${leafQuads.toLocaleString()}   (${(leafQuads / totalQuads * 100).toFixed(1)}% of the world)`)
console.log(`  without the cull        ${uncapped.toLocaleString()}   (2 per leaf voxel, no merging possible)`)
console.log(`  buried leaves culled    ${(leaves - exposedLeaves).toLocaleString()} voxels ` +
            `= ${(uncapped - leafQuads).toLocaleString()} quads saved ` +
            `(${((1 - leafQuads / Math.max(1, uncapped)) * 100).toFixed(0)}%)`)
