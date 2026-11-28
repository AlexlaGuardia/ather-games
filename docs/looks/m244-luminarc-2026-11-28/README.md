# M244 sheet 6: Luminarc's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' ('Luminarc (Storm): Luminthar · Lumicelle · Arcet (Ace, pure) · Lumiceth'),
art LOCKED-AFK athernyx assets/stage3/021-024 (PRIVATE, read for shape + colour, never copied here). Gallery rows #071-#074, not in
PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (Luminarc + the four at true relative size, three-quarter idle over run). The comparison
against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-luminarc-awakened-vs-locked.jpg.

Built exactly like sheet 5 (m244-luminel-2026-11-28): each is the LIVE Luminarc's sculpt (m202-luminara-line tools/sculpt_luminarc.py,
imported, never edited: icy palette, crowned head, branched lightning ANTLERS kept as the family read, ice collar, body bolts) re-shaped by
name in `tools/sculpt_lumarc.py`, rigged on the base Luminara's 19-bone hover rig by `tools/rig_lumarc.py` (sheet 5's rig_lumaw.py + an
aura default bone + Lumiceth's cloak riding the hips). HOVER = 1.35 m / dial. Glow = her own body: no lantern, no sigil, no coins, no lure.
| form | dial | silhouette | motif (aura unless said) |
|---|---|---|---|
| Luminthar (Champion) | 2.0 | broad, segmented ice-shield abdomen, SIX spurred legs splayed, ice pauldrons, BIG wings (fore span .88 vs .60) veined with forking LIGHTNING (on the wing bones) | seven live lightning forks crackling down + out beneath her (hips) |
| Lumicelle (Virtuoso) | 1.9 | slender, upright, long dancer's legs, a little swept tail | a ring of ten glowing orbs (each with a bright heart) on a thin ring of light round her whole body (hips) |
| Arcet (Ace, pure) | 1.8 | compact round racer, swept-back wings + tail fin, ice diamonds on brow and chest | two WHOLE copies of her (0.80 + 0.62 size, paler) streaming behind, on the hover bone (they hang in the air behind her in every clip) |
| Lumiceth (Enigma) | 2.0 | squat; her wings small + folded up at her back and a CLOAK (in the body, lit) from the shoulders past her feet, open at the front, jagged hem; stern brow, flat mouth (no open smile) | lightning down both front edges of the cloak + down her glowing belly (hips) |

## Numbers (metrics json)
lowest point of any clip incl. aura (glb): luminthar 1.056, lumicelle 1.176, arcet 1.804, lumiceth 1.208 (all in the air).

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_lumarc.py <form> ../<form>.glb && $P rig_lumarc.py <form>; mv ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_lum.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <6.4/dial> <cam height>   (same for run:.3 -> -run)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
Luminthar's forks ride the hips (rigid: they do not flicker); Arcet's copies are rigid afterimages (no own skeleton, unlike Vulnisk's); Lumiceth's
cloak is rigid on the hips (does not sway) and her belly bolts are thin. Player-facing text: none (gallery rows show canon names only).
