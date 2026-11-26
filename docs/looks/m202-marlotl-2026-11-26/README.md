# M202: MARLOTL, Manalotl's Water second form, as her own creature (2026-11-26)
The first of the Manalotl line, ONE form. From the LOCKED art `/root/athernyx/assets/stage2/002-marlotl.png` (grimoire-ledger #2)
and the page (Bonn Bk5, Brook: "the silver light pooled in her frills", "the patterns of her skin began to flow", "clear and pink
and moving", "her endless gentle smile did not change"). Water is in her anatomy; the Manalotl head family is kept.

## What the art shows, and the shape that carries it
- Broad round axolotl head, round black eyes set wide, a gentle smile -> wide flat-fronted head, bead eyes with catchlights, the smile cut in.
- Six big feathery frills -> three gills a side, each a stalk with a WEBBED blade (a fin membrane) and fronds past its edge: the frills became fins.
- Long tail with a broad fin sweeping up -> a flat-sided tail inside a tall paddle fin, its end rising, its edge rippled.
- A fin spike off her back -> a dorsal crest.
- Splayed legs, webbed four-fingered hands -> sprawled legs (elbows out), four fingers, webbed.
- Pale speckles all over -> 70 pale spots (colour). Aqua-teal coat, pale mint belly, paler gill tips + fin.

## Where the art is silent (each chosen to make her MORE her own creature)
1. The dorsal crest runs the whole back into the tail fin (the art shows only its peak).
2. Pale fin rays across the tail fin and crest.
3. A slimmer, longer, LOWER trunk than the Manalotl (a swimmer's), belly carried near the ground.
4. A soft pink blush under each eye and pink at the gill roots (the page: "clear and pink").
5. Hind feet webbed too.
For the glow slice (M204, effects only): the bubbles round her, the curl of water over her head, light running through her frills.

## Size + rig
Dial `FORM_GROW_BY.marlotl = 1.4` x the Manalotl's 0.90 m nose to tail = 1.26 m long, ~0.48 m tall in game (her base ~0.39).
Her own skeleton `tools/rig_marlotl.py` (off rig_vulnix.py, M132 quadruped plan, 24 bones): walk + run are a salamander's sprawl
(diagonal pairs, the spine swinging side to side; no gallop), idle, sit (rump on the ground, 3.7 mm; tail raised), lie (belly
down, legs splayed). The ear bones carry each side's three gills (they stream back on the run, flick at rest). Own `MARLOTL_RIG`
in spirit-models.ts. Metrics `marlotl-metrics.json`, poses `poses.jpg` (sit / lie / run). Game check:
`npx tsx tools/three-check.mts public/open/spirits/marlotl-rigged.glb` all PASS. At a keeper's sprint her run hits the cadence
cap (feet slide), as her base's does. glb 523 KB.

## Shots + proof
`side-by-side.jpg`: locked art | prod 390x844 owner `?form=water` (build 6b81eb3a) | base Manalotl and Marlotl at true relative
size (idle frame 0). `marlotl-390.png` = the prod still. Prod check `scripts/m202-forms-check.mts --species axolotl` (owner, this
box): ALL PASS, marlotl mounted not base, 0.463 m standing, player sees her base Manalotl, 0 page errors.
In game she reads paler than the art (hull + emissive over a light coat), as Vulnarc did: a palette line if Alex wants deeper.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_marlotl.py marlotl.glb
/opt/blender/blender -b -P tools/rig_marlotl.py -- marlotl.glb marlotl-rigged.glb marlotl-metrics.json
```
