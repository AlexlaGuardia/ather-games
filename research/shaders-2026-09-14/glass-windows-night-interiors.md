# Glass windows / night interiors

## Ranked techniques

### 1. Emissive pane keyed to block-light-behind (the core trick)
What: window glows from the room's lantern light, not a fixed color — sample the light field at the cell *behind* the pane, drive emissive from that block channel. This is the Animal Crossing/Stardew/Zelda-town trick: no room-light raytrace, just "is the interior lit" state driving the window. Minecraft shaderpacks (Complementary, BSL) do the equivalent from baked lightmap UVs.
Shape: pane is already instanced — cell coords come free from instanceMatrix. In `onBeforeCompile` for the glass program, add one field-sample:
```glsl
// vWorldPos already exists for the light-field lookup
vec3 cellBehind = vWorldPos - vGlassNormal * 0.5; // step one cell inward, toward interior
vec4 fieldBehind = texture(uLightField, worldToFieldUV(cellBehind));
float blockGlow = fieldBehind.g; // block channel
vec3 warmTint = mix(vec3(1.0), uLanternTint, 0.6);
diffuseColor.rgb += glassColor.rgb * blockGlow * warmTint * uNightMix;
```
`uNightMix` = 1 - sky brightness this hour, so it only appears once the sun channel drops.
Cost: one extra 3D-texture fetch per glass fragment (same texture you already sample), zero new draw calls, one uniform (`uLanternTint`, already exists). Cheapest correct fix on the list.
Trap: don't sample the pane's *own* cell — panes are usually air, so you'd read darkness. Step one voxel inward along the face normal, or windows only glow when standing on the light source.

### 2. Coloured flood via the light field's own block-tint (stained tint, not a decal)
What: stained glass recolors the *light field itself* locally. When block light diffuses through a stained cell, multiply the outgoing tint by the glass color for that step, so nearby floor cells inherit a colored block-channel instead of the flat lantern warm tint — reuses the "block channel ADDS warm tint" rule, stained glass just swaps the added color near that pane.
Shape: in the CPU light-propagation pass (`voxel/light.ts`), when the flood crosses a stained cell, multiply the outgoing block-light color by the pane's `glassTint` before writing the neighbor cell. Data-side change, not a shader change — free at render time, baked into the texture already sampled every frame.
Cost: zero runtime GPU cost (paid once at bake time). No new uniforms, no new draw calls.
Trap: the field is one packed byte/channel today — full per-voxel RGB costs 3 more bytes/voxel (~4.7MB, trivial) but only where needed. Scope the tint write to a short falloff radius from the pane; don't carry RGB through the whole torus.

### 3. Projected coloured floor patch (the "stained light puddle")
What: Minecraft Complementary/BSL "colored shadows" tint a floor patch under stained glass by sampling glass albedo in the shadow pass. No shadow map here, so fake directly: a decal quad on the floor, positioned by projecting the pane's world position along current sun direction, sized to the pane, colored by glass tint, gated by `sunElevation > threshold`.
Shape: one low-poly quad per stained window (instanced with the panes), MeshBasicMaterial, alphaMap = lattice silhouette so it reads as leaded light not a flat rectangle, position updated as `pane.position + sunDir * projectDistance` (recompute every few frames — sun moves slowly).
Cost: 1 draw call for all active windows batched into one InstancedMesh, trivial fill. Fine on UHD 630.
Trap: don't raycast per-frame for floor Y — precompute the projection plane per room at pane-placement time, or CPU cost scales with window count.

### 4. Light leak halo around window/door frames at night
What: a soft additive quad hugging the window/door frame, keyed the same as #1, sells "light spilling around the frame" without a bloom pass.
Shape: additive-blended quad slightly larger than the opening, alphaMap = radial falloff, `blockGlow`-driven, `depthWrite: false`, drawn after the cutout pass.
Cost: 1 draw call per lit opening (instanced together), tiny fill, one shared texture.
Trap: additive over-brightens fast when doors cluster (village at night) — no post pass to tone-map it back, so cap per-instance opacity low (≤0.25) and let density carry the look, not brightness.

