// Render attributes from a core mesh — WITHOUT importing three.
//
// ★ WHY THIS IS SPLIT OUT OF mesh-bridge.ts: this runs inside the Web Worker, and a worker cannot
// import three (no DOM, and pulling the whole renderer into a worker bundle for `Color` would be
// absurd). So the colour lookup and the per-vertex expansion — the actual per-voxel work — happen
// off the main thread, and `mesh-bridge.ts` is left with nothing to do but wrap finished buffers in
// a BufferGeometry. The main thread's share of a chunk arrival becomes four `setAttribute` calls.

import { MAT } from '../voxel/depth'
import { ORE } from '../voxel/ore'
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
  [ORE.RAW_MANA]: 0x7fd4ff,
  [ORE.ELEMENT_VIOLET]: 0xa974ff,
  [ORE.ELEMENT_STORM]: 0xe8e46a,
  [ORE.ELEMENT_EARTH]: 0xc4813f,
  [ORE.ELEMENT_WATER]: 0x53b7d8,
  [ORE.PURE_CORE]: 0xfff2c4,
  [ORE.ATHER_CRYSTAL]: 0xff6fd0,
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
