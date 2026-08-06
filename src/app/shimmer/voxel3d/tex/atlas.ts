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
  /** Per-block value jitter, 0 = off. See the shader note on why this is not a vertex attribute. */
  setJitter: (amount: number) => void
  /** Cartoon levers — uniform writes, never a recompile. See settings.ts. */
  setCartoon: (v: Record<string, number>) => void
}

/** How much a block's brightness may drift from its neighbours. Small on purpose — this is meant to
 *  read as "stone is not uniform", not as a checkerboard. */
export const DEFAULT_JITTER = 0.07

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

  // `onBeforeCompile` does not run until the first render, so a setter called before that would be
  // writing to a uniform object that does not exist yet. Hold the wanted value and apply on compile.
  let live: { uJitter: { value: number } } | null = null
  let liveCartoon: Record<string, { value: number }> | null = null
  let jitter = DEFAULT_JITTER
  let pendingCartoon: Record<string, number> | null = null

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = { value: tiles.texture }
    shader.uniforms.uJitter = { value: jitter }
    // ★ CARTOON LEVERS LIVE HERE TOO, AS UNIFORMS ON THIS SAME PROGRAM. Switching the world to
    // textures must not lose the look, and a second material per style would be one shader program
    // per style — the allocation shape that got this page blocked from WebGL. See settings.ts.
    shader.uniforms.uCartoon = { value: 0 }
    shader.uniforms.uToon = { value: 0 }
    shader.uniforms.uOutline = { value: 0 }
    shader.uniforms.uFaceShading = { value: 0.35 }
    shader.uniforms.uShadowLift = { value: 0.15 }
    liveCartoon = shader.uniforms as Record<string, { value: number }>
    if (pendingCartoon) for (const [k, val] of Object.entries(pendingCartoon)) {
      if (liveCartoon[k]) liveCartoon[k].value = val
    }
    live = shader.uniforms as { uJitter: { value: number } }

    shader.vertexShader = mustReplace(
      shader.vertexShader,
      '#include <common>',
      `#include <common>
attribute float aLayer;
attribute float aEmissive;
varying float vLayer;
varying float vEmissive;
varying vec3 vVoxPos;
varying vec3 vVoxNormal;
varying vec3 vWorldPos;`,
      'vertex shader',
    )
    shader.vertexShader = mustReplace(
      shader.vertexShader,
      '#include <begin_vertex>',
      `#include <begin_vertex>
vLayer = aLayer;
vEmissive = aEmissive;
vVoxPos = position;
vVoxNormal = normal;
// ⚠ WORLD position, separately from the object-space one above, and both are needed.
// UVs stay in object space (small numbers, so texel alignment cannot drift at the far edge of the
// world). The per-block hash MUST be world-space: object space restarts at every section origin, so
// hashing it would stamp the identical 16-block pattern into every section — trading a 1-block
// repeat for a 16-block one, which is more visible, not less.
vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
      'vertex shader',
    )

    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <common>',
      `uniform float uCartoon;
uniform float uToon;
uniform float uOutline;
uniform float uFaceShading;
uniform float uShadowLift;
#include <common>
uniform sampler2DArray uTiles;
uniform float uJitter;
varying float vLayer;
varying float vEmissive;
varying vec3 vVoxPos;
varying vec3 vVoxNormal;
varying vec3 vWorldPos;

// ★ PER-BLOCK VARIATION WITHOUT COSTING THE GREEDY MESHER A SINGLE QUAD.
//
// The obvious way to stop a tiled texture reading as wallpaper is to vary each block. The obvious
// IMPLEMENTATION is a per-vertex attribute — and that quietly destroys the mesher, because two
// adjacent blocks that differ can no longer merge. A flat 32x32 floor would go from one quad back to
// 1024. It is the atlas mistake wearing a different hat.
//
// Instead the block coordinate is RECOVERED PER-FRAGMENT from world position. A fragment on a face
// sits exactly on the block boundary along the normal axis, so stepping half a block back along the
// normal and flooring lands inside the owning block. Variation therefore happens INSIDE a merged
// quad and the mesher never learns anything happened.
//
// ★ AND IT WORKS WHERE DECORATION CANNOT — stone walls, cave ceilings, the inside of a mine. Grass
// tufts and flowers break up a surface; nothing scatters flowers 60 blocks underground, which is
// where a big share of this game is about to be spent.
vec3 blockCoord() {
  return floor(vWorldPos - vVoxNormal * 0.5);
}

float hashBlock(vec3 p) {
  vec3 q = fract(p * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
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
  // Value-only jitter, deliberately not hue: shifting hue per block would fight the palette and read
  // as noise. Ore is exempt — a crystal that varies block to block reads as inconsistent material
  // rather than as natural variation, and its whole job is to be recognisable at a glance.
  if (uJitter > 0.0 && tile.a < 0.5) {
    diffuseColor.rgb *= 1.0 + (hashBlock(blockCoord()) - 0.5) * 2.0 * uJitter;
  }
}`,
      'fragment shader',
    )

    // ★ THE CARTOON STACK, ON THE TEXTURED PATH. Same four levers as the flat material, so the look
    // survives the swap to textures. Face brightness uses the exact axis-aligned normal; banding
    // makes lighting read as drawn rather than lit; the shadow lift stops caves reading as murk; and
    // the outline is free here because world position is already a varying for the block jitter.
    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <opaque_fragment>',
      `vec3 cnrm = normalize(vVoxNormal);
       float faceLum = cnrm.y > 0.5 ? 1.0 : (cnrm.y < -0.5 ? 0.52 : 0.76 + 0.05 * abs(cnrm.x));
       float face = mix(1.0, faceLum, uFaceShading);
       float clum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
       float stepped = floor(clum * 3.0 + 0.5) / 3.0;
       float shaped = mix(clum, stepped, uToon);
       vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);
       vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) + shade * (1.0 - shaped);
       vec3 fr = fract(vWorldPos - cnrm * 0.002);
       vec3 dEdge = min(fr, 1.0 - fr);
       vec3 planar = 1.0 - abs(cnrm);
       float edge = min(mix(1.0, dEdge.x, planar.x),
                    min(mix(1.0, dEdge.y, planar.y), mix(1.0, dEdge.z, planar.z)));
       float line = 1.0 - smoothstep(0.0, 0.035, edge);
       toonCol *= mix(1.0, 0.62, line * uOutline);
       vec3 finalCol = mix(outgoingLight, toonCol, uCartoon);
       gl_FragColor = vec4( finalCol + diffuseColor.rgb * vEmissive * gTileEmissive, diffuseColor.a );`,
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
    setJitter: (amount: number) => {
      jitter = amount
      // No `needsUpdate` — this is a uniform value, not a shader recompile. Setting needsUpdate here
      // would rebuild the program on every keypress for nothing.
      if (live) live.uJitter.value = amount
    },
    setCartoon: (v: Record<string, number>) => {
      // Held until compile for the same reason as the jitter: `onBeforeCompile` has not run before
      // the first render, so a setter called earlier would write into uniforms that do not exist.
      pendingCartoon = { ...(pendingCartoon ?? {}), ...v }
      if (!liveCartoon) return
      for (const [k, val] of Object.entries(pendingCartoon)) {
        if (liveCartoon[k]) liveCartoon[k].value = val
      }
    },
  }
}
