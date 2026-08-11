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

export interface MeshResult {
  /** xyz per vertex, 4 vertices per quad. */
  positions: Float32Array
  /** xyz per vertex, flat-shaded so all 4 share the quad's normal. */
  normals: Float32Array
  /** palette index per vertex — the renderer maps this to a material/atlas tile. */
  materials: Uint16Array
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
  }
}

/**
 * ⚠ When `scratch` is supplied the returned arrays are VIEWS INTO IT, not copies. Upload or copy
 * them before the next `greedyMesh` call with the same scratch, or the previous mesh is overwritten
 * underneath you. That is the price of not allocating; it is stated here because the failure mode is
 * a silently corrupted mesh two frames later, not a crash.
 */
export function greedyMesh(
  sec: Section, neighbour: NeighbourFn = OUTSIDE_IS_AIR, scratch?: MeshScratch,
  half: HalfCells | null = null,
): MeshResult {
  const S = sec.size
  const sc = scratch && scratch.size === S ? scratch : createMeshScratch(S)
  const { positions, normals, materials, indices, mask } = sc
  mask.fill(0)

  let quads = 0
  let faces = 0

  const x = [0, 0, 0]
  const q = [0, 0, 0]
  const du = [0, 0, 0]
  const dv = [0, 0, 0]

  const sample = (a: number, b: number, c: number): number =>
    a >= 0 && a < S && b >= 0 && b < S && c >= 0 && c < S ? sec.get(a, b, c) : neighbour(a, b, c)

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

    const planes = uniform ? [-1, S - 1] : null
    let planeIdx = 0

    for (x[d] = planes ? planes[0] : -1; x[d] < S; ) {
      // ── build the visibility mask for this plane ──────────────────────────────────────────
      let n = 0
      for (x[v] = 0; x[v] < S; x[v]++) {
        for (x[u] = 0; x[u] < S; x[u]++) {
          const a = sample(x[0], x[1], x[2])
          const b = sample(x[0] + q[0], x[1] + q[1], x[2] + q[2])
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
          const aSolid = a !== AIR && a !== STRUCTURE && a !== STRUCTURE_HALF
          const bSolid = b !== AIR && b !== STRUCTURE && b !== STRUCTURE_HALF
          // Exactly one solid => a face. Both solid or both air => nothing. This single line is
          // what deletes every interior face in the world.
          if (aSolid === bSolid) mask[n] = 0
          else if (aSolid) { mask[n] = a; faces++ }
          else { mask[n] = -b; faces++ }
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
          const mat = back ? -c : c
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

          const base = quads * 4
          const ii = quads * 6
          indices[ii + 0] = base
          indices[ii + 1] = base + 1
          indices[ii + 2] = base + 2
          indices[ii + 3] = base
          indices[ii + 4] = base + 2
          indices[ii + 5] = base + 3
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
      const ii = quads * 6
      indices[ii + 0] = base; indices[ii + 1] = base + 1; indices[ii + 2] = base + 2
      indices[ii + 3] = base; indices[ii + 4] = base + 2; indices[ii + 5] = base + 3
      quads++
      faces++
    }
    // Winding rule, the same one the sweep obeys: cross(u, v) must equal the face normal.
    // Iterates the lips themselves — never the section — so this pass costs what slump costs.
    for (const [k, m] of half) {
      const cx = (k % (S + 2)) - 1
      const z = ((k / (S + 2)) | 0) % (S + 2) - 1
      const y = ((k / ((S + 2) * (S + 2))) | 0) - 1
      if (cx < 0 || cx >= S || y < 0 || y >= S || z < 0 || z >= S) continue   // ring entry: context only
      emit(cx, y + 0.5, z, 0, 0, 1, 1, 0, 0, 0, 1, 0, m)                     // top
      const side = (dx: number, dz: number): boolean => {
        // A full neighbour covers this 0.5 outright; a slumped one covers exactly as much as we
        // do — and the sweep's section has had it stripped to AIR, so the map lookup is not
        // redundant: without it every string of lips along a terrace edge draws a wall between
        // each pair. Piece occupancy covers nothing (the piece renderer draws its own look).
        const n = sample(cx + dx, y, z + dz)
        if (!(n === AIR || n === STRUCTURE || n === STRUCTURE_HALF)) return false
        return !half.has(halfKey(cx + dx, y, z + dz, S))
      }
      if (side(1, 0)) emit(cx + 1, y, z, 0, 0.5, 0, 0, 0, 1, 1, 0, 0, m)
      if (side(-1, 0)) emit(cx, y, z, 0, 0, 1, 0, 0.5, 0, -1, 0, 0, m)
      if (side(0, 1)) emit(cx, y, z + 1, 1, 0, 0, 0, 0.5, 0, 0, 0, 1, m)
      if (side(0, -1)) emit(cx, y, z, 0, 0.5, 0, 1, 0, 0, 0, 0, -1, m)
    }
  }

  return {
    positions: positions.subarray(0, quads * 12),
    normals: normals.subarray(0, quads * 12),
    materials: materials.subarray(0, quads * 4),
    indices: indices.subarray(0, quads * 6),
    quads,
    faces,
  }
}
