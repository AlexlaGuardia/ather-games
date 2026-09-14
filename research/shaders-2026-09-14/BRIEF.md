# Shader research brief — Shimmer voxel3d (2026-09-14)

## What the renderer IS today (read this before researching; answers must fit it)
- three.js ^0.183, WebGL2, Next 16 client component. Target GPU: Intel UHD 630 (ANGLE D3D11) on
  Alex's desktop + phones. 60fps budget is tight; shader compile + texture upload stall the main
  thread there. Headless test rig is SwiftShader (0.4fps — per-frame timings there are not honest).
- Blocks: chunk meshes on MeshLambertMaterial with `onBeforeCompile` injection. A 2D tile ATLAS
  (`tex/atlas.ts`) with per-vertex tile id + AO + relief. Fallback untextured path in `mesh-bridge.ts`.
- The CARTOON STACK (`cartoon-glsl.ts`, ONE module, three consumers): per-face fixed shading
  (top 1.0 / side ~0.76 / bottom 0.52), optional 3-step toon banding, shadow lift = cooler tint of
  the base scaled by albedo luminance (never a flat add), world-position block-edge outline (no post
  pass). Dials are uniforms; `uCartoon` mixes against plain Lambert.
- The LIGHT FIELD (`light-glsl.ts`, `light-texture.ts`, `voxel/light.ts`): a Minecraft-style
  sky+block light flood per column, packed into ONE 144x256x144 byte Data3DTexture arranged as a
  torus (9x9 columns) so every chunk samples the same uniform. Sky channel DARKENS only (never
  multiplied by day — the scene sun/hemisphere carries the hour); block channel ADDS a warm tint
  (lanterns). Cave floor 0.08, skyCurve 1.5, blockCurve 1.4. Pieces (beams, doors, panes) are
  instanced meshes that run the same stack + field via instanceMatrix.
- Sky: camera-following inverted sphere, one raw ShaderMaterial (zenith/horizon/sun gradient,
  sun drawn in-shader, twilight warmth, underwater veil). Day/night cycle exists (`day-night.tsx`).
- Mist: ground-following sky-white pools per patch (`mist-pass.ts`), sprites. Smoke/steam: Points.
- Glass: a 4th cutout draw pass (textured program + discard), alpha-as-coverage; six stained
  glasses (glass + a bloom colour), leaded lattice; `pane` piece drawn double-sided cutout.
- NO post-processing at all today (no EffectComposer, no bloom, no SSAO). Shadows: none (no shadow
  maps) — the field + per-face law + AO do that work. sRGB output.
- Canon look (LAW, not ours to change): the garden glows honey-gold (tended = colour, greying =
  desaturation at the frayed edges), Moonwell Glade carries a cool SILVER accent, night = "the Core
  cooled" (no moon in the Ather), lanterns are the only reason a deep cave is bright.

## What Alex wants
"Shaders" — make the world read better. Open threads: (1) a lit room seen through a stained-glass
window at night; (2) pieces vs blocks reading as one material (mostly done); (3) the 08-19
lighting questions: coloured light from stained glass / lanterns, the greying as a spatial effect,
depth cues. Ghibli-warm cartoon voxel, NOT photoreal.

## Output contract for every agent
Write `/root/ather-games/research/shaders-2026-09-14/<topic>.md`, <= 1500 words:
1. Techniques RANKED by (visual payoff for THIS look) / (cost on a UHD 630 + integration cost into
   the stack above). 5-8 items max.
2. For each: what it is (2-3 lines), the concrete shape in three.js r183 / GLSL ES 3.0 (code
   sketch OK, keep short), the cost (fill-rate / draw calls / uniforms / bandwidth), the trap.
3. Sources: real ones (GDC talks, engine docs, shader repos, blog posts) with URLs. No invented refs.
4. A final "Do NOT do" list — things that look tempting and fail on integrated GPUs or fight the
   onBeforeCompile/Lambert architecture.
No preamble, no restating this brief. Be terse and specific.
