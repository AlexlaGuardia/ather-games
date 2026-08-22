// Throwaway (2026-08-22): are there GAPS where the water sheet meets land?
//
// Alex: "gaps on the edges where the water meets land". The suspect is documented in greedy.ts:
// the SHEET samples the raw water table, while the BLOCKS were placed from `waterSurfaceAt`, which
// clamps a perimeter column down to its dry neighbour's ground — so the two heights disagree most
// exactly at the shore. The rim is pulled down onto the sheet to cover that, but the pull is
// one-directional (down only) and guarded to at most one block. Either limit leaves a hole.
//
// Method: find every water surface quad corner that sits on the shoreline, and ask whether any
// vertical water face actually reaches up to it. A corner with no rim beneath it is see-through.
import { Column, generateColumn, meshColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const OX = Number(process.argv[2] ?? 9), OZ = Number(process.argv[3] ?? -30), R = 2
const cols = new Map<string, Column>()
const key = (a: number, b: number) => `${a},${b}`
for (let cz = -R-1; cz <= R+1; cz++) for (let cx = -R-1; cx <= R+1; cx++)
  cols.set(key(cx,cz), generateColumn(new Column((OX+cx)*SECTION,(OZ+cz)*SECTION), SEED))

/** world "x,z" -> highest y of any vertical WATER face there (the rim's top), and the sheet's y. */
const rimTop = new Map<string, number>()
const sheetY = new Map<string, number>()
const sheetCells = new Set<string>()

for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
  const n = (dx:number,dz:number)=>cols.get(key(cx+dx,cz+dz))??null
  for (const sm of meshColumn(cols.get(key(cx,cz))!, {negX:n(-1,0),posX:n(1,0),negZ:n(0,-1),posZ:n(0,1),
    negXnegZ:n(-1,-1),posXnegZ:n(1,-1),negXposZ:n(-1,1),posXposZ:n(1,1)})) {
    const m = sm.mesh
    for (let q = 0; q < m.quads; q++) {
      if (m.materials[q*4] !== MAT.WATER) continue
      const ny = m.normals[q*12+1]
      for (let k = 0; k < 4; k++) {
        const x = sm.wx + m.positions[q*12+k*3]
        const y = sm.wy + m.positions[q*12+k*3+1]
        const z = sm.wz + m.positions[q*12+k*3+2]
        const kk = `${x},${z}`
        if (ny > 0.5) {                                  // the sheet
          sheetY.set(kk, Math.max(sheetY.get(kk) ?? -Infinity, y))
          sheetCells.add(kk)
        } else if (Math.abs(ny) < 0.5) {                 // a vertical rim
          rimTop.set(kk, Math.max(rimTop.get(kk) ?? -Infinity, y))
        }
      }
    }
  }
}

// A shoreline corner: the sheet is here, and at least one rim exists here too (a real edge).
let shore = 0, gaps = 0, boxes = 0, worst = 0, worstAt = '', worstBox = 0, worstBoxAt = ''
const hist = new Map<string, number>()
for (const [kk, sy] of sheetY) {
  const rt = rimTop.get(kk)
  if (rt === undefined) continue                          // interior sheet corner, no edge here
  shore++
  const gap = sy - rt                                     // sheet ABOVE the rim's top = a hole
  if (gap > 1e-4) { gaps++; if (gap > worst) { worst = gap; worstAt = kk } }
  // The other direction: a rim standing ABOVE the sheet is a BOX proud of the water, which is what
  // `19c7edb` ("no more boxes at the shoreline") was supposed to end.
  const proud = rt - sy
  if (proud > 1e-4) {
    boxes++
    const b = proud < 0.25 ? '<0.25' : proud < 0.5 ? '0.25-0.5' : proud < 1 ? '0.5-1' : '>=1 BLOCK'
    hist.set(b, (hist.get(b) ?? 0) + 1)
    if (proud > worstBox) { worstBox = proud; worstBoxAt = kk }
  }
}
console.log(`\n=== water/land seam, seed ${SEED}, origin col ${OX},${OZ} ===`)
console.log(`sheet corners on an edge   ${shore}`)
console.log(`  sheet ABOVE rim (see-through):  ${gaps}   worst ${worst.toFixed(3)} at ${worstAt}`)
console.log(`  rim ABOVE sheet (proud BOX):    ${boxes}  (${shore?((boxes/shore)*100).toFixed(1):0}%)`)
for (const [b, c] of [...hist].sort()) console.log(`     ${b.padEnd(10)} ${c}`)
console.log(`  worst box                       ${worstBox.toFixed(3)} blocks  at ${worstBoxAt}`)

// ── The other shape a "box" can take: a water cell whose SHEET genuinely sits a step above its
// neighbour's, keeping every rim between them. The slope smooths a riser inside one body, and a
// riser facing DRY land is deliberately never suppressed — so a shore cell one block high keeps
// all four walls and reads as a cube standing in the water.
let steps = 0, adj = 0, worstStep = 0, worstStepAt = ''
const stepHist = new Map<string, number>()
for (const [kk, sy] of sheetY) {
  const [x, z] = kk.split(',').map(Number)
  for (const [dx, dz] of [[1,0],[0,1],[-1,0],[0,-1]]) {
    const o = sheetY.get(`${x+dx},${z+dz}`)
    if (o === undefined) continue
    adj++
    const st = sy - o
    if (st > 0.5) {
      steps++
      const b = st < 0.8 ? '0.5-0.8' : st < 1.2 ? '~1 BLOCK' : '>1.2'
      stepHist.set(b, (stepHist.get(b) ?? 0) + 1)
      if (st > worstStep) { worstStep = st; worstStepAt = kk }
    }
  }
}
console.log(`\nadjacent sheet corners          ${adj}`)
console.log(`  with a STEP over half a block: ${steps}  (${adj?((steps/adj)*100).toFixed(1):0}%)`)
for (const [b, c] of [...stepHist].sort()) console.log(`     ${b.padEnd(10)} ${c}`)
console.log(`  worst step                     ${worstStep.toFixed(3)} blocks at ${worstStepAt}`)
