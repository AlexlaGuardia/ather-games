// Greedy mesher — merges coplanar same-material faces into the fewest rectangles.
//
// ★ PURE CORE (see section.ts). No react, no three, no DOM. It emits into flat Float32Arrays that a
// renderer uploads directly; it never constructs a BufferGeometry itself, because that type is the
// host's problem and would nail this file to Three.js forever.
//
// WHY GREEDY AND NOT NAIVE: a naive mesher emits one quad per exposed face. A flat 32x32 floor is
// 1024 quads naive and ONE quad greedy. Our world is mostly flat ground and mostly-solid underground,
// which is the exact shape greedy meshing is best at — so the win here is much larger than the
// worst case suggests. The bench measures both so the ratio is a number, not a hope.
//
// The algorithm is the standard 3-axis slice sweep: for each axis, walk the S+1 planes between
// slices; build a mask of visible faces on that plane; then repeatedly take the top-left non-zero
// cell, grow it as wide as it can go, then as tall as it can go, emit that rectangle, and zero it.
// A face is visible only where exactly one side is solid — that single test is what removes every
// interior face, and it is why a solid section costs 6 quads instead of 6*S*S.

import { AIR, Section } from './section'
import { STRUCTURE, STRUCTURE_HALF } from './pieces'
import { isPlant, isHalfMat, isTopSlab, isSapling, MAT } from './depth'
import { isLeafMat, isLogMat } from './trees'

/**
 * How wide a trunk DRAWS, as a fraction of its cell.
 *
 * ── ★ 15% THINNER, AND IT IS A RENDER FACT ONLY (2026-08-13, Alex's call) ──────────────────────
 * A trunk is one voxel, so "thinner" cannot come from the generator — there is nothing between one
 * cell and none. It has to come from the mesher, which is the same split the world already lives
 * by: **the grid is load-bearing, the READ is not.** A log stays a full cell to collision, to
 * mining, to the light BFS and to every save; it merely draws as a slightly narrower box.
 *
 * ⚠ THE COST, STATED HONESTLY: logs are `placeable`, so a wall built out of RAW logs draws thin
 * too, with a 0.075 slot at every join. Planks are the building material and logs are the raw drop,
 * so this trades an unusual build's tidiness for the silhouette of every tree in the world. If
 * someone ever builds in raw logs and hates it, the fix is a free-standing test (all four
 * horizontal neighbours non-solid) — deliberately NOT done here, because that test costs four extra
 * `sample` calls per cell inside `fillSlice`, and the slump regression is the measurement that says
 * the sweep is CALL-bound and cannot afford them.
 */
export const TRUNK_WIDTH = 0.85

export interface MeshResult {
  /** xyz per vertex, 4 vertices per quad. */
  positions: Float32Array
  /** xyz per vertex, flat-shaded so all 4 share the quad's normal. */
  normals: Float32Array
  /** palette index per vertex — the renderer maps this to a material/atlas tile. */
  materials: Uint16Array
  /**
   * Corner ambient occlusion per vertex, 0 (fully tucked into a corner) to 3 (open).
   *
   * ── ★ WHY A VOXEL WORLD NEEDS THIS MORE THAN IT NEEDS BETTER TEXTURES (2026-08-11 → 08-12) ────
   * Alex asked "does our world have to be blocky?" The honest answer was that the GRID is load
   * bearing — mining, the light BFS, collision, ColumnSave and the DDA raycast all assume it — but
   * the READ is not, and the single biggest reason our cubes read as Lego rather than as a world
   * was that there was no ambient occlusion anywhere in the mesher. Not weak AO; none. Corner
   * darkening is most of what makes stacked cubes look like they share a space, and unlike trees or
   * a prop layer it needs no art, no canon ruling, and improves every block at once.
   */
  ao: Uint8Array
  /** 6 indices per quad (two triangles). */
  indices: Uint32Array
  quads: number
  /** Faces that were visible before merging — quads/faces is the greedy win ratio. */
  faces: number
}

/** Neighbour sampling at a section boundary. Returning AIR means "meshed as if exposed". */
export type NeighbourFn = (x: number, y: number, z: number) => number

const OUTSIDE_IS_AIR: NeighbourFn = () => AIR

/**
 * Does this cell stand at HALF height? Section-local coordinates; may be asked about neighbours
 * one step outside the section, exactly like `NeighbourFn`. See the half-cell block below.
 *
 * ★ THE SWEEP MUST NEVER LEARN THAT SLUMP EXISTS — it is CALL-bound, and this is a measurement,
 * not a preference (2026-08-11, the day slump shipped, and it shipped WITH the regression):
 *   · sweep asks a `half(x,y,z)` callback per cell ............ 22.2ms/column (from 10.5 baseline)
 *   · same, but only for sections that can hold a lip ......... 19.3ms  (barely helps — the
 *     sections that can hold a lip are exactly the ones that do the meshing work)
 *   · fold the test into the `sample` closure it already calls . 19.3ms  (no gain: two calls per
 *     sample became three; the indirection WAS the cost, not the work inside it)
 *   · hand it a section whose lips are already AIR ............. 10.6ms  ← this
 * At 19ms a single column blows a 16.7ms frame, which is exactly what the lag was. So the caller
 * strips the lips out of a COPY of the section and passes that; the inner loop stays byte-identical
 * to the pre-slump mesher, and the cost of the whole feature becomes one 8KB copy per surface
 * section. Do not "simplify" this back into a predicate.
 *
 * The map below is what the half pass draws FROM: section-local cells keyed by `halfKey`, valued
 * with the material the sweep can no longer see. It carries the one-cell ring (−1 .. S) as well,
 * so a lip can tell whether the neighbour beside it — including one in the next column — covers
 * its side. `null` means nothing here slumps and the pass is skipped whole.
 */
export type HalfCells = Map<number, number>

/**
 * ── ★★ WHERE THE WATER SURFACE ACTUALLY IS, PER COLUMN (2026-08-20) ───────────────────────────
 *
 * The water table is a SMOOTH bilinear field (`height.ts` `waterSurfaceAt`, a 96-block lattice)
 * but water is placed in WHOLE BLOCKS, so the rendered surface is a staircase: wherever the smooth
 * field crosses a block boundary the surface drops a step, and the step's riser is a vertical water
 * face. Measured on real terrain: **118 vertical water quads across 9 columns, every one exactly 1
 * block tall**, and a single 16x16 column carrying surface levels 113 AND 114. Underwater, with a
 * riverbed finally behind them, those risers read as walls of blue standing in open water.
 *
 * The fix is Minecraft's: give each surface quad's corners a height and let the sheet SLOPE. This
 * map is what that is computed from — section-local `(x, z)` INCLUDING the one-cell ring, valued
 * with the WORLD y of the surface plane (topmost water cell + 1). `null` means no water in reach
 * and every water path below is skipped whole.
 *
 * ★ IT IS A MAP AND NOT A PREDICATE, AND THAT IS THE MEASUREMENT ABOVE, NOT A PREFERENCE. A
 * per-cell `half(x,y,z)` callback cost 22.2ms/column against a 10.5 baseline and blew the frame;
 * *"the indirection WAS the cost, not the work inside it."* The caller precomputes, the sweep reads.
 *
 * ★ DERIVED FROM PLACED CELLS, NEVER FROM `waterSurfaceAt`. Three reasons, in order: the mesher
 * does not know worldgen exists and must not start (the same rule that keeps slump out of here); a
 * player-placed or edited pool has no entry in any noise field; and the averaging below is what
 * Minecraft does, so it degrades correctly at an edge instead of needing a special case.
 */
