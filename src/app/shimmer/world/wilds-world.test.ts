/**
 * wilds-world oracle. Run: `npx tsx src/app/shimmer/world/wilds-world.test.ts`
 *
 * Two things have to be true for phase 3, and they pull against each other:
 *   1. THE SEAM IS REAL — you can walk from one region into the next without a door, and the
 *      country lines up when you get there.
 *   2. IT STILL COSTS NOTHING — materialized memory is bounded by the load window, not by the
 *      world, exactly as phase 2 bounded mounted chunks.
 * A build that gets 1 by handing the renderer the whole world would pass every seam test here
 * and die on a phone, so the memory assertions are checked against a deliberately huge world.
 *
 * ★ And the lesson phase 1 paid for: green does not mean right. The seam checks below assert on
 * ACTUAL GENERATED TERRAIN (not a fixture), and the walk is a real flood fill across the border
 * — because "the gate numbers match" is what a monotone staircase would also have told us.
 */
import {
  WILDS_REGION, WILDS_CLOUD, wildsGeometry, parseWildsId, wildsIdOf, regionOrigin,
  regionToWorld, worldToRegion, sharedRow, isSharedRow, sparseGrid, cloneSparseGrid,
  materializeRows, regionsInWindow, newMount, syncWilds, materializedRows, wildsLoadRadius,
} from './wilds-world'
import { generateWildsRegion, edgeGate, WILDS_FILL } from './wilds-gen'
import { CHUNK, DEFAULT_RADIUS } from './chunk-stream'
import { WILDS_ZONE, WILDS_GEO, loadWildsRegion } from './region-maps'
import { ALL_ZONES } from './all-zones'
import { checkWarp } from './zones'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, label: string) => { c ? pass++ : fails.push(label) }

const SEED = 20260805
const ids4 = ['wilds-0-0', 'wilds-1-0', 'wilds-0-1', 'wilds-1-1']
const geo = wildsGeometry(ids4)

// ── 1. ids ────────────────────────────────────────────────────────────────────────────────
ok(parseWildsId('wilds-3-1')?.rx === 3 && parseWildsId('wilds-3-1')?.ry === 1, 'a wilds id parses')
ok(parseWildsId('wilds--1-2')?.rx === -1, 'negative region coords parse — the world may grow west')
ok(parseWildsId('the-outfields') === null, 'a non-wilds region id is not a wilds region')
ok(parseWildsId('wilds-0') === null, 'a malformed id is rejected rather than half-read')
ok(wildsIdOf(2, -3) === 'wilds-2--3', 'ids round-trip through the formatter')

// ── 2. geometry ───────────────────────────────────────────────────────────────────────────
ok(geo.cols === 800 && geo.rows === 800, 'a 2x2 of 400s is an 800x800 world')
ok(geo.originRx === 0 && geo.originRy === 0, 'origin is the north-west-most region')
{
  const g = wildsGeometry(['wilds--1--1', 'wilds-0-0'])
  ok(g.originRx === -1 && g.originRy === -1, 'a world extending north-west anchors on the new corner')
  ok(g.cols === 800 && g.rows === 800, '...and is sized from the span, not from region 0,0')
  ok(regionOrigin(g, 0, 0).x === 400, '...so region 0,0 is no longer at world 0,0')
}
ok(wildsGeometry([]).cols === 0, 'an empty manifest is an empty world, not a crash')
ok(wildsGeometry(['the-outfields', 'wilds-0-0']).regions.length === 1, 'non-wilds ids are filtered out of the manifest')

// ── 3. coordinates round-trip ─────────────────────────────────────────────────────────────
{
  let allBack = true
  for (const [rx, ry, lx, ly] of [[0, 0, 0, 0], [1, 0, 0, 17], [0, 1, 399, 399], [1, 1, 250, 3]] as const) {
    const w = regionToWorld(geo, rx, ry, lx, ly)
    const back = worldToRegion(geo, w.x, w.y)
    if (!back || back.rx !== rx || back.ry !== ry || back.lx !== lx || back.ly !== ly) allBack = false
  }
  ok(allBack, 'every region-local tile round-trips through world coordinates')
}
ok(worldToRegion(geo, 400, 0)?.id === 'wilds-1-0', 'the tile past a region border belongs to the next region')
ok(worldToRegion(geo, 399, 0)?.id === 'wilds-0-0', '...and the tile before it does not')
ok(worldToRegion(geo, -1, 0) === null && worldToRegion(geo, 800, 0) === null, 'outside the world is null, not a wrapped read')

