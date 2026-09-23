/**
 * THE GROUND LIGHT — living, tended ground gives off soft low light of its own; a greyfield none.
 *
 * ★ CANON (athernyx `3a52d8e`, design-briefs/shimmer-resources.md › AND THE LIGHT LAW COVERS THE
 * GROUND): *how lit a thing is tells you how alive it still is.* It is what GROWS, never what is
 * BUILT — planks, paving and a pool's stone rim give nothing, crops and planted trees do. Soft, low,
 * moving: the same "still alive" light a live rinn has, never a glow effect or a lamp. A Hollow
 * ANSWERS it and still emits nothing (selfLight stays 0) — see the Hollow half at the bottom.
 *
 * ── ★★ WHY THIS IS NOT REAL LIGHTS, AND THE BUDGET ANSWER MAGII ASKED FOR IN WRITING ────────────
 * three's forward renderer pays for every PointLight in EVERY lit fragment of EVERY lit material,
 * and adding or removing one recompiles every program in the scene. A plot with thirty beds is
 * thirty lights; four plots in a cluster is a hundred and twenty. That does not fit on the UHD 630
 * this game is judged on — the world already spends its frame on the voxel field. Per-plot real
 * lights: NO.
 *
 * What does fit is the shape the world already uses for lanterns: a FIELD every surface samples.
 * Living light is flat by nature (it comes off the ground), so it rides a 2D texture over the same
 * toroidal ring the voxel light uses — 144x144 texels, two bytes each, 41KB. Cost: one texture fetch
 * per fragment on materials that already sample the 3D field, and a CPU splat of the sources
 * (a few hundred beds x 81 texels) only when something changes. Nothing per-plot, nothing per-body.
 *
 * ⚠ IT IGNORES OCCLUSION ON PURPOSE. The voxel field floods around walls; this does not. Living
 * light reaches four blocks and is faint, so a wall leaking a little of the garden behind it is the
 * cheap, correct trade — flooding it would mean a third channel through the whole voxel pass.
 * The HEIGHT gate (G channel = source height) is what stops a garden lighting the cave under it.
 *
 * ── WHAT "TENDED" MEANS HERE (build call, Jin's) ─────────────────────────────────────────────────
 * Sources are what a KEEPER planted: crops in beds, weighted by growth (a seed barely glows, a ripe
 * bed fully), saplings, and the trees those saplings grow into (kept until the trunk base is felled).
 * Wild grass and wild trees give nothing, or the whole overworld would be a lit carpet at night and
 * a greyfield would stop reading as the absence. Spirits are not sources: they are battle-only and
 * never stand in the overworld, so there is nothing to light from.
 */
import * as THREE from 'three'
import { RING_N } from '../voxel/render-light-ring'
import { SPAN } from '../voxel/render-light'

/** The dials. A look, judged by Alex on a plot at night — not canon facts. */
export const GROUND_LOOK = {
  /**
   * How much colour living light adds to a surface at full strength, at full night.
   * Measured 2026-09-23 on the headless A/B (`window.__groundTest`, midnight): 0.42 lifted the
   * ground 5-10% — present, not readable. 1.1 read as a lamp pool. 0.8 is the ship value.
   */
  gain: 0.8,
  /**
   * How much a Hollow's reflection picks up. Same A/B: 9 blew the body out to chrome-white (a lamp,
   * not "still alive"), 1.8 read chalky, 0.6 is a wet grey sheen that is plainly not the matte black
   * of the same body one frame later with the light off. That difference IS the tell.
   */
  hollowGain: 0.6,
  /** Splat radius in blocks. */
  radius: 4,
  /** ⚠ A LOOK: greener than the lantern's flame tint so the two lights never read as one. */
  tint: [0.80, 0.96, 0.52] as const,
  /** How far a source's intensity is pushed toward full (overlapping beds saturate, not blow out). */
  cap: 1.0,
}

/** A crop's light by growth phase: seed, sprout, growth, ready. */
export const PHASE_WEIGHT = [0.22, 0.45, 0.7, 1.0] as const
/** A planted sapling — alive and tended, small. */
export const SAPLING_WEIGHT = 0.55
/** A tree grown from a planted sapling — a standing tended thing, brighter than the sapling was. */
export const GROWN_TREE_WEIGHT = 0.85

