# Toon-craft — warm stylized shading for Shimmer voxel3d

## 1. Ranked techniques

### #1 — Replace the flat-tint shadow lift with a 2-3 band ramp + hue-shifted cool tone
**What:** BotW/Genshin-family toon shading is not "darken toward one grey-blue." Compute `NdotL` (here: the light-field irradiance/albedo ratio already derived as `clum`), threshold into 2-3 bands with `smoothstep(0, 0.01, x)` (sharp edge, not a lerp), then colour each band independently — lit band keeps warm tint, shadow band shifts hue toward blue-purple AND drops value, never just blends toward one fixed RGB. Genshin's face/body shaders store a **per-material shadow-ramp texture** (a small 1D/2D LUT baked per character) so the art director picks the shadow hue instead of a shader constant.
**Shape for us:** you already have `clum` and `stepped`. Instead of `lift = shade*(1-shaped)*luminance` with one fixed `shade` colour, sample a 1D ramp:
```glsl
uniform sampler2D uShadowRamp; // 4x1, x = clum, y=0.5; rows optionally per biome later
vec3 rampCol = texture(uShadowRamp, vec2(clum, 0.5)).rgb;
vec3 toonCol = diffuseColor.rgb * rampCol * face;
```
A 4x1 or 8x1 `RGBA8` texture is 32 bytes, one extra sampler — cheaper than the inline branch-math and gives a paintable ramp (edit pixels, not GLSL) for "cool shadow, not black" and "no moon = silver, not dim."
**Cost:** +1 sampler2D uniform, +1 texture fetch/frag. Negligible on UHD 630; the atlas lookup already dominates.
**Trap:** don't add a 3rd geometric band via more `smoothstep` calls in-shader — encode bands *in the ramp texture* so band-count is a content edit, not a recompile.
Source: shadow-ramp-per-material pattern documented in the NiloCat-lineage Genshin shader ports — https://github.com/NoiRC256/URPSimpleGenshinShaders (see `SimpleGenshinFacial.shader`, face shadow texture stores coverage by angle) and https://github.com/ColinLeung-NiloCat/UnityURPToonLitShaderExample.

