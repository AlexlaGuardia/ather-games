// Host side of the port boundary — finished attributes → Three.js.
//
// ★ THIS FILE IS ALLOWED TO IMPORT THREE. `src/app/shimmer/voxel/` is not, and `purity.test.ts`
// enforces that by walking its import graph. The whole portability strategy lives on this line.
//
// The per-voxel work — colour lookup, per-vertex expansion — lives in `attrs.ts` so it can run
// inside the generation Worker, which cannot import three. What is left here is buffer wrapping and
// the one shared material.

import * as THREE from 'three'
import type { MeshAttrs } from './attrs'
import type { VoxelSettings } from './settings'
import { lightApply, lightApplyHere, LIGHT_DECL_GLSL, createLightUniforms, type LightUniforms } from './light-glsl'
import { cartoonStackGlsl, cartoonUniforms, CARTOON_DECL_GLSL } from './cartoon-glsl'

export { MATERIAL_COLOR, EMISSIVE } from './attrs'

/** Wrap worker-built buffers in a geometry. No copies — these arrays were transferred. */
export function toGeometry(a: MeshAttrs): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3))
  g.setAttribute('aEmissive', new THREE.BufferAttribute(a.emissive, 1))
  // ★ AO AS ITS OWN ATTRIBUTE, because the textured world cannot read `color` (see attrs.ts).
  // It is set unconditionally: the flat control material ignores it, and a geometry that carries it
  // only sometimes is a geometry whose shading depends on which material happened to build it.
  g.setAttribute('aAo', new THREE.BufferAttribute(a.ao, 1))
  // One float per vertex is the entire cost of texturing — UVs are derived in-shader.
  g.setAttribute('aLayer', new THREE.BufferAttribute(a.layers, 1))
  // Leaves only — crossed quads have no face for the shader's UV derivation to key off. See attrs.ts.
  if (a.uv) g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2))
  // Water only — depth attenuation. Absent on the solid and leaf passes by design (see attrs.ts).
  if (a.depth) g.setAttribute('aDepth', new THREE.BufferAttribute(a.depth, 1))
  if (a.flow) g.setAttribute('aFlow', new THREE.BufferAttribute(a.flow, 2))
  g.setIndex(new THREE.BufferAttribute(a.indices, 1))
  g.computeBoundingSphere()
  return g
}

/** The uniforms the settings panel drives. Held so a style change is a value write, not a rebuild. */
export interface VoxelMaterial extends THREE.Material {
  uniforms?: Record<string, { value: number }>
}

/**
 * One shared material for the whole world, not one per chunk.
 *
 * ★ A material per chunk is a shader program per chunk, and hundreds of programs is how a voxel
 * renderer dies — this page was BLOCKED from creating a WebGL context today for exactly that, from
 * a material per dropped item. `render-audit.test.ts` now fails the build on it.
 *
 * ★ AND THE CARTOON PATH IS A UNIFORM, NOT A SECOND MATERIAL. Both shading models are compiled into
 * this one program and selected by `uCartoon`, so switching styles in settings is instant and
 * allocates nothing. A second material would be the same bug wearing a different hat.
 */
export function createVoxelMaterial(light: LightUniforms = createLightUniforms()): VoxelMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }) as VoxelMaterial
  const u = cartoonUniforms()
  mat.uniforms = u

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, light)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nattribute float aEmissive;\nvarying float vEmissive;\n'
        + 'varying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvEmissive = aEmissive;\n'
        + 'vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n'
        + 'vWNorm = normalize(mat3(modelMatrix) * objectNormal);')

    // ── the cartoon stack — the ONE copy, in cartoon-glsl.ts (since 09-13) ────────────────────
    // Four levers, each independently dialled from settings so the look can be judged by moving
    // one at a time on the real world rather than argued about in the abstract. The history of the
    // 09-11 irradiance + tint fixes is on the module.
    const emit = cartoonStackGlsl('vWNorm', 'vWPos', 'diffuseColor.rgb * vEmissive')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying float vEmissive;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;\n'
        + CARTOON_DECL_GLSL)
      // Three renamed this chunk around 0.16x; handle both, or a version bump silently unlights
      // every ore in the world with no error anywhere.
      .replace('#include <output_fragment>', emit)
      .replace('#include <opaque_fragment>', emit)
  }
  return mat
}

