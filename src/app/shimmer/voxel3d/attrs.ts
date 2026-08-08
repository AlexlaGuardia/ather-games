// Render attributes from a core mesh — WITHOUT importing three.
//
// ★ WHY THIS IS SPLIT OUT OF mesh-bridge.ts: this runs inside the Web Worker, and a worker cannot
// import three (no DOM, and pulling the whole renderer into a worker bundle for `Color` would be
// absurd). So the colour lookup and the per-vertex expansion — the actual per-voxel work — happen
// off the main thread, and `mesh-bridge.ts` is left with nothing to do but wrap finished buffers in
// a BufferGeometry. The main thread's share of a chunk arrival becomes four `setAttribute` calls.

import { MAT } from '../voxel/depth'
import { ORE } from '../voxel/ore'
import { WOOD } from '../voxel/trees'
import type { MeshResult } from '../voxel/greedy'
import { layerOf, faceOfNormal } from './tex/tiles'

/**
 * Palette — one colour per material index.
 *
 * ⚠ PLACEHOLDERS. Shimmer's look is Alex's pixel art; the registry (§4 of VOXEL-WORLD-MODEL) will
 * map each material to a `tiles.ts` index and an atlas. These exist so the world can be WALKED
 * before any art decision is made. Nothing here is a look call.
 */
export const MATERIAL_COLOR: Record<number, number> = {
  [MAT.BEDROCK]: 0x2b2b33,
  [MAT.DEEP_STONE]: 0x494455,
  [MAT.STONE]: 0x7d7a86,
  [MAT.SUBSOIL]: 0x6b4f34,
  [MAT.TOPSOIL]: 0x4f9c3a,
  [MAT.SAND]: 0xd8c691,
  [MAT.WATER]: 0x2f6f9e,
  // Desaturated on purpose — the greying IS desaturation (canon: grey is drained mana, and the
  // frayed edges gutter grey). An ashen green-grey, not a stone grey, so it still reads as ground.
  [MAT.GREY_SOIL]: 0x83887b,
  [ORE.RAW_MANA]: 0x7fd4ff,
  [ORE.ELEMENT_VIOLET]: 0xa974ff,
  [ORE.ELEMENT_STORM]: 0xe8e46a,
  [ORE.ELEMENT_EARTH]: 0xc4813f,
  [ORE.ELEMENT_WATER]: 0x53b7d8,
  [ORE.PURE_CORE]: 0xfff2c4,
  [ORE.ATHER_CRYSTAL]: 0xff6fd0,
  // Wood — placeholders like everything else here. Each species gets a distinguishable bark/leaf
  // pair so four species read as four species before a single tile is hand-painted.
  [WOOD.GOLDWOOD_LOG]: 0x8a6a34, [WOOD.GOLDWOOD_LEAVES]: 0x5aa845,
  [WOOD.SHIMMEROAK_LOG]: 0x6f5a3f, [WOOD.SHIMMEROAK_LEAVES]: 0x49913f,
  [WOOD.STARWILLOW_LOG]: 0x7d7291, [WOOD.STARWILLOW_LEAVES]: 0x7fc0a8,
  [WOOD.DAWNWOOD_LOG]: 0x9a5f4a, [WOOD.DAWNWOOD_LEAVES]: 0xd9a05e,
  // Warm mana-light in a plank frame — the raw-mana blue warmed toward candle, so a lit yard
  // reads as TENDED against the cold ore glow of a cave.
  [MAT.MANA_LANTERN]: 0xffd98a,
  // Milled goldwood, a step lighter and warmer than the raw log — a worked surface, not bark.
  [MAT.CRAFT_TABLE]: 0xb08a4e,
  // Packed earth, drier than subsoil, tanner than sand — the story road.
  [MAT.PATH]: 0xa8916b,
  // Milled goldwood strips — the bridge deck and the builder's floor.
  [MAT.PLANKS]: 0xa8834d,
}

/** Materials that glow, so ore reads in an unlit cave instead of being a slightly different grey. */
export const EMISSIVE: Record<number, number> = {
  [ORE.RAW_MANA]: 0.55,
  [ORE.ELEMENT_VIOLET]: 0.5,
  [ORE.ELEMENT_STORM]: 0.5,
  [ORE.ELEMENT_EARTH]: 0.35,
  [ORE.ELEMENT_WATER]: 0.5,
  [ORE.PURE_CORE]: 0.8,
  [ORE.ATHER_CRYSTAL]: 1.0,
  // The lantern out-glows every seam — it is the one block whose JOB is light. (Render-side only;
  // the spawn-side truth is registry `emit`, flooded by light.ts. Two systems, one story.)
  [MAT.MANA_LANTERN]: 1.0,
}

/** An unmapped material must be LOUD, not invisible — magenta says "the registry missed one". */
const FALLBACK = 0xff00ff