### #2 — Keep the current world-position outline; do NOT switch to inverted-hull or post-depth
**What:** the world-position block-edge outline (what `cartoonStackGlsl` already does) is right for a voxel game because voxel silhouettes are axis-aligned — inverted-hull (duplicate mesh, flip normals, push along normal, draw backfaces first) is built for *organic* silhouettes and produces overlap artifacts on concave geometry, which every voxel corner is. Depth/normal post outlines (Ronja's method) need a normal buffer + depth pass + fullscreen sample — a second render target, real cost on integrated GPU, for an edge shape voxels don't need help defining.
**Cost of what we have:** ~0, it's already fragment-local math on `wpos`.
**Trap:** most voxel/lowpoly stylized games (Rosebud's voxel-style survey, A Short Hike) skip outlines entirely and let flat-color faces + AO define shape — subtle is correct; don't crank `uOutline` line-darken past current 0.62 mix or every grid seam becomes a black wireframe.
Sources: https://github.com/Delt06/toon-rp/wiki/Inverted-Hull-Outline , https://www.ronja-tutorials.com/post/019-postprocessing-outlines/ , https://www.ronja-tutorials.com/post/020-hull-outline/

### #3 — Rim/fresnel light gated by NdotL sign (the BotW trick), not raw fresnel
**What:** BotW-style rim only lights the side of the silhouette also lit by the main directional light — `rim = pow(1 - dot(V,N), power) * NdotL`. Raw fresnel (no `NdotL` gate) rims backlit edges too and looks like a cheap halo. Cheapest "read Ghibli, not flat" addition we don't have yet.
**Shape:**
```glsl
float ndv = max(dot(cnrm, normalize(cameraPosition - wpos)), 0.0);
float rim = pow(1.0 - ndv, 3.0) * step(0.05, faceLum_from_light_not_face);
toonCol += uRimColor.rgb * rim * uRimStrength;
```
Wire `faceLum_from_light` off the light-field's sky/sun term (already computed for `lightApply`), not the fixed per-face law, so rim tracks the actual sun direction/hour, not just "top face."
**Cost:** 1 `normalize`, 1 `dot`, 1 `pow` per fragment — trivial next to the atlas sample already happening.
**Trap:** rim on EVERY block edge at full strength turns voxel grids into a glowing wireframe at distance (Moiré at LOD). Clamp rim to faces only (skip on `bottom`), and scale down with distance-to-camera fog factor if one exists.
Source: https://roystan.net/articles/toon-shader/ (rim formula `pow(rimDot*NdotL, rimThreshold)`), https://www.vertexfragment.com/ramblings/botw-specular-in-unity-urp/ (confirms BotW gates specular/rim by `smoothstep(0,0.01,NdotL)` shadow term, single sharp threshold not a soft gradient).

### #4 — Time-of-day ramp = both light color AND shadow-ramp swap, driven by hour
**What:** the common mistake is grading only the *lit* side by hour while shadows stay one grey. Spider-Man 2's day-grade approach (desaturate + darken at night, not just hue-shift) generalizes: drive **two** ramps off hour-of-day — a light-tint curve (dawn amber → noon white → dusk orange-red → night silver-blue, matching "Core cooled, silver, no moon" canon) and a **separate** shadow-ramp LUT swap (dawn=violet-grey, noon=blue-cyan, dusk=deep violet-red, night=cold near-black-silver, never pure black per the `uShadowLift` floor).
**Shape:** since the light field already packs into one 3D texture with sun/hemisphere driven from `day-night.tsx`, add a small 2nd texture — `uTodRamp` (24x2 px: row0=light tint, row1=shadow tint, col=hour) — sampled once per frame on CPU into two `vec3` uniforms, fed into the #1 ramp as a multiply.
**Cost:** near-zero — this is a CPU-side lerp once per frame(ish), two extra `vec3` uniforms.
**Trap:** don't tie shadow hue to light hue with a fixed offset; at night the light tint goes near-black but the shadow ramp still needs a floor brightness (the `uShadowLift` clamp) or caves and shadow converge to identical black and depth cues vanish.
Source (general principle, not engine-specific): color-grading writeups on warm-highlight/cool-shadow hue rotation — https://tafari123.itch.io/a1-skills-development-tafari/devlog/848925/colour-grading-in-games ; Spider-Man 2 day/night saturation-drop behavior cited in general game color-grading surveys (https://www.gamedeveloper.com/design/color-in-video-games-how-to-choose-a-palette).

### #5 — "Greying" as a spatial desaturation falloff, not a global filter
**What:** Bloodborne/Sekiro/Ori-style corruption-zone desaturation is a **distance-from-source** or **per-voxel-tag** lerp toward `luminance(color)` (grayscale), not a screen-space post filter — it has to respect world position (a frayed garden edge, a Crucible floor) and coexist with the light field. Formula: `finalCol = mix(toonCol, vec3(dot(toonCol, W)), greyAmount)`, `greyAmount` from a per-block tag or `smoothstep` distance falloff from a canon-authored center — same pattern already used for `W` luminance in the shadow-lift math.
**Shape:** add one more uniform/varying `float uGrey` (0 tended-color, 1 fully grey) written per-chunk or per-instance from world data (frayed-edge distance), applied as the *last* step before `lightApply` so lanterns/light-field still modulate a grey block correctly.
**Cost:** 1 `dot`, 1 `mix` — free.
**Trap:** don't desaturate in a post-process full-screen pass (no EffectComposer today, and adding one just for this is a new render target + cost on UHD 630 for a purely local, taggable effect). Keep it per-fragment and data-driven, matching how "greying is desaturation at the frayed edges" is already stated as canon.

### #6 — Stylized water: flat 2-tone colour + threshold foam, no reflection pass
**What:** the toon-water consensus (Half Past Yellow, Godot/Unity toon-water shaders): (a) two flat colours (shallow/deep) blended by depth or noise mask, never a real reflection/refraction pass; (b) scrolling noise-driven `smoothstep` cutoff for foam at shorelines/wave crests (`foam = step(threshold, noise(uv + time))`); (c) one fake specular sparkle via a stretched noise sample, not real specular math. All flat-cost.
**Cost:** 1-2 extra texture samples in the water fragment shader only (water is a small fraction of screen area typically). Zero extra draw calls if it's the same cutout/alpha pass style you already run for glass.
**Trap:** do NOT add real-time planar reflections or refraction (scene-color grab) for water — that's a second camera render or a copy-of-backbuffer pass, real bandwidth on integrated GPU, and reads photoreal-wrong against the flat cartoon stack anyway.
Sources: https://halfpastyellow.com/blog/2020/10/01/Yet-Another-Stylised-Water-Shader.html , https://godotshaders.com/shader/toon-water-shader/ , https://gameidea.org/2026/02/01/creating-a-stylized-3d-water-shader/

### #7 — Glass: keep tinted-cutout + one streak highlight; skip refraction/caustics
**What:** stylized glass in toon renderers is (a) diffuse cutout tinted by glass colour (what you have), (b) ONE static or slow-scrolling diagonal highlight streak masked by a `fract(uv.x+uv.y)` band, no real refraction. For "lit room seen through stained glass at night" (open thread #1): the missing piece isn't the glass shader, it's projecting the **light-field's block-light colour** through the pane onto the wall/ground behind — treat the pane as a coloured light filter casting a small local splash (a cheap additive decal quad tinted by pane colour, faded by distance), not a raytraced caustic.
**Cost:** 1 extra small additive quad per lit stained-glass pane at night, only near camera — trivially cheap, reuses existing instanced-piece pipeline.
**Trap:** don't try real light-through-glass (shadow-map projection, caustic textures) — no shadow maps exist in this renderer at all; faking the splash as a tinted decal is 100% consistent with "the light field does the work," not a new lighting system.

## Do NOT do
- No EffectComposer/post-processing for outlines, desaturation, or bloom — #2/#5/#6/#7 each have a per-fragment, no-new-render-target version fitting the existing `onBeforeCompile`/Lambert architecture; a post pass costs a new render target on a GPU that already stalls on shader compile/texture upload.
- No inverted-hull outlines — voxel concave corners self-overlap; the current world-position edge method is architecturally correct for this geometry, not a placeholder.
- No real refraction/reflection/caustics for water or glass (scene-color capture, planar reflection camera) — bandwidth cost on the UHD 630 for a look that fights flat-color canon anyway.
- No per-frame shader recompile for time-of-day shadow color — a uniform/texture swap only (ramp LUT + two vec3s), per "a style change is a value write, never a second program."
- No global-screen desaturation for "greying" — must be spatial/data-driven (per-block tag or world-distance) to coexist with tended-vs-frayed canon and the light field.
