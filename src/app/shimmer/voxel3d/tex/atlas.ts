// Host side of the texture spike — tile bytes → a GPU texture array, and the material that reads it.
//
// ★ WHY A TEXTURE ARRAY AND NOT AN ATLAS. `greedy.ts` merges a flat 32x32 floor into ONE quad. To
// texture a quad that spans w x h blocks you need UVs that TILE across it — 0..w, 0..h — and with a
// classic atlas, wrapping walks straight into the neighbouring tile's pixels. The usual escape is to
// stop merging (one quad per block), which throws away the entire measured win of the mesher. A
// `sampler2DArray` gives every material its own independent 2D texture, so RepeatWrapping tiles
// perfectly with zero bleed and the mesher is untouched. That single fact is why this spike exists.
//
// ★ AND IT COSTS NO EXTRA VERTEX DATA FOR UVs. Blocks are axis-aligned unit cubes, so the fragment
// shader derives its UV from object position + normal. Quad corners are integers, so tiles land
// exactly on block boundaries. The only attribute added is one float: which layer to sample.

import * as THREE from 'three'
import { buildTileArray, LAYER_COUNT } from './tiles'

export interface TileArray {
  texture: THREE.DataArrayTexture
  size: number
  /** The raw bytes, kept so the HUD can draw a reference swatch at true pixel size. */
  data: Uint8Array
}

/**
 * Build the array texture for one tile size.
 *
 * Filtering is the pixel-art pair: NEAREST when magnified (crisp texels up close, which is the whole
 * aesthetic) and mipmapped when minified. The mip half is not optional — a 32px tile is already below
 * one-texel-per-pixel past ~22 blocks, and unmipped minification there is a shimmering mess that
 * would make the 32-vs-64 comparison a test of aliasing instead of a test of detail.
 *
 * ★ Mipmaps are per-LAYER in an array texture, so unlike an atlas they cannot bleed between
 * materials at any level. This is the second thing the array buys, and it is the one an atlas can
 * never fix.
 */
export function makeTileArray(size: number, renderer?: THREE.WebGLRenderer): TileArray {
  const data = buildTileArray(size)
  const tex = new THREE.DataArrayTexture(data, size, size, LAYER_COUNT)
  tex.format = THREE.RGBAFormat
  tex.type = THREE.UnsignedByteType
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestMipmapLinearFilter
  tex.generateMipmaps = true
  // Ground viewed at a grazing angle is the worst case for a voxel world and the one you look at
  // constantly. Anisotropy is the cheapest fix available and costs nothing when unsupported.
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8
  tex.needsUpdate = true
  return { texture: tex, size, data }
}

/**
 * String-replace injection into a stock shader, with the silent failure removed.
 *
 * ★ `String.prototype.replace` NO-OPS WHEN IT MATCHES NOTHING. Three renames shader chunks between
 * versions, so an `onBeforeCompile` written against r183 degrades on a bump into a shader that
 * compiles perfectly and is simply missing a feature — untextured blocks, or ore that never glows,
 * with nothing in the console. That is the same shape as every "the note lied" bug in this codebase.
 * A version bump should break LOUDLY, at the first frame, naming the chunk it could not find.
 */
function mustReplace(src: string, find: string, next: string, where: string): string {
  if (!src.includes(find)) {
    throw new Error(
      `voxel texture material: shader chunk "${find}" not found in ${where}. Three's shader chunks ` +
      `were renamed — update the injection rather than shipping a silently untextured world.`,
    )
  }
  return src.replace(find, next)
}

export interface VoxelTexMaterial {
  material: THREE.Material
  /** Swap min filtering between mipmapped and raw nearest, live, for the aliasing A/B. */
  setMipmapped: (on: boolean) => void
}

/**
 * Lambert + a texture array, injected rather than written from scratch.
 *
 * ★ ONE MATERIAL PER TILE SIZE, NOT ONE PER CHUNK — a material per chunk is a shader program per
 * chunk in the worst case, and that is how a voxel renderer dies long before the mesher is the
 * bottleneck. Same rule as `createVoxelMaterial`; stated again because this file is where someone
 * would be tempted to break it.
 *
 * `vertexColors` is OFF. The tiles carry the colour now, and multiplying by the flat palette on top
 * would darken every surface twice. The geometry still HAS its colour attribute — the flat control
 * material in the same scene reads it — it is simply ignored here.
 */
export function createTexturedVoxelMaterial(tiles: TileArray): VoxelTexMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = { value: tiles.texture }

    shader.vertexShader = mustReplace(
      shader.vertexShader,
      '#include <common>',
      `#include <common>
attribute float aLayer;
attribute float aEmissive;
varying float vLayer;
varying float vEmissive;
varying vec3 vVoxPos;
varying vec3 vVoxNormal;`,
      'vertex shader',
    )
    shader.vertexShader = mustReplace(
      shader.vertexShader,
      '#include <begin_vertex>',
      `#include <begin_vertex>
vLayer = aLayer;
vEmissive = aEmissive;
vVoxPos = position;
vVoxNormal = normal;`,
      'vertex shader',
    )

    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <common>',
      `#include <common>
uniform sampler2DArray uTiles;
varying float vLayer;
varying float vEmissive;
varying vec3 vVoxPos;
varying vec3 vVoxNormal;
// Alpha of the sampled tile — the emissive MASK (see writeOre), so only the crystal inside an ore
// block glows and not the host rock around it. Global rather than a varying: it is produced and
// consumed within one fragment, two chunks apart.
float gTileEmissive = 0.0;`,
      'fragment shader',
    )

    // ── the UV derivation ────────────────────────────────────────────────────────────────────────
    // Pick the two axes that lie IN the face's plane. Object-space position is used, not world: each
    // section mesh is positioned on a 16-block boundary, so both agree on tile alignment, and object
    // space keeps the numbers small enough that float precision never becomes the reason a texture
    // drifts a texel at the far edge of the world.
    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <color_fragment>',
      `#include <color_fragment>
{
  vec3 an = abs(vVoxNormal);
  // ★ THE V AXIS IS NEGATED ON SIDE FACES, AND THAT IS AN ART-PIPELINE DECISION, NOT A HACK.
  // Texture row 0 is the TOP of an image file — it is where a painter puts the grass. But v
  // increases with world Y, so an un-negated v puts row 0 at the BOTTOM of the block and every
  // hand-painted tile would import upside down. Negating here means a tile painted the obvious
  // way in Aseprite lands the obvious way in the world, and nobody has to remember a rule.
  vec2 tileUv = an.y > 0.5
    ? vVoxPos.xz
    : (an.x > 0.5 ? vec2(vVoxPos.z, -vVoxPos.y) : vec2(vVoxPos.x, -vVoxPos.y));
  vec4 tile = texture(uTiles, vec3(tileUv, vLayer));
  diffuseColor.rgb *= tile.rgb;
  gTileEmissive = tile.a;
}`,
      'fragment shader',
    )

    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <opaque_fragment>',
      'gl_FragColor = vec4( outgoingLight + diffuseColor.rgb * vEmissive * gTileEmissive, diffuseColor.a );',
      'fragment shader',
    )
  }

  return {
    material: mat,
    setMipmapped: (on: boolean) => {
      tiles.texture.minFilter = on ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter
      tiles.texture.needsUpdate = true
      mat.needsUpdate = true
    },
  }
}
