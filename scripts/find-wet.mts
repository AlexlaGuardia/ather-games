// Throwaway: find a column region with DEEP water, so a probe has something to measure.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'
const SEED = 1337
const R = Number(process.argv[2] ?? 200)
const best: { cx: number; cz: number; wet: number; deep: number }[] = []
for (let cz = -R; cz <= R; cz += 5) for (let cx = -R; cx <= R; cx += 5) {
  const col = generateColumn(new Column(cx * SECTION, cz * SECTION), SEED)
  let wet = 0, deep = 0
  for (let z = 0; z < SECTION; z += 2) for (let x = 0; x < SECTION; x += 2) {
    let d = 0
    for (let y = col.sections.length * SECTION - 1; y >= 0; y--) {
      const m = col.sections[(y / SECTION) | 0].get(x, y % SECTION, z)
      if (m === MAT.WATER) d++
      else if (d > 0) break
    }
    if (d > 0) wet++
    if (d >= 5) deep++
  }
  if (wet > 0) best.push({ cx, cz, wet, deep })
}
best.sort((a, b) => b.deep - a.deep || b.wet - a.wet)
for (const b of best.slice(0, 8)) console.log(`cx=${b.cx} cz=${b.cz}  wet=${b.wet}  deep(>=5)=${b.deep}`)
