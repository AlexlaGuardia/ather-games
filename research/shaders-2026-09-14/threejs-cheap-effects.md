# three.js cheap effects — UHD 630, no post pass today

## 1. In-fragment height/aerial fog (payoff/cost: best)
What: distance + height fog computed in the injected fragment tail, coloured from the sky
gradient (not a flat fog colour), dithered so the near-far falloff doesn't band on the honey-gold
palette. Fits the existing sky dome (`sky` ShaderMaterial, zenith/horizon/sun gradient) and the
light field's sky-darkens-only law — fog should sample the SAME horizon colour the sky dome draws,
or the world seams at the horizon.
Shape (append inside `cartoonStackGlsl`'s return, before the final `gl_FragColor` line, using
`vWPos`/camera-relative depth already varying in `mesh-bridge.ts`):
```glsl
float dist = length(cameraPosition - wpos);
float heightFog = exp(-max(wpos.y - uFogBase, 0.0) * uFogHeightFalloff);
float fogAmt = 1.0 - exp(-dist * uFogDensity * heightFog);
vec3 fogCol = mix(uHorizonColor, uZenithColor, clamp(cnrm.y * 0.5 + 0.5, 0.0, 1.0));
finalCol = mix(finalCol, fogCol, clamp(fogAmt, 0.0, 1.0));
```
`uHorizonColor`/`uZenithColor` uniforms should be the SAME values fed to the sky material each
frame (one small object, not a duplicated palette). Cost: 1 `exp`, 1 `mix`, 3-4 uniforms, zero
extra draw calls or render targets — cheapest thing on this list. Trap: three's own
`<fog_fragment>` chunk still runs AFTER `opaque_fragment` in `ShaderLib/meshlambert.glsl.js`
(verified: `opaque_fragment → tonemapping_fragment → colorspace_fragment → fog_fragment →
premultiplied_alpha_fragment → dithering_fragment`), so if `scene.fog` is ALSO set, THREE's linear
fog composites a second time on top of yours — pick one, don't stack both.

