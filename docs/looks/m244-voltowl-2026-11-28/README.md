# M244 sheet 10: Voltowl's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Voltowl (Storm): Voltowrak · Voltowaya · **Voltwis** (Ace, pure) · Voltoweth'),
art LOCKED athernyx assets/stage3/065-068 (PRIVATE, read for shape + colour, never copied here). Gallery rows #091-#094 (after Croakarc's), not in
PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (Voltowl + the four at true relative size, three-quarter idle over front idle). The comparison
against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-voltowl-awakened-vs-locked.jpg.

Built exactly like sheet 8 (m244-mystowl-2026-11-28): each is the LIVE Voltowl's sculpt (m202-athowl-redo-2026-11-27 tools/sculpt_voltowl.py,
imported, never edited: round pale-blue body, white face, frowning brow, violet brow crystal, cyan-blue eyes, tail fan, breast lightning veins)
re-shaped BY NAME in `tools/sculpt_voltaw.py`, rigged on the live owl rig (rig_owl.py, unchanged: 25 bones, six clips, run = flight) by
`tools/rig_voltaw.py` (sheet 8's rig_mystaw.py with Voltowl's narrower head: re-skin past |x| .30).
| form | dial | silhouette | motif (aura, the glow part) |
|---|---|---|---|
| Voltowrak (Champion) | 1.85 | wings SPREAD wide + raised (her V, bigger), jagged pointed primaries, heavier frowning brow, gold talons | a crackling crest of bolts off her crown (head), ice-crystal armour shards on the wing roots (near), lightning forking under her (root) |
| Voltowaya (Virtuoso) | 1.75 | rounder, wings raised HIGH and open (the conductor) | a lightning ribbon in a figure-eight round her (root), bright leading edges out past each wing tip (near) |
| Voltwis (Ace, pure) | 1.8 | lean diving build: slim teardrop, small head, short swept tufts, sharper beak, long narrow wings swept back + up, long pointed tail | a straight SPEAR of lightning slanting up behind her, crackle off it (root) |
| Voltoweth (Enigma) | 1.85 | wings spread broad + level, round-tipped; storm-grey coat; a violet crystal on her breast | the cyclone eye: four spiral cloud bands winding out + up round her (root), lightning in them (chest) |

## Sheet 8's doubts, fixed here
- Pale strip under the spread wing roots: the coat is shaded light-on-top by the normal and the blade root is a bar whose top faces up, so the
  game's high camera saw a pale stripe across her shoulders. The coat at the blade root + shoulder is counter-shaded (top painted darker), the
  white-breast class stays a front panel (|x| < .16) and no feather-row lip sits within .06 of the blade.
- Body verts: every body under 9k (asserted in spirit-awakened.test).
- Nothing in the aura goes under glb y .085 (FLOOR): the perch / sleep drop the root ~.06 and the walk hop dips it, and a root-borne aura near the
  ground would otherwise lift her whole body off it.

## Rebuild
```
cd tools; VOLTAW_FORM=<form> uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_voltaw.py ../<form>.glb 6000
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_voltaw.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_owl.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <4.44/dial> .55   (front -> -front, icon: three at 2.4)
ICON_DIR=<dir> python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
Player-facing text: none (gallery rows show canon names only).
