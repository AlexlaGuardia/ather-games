// RUNE HOLD — the town, read as a plan, from the generator itself.
//
// ★ WHY THIS EXISTS: the greybox is only reachable through `/shimmer/dev/runehold`, which is r3f
// driving `requestAnimationFrame` — and a BACKGROUNDED tab suspends rAF entirely. From an automated
// browser you get r3f's single mount paint and nothing after it: keys are accepted, timers run, the
// script reports success, and the walker never moves because no frame elapsed. ⚠ Two identical
// screenshots is also precisely what a catastrophically broken town looks like, so the preview is an
// instrument that cannot report its own blindness. Check `document.visibilityState` before believing
// a still frame from that page.
//
// ★ SO THIS READS THE SAME VALUE THE RENDERER DOES. It imports `runeHold()` — it does not restate a
// layout — which is the pairing the world lane landed on for bridges: an ambiguous picture answered
// by a reading taken from the generator, in the same coordinates. A cell is a real distance and the
// heights are printed beside the plan, so "does the hill step" is answerable without a GPU.
//
// Run: `npx tsx scripts/town-plan.mts`
import { runeHold } from '../src/app/shimmer/play3d/rune-hold'
import { BODIES } from '../src/app/shimmer/play3d/metrics'

const t = runeHold(BODIES.voxel)
const CELL = 1.2
const xs = t.terraces.map(b => [b.x0, b.x1]).flat(), zs = t.terraces.map(b => [b.z0, b.z1]).flat()
const X0 = Math.min(...xs), X1 = Math.max(...xs), Z0 = Math.min(...zs), Z1 = Math.max(...zs)
const cols = Math.round((X1 - X0) / CELL), rows = Math.round((Z1 - Z0) / CELL)
const glyph: Record<string, string> = {
  'spirit-corner': 'S', 'kindled-mug': 'K', 'eyuun-bookstore': 'B', 'notice-board': 'n',
  'travelers-center': 'C', 'forgelight-inn': 'I', 'enchant-temple': 'E', 'travelers-station': 'T',
  'inventor-1': 'i', 'inventor-2': 'i', 'inventor-3': 'i', 'smithy-1': 'f', 'smithy-2': 'f',
}
const grid: string[][] = []
for (let r = 0; r < rows; r++) {
  const row: string[] = []
  const z = Z0 + (r + 0.5) * CELL
  for (let c = 0; c < cols; c++) {
    const x = X0 + (c + 0.5) * CELL
    const band = t.terraces.find(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)
    let ch = band ? String(band.level) : ' '
    if (Math.abs(x) <= t.square.size / 2 && Math.abs(z) <= t.square.size / 2) ch = '·'
    for (const s of t.streets) {
      const p = s.width / 2
      if (x >= Math.min(s.from[0], s.to[0]) - p && x <= Math.max(s.from[0], s.to[0]) + p &&
          z >= Math.min(s.from[1], s.to[1]) - p && z <= Math.max(s.from[1], s.to[1]) + p)
        ch = s.fromTerrace === s.toTerrace ? '=' : '/'
    }
    for (const m of t.masses)
      if (x >= m.x - m.w / 2 && x <= m.x + m.w / 2 && z >= m.z - m.d / 2 && z <= m.z + m.d / 2) ch = glyph[m.id] ?? '#'
    const p = t.descent
    if (x >= p.x - p.w / 2 && x <= p.x + p.w / 2 && z >= p.z - p.d / 2 && z <= p.z + p.d / 2) ch = 'P'
    row.push(ch)
  }
  grid.push(row)
}
console.log(`RUNE HOLD — plan, north up. 1 cell = ${CELL}m. digits = band level · · = the square · = run · / = climb`)
grid.forEach((row, r) => console.log(String(Math.round(Z0 + (r + 0.5) * CELL)).padStart(4) + '  ' + row.join('')))
console.log('')
console.log('SECTION north-south through the climb lanes (heights read off the same value):')
for (const b of t.terraces) console.log(`  band ${b.level}  z ${b.z0.toFixed(1)} .. ${b.z1.toFixed(1)}   floor y ${(b.level * t.terraceRise).toFixed(2)}`)
console.log('')
for (const m of t.masses)
  console.log(`  ${m.id.padEnd(18)} ${m.w.toFixed(1).padStart(5)} x ${m.d.toFixed(1).padStart(4)} x ${m.h.toFixed(1).padStart(4)}  stands y ${m.y.toFixed(2)}  at (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`)
console.log(`  ${'the-passage'.padEnd(18)} ${t.descent.w.toFixed(1).padStart(5)} x ${t.descent.d.toFixed(1).padStart(4)}  DOWN ${t.descent.depth.toFixed(1)}  at (${t.descent.x.toFixed(1)}, ${t.descent.z.toFixed(1)})`)
console.log('')
for (const s of t.streets) console.log(`  ${s.id.padEnd(13)} band ${s.fromTerrace} -> ${s.toTerrace}  (${s.from.map(n=>n.toFixed(1)).join(', ')}) -> (${s.to.map(n=>n.toFixed(1)).join(', ')})`)
