// Host side of the port boundary — voxel core → Three.js.
//
// ★ THIS FILE IS ALLOWED TO IMPORT THREE. `src/app/shimmer/voxel/` is not, and `purity.test.ts`
// enforces that by walking its import graph. The whole portability strategy lives on this line: the
// core computes flat typed arrays, the host turns them into whatever its renderer wants. When Supra
// gets a chunk mesher, it writes its own equivalent of this file and the core moves unchanged.

import * as THREE from 'three'
import type { MeshResult } from '../voxel/greedy'
import { MAT } from '../voxel/depth'
import { ORE } from '../voxel/ore'

/**
 * Palette — one colour per material index.
 *
 * ⚠ PLACEHOLDER COLOURS, DELIBERATELY. Shimmer's look is Alex's pixel art, and the registry (§4 of
 * VOXEL-WORLD-MODEL) will map each material to a `tiles.ts` index and a texture atlas. Flat colours
 * exist so the world can be WALKED before any art decision is made — nothing here is a look call.
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

/** Materials that glow, so ore reads in an unlit cave rather than being a slightly different grey. */
export const EMISSIVE: Record<number, number> = {
  [ORE.RAW_MANA]: 0.55,
  [ORE.ELEMENT_VIOLET]: 0.5,
  [ORE.ELEMENT_STORM]: 0.5,
  [ORE.ELEMENT_EARTH]: 0.35,
  [ORE.ELEMENT_WATER]: 0.5,
  [ORE.PURE_CORE]: 0.8,
  [ORE.ATHER_CRYSTAL]: 1.0,
}

const FALLBACK = 0xff00ff   // magenta: an unmapped material should be loud, not invisible

/**
 * Build a geometry from a core mesh.
 *
 * Vertex colours rather than a texture atlas: the core hands us a material index per vertex, and
 * until the registry exists there is nothing to look a texture up with. Swapping this for an atlas
 * later touches only this function — which is the point of the boundary.
 */
export function toGeometry(mesh: MeshResult): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))

  const colors = new Float32Array(mesh.materials.length * 3)
  const emis = new Float32Array(mesh.materials.length)
  const c = new THREE.Color()
  for (let i = 0; i < mesh.materials.length; i++) {
    const m = mesh.materials[i]
    c.setHex(MATERIAL_COLOR[m] ?? FALLBACK)
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    emis[i] = EMISSIVE[m] ?? 0
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('aEmissive', new THREE.BufferAttribute(emis, 1))
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  g.computeBoundingSphere()
  return g
}

/**
 * One shared material for every chunk. Vertex-coloured Lambert with an emissive term injected via
 * `onBeforeCompile` — cheaper than a custom ShaderMaterial and it keeps Three's lighting.
 *
 * ★ ONE material instance for the whole world, not one per chunk: a material per chunk means a
 * shader program per chunk in the worst case, and hundreds of them is how a voxel renderer dies
 * before the mesher ever becomes the bottleneck.
 */
export function createVoxelMaterial(): THREE.Material {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmissive;\nvarying float vEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissive = aEmissive;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmissive;')
      .replace(
        '#include <output_fragment>',
        'gl_FragColor = vec4( outgoingLight + diffuseColor.rgb * vEmissive, diffuseColor.a );'
      )
      // Three 0.183 renamed the chunk; support both so a version bump does not silently unlight ore.
      .replace(
        '#include <opaque_fragment>',
        'gl_FragColor = vec4( outgoingLight + diffuseColor.rgb * vEmissive, diffuseColor.a );'
      )
  }
  return mat
}