/**
 * ── ★ THE WATER MATERIAL — one shared instance, the world's ONE transparent pass ───────────────
 * Water quads are split out of the section geometry (attrs.ts buildAttrsSplit) and drawn here,
 * after the opaque pass, so blending always lands on a finished scene. Tier-1 water (Alex,
 * 2026-08-07: "it looks like it's just a block"): the surface is RECESSED ~a tenth of a block so
 * it sits IN its channel instead of flush like pavement, it ripples (vertex sine, two phases so
 * it never reads as a marching pattern), and it is translucent so the bed shows through the
 * shallows. No simulation — nothing updates when blocks change; that is the tier-2 feature and
 * it is parked on GBOARD until mining near water matters.
 *
 * depthWrite OFF (standard for one transparent layer: depth TEST still hides water behind hills,
 * and water-over-water double-blend is invisible at our depths). depthTest stays ON. The tile
 * texture is sampled with a slowly SCROLLED uv, which is what makes still water read as moving
 * without a single geometry update.
 */
export interface WaterMaterial extends THREE.Material {
  /** Call once per frame with the clock — drives ripple and scroll. Safe before compile. */
  tick: (seconds: number) => void
  /** The flow dials from a running page (`window.__water`): speed in blocks/s at full riverness,
   *  and the travelling wave's height in blocks. Safe before compile. */
  setFlow: (speed: number, wave: number) => void
  getFlow: () => { speed: number; wave: number }
}

/**
 * ── ★ THE RIVER RUNS DOWNSTREAM (2026-09-18, Alex: "the way it flows") ─────────────────────────
 * Until this the sheet scrolled on ONE fixed heading everywhere — the two-sample drift below,
 * which reads as water shimmering but not as water GOING anywhere: every river in the world slid
 * toward the same compass point, ponds included. `aFlow` is the per-vertex flow the mesher reads
 * off `riverFlowAt` (channel tangent, signed by the table's fall, magnitude riverness), so the
 * scroll follows the channel round its bends and slows to the old drift at the banks and on still
 * water, where the vector is zero. Two speeds, not one: the second sample scrolls at 0.55× on a
 * slight offset, because one texture on one heading is a conveyor belt and two are a current.
 *
 * ★ THE NUMBER IS IN BLOCKS PER SECOND AND SMALL ON PURPOSE. The tile repeats every block, so a
 * scroll much faster than ~0.5 tiles/s strobes rather than flows. 0.32 at mid-channel; the banks
 * taper with riverness. A dial (`window.__water.flow(v)`) so Alex can call it from the bank.
 */
export const WATER_FLOW_SPEED = 0.32
/** Height of the travelling wave along the flow, in blocks — under the standing ripple's 0.05. */
export const WATER_FLOW_WAVE = 0.03
/** Seconds one flow-map phase scrolls before it resets — see the fragment note. Bounds the shear. */
export const WATER_FLOW_CYCLE = 3.0

/**
 * ── ★★ DEPTH ATTENUATION: WHERE THE NUMBERS COME FROM (2026-08-21) ────────────────────────────
 * Water shipped at ONE opacity everywhere, so a shin-deep ford and a drowned basin read the same
 * and the sheet looked like tinted glass laid over the ground rather than like a volume.
 *
 * ★ THE CURVE IS BEER-LAMBERT — `1 - exp(-k*d)` — because it is what absorption actually does and,
 * more usefully here, because it SATURATES: there is no depth at which it overshoots into opaque
 * and no dial that has to be clamped by hand. One constant sets the whole shape.
 *
 * ★★ AND `k` WAS CHOSEN FROM A SWEEP OF THE REAL WORLD, WHICH OVERTURNED THE OBVIOUS RAMP.
 * 141,331 water-surface cells over ~9600x9600 blocks: **depth 1 = 20.9%, depth 2 = 20.5%,
 * depth 3 = 49.9% — 91.3% of the world's water is three blocks or less**, median 3, p99 9, max 15.
 * The instinct is to spread the ramp over the 0..12 range the deep basins occupy. That would have
 * made **nine tenths of the world's water thinner than the flat 0.78 it replaced**, which is the
 * exact complaint (*"the water reads too clear"*) this was meant to answer — a fix that ships as a
 * regression everywhere except the 8.7% of water nobody is standing in.
 *
 * So `k` is pinned by the MEDIAN instead: at depth 3 the curve returns the old 0.78 to within a
 * percent, which means half the world's water looks exactly as it did and nothing regresses. What
 * changes is the two tails, which is the entire point — depth 1 shallows go to ~0.40 and draw a
 * real waterline, depth 8+ basins go past 0.98 and finally read as something you cannot see the
 * bottom of.
 *
 *   depth  1     2     3     4     6     8     12
 *   alpha  0.40  0.64  0.78  0.87  0.95  0.98  1.00
 *
 * ⚠ `aDepth < 0` IS "NO DEPTH DATA" AND MUST KEEP THE FLAT OPACITY. Zero is a real depth and maps
 * to invisible water; a section meshed without a water surface would otherwise have its rivers
 * deleted by the feature that was supposed to thicken them. The sentinel is set in `greedy.ts` and
 * preserved through `concatAttrs`; this branch is the third and last place it has to hold.
 */
