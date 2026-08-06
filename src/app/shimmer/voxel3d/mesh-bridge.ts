// Host side of the port boundary — finished attributes → Three.js.
//
// ★ THIS FILE IS ALLOWED TO IMPORT THREE. `src/app/shimmer/voxel/` is not, and `purity.test.ts`
// enforces that by walking its import graph. The whole portability strategy lives on this line.
//
// ★ AND IT IS DELIBERATELY TINY. The per-voxel work — colour lookup, per-vertex expansion — moved
// into `attrs.ts` so it can run inside the generation Worker, which cannot import three. What is
// left here is four `setAttribute` calls: the main thread\'s entire share of a chunk arrival.

import * as THREE from 'three'
import type { MeshAttrs } from './attrs'

export { MATERIAL_COLOR, EMISSIVE } from './attrs'

/** Wrap worker-built buffers in a geometry. No copies — these arrays were transferred, so they are
 *  ours now and can be handed straight to the GPU. */
export function toGeometry(a: MeshAttrs): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3))
  g.setAttribute('aEmissive', new THREE.BufferAttribute(a.emissive, 1))
  g.setIndex(new THREE.BufferAttribute(a.indices, 1))
  g.computeBoundingSphere()
  return g
}

/**
 * One shared material for the whole world, not one per chunk.
 *
 * ★ A material per chunk is a shader program per chunk in the worst case, and hundreds of them is
 * how a voxel renderer dies long before the mesher becomes the bottleneck.
 *
 * Vertex-coloured Lambert with an emissive term injected via `onBeforeCompile` — cheaper than a
 * custom ShaderMaterial and it keeps Three\'s lighting.
 */
export function createVoxelMaterial(): THREE.Material {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmissive;\nvarying float vEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissive = aEmissive;')
    const emit = 'gl_FragColor = vec4( outgoingLight + diffuseColor.rgb * vEmissive, diffuseColor.a );'
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmissive;')
      // Three renamed this chunk around 0.16x; handle both so a version bump does not silently
      // unlight every ore in the world with no error anywhere.
      .replace('#include <output_fragment>', emit)
      .replace('#include <opaque_fragment>', emit)
  }
  return mat
}
