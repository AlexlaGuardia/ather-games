# M202 v2: VULNORE as her own creature (2026-11-26)
Alex rejected s1 (6328309b): the four forms "just look like the same fox in different colors". This redo is ONE form only, Vulnore
(Vulnyx's Earth second form), from the LOCKED art `/root/athernyx/assets/stage2/012-vulnore.png` (grimoire-ledger #12), with Earth
pushed into her anatomy. The other three s1 forms are untouched until Alex judges her.

## What the art shows, and the shape that carries it
- Mossy stone mound on her back, wider than her body -> a domed **carapace** over back and flanks (wider than her barrel, its lip at
  the flank line), crowned with a cluster of 14 stones; moss-olive with grey-green stones.
- Moss over both shoulders, down the upper forelegs, a lump at the elbow -> **moss pads + sleeves** standing proud of the leg, lumpy.
- Golden crystal plate down the cream chest, pointed at its foot -> a **raised faceted plate** with facet lines and a bright diamond.
- Heavy, dark-brown earthen lower legs, big paws, square stance -> **pillar legs** (about 1.3x the Vulnyx's girth) set wider, broad
  paws, earthen stockings.
- Fox head, dark-tipped ears, gold diamond gem + gold brow marks, amber eyes -> the Vulnyx head kept (her line), dark ear tips, the gem.
- Big brush tail, cream upper half, orange at the root -> the line's brush, re-coloured as the art.

## Where the art is silent (each chosen to make her MORE her own creature)
1. The carapace's back half and how far it runs toward the tail (the art is front-on): to just over the brush's root, its lip rising there so the tail swings free.
2. Neck shortened and thickened under the carapace's front.
3. Belly tucked less: a heavier barrel.
4. Claws on every toe (the art shows dark toe tips).
5. Stone knuckle knobs on the outer lower legs.
6. The carapace kept clear of the back of her head (gap), so a head turn never drags it.

## Size (Alex 11-26: "a little size increase as well")
One dial per form: `FORM_GROW_BY` / `formGrow()` in `src/app/shimmer/open/ather/spirit-models.ts`. Vulnore = **1.4** x the Vulnyx's
0.70 m = ~0.99 m standing (her glb is the Vulnyx's height and length in glb units, so the Vulnyx rig numbers fit). The other three
forms stay at FORM_GROW 1.2.

## Rig (her own skeleton)
`tools/rig_vulnore.py`: the M132 quadruped plan (24 bones; walk run idle sit lie) off rig_v2.py, re-placed for her legs and
stance; the carapace is gated to pelvis / spine / chest only (never a leg, the neck, an ear or the brush). Metrics: `vulnore-metrics.json`.
Game check (the game's own makeRigBody, at 1.4): `npx tsx tools/three-check.mts <rigged.glb> 1.4` all PASS.
Edge stretch is higher than the Vulnyx's in run / lie (max 7.0 / 8.7 vs 4.8 / 6.0): the thick legs fold into the barrel. Lying, it
sits under her body.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification python tools/sculpt_vulnore.py vulnore.glb
/opt/blender/blender -b -P tools/rig_vulnore.py -- vulnore.glb vulnore-rigged.glb vulnore-metrics.json
npx tsx tools/three-check.mts vulnore-rigged.glb 1.4
```

## Shots
`side-by-side.jpg`: the locked art | prod 390x844 owner preview (`?form=earth`) | base Vulnyx (left of each pair, drawn at 1/1.4 so the
two are at true relative size) beside the new Vulnore: side, three-quarter, front. `vulnara/vulnarc/vulnix-390.png` = the untouched s1 forms.
Prod check (scripts/m202-forms-check.mts, owner, this box): ALL PASS; Vulnore measured 0.926 m standing (look h 0.977 m).
