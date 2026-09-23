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
import { GROUND_DECL_GLSL, GROUND_UNIFORMS, type GroundUniforms } from './ground-light'

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
  /** How bright a pane glows at midnight with a full-strength lantern in the room behind it, in
   *  units of the pane's own colour (1.0 = the glass at its noon albedo). See `shimmerPaneGlow`. */
  paneGlow: 1.2,
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
export const LIGHT_DECL_GLSL = GROUND_DECL_GLSL + `
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
uniform vec3  uHourLight;
uniform float uToonHour;
uniform float uPaneGlow;

// The field, read at a CELL CENTRE: x = sky level, y = block level (both 0..1), z = the weight
// this cell carries (the master mix, faded over the ring's last column). Split out 2026-09-14 so a
// surface can ask about a cell OTHER than the one it is lit by — the lit window reads the room
// behind the glass — without a second copy of the decode.
vec3 shimmerFieldAt(vec3 cell) {
  if (uLightMix <= 0.0) return vec3(0.0);
  vec2 dcol = floor(cell.xz / ${SPAN}.0) - uLightCentre;
  float ring = max(abs(dcol.x), abs(dcol.y));
  // ★ FADED OUT OVER THE LAST SAMPLED COLUMN, never cut. A hard edge is a visible square drawn on
  // the ground around the keeper that MOVES WITH THEM, which is far more noticeable than the
  // slightly-wrong lighting it would be hiding.
  float w = uLightMix * (1.0 - smoothstep(uLightSampleR - 1.0, uLightSampleR, ring));
  if (w <= 0.0) return vec3(0.0);
  // The texture is a torus; RepeatWrapping does the modulo, including for negative world
  // coordinates, which is most of the map.
  float b = floor(texture(uLightTex, cell / uLightDim).r * 255.0 + 0.5);
  float skyL = floor(b / 16.0) / 15.0;
  float blkL = (b - floor(b / 16.0) * 16.0) / 15.0;
  return vec3(skyL, blkL, w);
}

// The whole model, given a CELL CENTRE. Split out because not every surface wants the same cell:
// a block face wants the air in front of it, a cross-quad wants the cell it stands in. See below.
vec3 shimmerLightCell(vec3 col, vec3 albedo, vec3 cell) {
  vec3 f = shimmerFieldAt(cell);
  float w = f.z;
  if (w <= 0.0) return col;
  float skyL = f.x;
  float blkL = f.y;
  float skyShade = pow(skyL, uSkyCurve);
  // ★★ THE BLOCK TERM IS SCALED BY THE DARK IT IS FILLING. Additive light is what makes a lantern
  // able to brighten a midnight cave at all — a multiplier cannot, since scene * 0.93 in the dark
  // is still dark. But an unconditional add means a waymark visibly washes the grass around it at
  // NOON, which is not a light, it is a stain. Minecraft never has this problem because it takes
  // max(sky, block) and the sky wins outdoors; the same result here is one factor.
  vec3 shaded = col * mix(uLightFloor, 1.0, skyShade)
              + albedo * uBlockTint * (uBlockGain * pow(blkL, uBlockCurve) * (1.0 - skyShade))
  // ★ LIVING LIGHT (ground-light.ts): what GROWS lights the ground around it at night. Its own
  // tint, its own field, gated by the hour rather than by skyShade — a garden is open to the sky,
  // so a sky gate would zero it on exactly the ground it exists for.
              + albedo * uGroundTint * (uGroundGain * shimmerGroundAt(cell));
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

// ── ★ THE LIT WINDOW (2026-09-14): what a pane ADDS, read from the room BEHIND it ─────────────
// A pane is a sheet in the wall's plane, looked at from the yard and from the room. What makes a
// window read as lit at night is not the light falling ON the glass — that is the yard's — but the
// light in the room behind it. So the emissive is the BLOCK channel of the cell one step away from
// the viewer (front-facing: minus the normal; back-facing: plus), through the pane's own colour so
// a sunpetal window glows gold and the lead between panes stays lead. Gated by the hour: at noon a
// lantern behind glass adds nothing (a window in daylight is a hole, not a lamp), at midnight the
// full amount. The sky channel is NOT consulted — a lantern-lit yard seen through a pane from the
// room is a lit yard, which is the honest picture. Anything outside the ring is 0 (w = 0), so a
// bench with no field draws the pane exactly as before.
vec3 shimmerPaneGlow(vec3 tint, vec3 wpos, vec3 nrm, bool front) {
  vec3 away = front ? -nrm : nrm;
  vec3 f = shimmerFieldAt(floor(wpos + away) + 0.5);
  if (f.z <= 0.0) return vec3(0.0);
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float night = clamp(1.0 - dot(uHourLight, W), 0.0, 1.0);
  return tint * uPaneGlow * pow(f.y, uBlockCurve) * night * f.z;
}

// ── ★ THE KINDLE (2026-09-23): a glow that belongs to the NIGHT, not to the block ─────────────
// Canon (world/ather.md › The sky, looked at): as the Core banks, the cloud-walls KINDLE — the
// light moves from overhead out to the perimeter — and at dawn they go quiet. The emissive attribute
// is baked per vertex and knows no hour, so a kindled material stores its strength NEGATED
// (attrs.ts › EMISSIVE, see KINDLED_WALL there) and this turns it back: a positive glow passes untouched
// (a lantern burns the same at noon), a negative one is scaled by the same night factor the lit
// window uses, so the walls and the windows come up on one clock. The a argument is the tile's glow mask
// (1.0 where a path has no tile): a lit glow is e × a exactly as before; a kindled one lights the
// WHOLE face softly and the mask's crests on top — measured 09-23, crests alone moved a few
// scattered pixels and the wall still read as unlit stone at midnight.
float shimmerGlow(float e, float a) {
  if (e >= 0.0) return e * a;
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  return -e * clamp(1.0 - dot(uHourLight, W), 0.0, 1.0) * (0.2 + 0.6 * a);
}
`

