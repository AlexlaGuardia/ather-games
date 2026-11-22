// ── THE GLADE AS A BUILDER MAP (BETA M83 s2a) ──
// The Wilds' ground comes in exported 1 km tiles, so its edit layer is a delta per tile vertex. The closed Glade (M67) has no
// tiles: its ground is a FUNCTION (glade-cluster.ts gladeZoneGround = Greg's island + the cluster's meadow, paths and the friends'
// islands, with the Moonwell's bowl). So the builder lays ONE virtual tile over it, the same grid a Wilds tile has (1 km, 4 m
// cells, 251 x 251 vertices), centred on the Glade, and samples the function at every vertex. That makes the Glade's layer the
// exact shape of a Wilds layer ({ tiles: { glade: {k: dm} }, water, falls }), so the whole engine (brush, water, falls, undo, the
// draft store, publish / roll back, the Fly view) works on it unchanged.
//   · where the function is not ground (off the islands, past the cloud wall) the vertex is NaN: the brush skips it (applyBrush's
//     isFinite check), the map draws it as void, Fly drops the triangles. You sculpt the land the Glade has, you do not add land.
//   · the bounds: sampled 11-22, ground spans x -648..224, z -224..648 (872 m). Centre (-212, 212), so the tile's 1000 m holds it
//     with 64 m to spare on every side; glade-builder.test.ts fails if the Glade ever grows past the tile.
// Pure; glade-builder.test.ts.
import type { BrushTile } from '../open/ather/wilds-edits'

export const GLADE_LAYER_TILE = 'glade'
export const GLADE_TILE_CENTER = { x: -212, z: 212 }
export const GLADE_CELL = 4
export const GLADE_N = 251                              // vertices per side (250 cells x 4 m = 1000 m), = a Wilds tile
export const GLADE_SIZE = (GLADE_N - 1) * GLADE_CELL

/** the Glade's one tile as the brush sees it */
export const GLADE_BRUSH_TILE: BrushTile = { name: GLADE_LAYER_TILE, ox: GLADE_TILE_CENTER.x, oz: GLADE_TILE_CENTER.z, nx: GLADE_N, nz: GLADE_N, cell: GLADE_CELL, sizeX: GLADE_SIZE, sizeZ: GLADE_SIZE }

/** world position of vertex (i, j) */
export const gladeVertex = (i: number, j: number) => ({ x: GLADE_TILE_CENTER.x - GLADE_SIZE / 2 + i * GLADE_CELL, z: GLADE_TILE_CENTER.z - GLADE_SIZE / 2 + j * GLADE_CELL })

/** The Glade has no sea: its "water line" for the ramp sits just under the Moonwell's bowl (lowest ground sampled -0.8 m). */
export const GLADE_WATER_Y = -2
/** what a no-ground vertex holds in `h`, so every consumer that only reads numbers (shading, normals) stays finite */
export const GLADE_VOID_Y = GLADE_WATER_Y - 10

/** The bare base (no edits), row-major k = j * N + i. `h` is finite everywhere (GLADE_VOID_Y off the ground); `voidV` marks the
 *  vertices that are not ground, `voided` the cells (k = j * (N-1) + i, the editor's water-cell index) with any such corner. */
export function sampleGladeBase(ground: (x: number, z: number) => number): { h: Float32Array; voidV: Uint8Array; voided: Uint8Array } {
  const N = GLADE_N, h = new Float32Array(N * N), voidV = new Uint8Array(N * N), voided = new Uint8Array((N - 1) * (N - 1))
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const p = gladeVertex(i, j), y = ground(p.x, p.z), k = j * N + i
    if (Number.isFinite(y)) h[k] = y; else { h[k] = GLADE_VOID_Y; voidV[k] = 1 }
  }
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++)
    voided[j * (N - 1) + i] = voidV[j * N + i] | voidV[j * N + i + 1] | voidV[(j + 1) * N + i] | voidV[(j + 1) * N + i + 1]
  return { h, voidV, voided }
}

/** The layer's height delta at a world point, in metres: bilinear over the tile's dm deltas, 0 off the tile or where no vertex is
 *  edited. This is what the game adds to gladeZoneGround (s2b), and it is exact at a vertex. */
export function gladeDeltaAt(edits: Record<string, number> | null | undefined, x: number, z: number): number {
  if (!edits) return 0
  const fx = (x - GLADE_TILE_CENTER.x + GLADE_SIZE / 2) / GLADE_CELL, fz = (z - GLADE_TILE_CENTER.z + GLADE_SIZE / 2) / GLADE_CELL
  if (!(fx >= 0 && fz >= 0 && fx <= GLADE_N - 1 && fz <= GLADE_N - 1)) return 0
  const i = Math.min(GLADE_N - 2, Math.floor(fx)), j = Math.min(GLADE_N - 2, Math.floor(fz)), u = fx - i, v = fz - j
  const d = (ii: number, jj: number) => (edits[String(jj * GLADE_N + ii)] ?? 0) / 10
  return (d(i, j) * (1 - u) + d(i + 1, j) * u) * (1 - v) + (d(i, j + 1) * (1 - u) + d(i + 1, j + 1) * u) * v
}
