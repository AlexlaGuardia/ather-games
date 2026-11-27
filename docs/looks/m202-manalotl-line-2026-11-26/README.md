# M202: the rest of the Manalotl line (Aurlotl, Arclotl, Craglotl), 2026-11-26
Batch sign-off cadence (Alex 11-26): the whole line built in one slice, owner preview only, judged on ONE sheet:
`line-sheet.jpg` = art | model (three-quarter, front, side) for the base Manalotl, Marlotl v2 (shipped 78cc8de4, unchanged
here), Aurlotl, Arclotl, Craglotl; bottom row = the sit clip from the rigged glbs.
Preview: a bloomed Manalotl, owner, `?form=mana` (Aurlotl), `?form=storm` (Arclotl), `?form=earth` (Craglotl), `?form=water` (Marlotl).
Players always see the base until M201 evolves her (the stat gate on that element's bar, as the Vulnyx line).

## Each form is her own creature (feedback_second_forms_are_new_creatures)
| | silhouette | gills | tail | marks |
|---|---|---|---|---|
| Marlotl (water) | long, slim, low, a dorsal crest | 3 a side, webbed fin blades | a tall paddle fin standing up | pale spots |
| Aurlotl (mana) | the TALL one: short pear, chest carried high, broad haunches; sits UP (the art's stance) | 3 a side, long ARCING plumes (dark stalk, dense lilac feathers), a crown | a stub | gold infusion markings: flowing glyph panels (brow, chest, flanks, shoulders, arms), never a sigil (2026-11-27, see m202-aurlotl-glyphs-2026-11-27) |
| Arclotl (storm) | the ROUND one: a barrel with a big low belly, stumpy legs | 3 a side, straight saw-tooth SPIKES with two forked tendrils off each tip | thick, flattening into a wide FLAT paddle on the ground | crackle veins, a spark on the brow, cream belly |
| Craglotl (earth) | the WIDE, LOW one: head and body one dome, the widest stance of the line | 4 a side, short flat LEAF blades with notched (flame) edges, hugging the head | short, thick, laid on the ground | stones in the crown + back, moss, warm belly |
The test asserts no two of the three new forms share a length:height + width:height read.

## Where the art is silent / calls for Alex
- **Aurlotl + Arclotl stand on two legs in the art.** Every spirit runs the M132 quadruped plan, so in game they WALK on all
  four (a waddle) and their **sit** is the upright stance (Aurlotl's sit reads as the art; Arclotl's sit is only a slight
  lean: a full upright sit on her round low belly lifted her onto stretched legs, so it is held low, see Rig). A real biped
  plan is a separate slice if he wants them upright while walking.
- Aurlotl's marks: RULED (Magii 0d6d577) pattern only, no sigil ever. Redrawn 2026-11-27 as glyph panels: docs/looks/m202-aurlotl-glyphs-2026-11-27.
- Tails where the art hides them (Aurlotl's stub, Craglotl's short tail); back stones on Craglotl; claws on all feet.
- Glow (M204 effects slice): markings lit, tendril sparks, belly glow. The hull/emissive colours reuse the Vulnyx line's per
  element (violet / blue / warm orange); canon Earth is brown: Craglotl's emissive is the same orange as Vulnore's.

## Size
All four forms are sculpted in Marlotl's number space and share her world scale (her dial 1.4 over the Manalotl's 0.90 m
nose to tail), so the line reads at true relative size (the sheet header gives each in metres). Sizing each by her own length
would have blown the short Aurlotl up to Marlotl's 1.26 m.

## Rig + checks
`tools/rig_lotl.py <form>`: one script, every joint placed from that form's sculpt landmarks (the M132 quadruped plan, 24 bones,
walk / run / idle / sit / lie, sit + lie solved). weights_bad 0 for all three. Metrics `<form>-metrics.json`.
Known: Arclotl's sit rump floats ~2.5 cm (the solve is not monotonic on her belly); edge stretch max 4-6 (Marlotl 3-4).
`spirit-forms.test` 116/0 (mutations: Craglotl dial 1.3 caught; Arclotl glb swapped for Marlotl's caught 3x).

## Rebuild
```
cd tools; uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_<form>.py ../out/<form>.glb
/opt/blender/blender -b -P rig_lotl.py -- <form> ../out/<form>.glb ../out/<form>-rigged.glb ../out/<form>-metrics.json
blender -b -P ../../vulnyx-2026-11-24/tools/look.py -- <unrigged glb> <prefix> 420      (look.py on a RIGGED glb draws it broken: use pose.py)
blender -b -P pose.py -- <rigged glb> <prefix> <clip> <t>
```

## Prod proof (build 8e1b9f80, carries d37cc6c2)
`scripts/m202-forms-check.mts --species axolotl` (owner, this box, 390x844): ALL PASS. aurlotl 0.663 m standing (want 0.67),
arclotl 0.582 (0.59), craglotl 0.396 (0.42), marlotl 0.467 (0.48), each mounted not the base; player `?form=water` sees the base
Manalotl, no form glb asked for; 0 page errors. Stills: `prod/<form>-390.png`.
