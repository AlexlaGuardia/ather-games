// Where in the world does `hollowEligible`'s greyness >= 0.5 gate actually open?
import { greyness } from '../src/app/shimmer/voxel/biome'
const SEED = 1337
const HALF = 8000, STEP = 250
let pass = 0, total = 0
const cells: string[] = []
for (let z = -HALF; z <= HALF; z += STEP) {
  let row = ''
  for (let x = -HALF; x <= HALF; x += STEP) {
    const g = greyness(x, z, SEED)
    total++
    if (g >= 0.5) { pass++; row += '#' }
    else if (g >= 0.25) row += '+'
    else if (g > 0) row += '.'
    else row += ' '
  }
  cells.push(row)
}
console.log(`grid ${STEP}u over +-${HALF}: ${(100 * pass / total).toFixed(2)}% of the world clears greyness>=0.5`)
console.log('rows run z=-8000 (top) .. +8000; cols x=-8000 (left) .. +8000. O=outfields anchor')
cells.forEach((r, i) => {
  const z = -HALF + i * STEP
  const mark = Math.abs(z - 1000) < STEP / 2 ? ' <- z=1000 (outfields)' : ''
  console.log(String(z).padStart(6) + ' ' + r + mark)
})
// Outfields ellipse specifically
let op = 0, ot = 0, omax = 0
for (let z = 1000 - 750; z <= 1000 + 750; z += 10) for (let x = 3700 - 900; x <= 3700 + 900; x += 10) {
  const g = greyness(x, z, SEED); ot++; if (g > omax) omax = g; if (g >= 0.5) op++
}
console.log(`\nTHE OUTFIELDS ellipse (3700,1000 +-900/750, 10u grid): ${op}/${ot} cells clear 0.5 (${(100*op/ot).toFixed(3)}%), max greyness ${omax.toFixed(3)}`)
