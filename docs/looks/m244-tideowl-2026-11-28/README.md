# M244 sheet 13: Tideowl's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Tideowl (Water): Tidowrok · **Tidelle** (Virtuoso, pure) · Tidowsk · Tidowmyr'),
art LOCKED athernyx assets/stage3/073-076 (PRIVATE, read for shape + colour, never copied here). Gallery rows #103-#106 (after Croakrill's), not in
PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (the live Tideowl at dial 1.4, then the four at true relative size, three-quarter idle over front idle).
The comparison against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-tideowl-awakened-vs-locked.jpg.

Built like sheets 8 + 10 (m244-mystowl / m244-voltowl tools): each is the LIVE Tideowl's sculpt (m202-athowl-redo-2026-11-27 tools/sculpt_tideowl.py,
imported, never edited) re-shaped BY NAME in `tools/sculpt_tidowaw.py`, rigged on the live owl rig (rig_owl.py, run unchanged: 25 bones, six clips,
run = flight) by `tools/rig_tidowaw.py` (sheet 10's rig_voltaw.py with Tideowl's names). Sheet 8's spread-wing cut (CWing) and sheet 10's pale
wing-root strip fix are reused (Tideowl's plumage pair = her classes 0 + 1). EVERY form keeps her round WATER GEM on the crown (her own decal);
Tidelle and Tidowmyr also wear a glowing one (aura). All four grow ear tufts (every locked art has them; the live Tideowl has none).

| form | dial | silhouette | motif (aura, the glow part) | body verts |
|---|---|---|---|---|
| Tidowrok (Champion) | 1.85 | heaviest; wings SPREAD WIDE + raised, angled brow ridges (the frown), big dark talons | a breaking WAVE curling up off the outer half of each wing, foam flying off the crests ('near': rides the wing) | 4363 |
| Tidelle (Virtuoso, pure) | 1.75 | upright, wings raised high and open | the POOL she stands in + ripples + splash (root), drops on threads under her wings ('near'), a big glowing gem on her crown (head) | 6496 |
| Tidowsk (Ace) | 1.8 | compact round body, wings out + swept back (the dive), shorter tail | the SPEAR of water: eight streams winding up round her to a point over her head, a splash crown + ripples at her feet (root) | 6951 |
| Tidowmyr (Enigma) | 1.85 | a pale, near-white owl, broad level teal wings | MIST veils drifting off her lower half (pelvis) and trailing back off her tail (tail2), a light in her breast (chest), her gem glowing (head) | 3495 |

## Rebuild
```
cd tools; UV="uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python"
TIDOWAW_FORM=<form> $UV sculpt_tidowaw.py ../<form>.glb <tris>      (tidowrok 5200, tidelle 6000, tidowsk 6000, tidowmyr 3800: other counts fail to close or run over 9k)
$UV rig_tidowaw.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_owl.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <4.44/dial> .55   (front -> -front, icon: three at 2.4)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
1. Tidowsk's art has an open beak; ours keeps Tideowl's closed beak (no mouth rig).
2. Tidelle's pool and Tidowsk's spear ride the root, so they travel with her on the hop and lift with her in flight (as Voltowl's lightning did).
3. Tidowmyr's art perches on a branch with her mist tail hanging; on the ground her veils stop at ~0.19 glb (lower ones went under the ground in the sit / sleep).
4. Tidowrok's wings are rounder than the art's fingered primaries (the 5200-tri decimation is the one that closes).
5. Player-facing text: none (gallery rows show canon names only).
