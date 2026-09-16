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
import { buildTileArray, buildVariationFlags, LAYER_COUNT } from './tiles'
import { buildReliefArray } from './relief'
import { createLightUniforms, type LightUniforms } from '../light-glsl'
import { cartoonStackGlsl, cartoonUniforms, CARTOON_DECL_GLSL } from '../cartoon-glsl'

export interface TileArray {
  texture: THREE.DataArrayTexture
  /**
   * Per-texel surface normals for the same layers, in the same order (see `relief.ts`).
   *
   * ★ BUILT AND RETURNED TOGETHER WITH THE COLOUR, never fetched separately, because the two must
   * agree about layer indexing or every block wears another block's relief — and that failure is
   * quiet, since both halves stay internally consistent and the world merely lights oddly. One call
   * site, one size, one layer order, no second lookup table.
   */
  relief: THREE.DataArrayTexture
  /**
   * Per-layer orientation grade (`tiles.ts` › `buildVariationFlags`), a LAYER_COUNT×1 byte strip
   * the shader reads at `vLayer`: 0 fixed · 1 mirror only · 2 all eight orientations. Built here
   * with the other two for the same reason the relief is — one call, one layer order.
   */
  variation: THREE.DataTexture
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

  // ── ★★ THE RELIEF MAP, AND ITS FILTERING IS THE OPPOSITE OF THE COLOUR'S ON PURPOSE ──────────
  // The albedo is NEAREST because crisp texels are the entire aesthetic. The normal map is LINEAR,
  // and that pairing IS the look: sharp pixels lit by a smooth surface. Sampling the normals
  // NEAREST instead would light each texel as its own flat facet, so a wall would read as a grid of
  // tiny tiles catching the sun at slightly different angles — which is not "more pixel art", it is
  // the foil effect the blur in `relief.ts` exists to prevent, reintroduced one layer further on.
  //
  // ⚠ `NoColorSpace`, not sRGB. These bytes are a direction, not a colour; letting three apply the
  // sRGB transfer curve would bend every normal toward the flat end non-linearly — a world that is
  // subtly under-lit in shadow and over-lit in highlight, with nothing anywhere to point at.
  const relief = new THREE.DataArrayTexture(buildReliefArray(data, size), size, size, LAYER_COUNT)
  relief.format = THREE.RGBAFormat
  relief.type = THREE.UnsignedByteType
  relief.colorSpace = THREE.NoColorSpace
  relief.wrapS = THREE.RepeatWrapping
  relief.wrapT = THREE.RepeatWrapping
  relief.magFilter = THREE.LinearFilter
  relief.minFilter = THREE.LinearMipmapLinearFilter
  relief.generateMipmaps = true
  relief.anisotropy = tex.anisotropy
  relief.needsUpdate = true

  // The orientation grades, one byte per layer. NEAREST and unmipped: it is a lookup, not a picture.
  const flags = buildVariationFlags()
  const rgba = new Uint8Array(LAYER_COUNT * 4)
  for (let i = 0; i < LAYER_COUNT; i++) rgba[i * 4] = flags[i]
  const variation = new THREE.DataTexture(rgba, LAYER_COUNT, 1, THREE.RGBAFormat, THREE.UnsignedByteType)
  variation.colorSpace = THREE.NoColorSpace
  variation.magFilter = THREE.NearestFilter
  variation.minFilter = THREE.NearestFilter
  variation.generateMipmaps = false
  variation.needsUpdate = true

  return { texture: tex, relief, variation, size, data }
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
  /** How much of the mesher's AO term to apply, 0 = the flat look this material shipped with. */
  setAo: (amount: number) => void
  /** Per-texel relief strength, 0 = flat faces. Alex's dial. */
  setRelief: (amount: number) => void
  /** Per-block tile orientation (turn + mirror), 1 = on, 0 = every block wears the tile the same way. */
  setVariation: (on: boolean) => void
  /** Cartoon levers — uniform writes, never a recompile. See settings.ts. */
  setCartoon: (v: Record<string, number>) => void
}

/** How much a block's brightness may drift from its neighbours. Small on purpose — this is meant to
 *  read as "stone is not uniform", not as a checkerboard. */
