# M244 model-quality experiment on VULNAROK (2026-11-28, OWNER PREVIEW, nothing live changed)
`sheet.jpg` = today's live Vulnarok (public/open/spirits/vulnarok-rigged.glb, 38b69d4d) vs the variant `vulnarok-q-rigged.glb`,
same pose / light / ortho camera (Blender importer, workbench studio): front / three-quarter / side at idle, then a 6-frame run strip.
Echoes are hidden in both shots (they are the same in both). The variant is NOT in public/ and is not wired anywhere.

`tools/rig_quality.py` runs the LIVE build unchanged (`m244-vulnara-2026-11-27/tools/rig_biped.py`) and steps in at `rigcore.write`.
With both passes off it writes a file **byte-identical** to the live glb (checked with cmp), so every difference in the sheet comes from the passes.

| technique | panel | build time | credits | verts (body) | glb | phone draw cost | verdict |
|---|---|---|---|---|---|---|---|
| (a) art palette + chest-blaze projection + facets | rows 1-2 | +1 s | 0 | 6208 -> 7306 (+1 midpoint pass on the chest front only) | +51 KB | same 3 draws, +18 % body verts | **KEEP** |
| (c) secondary motion (ears + brush springs) | rows 3-4 | +3 s | 0 | 0 | +10 KB | 0 (same 26 bones, keys baked into the clips) | **KEEP** |
| (b) TRELLIS base mesh | private sheet | 18 s on Replicate A100 | about $0.03 (one run) | 8546 (textured, no rig) | 1.65 MB | would need a texture path the spirit shader does not have | **DROP as a base mesh; use it as reference** |
| (d) face shapes (blink / snarl morphs) | none | not tried | | | | morph targets on a skinned mesh = extra vertex streams | **not tried (time); next if wanted** |

Variant total: **1,190,384 B** (live 1,129,572), body 7306 verts, same bones and clip names. `three-check` (game makeRigBody): every clip PASS,
lowest walk -0.2 mm / run 1.0 mm / sit 0.0 / lie -0.4, blend numbers **identical to the live file** (sit>walk -4.5 mm in both).

## What each pass does
- **(a)** The colours come from the locked stage-3 art (read-only, `athernyx assets/stage3/001-vulnarok.png`, never copied here): the coat is bluer indigo
  (keeping the live light/dark spread), the **brush is pale lavender** (the art's brush is not coat-coloured), ear insides orange, muzzle and jaw cream-gold,
  and the chest is dark instead of white. The **gold chest blaze is PROJECTED**: a planar +z projection of the art's torso box (px 282,360 -> 520,655) onto the
  chest front; gold pixels paint gold. One midpoint pass on the chest-front faces gives the blaze verts to land on (two passes = 11345 verts / 1.38 MB, finer
  but not worth it; zero passes = blotches). Facets: a +-9 % value step per surface cell (~260 cells), meant as the art's crystal planes; **too weak to read**
  under studio light: turn it up or drop it.
  Limit: the projection only works where her pose matches the art (chest front). Arms, legs and the forearm marks are not projected (the art's arms are raised).
- **(c)** Each ear and the tail chain rides a damped spring (ear about 7 Hz with damping 0.22, tail about 3 Hz with 0.30) driven by the acceleration of the point
  it hangs from (the anchor's rigid motion: head for the ears, pelvis for the tail), worked out in the anchor's frame and looped until steady, so the clip loops
  cleanly. One gain per kind is fitted on her walk (ear peak 0.16 rad, tail 0.11 rad per bone, the tip about 4x) and used for every clip: run 0.26 / 0.18
  (clamped at 1.6x), idle 0.05, sit / lie 0.02. Tail bones each lag 2 frames behind the bone before. The echoes get it too. Works on any rigcore rig.
- **(b)** TRELLIS (firtoz/trellis, MIT) on the art (left echoes painted out): the front view is the closest to the art of anything we have made (gold blaze,
  orange ears, faceted forearms, claws), but the echoes FUSE into the mesh behind her, the pose is a crouch, the topology is not riggable and the colour lives
  in a texture. Making it a base would mean retopology + rigging + baking to vertex colour = more work than the sculpt. Shots are in the PRIVATE sheet
  `/root/athernyx/assets/stage3/sheets/m244-quality-trellis-raw.jpg` (it is a 3D copy of locked art, so it stays out of this public repo).
  Best use: a **colour / proportion reference** for the next sculpt, and a better projection source than the flat art (it has a back and sides).

## Recommendation for the next line
Ship (c) on every rigged spirit (no cost, works on any rigcore rig) and (a) palette + blaze projection on each locked-art form (one pass on
the region being projected). Use TRELLIS only as a reference / projection source. Try (d) once the game drives morph weights.

## Rebuild
```
cd tools; Q_PAINT=1 Q_JIGGLE=1 uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow \
   python rig_quality.py ../../m244-vulnara-2026-11-27/vulnarok.glb ../vulnarok-q-rigged.glb ../vulnarok-q-metrics.json   (Q_DENSE=0/1/2)
/opt/blender/blender -b -P shot.py -- <glb> <out.png> <front|three|side> <clip:t> 1.9
npx tsx docs/looks/m202-vulnara-v2-2026-11-26/tools/three-check.mts docs/looks/m244-quality-2026-11-28/vulnarok-q-rigged.glb 1.8
```
Player-facing text: none.