### 5. Cheap volumetric shaft through a window (few additive planes)
What: 2-4 flat additive planes fanned from the window opening into the room, textured with a dust-beam gradient — NOT a raymarch. Standard "fake volumetric" in stylized/indie 3D (the point-light equivalent uses an open ConeGeometry + `AdditiveBlending` + `depthWrite:false` + density/decay uniforms — see threejsdemos.com/demos/lighting/godrays). For a rectangular window, use flat planes instead of a cone.
Shape:
```js
const beamMat = new THREE.MeshBasicMaterial({
  map: beamGradientTex, color: uLanternTint, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
```
3-4 planes rotated ±8-15° around the beam axis (avoids a flat-cutout read from any angle); opacity driven by `blockGlow`; only spawned in rooms flagged "has sunbeam window."
Cost: 3-4 transparent draw calls per beam instance, small fill, one shared gradient texture. Affordable at a handful of hero windows; NOT every window in a village — reserve for named interiors (temple, tower, Moonwell Glade).
Trap: a real raymarched volumetric is a non-starter — no shadow map exists and integrated-GPU per-pixel loops stall. The plane-fan reads correctly at this art scale for ~1% of the cost.

### 6. Leaded lattice + highlight streak on glass itself (mostly done, tune don't rebuild)
What: the existing cutout pass with lattice lines and tint is already the right shape. Worth adding: one highlight streak (thin diagonal gradient, modulated by view angle) to sell "glass" — costs nothing extra, baked into the same atlas tile.
Shape: bake the streak into the 6 stained-glass tiles (art asset change), or if dynamic, one `dot(viewDir, paneNormal)` term already available, multiplied into `diffuseColor.rgb` before the block-glow add in #1.
Cost: negligible — reuses existing normal/view vectors.
Trap: don't add real refraction (screen-space or cubemap) — no render target to source from; it will look like a mirror hack, not glass, at this art scale.

## Sources
- Complementary Shaders (colored shadows via translucent-block shadow tint): https://minecraftshader.com/complementary-shaders/ , https://www.curseforge.com/minecraft/customization/complementary-shaders
- Shadow Tutorial (GLSL, colored shadows from translucent blocks, worked example): https://github.com/shaderLABS/Shadow-Tutorial
- Volumetric Light Shafts demo (ConeGeometry + AdditiveBlending + depthWrite:false + density/decay uniforms — the exact fake-volumetric shape used above): https://threejsdemos.com/demos/lighting/godrays
- Alpha to coverage background (order-independent cutout transparency vs blend, relevant to the existing 4th cutout pass): https://en.wikipedia.org/wiki/Alpha_to_coverage
- Three.js transparency/draw-order + alphaTest-for-shadows notes: https://r105.threejsfundamentals.org/threejs/lessons/threejs-transparency.html
- SDV-Radiance (Stardew Valley mod implementing window glow + interior/exterior light blend at night — the emissive-window family this stack is imitating): https://www.nexusmods.com/stardewvalley/mods/49397
- Light leak (general reference for the halo/bleed look): https://en.wikipedia.org/wiki/Light_leak
- three.js `Material.dithering` docs (for banding control on additive beam gradients): https://threejs.org/docs/#api/en/materials/Material.dithering

## Do NOT do
- Don't raymarch volumetrics through a density/shadow volume — no shadow map exists in this stack, and a per-pixel loop stalls the UHD 630's already-tight main thread (Intel integrated GPUs are notoriously bad at divergent per-fragment loops).
- Don't add a real shadow map just to get colored shadows from stained glass — bake the tint into the light field (#2) or fake it with a projected decal (#3) instead; a shadow pass is a whole new render target and depth pass this "no post-processing" architecture doesn't have.
- Don't do screen-space or cubemap refraction for the glass highlight — no render target to source reflections/refraction from without adding a capture pass; it will look like a hacked-in mirror, not glass.
- Don't drive window glow from a fixed "is it night" boolean instead of the actual block-light-behind sample — you'll get windows glowing over unlit rooms and dark windows over lit ones, breaking the exact "lit room seen from outside" read Alex asked for.
- Don't scale additive light-leak halos to full village density without a per-quad opacity cap — additive stacks unboundedly with no post pass to tone-map it back down, so a street of five doors overflows to solid white with the naive per-instance brightness dial.
- Don't try to carry full per-voxel RGB through the whole 144x256x144 torus for stained tint — scope it to a short falloff radius from each pane; global RGB is 3x the bandwidth for a look nobody sees past a few voxels from the glass.
