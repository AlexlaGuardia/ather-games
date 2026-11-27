# M202: the Hovari line: VOLTARI, LUMARI, OBSIDARI, TIDARI (2026-11-27)
All four forms in one slice (Alex, "batch the sign-offs"). Each one is her OWN creature, read from her LOCKED art
(/root/athernyx/assets/stage2/005-voltari, 035-lumari, 036-obsidari, 037-tidari). Owner preview: `?form=storm|mana|earth|water` on a bloomed Hovari.

**`line-sheet.jpg`** is the one sheet for Alex: art | model three-quarter | front | face per form + the base, then the whole line at TRUE
relative size with NO tint (base Hovari 0.30 m beak to tail, the forms at the dial 1.4). The base's art cell is the game's public `hummingbird.png`.

## Each form, and what her art gives her body
- **Voltari (Storm, #5)**: slim slate-blue, the longest pale ragged wings (the widest span of the line), a long ragged tail fan, a fuzzed crown with a
  big violet crystal, a clear blue eye, a long needle beak, pale lightning veins over coat and wings.
- **Lumari (Mana, #35)**: the plumpest egg of a body, the longest beak tilted up, broad violet wings, three long pointed tail feathers, a dark violet
  eye, broad faceted feather tips, a gold FLOWING pattern over her chest and left cheek (bands and a ring; never a sigil, 0d6d577).
- **Obsidari (Earth, #36)**: stocky amber stone-chip feathers (short thick tips, dark seams), the biggest head with a ridge of chips (the highest crown),
  a collar of green gems, grey stones in moss on her flank, short broad leaf wings raised, a broad tail fan, an amber eye.
- **Tidari (Water, #37)**: the sleekest, small neat head with a big water-drop gem on her crown, a short fine beak, narrow translucent wings swept high,
  the longest narrow tail (the longest back of the line), ripple rings over her coat, a dark eye.
Alex 11-27 on the Athowl line ("not so dainty or simple"): every form wears its own rows of LAYERED feather tips (geometry, lit at the tips) and
1.15x broad wing blades; element features sized up (crystal, drop, gem collar, gold bands, veins).

Silhouette check (`spirit-forms.test`): width + front depth + back depth in eight bands of her BODY height (the hover is empty air); all five,
base included, differ pairwise by >= 0.06 glb units; plus Voltari widest span, Tidari longest tail, Obsidari highest crown. Dropping Lumari's
glb in as Tidari turns 5 asserts red (height, coat, silhouette, two tells).

## Where the art is silent / still off the art (listed for Alex)
1. All keep the base Hovari's hover clips (hover, drift, dart, settled, sleep, glance) and hover dial, so at 1.4x they hang ~1.2 m up.
2. Obsidari's flank stones + moss read weakly (her chip tips cover them); her wings are shorter than the art's. Voltari's veins are thin strokes; her wings are
   less translucent than the art (opaque toon). Lumari's pink wisp and Tidari's smoke/bubbles are effects, not modelled (M204 glow work).
3. Eyes: the base Hovari's eye builder with each form's own palette (all open, as the art).
Player-facing text: none added.

## Size + rig
Sculpted in the base Hovari's number space (1 unit = 0.219 m) with SHARED TOOLS ONLY (`tools/hov_common.py`: surface + collapse, feather-sheet
builders, eye builder with her palette, the layered-tip tool, a generic soft-coat painter fed her colours). Every body name is bound from the
form file; the base's own body functions are removed before use. Skeleton: `tools/rig_hov.py` = the base's 24-bone hover plan fitted to each
form (wing root / wrist / tip, tail root and length, lid colours). Body heights (glb units, the hover not counted): `HOV_GLB_TALL` in spirit-models.ts.
`npx tsx tools/three-check.mts <glb>`: 13/13 PASS for all four (every game clip + blend over 0.65 m). Metrics in `*-metrics.json`.
Topology: Obsidari's 4th tail feather past x 0.27 (the tail mask) and a ring of crown chips each made handles; Voltari's tail tip at 0.250 did
too (kept at 0.285). `build()` asserts one closed sphere.

## Rebuild
```
cd tools; uv run --no-project --with numpy,scipy,trimesh,networkx python sculpt_<form>.py ../<form>.glb
uv run --no-project --with numpy,scipy,trimesh,networkx python rig_hov.py <form> ../<form>.glb ../<form>-rigged.glb ../<form>-metrics.json
LOOK_EM=r,g,b LOOK_HULL=r,g,b /opt/blender/blender -b -P look.py -- ../<form>.glb <prefix>    (the unrigged glb: rigged imports pose wrong here)
/opt/blender/blender -b -P lineup.py -- line 1400 460 <glb>:<m per unit> ... ;  python sheet.py <render dir> ../line-sheet.jpg
```
