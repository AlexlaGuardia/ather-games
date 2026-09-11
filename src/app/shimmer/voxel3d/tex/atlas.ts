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
import { buildReliefArray } from './relief'
import { LIGHT_DECL_GLSL, lightApply, createLightUniforms, type LightUniforms } from '../light-glsl'

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

  return { texture: tex, relief, size, data }
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
export function createTexturedVoxelMaterial(tiles: TileArray, light: LightUniforms = createLightUniforms()): VoxelTexMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false })

  // `onBeforeCompile` does not run until the first render, so a setter called before that would be
  // writing to a uniform object that does not exist yet. Hold the wanted value and apply on compile.
  let live: {
    uJitter: { value: number }
    uAo: { value: number }
    uReliefAmt: { value: number }
    uReliefShade: { value: number }
  } | null = null
  let liveCartoon: Record<string, { value: number }> | null = null
  let jitter = DEFAULT_JITTER
  let ao = DEFAULT_AO
  let relief = DEFAULT_RELIEF
  let pendingCartoon: Record<string, number> | null = null

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = { value: tiles.texture }
    shader.uniforms.uJitter = { value: jitter }
    shader.uniforms.uAo = { value: ao }
    shader.uniforms.uRelief = { value: tiles.relief }
    shader.uniforms.uReliefAmt = { value: relief }
    shader.uniforms.uReliefShade = { value: relief }
    // ★ CARTOON LEVERS LIVE HERE TOO, AS UNIFORMS ON THIS SAME PROGRAM. Switching the world to
    // textures must not lose the look, and a second material per style would be one shader program
    // per style — the allocation shape that got this page blocked from WebGL. See settings.ts.
    shader.uniforms.uCartoon = { value: 0 }
    shader.uniforms.uToon = { value: 0 }
    shader.uniforms.uOutline = { value: 0 }
    shader.uniforms.uFaceShading = { value: 0.35 }
    shader.uniforms.uShadowLift = { value: 0.15 }
    Object.assign(shader.uniforms, light)
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
      `uniform float uCartoon;
uniform float uToon;
uniform float uOutline;
uniform float uFaceShading;
uniform float uShadowLift;
#include <common>
${LIGHT_DECL_GLSL}
uniform sampler2DArray uTiles;
uniform sampler2DArray uRelief;
uniform float uJitter;
uniform float uAo;
uniform float uReliefAmt;
uniform float uReliefShade;
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
  gTileUv = tileUv;
  vec4 tile = texture(uTiles, vec3(tileUv, vLayer));
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
    vec3 rn = normalize(texture(uRelief, vec3(tileUv, vLayer)).xyz * 2.0 - 1.0);
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
    vec3 nmap = texture(uRelief, vec3(gTileUv, vLayer)).xyz * 2.0 - 1.0;
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
       // ★★ THIS IS THE COPY THE WORLD RENDERS WITH — mesh-bridge.ts's stack is the untextured
       // fallback. Both carry the 2026-09-11 fix and cartoon-stack.test.ts holds them identical.
       // (1) luminance is the LIGHT on the face (irradiance = lit ÷ albedo), not the lit pixel, so a
       // dark material in full sun is not "in shadow"; (2) the shadow lift is scaled by the
       // material's own luminance and the cooling is a TINT of the base, not a flat blue-grey ADD —
       // the add was the same amount whatever the face was made of, so tan planks and dark shingles
       // were swamped and every wall in the world converged on one mauve (bisected on a sunlit
       // goldwood wall at 6 blocks, noon: shadowLift 0 → (88,61,26), default → (139,130,135)).
       const vec3 W = vec3(0.2126, 0.7152, 0.0722);
       float albLum = max(dot(diffuseColor.rgb, W), 0.03);
       float clum = clamp(dot(outgoingLight, W) / albLum, 0.0, 1.0);
       float stepped = floor(clum * 3.0 + 0.5) / 3.0;
       float shaped = mix(clum, stepped, uToon);
       vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);
       vec3 cool = mix(vec3(1.0), vec3(0.80, 0.86, 1.0), uShadowLift);
       vec3 lift = shade * (1.0 - shaped) * clamp(albLum * 2.0, 0.15, 1.0);
       vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) * mix(cool, vec3(1.0), shaped) + lift;
       vec3 fr = fract(vWorldPos - cnrm * 0.002);
       vec3 dEdge = min(fr, 1.0 - fr);
       vec3 planar = 1.0 - abs(cnrm);
       float edge = min(mix(1.0, dEdge.x, planar.x),
                    min(mix(1.0, dEdge.y, planar.y), mix(1.0, dEdge.z, planar.z)));
       float line = 1.0 - smoothstep(0.0, 0.035, edge);
       toonCol *= mix(1.0, 0.62, line * uOutline);
       vec3 finalCol = mix(outgoingLight, toonCol, uCartoon);
       ${lightApply('finalCol', 'diffuseColor.rgb', 'vWorldPos', 'cnrm')}
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
