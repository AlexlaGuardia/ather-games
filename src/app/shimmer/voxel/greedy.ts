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
export function greedyMesh(sec: Section, neighbour: NeighbourFn = OUTSIDE_IS_AIR, scratch?: MeshScratch): MeshResult {
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
          const aSolid = a !== AIR
          const bSolid = b !== AIR
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

  return {
    positions: positions.subarray(0, quads * 12),
    normals: normals.subarray(0, quads * 12),
    materials: materials.subarray(0, quads * 4),
    indices: indices.subarray(0, quads * 6),
    quads,
    faces,
  }
}
