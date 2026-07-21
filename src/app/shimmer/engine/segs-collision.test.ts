// ── segs-collision — headless invariant proof ─────────────────────────────────
// Run: npx tsx src/app/shimmer/engine/segs-collision.test.ts
// Exits non-zero on any failed assertion. Guards engine/segs-collision.ts — the ONLY thing
// standing between "flat world, wire the API safely" and "shipped a movement regression".

import { buildSegLayer, surfacesAt, resolveStand, canStandAt, EMPTY_SEGS, type CollisionCtx, type Seg } from './segs-collision'

let pass = 0, fail = 0
function ok(cond: boolean, msg: string) { if (cond) { pass++ } else { fail++; console.error('  ✗ ' + msg) } }
function eq(a: unknown, b: unknown, msg: string) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`) }

// A 4x4 world. Tile 0 = walkable grass, tile 6 = SOLID (see world/tiles SOLID table). -1 = VOID.
// heights are tier units. Cell (2,1) is a wall; (3,3) is void.
const grid = [
  [0, 0, 0, 0],
  [0, 0, 6, 0],
  [0, 0, 0, 0],
  [0, 0, 0, -1],
]
const heights = [
  [0, 0, 0, 0],
  [0, 1, 0, 2],
  [0, 3, 5, 0],
  [0, 0, 0, 0],
]

// ── 1. EMPTY_SEGS parity: must reproduce the OLD Shimmer3D canStand exactly ────────────────────
// old: inBounds && tile!==VOID && !SOLID && (heights[target] - curH <= 1)
const flat: CollisionCtx = { grid, heights, segs: EMPTY_SEGS }
function oldCanStand(cx: number, cz: number, curH: number): boolean {
  if (cz < 0 || cz >= grid.length || cx < 0 || cx >= grid[0].length) return false
  if (grid[cz][cx] === -1) return false
  if ([6].includes(grid[cz][cx])) return false // SOLID ids in this fixture
  return (heights[cz][cx] - curH) <= 1
}
let parityChecks = 0
for (let cz = -1; cz <= 4; cz++) for (let cx = -1; cx <= 4; cx++) for (const curH of [0, 1, 2, 3, 5]) {
  parityChecks++
  eq(canStandAt(flat, cx, cz, curH), oldCanStand(cx, cz, curH), `parity @ (${cx},${cz}) fromY=${curH}`)
}
ok(parityChecks === 180, `ran full parity sweep (${parityChecks})`)

// ── 2. bounds / void / solid always block ──────────────────────────────────────────────────────
ok(!canStandAt(flat, -1, 0, 0), 'oob x blocked')
ok(!canStandAt(flat, 0, 9, 0), 'oob z blocked')
ok(!canStandAt(flat, 2, 1, 0), 'SOLID tile blocked')
ok(!canStandAt(flat, 3, 3, 0), 'VOID tile blocked')

// ── 3. step-up gate: up<=1, down unbounded ─────────────────────────────────────────────────────
ok(canStandAt(flat, 1, 1, 0), 'step up 1 tier ok (h=1 from 0)')       // heights[1][1]=1
ok(!canStandAt(flat, 3, 1, 0), 'step up 2 tiers blocked (h=2 from 0)') // heights[1][3]=2
ok(canStandAt(flat, 3, 1, 1), 'step up to 2 from 1 ok')
ok(canStandAt(flat, 0, 0, 5), 'drop 5 tiers ok (h=0 from 5)')          // unbounded down

// ── 4. HIGH/LOW BRANCHING — the feature ────────────────────────────────────────────────────────
// A high seg at y=3 laid over a flat ground patch (all heights 0). Same footprint, two surfaces.
const g0 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
const h0 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
const highRoad: Seg[] = [{ id: 'hr', x: 0, z: 0, w: 3, d: 1, y: 3 }] // row z=0, three cells wide, top 3
const ctx: CollisionCtx = { grid: g0, heights: h0, segs: buildSegLayer(highRoad) }

// two surfaces exist at (1,0): ground 0 and seg 3, top-sorted
eq(surfacesAt(ctx, 1, 0).map(s => s.y), [0, 3], 'two stacked surfaces at (1,0)')

// low road: standing at fromY=0 under the high road -> resolve to GROUND, walk under it
eq(resolveStand(ctx, 1, 0, 0)?.kind, 'ground', 'fromY=0 stays on ground (low road, under the seg)')
eq(resolveStand(ctx, 1, 0, 0)?.y, 0, 'low road surface y=0')

// high road: climbed to fromY=3 -> resolve to the SEG, you're on the high road
eq(resolveStand(ctx, 1, 0, 3)?.kind, 'seg', 'fromY=3 rides the seg (high road)')
eq(resolveStand(ctx, 1, 0, 3)?.segId, 'hr', 'high road is seg hr')

// stepping off the high road's end (z=1 has no seg) from fromY=3 -> drop to ground
eq(resolveStand(ctx, 1, 1, 3)?.kind, 'ground', 'high road ends -> drop to ground ahead')

// you cannot leap onto the high road (y=3) from the ground (fromY=0): 3 > 0+1
ok(resolveStand(ctx, 1, 0, 0)?.y === 0, 'cannot teleport up onto high road from ground')

// ── 5. buildSegLayer footprint expansion ───────────────────────────────────────────────────────
const layer = buildSegLayer([{ id: 'p', x: 1, z: 2, w: 2, d: 3, y: 4 }])
ok(layer.count === 1, 'seg count')
let covered = 0
for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (layer.at.get(`${x},${z}`)) covered++
ok(covered === 6, `2x3 rect covers 6 cells (got ${covered})`)
ok(!!layer.at.get('1,2') && !!layer.at.get('2,4') && !layer.at.get('3,2'), 'footprint corners correct')

// overlapping segs at one cell are top-sorted
const stacked = buildSegLayer([{ id: 'hi', x: 0, z: 0, w: 1, d: 1, y: 5 }, { id: 'lo', x: 0, z: 0, w: 1, d: 1, y: 2 }])
eq(stacked.at.get('0,0')!.map(s => s.id), ['lo', 'hi'], 'stacked segs sorted by top asc')

console.log(`\nsegs-collision: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
