# M244 sheet 8: Mystowl's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Mystowl (Mana): Mystowk · Mystowelle · Mystowis · **Mysteth** (Enigma, pure)'),
art LOCKED-AFK athernyx assets/stage3/053-056 (PRIVATE, read for shape + colour, never copied here). Gallery rows: the four after every firefly
line (owl rows come last), not in PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (Mystowl + the four at true relative size, three-quarter idle
over front idle). The comparison against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-mystowl-awakened-vs-locked.jpg.

Built like sheets 5 + 6 (m244-luminarc-2026-11-28): each is the LIVE Mystowl's sculpt (m202-athowl-redo-2026-11-27 tools/sculpt_mystowl.py,
imported, never edited: her egg, huge grey eye discs, ragged tufts, layered feather rows, gold flank glyph panels) re-shaped BY NAME in
`tools/sculpt_mystaw.py`, rigged on the live owl rig (rig_owl.py, run unchanged: 25 bones, six clips, run = flight) by `tools/rig_mystaw.py`,
which steps in at rigcore.write (as the 11-28 quality standard does). Marks are pattern only: plain gold rings, BLANK scrolls, eye shapes, no runes.
| form | dial | silhouette | motif (aura, the glow part) |
|---|---|---|---|
| Mystowk (Champion) | 1.85 | broad; wings SPREAD wide + raised at rest (Voltowl's up0 route), fingered primaries; frowning brow ridge; violet brow gem in a gold frame; heavy GOLD talons | a halo of three plain gold rings behind her (chest) |
| Mystowelle (Virtuoso) | 1.75 | taller slimmer egg, LONG raked tufts, a long tail fan; gold brow arcs + gold chevrons down her chest | six blank floating scrolls in a ring round her (chest; none in front of her face) |
| Mystowis (Ace) | 1.8 | compact teardrop; long narrow pointed wings swept back + up (the dive), short raked tufts, longer pointed tail | a bold gold MASK round both eyes + over the brow (head) |
| Mysteth (Enigma, pure) | 1.85 | wings spread broad + level, round-tipped; a long tail fan | eyes down both wings (skinned like the wing under them), a real THIRD EYE open on her brow (head), plain gold rays fanning up behind her head (chest) |

## Rig additions (rig_mystaw.py)
- Aura: each colour rides one bone (sculpt AURA_BONE; the sculpt asserts no colour is used for two bones).
- Spread wings pass beside her big head: the blade is cut a clear gap from the head (sculpt CWing), and any vertex out past the head weighted
  to head / neck / tufts is re-skinned like the nearest one that is not (else the head's 130-degree look round tore the wing: stretch p99 6 -> 1.8).
- Springs (the quality tool's spring + tip_acc): tufts (head), wing tips (wing3 + wing4 off wing2), tail. Mystowk / Mysteth lower the spread wings
  a little in the sleep. Every grounded clip's lowest key is lifted to 1 mm glb (the prod check samples between keys).

## Rebuild
```
cd tools; MYSTAW_FORM=<form> uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_mystaw.py ../<form>.glb 7000
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_mystaw.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_owl.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <4.44/dial> .55   (front -> -front, icon: three at 2.4)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
The spread-wing forms keep their wings out in idle / sit (as the art); the hop raises them further. Mysteth's body is the densest (~16k verts: the
decimation fell back). Player-facing text: none (gallery rows show canon names only).
