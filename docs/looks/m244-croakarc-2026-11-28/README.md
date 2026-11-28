# M244 sheet 9: Croakarc's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Croakarc (Storm): Croakarkor · Croakarielle · **Arcvik** (Ace, pure) · Croakarcun'. Art LOCKED athernyx
assets/stage3/025-028 (PRIVATE, read for shape + colour, never copied here). Owner gallery rows (after Luminix's + Mystowl's), not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (the live Croakarc + the four at true relative size, three-quarter idle over run). The comparison against the
locked art is private: /root/athernyx/assets/stage3/sheets/m244-croakarc-awakened-vs-locked.jpg.

Each is the LIVE Croakarc's sculpt (m202-croakling-pass2 tools/sculpt_croakarc.py, imported, never edited: the skink head with the Croakling's
big eyes, the pointed crest, the violet brow gem, the dorsal spines, the glowing branching lightning veins) re-shaped by name in
`tools/sculpt_croakaw.py`, the palette taken from the locked art (paler, silvery ice-blue). The three upright forms carry the live head moved +
grown (x1.16-1.24) onto a standing body, rigged by `tools/rig_croakup.py` (a ground biped off sheet 7's rig_lumore.py: legs, arms, a four-bone
tail, the pelvis carries her height every frame, the root never moves, baked tail springs from the m244-quality pass). Arcvik stays a skink on
the live Croakarc rig (`tools/rig_arcvik.py` = rig_croakarc.py copied + an aura part + the springs).
| form | dial | silhouette | motif (aura) |
|---|---|---|---|
| Croakarkor (Champion) | 1.85 | stands up, heavy, armoured pauldrons (steel, a pale ridge), a wide open toothy grin, hard brows | a glowing BULB on a stalk off her brow (head) + seven forked bolts crackling out of her (chest) |
| Croakarielle (Virtuoso) | 1.75 | stands up, slim, her left hand raised palm up | a standing RING of nine glowing orbs on a thread of current round her (chest), one over her palm, one at her belly |
| Arcvik (Ace, pure) | 1.8 | the skink, leaner, a taller swept crest, longer spines | a BOLT striking the ground ahead of her with a starburst where it lands (root: it stands in the world, she runs from it) |
| Croakarcun (Enigma) | 1.75 | sits up like a frog, eyes CLOSED (lids + lash arcs), a flat hushed mouth, hands by her feet, tail curled round her | her lure floats FREE above her: a big slow ball of lightning on one thread down to her crest ('float' bone, bobs) |

## Rebuild
```
cd docs/looks/m244-croakarc-2026-11-28; P=/tmp/vulnyx-spike/venv/bin/python
$P tools/sculpt_croakaw.py <kor|ielle|cun> <croakarkor|croakarielle|croakarcun>.glb && $P tools/rig_croakup.py <kor|ielle|cun>
$P tools/sculpt_croakaw.py arcvik arcvik.glb && $P tools/rig_arcvik.py -- arcvik.glb arcvik-rigged.glb arcvik-metrics.json
mv <name>-rigged.glb ../../../public/open/spirits/
/opt/blender/blender -b -P tools/render_croak.py -- <rigged.glb> <dir>/<name>-three.png idle:0 three 3.2 .62   (run:.3 -> -run.png)
python3 tools/sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
Arcvik's body is close to the live Croakarc's (leaner, taller crest): the strike carries her read, and she does not leap (her rig is the live sprawl
walk / scurry). Croakarcun's walk is a slow shuffle (her hands sit by her feet: bigger swings tore the mesh where they meet). The bolts, orbs and
lure are rigid on their bones (no flicker). Croakarkor's open grin is a painted maw with tooth cones, not a jaw that opens. Bolts read thin and
grey in the workbench renders (in game they are unlit and glow). Player-facing text: none (gallery rows show canon names only).