const WATER_BASE_ALPHA = 0.78
/** Solves `1 - exp(-k*3) = 0.78` — the median depth keeps the opacity that shipped before this. */
const WATER_ABSORB = 0.505

// ── `window.__water` — the flow dials from a running page, the `__tex` shape ─────────────────
// `__water.flow(0.5)` sets the scroll speed at mid-channel (blocks/s), `__water.wave(0.06)` the
// travelling crest's height, `__water.get()` reads both. Alex judges the current from the bank
// without a rebuild per value. Fans out to every water material alive (the world's, and the
// devwin's second instance after an HMR).
const WATER_DIALS = new Set<WaterMaterial>()
function registerWaterDial(m: WaterMaterial): void {
  WATER_DIALS.add(m)
  if (typeof window === 'undefined') return
  const w = window as unknown as Record<string, unknown>
  if (w.__water) return
  const all = (f: (m: WaterMaterial) => void) => { for (const t of WATER_DIALS) f(t); return WATER_DIALS.size }
  w.__water = {
    flow: (v: number) => all(t => t.setFlow(v, t.getFlow().wave)),
    wave: (v: number) => all(t => t.setFlow(t.getFlow().speed, v)),
    get: () => [...WATER_DIALS].map(t => t.getFlow()),
  }
}

export function createWaterMaterial(tiles: { texture: THREE.DataArrayTexture } | null, waterLayer: number, light: LightUniforms = createLightUniforms()): WaterMaterial {
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: !tiles, transparent: true, opacity: WATER_BASE_ALPHA, depthWrite: false,
    // ── ★★ THE CEILING: WATER WAS UNDRAWN FROM BELOW (2026-08-21) ─────────────────────────────
    // The material never set `side`, so it inherited `FrontSide` — and a surface quad's front face
    // points UP. Underwater you were therefore looking at nothing at all: no ceiling, no boundary,
    // fog in every direction including up. There was no surface to swim toward, which is most of
    // why being under water read as being inside a tinted room rather than inside water.
    //
    // ⚠ DOUBLE-SIDED IS NOT A FREE SWITCH — it also un-culls the RIMS, and a rim's back face is the
    // inside of the water's own edge. Those would put translucent panels back inside every body of
    // water: the "walls of water" that took a day to remove the day before. So the sidedness is
    // widened at the MATERIAL and narrowed again in the FRAGMENT — only the sheet survives from
    // behind, every other water face keeps exactly the front-only behaviour it has today.
    side: THREE.DoubleSide,
  }) as unknown as WaterMaterial
  let live: { uTime: { value: number }; uFlowSpeed: { value: number }; uFlowWave: { value: number } } | null = null
  let now = 0
  let flowSpeed = WATER_FLOW_SPEED, flowWave = WATER_FLOW_WAVE
  mat.tick = (s: number) => { now = s; if (live) live.uTime.value = s }
  mat.setFlow = (speed: number, wave: number) => {
    flowSpeed = speed; flowWave = wave
    if (live) { live.uFlowSpeed.value = speed; live.uFlowWave.value = wave }
  }
  mat.getFlow = () => ({ speed: flowSpeed, wave: flowWave })
  registerWaterDial(mat)

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: now }
    shader.uniforms.uFlowSpeed = { value: flowSpeed }
    shader.uniforms.uFlowWave = { value: flowWave }
    if (tiles) shader.uniforms.uTiles = { value: tiles.texture }
    Object.assign(shader.uniforms, light)
    live = shader.uniforms as { uTime: { value: number }; uFlowSpeed: { value: number }; uFlowWave: { value: number } }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nuniform float uTime;\nvarying vec3 vVoxPos;\nvarying vec3 vVoxNormal;\n'
        // ⚠ DECLARED WITH A DEFAULT, because the attribute is absent on any geometry that predates
        // it and an undeclared attribute is a link error, not a zero. `-1` is the no-data sentinel,
        // so a geometry without the buffer lands on the flat-opacity branch rather than vanishing.
        + 'attribute float aDepth;\nvarying float vDepth;\nvarying vec3 vWaterWPos;\n'
        // Same default story as aDepth: absent on a geometry meshed without a flow field, and an
        // absent attribute reads as zero — still water, the old look — not as a link error.
        + 'attribute vec2 aFlow;\nvarying vec2 vFlow;\nuniform float uFlowWave;')
      .replace('#include <begin_vertex>',
        `#include <begin_vertex>
vVoxPos = position;
vVoxNormal = normal;
vDepth = aDepth;
vFlow = aFlow;
// ⚠ TAKEN BEFORE THE RIPPLE AND THE RECESS BELOW MOVE IT. The light field is indexed by CELL, and
// the surface is displaced by up to 0.15 of a block — enough to fall into the cell above or below
// at a boundary and make a sheet of water flicker between two light levels as it waves.
vWaterWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
if (normal.y > 0.5) {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  // Recess + ripple, top faces only. Two phases at unrelated wavelengths so the surface never
  // reads as a marching grid; amplitude is small because the tide is a read, not a mechanic.
  transformed.y -= 0.1;
  transformed.y += sin(wp.x * 0.9 + uTime * 1.4) * cos(wp.z * 0.7 + uTime * 1.1) * 0.05;
  // The current: a wave TRAVELLING downstream, on top of the standing ripple. Its phase runs
  // along the flow direction so crests cross the channel and march with it; amplitude scales
  // with riverness, so it is gone at the bank and on still water.
  float fl = length(aFlow);
  if (fl > 0.001) {
    vec2 dir = aFlow / fl;
    transformed.y += sin(dot(wp.xz, dir) * 2.2 - uTime * 2.6) * uFlowWave * fl;
  }
}`)

    // ⚠ THE DEPTH RAMP IS DECLARED AND APPLIED WHETHER OR NOT THE ATLAS IS PRESENT. The tile
    // sampling below is optional (there is a no-texture path); attenuation is not, and hanging it
    // off the `if (tiles)` branch would have made the feature silently absent in exactly the
    // configuration that is hardest to notice — the fallback one.
    shader.fragmentShader = shader.fragmentShader
      // ⚠ `vVoxNormal` IS DECLARED UNCONDITIONALLY NOW. It used to ride in on the tiles branch, but
      // the back-face discard below reads it on every path — leaving it inside the `tiles ?` would
      // compile fine WITH an atlas and fail to link without one, which is the configuration nobody
      // looks at.
      .replace('#include <common>',
        '#include <common>\nvarying float vDepth;\nvarying vec3 vVoxNormal;\nvarying vec3 vWaterWPos;\n'
        + (tiles ? 'uniform sampler2DArray uTiles;\nuniform float uTime;\nvarying vec3 vVoxPos;\n' : '')
        + 'varying vec2 vFlow;\nuniform float uFlowSpeed;\n'
        + LIGHT_DECL_GLSL)
      .replace('#include <color_fragment>',
        `#include <color_fragment>
// ⚠ NARROWING THE MATERIAL'S DoubleSide BACK DOWN — see the 'side' flag above. Only the sheet is meant to be
// seen from behind. Cheaper than a second mesh, and it cannot drift out of step with the material
// because it lives in the same function as the flag it corrects.
if (!gl_FrontFacing && vVoxNormal.y < 0.5) discard;
${tiles ? `{
  vec3 an = abs(vVoxNormal);
  vec2 tileUv = an.y > 0.5
    ? vVoxPos.xz
    : (an.x > 0.5 ? vec2(vVoxPos.z, -vVoxPos.y) : vec2(vVoxPos.x, -vVoxPos.y));
  // The scroll IS the flow. Two samples drifting on unrelated headings, blended — one scrolling
  // texture reads as a conveyor belt; two read as water. The river's own vector is ADDED to both:
  // the still-water drift stays as the shimmer, the current is the going. Only the sheet carries
  // a flow (rims are zero), and the tile UV on the sheet is xz, so the vector maps straight on.
  // The second sample at 0.55× on a slight skew — same heading, different speed, so the two
  // layers slide over each other the way a surface slides over the water under it.
  // ⚠⚠ NOT \`vFlow * uTime\`. The flow is INTERPOLATED across a quad and differs between its corners
  // (the bank taper, a bend), so an offset that grows with time shears the texture by a larger
  // amount every second — measured top-down at flow 0.5 after ~40s: the water was long diagonal
  // streaks, not water. The flow-map answer (Valve, 2010): two phases half a cycle apart, each
  // scrolling for one FLOW_CYCLE then snapping back, cross-faded so a phase is invisible at the
  // instant it resets. The shear is then bounded by one cycle's travel, which is under a block.
  float ph0 = fract(uTime / ${WATER_FLOW_CYCLE.toFixed(1)});
  float ph1 = fract(ph0 + 0.5);
  float blend = abs(ph0 * 2.0 - 1.0);            // 1 when phase 0 resets, 0 when phase 1 does
  vec2 step0 = vFlow * (uFlowSpeed * ${WATER_FLOW_CYCLE.toFixed(1)}) * ph0;
  vec2 step1 = vFlow * (uFlowSpeed * ${WATER_FLOW_CYCLE.toFixed(1)}) * (ph1 - 0.5);
  vec2 drift = vec2(uTime * 0.021, uTime * 0.013);
  vec2 driftB = vec2(-uTime * 0.017, uTime * 0.024);
  vec4 a = mix(
    texture(uTiles, vec3(tileUv + drift + step0, ${waterLayer.toFixed(1)})),
    texture(uTiles, vec3(tileUv + drift + step1, ${waterLayer.toFixed(1)})), blend);
  vec4 b = mix(
    texture(uTiles, vec3(tileUv * 1.31 + driftB + step0 * 0.55, ${waterLayer.toFixed(1)})),
    texture(uTiles, vec3(tileUv * 1.31 + driftB + step1 * 0.55, ${waterLayer.toFixed(1)})), blend);
  diffuseColor.rgb *= mix(a.rgb, b.rgb, 0.5) * 1.25;
}` : ''}
{
  // Beer-Lambert. See WATER_ABSORB for why the constant is pinned to the median depth and not to
  // the deepest water in the world. A negative depth is the no-data sentinel and keeps the flat
  // opacity the material was built with, so a section meshed without a water surface renders the
  // way it did before this existed rather than turning to glass.
  // ── ★★ FROM BELOW, THE SURFACE IS A WINDOW AND NOT A VOLUME ────────────────────────────
  // vDepth measures the water column BENEATH the sheet, and that column sits between viewer and
  // sheet only when the viewer is ABOVE it. Swim under and you are already inside it, so
  // attenuating by it again counts the same water twice: a 10-deep basin's ceiling would land at
  // 0.99 and read as a painted lid with no sky behind it — a worse hole than the one being fixed.
  // From underneath the sheet keeps its base translucency, and the distance to it is carried by
  // fog, which is already the thing that handles distance.
  if (!gl_FrontFacing) {
    diffuseColor.a = ${WATER_BASE_ALPHA.toFixed(2)};
  } else if (vDepth >= 0.0) {
    float att = 1.0 - exp(-${WATER_ABSORB.toFixed(3)} * vDepth);
    diffuseColor.a = clamp(att, 0.0, 1.0);
    // ★ THE COLOUR HAS TO TRAVEL WITH THE ALPHA OR THE DEEP END READS AS A FLAT BLUE DECAL. Opacity
    // alone makes deep water MORE of the same tint, which at 0.98 is a solid poster-paint slab.
    // Real depth also eats light, so the same term darkens it — gently, and floored well short of
    // black so a basin still reads as water rather than as a hole in the terrain.
    diffuseColor.rgb *= mix(1.0, 0.72, clamp(att, 0.0, 1.0));
  }
}`)

    // ── ★★ WATER SAMPLES THE FIELD, AND IT USES THE **FACE** FORM ─────────────────────────────
    // Water quads are cube faces, not cross-quads, so the cell that matters is the one IN FRONT of
    // the face — for the sheet that is the air above it, which is exactly where its light comes
    // from, and from underneath it is the same cell, i.e. the sky you are looking up at through it.
    // ⚠ Left out of the first render-light pass because water is its own program: a flooded cave
    // rendered at noon while the rock around it was black.
    const wet = `
      vec3 waterCol = outgoingLight;
      ${lightApply('waterCol', 'diffuseColor.rgb', 'vWaterWPos', 'normalize(vVoxNormal)')}
      gl_FragColor = vec4(waterCol, diffuseColor.a);
    `
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <output_fragment>', wet)
      .replace('#include <opaque_fragment>', wet)
  }
  return mat
}

/** Push settings into the shared material. A value write — no recompile, no new program. */
export function applySettings(mat: VoxelMaterial, s: VoxelSettings): void {
  if (!mat.uniforms) return
  mat.uniforms.uCartoon.value = s.style === 'cartoon' ? 1 : 0
  mat.uniforms.uToon.value = s.toon
  mat.uniforms.uOutline.value = s.outline
  mat.uniforms.uFaceShading.value = s.faceShading
  mat.uniforms.uShadowLift.value = s.shadowLift
}