export const DEFAULT_JITTER = 0.07

/** How much of the mesher's ambient-occlusion term reaches the pixels. 1 = all of it, 0 = the flat
 *  look this material shipped with while the term was being discarded. */
export const DEFAULT_AO = 1

/**
 * Strength of the per-texel relief, 0 = flat faces (exactly the old look).
 *
 * ⚠ THIS IS A LOOK CALL AND IT IS ALEX'S. 0.6 is a starting position, not a ruling: enough that a
 * mortar course and a plank groove catch the sun, short of the wet-plastic reading that full
 * strength gives a surface whose silhouette never agrees with its shading.
 */
export const DEFAULT_RELIEF = 0.6

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
export function createTexturedVoxelMaterial(
  tiles: TileArray, light: LightUniforms = createLightUniforms(),
  /**
   * `cutout`: the GLASS pass (2026-09-12). Same program, one extra line: a texel whose atlas alpha
   * is below half is discarded. Alpha is the emissive mask everywhere else in the atlas, which is
   * safe here because nothing this pass draws emits — the two meanings never meet on one texel.
   * A second compiled program for the world, the same budget the canopy pays.
   */
  opts: { cutout?: boolean } = {},
): VoxelTexMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false })

  // `onBeforeCompile` does not run until the first render, so a setter called before that would be
  // writing to a uniform object that does not exist yet. Hold the wanted value and apply on compile.
  let live: {
    uJitter: { value: number }
    uAo: { value: number }
    uReliefAmt: { value: number }
    uReliefShade: { value: number }
    uVariation: { value: number }
  } | null = null
  let liveCartoon: Record<string, { value: number }> | null = null
  let jitter = DEFAULT_JITTER
  let ao = DEFAULT_AO
  let relief = DEFAULT_RELIEF
  let variation = 1
  let pendingCartoon: Record<string, number> | null = null

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = { value: tiles.texture }
    shader.uniforms.uJitter = { value: jitter }
    shader.uniforms.uAo = { value: ao }
    shader.uniforms.uRelief = { value: tiles.relief }
    shader.uniforms.uReliefAmt = { value: relief }
    shader.uniforms.uReliefShade = { value: relief }
    shader.uniforms.uVarFlags = { value: tiles.variation }
    shader.uniforms.uLayerCount = { value: LAYER_COUNT }
    shader.uniforms.uVariation = { value: variation }
    // ★ CARTOON LEVERS LIVE HERE TOO, AS UNIFORMS ON THIS SAME PROGRAM. Switching the world to
    // textures must not lose the look, and a second material per style would be one shader program
    // per style — the allocation shape that got this page blocked from WebGL. See settings.ts.
    Object.assign(shader.uniforms, cartoonUniforms(), light)
    liveCartoon = shader.uniforms as Record<string, { value: number }>
    if (pendingCartoon) for (const [k, val] of Object.entries(pendingCartoon)) {
      if (liveCartoon[k]) liveCartoon[k].value = val
    }
    live = shader.uniforms as unknown as NonNullable<typeof live>

    shader.vertexShader = mustReplace(
      shader.vertexShader,
      '#include <common>',
      `#include <common>
attribute float aLayer;
attribute float aEmissive;
attribute float aAo;
varying float vLayer;
varying float vEmissive;
varying float vAo;
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
vAo = aAo;
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
      `${CARTOON_DECL_GLSL}
#include <common>
uniform sampler2DArray uTiles;
uniform sampler2DArray uRelief;
uniform float uJitter;
uniform float uAo;
uniform float uReliefAmt;
uniform float uReliefShade;
uniform sampler2D uVarFlags;
uniform float uLayerCount;
uniform float uVariation;
/** Where the painted light comes from, in a tile's tangent frame: up and slightly left, the pixel
 *  artist's convention this world's art is already drawn to.
 *  Written PRE-NORMALISED from vec3(-0.45, 0.62, 0.64) rather than wrapped in normalize(): a const
 *  initialised by a function call is a constant-expression question that differs between GLSL ES
 *  versions, and getting it wrong does not warn -- the program fails to LINK and the world renders
 *  nothing, with no console error. Not a gamble worth taking to save one divide at compile time. */
const vec3 RELIEF_KEY = vec3(-0.450790, 0.621088, 0.641123);
varying float vLayer;
varying float vEmissive;
varying float vAo;
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
float gTileEmissive = 0.0;
// The tile UV, computed once in <color_fragment> and read again by the relief block a few chunks
// later. Same reason as gTileEmissive above: produced and consumed within one fragment, and the two
// MUST be the same value or the normal map and the colour describe different points on the tile.
vec2 gTileUv = vec2(0.0);
// ── ★ THE TILE'S ORIENTATION ON THIS BLOCK (2026-09-16) ──────────────────────────────────────
// The orientation is a 2×2 orthogonal map applied to the block-local UV (tileOrient), and three
// things downstream must all see the SAME map or the surface lies: the colour sample, the relief
// sample, and the relief NORMAL — a tangent-space normal read from a turned tile points along the
// tile's turned axes, so it is mapped back through the transpose (= inverse, the map is
// orthogonal) before it meets the world's tangent frame. Miss that one and a mirrored block is
// lit from the opposite side of its bumps: the sun appears to come from two directions at once,
// block by block, which reads as a lighting bug nobody can name. gDx/gDy are the screen-space
// derivatives of the ORIGINAL uv mapped through the same matrix, handed to textureGrad — the
// per-block fract() is a discontinuity, and a plain texture() there picks the smallest mip along
// every block edge, a hairline of wrong texels on every seam.
mat2 gOrient = mat2(1.0, 0.0, 0.0, 1.0);
vec2 gDx = vec2(0.0), gDy = vec2(0.0);

// Which of the eight orientations this block's face wears, as a matrix. grade is the layer's
// byte from uVarFlags: 0 never turns, 1 mirrors only, 2 turns and mirrors.
mat2 tileOrient(float grade, vec3 cell) {
  mat2 M = mat2(1.0, 0.0, 0.0, 1.0);
  if (grade < 0.5 || uVariation < 0.5) return M;
  // Decorrelated from the value jitter's hash by an offset, so a mirrored block is not also the
  // brighter one — two variations that always travel together read as one.
  int o = int(hashBlock(cell + vec3(17.0, 5.0, 29.0)) * 7.999);
  if ((o & 4) != 0) M = mat2(-1.0, 0.0, 0.0, 1.0);
  if (grade > 1.5) {
    int rot = o & 3;
    // A quarter turn, column-major: (x, y) -> (-y, x). Applied rot times.
    mat2 Q = mat2(0.0, 1.0, -1.0, 0.0);
    if (rot >= 1) M = Q * M;
    if (rot >= 2) M = Q * M;
    if (rot >= 3) M = Q * M;
  }
  return M;
}

// ── ★ THE TANGENT FRAME, FREE ON AXIS-ALIGNED FACES ──────────────────────────────────────────
// A normal map is in tangent space, so it needs u and v as world directions. The usual cost is a
// tangent ATTRIBUTE per vertex; here every quad is an axis-aligned unit cube face and the UV
// derivation below already picks the two in-plane axes, so the frame is those same two axes and
// costs nothing. ⚠ THE BRANCHES HERE MUST MATCH THE UV BRANCHES EXACTLY — u and v swapped, or a
// sign dropped, tilts the relief along the wrong axis and lights every wall as though the sun came
// from ninety degrees off. relief.test.ts pins the map; this pins where the map is pointed.
void tileFrame(vec3 an, out vec3 T, out vec3 B) {
  if (an.y > 0.5)      { T = vec3(1.0, 0.0, 0.0);  B = vec3(0.0, 0.0, 1.0); }
  else if (an.x > 0.5) { T = vec3(0.0, 0.0, 1.0);  B = vec3(0.0, -1.0, 0.0); }
  else                 { T = vec3(1.0, 0.0, 0.0);  B = vec3(0.0, -1.0, 0.0); }
}`,
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
  // Derivatives of the CONTINUOUS uv, taken before the per-block fract below breaks it.
  vec2 dTx = dFdx(tileUv), dTy = dFdy(tileUv);
  {
    float grade = texture(uVarFlags, vec2((vLayer + 0.5) / uLayerCount, 0.5)).r * 255.0;
    gOrient = tileOrient(grade, blockCoord());
    // Turn about the block's own centre: the tile stays on its block, only its facing changes.
    tileUv = gOrient * (fract(tileUv) - 0.5) + 0.5;
    gDx = gOrient * dTx; gDy = gOrient * dTy;
  }
  gTileUv = tileUv;
  vec4 tile = textureGrad(uTiles, vec3(tileUv, vLayer), gDx, gDy);
${opts.cutout ? '  if (tile.a < 0.5) discard;' : ''}
  diffuseColor.rgb *= tile.rgb;
  // ── ★★ AMBIENT OCCLUSION, WHICH THIS MATERIAL SPENT A MONTH COMPUTING AND DISCARDING ────────
  // vertexColors is off here for a good reason (see the material note), and the mesher's AO term
  // used to live INSIDE that vertex colour — so wiring the texture array into the world silently
  // switched the corner shading off with it. Measured before the fix: 54.5% of vertices at Moonwell
  // Glade carried a term, mean multiplier 0.885, none of it reaching a pixel.
  //
  // It arrives on its own aAo attribute now and multiplies the ALBEDO, which is the same path the
  // flat control material puts it on: the Lambert term and the render-light field both read
  // diffuseColor, so a corner is occluded from the sun and from a lantern alike — which is what
  // occlusion means. ⚠ It is the SHORT-RANGE term under render-light's long-range one; if a corner
  // ever reads dark twice, this dial and LIGHT_LOOK are the pair to look at together, not either
  // one alone.
  diffuseColor.rgb *= mix(1.0, vAo, uAo);
  // ── ★★★ RELIEF, ON THE ALBEDO, BECAUSE THE CARTOON STACK QUANTISES THE LIGHT ────────────────
  // Alex, 2026-09-09, judging uReliefAmt 0.6: *"it looks flat, the relief isnt doing much."* He was
  // right and the map was never the problem. Relief perturbs the NORMAL, which lands in
  // "outgoingLight" — and "<opaque_fragment>" below then posterises that to three levels
  // ("floor(clum * 3.0 + 0.5) / 3.0", at uToon 0.85 in the shipped "cartoon" style).
  //
  // MEASURED against the real 64px tiles: relief moves face luminance by a mean of 1.66% at
  // uReliefAmt 0.6. Only (1 - uToon) of that survives as continuous shading — 0.25% — and the
  // other 85% must cross a 33.3% bucket to change a single pixel. It is twenty times too small.
  // ⚠⚠ AND THE DIAL COULD NOT HAVE FIXED IT: at uReliefAmt 1.0 the surviving swing is 0.41%, still
  // invisible. Judging that A/B could only ever have returned "flat".
  //
  // ★ THIS IS THE AO REGRESSION'S TWIN AND IT TAKES THE SAME MEDICINE. AO was computed and thrown
  // away because it rode a channel the material had switched off; it works now because it
  // multiplies the ALBEDO. Albedo is not quantised — "toonCol" is "diffuseColor.rgb * face *
  // (0.35 + 0.95 * shaped)", so a per-texel factor here passes through the toon stack untouched
  // and the cel look is preserved exactly. One term on the light, one on the paint.
  //
  // ⚠ THE KEY DIRECTION IS FIXED AND IN TANGENT SPACE, WHICH IS DELIBERATE, NOT A SHORTCUT. This
  // renderer already draws light rather than simulating it — "faceLum" twenty lines down is a hard
  // constant per axis. A sun-dependent term here would make surface detail swim as the day turns,
  // which is the one thing a painted texture must not do.
  if (uReliefShade > 0.0) {
    vec3 rn = normalize(textureGrad(uRelief, vec3(tileUv, vLayer), gDx, gDy).xyz * 2.0 - 1.0);
    rn.xy = transpose(gOrient) * rn.xy;   // back from the turned tile's axes (see gOrient)
    // Subtracting KEY.z makes this EXACTLY neutral on a flat texel. Without it the dial would
    // darken or brighten the whole world as it turns up, which reads as a brightness bug rather
    // than as relief, and would send the next person to LIGHT_LOOK.
    float rl = dot(rn, RELIEF_KEY) - RELIEF_KEY.z;
    diffuseColor.rgb *= mix(1.0, clamp(1.0 + rl * 1.7, 0.5, 1.6), uReliefShade);
  }
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

    // ── ★★★ THE RELIEF: WHERE A BLOCK FACE STOPS BEING A FLAT PANEL ─────────────────────────────
    // Injected at `<normal_fragment_maps>` because that is where three has just finished deciding
    // what `normal` is and has not yet lit anything with it — read off `meshlambert.glsl.js`, which
    // orders color_fragment (96) → normal_fragment_begin (102) → normal_fragment_maps (103) →
    // lights_lambert_fragment (107). Perturbing after the lighting would change nothing at all and
    // look exactly like a relief map too weak to see.
    //
    // ⚠⚠ `normal` IS IN VIEW SPACE and the tangent frame is in world space, so the perturbed normal
    // is transformed by `viewMatrix` on the way back. Skipping that does not blank the screen: it
    // ties the lighting to the CAMERA, so the world's shading swims as the keeper turns, which reads
    // as a shader bug in the sun rather than in this line.
    //
    // ★ AND THE GEOMETRIC NORMAL IS DELIBERATELY LEFT ALONE FOR EVERYTHING ELSE. `cnrm` below still
    // drives face shading, the outline, and — the one that would actually break — `lightApply`,
    // which steps half a block ALONG THE NORMAL to find the air cell in front of the face. A
    // perturbed normal there would step into a neighbouring cell on any textured surface and sample
    // the wrong column's light. Relief changes how a face catches light; it must not change which
    // cell the face is standing next to.
    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
{
  if (uReliefAmt > 0.0) {
    vec3 an = abs(vVoxNormal);
    vec3 T, B;
    tileFrame(an, T, B);
    vec3 nmap = textureGrad(uRelief, vec3(gTileUv, vLayer), gDx, gDy).xyz * 2.0 - 1.0;
    nmap.xy = transpose(gOrient) * nmap.xy;   // back from the turned tile's axes (see gOrient)
    // The dial scales the TANGENT components and the vector is renormalised, so 0 is exactly flat
    // and 1 is exactly what relief.ts baked — a lerp of the whole vector toward (0,0,1) would do
    // the same thing more slowly and read as if the depth constant had moved.
    nmap.xy *= uReliefAmt;
    vec3 bumped = normalize(T * nmap.x + B * nmap.y + normalize(vVoxNormal) * nmap.z);
    normal = normalize((viewMatrix * vec4(bumped, 0.0)).xyz);
  }
}`,
      'fragment shader',
    )

    // ★ THE CARTOON STACK, ON THE TEXTURED PATH — the ONE copy, in cartoon-glsl.ts (since 09-13;
    // this file and mesh-bridge.ts carried it twice before, held together by a test). Face
    // brightness uses the exact axis-aligned normal; banding makes lighting read as drawn rather
    // than lit; the shadow lift stops caves reading as murk; the outline is free here because
    // world position is already a varying for the block jitter.
    shader.fragmentShader = mustReplace(
      shader.fragmentShader,
      '#include <opaque_fragment>',
      cartoonStackGlsl('vVoxNormal', 'vWorldPos', 'diffuseColor.rgb * vEmissive * gTileEmissive'),
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
    setAo: (amount: number) => {
      ao = amount
      if (live) live.uAo.value = amount
    },
    setRelief: (amount: number) => {
      relief = amount
      // ⚠ BOTH, OR THE A/B LIES. `uReliefAmt` is the normal perturbation (which only the natural
      // style can show) and `uReliefShade` is the albedo term (which the cartoon style can). A
      // toggle that moved only the first is exactly the switch that told Alex relief does nothing.
      if (live) { live.uReliefAmt.value = amount; live.uReliefShade.value = amount }
    },
    setVariation: (on: boolean) => {
      variation = on ? 1 : 0
      if (live) live.uVariation.value = variation
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