export interface MeshAttrs {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  emissive: Float32Array
  /**
   * Texture-array layer per vertex.
   *
   * ★ BUILT HERE, WHICH MEANS BUILT IN THE WORKER. The texture spike computed this host-side from
   * `mesh.materials` + `mesh.normals` on every mesh upload; moving it into `attrs.ts` puts it on the
   * generation thread with the rest of the per-vertex expansion, so the main thread's share of a
   * chunk arrival stays four `setAttribute` calls. One float per vertex is the entire cost of
   * texturing — UVs are derived in-shader from position and normal, so there is no UV buffer.
   *
   * ⚠ Face comes from the NORMAL, which is exact for axis-aligned quads, so `voxel/` never had to
   * learn about textures. That is why the pure core is still untouched by any of this.
   */
  layers: Float32Array
  indices: Uint32Array
  quads: number
}

/** Every buffer in a MeshAttrs, for structuredClone transfer. Zero-copy across the worker boundary. */
export const attrBuffers = (a: MeshAttrs): ArrayBuffer[] =>
  [a.positions.buffer, a.normals.buffer, a.colors.buffer, a.emissive.buffer,
   a.layers.buffer, a.indices.buffer] as ArrayBuffer[]

/**
 * ── ★ WATER IS ITS OWN DRAW, AND THIS IS WHERE IT SPLITS (2026-08-07 late) ─────────────────────
 * Transparent water cannot live in the section's opaque geometry: triangles inside one draw render
 * in INDEX order, so a water quad that happens to sit before its own river bed in the buffer
 * blends against the sky, writes depth, and the bed behind it is discarded — see-through water
 * that shows nothing is under it. The fix is the standard one: opaque pass first, water after, so
 * water always blends over a finished scene. That means water quads leave this geometry entirely
 * and come back as a second mesh with the shared water material (ONE extra program total — the
 * per-chunk-material rule bans a program per chunk, not a second pass).
 *
 * Partition is per QUAD (4 vertices, 6 indices, one material) and reindexes both halves densely.
 * Either half can be null — most sections have no water at all, and a null skips the mesh, the
 * geometry, and the draw, so dry country pays nothing.
 */
export function buildAttrsSplit(mesh: MeshResult, isWater: (m: number) => boolean):
  { solid: MeshAttrs | null; water: MeshAttrs | null } {
  let waterQuads = 0
  for (let q = 0; q < mesh.quads; q++) if (isWater(mesh.materials[q * 4])) waterQuads++
  if (waterQuads === 0) return { solid: buildAttrs(mesh), water: null }

  const pick = (want: boolean, quads: number): MeshAttrs => {
    const positions = new Float32Array(quads * 12)
    const normals = new Float32Array(quads * 12)
    const materials = new Uint16Array(quads * 4)
    const indices = new Uint32Array(quads * 6)
    let outQ = 0
    for (let q = 0; q < mesh.quads; q++) {
      if (isWater(mesh.materials[q * 4]) !== want) continue
      positions.set(mesh.positions.subarray(q * 12, q * 12 + 12), outQ * 12)
      normals.set(mesh.normals.subarray(q * 12, q * 12 + 12), outQ * 12)
      materials.set(mesh.materials.subarray(q * 4, q * 4 + 4), outQ * 4)
      // Remap the quad's OWN indices rather than assuming a triangulation: winding is what makes a
      // face face outward, and the mesher owns that decision, not this split.
      for (let i = 0; i < 6; i++) indices[outQ * 6 + i] = mesh.indices[q * 6 + i] - q * 4 + outQ * 4
      outQ++
    }
    return buildAttrs({ positions, normals, materials, indices, quads, faces: quads })
  }
  const solidQuads = mesh.quads - waterQuads
  return {
    solid: solidQuads > 0 ? pick(false, solidQuads) : null,
    water: pick(true, waterQuads),
  }
}

/**
 * Expand a core mesh into render-ready attributes. Copies positions/normals/indices out of the
 * mesher's reusable scratch — they are views that the next section would overwrite, so a copy here
 * is not waste, it is the thing that makes the result safe to hand across a thread boundary.
 */
export function buildAttrs(mesh: MeshResult): MeshAttrs {
  const n = mesh.materials.length
  const colors = new Float32Array(n * 3)
  const emissive = new Float32Array(n)
  const layers = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const m = mesh.materials[i]
    // Face from the vertex NORMAL — exact for axis-aligned quads, which is why `voxel/` never had
    // to learn that textures exist. normals are 3 floats per vertex; y decides top/side/bottom.
    layers[i] = layerOf(m, faceOfNormal(mesh.normals[i * 3 + 1]))
    const hex = MATERIAL_COLOR[m] ?? FALLBACK
    // Inline hex→linear-ish float rather than THREE.Color, which is the whole reason this file has
    // no three import. Three's default is sRGB-in, and Lambert with vertexColors expects that.
    colors[i * 3] = ((hex >> 16) & 255) / 255
    colors[i * 3 + 1] = ((hex >> 8) & 255) / 255
    colors[i * 3 + 2] = (hex & 255) / 255
    emissive[i] = EMISSIVE[m] ?? 0
  }
  return {
    positions: mesh.positions.slice(),
    normals: mesh.normals.slice(),
    colors,
    emissive,
    layers,
    indices: mesh.indices.slice(),
    quads: mesh.quads,
  }
}
