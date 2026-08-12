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
import { isPlant, isHalfMat, isTopSlab } from './depth'
import { isLeafMat } from './trees'

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
): MeshResult {
  const S = sec.size
  const sc = scratch && scratch.size === S ? scratch : createMeshScratch(S)
  const { positions, normals, materials, indices, mask, ao } = sc
  // `let` because the two slices SWAP each plane — see MeshScratch.
  let sliceMatA = sc.sliceMatA, sliceMatB = sc.sliceMatB
  let sliceSolA = sc.sliceSolA, sliceSolB = sc.sliceSolB
  /** Row stride of a slice grid: the section plus its one-cell ring on each side. */
  const SW = S + 2
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
    const fillSlice = (mat: Int32Array, sol: Uint8Array, dc: number): void => {
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
          sol[i] = m !== AIR && m !== STRUCTURE && m !== STRUCTURE_HALF && !isPlant(m) && !isLeafMat(m) ? 1 : 0
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
        fillSlice(sliceMatB, sliceSolB, x[d] + 1)
      } else {
        fillSlice(sliceMatA, sliceSolA, x[d])
        fillSlice(sliceMatB, sliceSolB, x[d] + 1)
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
          const aSolid = sliceSolA[si] === 1
          const bSolid = sliceSolB[si] === 1
          // Exactly one solid => a face. Both solid or both air => nothing. This single line is
          // what deletes every interior face in the world.
          if (aSolid === bSolid) mask[n] = 0
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
            const sol = aSolid ? sliceSolB : sliceSolA
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
  if (!uniform || isLeafMat(sec.uniformValue()!)) {
    const maxQuads = (positions.length / 12) | 0
    // Diagonals of the cell, inset so two neighbouring canopies do not z-fight along a shared face.
    const K = 0.5 - 0.0625
    const [owx, owy, owz] = origin
    // ⚠ `break` would leave the two outer loops running. The scratch is sized for the checkerboard
    // worst case so this should never trip, but "should never" plus a partial exit is how a mesh
    // comes back silently missing its top half.
    let full = false
    for (let y = 0; y < S && !full; y++) {
      for (let z = 0; z < S && !full; z++) {
        for (let x = 0; x < S; x++) {
          const m = sec.get(x, y, z)
          if (!isLeafMat(m)) continue
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
          // ★ A LEAF WALLED IN ON ALL SIX SIDES DRAWS NOTHING. It is behind its own neighbours'
          // crosses from every angle, and the pass used to spend two quads on it anyway — 3,046 of
          // 17,388 in the Thicket, 17% of the canopy's cost, invisible. Culling it is what pays for
          // the fuller crown the generator now grows. Chopping re-meshes, so the moment a neighbour
          // becomes air this cell draws again; the solid sweep has always worked exactly this way.
          if (enclosed === 6) continue
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
          const wide = K * (0.78 + (((h >>> 10) & 63) / 63) * 0.44)
          const jx = ((((h >>> 16) & 31) / 31) - 0.5) * 0.24
          const jz = ((((h >>> 21) & 31) / 31) - 0.5) * 0.24
          // ⚠ Vertical jitter must OFFSET the cell, never resize it — both corners move by the same
          // `jy`, so the quad still spans exactly one block. A scaled height would shrink the cross
          // away from its neighbours and open holes along the canopy's underside.
          const jy = ((((h >>> 26) & 31) / 31) - 0.5) * 0.3

          const cx = x + 0.5 + jx, cy = y + 0.5 + jy, cz = z + 0.5 + jz
          const ax0 = Math.cos(yaw) * wide, az0 = Math.sin(yaw) * wide
          // Two vertical quads, turned a quarter apart. Wound counter-clockwise from the low-left;
          // the material is DOUBLE-SIDED, so one quad per plane is enough and the back face is lit
          // by the shader's flipped normal rather than by a second copy of the geometry.
          for (let d = 0; d < 2; d++) {
            // (cos, sin) turned a quarter is (-sin, cos) — so the pair stays perpendicular however
            // far the cross as a whole is rotated, and it is still a cross rather than a wedge.
            const ax = d === 0 ? ax0 : -az0
            const az = d === 0 ? az0 : ax0
            const p = quads * 12
            positions[p + 0] = cx - ax; positions[p + 1] = cy - 0.5; positions[p + 2] = cz - az
            positions[p + 3] = cx + ax; positions[p + 4] = cy - 0.5; positions[p + 5] = cz + az
            positions[p + 6] = cx + ax; positions[p + 7] = cy + 0.5; positions[p + 8] = cz + az
            positions[p + 9] = cx - ax; positions[p + 10] = cy + 0.5; positions[p + 11] = cz - az
            // The quad's own plane normal — (ax,0,az) x (0,1,0), divided by the half-width it was
            // scaled by, which is exactly the normalisation. Horizontal, so foliage catches side
            // light rather than reading as a floor, and the two quads of a cross never shade alike.
            const nx = -az / wide, nz = ax / wide
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
