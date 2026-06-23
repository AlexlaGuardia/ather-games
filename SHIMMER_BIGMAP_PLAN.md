# Shimmer — Big Maps + Edgeless World (Plan)

> Goal (Alex, 2026-06-23, mobile feel-test): the F2P scale maps feel **too small**, and
> the real target is **"the player can't see the edge of the map."** That needs bigger
> maps AND boundary treatment. This plans the engine unlock + the design technique.
> Grounded in an Explore pass of the real render pipeline — file:line refs are current.

## TL;DR
"Can't see the edge" is two problems wearing one coat:
1. **Size** — maps must be big enough that you spend your time far from any boundary.
2. **Edge treatment** — every finite map HAS an edge; the fix is to dress it as natural
   impassable terrain (treeline / cliffs / water) so the clamp shows "world," not "void."

The thing blocking #1 is that the engine bakes the **whole map to one offscreen canvas**,
which hits iOS's ~16.78M-pixel canvas cap at ~128×128 tiles. The unlock is **chunked
baking**: bake only the tiles near the camera, stream chunks in/out as you move. After that,
map size is effectively unlimited for *rendering* (the remaining limits are RAM for the
collision grid and *authoring* huge maps — both later problems).

---

## Current architecture (verified)
- **Bake:** `renderer.cacheTilemap(grid, tiles)` (engine/renderer.ts:148) draws every tile
  into one `this.bgCache` canvas sized `cols*TILE × rows*TILE`. Plus `this.fgCache`
  (cacheOverlay:187) for "above" tiles (roofs/occluders). Re-baked only on zone change.
- **Blit/cull:** `drawBackground()` (:219) does ONE `drawImage(bgCache, camX,camY, 960,640 …)`
  — a window blit. That window IS the culling. No per-tile iteration.
- **Camera:** `centerOn()` (:114) follows player, clamps to `[0, mapPx − viewportPx]`.
- **Viewport:** `TILE=32`, `WIDTH=960`, `HEIGHT=640` (renderer.ts:6-8) → 30×20 tiles on screen.
- **DPR:** display canvas ×DPR; the **baked canvas is NOT** ×DPR, so the cap is pure world px.
- **Dynamic layers** (entities/NPCs/items/particles/seeds/crops) are drawn live per-frame and
  already viewport-culled — **unaffected** by this change.
- **Collision:** `walkable()` (engine/player.ts:207) → `SOLID[grid[ty][tx] & 0xFF]`
  (`SOLID[]` in world/tiles.ts). Border/wall tiles (indices 6–14) are SOLID. **Unaffected.**
- **No chunking/streaming exists today.**

The single-bake ceiling: 120×120 = 3840² = 14.7M px (safe). 150×150 = 5760² = 33M (crashes iOS).

---

## Phase 1 — Chunked background bake (the engine unlock)
**Contained to renderer.ts.** Camera, collision, dynamic-layer culling all unchanged.

### Design
- **Chunk size:** `CHUNK = 16` tiles → 512×512 px per chunk canvas (262K px each). Tunable const.
- **Replace** `bgCache`/`fgCache` single canvases with `bgChunks: Map<string,Canvas>` and
  `fgChunks: Map<string,Canvas|null>` keyed `"ccx,ccy"` (null fg = chunk has no above-tiles,
  so we never rebake it).
- `cacheTilemap()` → store `grid`+`tiles` refs, clear chunk maps. (No upfront full bake.)
- New `ensureChunks(camX,camY)`: compute the visible chunk range covering the 960×640 window
  **+ a 1-chunk margin ring**; bake any missing chunks on demand; evict chunks outside that set.
- `drawBackground()` → call `ensureChunks`, then for each visible chunk
  `drawImage(chunk, 0,0,CS,CS, ccx*CS−camX, ccy*CS−camY, CS,CS)` (floored offsets).
- `cacheOverlay` → same chunking into `fgChunks`; skip/mark-null chunks with no above-tiles.
- Edge chunks where the grid ends mid-chunk: draw in-grid tiles, leave the rest transparent —
  never shown because the camera clamps to `mapCols*TILE`.

### Memory (why this works)
Resident set is bounded by VISIBLE chunks, not map size: worst case ~5×5 = 25 chunks ×262K
≈ **6.5M px regardless of whether the map is 200² or 2000²**. Comfortably under the iOS cap.

### Eviction
v1: immediate eviction outside visible+1-ring (re-bake on return is sub-ms for 262K px).
If profiling shows GC churn from create/discard, add a small canvas pool — *not* in v1.

### Risks & mitigations
- **Seams/gaps at chunk borders** (off-by-one in rects) → the scary one. Mitigate with a
  **pure unit test** on the visible-chunk math: for sampled (camX,camY,mapDims), assert the
  returned chunk set fully tiles the 960×640 window with no gap/overlap error. Headless-testable.
- **Pop-in on fast scroll** (chunk not baked in time) → the 1-chunk margin pre-bake; escalate
  to async ring pre-bake only if it shows on device.
- **fgCache correctness** when chunked → covered by the same test + a device walk under a roof.
- **buildAnimMap** (:352) still scans the full grid once at zone-load to find animated-tile
  positions (drawAnimatedTiles already viewport-culls). O(cols*rows) one-time — fine to a few
  thousand²; bucket-by-chunk later if needed. Note, don't fix now.

### Verification
1. Build clean + run the doctor (`/shimmer/dev?mode=doctor`).
2. Unit test the chunk-coverage math (the gap/seam guard).
3. Smoke a big map: temporarily point a test zone at `createStubMap(300,300)` (ringed), confirm
   build + no iOS crash.
4. **Alex device pass** (his hands): seams, scroll smoothness, no pop-in, no crash on the big map.

### Effort
Focused single session — one file (renderer.ts) refactor + one test + verify. Medium complexity,
well-bounded. Delegate the implementation to `pixel` (owns the engine), I verify + Alex feel-tests.

---

## Phase 2 — Size + edge treatment (the "can't see the edge" payoff)
Once Phase 1 removes the ceiling:
- **Pick a real size.** Make it a tunable; start ~200×200 and let Alex dial by feel. Size and
  **walk-speed** are separate levers — a map can feel right by speeding the player, not shrinking.
- **`ringMap(grid, {tile, thickness, jitter})` helper** — fill the perimeter `thickness` tiles
  with an impassable **natural** tile (treeline/cliff/water from the SOLID set), with optional
  jitter so it reads as an irregular forest edge, not a ruler-straight wall. Inset `playerStart`
  + warps to the interior. The camera-clamp then reveals dense terrain, never raw boundary.
- **Boundary terrain is an art/canon call** (Alex): forest→treeline, meadow→hedgerow,
  water zone→lake shore, etc. Per-biome. Defer the look to him.

---

## Beyond (flagged, not now)
Chunking unlocks *rendering* at any size. Two later limits arrive for TRULY huge worlds:
- **Collision grid** stays full-size in RAM (`number[][]`) — fine to a few thousand² (a few MB).
- **Authoring** — can't hand-write giant array literals. Big maps need procedural fill /
  a painting tool. This is the bridge into the **decoration/content** conversation Alex flagged
  for after size is locked.

## Sequence
1. **Phase 1 chunked bake** ← the next build (green-light pending).
2. Lock a target size on a ringed test map (Alex feel).
3. Phase 2 edge-treatment styling per biome (Alex art call).
4. Then: decoration/content-fill of the big space (separate thread).
