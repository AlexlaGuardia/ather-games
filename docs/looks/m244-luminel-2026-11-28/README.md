# M244 sheet 5: Luminel's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' (Alex 11-28), art LOCKED-AFK athernyx assets/stage3/017-020 (PRIVATE, read
for shape + colour, never copied here). Gallery rows #067-#070, not in PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (Luminel + the four
at true relative size, three-quarter idle over run). The comparison against the locked art is private:
/root/athernyx/assets/stage3/sheets/m244-luminel-awakened-vs-locked.jpg.

All four are HOVERERS like Luminel: each is the live Luminel's sculpt (m202-luminara-line tools/sculpt_luminel.py, imported, never edited)
re-shaped by name in `tools/sculpt_lumaw.py`, rigged on the base Luminara's own 19-bone hover rig by `tools/rig_lumaw.py` (rig_lum.py's swaps
+ HOVER = 1.35 m / dial, so grown they still hang at Luminel's height). The LESSON from Vulnix v1 (forms read as reskins) drove the brief:
each changes SILHOUETTE and carries her motif on the AURA part (her lamp + motif, the look's glow part). Glow = her own body: no lantern, no
sigil, no coins, no lure.
| form | dial | silhouette | motif (aura) |
|---|---|---|---|
| Luminok (Champion) | 2.0 | the armoured bruiser: wide faceted shield abdomen, wide thorax, SIX thick spurred legs splayed, gauntlet arms, shoulder pauldrons, a brow crest, short broad angular gold wings | her lamp a big gold disc on the belly with a gold rim + 12-point sunburst lying on the body |
| Lumilys (Virtuoso) | 1.9 | slender + tall: narrow tapered abdomen with a gold chevron band, long dancer's legs, a gold heart-gem, long slim pointed gold wings | a gold nimbus ring standing behind her + two constellations (stars joined by lines) over her |
| Lumivex (Ace) | 1.8 | the racer: long and LOW, the abdomen laid straight back like a dart (glb_long 1.26 vs ~0.7), gold splotches to a gold tail, narrow swept wings | a long standing gold light-trail ribbon (+ a lilac strand) off the tail, the lamp at the tail |
| Elhae (Enigma) | 2.0 | a kite-pointed faceted abdomen, darker violet, broad pale lilac wings with gold veins, swept + curled antennae with gold knobs | a BLAZING white-gold core on the chest with 14 ROOTS OF LIGHT (some forked) running out of it |

## Numbers (metrics json)
lowest point of any clip incl. aura (glb): luminok 1.415, lumilys 1.512, lumivex 2.021, elhae 1.156 (all in the air). Stretch p99 lie: luminok
4.47 (her splayed legs in the curled sleep), lumilys 3.11, elhae 3.01, lumivex 1.48.

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_lumaw.py <form> ../<form>.glb && $P rig_lumaw.py <form>; mv ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_lum.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <6.4/dial> <cam height>   (same for run:.3 -> -run)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
Luminok's lie stretches her splayed legs (p99 4.5); Lumivex's trail rides her abdomen bone so it kicks up in the run's tail-lift; Elhae's roots
are rigid on the chest (no sway); Luminok's belly disc is plain gold (the art's lattice pattern is left out: no sigil). Player-facing text: none
(gallery rows show canon names only).
