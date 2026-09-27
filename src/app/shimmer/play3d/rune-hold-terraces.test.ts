// rune-hold-terraces.test.ts — the town climbs and every street of it stays walkable: no step between two
// walkable cells is more than half a tier (the walker steps one), buildings stand level, the square and the
// Landing are flat, and the shipped heights ARE the baked ones.
// Run: npx tsx src/app/shimmer/play3d/rune-hold-terraces.test.ts
import { RUNE_HOLD } from '../world/tilemap'
import { getHeightGrid } from '../world/heightmaps'
import { LANDING, LANDING_ARRIVAL, PLAZA } from '../world/landing'
import { blocksOf, FRONTS } from './rune-hold-look'
import { terraceHeights, groundAt } from './rune-hold-terraces'
import { runeHoldDoors } from './rune-hold-terraces-doors'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }

const g = RUNE_HOLD
const H = terraceHeights(g, runeHoldDoors())
const solid = (x: number, z: number) => (g[z]?.[x] ?? -1) >= 0 && (g[z][x] & 0xff) === 103

// ── the shape Alex picked: high at the gate, the square in the middle, the Station lowest ──
ok(groundAt(0) === 3 && groundAt(30) === 2 && groundAt(55) === 1 && groundAt(95) === 0, 'north 3 → row 2 → square 1 → Station 0')

// ── walkable: no step between neighbouring open cells over half a tier ──
let worst = 0
for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
  if (solid(x, z)) continue
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const nx = x + dx, nz = z + dz
    if (nz >= g.length || nx >= g[z].length || solid(nx, nz)) continue
    worst = Math.max(worst, Math.abs(H[z][x] - H[nz][nx]))
  }
}
ok(worst <= 0.5, `the steepest step between open cells is ${worst} tiers (walker takes 1; a street wants ≤ 0.5)`)

// ── buildings stand level ──
for (const b of blocksOf(g)) {
  if (b.kind === 'hillside') continue
  const hs = new Set<number>()
  for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (solid(x, z)) hs.add(H[z][x])
  ok(hs.size === 1, `${b.kind}@${b.x0},${b.z0} stands level (${[...hs].join(',')})`)
}
// ── every storefront's door is level with the street in front of it (you walk IN, not climb) ──
for (const f of FRONTS) {
  const out = { x: Math.floor(f.x + f.face[0] * ((f.depth ?? 0) + 0.5)), z: Math.floor(f.z + f.face[1] * ((f.depth ?? 0) + 0.5)) }
  const inn = { x: Math.floor(f.x - f.face[0] * 0.5), z: Math.floor(f.z - f.face[1] * 0.5) }
  ok(Math.abs(H[out.z][out.x] - H[inn.z][inn.x]) <= 0.25, `${f.id}: door level with its street (${H[inn.z][inn.x]} vs ${H[out.z][out.x]})`)
}
// ── the square is flat, and so is the Landing's plaza round the disc ──
const sq = new Set<number>()
for (let z = 44; z <= PLAZA.y1; z++) for (let x = PLAZA.x0; x <= PLAZA.x1; x++) if (!solid(x, z)) sq.add(H[z][x])
ok(sq.size === 1, `the square (below its north lip) is one level (${[...sq].join(',')})`)
for (let z = LANDING.y - 4; z <= LANDING.y + LANDING.h + 3; z++) for (let x = LANDING.x - 4; x <= LANDING.x + LANDING.w + 3; x++)
  ok(H[z][x] === H[LANDING.y][LANDING.x], `the Landing's dais sits on flat ground (${x},${z})`)
ok(H[LANDING_ARRIVAL.y][LANDING_ARRIVAL.x] === H[LANDING.y][LANDING.x], 'the arrival stands on the dais level')

// ── the shipped heights ARE the baked ones (re-run scripts/rune-hold-terraces.mts if this fails) ──
const shipped = getHeightGrid('rune-hold', g.length, g[0].length)
let diff = 0
for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) if (shipped[z][x] !== H[z][x]) diff++
ok(diff === 0, `heightmaps.json › rune-hold matches the terraces (${diff} cells differ)`)

if (fails.length) { console.log(`❌ ${pass} passed, ${fails.length} FAILED\n`); fails.slice(0, 20).forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`rune-hold-terraces: ${pass} passed, 0 failed · steepest open step ${worst}`)
