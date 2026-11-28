# M202 the Lepara line: LEPAURA, LEPARC, LEPORE, LEPNIX (2026-11-28). OWNER PREVIEW only (`?form=mana|storm|earth|water`).
**`line-sheet.jpg`** is the one sheet: per form front | three-quarter | side | face | phone 390x844 at 4.8 m, then the base Lepara + the four
forms at TRUE relative size (side, three-quarter). Ref-free (repo is public); locked art = athernyx assets/stage2 034 / 032 / 006 / 033;
the private side-by-side is athernyx `assets/stage2/sheets/m202-lepara-line-vs-locked.jpg`.

## Built off the base, by name
Every form = the base Lepara's sculpt module (`m174-lepara-snout-2026-11-27/tools/sculpt_lepara.py`, loaded fresh, never edited) re-shaped
in `tools/sculpt_<form>.py` (`tools/lep_common.py`), and the base's rig (`rig_lepara.py`, read and run by `tools/rig_lep.py`): 20 bones,
the base's five clips. In game: `spirit-models.ts` `lepForm` builds off `BASE_PREVIEW.rabbit`; `LEP_GLB_TALL` = each body's idle mean height.
- **Lepaura** (Mana, the ledger's moon-hare): taller, long chest, plume tail, gold crescent on the brow, gold necklace + diamond,
  gold infusion ribbons (pattern only, Magii 0d6d577), lilac coat, blue eyes. Dial 1.4.
- **Leparc** (Storm): silver-blue, cheek tufts + ear-tip tufts, violet brow crystal, pale lightning veins, puff tail. 1.4.
- **Lepore** (Earth, her natural form): the heaviest: barrel belly, leaf-stone pauldrons + forearm bracers (gold rim), amber brow +
  chest crystals, dark ear tips, vines. **1.5**.
- **Lepnix** (Water, the ledger's UNICORN divergence): an aqua foal STANDING on four slim legs with hooves, horn, water-mane + forelock,
  plume tail, bubble rings, cyan chest drop; the base head + face kept. Same 20 bones, her joints moved onto the foal body (`rig_lep.py` FOAL).

## Numbers
| form | tris body+eyes | LEP_GLB_TALL | glbLen (nose to tail) |
|---|---|---|---|
| lepaura | 13742+914 | 1.042 | 0.832 |
| leparc | 13846+914 | 1.096 | 0.759 |
| lepore | 13702+914 | 0.976 | 0.762 |
| lepnix | 12998+914 | 0.895 | 0.947 |
`tools/three-check.mts <form>`: lepaura 14/14, leparc 14/14, lepore 13/14 (idle>run blend sinks 3.7 mm), lepnix 13/14 (blends into lie sink 3.5 mm).

## Rough / for Alex
1. Lepnix rides the RABBIT clips on foal joints: walk/run are hops (run leg reach 2.7x, stretch p99 3.8), sit raises both forelegs to
   groom, lie keeps her standing low. She wants her own quadruped rig (a trot) next.
2. Leparc's lightning veins barely read (vertex-colour cut, pale on pale). Lepore's pauldrons read as green arm patches more than plates.
3. Lepaura's diamond haunch marks in the art are left out on purpose (glyph-like; markings are pattern only). Stars/moon glow = effects.
Player-facing text: none added.

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_<form>.py ../<form>.glb && $P rig_lep.py <form>; cp ../<form>-rigged.glb public/open/spirits/
npx tsx docs/looks/m202-lepara-line-2026-11-27/tools/three-check.mts <form>
LOOK_H=0.48 blender -b -P look.py -- ../<form>.glb <dir>/<form> 300; blender -b -P lineup.py -- <dir>/lineup_side.png 1.5708 (and -0.6 -> lineup_tq.png)
$P sheet.py <dir> ../line-sheet.jpg
```