export interface WaterSurface {
  /**
   * Cell `(x, z)` INCLUDING the one-cell ring → the WORLD y of the block-quantized surface plane
   * (topmost water cell + 1). Answers one question only: *does this column's water end here?*,
   * which is what tells an internal riser apart from a real edge.
   */
  tops: Map<number, number>
  /**
   * Lattice CORNER `(x, z)` → the WORLD y of the true, un-quantized water table there.
   *
   * ★★ A CORNER'S HEIGHT MUST BE A PURE FUNCTION OF ITS WORLD POSITION, AND THAT IS A HARD
   * CONSTRAINT, NOT A STYLE. Minecraft averages the four fluid cells touching a corner; that
   * cannot work here, because a column can see its four edge-neighbours but **not its diagonals**
   * (`Neighbours` in `column.ts` carries negX/posX/negZ/posZ and nothing else). At each of a
   * column's four corners the diagonal cell is exactly the one neither side can agree about — two
   * columns would average different sets, land up to a quarter-block apart, and open a crack where
   * four quads meet. Sampling `waterTableAt` at the corner's world position removes the
   * neighbourhood from the question entirely, so both sides compute the identical number by
   * construction and continuity is not something anyone has to maintain.
   */
  corners: Map<number, number>
}

/** Key for either map. Accepts the one-cell ring, so -1 and S are legal on both axes. */
export const waterTopKey = (x: number, z: number, S: number): number => (x + 1) + (z + 1) * (S + 2)

/** Key for `HalfCells`. Accepts the one-cell ring, so −1 and S are legal on every axis. */
export const halfKey = (x: number, y: number, z: number, S: number): number =>
  ((y + 1) * (S + 2) + (z + 1)) * (S + 2) + (x + 1)

/**
 * Reusable scratch buffers for one section size.
 *
 * ★ THIS IS NOT A MICRO-OPTIMISATION. Sizing for the checkerboard worst case means ~626KB of typed
 * arrays at S=16 — allocated and thrown away on EVERY mesh call. Meshing runs on every block break
 * and on every chunk that enters the load radius, so allocating per call hands the GC megabytes per
 * second of garbage, which is the documented way browser voxel games die (§ 7 of the design doc).
 * Hold one scratch per worker and reuse it forever.
 */
export interface MeshScratch {
  size: number
  positions: Float32Array
  normals: Float32Array
  materials: Uint16Array
  indices: Uint32Array
  mask: Int32Array
  ao: Uint8Array
  /**
   * ── ★ TWO CACHED SLICES, AND THEY MADE AO CHEAPER THAN NOT HAVING IT ────────────────────────
   * A plane sits between two slices of cells. The sweep used to `sample()` both sides of every cell
   * — 2·S² lookups per plane — and AO then wanted eight MORE per visible face, which measured 53.4
   * ms/column against a 27.3 baseline. Sampling was the whole cost; the AO arithmetic was noise.
   *
   * So each slice is materialised ONCE into a flat grid (with a one-cell ring, which is what AO
   * needs and the old loop never had), and both the visibility test and the eight AO lookups become
   * array reads. Then the observation that pays for everything: **consecutive planes share a
   * slice.** Plane k's upper slice is plane k+1's lower slice, so the buffers swap and only one new
   * slice is filled per plane — `(S+2)²` samples where the old loop did `2·S²`. At S=32 that is
   * 1156 against 2048, so the mesher now takes FEWER samples per plane than it did before AO
   * existed, and the ring comes free with it.
   *
   * ⚠ The swap only holds while planes are contiguous. The uniform fast path jumps straight from
   * the low boundary plane to the high one, so `filled` tracks which slice is actually resident and
   * both are rebuilt when the jump breaks the chain. Getting that wrong reads as AO computed
   * against the wrong slice — shading that looks fine everywhere except at section boundaries.
   */
  sliceMatA: Int32Array
  sliceMatB: Int32Array
  sliceSolA: Uint8Array
  sliceSolB: Uint8Array
  /** OPAQUE-only occupancy, the second half of the rank (see `RANK` below). Parallel to `sliceSol*`
   *  and swapped with it, or the two disagree about which plane they hold. */
  sliceOpqA: Uint8Array
  sliceOpqB: Uint8Array
}

export function createMeshScratch(size: number): MeshScratch {
  // Worst case is a 3D checkerboard: half the cells solid, each with 6 exposed faces, nothing merges.
  const maxQuads = 3 * size * size * (size + 1)
  return {
    size,
    positions: new Float32Array(maxQuads * 12),
    normals: new Float32Array(maxQuads * 12),
    materials: new Uint16Array(maxQuads * 4),
    indices: new Uint32Array(maxQuads * 6),
    mask: new Int32Array(size * size),
    ao: new Uint8Array(maxQuads * 4),
    sliceMatA: new Int32Array((size + 2) * (size + 2)),
    sliceMatB: new Int32Array((size + 2) * (size + 2)),
    sliceSolA: new Uint8Array((size + 2) * (size + 2)),
    sliceSolB: new Uint8Array((size + 2) * (size + 2)),
    sliceOpqA: new Uint8Array((size + 2) * (size + 2)),
    sliceOpqB: new Uint8Array((size + 2) * (size + 2)),
  }
}

/**
 * ── ★ AO RIDES IN THE MASK KEY, WHICH IS WHY MERGING STAYS CORRECT FOR FREE ─────────────────────
 * The greedy sweep merges a run while `mask[n] === c`. If AO lived beside the mask in a second
 * array, every merge test would need a second compare in the hottest loop in the mesher — and this
 * file has already measured what an extra per-cell touch costs here (10.5 → 22.2 ms/column when
 * slump added one callback; the indirection WAS the cost, not the work inside it).
 *
 * So AO is packed into the mask value itself. The mask is `Int32Array`, materials occupy 10 bits
 * (`0xFF` base plus HALF_BIT/TOP_BIT), and four corners at 2 bits each is one byte — parked at
 * bit 16, far above anything a material can reach. The existing equality test then separates two
 * cells that differ ONLY in shading, at zero additional cost, because they are simply not equal.
 *
 * The consequence is the intended one: a flat field merges to a single quad exactly as before,
 * since its interior corners are all unoccluded and therefore all equal. Merging only breaks where
 * the shading genuinely changes, which is where a merged quad would have been wrong anyway.
 */
const AO_SHIFT = 16
const packAO = (a00: number, a10: number, a11: number, a01: number): number =>
  (a00 | (a10 << 2) | (a11 << 4) | (a01 << 6)) << AO_SHIFT

/**
 * The standard three-sample corner term. `side1`/`side2` are the two edge-adjacent cells on the
 * OPEN side of the face, `corner` is the diagonal between them.
 *
 * ★ TWO TOUCHING SIDES FULLY OCCLUDE REGARDLESS OF THE CORNER, and that special case is not an
 * optimisation — it is the difference between an inside corner reading as a seam and reading as a
 * crease. With both sides solid the diagonal cell is unreachable by light along this face, so
 * counting it would let a hollow inside-corner come out brighter than a filled one.
 */
const vertexAO = (side1: number, side2: number, corner: number): number =>
  side1 && side2 ? 0 : 3 - (side1 + side2 + corner)

/**
 * Integer hash of one world cell → u32. Feeds the leaf pass's per-cross orientation and size.
 *
 * ★ WORLD COORDINATES, WHICH IS THE ENTIRE REASON `origin` EXISTS. Section-local coordinates
 * restart at every section boundary, so hashing them stamps the identical 16-block pattern into
 * every section — trading a 1-block repeat for a 16-block one, which is MORE visible, not less.
 * The atlas shader's per-block jitter learned this the same way and says so in `atlas.ts`.
 */
