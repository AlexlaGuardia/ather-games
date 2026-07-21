// WORLD-lane seg authoring — proves getSegLayer(zoneId) data drives hub's REAL resolver into a
// high/low branch, and that unauthored zones stay byte-identical flat (EMPTY_SEGS).
// Run: npx tsx src/app/shimmer/world/segs.test.ts
import { getSegLayer, getZoneSegs } from './segs'
import { resolveStand, EMPTY_SEGS, type CollisionCtx } from '../engine/segs-collision'
import { SOLID } from './tiles'
import { getHeightGrid } from './heightmaps'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// a known-walkable tile id (not VOID, not SOLID) so groundSurface() always yields a base surface
let WALK = 0; while (SOLID[WALK & 0xFF]) WALK++

const ROWS = 18, COLS = 24
const grid = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(WALK))
const heights = getHeightGrid('moonwell-glade', ROWS, COLS) // pyramid: 0 out on the flat, up to 3 at the peak
const ctx: CollisionCtx = { grid, heights, segs: getSegLayer('moonwell-glade') }

// the demo bridge covers cols7..14 × rows8..10 at top tier 3; pick a cell out over flat ground (height 0)
const BX = 11, BZ = 9
chk('demo zone has authored segs', getZoneSegs('moonwell-glade').length > 0)
chk('the bridge covers the test cell', ctx.segs.at.has(`${BX},${BZ}`), `${BX},${BZ}`)
chk('ground under the bridge is the low road (0)', (heights[BZ]?.[BX] ?? -1) === 0, String(heights[BZ]?.[BX]))

// THE BRANCH: same cell, elevation decides the surface.
{
  const low = resolveStand(ctx, BX, BZ, 0)  // walking on the ground
  chk('low road: fromY 0 stays on the ground under the bridge', low?.kind === 'ground' && low.y === 0, JSON.stringify(low))
  const high = resolveStand(ctx, BX, BZ, 3) // up on the bridge
  chk('high road: fromY 3 rides the seg (top 3)', high?.kind === 'seg' && high.y === 3, JSON.stringify(high))
  chk('two distinct surfaces at one cell', low?.y !== high?.y)
}

// reachability onto the bridge from its pyramid-side start (col7, ground tier 2 → step up 1 onto tier 3)
{
  const onramp = resolveStand(ctx, 7, 9, 2)
  chk('on-ramp: step up from tier 2 onto the bridge', onramp?.kind === 'seg' && onramp.y === 3, JSON.stringify(onramp))
  const tooLow = resolveStand(ctx, 7, 9, 0)
  chk('a low walker cannot step 0→3 onto the bridge', tooLow?.kind === 'ground', JSON.stringify(tooLow))
}

// unauthored zone → EMPTY_SEGS → flat parity preserved
chk('unauthored zone returns EMPTY_SEGS', getSegLayer('no-such-zone') === EMPTY_SEGS)
chk('getZoneSegs returns fresh copies', (() => { const a = getZoneSegs('moonwell-glade'); a[0].y = 999; return getZoneSegs('moonwell-glade')[0].y === 3 })())

console.log(`\nworld segs: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
