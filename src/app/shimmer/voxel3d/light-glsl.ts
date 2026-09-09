// The one definition of how the render-light field becomes a colour.
//
// ★ SHARED BY BOTH BLOCK MATERIALS ON PURPOSE. `tex/atlas.ts` and `mesh-bridge.ts` each compile
// their own program and each has its own name for world position and normal, so the temptation is
// to paste eight lines into both. This tree has an entry about exactly that shape — a hand-kept
// mirror agrees with its source right up until it does not, and a lighting model that differs
// between the textured and flat paths would be found by A/B-ing two materials and blamed on the
// atlas. One snippet, two call sites, arguments for the two names.
//
// ── ★★★ THE FIELD DARKENS; IT DOES NOT LIGHT ───────────────────────────────────────────────────
// The sky channel is NOT multiplied by a day factor, and that is the single most important line
// here. The scene's own sun and hemisphere already carry the hour: a surface at noon and the same
// surface at midnight differ in `outgoingLight` before this function is reached. Scaling the sky
// channel by the hour as well would darken the surface TWICE and the world would go black at dusk.
//
// So the sky channel means one thing only — *can this cell see the sky* — and the shading it
// produces is 1.0 anywhere it can. **A column with no field, or one outside the sample radius,
// therefore renders EXACTLY as the game does today**, which is what makes this safe to ship: the
// fallback is the current look, not a degradation of it.
//
// The block channel is the opposite and has to ADD, because a multiplicative term can never make a
// lantern work at midnight — `scene * 0.93` in a cave at night is still a dark cave. It is added
// after the shading, tinted, so a Mana Lantern is the only reason a deep cave is ever bright.
import * as THREE from 'three'
import { SAMPLE_RADIUS, RING_N } from '../voxel/render-light-ring'
import { SPAN, HEIGHT } from '../voxel/render-light'

/** Ring texture dimensions, in texels. Derived from the ring, never typed twice. */
export const LIGHT_TEX_W = RING_N * SPAN
export const LIGHT_TEX_H = HEIGHT

/**
 * ── the dials, in one place so they can be judged rather than argued about ─────────────────────
 * Same reasoning as `hollow-look.ts`: a look that lives inline in the biggest file in the tree can
 * only be changed by editing that file and can only be judged by playing the game.
 *
 * ⚠ `floor` IS THE ONE ALEX SHOULD RULE FIRST. It is how dark a sealed cave with no lantern gets,
 * and it trades suspense against a keeper who cannot see the block they are mining. 0.08 is
 * roughly Minecraft's, which is dark enough to need a light and bright enough to walk out of.
 */
export const LIGHT_LOOK = {
  /** Master mix. 0 is exactly today's render — the A/B control, not a disable flag. */
  mix: 1.0,
  /** Multiplier where the sky cannot reach at all. */
  floor: 0.08,
  /** Gamma on the sky channel. >1 keeps cave mouths reading bright and their depths dark. */
  skyCurve: 1.5,
  /** Gamma on the block channel; >1 tightens a lantern's pool instead of washing the room. */
  blockCurve: 1.4,
  /** How much colour a full-strength emitter adds. */
  blockGain: 0.95,
  /** ⚠ A LOOK, NOT A CANON FACT — warm because a flame is, and Alex judges it. */
  blockTint: [1.0, 0.88, 0.68] as const,
}

/**
 * Fragment declarations. Insert once per program, before `lightApply` is used.
 *
 * ⚠⚠ NO BACKTICKS ANYWHERE INSIDE THIS STRING, COMMENTS INCLUDED. It is a template literal, so a
 * backtick in a GLSL comment terminates it — and the habit of quoting an identifier in prose walked
 * straight into it TWICE while this file was being written. Both times TypeScript caught it as a
 * parse error, which is luck rather than protection: a stray backtick that happens to leave valid
 * TypeScript behind ships broken GLSL, and a program that fails to link renders NOTHING with no
 * error in the console.
 *
 * ⚠ `precision highp sampler3D` is not decoration — a 3D sampler has no default precision in GLSL
 * ES 3.0 and the program fails to LINK without it, which surfaces as a chunk that renders nothing
 * with no error in the console.
 */
