// Chunk-coverage unit test — run with: npx tsx src/app/shimmer/engine/renderer.chunks.test.ts
//
// Asserts that visibleChunkRange() returns a chunk set that FULLY COVERS the
// 960×640 visible window for any camera position, with no gap. This is the
// seam-guard: a hole in chunk coverage = black seam on screen.

import { visibleChunkRange, CHUNK, TILE, WIDTH, HEIGHT } from './renderer'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const CS = CHUNK * TILE // 512 px per chunk

/**
 * For a given camera position and map size, verify that every pixel column [0,W)
 * and row [0,H) of the viewport is covered by at least one chunk in the returned range.
 * "Covered" means the chunk's world-pixel span intersects that pixel after camera offset.
 */
function coversViewport(
  camX: number, camY: number,
  mapCols: number, mapRows: number,
): boolean {
  const { minCCX, maxCCX, minCCY, maxCCY } = visibleChunkRange(camX, camY, mapCols, mapRows)
  const cx = Math.floor(camX)
  const cy = Math.floor(camY)

  // For each screen column, check at least one chunk in [minCCX,maxCCX] covers it
  for (let sx = 0; sx < WIDTH; sx++) {
    const worldX = cx + sx // world pixel this screen column corresponds to
    // Which chunk does this world pixel fall in?
    const ccx = Math.floor(worldX / CS)
    // It must be within the range (or the world pixel is out of map bounds, which
    // the camera clamp prevents — but we guard for edge-case maps smaller than viewport)
    if (worldX >= mapCols * TILE) continue // past map edge — camera clamp handles this
    if (ccx < minCCX || ccx > maxCCX) return false
  }

  for (let sy = 0; sy < HEIGHT; sy++) {
    const worldY = cy + sy
    const ccy = Math.floor(worldY / CS)
    if (worldY >= mapRows * TILE) continue
    if (ccy < minCCY || ccy > maxCCY) return false
  }

  return true
}

// --- Tests ---

// 1. Standard map (30×20), camera at origin
{
  ok('30×20 map, camX=0 camY=0 covers viewport', coversViewport(0, 0, 30, 20))
}

// 2. Standard map (30×20), camera at max (map fits exactly in viewport, cam locked to 0)
{
  ok('30×20 map, camX=0 camY=0 (map = viewport)', coversViewport(0, 0, 30, 20))
}

// 3. Larger map, camera mid-scroll
{
  ok('100×100 map, mid-scroll (camX=1234 camY=789)', coversViewport(1234, 789, 100, 100))
}

// 4. Camera at top-left corner
{
  ok('200×200 map, cam corner (0,0)', coversViewport(0, 0, 200, 200))
}

// 5. Camera at bottom-right (max cam = mapPx - viewportPx)
{
  const mapCols = 200, mapRows = 200
  const maxCamX = mapCols * TILE - WIDTH
  const maxCamY = mapRows * TILE - HEIGHT
  ok('200×200 map, cam at max corner', coversViewport(maxCamX, maxCamY, mapCols, mapRows))
}

// 6. Camera fractional (lerp mid-step)
{
  ok('200×200 map, fractional camX=100.7 camY=64.3', coversViewport(100.7, 64.3, 200, 200))
}

// 7. Map smaller than viewport (island map: 20×15)
//    Camera stays at 0,0 (clamped). Tiles past map edge are transparent; viewport
//    pixels past mapCols*TILE are skipped by the coverage check above.
{
  ok('20×15 map (smaller than viewport), cam (0,0)', coversViewport(0, 0, 20, 15))
}

// 8. Large map (300×300), camera at various positions
for (const [cx, cy] of [[0, 0], [512, 0], [0, 512], [4096, 3072], [9088, 9088]] as const) {
  const mapCols = 300, mapRows = 300
  const maxCamX = mapCols * TILE - WIDTH
  const maxCamY = mapRows * TILE - HEIGHT
  const clampedCX = Math.min(cx, maxCamX)
  const clampedCY = Math.min(cy, maxCamY)
  ok(`300×300 map, cam=(${clampedCX},${clampedCY})`, coversViewport(clampedCX, clampedCY, mapCols, mapRows))
}

// 9. Exactly on a chunk boundary (camX = CS, meaning world-pixel CS is the leftmost)
{
  ok('100×100 map, cam exactly on chunk boundary', coversViewport(CS, CS, 100, 100))
}

// 10. One pixel before chunk boundary
{
  ok('100×100 map, cam one pixel before chunk boundary', coversViewport(CS - 1, CS - 1, 100, 100))
}

// 11. Margin ring: the margin should pre-bake at least 1 chunk beyond the visible edge.
//     For a map 200×200 with cam at (0,0), minCCX must be 0 (clamped), maxCCX must be >= ceil(960/512)+1 - 1
//     and minCCY=0, maxCCY >= ceil(640/512)+1 - 1 (before clamping to mapChunkCols/Rows).
{
  const { minCCX, maxCCX, minCCY, maxCCY } = visibleChunkRange(0, 0, 200, 200)
  // Visible chunks: ccx 0..1 (960/512 = 1.875 → chunks 0 and 1), ring adds +1 → up to 2
  ok('margin ring extends maxCCX by 1 beyond visible', maxCCX >= Math.ceil(WIDTH / CS))
  ok('margin ring extends maxCCY by 1 beyond visible', maxCCY >= Math.ceil(HEIGHT / CS))
  ok('minCCX at map left edge is clamped to 0', minCCX === 0)
  ok('minCCY at map top edge is clamped to 0', minCCY === 0)
}

// 12. Eviction: chunks outside the range should NOT be in the keep set.
//    This is implicit in the range contract: range is tight to visible+1-ring.
//    Verify the range width/height is bounded (not the whole map).
{
  const mapCols = 300, mapRows = 300
  const { minCCX, maxCCX, minCCY, maxCCY } = visibleChunkRange(0, 0, mapCols, mapRows)
  const rangeW = maxCCX - minCCX + 1
  const rangeH = maxCCY - minCCY + 1
  // visible chunks: ceil(960/512)=2 + ceil(640/512)=2; with 1-ring margin each side
  // max expected range width = visibleChunksX + 2 (margin both sides) = 4
  ok('range width is bounded (not full map)', rangeW <= 5)
  ok('range height is bounded (not full map)', rangeH <= 5)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
