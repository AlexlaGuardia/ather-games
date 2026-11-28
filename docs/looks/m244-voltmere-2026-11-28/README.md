# M244 sheet 17: VOLTMERE's four awakened forms (2026-11-28). OWNER PREVIEW only (owner gallery rows #123-#126, see spirit-gallery.ts).
Canon spirits-species.md: **Voltmere (Storm):** Voltmerkor · Voltmeraya · Voltvis (Ace, pure) · Voltmeth.
Locked art = athernyx assets/stage3 077-080 (looked at, never traced, never in this repo). `line-sheet.jpg` = the live Voltmere (dial 1.95, M249),
then the four at TRUE relative size (ortho 6.27 / dial), three-quarter idle over side run. Private side-by-side vs the locked art:
athernyx assets/stage3/sheets/m244-voltmere-awakened-vs-locked.jpg.

## Built off the live Voltmere, by name, on the Shellmere line's LEGGED rig (sheet 15b's route, Aurmere)
- `tools/sculpt_voltaw.py <form>` imports the live Voltmere sculpt (m202-shellmere-line tools/sculpt_voltmere.py, never edited) and re-shapes her by name.
- `tools/rig_voltaw.py <form>` = sheet 15b's rig_aurmaw.py with her names: 18 bones, five clips, baked springs, 1 mm ground headroom.
- Her motif is the `aura` part and per BETA M250 (Alex 11-28) it is ENERGY, not a solid prop: the look sets `glow.energy`, so the game draws it
  see-through + additive with no outline hull, and it CRACKLES (spirit-rig-body.ts glowAt: a strike every few twelfths of a second over a low
  flicker, opacity with it). The Blender renders here are opaque (workbench); the game is not.

| form | branch | dial | silhouette + motif | glb long | body verts |
|---|---|---|---|---|---|
| voltmerkor | Champion | 2.93 | massive khaki-bronze shell crowned with ice-crystal spikes + a rim of them, lightning off his flanks, pillar legs | 1.542 | 8649 |
| voltmeraya | Virtuoso | 2.44 | pale pearly shell, long raised neck, two faint arcs of lightning beside her | 1.569 | 8767 |
| voltvis | Ace, pure | 2.37 | low, deep blue shell with khaki seams, a lightning jet streaming off her tail | 1.623 | 8287 |
| voltmeth | Enigma | 2.58 | pale storm-blue shell with lightning forks, a storm cloud riding over her + a low cloud on her back, two bolts down | 1.532 | 8690 |

Dials = sheet 15b's (2.1 / 1.75 / 1.7 / 1.85) x 1.95 / 1.4, because M249 grew Voltmere 1.4 -> 1.95: same ratio to their parent as Aurmere's line.

## Rough / for Alex
1. Voltvis's jet is thin strands (the art: a broad burst of light); Voltmeraya's arcs float free beside her.
2. Voltmeth's cloud is sphere clusters; drawn additive in game it reads as a pale glow, not a dark thunderhead.
3. Voltmerkor's ice crystals share the aura part, so they are see-through too (crystal, not stone).
4. Player-facing text: none added (the names are the canon line, word for word).

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_voltaw.py <form> ../build/<form>.glb && $P rig_voltaw.py <form> ../build/<form>.glb ../build/<form>-rigged.glb ../<form>-metrics.json
/opt/blender/blender -b -P ../../m244-tidemere-2026-11-28/tools/render_tide.py -- <rigged.glb> ../build/fr/<form>-three.png idle:0.1 three <6.27/dial> 0.42   (and run:0.3 side -> -run)
ICON_DIR=../icons python3 sheet.py ../build/fr ; copy the rigged glbs + icons into public/open/spirits/
```