export const LIGHT_DECL_GLSL = `
precision highp sampler3D;
uniform sampler3D uLightTex;
uniform vec3  uLightDim;
uniform vec2  uLightCentre;
uniform float uLightMix;
uniform float uLightFloor;
uniform float uLightSampleR;
uniform float uSkyCurve;
uniform float uBlockCurve;
uniform float uBlockGain;
uniform vec3  uBlockTint;

// The whole model, given a CELL CENTRE. Split out because not every surface wants the same cell:
// a block face wants the air in front of it, a cross-quad wants the cell it stands in. See below.
vec3 shimmerLightCell(vec3 col, vec3 albedo, vec3 cell) {
  if (uLightMix <= 0.0) return col;
  vec2 dcol = floor(cell.xz / ${SPAN}.0) - uLightCentre;
  float ring = max(abs(dcol.x), abs(dcol.y));
  // ★ FADED OUT OVER THE LAST SAMPLED COLUMN, never cut. A hard edge is a visible square drawn on
  // the ground around the keeper that MOVES WITH THEM, which is far more noticeable than the
  // slightly-wrong lighting it would be hiding.
  float w = uLightMix * (1.0 - smoothstep(uLightSampleR - 1.0, uLightSampleR, ring));
  if (w <= 0.0) return col;
  // The texture is a torus; RepeatWrapping does the modulo, including for negative world
  // coordinates, which is most of the map.
  float b = floor(texture(uLightTex, cell / uLightDim).r * 255.0 + 0.5);
  float skyL = floor(b / 16.0) / 15.0;
  float blkL = (b - floor(b / 16.0) * 16.0) / 15.0;
  float skyShade = pow(skyL, uSkyCurve);
  // ★★ THE BLOCK TERM IS SCALED BY THE DARK IT IS FILLING. Additive light is what makes a lantern
  // able to brighten a midnight cave at all — a multiplier cannot, since scene * 0.93 in the dark
  // is still dark. But an unconditional add means a waymark visibly washes the grass around it at
  // NOON, which is not a light, it is a stain. Minecraft never has this problem because it takes
  // max(sky, block) and the sky wins outdoors; the same result here is one factor.
  vec3 shaded = col * mix(uLightFloor, 1.0, skyShade)
              + albedo * uBlockTint * (uBlockGain * pow(blkL, uBlockCurve) * (1.0 - skyShade));
  return mix(col, shaded, w);
}

// ── ★ A BLOCK FACE: the air cell IN FRONT of it ───────────────────────────────────────────────
// A fragment sits exactly on the boundary plane; the block behind it is solid and its light is 0 by
// construction, so sampling there would render every surface in the world at the floor. Half a
// block along the normal lands in the air cell that is actually lit. (blockCoord() in atlas.ts
// steps the other way, for the opposite reason — it wants the solid block's identity.)
vec3 shimmerLight(vec3 col, vec3 albedo, vec3 wpos, vec3 nrm) {
  return shimmerLightCell(col, albedo, floor(wpos + nrm * 0.5) + 0.5);
}

// ── ★★ A CROSS-QUAD: the cell it STANDS IN, and stepping along the normal would be wrong ───────
// Leaves and plants are crossed quads, not cube faces. Their fragments are strictly INSIDE their
// own block and the quad is DoubleSide, so the normal flips halfway through the surface — stepping
// half a block along it lands in a different cell depending which side you are looking from, and
// the same leaf would light differently from the front and the back. The cell is simply the one
// the fragment is in, and render-light.ts gives leaves a real light level (they pass light and
// only end the sky's free fall), so there is something there to read.
vec3 shimmerLightHere(vec3 col, vec3 albedo, vec3 wpos) {
  return shimmerLightCell(col, albedo, floor(wpos) + 0.5);
}
`

/** Block faces. `wpos` is world position, `nrm` the face normal — both already varyings in callers. */
export const lightApply = (col: string, albedo: string, wpos: string, nrm: string): string =>
  `${col} = shimmerLight(${col}, ${albedo}, ${wpos}, ${nrm});`

/** Cross-quads (leaves, plants) and water — anything whose fragments sit inside their own cell. */
export const lightApplyHere = (col: string, albedo: string, wpos: string): string =>
  `${col} = shimmerLightHere(${col}, ${albedo}, ${wpos});`

export { SAMPLE_RADIUS }

export interface LightUniforms {
  uLightTex: { value: THREE.Data3DTexture | null }
  uLightDim: { value: THREE.Vector3 }
  uLightCentre: { value: THREE.Vector2 }
  uLightMix: { value: number }
  uLightFloor: { value: number }
  uLightSampleR: { value: number }
  uSkyCurve: { value: number }
  uBlockCurve: { value: number }
  uBlockGain: { value: number }
  uBlockTint: { value: THREE.Vector3 }
}

/**
 * One set of uniform OBJECTS, shared by every program that samples the field.
 *
 * ★ SHARED OBJECTS, NOT SHARED VALUES. Three uploads each program's uniforms from whatever object
 * is in its `shader.uniforms`, so handing the same objects to both materials means the host writes
 * the ring centre once and both the textured and flat paths see it. Two copies would be two things
 * to keep in step, and one of them would be updated in the frame loop and the other would not.
 *
 * ⚠ `uLightMix` DEFAULTS TO 0, so a material built by anything other than the world — the texture
 * bench, a dev page — renders exactly as it does today with no texture bound and no cost. Turning
 * the feature on is a deliberate act by the one caller that owns a ring.
 */
export function createLightUniforms(): LightUniforms {
  return {
    uLightTex: { value: null },
    uLightDim: { value: new THREE.Vector3(LIGHT_TEX_W, LIGHT_TEX_H, LIGHT_TEX_W) },
    uLightCentre: { value: new THREE.Vector2(0, 0) },
    uLightMix: { value: 0 },
    uLightFloor: { value: LIGHT_LOOK.floor },
    uLightSampleR: { value: SAMPLE_RADIUS },
    uSkyCurve: { value: LIGHT_LOOK.skyCurve },
    uBlockCurve: { value: LIGHT_LOOK.blockCurve },
    uBlockGain: { value: LIGHT_LOOK.blockGain },
    uBlockTint: { value: new THREE.Vector3(...LIGHT_LOOK.blockTint) },
  }
}