// ── 4. sparse grids — the memory property ─────────────────────────────────────────────────
{
  const g = sparseGrid(800, 800, WILDS_CLOUD)
  ok(g.length === 800 && g[0].length === 800, 'a sparse grid reads as its full size')
  ok(g[0][123] === WILDS_CLOUD, 'unloaded country reads as solid cloud — you cannot walk into it')
  ok(materializedRows(g) === 0, 'a fresh sparse grid holds no real rows at all')
  ok(g[0] === g[799], 'every unloaded row is the SAME object — that is where the saving comes from')
  let threw = false
  try { (g[0] as number[])[0] = 1 } catch { threw = true }
  ok(threw, '★ writing into the shared row THROWS rather than silently painting the whole world')

  const clone = cloneSparseGrid(g)
  ok(materializedRows(clone) === 0, "the engine's working copy does not materialize the world")
  ok(clone[0] === g[0], '...because shared rows are passed through by identity')

  materializeRows(clone, 5, 7)
  ok(materializedRows(clone) === 3, 'materializeRows gives exactly the rows asked for real storage')
  clone[6][2] = 99
  ok(g[6][2] === WILDS_CLOUD, '...and writing them cannot reach back into the source grid')
  ok(clone[6][2] === 99, '...while the write itself sticks')
  materializeRows(clone, 5, 7)
  ok(clone[6][2] === 99, 'materializing an already-real row is a no-op, not a wipe')
}
{
  const real = [[1, 2], [3, 4]]
  const c = cloneSparseGrid(real)
  c[0][0] = 9
  ok(real[0][0] === 1 && c[0][0] === 9, 'an ordinary dense grid still deep-copies exactly as before')
}

// ── 5. the load window ────────────────────────────────────────────────────────────────────
ok(wildsLoadRadius() > DEFAULT_RADIUS * CHUNK,
  '★ the load window is WIDER than the view window — or you can see country you cannot walk into')
{
  // The window is 512 tiles across against a 400-tile stride. An unaligned span of S over a
  // stride R touches floor(S/R)+2 cells at worst, so this straddles up to TWO borders: 3 region
  // columns and 3 rows, 9 loaded at the worst position. The margin cannot be shaved to get that
  // down to 4 — sync only runs when the player's CHUNK changes, so the buffer beyond sight has
  // to be at least one chunk wide or you outwalk the loader between syncs.
  ok(Math.floor((wildsLoadRadius() * 2) / WILDS_REGION) + 2 === 3,
    'the load window spans at most 3 regions per axis — 9 at a corner')
  {
    let worst = 0
    for (let wx = 0; wx < WILDS_REGION * 3; wx += 7) {
      const r = wildsLoadRadius()
      worst = Math.max(worst, Math.floor((wx + r) / WILDS_REGION) - Math.floor((wx - r) / WILDS_REGION) + 1)
    }
    ok(worst === 3, '...confirmed by sweeping every standing position, not just the formula')
  }
  const corner = regionsInWindow(geo, 399, 399)
  ok(corner.length === 4, 'standing on a four-corner of a 2x2 world loads all four')
  const edge = regionsInWindow(geo, 399, 200)
  ok(edge.some(r => r.id === 'wilds-1-0'), 'standing near a border loads across it')
  ok(regionsInWindow(geo, 200, 200).length <= 9, 'the loaded set is capped at 3x3, anywhere you stand')
  ok(regionsInWindow(geo, 60, 60)[0].id === 'wilds-0-0', 'the region under your feet sorts first')
}

