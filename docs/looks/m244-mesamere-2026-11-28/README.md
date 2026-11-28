# M244 sheet 14: MESAMERE's four awakened forms (2026-11-28). OWNER PREVIEW only (owner gallery rows, see spirit-gallery.ts).
Canon spirits-species.md: **Mesamere (Earth):** **Mesathar** (Champion, pure) · Mesamelle · Mesamis · Mesamun.
Locked art = athernyx assets/stage3 049-052 (looked at, never traced, never in this repo). `line-sheet.jpg` = the live Mesamere (dial 1.5), then the
four at TRUE relative size (ortho 3.0 x 1.5 / dial), three-quarter idle over side run. Private side-by-side vs the locked art:
athernyx assets/stage3/sheets/m244-mesamere-awakened-vs-locked.jpg.

## Built off the live Mesamere, by name, on the Shellmere line's LEGGED rig (he walks; not Tidemere's glide rig)
- `tools/sculpt_mesaaw.py <form>` imports the live Mesamere sculpt (m202-shellmere-line tools/sculpt_mesamere.py, never edited) and re-shapes him by
  name: shell centre + radii (dome / rim / plastron follow), scute seats, slab depth, head centre HC + neck, LEGS, tail, moss lumps (smooth-unioned),
  colours. His motif is an `aura` part (unlit, it glows); each piece names its bone in `<form>-aura.json`. The free-piece helpers are sheet 11's
  (sculpt_tideaw.py), read and run by name.
- `tools/rig_mesaaw.py <form>` runs the base Shellmere's own rig (m174 rig_shellmere.py) with the line's rig_mere.py swaps (head / neck joints follow
  his HC; Mesamis's tail bone runs to her longer tail): 18 bones, the base's five clips. Quality standard (m244-quality-2026-11-28): aura on bones,
  baked springs (head after neck 0.05 rad, tail after shell 0.14 rad, fitted on the walk), 1 mm ground headroom (the root lifted).

| form | branch | dial | silhouette + motif | glb long | body top | body verts | aura tris |
|---|---|---|---|---|---|---|---|
| mesathar | Champion, pure | 2.1 | massive: a huge high shell of raised grey stone plates, deep seams, moss on the plates, pillar legs; amber cracks over his chest plate + down his fore legs | 1.638 | 0.995 | 6715 | 320 |
| mesamelle | Virtuoso | 1.75 | long neck carried high, rounder shell; every scute an opal panel (two pastel tones), marginals too | 1.572 | 0.880 | 8636 | 4096 |
| mesamis | Ace | 1.7 | the low runner: low golden dome ringed in moss, sturdy wide legs, a longer tail, golden dust behind her hind feet + specks off her back | 1.595 | 0.677 | 9475 | 1360 |
| mesamun | Enigma | 1.85 | nine amber crystal spires rising out of a moss cap, little pink flowers, dark scaly legs; no buildings | 1.534 | 0.801 (spires to 1.265) | 9347 | 1542 |

## Rough / for Alex
1. Mesathar's moss reads as small green flecks between the plates (the slabs bury most of each lump); his body is the lowest-poly of the four.
2. Mesamelle: one front marginal opal panel shows as a lavender band at the base of her neck; the opal is pastel panels, not a true sheen.
3. Mesamis keeps the line's smile (no open mouth rig); her dust rides her root (it walks with her, no particle trail).
4. Player-facing text: none added (the names are the canon line, word for word, already in the gallery).

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_mesaaw.py <form> ../build/<form>.glb && $P rig_mesaaw.py <form> ../build/<form>.glb ../build/<form>-rigged.glb ../<form>-metrics.json
/opt/blender/blender -b -P ../../m244-tidemere-2026-11-28/tools/render_tide.py -- <rigged.glb> ../build/fr/<form>-three.png idle:0.1 three <3.0*1.5/dial> 0.42   (and run:0.3 side -> -run)
ICON_DIR=<dir> python3 sheet.py ../build/fr      (line sheet + icons + the private vs-locked sheet); copy the rigged glbs + icons into public/open/spirits/
```
