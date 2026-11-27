# M202 the Shellmere line: MESAMERE, AURMERE, VOLTMERE, TIDEMERE (2026-11-27). OWNER PREVIEW only (`?form=earth|mana|storm|water`).
**`line-sheet.jpg`** is the one sheet: per form front | three-quarter | side | face | phone 390x844 at 4.8 m, then the base Shellmere + the
four forms at TRUE relative size (side, three-quarter). Ref-free (repo is public); locked art = athernyx assets/stage2 007 / 020 / 021 / 022.

## Built off the base, by name (base Shellmere OK'd, public since M226)
Every form = the base's own sculpt module (`m174-shellmere-2026-11-27/tools/sculpt_shellmere.py`, loaded fresh, never edited) re-shaped in
`tools/sculpt_<form>.py` (dome SC/SR, head HC, LEGS, field terms, colours, eye palette, the shell marks = `runes()` by name), and the base's own
rig (`rig_shellmere.py`, read and run by `tools/rig_mere.py`, head joints follow her head): 18 bones, the base's five clips. Change the base,
rebuild the four. In game: `spirit-models.ts` `shellForm` builds off `BASE_PREVIEW.turtle`; NOT in spirit-public PUBLIC_FORMS.
- **Mesamere** (Earth, his natural form): great stone tortoise, the tallest dome (deep seams, bulging slabs), moss lumps on the lip, amber crown crystal, pillar legs with plate seams, no antennae. **Dial 1.5**.
- **Aurmere** (Mana): high round violet dome, the base's canon rune rings on every scute + marginals + a ring on each foreleg (rings only, no glyphs), longer antennae, gold bulbs. 1.4.
- **Voltmere** (Storm): wide low blocky pale-blue shell of raised slabs, white lightning forks (unlit strips, not colour cuts), knobbly legs, long claws, no antennae. 1.4.
- **Tidemere** (Water): a SEA TURTLE: long low teardrop shell, flippers (rigged on the leg/foot bones, blade tips planted), swirl carvings, spotted flippers, longer neck. 1.4.

## Numbers
| form | tris body+unlit | glbLen | SHELL_GLB_TALL (body idle mean) | stands (m) | stretch p99 run |
|---|---|---|---|---|---|
| mesamere | 18.9k+1.1k | 1.42 | 0.869 | 0.60 | 1.58 |
| aurmere | 15.3k+4.2k | 1.317 | 0.799 | 0.52 (+antennae) | 1.52 |
| voltmere | 14.0k+1.5k | 1.353 | 0.716 | 0.47 | 1.55 |
| tidemere | 13.5k+1.9k | 1.612 | 0.581 | 0.38, 0.75 m long | 1.54 |
`tools/three-check.mts <form> <glbLen>` 14/14 PASS x4.

## Rough / for Alex
1. Voltmere is the closest to the base in outline (wider, lower, blockier); her read is the lightning + slabs. Push further if she reads as a recolour.
2. Mesamere's moss reads as a ring of lumps; Mesamere carries a small surface tunnel (euler -4, closed, one piece; invisible at game distance).
3. Glows/sparkles/crown-light/bubbles in the art = effects (M204). Player-facing text: none added.

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_<form>.py ../<form>.glb && $P rig_mere.py <form>; cp ../<form>-rigged.glb public/open/spirits/
npx tsx docs/looks/m202-shellmere-line-2026-11-27/tools/three-check.mts <form> <glbLen>
LOOK_H=<0.464 x dial> blender -b -P look.py -- ../<form>.glb <dir>/<form> 300; blender -b -P lineup.py -- <dir>/lineup_side.png 1.5708 (and -0.6 -> lineup_tq.png)
$P sheet.py <dir> ../line-sheet.jpg
```