/** Block faces. `wpos` is world position, `nrm` the face normal — both already varyings in callers. */
export const lightApply = (col: string, albedo: string, wpos: string, nrm: string): string =>
  `${col} = shimmerLight(${col}, ${albedo}, ${wpos}, ${nrm});`

/** Cross-quads (leaves, plants) and water — anything whose fragments sit inside their own cell. */
export const lightApplyHere = (col: string, albedo: string, wpos: string): string =>
  `${col} = shimmerLightHere(${col}, ${albedo}, ${wpos});`

export { SAMPLE_RADIUS }

export interface LightUniformsCore {
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
  /** The hour, for the CARTOON STACK (not for the field): the rig's up-face irradiance over a clear
   *  noon's, per channel — (1,1,1) at noon, silver ~0.28 at midnight. See hour-light.ts. It rides
   *  on the light uniforms because they are the ONE set of objects every stack consumer already
   *  shares; the host writes it once per frame from the live lights. */
  uHourLight: { value: THREE.Vector3 }
  /** Mix of the hour into the stack. 0 = the render before 2026-09-14 (the A/B control). */
  uToonHour: { value: number }
  /** The lit window's gain (`LIGHT_LOOK.paneGlow`). 0 = no pane ever glows (the A/B control). */
  uPaneGlow: { value: number }
}
/** The light uniforms plus the living-light set — the SAME objects everywhere, see ground-light.ts. */
export type LightUniforms = LightUniformsCore & GroundUniforms

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
    uHourLight: { value: new THREE.Vector3(1, 1, 1) },
    uToonHour: { value: 0 },
    uPaneGlow: { value: LIGHT_LOOK.paneGlow },
    // ⚠ SPREAD, NOT COPIED: these are the module-level objects, so the Hollows share them too.
    ...GROUND_UNIFORMS,
  }
}
