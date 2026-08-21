// Throwaway measurement (2026-08-21): how deep is the water a player actually looks at?
// Depth = the water surface plane minus the top of the bed beneath it, per water-surface CELL —
// which is exactly the number a depth-attenuation ramp would key off. Real generated columns, so
// this counts what the mesher sees rather than what the noise field promises.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'

const SEED = 1337
const R = Number(process.argv[2] ?? 24)   // columns each way from spawn (16 blocks each)
const AIR = 0

const hist = new Map<number, number>()
let cells = 0, cols = 0, wet = 0
const STRIDE = Number(process.argv[3] ?? 1)
for (let cz = -R; cz <= R; cz += STRIDE) for (let cx = -R; cx <= R; cx += STRIDE) {
  const col = generateColumn(new Column(cx * SECTION, cz * SECTION), SEED)
  cols++
  let colWet = false
  const n = col.sections.length
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
    // topmost water cell in this (x,z) stack
    let top = -1
    outer: for (let i = n - 1; i >= 0; i--) {
      const u = col.uniform[i]
      if (u === AIR) continue
      if (u !== -1 && u !== MAT.WATER) break
      if (u === MAT.WATER) { top = (i + 1) * SECTION - 1; break outer }
      const sec = col.sections[i]
      for (let y = SECTION - 1; y >= 0; y--) if (sec.get(x, y, z) === MAT.WATER) { top = i * SECTION + y; break outer }
    }
    if (top < 0) continue
    // walk down from the surface to the first non-water cell — that is the bed
    let bed = -1
    for (let y = top; y >= 0; y--) {
      const m = col.sections[(y / SECTION) | 0].get(x, y % SECTION, z)
      if (m !== MAT.WATER) { bed = y; break }
    }
    const depth = top - bed          // whole water cells above the bed
    hist.set(depth, (hist.get(depth) ?? 0) + 1)
    cells++; colWet = true
  }
  if (colWet) wet++
}

const keys = [...hist.keys()].sort((a, b) => a - b)
const total = cells
let run = 0
console.log(`\n=== water-surface depth, seed ${SEED}, ${cols} columns (${wet} wet), ${cells} surface cells ===\n`)
console.log('depth   cells      pct    cumulative')
for (const d of keys) {
  const c = hist.get(d)!
  run += c
  console.log(`${String(d).padStart(4)}  ${String(c).padStart(8)}  ${((c / total) * 100).toFixed(1).padStart(6)}%  ${((run / total) * 100).toFixed(1).padStart(6)}%`)
}
const at = (p: number) => { let r = 0; for (const d of keys) { r += hist.get(d)!; if (r / total >= p) return d } return keys[keys.length - 1] }
console.log(`\nmedian ${at(0.5)} · p75 ${at(0.75)} · p90 ${at(0.9)} · p99 ${at(0.99)} · max ${keys[keys.length - 1]}`)
