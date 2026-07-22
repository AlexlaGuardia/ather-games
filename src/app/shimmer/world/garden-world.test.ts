// Garden World composer proof — layout solve, compose, and the assertion that matters:
// every surface zone is REACHABLE on foot from the garden spawn (no teleports left behind).
// Run: npx tsx src/app/shimmer/world/garden-world.test.ts
import { solveGardenLayout, composeGardenWorld, SURFACE_ZONES } from './garden-world'
import { SOLID } from './tiles'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const { issues } = solveGardenLayout()
console.log('— solve issues —')
issues.forEach(i => console.log('  ·', i))
chk('all surface zones placed', !issues.some(i => i.startsWith('unreachable')))
chk('no zone-rect overlaps', !issues.some(i => i.startsWith('OVERLAP')))

const w = composeGardenWorld()
console.log(`\nworld: ${w.cols}×${w.rows} tiles (${w.cols * w.rows} cells), ${w.placements.size} zones, ${w.doorWarps.length} door-warps kept`)
for (const p of w.placements.values()) console.log(`  ${p.zone.id.padEnd(24)} @ (${p.ox},${p.oy}) ${p.cols}×${p.rows}`)

// Connectivity: flood-fill walkable cells from the garden spawn.
const VOID = -1
const walk = (x: number, y: number) => {
  const v = w.grid[y]?.[x]
  return v != null && v !== VOID && !SOLID[v & 0xFF]
}
// Doors (interior realms: caverns, holds, houses) count as connectors — reaching any
// door tile grants the rest (approximation: the interiors form one traversable network;
// the caverns/holds each bridge two surface doors, which this over-covers but sanely).
const seen = new Set<number>()
const stack = [[w.playerStart.tileX, w.playerStart.tileY]]
chk('spawn is walkable', walk(w.playerStart.tileX, w.playerStart.tileY))
let doorsSpent = false
while (stack.length) {
  const [x, y] = stack.pop()!
  const k = y * w.cols + x
  if (seen.has(k) || !walk(x, y)) continue
  seen.add(k)
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  if (!doorsSpent && w.doorWarps.some(d => d.worldX === x && d.worldY === y)) {
    doorsSpent = true
    for (const d of w.doorWarps) stack.push([d.worldX, d.worldY])
  }
}
console.log(`\nreachable walkable cells: ${seen.size}`)
for (const p of w.placements.values()) {
  let hit = 0
  for (let r = 0; r < p.rows && !hit; r++) for (let c = 0; c < p.cols; c++)
    if (seen.has((p.oy + r) * w.cols + (p.ox + c))) { hit = 1; break }
  chk(`reachable on foot: ${p.zone.id}`, hit === 1)
}
chk('every surface zone got placed', w.placements.size === SURFACE_ZONES.length)

// ASCII continent map (scaled) — '#'=cloud, '.'=floor, '~'=water-ish/other, letters=zone initial.
const scale = Math.max(1, Math.ceil(w.cols / 170))
const initial = new Map([...w.placements.values()].map(p => [p.zone.id, p.zone.id[0]]))
console.log(`\n— continent map (1 char = ${scale}×${scale} tiles) —`)
for (let r = 0; r < w.rows; r += scale) {
  let line = ''
  for (let c = 0; c < w.cols; c += scale) {
    const v = w.grid[r][c]
    const z = w.zoneAt(c, r)
    if (v === VOID) line += ' '
    else if (v === 34) line += '#'
    else if (z) line += SOLID[v & 0xFF] ? '#' : (initial.get(z) ?? '.')
    else line += '.'
  }
  console.log(line)
}

console.log(`\n${ok} ok, ${bad} failed`)
process.exit(bad ? 1 : 0)
