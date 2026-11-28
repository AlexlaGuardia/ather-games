# M244 sheet 15: AURMERE's four awakened forms (2026-11-28). OWNER PREVIEW only (owner gallery rows, see spirit-gallery.ts).
Canon spirits-species.md: **Aurmere (Mana):** Aurmerok · Aurmelys · Aurmevex · **Aurhael** (Enigma, pure).
Locked art = athernyx assets/stage3 057-060 (looked at, never traced, never in this repo). `line-sheet.jpg` = the live Aurmere (dial 1.4), then the
four at TRUE relative size (ortho 3.0 x 1.5 / dial), three-quarter idle over side run. Private side-by-side vs the locked art:
athernyx assets/stage3/sheets/m244-aurmere-awakened-vs-locked.jpg.

## Built off the live Aurmere, by name, on the Shellmere line's LEGGED rig (sheet 14's route, Mesamere)
- `tools/sculpt_aurmaw.py <form>` imports the live Aurmere sculpt (m202-shellmere-line tools/sculpt_aurmere.py, never edited) and re-shapes her by
  name, as sheet 14's sculpt_mesaaw.py: shell centre + radii, scute seats, slab depth, head centre HC + neck, LEGS, antennae (moved with her head;
  dropped on Aurmerok + Aurmelys, whose art has none), moss lumps, leg scale seams, colours. Her motif is an `aura` part (unlit, it glows); each
  piece names its bone in `<form>-aura.json`. Marks are pattern only (rings, dots, seams): no glyphs or text.
- `tools/rig_aurmaw.py <form>` = sheet 14's rig_mesaaw.py with her names: the base Shellmere rig, 18 bones, five clips, baked springs (head 0.05 /
  tail 0.14 rad on the walk), 1 mm ground headroom.

| form | branch | dial | silhouette + motif | glb long | body top | body verts | aura tris |
|---|---|---|---|---|---|---|---|
| aurmerok | Champion | 2.1 | massive: broad high GOLD shell, violet scaly pillar legs, gold leg bands; a plain gold sun disc (rims + edge dots) standing behind him | 1.543 | 0.911 | 8735 | 3220 |
| aurmelys | Virtuoso | 1.75 | lavender shell with gold seams, pale blue skin, gold rings on all four legs, three gold sound rings swirling round her + a spiral over her | 1.464 | 0.779 | 8738 | 4000 |
| aurmevex | Ace | 1.7 | the low one: deep violet shell with gold dots, amber plastron, head out front, long lit antennae, a gold ring round her body + gold specks | 1.595 | 0.680 | 8641 | 4428 |
| aurhael | Enigma, pure | 1.85 | violet shell, big gold dots + gold seams, moss cap with a crown of gold spires, a gold halo over it, long antennae, gold claws | 1.522 | 0.813 | 9167 | 3336 |

## Rough / for Alex
1. Aurmerok: the art's disc is a glowing sun behind him; ours is a flat gold disc on his shell bone (it walks with him, faces back). It reads as a shield from the side.
2. Aurmelys: the art has her ring as soft light trails; ours are thin solid gold ribbons. Aurmevex's ring is a solid tube (the art: a glowing hoop).
3. The line keeps its smile (no open mouth rig); Aurhael's moss cap has two small tunnels (euler -2), accepted by the line's decimate.
4. Player-facing text: none added (the names are the canon line, word for word, already in the gallery).

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_aurmaw.py <form> ../build/<form>.glb && $P rig_aurmaw.py <form> ../build/<form>.glb ../build/<form>-rigged.glb ../<form>-metrics.json
/opt/blender/blender -b -P ../../m244-tidemere-2026-11-28/tools/render_tide.py -- <rigged.glb> ../build/fr/<form>-three.png idle:0.1 three <3.0*1.5/dial> 0.42   (and run:0.3 side -> -run)
ICON_DIR=<dir> python3 sheet.py ../build/fr      (line sheet + icons + the private vs-locked sheet); copy the rigged glbs + icons into public/open/spirits/
```