/**
 * How brightly one bed lives. Growth sets the ceiling; CARE decides how close to it the bed gets —
 * Greg's locked line: *"a tended thing holds the dark back better than one nobody minds."* An
 * unwatered ripe bed still glows (it is alive), just less than one somebody is looking after.
 * `care` is the bed's damp-or-fed fraction, 0..1.
 */
export function bedGlow(phase: number, care: number): number {
  const p = PHASE_WEIGHT[Math.max(0, Math.min(3, phase | 0))]
  return p * (0.55 + 0.45 * Math.max(0, Math.min(1, care)))
}

export interface GroundSource { x: number; y: number; z: number; w: number }

/** Texture side, in texels (= blocks). The voxel light ring's width; the torus wraps on it. */
export const GROUND_W = RING_N * SPAN
/**
 * Sources further than this from the ring centre are dropped. Derivation: a fragment reads up to
 * ~64 blocks from the centre (SAMPLE_RADIUS columns + the column itself), a source splats `radius`
 * further, and the torus repeats every GROUND_W — so source + fragment + radius must stay under
 * GROUND_W or a far garden aliases onto a near field. 64 + 64 + 4 = 132 < 144.
 */
export const GROUND_REACH = 64

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Splat sources into an RG byte field over the torus. R = intensity, G = source height (y of the
 * cell a plant stands in). Pure; the host uploads the result.
 *
 * ★ G IS THE HEIGHT OF THE STRONGEST CONTRIBUTOR, not an average — averaging a terrace garden with
 * the one below it would place the light in the air between them.
 */
export function splatGround(
  sources: readonly GroundSource[], centreX: number, centreZ: number,
  out: Uint8Array = new Uint8Array(GROUND_W * GROUND_W * 2), radius = GROUND_LOOK.radius,
): Uint8Array {
  const acc = new Float32Array(GROUND_W * GROUND_W)
  const best = new Float32Array(GROUND_W * GROUND_W)
  out.fill(0)
  const r = Math.ceil(radius)
  for (const s of sources) {
    if (s.w <= 0) continue
    if (Math.abs(s.x - centreX) > GROUND_REACH || Math.abs(s.z - centreZ) > GROUND_REACH) continue
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dz)
        if (d > radius) continue
        const f = 1 - d / radius
        const c = s.w * f * f
        const i = mod(s.z + dz, GROUND_W) * GROUND_W + mod(s.x + dx, GROUND_W)
        acc[i] += c
        if (c > best[i]) { best[i] = c; out[i * 2 + 1] = Math.max(0, Math.min(255, s.y)) }
      }
    }
  }
  for (let i = 0; i < acc.length; i++) {
    // Soft saturation: a dense garden reads brighter than one bed, and never past the cap.
    const v = GROUND_LOOK.cap * (1 - Math.exp(-acc[i] * 1.6))
    out[i * 2] = Math.round(Math.max(0, Math.min(1, v)) * 255)
  }
  return out
}

/** Stable fingerprint of a source set, so the host re-splats only when something changed. */
export function sourcesKey(sources: readonly GroundSource[], cx: number, cz: number): string {
  let h = 2166136261 >>> 0
  const mix = (n: number) => { h = Math.imul(h ^ (n | 0), 16777619) >>> 0 }
  mix(cx); mix(cz); mix(sources.length)
  for (const s of sources) { mix(s.x); mix(s.y); mix(s.z); mix(Math.round(s.w * 100)) }
  return h.toString(36)
}

/**
 * ── THE SHARED UNIFORM OBJECTS ──────────────────────────────────────────────────────────────────
 * One set for the whole app, spread into every `LightUniforms` AND onto the Hollow materials, so a
 * host write lands in the world's blocks and in every Hollow at once. ⚠ `uGroundOn` defaults to 0,
 * so a dev page with no host renders exactly as before — same rule as `uLightMix`.
 */
