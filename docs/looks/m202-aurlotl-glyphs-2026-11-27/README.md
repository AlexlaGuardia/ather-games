# M202 follow-up: Aurlotl's gold marks as glyph panels, 2026-11-27
Magii RULED-AFK 2026-11-26 (athernyx 0d6d577, CANON_GAPS "Aurlotl's runes"): **no sigil, ever** (sigils are Lazerin's weapon
crystals). Her gold marks are the **infusion markings a second form arrives with** (design-briefs/base-forms.md:15): pattern only,
in her element's look, spelling no named rune. So the placeholder brow sigil (a ring with a cross) and the plain rings are gone.

`sheet.jpg` = before | after: sit, chest + shoulders, flank + upper arm, brow. (`sheet-with-ref.jpg` adds the locked art; gitignored.)

## What she wears now (read off the locked art, 014-aurlotl.png)
| art | model |
|---|---|
| an oval panel on the brow, wider than tall, an interlace inside | oval outline round a flowing knot line, on the head |
| a round panel mid-chest | round outline round the knot, just below the chin (her chest sits under the head in the quadruped pose) |
| a knot panel on each belly flank, no outline | a bigger knot on each side, between fore and hind legs |
| an arc on each shoulder | an arc over each side of the chest panel |
| a small oval on each upper arm | a small oval on the outside of each foreleg |
Every panel's inner stroke is the same line: a trefoil-knot projection, one closed flowing self-interlacing curve with no straight
bar and no letter. It is pattern, not a rune. If Alex ever wants a form's marks to spell a real rune, that is a new Magii ruling.

## How
- All marks are unlit gold geometry in her `eyes` part (dots laid touching along each curve, projected onto the skin), as the
  brow mark already was. A colour cut that thin on her 8k-tri body broke into blobs and dashes (tried first).
- `rig_lotl.py` `eye_weights`: a mark on the body takes the skin weights of the body vertex under it; head marks (eyes, smile, brow)
  stay on the head bone. Without it the chest / flank panels float off her when she walks or sits. The game already skins `eyes`
  per vertex (spirit-rig-body.ts), so no game code changed. Other lotl forms re-rigged with it are unchanged (all their eye verts sit
  on the head).
- Body mesh is byte-for-byte the same sculpt (same field, same decimation); rig metrics match the shipped ones (weights_bad 0,
  walk/sit/lie lowest + size identical).

## Checks
- `spirit-forms.test` new block: the brow panel's gold rides `b_head`, and more than twice as much gold rides the body bones.
  Mutation: the old shipped glb fails it (0 gold verts off the head).
- `tools/three-check.mts <glb> mana` (the Dewbear-line check, species axolotl): clips, nodes, idle/walk/run/lie PASS. **sit FAILS
  at -15.1 mm, identical on the old shipped glb** (body unchanged): her sit dips the floor by that much since d37cc6c2 (the line
  README's rig metrics already say sit lowest -0.0159 m). Not this slice; listed.

## Rebuild
```
cd ../m202-manalotl-line-2026-11-26/tools
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_aurlotl.py <out>/aurlotl.glb
/opt/blender/blender -b -P rig_lotl.py -- aurlotl <out>/aurlotl.glb <out>/aurlotl-rigged.glb <out>/aurlotl-metrics.json
python3 ../../m202-aurlotl-glyphs-2026-11-27/tools/sheet.py <before renders> <after renders> . [locked art]
```