function cellHash(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * ⚠ When `scratch` is supplied the returned arrays are VIEWS INTO IT, not copies. Upload or copy
 * them before the next `greedyMesh` call with the same scratch, or the previous mesh is overwritten
 * underneath you. That is the price of not allocating; it is stated here because the failure mode is
 * a silently corrupted mesh two frames later, not a crash.
 *
 * `origin` is this section's world corner. It affects NOTHING but the leaf pass's hash, and it
 * defaults to the origin so every existing caller and every bench keeps its exact current output.
 */
export function greedyMesh(
  sec: Section, neighbour: NeighbourFn = OUTSIDE_IS_AIR, scratch?: MeshScratch,
  half: HalfCells | null = null, origin: readonly [number, number, number] = [0, 0, 0],
  waterTops: WaterSurface | null = null,
): MeshResult {
  const S = sec.size
  const sc = scratch && scratch.size === S ? scratch : createMeshScratch(S)
  const { positions, normals, materials, indices, mask, ao } = sc
  // `let` because the two slices SWAP each plane — see MeshScratch.
  let sliceMatA = sc.sliceMatA, sliceMatB = sc.sliceMatB
  let sliceSolA = sc.sliceSolA, sliceSolB = sc.sliceSolB
  let sliceOpqA = sc.sliceOpqA, sliceOpqB = sc.sliceOpqB
  /** Row stride of a slice grid: the section plus its one-cell ring on each side. */
  const SW = S + 2
  /** This section's world y. `WaterTops` is keyed per column and valued in WORLD y — one map
   *  serves all 16 sections of a column, so the comparison has to happen in world space. */
  const oy0 = origin[1]

  /**
   * ── ★★ THE SLOPED SURFACE, MINECRAFT'S TRICK (2026-08-20) ────────────────────────────────────
   * Height of the water sheet at one lattice CORNER, in section-local y: the mean surface plane of
   * the water columns touching it. A corner is touched by four cells — `(cx-1,cz-1)` `(cx,cz-1)`
   * `(cx-1,cz)` `(cx,cz)` — and **dry columns are excluded from the mean rather than counted as
   * zero**, which is the whole reason a pond's edge stays at full height instead of collapsing to
   * the floor.
   *
   * ★ CONTINUITY IS FREE AND IS THE POINT. Two neighbouring quads compute their shared corner from
   * the same lattice position and the same four cells, so they agree EXACTLY and no crack can open
   * — including across merged quads, whose shared edge is a straight line between the same two
   * endpoints as its neighbour's. That is what lets merging stay untouched.
   *
   * ⚠ THE `<= 2` BAND IS NOT COSMETIC. Without it a corner where a hillside river passes above a
   * lower pond averages two unrelated water bodies and drags the sheet through the rock between
   * them. Only surfaces within a couple of blocks are the same sheet.
   */
  const cornerY = (cx: number, cz: number, fallback: number): number => {
    const t = waterTops!.corners.get(waterTopKey(cx, cz, S))
    if (t === undefined || !Number.isFinite(t)) return fallback
    // ⚠⚠ NO CLAMP TO THE QUAD'S OWN BLOCK, AND THE CLAMP I FIRST WROTE HERE WAS THE BUG.
    // Clamping the corner into `[fallback - 1, fallback]` looks like a harmless guard and is
    // anything but: `fallback` is the QUAD's lattice height, so the clamp makes a corner's height
    // depend on WHICH QUAD IS ASKING. At a step — the exact case this feature exists to smooth —
    // the two quads meeting at a corner sit on different levels, so the upper one accepted the true
    // table and the lower one clamped it a whole block down. Every step became a cliff between two
    // translucent sheets, and a lake read as a grid of blue boxes: worse than the staircase it
    // replaced. ★ THE PROPERTY THE WHOLE DESIGN RESTS ON IS THAT A CORNER IS A PURE FUNCTION OF
    // POSITION; a per-quad clamp silently destroys exactly that, and no assert about the clamp can
    // notice, because the clamp does what it says. The oracle now asserts CONTINUITY ACROSS A STEP
    // instead, which is the property rather than the mechanism.
    return t - oy0
  }

  mask.fill(0)

  let quads = 0
  let faces = 0

  const x = [0, 0, 0]
  const q = [0, 0, 0]
  const du = [0, 0, 0]
  const dv = [0, 0, 0]

  const sample = (a: number, b: number, c: number): number =>
    a >= 0 && a < S && b >= 0 && b < S && c >= 0 && c < S ? sec.get(a, b, c) : neighbour(a, b, c)

  // ⚠ THE ROAD HERE IS WORTH KNOWING, because the obvious implementation is the slow one and it
  // measures 5.6x. AO first sampled the world directly, eight times per visible face, building a
  // little coordinate array per sample: **27.3 → 153.9 ms/column at S=32.** Flattening those
  // allocations away got it to 53.4 — still 2x, and a block break re-meshes up to eight sections,
  // so that lands as a hitch on the game's core verb. The AO arithmetic was never the cost at any
  // point; the SAMPLING was. Only caching the two slices (see MeshScratch) fixed it, by removing
  // more lookups than AO added. Same lesson as slump's callback, one layer along: in this loop,
  // touching the world is expensive and everything else is free.

  // ★ THE UNIFORM FAST PATH — this is what makes world height nearly free.
  //
  // A section holding one value has NO interior faces by definition: every interior plane has the
  // same value on both sides, so the mask is all zeros and the sweep does S-1 planes of work per
  // axis to emit nothing. In a tall world that is most of the column — everything above the surface
  // is all-air, everything well below it is all-stone — so without this, column mesh cost scales
  // LINEARLY with world height purely from wasted sweeping (measured: 28.6ms at H=128 rising to
  // 115.3ms at H=512, against a floor of 10.6ms if uniform sections cost nothing).
  //
  // Only the two BOUNDARY planes per axis can carry a face, and only where a neighbour differs.
  // So: 6 planes instead of 3*(S+1) = 51. The result is bit-identical, which is why the existing
  // "solid section merges to 6 quads" and "solid inside solid emits nothing" asserts still hold —
  // they are exactly this case, and they were written before the fast path existed.
  const uniform = sec.uniformValue() !== null

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3
    const v = (d + 2) % 3
    /** Riser suppression applies to VERTICAL faces only — a `d === 1` plane is horizontal and has
     *  no riser to confuse with an edge. Hoisted out of the per-cell loop; it is loop-invariant. */
    const waterRisers = waterTops !== null && d !== 1
    x[0] = x[1] = x[2] = 0
    q[0] = q[1] = q[2] = 0
    q[d] = 1
    // Unit steps along the two in-plane axes, as scalars — loop-invariant for this axis, and the
    // reason the AO samples need no array indexing at all.
    const u0 = u === 0 ? 1 : 0, u1 = u === 1 ? 1 : 0, u2 = u === 2 ? 1 : 0
    const v0 = v === 0 ? 1 : 0, v1 = v === 1 ? 1 : 0, v2 = v === 2 ? 1 : 0

    /**
     * Materialise one slice of cells at `dc` along this axis, ring included, into `mat`/`sol`.
     * Indexed `(uu + 1) + (vv + 1) * SW` so the ring at −1 and S is addressable without a branch.
     */
    const fillSlice = (mat: Int32Array, sol: Uint8Array, opq: Uint8Array, dc: number): void => {
      const c0 = d === 0 ? dc : 0, c1 = d === 1 ? dc : 0, c2 = d === 2 ? dc : 0
      let i = 0
      for (let vv = -1; vv <= S; vv++) {
        for (let uu = -1; uu <= S; uu++) {
          const m = sample(c0 + uu * u0 + vv * v0, c1 + uu * u1 + vv * v1, c2 + uu * u2 + vv * v2)
          mat[i] = m
          // ★ A LEAF IS INVISIBLE TO THE SWEEP, for the same reason a plant and a piece are: its
          // geometry is not a unit cube. Leaves are crossed quads now (the leaf pass below), so a
          // leaf must neither be merged as a cube nor hide the faces of whatever is behind it —
          // reading as AIR here is what lets a trunk draw the bark a canopy used to bury.
          //
          // ⚠ THIS IS A RENDER FACT ONLY. Leaves stay solid to collision, to the light BFS and to
          // mining; nothing outside this mesher learns anything from this line. Same split as AO:
          // the grid is load-bearing, the READ is not.
          // ★ AND A LOG LEAVES THE SWEEP FOR THE SAME REASON, as of 2026-08-13: it no longer draws
          // as a unit cube either (see `TRUNK_WIDTH`). One arithmetic test on `m`, no extra sample
          // — which is the only kind of test this function can afford.
          // ★ A SAPLING RIDES THE LEAF PASS (2026-08-13). It is foliage the size of one cell, so
          // it wants exactly what a leaf wants — crossed quads, not a cube — and the pass that
          // draws those already exists. Building a second crossed-quad renderer for four materials
          // would be the same duplication the crown layout was just rescued from.
          // ⚠⚠ `sol` IS NOT ONLY THE FACE TEST — IT IS ALSO AO'S ARITHMETIC OPERAND. `vertexAO`
          // computes `3 - (side1 + side2 + corner)` straight off these values, and the mask test
          // below reads `=== 1`. So this array must stay strictly 0/1 and must keep meaning exactly
          // what it means today. Widening it into a 0/1/2 rank was the obvious way to fix water and
          // it is a trap twice over: an opaque occluder would contribute 2, taking AO to `3-6 = -3`
          // and moving every shadow in the world, while `=== 1` would simultaneously stop opaque
          // cells emitting faces at all. Neither would throw, and the lighting half would look like
          // an unrelated AO regression that appeared the same day. The rank lives in a SECOND array.
          sol[i] = m !== AIR && m !== STRUCTURE && m !== STRUCTURE_HALF && !isPlant(m)
            && !isLeafMat(m) && !isLogMat(m) && !isSapling(m) ? 1 : 0
          // ── ★★ RANK = sol + opq: air 0 · water 1 · opaque 2 ──────────────────────────────────
          // Water is `sol` (it occludes, and that is today's approved look — see the block above
          // the mask test) but it is NOT opaque, so it ranks between air and stone.
          opq[i] = sol[i] === 1 && m !== MAT.WATER ? 1 : 0
          i++
        }
      }
    }

    /** d-coordinate currently held in slice B, so a contiguous step can swap instead of refill. */
    let filled = Number.NaN

    const planes = uniform ? [-1, S - 1] : null
    let planeIdx = 0

    for (x[d] = planes ? planes[0] : -1; x[d] < S; ) {
      // ── materialise the two slices bounding this plane ────────────────────────────────────
      // Contiguous step: last plane's upper slice IS this plane's lower slice, so swap and fill
      // only the new one. Otherwise (first plane, or a uniform-section jump) build both.
      if (filled === x[d]) {
        const tm = sliceMatA; sliceMatA = sliceMatB; sliceMatB = tm
        const ts = sliceSolA; sliceSolA = sliceSolB; sliceSolB = ts
        const to = sliceOpqA; sliceOpqA = sliceOpqB; sliceOpqB = to
        fillSlice(sliceMatB, sliceSolB, sliceOpqB, x[d] + 1)
      } else {
        fillSlice(sliceMatA, sliceSolA, sliceOpqA, x[d])
        fillSlice(sliceMatB, sliceSolB, sliceOpqB, x[d] + 1)
      }
      filled = x[d] + 1

      // ── build the visibility mask for this plane ──────────────────────────────────────────
      let n = 0
      for (x[v] = 0; x[v] < S; x[v]++) {
        for (x[u] = 0; x[u] < S; x[u]++) {
          // Slice index for this cell. The +1s step over the ring.
          const si = (x[u] + 1) + (x[v] + 1) * SW
          const a = sliceMatA[si]
          const b = sliceMatB[si]
          // ★ PIECE OCCUPANCY IS INVISIBLE TO THE MESHER (2026-08-08). STRUCTURE cells are
          // collision bookkeeping — the piece RENDERER draws the look. Meshing them painted a
          // loud-magenta fallback cube around every placed piece (the design always said
          // "renders as a mesh"; this line is where that sentence becomes true). They read as
          // AIR here so neighbouring terrain still draws its faces behind a see-through piece.
          // ★ A SLUMPED CELL IS INVISIBLE TO THE SWEEP, exactly as piece occupancy is (2026-08-11).
          // Its geometry is not a unit cube, so it cannot take part in a merge that assumes one —
          // and reading it as AIR here is what makes the surrounding terrain draw the faces a
          // half-height neighbour exposes. The half pass below then draws the cell itself.
          // ⚠ Asked only about cells that are otherwise solid: `half` runs on every plane cell of
          // every plane, and the whole point of the uniform fast path is not to pay per cell.
          // ★ A SLUMPED CELL IS INVISIBLE HERE because `sample` already returned AIR for it — see
          // the HalfFn contract. Nothing about this loop knows slump exists, which is the point.
          // Ground cover is drawn by the instanced flora renderer, never here: a tuft is two
          // crossed quads, and crossed quads cannot merge — routing ~17k of them through this
          // mesher would add ~34k unmergeable quads to terrain meshes for geometry that is
          // already four draw calls. Same exclusion, same reason, as piece occupancy.
          // ── ★★ THE RANK TEST, AND WHY IT IS NOT "EXACTLY ONE SOLID" ANY MORE (2026-08-20) ────
          // It used to be. Water passed as an ordinary opaque cube, so a water↔stone boundary was
          // solid|solid and emitted NOTHING ON EITHER SIDE: every riverbed and channel wall in the
          // world had no geometry where it met water. A ray entered the ground, found no interior
          // faces (correctly culled) and left wherever the terrain next touched air — an x-ray hole
          // exactly the shape of the water. It survived from 08-07 because you were always looking
          // through a 0.78-opacity surface at a shallow angle and a missing bed reads convincingly
          // as deep water; going under puts you on the wrong side of the only thing hiding it.
          //
          // ★ THE OBVIOUS FIX IS THE WRONG ONE. Exempting water from the sweep the way leaves and
          // logs are exempted (three notes up) makes water↔air non-solid on BOTH sides and deletes
          // the water surface itself — a missing bed traded for a missing river. Water wants half
          // of that exemption: do not hide what is behind me, but do still draw me.
          //
          // So: rank differs => a face, and it belongs to the HIGHER side. water|air gives the
          // surface, water|stone gives the bed, stone|air is unchanged, equal ranks emit nothing.
          // Generalises to the next translucent material (glass, ice) instead of naming water here.
          const rankA = sliceSolA[si] + sliceOpqA[si]
          const rankB = sliceSolB[si] + sliceOpqB[si]
          const aSolid = rankA > rankB
          // ── ★★ A WALL OF WATER IS WATER FACING SOMETHING THE SWEEP CANNOT SEE ───────────────
          // A vertical water|"air" face is several different things wearing one shape, and the two
          // cells alone cannot tell them apart:
          //   · a SUBMERGED PLANT — and measured on real river terrain this is the COMMON case, not
          //     the step. Reeds on a riverbed are `isPlant`, so `fillSlice` reads them as AIR (the
          //     same exemption that lets terrain draw behind a leaf), and the water around one then
          //     cuts a face into its cell. The result is a blue panel standing INSIDE the water,
          //     visible through the plant's own crossed quads. Measured over 9 real river columns:
          //     118 vertical water faces total → 91 submerged cells, 11 step risers, 16 genuine
          //     edges. The staircase everyone would blame is the SMALLEST of the three.
          //   · a STEP between two water levels — the staircase the sloped corners replace. Leave
          //     the riser in and a slice of wall stands proud of the sheet it belongs to.
          //   · a true EDGE, where the neighbouring column holds no water at all (a bank, or water
          //     against a dry hollow). Drop THAT one and you see straight into the water body.
          // ★ One inequality covers the first two and spares the third: is the empty cell across
          // this face at or below the neighbouring column's own water surface? If so it is INSIDE
          // the body of water and no face belongs there. `tops` is the surface plane (topmost water
          // cell + 1), so submerged is `top >= cellY` — a plant three blocks down and a step riser
          // one block down both satisfy it, and a dry column has no entry at all.
          // On the face-positive path only: the same rare branch AO is already paid from, never the
          // per-cell budget the uniform fast path exists to protect.
          if (waterRisers && rankA !== rankB && (aSolid ? a : b) === MAT.WATER) {
            // The empty cell is whichever side lost the rank; only its d-coordinate differs, and d
            // is never 1 here (a horizontal face has no riser), so y is shared by both sides.
            const ax = aSolid && d === 0 ? x[0] + 1 : x[0]
            const az = aSolid && d === 2 ? x[2] + 1 : x[2]
            const top = waterTops!.tops.get(waterTopKey(ax, az, S))
            if (top !== undefined && top >= x[1] + oy0) { mask[n] = 0; n++; continue }
          }
          if (rankA === rankB) mask[n] = 0
          else {
            // ★ AO IS COMPUTED ONLY ON THE FACE-POSITIVE BRANCH. The mask loop runs over every cell
            // of every plane and the uniform fast path exists because that is the expensive part —
            // so the eight extra samples must never be paid by the cells that emit nothing. In
            // terrain, faces are a small minority of plane cells, which is what keeps this
            // affordable at all.
            //
            // Occluders sit on the OPEN side of the face: the air side, since that is where light
            // would have to come from. `od` is that plane; the eight samples ring the face in u/v.
            // Occluders live on the OPEN side of the face — the air side, since that is where
            // light would have to arrive from. That is slice B for a front face, slice A for a
            // back one, and both are already resident, so the eight lookups are array reads at
            // fixed offsets around `si`.
            // ★★ AO IS PROVABLY UNCHANGED FOR EVERY FACE THAT ALREADY EXISTED, BY CONSTRUCTION
            // RATHER THAN BY CARE. Every pre-existing face had air on its open side, so `openRank`
            // is 0, so this picks the very same `sliceSol*` array it always did, on the same side,
            // and the eight samples below are byte-identical. The new branch cannot reach an old
            // face because an old face never had water as its open side.
            //
            // ★ AND FOR THE NEW ONES, WATER MUST NOT OCCLUDE. A bed face's open side is water,
            // which is `sol=1`, so reusing that array would give every one of the eight samples an
            // occluder and bake a PITCH-BLACK riverbed under every river — full occlusion arriving
            // as a shadow rather than as an error. Under water what blocks light is the ground, so
            // the occluder set there is opaque-only. This changes no existing shading and is a fresh
            // decision only where there was nothing to change.
            const openRank = aSolid ? rankB : rankA
            const sol = openRank === 0 ? (aSolid ? sliceSolB : sliceSolA)
                                       : (aSolid ? sliceOpqB : sliceOpqA)
            const nU = sol[si - 1], pU = sol[si + 1]
            const nV = sol[si - SW], pV = sol[si + SW]
            const a00 = vertexAO(nU, nV, sol[si - 1 - SW])
            const a10 = vertexAO(pU, nV, sol[si + 1 - SW])
            const a11 = vertexAO(pU, pV, sol[si + 1 + SW])
            const a01 = vertexAO(nU, pV, sol[si - 1 + SW])
            const shade = packAO(a00, a10, a11, a01)
            if (aSolid) mask[n] = a | shade
            else mask[n] = -(b | shade)
            faces++
          }
          n++
        }
      }

      x[d]++

      // ── greedily merge the mask into rectangles ───────────────────────────────────────────
      n = 0
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; ) {
          const c = mask[n]
          if (c === 0) { i++; n++; continue }

          let w = 1
          while (i + w < S && mask[n + w] === c) w++

          let h = 1
          grow: while (j + h < S) {
            for (let k = 0; k < w; k++) if (mask[n + k + h * S] !== c) break grow
            h++
          }

          // ── emit ──
          x[u] = i
          x[v] = j
          du[0] = du[1] = du[2] = 0
          dv[0] = dv[1] = dv[2] = 0
          du[u] = w
          dv[v] = h

          const back = c < 0
          const key = back ? -c : c
          const mat = key & 0xFFFF
          const shade = (key >> AO_SHIFT) & 0xFF
          // Canonical corner order is the FRONT winding: (0,0) (1,0) (1,1) (0,1) in u/v.
          const s00 = shade & 3, s10 = (shade >> 2) & 3, s11 = (shade >> 4) & 3, s01 = (shade >> 6) & 3
          const p = quads * 12
          // Wind the quad so the front face points along the material's side of the plane.
          if (back) {
            positions[p + 0] = x[0];                 positions[p + 1] = x[1];                 positions[p + 2] = x[2]
            positions[p + 3] = x[0] + dv[0];         positions[p + 4] = x[1] + dv[1];         positions[p + 5] = x[2] + dv[2]
            positions[p + 6] = x[0] + du[0] + dv[0]; positions[p + 7] = x[1] + du[1] + dv[1]; positions[p + 8] = x[2] + du[2] + dv[2]
            positions[p + 9] = x[0] + du[0];         positions[p + 10] = x[1] + du[1];        positions[p + 11] = x[2] + du[2]
          } else {
            positions[p + 0] = x[0];                 positions[p + 1] = x[1];                 positions[p + 2] = x[2]
            positions[p + 3] = x[0] + du[0];         positions[p + 4] = x[1] + du[1];         positions[p + 5] = x[2] + du[2]
            positions[p + 6] = x[0] + du[0] + dv[0]; positions[p + 7] = x[1] + du[1] + dv[1]; positions[p + 8] = x[2] + du[2] + dv[2]
            positions[p + 9] = x[0] + dv[0];         positions[p + 10] = x[1] + dv[1];        positions[p + 11] = x[2] + dv[2]
          }

          // ★ Only the water SHEET slopes: a `+Y` water face exists exactly where water meets air
          // above it, so this is the surface by construction and no extra test is needed to find
          // it. Read each corner's own (x, z) back out of the positions just written rather than
          // re-deriving the u/v axis mapping — the winding already differs between front and back
          // faces and that is precisely the kind of duplicated index arithmetic that goes quietly
          // wrong. Emission-time, so it is paid per QUAD, never per cell.
          if (waterTops !== null && d === 1 && !back && mat === MAT.WATER) {
            for (let k = 0; k < 4; k++) {
              const o = p + k * 3
              positions[o + 1] = cornerY(positions[o], positions[o + 2], positions[o + 1])
            }
          }

          const nx = d === 0 ? (back ? -1 : 1) : 0
          const ny = d === 1 ? (back ? -1 : 1) : 0
          const nz = d === 2 ? (back ? -1 : 1) : 0
          for (let k = 0; k < 4; k++) {
            normals[p + k * 3 + 0] = nx
            normals[p + k * 3 + 1] = ny
            normals[p + k * 3 + 2] = nz
            materials[quads * 4 + k] = mat
          }

          // ⚠ THE BACK WINDING VISITS THE CORNERS IN A DIFFERENT ORDER, so the shading has to be
          // reordered with it. The front quad walks (0,0)(1,0)(1,1)(0,1); the back quad swaps du and
          // dv to face the other way, giving (0,0)(0,1)(1,1)(1,0). Writing the canonical order onto
          // both would mirror the AO on every back face — subtly wrong, and invisible until you
          // stand at an inside corner and one wall's shading runs the wrong way.
          const base = quads * 4
          if (back) {
            ao[base] = s00; ao[base + 1] = s01; ao[base + 2] = s11; ao[base + 3] = s10
          } else {
            ao[base] = s00; ao[base + 1] = s10; ao[base + 2] = s11; ao[base + 3] = s01
          }

          // ── ★ THE FLIP: A QUAD IS TWO TRIANGLES AND THE DIAGONAL IS VISIBLE ────────────────────
          // Interpolating four corner values across a fixed diagonal makes the two triangles
          // disagree wherever the corners are asymmetric — the classic voxel-AO artifact, a hard
          // crease running the wrong way across a face, most obvious on the outside corner of a
          // step. Choosing the diagonal that joins the two BRIGHTEST opposing corners hides the
          // seam, because the interpolation error lands where the gradient is flattest.
          //
          // This is why the winding is chosen here rather than baked once: the same rectangle needs
          // a different triangulation depending only on its shading.
          const ii = quads * 6
          const flip = ao[base] + ao[base + 2] > ao[base + 1] + ao[base + 3]
          if (flip) {
            indices[ii + 0] = base + 1
            indices[ii + 1] = base + 2
            indices[ii + 2] = base + 3
            indices[ii + 3] = base + 1
            indices[ii + 4] = base + 3
            indices[ii + 5] = base
          } else {
            indices[ii + 0] = base
            indices[ii + 1] = base + 1
            indices[ii + 2] = base + 2
            indices[ii + 3] = base
            indices[ii + 4] = base + 2
            indices[ii + 5] = base + 3
          }
          quads++

          for (let l = 0; l < h; l++) for (let k = 0; k < w; k++) mask[n + k + l * S] = 0
          i += w
          n += w
        }
      }

      // Uniform sections jump straight from the low boundary plane to the high one; everything
      // between is provably faceless. Non-uniform sections just continue, already advanced above.
      if (planes) {
        planeIdx++
        x[d] = planeIdx < planes.length ? planes[planeIdx] : S
      }
    }
  }

  // ── ★ THE HALF PASS — slumped cells, drawn one at a time and on purpose ──────────────────────
  // Terrain slump (slump.ts) shaves the top half off a step's lip so a 1-block rise walks as two
  // half-steps. Those cells left the sweep above, so they are drawn here: top face at +0.5, and a
  // 0.5-tall side wherever the horizontal neighbour does not already cover it.
  //
  // NO MERGING, deliberately. A slumped cell is the LIP of a terrace edge, so they come in strings
  // one or two cells wide, never in the fields greedy exists to collapse — at most one per column
  // footprint by construction, and only in the surface section. Measured worst case is 5 quads on
  // ≤S² cells; a merge pass over that would cost more to maintain than it could ever save.
  //
  // What is deliberately NOT drawn: the bottom face. The cell below is solid, so the sweep already
  // emitted its top face at this exact plane — sitting inside the half's own volume, invisible, and
  // merged into its neighbours' tops for free. Drawing a bottom here would z-fight it.
  if (half !== null) {
    const maxQuads = (positions.length / 12) | 0
    const emit = (
      px: number, py: number, pz: number, ux: number, uy: number, uz: number,
      vx: number, vy: number, vz: number, nx: number, ny: number, nz: number, mat: number,
    ) => {
      if (quads >= maxQuads) return
      const p = quads * 12
      positions[p + 0] = px;           positions[p + 1] = py;           positions[p + 2] = pz
      positions[p + 3] = px + ux;      positions[p + 4] = py + uy;      positions[p + 5] = pz + uz
      positions[p + 6] = px + ux + vx; positions[p + 7] = py + uy + vy; positions[p + 8] = pz + uz + vz
      positions[p + 9] = px + vx;      positions[p + 10] = py + vy;     positions[p + 11] = pz + vz
      for (let k = 0; k < 4; k++) {
        normals[p + k * 3 + 0] = nx
        normals[p + k * 3 + 1] = ny
        normals[p + k * 3 + 2] = nz
        materials[quads * 4 + k] = mat
      }
      const base = quads * 4
      // ★ SLUMPED LIPS TAKE NO AO, and that is a decision rather than a gap. A lip is a half-height
      // cell whose geometry is not a unit cube, so the corner test above — which asks about whole
      // neighbouring cells — does not describe it. Shading it with the cube rule would darken the
      // one surface a player walks across most, on evidence that does not apply to its shape.
      // Unoccluded (3) is the honest default until a lip-shaped term exists.
      ao[base] = 3; ao[base + 1] = 3; ao[base + 2] = 3; ao[base + 3] = 3
      const ii = quads * 6
      indices[ii + 0] = base; indices[ii + 1] = base + 1; indices[ii + 2] = base + 2
      indices[ii + 3] = base; indices[ii + 4] = base + 2; indices[ii + 5] = base + 3
      quads++
      faces++
    }
    // Winding rule, the same one the sweep obeys: cross(u, v) must equal the face normal.
    // Iterates the slabs themselves — never the section — so this pass costs what slabs cost.
    //
    // ★ COVERAGE IS A SPAN, NOT A BOOLEAN (2026-08-11, with top slabs). A cell's neighbour may fill
    // all of it, its lower half, its upper half, or none — so a bottom slab beside a top slab has
    // BOTH its side and the neighbour's exposed, and each must draw. Collapsing this back to
    // "is the neighbour solid" punches see-through gaps into any staircase built from slabs.
    const LOWER = 1, UPPER = 2, FULL = 3
    const coverOf = (m: number): number =>
      (m === AIR || m === STRUCTURE || m === STRUCTURE_HALF || isPlant(m)) ? 0
        : !isHalfMat(m) ? FULL : isTopSlab(m) ? UPPER : LOWER
    for (const [k, m] of half) {
      const cx = (k % (S + 2)) - 1
      const z = ((k / (S + 2)) | 0) % (S + 2) - 1
      const y = ((k / ((S + 2) * (S + 2))) | 0) - 1
      if (cx < 0 || cx >= S || y < 0 || y >= S || z < 0 || z >= S) continue   // ring entry: context only
      const top = isTopSlab(m)
      const lo = top ? y + 0.5 : y
      const hi = top ? y + 1 : y + 0.5
      const mine = top ? UPPER : LOWER

      // Top face, unless something solid sits directly on it (only possible for a top slab).
      if (!top || coverOf(sample(cx, y + 1, z)) === 0) emit(cx, hi, z, 0, 0, 1, 1, 0, 0, 0, 1, 0, m)
      // Underside. A bottom slab resting on solid ground has none — the sweep already emitted that
      // ground's top face at this exact plane, and drawing ours would z-fight it. A top slab's
      // underside is always open, and so is a bottom slab placed in mid-air.
      const below = top ? 0 : coverOf(sample(cx, y - 1, z)) & UPPER
      if (below === 0) emit(cx, lo, z, 1, 0, 0, 0, 0, 1, 0, -1, 0, m)
      const side = (dx: number, dz: number): boolean =>
        (coverOf(sample(cx + dx, y, z + dz)) & mine) !== mine
      if (side(1, 0)) emit(cx + 1, lo, z, 0, 0.5, 0, 0, 0, 1, 1, 0, 0, m)
      if (side(-1, 0)) emit(cx, lo, z, 0, 0, 1, 0, 0.5, 0, -1, 0, 0, m)
      if (side(0, 1)) emit(cx, lo, z + 1, 1, 0, 0, 0, 0.5, 0, 0, 0, 1, m)
      if (side(0, -1)) emit(cx, lo, z, 0, 0.5, 0, 1, 0, 0, 0, 0, -1, m)
    }
  }

  // ── ★ THE TRUNK PASS — a log draws 15% thinner than its cell ─────────────────────────────────
  // Alex, 2026-08-13: *"first the trunk, can we make them a bit thinner (just like 15%)."*
  //
  // A per-cell box rather than an inset applied to the greedy sweep's output, and the reason is the
  // corner: insetting a merged +X face along its normal still leaves its Z extent running the full
  // width of the cell, so it would stick out past the inset +Z face as a visible fin. Getting that
  // right inside the sweep means shrinking merged rectangles per-edge, on evidence about which
  // edges are exposed that the sweep has already thrown away. A box per log cell is exact, and it
  // is affordable for a reason worth writing down: the census counts **2,011 log voxels against
  // 29,393 leaves** in a radius-6 Thicket view, so trunks are ~7% of the foliage's cell count and
  // this pass is noise beside the leaf pass sitting under it.
  //
  // NO MERGING, like the leaf and half passes: an inset box is not coplanar with its neighbours.
  // Faces adjacent to another LOG are skipped — that is the trunk's own interior, and it is what
  // keeps a 12-block trunk at 4 side quads per cell instead of 6.
  if (!uniform || isLogMat(sec.uniformValue()!)) {
    const maxQuads = (positions.length / 12) | 0
    // The trunk's nominal half-inset. The flare below eats into it per cell, so a base log is wider
    // than TRUNK_WIDTH and everything above it is exactly TRUNK_WIDTH, as before.
    const tBase = (1 - TRUNK_WIDTH) / 2
    /** Winding rule, same as everywhere else in this file: cross(u, v) must equal the face normal. */
    const face = (
      px: number, py: number, pz: number, ux: number, uy: number, uz: number,
      vx: number, vy: number, vz: number, nx: number, ny: number, nz: number, mat: number, shade: number,
    ) => {
      const p = quads * 12
      positions[p + 0] = px;           positions[p + 1] = py;           positions[p + 2] = pz
      positions[p + 3] = px + ux;      positions[p + 4] = py + uy;      positions[p + 5] = pz + uz
      positions[p + 6] = px + ux + vx; positions[p + 7] = py + uy + vy; positions[p + 8] = pz + uz + vz
      positions[p + 9] = px + vx;      positions[p + 10] = py + vy;     positions[p + 11] = pz + vz
      const base = quads * 4
      for (let k = 0; k < 4; k++) {
        normals[p + k * 3 + 0] = nx; normals[p + k * 3 + 1] = ny; normals[p + k * 3 + 2] = nz
        materials[base + k] = mat
        ao[base + k] = shade
      }
      const ii = quads * 6
      indices[ii + 0] = base; indices[ii + 1] = base + 1; indices[ii + 2] = base + 2
      indices[ii + 3] = base; indices[ii + 4] = base + 2; indices[ii + 5] = base + 3
      quads++
      faces++
    }
    let full = false
    for (let y = 0; y < S && !full; y++) {
      for (let z = 0; z < S && !full; z++) {
        for (let x = 0; x < S; x++) {
          const m = sec.get(x, y, z)
          if (!isLogMat(m)) continue
          if (quads + 6 > maxQuads) { full = true; break }
          // ── ★ ROOT FLARE — the trunk stops being an extruded rectangle (2026-08-13) ───────────
          // With the crown fixed, the trunk was the last thing in the forest still reading as a
          // primitive: one width, held exactly, from the soil to the canopy. Real stems thicken
          // where they meet the ground, and the eye uses that taper to tell a tree from a post.
          //
          // ★ RENDER-ONLY, AND THAT IS WHY IT IS AFFORDABLE. A tapered trunk in the GENERATOR
          // would mean a 2-wide base, which is four log voxels where there was one — new drops,
          // new chop timings, a different tree to fell, and a decay graph that changes shape. The
          // flare is worth none of that. Here it costs two samples on a cell already being visited
          // and the world underneath is untouched: the same one voxel, mined the same way.
          //
          // ⚠ THE TEST IS "STANDS ON SOLID GROUND", NOT "HAS NO LOG BELOW", and the difference is
          // starwillow. Its forking limbs lean by stepping sideways every other block, so half of
          // every limb's logs have AIR underneath them — a bare no-log-below test flared all of
          // them and beaded the limbs like a string of knuckles. Requiring the cell below to be
          // solid-and-not-log means only a stem actually meeting the terrain gets a foot.
          //
          // The mesher still has no surface height and must not acquire one: this stays a local
          // question with the same answer at any column alignment, which is what keeps the seam.
          const b1 = sample(x, y - 1, z), b2 = sample(x, y - 2, z)
          const rooted = (v: number) => v !== AIR && !isLogMat(v)
          const flare = rooted(b1) ? 0.14 : isLogMat(b1) && rooted(b2) ? 0.07 : 0
          const t = tBase - flare / 2
          const a = x + t, b = x + 1 - t, c = z + t, e = z + 1 - t
          const w = b - a
          // Same enclosure shading the leaf pass uses, and it earns its keep here: a trunk standing
          // inside its own canopy should read darker than one out in a clearing, which is most of
          // what stops a pole looking pasted onto the scene.
          let enc = 0
          if (sample(x + 1, y, z) !== AIR) enc++
          if (sample(x - 1, y, z) !== AIR) enc++
          if (sample(x, y + 1, z) !== AIR) enc++
          if (sample(x, y - 1, z) !== AIR) enc++
          if (sample(x, y, z + 1) !== AIR) enc++
          if (sample(x, y, z - 1) !== AIR) enc++
          const sh = enc >= 6 ? 1 : enc >= 5 ? 2 : 3
          if (!isLogMat(sample(x + 1, y, z))) face(b, y, c, 0, 1, 0, 0, 0, e - c, 1, 0, 0, m, sh)
          if (!isLogMat(sample(x - 1, y, z))) face(a, y, c, 0, 0, e - c, 0, 1, 0, -1, 0, 0, m, sh)
          if (!isLogMat(sample(x, y, z + 1))) face(a, y, e, w, 0, 0, 0, 1, 0, 0, 0, 1, m, sh)
          if (!isLogMat(sample(x, y, z - 1))) face(a, y, c, 0, 1, 0, w, 0, 0, 0, 0, -1, m, sh)
          if (!isLogMat(sample(x, y + 1, z))) face(a, y + 1, c, 0, 0, e - c, w, 0, 0, 0, 1, 0, m, sh)
          if (!isLogMat(sample(x, y - 1, z))) face(a, y, c, w, 0, 0, 0, 0, e - c, 0, -1, 0, m, sh)
        }
      }
    }
  }

  // ── ★ THE LEAF PASS — the canopy stops being a green box ─────────────────────────────────────
  // Alex, on whether the world has to look blocky: the grid is load-bearing, the READ is not. AO
  // was the first answer; leaf-cubes were the biggest remaining silhouette offender, because a
  // canopy is the one place the world puts a large opaque cube where the eye expects a ragged edge.
  //
  // ★ THE ALTERNATIVE WAS TO STOP MAKING LEAVES VOXELS AT ALL — swapping trees for GLTF props
  // through the (play3d-only) prop layer. That would have killed chopping outright: logs carry the
  // whole forestry economy (drops, skill XP, tier gates, every plank and blade and spade recipe),
  // leaves are breakable, and `Column.overrides` exists specifically so a chopped tree stays
  // chopped. Trees stay voxels. Only their geometry changes.
  //
  // ★ AND IT IS AFFORDABLE, MEASURED RATHER THAN HOPED (`scripts/leaf-census.mts`). The instance
  // count looked alarming — 59k exposed leaf voxels at max radius in the Thicket — but that was the
  // wrong number. Meshed for real at radius 6: the canopy already emits **31,481 quads** because a
  // blob of radius 3-5 has almost nothing coplanar to merge, against **34,776** as crossed quads.
  // 1.10x the leaves, **1.01x the world**. The greedy mesher was never winning here.
  //
  // NO MERGING, like the half pass and for the same reason: crossed quads are not coplanar with
  // anything, so there is nothing a merge pass could collapse.
  // ⚠ A uniform section cannot hold a mixed canopy, so scanning 4096 cells of solid air or solid
  // stone to find nothing is pure waste — and it is most of the column. Same argument as the sweep's
  // own uniform fast path, which is what keeps world height nearly free.
  //
  // ── ★ EVERY CROSS WAS IDENTICAL, AND THAT WAS THE OTHER HALF OF "THE TREES LOOK LIKE UMBRELLAS"
  // (2026-08-12). The first cut emitted both quads at a fixed 45°/135°, full cell width, dead centre
  // — so a canopy was a LATTICE of the same X repeated on a perfect grid, which the eye reads as a
  // textured slab rather than as foliage. The crossed-quad trick buys a ragged silhouette only if
  // the crosses disagree with each other. Yaw, width and offset are now hashed per world cell:
  // deterministic (a remesh reproduces it exactly), free (one hash, four bit-slices of it) and
  // invisible to every other system, because leaves remain ordinary voxels.
  if (!uniform || isLeafMat(sec.uniformValue()!) || isSapling(sec.uniformValue()!)) {
    const maxQuads = (positions.length / 12) | 0
    // ★ THE CROSS NOW SPILLS PAST ITS OWN CELL, and that is the other half of the density fix.
    // A cross inset inside its cube leaves a gap at every cell boundary, and a canopy is a grid of
    // those gaps — the lattice you can see the trunk through. Letting the quads overlap their
    // neighbours closes the seams for FREE: the quad count is unchanged, only its width, so this
    // costs vertex area rather than draw calls or geometry.
    //
    // The old inset existed so two neighbouring canopies could not z-fight along a shared face.
    // Nothing here is coplanar any more — yaw is hashed per world cell, so two crosses agreeing on
    // a plane to the last bit is not a case that occurs.
    const K = 0.5
    const [owx, owy, owz] = origin
    // ⚠ `break` would leave the two outer loops running. The scratch is sized for the checkerboard
    // worst case so this should never trip, but "should never" plus a partial exit is how a mesh
    // comes back silently missing its top half.
    let full = false
    for (let y = 0; y < S && !full; y++) {
      for (let z = 0; z < S && !full; z++) {
        for (let x = 0; x < S; x++) {
          const m = sec.get(x, y, z)
          const sapling = isSapling(m)
          if (!isLeafMat(m) && !sapling) continue
          if (quads + 2 > maxQuads) { full = true; break }

          // ★ DEPTH SHADING FROM ENCLOSURE, since corner AO cannot describe a quad that is not a
          // face. A leaf walled in by other leaves is deep inside the canopy and should read dark;
          // one on the rim should catch light. Counting the six neighbours costs six lookups on a
          // cell we are already visiting and is what stops the canopy reading as one flat colour.
          let enclosed = 0
          if (sample(x + 1, y, z) !== AIR) enclosed++
          if (sample(x - 1, y, z) !== AIR) enclosed++
          if (sample(x, y + 1, z) !== AIR) enclosed++
          if (sample(x, y - 1, z) !== AIR) enclosed++
          if (sample(x, y, z + 1) !== AIR) enclosed++
          if (sample(x, y, z - 1) !== AIR) enclosed++
          // ── ★ THE SIX-SIDED CULL IS GONE, AND IT WAS THE "YOU CAN SEE THE TRUNK" BUG (2026-08-13)
          // Alex: *"the foliage is too sparse so the trunk is clearly visible through the leaves."*
          //
          // This pass used to skip any leaf walled in on all six sides, on the argument that it
          // "sits behind its own neighbours' crosses from every angle". **That argument holds only
          // if a neighbour is OPAQUE, and a crossed cutout quad is about half gap** — two vertical
          // planes through a cube cover nowhere near a cube's solid angle. So the cull was not
          // removing hidden geometry; it was removing exactly the cells the eye looks THROUGH the
          // rim to find, and behind them is the trunk.
          //
          // It was never a small trim either — the census calls it 17% because it measured against
          // a thinner canopy. Re-measured in the Thicket today: **9,796 of 29,393 leaf voxels, a
          // third of the entire canopy**, and every one of them interior. The whole saving was 7%
          // of the world's quads (leaves are 13.2% of it), which is not a price worth a see-through
          // forest.
          //
          // ⚠ The enclosure count STAYS, and is now doing its real job on its own: an interior leaf
          // draws, and draws DARK (`shade` below), so the crown reads as a lit rim over a mass
          // rather than as a lattice with sky behind it. Depth shading was always the useful half.
          //
          // Same family as the 08-12 finding one layer up: a leaf's geometry is not a cube, so
          // every rule written for cubes has to be re-derived rather than inherited.
          // ⚠ THE THRESHOLDS MATTER MORE THAN THEY LOOK. The first cut darkened at 3+ neighbours,
          // and the oracle caught that a blob's CORNER already has 3 — so nothing in an entire
          // canopy came out lit and the effect read as "the trees got muddy" rather than as depth.
          // Only genuine burial darkens: the rim (<= 3) stays full bright.
          const shade = enclosed >= 5 ? 1 : enclosed >= 4 ? 2 : 3

          // One hash, four independent slices of it — cheaper than four hashes and just as
          // uncorrelated, since the mixer has already avalanched every input bit across the word.
          const h = cellHash(owx + x, owy + y, owz + z)
          // A quarter turn covers every DISTINCT orientation: the pair is perpendicular, so turning
          // it by 90° maps the cross onto itself. Anything wider would just repeat.
          const yaw = ((h & 1023) / 1024) * (Math.PI / 2)
          // 1.08–1.54 of a cell across, so a cross reaches WELL into its neighbours instead of
          // stopping short of them. Kept as a RANGE rather than one fat constant: crosses that
          // disagree about their size are what stop a canopy reading as a textured slab, and that
          // lesson cost a whole pass on 08-12.
          // ⚠ Widened past 1.0 twice now (08-13). This is the free lever — quad COUNT is unchanged,
          // only the area each one covers — so it is the first thing to reach for when a canopy
          // reads thin, and the last thing to blame when the frame budget goes.
          const wide = K * (1.08 + (((h >>> 10) & 63) / 63) * 0.46)
          const jx = ((((h >>> 16) & 31) / 31) - 0.5) * 0.24
          const jz = ((((h >>> 21) & 31) / 31) - 0.5) * 0.24
          // ⚠ Vertical jitter must OFFSET the cell, never resize it — both corners move by the same
          // `jy`, so the quad still spans exactly one block. A scaled height would shrink the cross
          // away from its neighbours and open holes along the canopy's underside.
          const jy = ((((h >>> 26) & 31) / 31) - 0.5) * 0.3

          // ── ★ A SAPLING IS THE SAME CROSS, ROOTED AND SMALL ────────────────────────────────
          // It rides this pass because it wants crossed quads, but it is not a leaf: a leaf floats
          // in a canopy and may spill into its neighbours, a seedling STANDS ON THE GROUND. So it
          // takes no vertical jitter (a sprout hovering half a block up is the debris read the
          // strand fix already chased out of the canopy), it starts at the cell FLOOR rather than
          // spanning the cell, and it is narrow enough to read as a shoot instead of a shrub.
          //
          // ⚠ The width has to stay UNDER 1.0 — the leaf pass deliberately spills past its cell to
          // close canopy seams, and a sapling doing that would poke through whatever you planted it
          // beside.
          const wideM = sapling ? wide * 0.30 : wide
          const cx = x + 0.5 + (sapling ? jx * 0.3 : jx)
          const cy = sapling ? y + 0.5 : y + 0.5 + jy
          const cz = z + 0.5 + (sapling ? jz * 0.3 : jz)
          // Both start at the cell floor (`cy` is the cell centre, so -0.5 is its base); a sapling
          // simply stops short of the ceiling. What actually makes it ROOTED is `jy` above being
          // suppressed — a leaf floats by up to 0.15 of a cell and a sprout must not.
          const yLo = -0.5
          const yHi = sapling ? 0.2 : 0.5
          const ax0 = Math.cos(yaw) * wideM, az0 = Math.sin(yaw) * wideM
          // Two vertical quads, turned a quarter apart. Wound counter-clockwise from the low-left;
          // the material is DOUBLE-SIDED, so one quad per plane is enough and the back face is lit
          // by the shader's flipped normal rather than by a second copy of the geometry.
          for (let d = 0; d < 2; d++) {
            // (cos, sin) turned a quarter is (-sin, cos) — so the pair stays perpendicular however
            // far the cross as a whole is rotated, and it is still a cross rather than a wedge.
            const ax = d === 0 ? ax0 : -az0
            const az = d === 0 ? az0 : ax0
            const p = quads * 12
            positions[p + 0] = cx - ax; positions[p + 1] = cy + yLo; positions[p + 2] = cz - az
            positions[p + 3] = cx + ax; positions[p + 4] = cy + yLo; positions[p + 5] = cz + az
            positions[p + 6] = cx + ax; positions[p + 7] = cy + yHi; positions[p + 8] = cz + az
            positions[p + 9] = cx - ax; positions[p + 10] = cy + yHi; positions[p + 11] = cz - az
            // The quad's own plane normal — (ax,0,az) x (0,1,0), divided by the half-width it was
            // scaled by, which is exactly the normalisation. Horizontal, so foliage catches side
            // light rather than reading as a floor, and the two quads of a cross never shade alike.
            const nx = -az / wideM, nz = ax / wideM
            for (let k = 0; k < 4; k++) {
              normals[p + k * 3 + 0] = nx
              normals[p + k * 3 + 1] = 0
              normals[p + k * 3 + 2] = nz
              materials[quads * 4 + k] = m
              ao[quads * 4 + k] = shade
            }
            const base = quads * 4, ii = quads * 6
            indices[ii + 0] = base; indices[ii + 1] = base + 1; indices[ii + 2] = base + 2
            indices[ii + 3] = base; indices[ii + 4] = base + 2; indices[ii + 5] = base + 3
            quads++
            faces++
          }
        }
      }
    }
  }

  return {
    positions: positions.subarray(0, quads * 12),
    normals: normals.subarray(0, quads * 12),
    materials: materials.subarray(0, quads * 4),
    ao: ao.subarray(0, quads * 4),
    indices: indices.subarray(0, quads * 6),
    quads,
    faces,
  }
}