export const GROUND_UNIFORMS = {
  uGroundTex: { value: null as THREE.DataTexture | null },
  uGroundOn: { value: 0 },
  uGroundGain: { value: GROUND_LOOK.gain },
  uGroundHollowGain: { value: GROUND_LOOK.hollowGain },
  uGroundTint: { value: new THREE.Vector3(...GROUND_LOOK.tint) },
  /** Seconds, for the slow breathing. Named apart from the many local `uTime`s on purpose. */
  uGroundTime: { value: 0 },
  /** 0 at noon, ~1 at full night. Living light is there by day; the sun simply drowns it. */
  uGroundNight: { value: 0 },
  /** Ring centre in BLOCKS, for the far-edge fade that keeps the torus from aliasing. */
  uGroundCentre: { value: new THREE.Vector2(0, 0) },
}
export type GroundUniforms = typeof GROUND_UNIFORMS

/**
 * GLSL. ⚠ NO BACKTICKS INSIDE — this is a template literal (same trap light-glsl.ts documents).
 * Returns living light at a world point, 0..1, already gated by night and breathing.
 */
export const GROUND_DECL_GLSL = `
uniform sampler2D uGroundTex;
uniform float uGroundOn;
uniform float uGroundGain;
uniform float uGroundHollowGain;
uniform vec3  uGroundTint;
uniform float uGroundTime;
uniform float uGroundNight;
uniform vec2  uGroundCentre;
float shimmerGroundAt(vec3 p) {
  if (uGroundOn <= 0.0 || uGroundNight <= 0.0) return 0.0;
  vec2 far = abs(p.xz - uGroundCentre);
  float edge = 1.0 - smoothstep(${GROUND_REACH - 8}.0, ${GROUND_REACH}.0, max(far.x, far.y));
  if (edge <= 0.0) return 0.0;
  vec2 t = texture(uGroundTex, p.xz / ${GROUND_W}.0).rg;
  if (t.r <= 0.0) return 0.0;
  // Height gate: full from a block under the plant cell to a Hollow's head over it, gone by four.
  float dy = p.y - t.g * 255.0;
  float band = 1.0 - smoothstep(dy < 0.0 ? 1.0 : 2.5, dy < 0.0 ? 2.5 : 4.5, abs(dy));
  // Moving, slowly: two drifting waves, never a flicker. Alive, not a lamp.
  float breathe = 0.80 + 0.12 * sin(uGroundTime * 0.55 + p.x * 0.37 + p.z * 0.23)
                       + 0.08 * sin(uGroundTime * 0.9 - p.x * 0.19 + p.z * 0.41);
  return t.r * band * breathe * uGroundNight * edge;
}
`

/** The live texture. One per world; the host uploads a fresh splat when the source set changes. */
export function createGroundTexture(): { texture: THREE.DataTexture; data: Uint8Array } {
  const data = new Uint8Array(GROUND_W * GROUND_W * 2)
  const texture = new THREE.DataTexture(data, GROUND_W, GROUND_W, THREE.RGFormat, THREE.UnsignedByteType)
  // LINEAR on purpose — the opposite of the voxel field. This light has no walls to leak through,
  // and bilinear is what turns a 1-texel-per-block splat into a soft pool instead of a checkerboard.
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.unpackAlignment = 1
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return { texture, data }
}

/**
 * ── THE HOLLOW HALF: IT ANSWERS, IT DOES NOT EMIT ───────────────────────────────────────────────
 * The brief: diffuse dead flat, specular borrowed from the room. So living light enters a Hollow
 * ONLY as reflected radiance — the lit ground mirrored in the wet lower body — added to the IBL
 * specular term, where three multiplies it by the same Fresnel/BRDF as the sky it already borrows.
 * No emissive, no diffuse, no per-body state: every Hollow shares this one patch and reads its
 * own world position, so one material per form survives (hollows.md bar 5).
 */
export function patchHollowForGround(mat: THREE.MeshStandardMaterial): void {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, GROUND_UNIFORMS)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 gw = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
  gw = batchingMatrix * gw;
  #endif
  #ifdef USE_INSTANCING
  gw = instanceMatrix * gw;
  #endif
  vGroundW = (modelMatrix * gw).xyz;
}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;' + GROUND_DECL_GLSL)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
{
  // What the wet surface sees when it looks DOWN: the lit ground under it. Upward reflections see
  // sky and keep the borrowed environment alone.
  vec3 rW = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
  float down = smoothstep(0.15, -0.6, rW.y);
  radiance += uGroundTint * (uGroundHollowGain * shimmerGroundAt(vGroundW) * down);
}`)
  }
  mat.customProgramCacheKey = () => 'hollow-ground-v1'
}