// ── 6. mounting: what actually stays flat as the world grows ──────────────────────────────
{
  // 20x20 regions = 8000x8000 = 64M cells. Nothing here may be O(world) or it would not finish.
  const bigIds: string[] = []
  for (let ry = 0; ry < 20; ry++) for (let rx = 0; rx < 20; rx++) bigIds.push(wildsIdOf(rx, ry))
  const big = wildsGeometry(bigIds)
  ok(big.cols === 8000 && big.rows === 8000, 'a 400-region world is 8000x8000')
  const grid = sparseGrid(big.rows, big.cols, WILDS_CLOUD)
  const mount = newMount(big)
  const flat = () => Array.from({ length: WILDS_REGION }, () => new Array<number>(WILDS_REGION).fill(97))
  syncWilds(mount, grid, 200, 200, flat)
  ok(mount.loaded.size <= 9, 'the loaded region count is capped by the window, not the world')
  ok(materializedRows(grid) <= WILDS_REGION * 3,
    '★ at most three row bands hold data — 1200 rows out of 8000, at ANY world size')
  const r2 = syncWilds(mount, grid, 200, 200, flat)
  ok(r2.mounted.length === 0 && r2.released.length === 0, 'standing still mounts and releases nothing')

  // walk east across the border
  const before = materializedRows(grid)
  syncWilds(mount, grid, 399, 200, flat)
  ok(mount.loaded.has('wilds-1-0'), 'approaching the border loads the region beyond it')
  ok(materializedRows(grid) === before, '...sharing the same row band, so no new rows are allocated')
  ok(grid[200][400] === 97, 'and the country on the far side is really there before you arrive')

  // ★ the bug this test exists for: releasing a region must not blank its row-band neighbour
  syncWilds(mount, grid, 1200, 200, flat)
  ok(!mount.loaded.has('wilds-0-0'), 'walking on releases the region behind you')
  ok(grid[200][1200] === 97, 'the region you are standing in is intact')
  ok(grid[200][0] === WILDS_CLOUD, '...and the released one really was handed back')
  ok(grid[200][800] === 97, '★ the row-band NEIGHBOUR survived the release — no world falling away behind you')

  // walk far enough that nothing shares a band, and the rows must actually come back
  syncWilds(mount, grid, 4000, 4000, flat)
  ok(materializedRows(grid) <= WILDS_REGION * 3,
    'after crossing the whole world the row count is unchanged — memory is returned, not leaked')
  ok(isSharedRow(grid[200]), 'the abandoned band collapsed back to the shared row')

  const missing = syncWilds(newMount(big), grid, 200, 200, () => null)
  ok(missing.mounted.length === 0, 'a region whose file is missing is skipped, not a crash')
}
// ── 6b. the axis that DOES cost, stated honestly ──────────────────────────────────────────
// A materialized row is as wide as the WORLD, so cost is (row bands loaded x world width), not
// region count. That is fine at the design target and is not fine forever — assert the real
// number at the size the Wilds is actually planned to be, so a future widening trips this.
{
  const ids: string[] = []
  for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 6; rx++) ids.push(wildsIdOf(rx, ry))
  const g = wildsGeometry(ids)                       // 30 regions — the stated Wilds target
  const grid = sparseGrid(g.rows, g.cols, WILDS_CLOUD)
  const mount = newMount(g)
  syncWilds(mount, grid, 1000, 1000, () => Array.from({ length: WILDS_REGION }, () => new Array<number>(WILDS_REGION).fill(97)))
  const cells = materializedRows(grid) * g.cols
  ok(g.regions.length === 30 && g.cols === 2400, 'the target Wilds is 30 regions, 2400 tiles wide')
  ok(cells <= 3_000_000,
    `★ the whole 30-region Wilds costs ~${(cells / 1e6).toFixed(2)}M live cells (~${(cells * 8 / 1048576) | 0}MB) — a phone can hold that`)
  // The ceiling this design has: widen the world past ~10 regions and row-granular sparsity
  // stops paying, because a row costs the world's width whether or not it is near you.
  ok(materializedRows(grid) <= WILDS_REGION * 3, 'and it is still only three row bands')
}

