# Stylized voxel lighting — techniques ranked for Shimmer

## 1. Additive block-light tint, kept (don't replace the shape, extend it)
Complementary/BSL/Rethinking Voxels and Vintage Story all converge on the same law: block light is
**additive + RGB-tinted**, sky light is **multiplicative/darkening**, never both multiplying the
same term (the double-darken trap, §7). Shimmer's `shimmerLightCell` already has this shape:
`col*mix(floor,1,skyShade) + albedo*tint*gain*pow(blkL,curve)*(1-skyShade)`. Right architecture; the
payoff left on the table is **per-lantern colour** instead of one global `uBlockTint`, which is
what Complementary's stained-glass tint and "Advanced Colored Lighting" (ACL) add.
- **Cost**: near-zero — go from 1 warm scalar to an 8-bit palette id → RGB lookup, not per-voxel RGB
  (§2 explains why full RGB storage is wrong here).
- **Trap**: don't confuse "coloured lanterns" with "coloured GI" (Rethinking Voxels' raymarch, §
  "Do NOT do") — flat additive tint is the 90%-payoff/10%-cost version Shimmer already has the hook
  for.
- https://github.com/gri573/rethinking-voxels · https://minecraftshader.com/complementary-shaders/

## 2. Palette-indexed light colour, not full RGB per voxel
Minecraft colored-light mods split into two camps and the cost gap is the whole lesson. `Gegy/
colored-lights` avoids full per-voxel RGB — "computing colored lighting would require excessive
memory" — and instead computes **one colour per chunk corner, blended within the chunk**: colour
demoted to a coarse smooth field, the fine BFS stays scalar. `FalsePattern/RPLE` is the other camp:
true per-voxel RGB, 3x the light data, needs serverside sync to stay correct.
- **Shape for Shimmer**: leave the 1-byte packed sky/block field untouched (it drives spawning —
  don't touch `voxel/light.ts`). Add one RGB colour per light-*source type*, looked up at the
  fragment stage and weighted by the existing scalar `blkL` — same trick as Gegy's corner-blend,
  mapped onto the ring texture already sampled:
  ```glsl
  // emitterId rides in a currently-unused nibble of the light byte
  vec3 blockColor = mix(uBlockTint, texelFetch(uLanternPalette, emitterId, 0).rgb, uAcl);
  shaded += albedo * blockColor * (uBlockGain * pow(blkL, uBlockCurve) * (1.0 - skyShade));
  ```
- **Cost**: one more texelFetch, no extra 3D-texture bandwidth. Highest payoff/cost item here for
  the "lit room through stained glass at night" thread.
- **Trap**: don't flood distinct colours through one scalar field (a blue lantern beside a warm
  one) — they'll bleed/average wrong at the seam. Cap to "nearest emitter wins"; never run a second
  full BFS per channel, that's RPLE's cost with none of its correctness.
- https://github.com/Gegy/colored-lights · https://github.com/paulevsGitch/BetterLight-b.1.7.3- ·
  https://modrinth.com/mod/rple

