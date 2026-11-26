# M202 v2: MARLOTL, head + eyes redo (2026-11-26)
Alex on v1 (6b81eb3a): "the main thing I'm looking at here is the head and eyes looks bit weird can we give that another try".
This pass changes ONLY her head and eyes. Body, gills, crest, tail fin, legs, colours and the rig are v1's
(`../m202-marlotl-2026-11-26`). Size dial stays 1.4.

Studied: the locked art `/root/athernyx/assets/stage2/002-marlotl.png` and the live base Manalotl (`public/open/spirits/manalotl.glb`,
Alex: "they look great"). `head-compare.jpg`: art head | v1 | v2 | base Manalotl, close, front / three-quarter / side.

## What looked off in v1
1. **Eyes perched ON TOP of the head.** The eye centre sat at the top edge of the face, so from the side and three-quarter the
   eyes broke the head's silhouette like two black balls stuck on its crown (a frog's or a snail's, not an axolotl's).
2. **Plain black beads.** No iris ring, one tiny catchlight. The art's eyes are dark blue-black with a blue ring and a big shine;
   the base Manalotl's are a dark ring round a black pupil with a big catchlight. v1 had neither, so she read blank.
3. **A flat, wide lozenge head.** Wider than twice its height from the front, the face low and the jaw heavy, no forehead dome.
   The art's head is a big round dome about 1.4 x as wide as tall.
4. **The smile broke into dashes.** It was a colour cut on the decimated face, too thin for the mesh, so it showed as 4-5 dark
   flecks; and it ran two thirds of the face wide.

## What v2 changes
| | v1 | v2 |
|---|---|---|
| head | ellipsoid 0.262 x 0.182 x 0.218 (half sizes), flat front 0.132 tall | a rounder dome 0.258 x 0.198 x 0.216, the soft front carried UP (0.162 tall, centre +2.7 cm) so it is the face the eyes sit in |
| eye place | x 0.150, y 0.445 (top edge of the face) | x 0.148 (art spacing: ~0.57 of head width), y 0.404: mid-face, below the dome |
| eye size | bead r 0.043 | lens r 0.056 |
| eye shape | a full sphere bead standing proud | a lens flattened along the face normal (0.42) so it sits in the face, as the base's does |
| eye look | black + one catchlight | dark blue ring (the art's) round a black pupil, a big catchlight high + outside, a small one low + inside |
| eye rim | none | a thin pale lid ring round each eye (the art's light rim) |
| smile | colour cut, 0.35 half-width, dashed | a line of geometry (in the eyes mesh, head-weighted), 0.10 half-width, a gentle curve whose ends lift |
| blush / nostrils | blush pressed against the eye, nostrils high | blush under and outside each eye, nostrils between the eyes and a little under |
| spots | kept off a small eye patch | kept off the eyes, lids and blush |

Gills: same roots (behind the eyes, from the back of the head); the rounder dome still swallows each stalk's root, so the
gill-to-head joint is unchanged.

## Rig + checks
Same skeleton script (`tools/rig_marlotl.py`, imports the v2 sculpt; landmarks unchanged). Eyes + smile are weighted 100 % to the
head bone, so they ride the head in every clip (checked: run + sit head close renders). `marlotl-metrics.json`: weights_bad 0,
rump sits 6.4 mm (v1 3.7), lie/sit/run numbers within a few % of v1, length 1.32 m. glb 672 KB (v1 526: the smile beads and
finer eye lenses). `npx tsx ../m202-marlotl-2026-11-26/tools/three-check.mts public/open/spirits/marlotl-rigged.glb`: all PASS.
spirit-forms.test 69/0.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_marlotl_v2.py marlotl.glb
/opt/blender/blender -b -P tools/rig_marlotl.py -- marlotl.glb marlotl-rigged.glb marlotl-metrics.json
blender -b -P tools/headshot.py -- <glb> <prefix> .25,.77,.75     (HM=4.0 env: distance; the close head shots)
```