## 2. Reuse `DITHERING` for grading/glass banding (near-free)
What: three's built-in `dithering_fragment`/`dithering_pars_fragment` chunks are NOT removed by
replacing `opaque_fragment` — they're separate `#include` lines further down the same template, so
`material.dithering = true` still fires after our custom `gl_FragColor` write. Confirmed via
`ShaderChunk/dithering_pars_fragment.glsl.js`: `rand(gl_FragCoord.xy)` gradient noise, ±0.25/255
per channel, credited to a Belgian pixel-artist Shadertoy trick.
Shape: just set `mat.dithering = true` on the voxel/piece/glass materials — no GLSL of our own
needed. For the glass cutout pass specifically (alpha-as-coverage, no sort), the SAME
`gl_FragCoord.xy`-seeded noise can be reused to jitter the discard threshold in `alphaTest`-style
code, turning banding-prone coverage into a stipple instead of hard rings.
Cost: 1 extra `rand()` + add, already paid for by the renderer when the define is on. Trap: the
dither amplitude is fixed at ±0.25/255 — it kills 8-bit banding but does nothing for the coarser
banding a 3-step toon `floor()` already introduces on its own (that's `uToon`'s job, not dithering's).

## 3. Emissive-only "glow" for lanterns/stained glass, no post pass
What: what you already have (`vEmissive`/`aEmissive` added straight into `finalCol` in
`cartoon-glsl.ts`) IS the cheap 90%-of-bloom's-visual-job trick — a saturated, over-1.0 additive
colour reads as glowing under tonemapping (`tonemapping_fragment` runs right after your
`opaque_fragment` replacement, so values >1 get rolled off, not clipped hard, if
`renderer.toneMapping !== NoToneMapping`). For "a lit room through stained glass at night" this is
the first lever, not real bloom: bump the glass's emissive value and the ACES/Reinhard tonemapper's
knee gives you a soft glow for free.
Cost: zero — already wired. Trap: `NoToneMapping` (current default in most three.js starter setups)
clips instead of rolling off, so confirm `renderer.toneMapping = THREE.ACESFilmicToneMapping` (or
similar) is actually set — the "glow" in this trick lives entirely in the tonemapper's shoulder.

## 4. Real bloom, only if #3 isn't enough: hand-rolled single half-res RT
What: skip EffectComposer AND pmndrs/postprocessing for a one-effect need. Render the
emissive-only contribution (glass panes + lanterns, reuse `vEmissive`/albedo — not a full second
scene render) into ONE half-res `THREE.WebGLRenderTarget`, blur with 2 passes (horizontal+
vertical, 3-tap each), additive-composite with a fullscreen triangle. ~4 extra draw calls at
half-to-quarter res, vs. `UnrealBloomPass`'s verified cost: `nMips = 5`, 10 separable blur
draws/frame (`kernelSizeArray = [6,10,14,18,22]`, 5 mip targets each halved again) — meaningfully
heavier, and 22-tap kernels are a bad trade on UHD 630 for a flat-cartoon look that doesn't need
Unreal-grade rolloff. pmndrs `BloomEffect`'s `mipmapBlur` (default on, `levels: 8`) is cheaper
per-pass but still an 8-level mip chain built for photoreal HDR; pulling in the whole
`postprocessing` package + its own RT manager for one selective effect is integration cost the
onBeforeCompile/Lambert stack doesn't need.
Cost: ~4 draw calls, 1 half-res target. Trap: needs a mask (layers or a second emissive-only
render) or bloom-everything-bright blows out honey-gold walls, not just lanterns/glass.

## 5. In-shader lift-gamma-gain instead of a 3D LUT
What: a 3-point grade (`uLift`, `uGamma`, `uGain`, each `vec3`) as three cheap uniforms beats a
`Data3DTexture` LUT here — no extra texture sample, and it's editable live from a dev panel exactly
like the four cartoon dials already are.
Shape: `col = pow(col, 1.0/uGamma) * uGain + uLift * (1.0 - col);` inserted right before the final
`gl_FragColor` line, same place as item 1's fog.
Cost: ~3 `pow`/`mix` ops, 3 uniforms, 0 texture fetches vs. a LUT's 1 (or 8, trilinear) read/
fragment. Trap: do this INSTEAD OF `renderer.toneMapping`, not alongside — ACES/Reinhard already
remaps highlights; grading on top double-compresses honey-gold mids into mud. One colour authority,
same rule as item 1's "pick one fog."

## 6. `compileAsync` + `KHR_parallel_shader_compile` + define-keyed programs
What: the actual, verified fix for first-frame stall on UHD 630, not a rendering trick. Confirmed
from `WebGLRenderer.js` source: `compileAsync(scene, camera)` calls `this.compile(...)`, then polls
`materialProperties.currentProgram.isReady()` every 10ms via `setTimeout`; if
`extensions.get('KHR_parallel_shader_compile') !== null` it polls immediately (compile already
handed to the driver off-thread), else it just waits a beat first — either way it returns a
Promise: build the scene, `await renderer.compileAsync(scene, camera)`, THEN show the canvas.
Cost: no extra draw calls, but every DISTINCT `#define` combination is a distinct WebGL program —
`uCartoon`/`uToon`/etc. are runtime uniforms specifically so voxel/piece/glass share ONE compiled
program each rather than one per dial setting; keep new features (fog, grading) as uniforms too,
not `#ifdef`s, or `compileAsync` has to compile a program per permutation actually used.
Trap: `compileAsync` only pre-warms programs for materials attached to the scene graph you pass it
— a chunk streamed in later (new piece type, new glass colour) still stalls on first appearance
unless you also warm a template instance of each material variant up front.

## 7. Data3DTexture (light field) sampling
What: the 144×256×144 byte `Data3DTexture` is sampled once per fragment today via `light-glsl.ts`.
On UHD 630 (Gen9.5, no dedicated texture cache tier tuned for 3D textures) `NEAREST` vs `LINEAR`
matters more than on discrete GPUs — trilinear on a `Data3DTexture` is a genuine 8-texel fetch.
Shape: keep `texture.minFilter = texture.magFilter = THREE.NearestFilter` (already implied by the
per-voxel-cell design — light is a stepped field, not a smooth one, so `NEAREST` is also the
CORRECT look, not just the cheap one). Moving the sample to the VERTEX stage is a sane trade only
where the mesh is dense relative to the light grid (chunk meshes ARE, one vertex per voxel corner);
sample in the vertex shader, pass the result as a `varying vec3 vLight`, and the fragment shader
skips the 3D fetch entirely — trades a per-fragment 3D-texture read for a per-vertex one, a clear
win at voxel-mesh vertex density.
Cost today: 1 `texture()` call/fragment, `NEAREST` = 1 texel. Trap: moving to vertex-stage breaks
if the fragment ever needs the field at a DIFFERENT world position than the vertex it's shaded
from (e.g. a large instanced piece spanning many light cells) — keep pieces on fragment-stage
sampling, only move chunk-mesh terrain.

## Sources
- three.js `ShaderLib/meshlambert.glsl.js`, `ShaderChunk/{opaque,colorspace,dithering,dithering_pars}_fragment.glsl.js` — https://github.com/mrdoob/three.js/tree/dev/src/renderers/shaders
- `WebGLRenderer.js` `compileAsync` source — https://github.com/mrdoob/three.js/blob/dev/src/renderers/WebGLRenderer.js
- `KHR_parallel_shader_compile` extension — https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile ; three.js issue #16321 — https://github.com/mrdoob/three.js/issues/16321
- `UnrealBloomPass.js` source (nMips=5, kernelSizeArray) — https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/UnrealBloomPass.js ; docs — https://threejs.org/docs/pages/UnrealBloomPass.html
- pmndrs `postprocessing` `BloomEffect`/`MipmapBlurPass` docs — https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/BloomEffect.js~BloomEffect.html
- Selective bloom via layers — https://waelyasmina.net/articles/unreal-bloom-selective-threejs-post-processing/
- Arm GPU Best Practices (texture sampling cost, filtering) — https://developer.arm.com/documentation/101897/v2-2/Buffers-and-textures/Texture-sampling-performance
- In-repo: `src/app/shimmer/voxel3d/{cartoon-glsl.ts,light-glsl.ts,mesh-bridge.ts,mist-pass.ts}` (verified injection points and chunk order directly).

## Do NOT do
- Don't add `EffectComposer` or `pmndrs/postprocessing` as a dependency for bloom alone — both assume
  a render-target/pass economy this stack doesn't have yet (no post pass = no shared depth/normal
  buffers to reuse), and `UnrealBloomPass`'s 10 blur draws + 5 mip targets is real cost on UHD 630
  for a flat-cartoon look that mostly wants glow, not HDR rolloff.
- Don't set both `scene.fog` AND a custom in-fragment fog — they composite twice, verified from the
  chunk order (`opaque_fragment → ... → fog_fragment`).
- Don't run `renderer.toneMapping` (ACES/Reinhard) AND an in-shader lift-gamma-gain grade as if they
  were independent — pick one final colour authority.
- Don't switch the light-field `Data3DTexture` to `LinearFilter` "for smoothness" — it's an 8-texel
  trilinear fetch on a GPU with no 3D-texture-tuned cache tier, AND it's the wrong look (the field is
  meant to step per cell, per the sky-darkens-only / lantern-adds law).
- Don't key shader variants on `#ifdef` for things that are really per-instance values (fog density,
  grade, cartoon dials) — every `#define` combo is a separate compiled program, which directly fights
  `compileAsync`'s ability to pre-warm the actual set of programs the scene will use.
- Don't use a `Data3DTexture` LUT for colour grading here — lift-gamma-gain uniforms give the same
  editable-live workflow the cartoon dials already use, with zero extra texture bandwidth.