// ── 7. ★ THE SEAM — on real generated terrain, walked, not asserted from gate numbers ─────
{
  const A = generateWildsRegion({ seed: SEED, rx: 0, ry: 0 })
  const B = generateWildsRegion({ seed: SEED, rx: 1, ry: 0 })
  ok(A.gates.east === B.gates.west,
    "★ neighbours agree on their shared border with no global pass — A's east IS B's west")
  ok(A.gates.east === edgeGate(SEED, 0, 0, 1, 0, WILDS_REGION), 'the gate is the edge hash, not a region property')

  const C = generateWildsRegion({ seed: SEED, rx: 0, ry: 1 })
  ok(A.gates.south === C.gates.north, '...and the same holds on a north-south border')

  const g2 = wildsGeometry(['wilds-0-0', 'wilds-1-0'])
  const grid = sparseGrid(g2.rows, g2.cols, WILDS_CLOUD)
  const mount = newMount(g2)
  syncWilds(mount, grid, 399, 200, id => (id === 'wilds-0-0' ? A.grid : id === 'wilds-1-0' ? B.grid : null))
  ok(mount.loaded.size === 2, 'both sides of the seam are mounted')

  const row = A.gates.east
  ok(grid[row][399] !== WILDS_FILL && grid[row][400] !== WILDS_FILL,
    '★ the border tiles either side of the gate are both walkable — the seam is open')

  // The real test: can you actually WALK from A's heart to B's heart? A flood fill over the
  // stitched world, which is the only thing that proves the corridors met rather than merely
  // ending at the same row. (Gate numbers matching is exactly what the staircase bug also had.)
  const seen = new Uint8Array(g2.cols * g2.rows)
  const start = A.heart.y * g2.cols + A.heart.x
  const stack = [start]; seen[start] = 1
  while (stack.length) {
    const i = stack.pop()!
    const x = i % g2.cols, y = (i / g2.cols) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= g2.cols || ny >= g2.rows) continue
      const j = ny * g2.cols + nx
      if (seen[j] || grid[ny][nx] === WILDS_FILL) continue
      seen[j] = 1; stack.push(j)
    }
  }
  const bHeart = regionToWorld(g2, 1, 0, B.heart.x, B.heart.y)
  ok(seen[bHeart.y * g2.cols + bHeart.x] === 1,
    "★★ YOU CAN WALK IT — a flood fill from region A's heart reaches region B's heart with no door")
  ok(seen[A.gates.east * g2.cols + 400] === 1, '...and the crossing goes through the shared border, as designed')
}

// ── 8. a region file's contents land in world space ───────────────────────────────────────
{
  const w = regionToWorld(geo, 1, 1, 250, 3)
  ok(w.x === 650 && w.y === 403, "a region's own gates/nodes offset into world coordinates")
  ok(regionToWorld(geo, 0, 0, 250, 3).x === 250, '...and region 0,0 is the identity, so today\'s seam keeps its numbers')
}

// ── 9. THE WIRED WORLD — the registry as the game actually sees it ────────────────────────
// Everything above proves the mechanism. This proves it was plugged in: one zone, the doors at
// the right tiles, and the country really under your feet once it mounts.
{
  const wilds = ALL_ZONES.find(z => z.id === WILDS_ZONE)
  ok(!!wilds, 'the Wilds are registered as ONE zone')
  ok(!ALL_ZONES.some(z => z.id.startsWith('r-wilds-')),
    '★ ...and the per-region Wilds zones are gone — a border is no longer a door')
  if (wilds) {
    ok(wilds.grid.length === WILDS_GEO.rows && wilds.grid[0].length === WILDS_GEO.cols,
      'it reads as the whole overland')
    ok(materializedRows(wilds.grid) === 0, 'and ships holding nothing until someone walks into it')

    // the way in, from the Outfields
    const inbound = ALL_ZONES.find(z => z.id === 'r-the-outfields')?.warps.filter(w => w.toZone === WILDS_ZONE) ?? []
    ok(inbound.length > 0, 'the Outfields still open onto the Wilds')
    const landing = inbound[0]

    const grid = cloneSparseGrid(wilds.grid)
    const mount = newMount(WILDS_GEO)
    syncWilds(mount, grid, landing.toX, landing.toY, loadWildsRegion)
    ok(mount.loaded.has('wilds-0-0'), 'arriving mounts the region you land in')
    ok(grid[landing.toY][landing.toX] !== WILDS_CLOUD,
      '★ you land on real ground, not inside the cloud that stands in for unloaded country')

    // the way back out, and it must not sit on top of the door you came through
    const outbound = wilds.warps.filter(w => w.toZone === 'r-the-outfields')
    ok(outbound.length > 0, 'the Wilds still open back onto the Outfields')
    ok(!outbound.some(w => w.fromX === landing.toX && w.fromY === landing.toY),
      '★ the inbound landing is clear of the return door — no instant re-warp loop')
    ok(!checkWarp(ALL_ZONES, WILDS_ZONE, landing.toX, landing.toY),
      '...checked the way the engine checks it, not by eye')

    // and the thing phase 3 is for: the next region over is reachable without any door at all
    syncWilds(mount, grid, WILDS_REGION + 100, 200, loadWildsRegion)
    ok(mount.loaded.has('wilds-1-0'), 'walking east mounts the next region with no warp involved')
    ok(!wilds.warps.some(w => parseWildsId(`wilds-1-0`) && w.toZone.startsWith('r-wilds')),
      'no Wilds warp points at another Wilds region — the seams are walked, not warped')
  }
}

console.log(`\nwilds-world: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
