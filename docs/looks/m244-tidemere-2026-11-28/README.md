# M244 sheet 11: TIDEMERE's four awakened forms (2026-11-28). OWNER PREVIEW only (owner gallery rows, see spirit-gallery.ts).
Canon spirits-species.md: **Tidemere (Water):** Tidemok · **Tidessa** (Virtuoso, pure) · Tidemerk · Tidemyr, and *the Tidemere line carries its
own water*: the four keep their flippers and glide on a thin sheet of water that travels under them, leaving a wet trail that dries.
Locked art = athernyx assets/stage3 061-064 (looked at, never traced, never in this repo). `line-sheet.jpg` = the live Tidemere (dial 1.4) then
the four at TRUE relative size, three-quarter idle over side run. Private side-by-side vs the locked art: athernyx assets/stage3/sheets/m244-tidemere-awakened-vs-locked.jpg.

## Built off the live Tidemere, by name, on HER glide rig
- `tools/sculpt_tideaw.py <form>` imports the live Tidemere sculpt (m202-shellmere-line tools/sculpt_tidemere.py, never edited) and re-shapes her
  by name: shell centre + radii (dome / rim / plastron follow), head + neck, the flipper chains FORE / HIND, colours, shell marks. Her motif is an
  `aura` part (unlit, it glows); each piece names its bone in `<form>-aura.json`.
- `tools/rig_tideaw.py <form>` runs Tidemere's own glide rig (m202-tidemere-glide tools/rig_tidemere.py) with only its paths swapped and the
  fore / hind flipper split made by nearest chain (a swept-back fore-flipper stays fore): 14 bones, NO legs, the plastron riding 0.03 glb over
  her ground in every clip (0.016 in sit / lie), so the game's water sheet + wet trail (spirit-water.ts WATER_FORMS) draw under her as under
  Tidemere. Quality standard (m244-quality-2026-11-28): baked springs (each blade flexes after its flipper, the head nods after the neck; a blade
  spring is halved on any frame it would dip under the fin floor), aura on bones, ground headroom.

| form | branch | dial | silhouette + motif | glb long | body top | body verts | aura tris |
|---|---|---|---|---|---|---|---|
| tidemok | Champion | 1.9 | heaviest: a big high dome, heavy head, broad flippers; six BIG crystal spikes down the ridge, a costal row + lip spikes | 1.668 | 0.636 (spikes to 0.95) | 8537 | 336 |
| tidessa | Virtuoso, pure | 1.75 | slender, neck up: a branching coral crown (head bone), a pearl necklace (neck bone), pearls heaped on her back + nine floating round her | 1.523 | 0.581 | 8419 | 9290 |
| tidemerk | Ace | 1.8 | lean and fast: long low narrow shell, head carried out front, long swept-back fore-flippers, speed lines, water peeling off her sides | 1.814 | 0.474 | 8242 | 648 |
| tidemyr | Enigma | 1.85 | a little reef on her back (rocks, branching coral, weed) and a waterfall curtain pouring off the back of her shell onto her sheet | 1.624 | 0.517 | 7532 | 8868 |

## Rough / for Alex
1. Tidemerk's art has an open happy mouth; ours keeps Tidemere's smile (no mouth rig). Her read is the long low body + swept flippers + spray.
2. Tidessa's pearls and Tidemyr's waterfall are rigid (on the shell bone): no flow animation; the waterfall reads as pale ribbons.
3. Tidemok's spikes are pale-aqua crystal cones; the art's mottled green shell plates are one flat colour here.
4. Player-facing text: none added (the names are the canon line, word for word, already in the gallery).

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_tideaw.py <form> ../<form>.glb && $P rig_tideaw.py <form> ../<form>.glb <out>/<form>-rigged.glb ../<form>-metrics.json
/opt/blender/blender -b -P render_tide.py -- <rigged.glb> <frames>/<form>-three.png idle:0.1 three <3.4*1.4/dial> 0.32   (and run:0.3 side -> -run)
python3 sheet.py <frames>      (line sheet + icons into public/open/spirits + the private vs-locked sheet)
```

## Wiring (NOT landed: copying into public/ was refused by this agent's permission classifier, the same block assets-voltowl hit)
- `public-staged/` = the four `<form>-rigged.glb` + `<form>-icon.png` for `public/open/spirits/` (sizes = the metrics' glb_bytes).
- `wiring.patch` = the game hunks, made on top of Voltowl's uncommitted hunks (it assumes Voltowl = #091-#094, Tidemere = #095-#098, gallery 98,
  roster 48): AWAKENED_NAMES.tidemere, the gallery AWAKENED concat ['turtle','water',b] + test block, TIDE_AW_DIAL / tideAw / TIDE_AWAKENED in
  spirit-models.ts, WATER_FORMS += the four (their sheet + trail), the awakened test name list, the m244-awakened-check glide-rig block (glide
  bones, no legs, water sheet drawn, plastron 8-60 mm up in every clip). If Voltowl does not land first, renumber to #091-#094 / 94 / 44.
- `spirit-tideaw.test.ts` -> `src/app/shimmer/open/ather/` (canon line word for word, glide rig read out of the glb, plastron rides the sheet,
  flippers over the fin floor, springs, silhouette asserts). Ran green on everything except the four public/ files it needs.