## 3. Coloured glass = tint the transmitted glow, not raymarched light transport
Complementary's stained-glass tint and the Hypixel thread on colour-shifting translucent blocks
point at the same trick: the pane stays a normal cutout-alpha draw (Shimmer already has this — the
4th pass, `pane` piece); the colour comes from tinting the **room's own lantern light** by the
pane's colour as it exits, not from raymarching light through geometry:
```glsl
// glass fragment, additive glow — tint the emitted glow by the pane's own colour
vec3 glow = paneTintColor * roomBlockLight * uGlassGlowGain;
```
- **Cost**: one multiply on a draw call that already exists.
- **Trap**: true colour-bleed-through-glass (Rethinking Voxels' raytraced version) needs a voxel
  scene structure Shimmer doesn't have. The "room glows the colour of its glass at night" read is
  achievable with zero new geometry — don't chase the real thing.

## 4. Fake bloom via additive billboard/halo quad (no post pass)
Every "bloom without post-processing" source converges on one shape: a camera-facing additive quad
with a soft radial falloff, drawn around the emissive object.
```js
const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialGlowTex, color: lanternColor,
  blending: THREE.AdditiveBlending, depthWrite: false,
}))
```
This is the Doom-3 `FlareDeform` fake-volumetric-glow trick, and it's what stylized block games ship
instead of HDR bloom, because full bloom on a 6px lantern in a 16-block room is expensive for the
payoff.
- **Cost**: 1 draw call + 1 tiny texture, instanced (one `InstancedMesh` keyed to emitter positions
  the light field already knows). `depthWrite:false` avoids fighting the AO/outline pass. Fill-rate
  trivial; bandwidth is one reused 32-64px soft-radial PNG.
- **Trap**: additive quads accumulate — 20 close lanterns blow out to solid white. Clamp with
  `min(1.0, sum)` or a visible-count budget; same lesson as the "washes the grass at noon" trap
  already documented for `uBlockTint`.
- https://www.patreon.com/teamdogpit/posts/no-bloom-no-post-53965598 ·
  https://github.com/hollowdilnik/GlowingQuad

## 5. Light-pool ground decal under lanterns
A near-free depth cue used across stylized block games (Hytale footage, DQB2, Vintage Story's
`Lumos` — lights "illuminating everything the beam hits"): a flat additive/alpha decal on the
ground under a light, independent of the volumetric field. Sells precision the field doesn't have —
Shimmer's field samples per column, coarser than a decal's visible edge.
- **Shape**: instanced plane, soft-edge alpha texture, tiny Y epsilon or `polygonOffset` against the
  floor mesh.
- **Cost**: same order as §4.
- **Trap**: ignores terrain height — a decal on a staircase looks pasted on. Fine for flat floors
  (most lantern placements); don't bother projecting per-step.

## 6. Per-fragment 3D-texture sampling over vertex-baked smooth lighting — keep as-is
Classic "smooth lighting" bakes light into vertex colours and lets the rasterizer interpolate:
cheap, but couples light resolution to vertex density. That's exactly the trap `voxel/light.ts`'s
own comments already name for AO and texture variation — **greedy meshing breaks when adjacent
quads need different per-vertex values**, collapsing a flat floor from 1 quad back to hundreds.
Shimmer picked per-fragment 3D-texture sampling specifically to dodge this, and that's correct for
a UHD 630: sampler cost is O(fragments), not O(re-tessellated verts), and greedy meshing is what
keeps draw calls low on integrated graphics at all. Do not switch this.
- http://pixelwight.blogspot.com/2015/06/voxel-based-lighting.html (states the AO-for-free /
  meshing-coupling tradeoff this stack already traded away on purpose)

## 7. The double-darkening trap — already dodged, name the future risk
Multiple sources (a buildat PR on skylight/AO/PBR, an open Bliss-Shader issue) name the same bug:
sky/AO and a second darkening term (shadow map, night multiplier) both multiply the direct light,
so shadowed ground reads pitch-black at noon — "the sun is shadow mapped already, and attenuating
it by skylight as well darkens shadowed faces twice." Shimmer's own header already states the fix
as law: the sky channel darkens once, never multiplied by day-factor again, because the scene's
sun/hemisphere already carries the hour. Correctly built today; the risk is a *future* shadow map
or per-face AO layered on top of `skyShade` silently reintroducing multiply-on-multiply. Any new
darkening term must be checked against what `skyShade` already owns.
- https://github.com/celeron55/buildat/pull/25 · https://github.com/X0nk/Bliss-Shader/issues/370

## 8. Night desaturation tied to skyShade, never touching block light
Shader packs and Vintage Story mods that keep night readable (Ancestral Bliss's configurable
warmth, the "Moody" preset's ~17% brightness + blue shade) desaturate/blue-shift the **sky-lit**
term only, matching Shimmer's rule that `uBlockTint` stays warm regardless of hour. Worth adding: a
saturation pull tied to `skyShade` — `mix(color, luminance(color), (1-skyShade)*uNightDesat)`
applied *after* the block-light add, gated by the day-night uniform already driving the cycle.
- **Cost**: one mix per fragment behind a dial defaulting to 0.
- **Trap**: apply before the block-light add and every lantern washes out pastel instead of warm.

## Do NOT do
- **Full per-voxel RGB light flood** (RPLE-style, 3x the array + serverside sync) — wrong cost for
  1-2 distinguishable lantern colours per room; use §2 instead.
- **Vertex-baked smooth lighting** — reopens the greedy-meshing trap `voxel/light.ts` already named.
- **Real bloom (EffectComposer/UnrealBloomPass)** — full-screen HDR extract + blur is the frame-time
  bet the brief already ruled out ("NO post-processing at all today"); §4 gets most of the read for
  near-zero fill cost.
- **Voxel raymarched GI / raytraced colored shadows** (Rethinking Voxels' real technique) — needs a
  secondary voxel scene structure and compute raymarching; wrong fit for `onBeforeCompile`-on-Lambert
  and for a GPU (Intel UHD 630 / ANGLE D3D11) with no async-compute path worth trusting.
- **A second multiplicative darkening term stacked on `skyShade`** — reintroduces §7's named bug.
- **Distinct BFS per RGB channel** — 3x the queue cost already measured as a 55.8ms/frame budget
  crisis for one scalar channel on the UHD 630; tripling it is disqualifying, not a tuning question.
