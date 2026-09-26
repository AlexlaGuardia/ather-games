// rune-hold-look.test.ts — the town's look reads the town's own grid: every building tile is drawn by
// exactly one block, the houses are houses, the hillside is the long ragged one, and no lantern stands
// in a doorway or out in the grass.
// Run: npx tsx src/app/shimmer/play3d/rune-hold-look.test.ts
import { RUNE_HOLD } from '../world/tilemap'
import { blocksOf, lanternsOf, openSides, isBuilding, BUILDING, PATH, WARP, LANTERN_SPACING, FRONTS, NOTICE_BOARD, DRAWN_DOORS } from './rune-hold-look'
import { ZONES, getZone } from '../world/zones'
import { LANDING_LABEL } from '../world/landing'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }

const g = RUNE_HOLD
const blocks = blocksOf(g)
const total = g.flat().filter(v => v >= 0 && (v & 0xff) === BUILDING).length

// ── every building tile belongs to exactly one block, so nothing the walker bumps into is left undrawn ──
ok(blocks.reduce((s, b) => s + b.cells, 0) === total, `blocks cover every building tile (${total})`)
for (const b of blocks) {
  let inBox = 0
  for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (isBuilding(g, x, z)) inBox++
  ok(inBox >= b.cells, `block at ${b.x0},${b.z0}: its box holds its cells`)
  ok(b.h > 0, `block at ${b.x0},${b.z0}: has a height`)
}

// ── the town as authored today: houses, one hillside, and the square's small fixtures ──
const houses = blocks.filter(b => b.kind === 'house'), hills = blocks.filter(b => b.kind === 'hillside')
ok(houses.length >= 4, `at least four houses (got ${houses.length})`)
ok(hills.length >= 1, `the long east run reads as hillside (got ${hills.length})`)
ok(hills.every(h => Math.max(h.x1 - h.x0, h.z1 - h.z0) >= 40), 'a hillside is long, not a house that failed a threshold')
ok(Math.min(...hills.map(h => h.h)) > Math.max(...houses.map(h => h.h)), 'the hillside stands over every roof')

// ── a house wall cell faces open ground; a buried one never does ──
for (const b of houses) {
  const mid = openSides(g, Math.round((b.x0 + b.x1) / 2), Math.round((b.z0 + b.z1) / 2))
  ok(mid.length === 0, `house at ${b.x0},${b.z0}: its middle is buried (no wall drawn inside)`)
}

// ── lanterns: on the street, at its edge, spaced, never on a doorstep ──
const lamps = lanternsOf(g)
ok(lamps.length >= 8 && lamps.length <= 60, `a lit town, not a runway (${lamps.length} lanterns)`)
for (const l of lamps) {
  ok((g[l.z][l.x] & 0xff) === PATH, `lantern ${l.x},${l.z} stands on a path`)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = g[l.z + dz][l.x + dx] & 0xff
    ok(n !== WARP && n !== BUILDING, `lantern ${l.x},${l.z} is not on a doorstep`)
  }
}
for (let i = 0; i < lamps.length; i++) for (let j = i + 1; j < lamps.length; j++)
  ok(Math.hypot(lamps[i].x - lamps[j].x, lamps[i].z - lamps[j].z) >= LANTERN_SPACING, `lanterns ${i}/${j} are spaced`)

// ── storefronts: each face sits on a building's wall line, with open ground in front and stone behind ──
for (const f of FRONTS) {
  const [fx, fz] = f.face
  // the cells either side of the face line: behind (inside the building) and in front (outside)
  const bx = Math.floor(f.x - fx * 0.5), bz = Math.floor(f.z - fz * 0.5)
  const ox = Math.floor(f.x + fx * 0.5), oz = Math.floor(f.z + fz * 0.5)
  const behind = g[bz]?.[bx] ?? -1, front = g[oz]?.[ox] ?? -1
  ok((behind & 0xff) === BUILDING || (behind & 0xff) === WARP, `${f.id}: stone (or its own door) behind the face (${bx},${bz} is ${behind})`)
  ok(front >= 0 && (front & 0xff) !== BUILDING, `${f.id}: open ground in front of the face (${ox},${oz} is ${front})`)
  ok(!!f.gate === !f.shut, `${f.id}: a front is either a working door or shut, never both or neither`)
}
// every gate the scene claims to draw is a real, painted door of the town — or the walker would drop posts on nothing
{
  const town = getZone(ZONES, 'rune-hold')!
  const labels = new Set((town.gates ?? []).map(gt => gt.label))
  for (const l of DRAWN_DOORS) ok(labels.has(l), `drawn door "${l}" is a gate the town actually has`)
  ok(DRAWN_DOORS.has(LANDING_LABEL), 'the Landing is among the drawn doors')
}
{
  const { x, z } = NOTICE_BOARD
  ok((g[Math.round(z)][Math.floor(x)] & 0xff) === PATH, 'the Notice Board stands on the square')
  ok(Math.hypot(x - 49, z - 58) < 6, 'and near where a keeper wakes (49,58)')
}

if (fails.length) { console.log(`❌ ${pass} passed, ${fails.length} FAILED\n`); fails.slice(0, 20).forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`rune-hold-look: ${pass} passed, 0 failed · ${blocks.map(b => `${b.kind}@${b.x0},${b.z0}`).join(' ')} · ${lamps.length} lanterns`)
