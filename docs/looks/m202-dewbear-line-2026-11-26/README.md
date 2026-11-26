# M202: the rest of the Dewbear line: LUMEBEAR, VOLTBEAR, TIDEBEAR (2026-11-26)
Three forms in one slice (Alex 11-26, "batch the sign-offs"), each her OWN creature read from her LOCKED art, owner preview
`?form=mana|storm|water` on a bloomed Dewbear (Cragbear stays `?form=earth`, unchanged). Canon (Magii 6894bdc, spirits-species.md):
the Dewbear's second forms are a COCOON stage modelled on the tardigrade tun, but each is an awake, bonded party spirit who walks,
sits and plays every clip. So the shells stay closed, and she stays moving.

**`line-sheet.jpg`** is the one sheet for Alex: art | model three-quarter | front | face for the base Dewbear and all four forms,
then the line side by side at true relative size (front and three-quarter).

## Each form, and what her art gives her body
- **Lumebear (Mana, ledger #17, `017-lumebear.png`)**: an upright egg-shaped rune vessel on four pointed peg feet that lift her off
  the ground, a domed lid with round ears, three violet hoops and a bottom rim, ten carved staves, a small muzzle with a nose and mouth,
  amber lens eyes, flat clawed flippers standing out from her sides. Gold runes (lid band, one glyph a stave, bottom band, beside the
  eyes) are unlit strokes laid on her surface. The glyphs are generic marks drawn by code, not canon runes.
- **Voltbear (Storm, #18, `018-voltbear.png`)**: a segmented pill (four stacked ring segments under a head), a ridged hood over the
  crown and sides with the face open, pale ice spines round the hood's rim, along the crown and down her flanks, big blue eyes under heavy
  half-closed lids, a frown, blush, stub arms with claws, short feet. Lightning veins are branching unlit pale strokes.
- **Tidebear (Water, #19, `019-tidebear.png`)**: the tallest and narrowest, a capsule column with a bear's head (ears, raised muzzle,
  nose, closed calm eyes and a smile drawn as geometry lines), a crown of five crystal shards, two thin water rings, arms folded down
  over her belly, a lighter teal core with raised bubbles and kelp curls, four flared splash feet.

**Body-plan note:** Lumebear's art IS a barrel with staves and hoops, like Cragbear's (the cocoon ruling fits: both are vessels). She
is not built off Cragbear's body. She is an upright egg on four pegs, with a lid, ears, flippers and a muzzle, where Cragbear is a squat
ball on stumps under a moss crown. `spirit-forms.test` checks it: the four forms' front width profiles (8 height bands) must differ by
at least 0.06 glb units pairwise. Dropping Cragbear's glb in as Lumebear turns it red (and the coat and length checks with it).

## Where the art is silent (listed for Alex)
1. All three walk on FOUR legs (a tardigrade). Each art shows two feet or pegs from the front; the hind pair sits under her back.
2. A short tail nub low at the back of each (the Dewbear's), hidden from the front.
3. Backs: Lumebear's staves and runes run all the way round; Voltbear's hood keeps its ridges and spines at the back; Tidebear's back is
   smooth water with the rings running round.
4. Tidebear's translucency is not modelled (opaque coat, lighter core). Her closed eyes are the art's; canon says she is awake.
For the glow slice (M204, effects only): Lumebear's rune glow and motes, Voltbear's live arcs, Tidebear's rising bubbles.

## Size + rig
All three are sculpted in Cragbear's number space and share her scale: 0.70 m a glb unit (her base's 0.50 x the dial 1.4). Standing
heights (rig metrics, idle): Lumebear 0.756 m, Voltbear 0.794 m, Tidebear 0.848 m (Cragbear 0.769, base 0.50). `BEAR_GLB_TALL` in
spirit-models.ts sizes each in the prod check.
The skeletons come from one script, `tools/rig_bear.py` (off rig_cragbear.py, the M132 quadruped plan, 24 bones, walk / run / idle / sit / lie,
sit and lie solved). Each form gets her own joints from her sculpt's landmarks and `RIG` table. The ear bones carry her arms (flippers,
stub arms, folded arms). Details on the eyes node (runes, veins, bubbles) are skinned by the nearest body vertex. The lie solve now keeps
ALL of her above the floor, not only the trunk (Voltbear's spines sank 15 mm before that). Her own `*_RIG` (glbLen) is in spirit-models.ts.
Metrics are in `*-metrics.json` (weights_bad 0). `npx tsx tools/three-check.mts <glb> <mana|storm|water>`: all PASS for all three.
Lumebear's walk has a max edge stretch of 6.8 (p99 1.25). Cragbear's is 3.3, so the flipper or peg roots stretch on a few edges: worth a
look in the glow pass.

## Shots + proof
The model renders are Blender look.py of the UNRIGGED glbs (the same mesh). Blender's import of a rigged glb drew a stray shard on
Tidebear and offsets Cragbear in the lineup. The game's own skinning has neither (checked: max vertex move 0.019 glb units idle).
Cragbear's place in the true-size strip is that import offset: her size is right, her position is not.

## Rebuild
```
cd tools
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_<form>.py <form>.glb
/opt/blender/blender -b -P rig_bear.py -- <form> <form>.glb <form>-rigged.glb <form>-metrics.json
/opt/blender/blender -b -P lineup.py -- line 1200 440 <glb>:<scale> ...    ;  python sheet.py <render dir> line-sheet.jpg
```

Prod (owner, this box, build 155f684c): `m202-forms-check --species water-bear` ALL PASS: lumebear / voltbear / tidebear / cragbear each
mounted (not her base), sized within 10% of BEAR_GLB_TALL x 0.70 m, player `?form=earth` sees her base Dewbear, 0 page errors.
