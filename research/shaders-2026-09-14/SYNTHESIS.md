# Shader research — synthesis (2026-09-14, jin-cc hub)
> Four Sonnet reports in this dir (voxel lighting · three.js cheap effects · toon craft · glass/night
> interiors), one shared BRIEF.md, two baseline shots in `shots/` (Glade, prod, headless, hour=12 / 0).

## The reading that came first (measured, same pixels, noon → midnight)
grass top (139,203,88) → (109,169,105) **~80% kept** · path ~80% · trunk ~78% · **canopy 95,145,91 →
18,43,24 (~25%)** · sky (100,143,195) → (4,7,21).
The blocks do not believe it is night; the flora does. Cause (read, not yet A/B'd): `cartoon-glsl.ts`
`clum = clamp(irradiance / albLum, 0, 1)` — a SHAPE function clamped at 1. Noon top-face irradiance
under the DAY rig is ~3.0 (hemi 1.5 + sun 1.5 + amb 0.4) so it saturates; the NIGHT rig's top face
is still ~0.85 (hemi 0.55 + silver 0.4 + amb 0.15) → `shaped ≈ 0.85` → `toonCol = albedo × ~1.16`.
The stack has no absolute brightness, only "how lit relative to 1.0" — and the night rig never drops
below the clamp on an up face. The canopy is plain Lambert (no stack) and shows what the rig intends.

## Consensus across all four reports (the architecture is right; extend, don't replace)
- Additive block / multiplicative sky split is the correct law; the risk is a FUTURE second
  darkening term stacked on `skyShade`. Keep NEAREST on the 3D texture (correct look AND 8× cheaper).
- No post pass. No EffectComposer/UnrealBloom (10 blur draws, 5 mips). No shadow maps. No RGB flood
  (3× BFS on a budget already measured at 55.8ms). No inverted-hull outline (voxel corners overlap).
  No refraction/reflection. Glow = emissive > 1.0 riding the tonemapper's shoulder (R3F default is
  ACESFilmic) + additive halo sprites capped ≤0.25 opacity.
- three r183 verified: `opaque_fragment → tonemapping → colorspace → fog → dithering` — our replaced
  tail still gets tonemapped, fogged (`scene.fog` IS set in day-night.tsx) and dithered. So
  `material.dithering = true` is a free banding fix; a custom height fog must REPLACE scene.fog.
- Everything as uniforms, never `#ifdef` (one program each; `compileAsync` pre-warms it).

## Ranked build order (payoff ÷ cost, for THIS look)
1. **The stack carries the hour** (toon-craft #1+#4, and it fixes the reading above). Normalise
   `clum` against the rig's CURRENT top-face irradiance (CPU-computed each frame from the same
   lights, one uniform), and multiply the toon result by the hour's light colour (white noon →
   silver night, canon "the Core cooled"). Shadow tint gets its own hour ramp (dawn violet-grey,
   noon blue-cyan, dusk deep violet, night cold silver — never black). Behind `uToonHour` (0 =
   today's render) → A/B shots noon + midnight → Alex rules. World-wide look = his call.
2. **Lit window at night** (glass #1): the pane's emissive keyed to the light field ONE CELL BEHIND
   the glass (step inward along the face normal), tinted by the pane's bloom colour, gated by
   1 − sky brightness. Same texture we already sample; zero new draws. Then the halo sprite (#4).
3. **Rim light gated by N·L** (BotW), skip bottom faces, fade with distance. Three ops.
4. **Height fog coloured from the sky palette** (replaces `scene.fog`), dithered. One exp, one mix.
5. **Greying as a per-fragment desaturation** from a world-position falloff (frayed ring), applied
   before `lightApply` so lanterns still warm a grey block. One dot, one mix.
6. Palette-indexed lantern colour (nibble → RGB lookup), stained tint baked at flood time near the
   pane only. Later; needs the light byte's spare bits.
7. Water: flat two-tone + threshold foam. Later, if the springs read wrong.

## Dev-loop
`scripts/world-shot.mts` with `?hour=` pinned, same pixels sampled before/after (PIL one-liner in
this session), PNG sent to Alex. Numbers then dials — the 09-11 method.
