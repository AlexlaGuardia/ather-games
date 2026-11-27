# M202 the Croakling line: CROAKRILL, CROAKARA, CROAKORE, CROAKARC (2026-11-27). OWNER PREVIEW only (`?form=water|mana|earth|storm`).
**`line-sheet.jpg`** is the one sheet: per form front | three-quarter | side | face | phone 390x844 at 4.8 m, then the OLD base Croakling + the
four forms at TRUE relative size (side, three-quarter). Ref-free (repo is public); locked art = athernyx assets/stage2 008 / 026 / 027 / 028.

## Built off the base, by name (the base M174 is not OK'd yet)
Every form = the base Croakling's own sculpt module (`m174-croakling-2026-11-27/tools/sculpt_croakling.py`, loaded fresh, never edited)
re-shaped in `tools/sculpt_<form>.py` (landmarks, colours, eye palette, extra field terms, colour classes), and the base's own rig
(`rig_croakling.py`, read and run by `tools/rig_croak.py`) fitted to her landmarks: 19 bones, the base's five clips. Change the base, rebuild
the four, and they follow it. In game: `spirit-models.ts` `croakForm` builds off `BASE_PREVIEW.frog` (the base is not in SPIRIT_RIGS yet).
- **Croakrill** (Water): taller, upright, gill fronds (3 a side), long webbed toes, dark teal spots, mint over lime, cyan orb. Dial 1.4.
- **Croakara** (Mana): wide squat on splayed legs, huge lilac-ringed eyes, GOLD flowing ribbons (infusion markings, pattern only: Magii 0d6d577), violet bud orb. 1.4.
- **Croakore** (Earth): a toad, the heaviest: barrel body, brow ridges, ~70 warts, moss on crown + shoulders, slit-pupilled orange eyes, amber orb. **1.5**.
- **Croakarc** (Storm): a SKINK, NO LURE (grimoire-ledger divergence_note), long tail curling up, pointed crest, dorsal spines, pale veins, violet brow gem. 1.4.
  Her tail rides the base's three lure bones (re-seated along it, parented to the hips; the clips' lure motion becomes a swish / lift / whip).

## Numbers
| form | tris body+unlit | glbLen | hRig (m/u) | CROAK_GLB_TALL (body idle mean) | stretch p99 run |
|---|---|---|---|---|---|
| croakrill | 14960+2408 | 0.896 | 0.3793 | 0.854 | 4.04 |
| croakara | 15774+2408 | 0.769 | 0.4020 | 0.794 | 4.50 |
| croakore | 14320+2328 | 0.846 | 0.4160 | 0.776 | 3.94 |
| croakarc | 16652+1104 | 1.351 | 0.4398 | 0.908 | 4.53 |
`tools/three-check.mts <form> <hRig> <glbLen>` 17/17 PASS x4 (lure / tail bones move in idle, all clips through the game's makeRigBody, no blend sinks a foot, cadence cap).

## Rough / for Alex
1. Croakrill's fronds read stiff (spider-leg-ish) from the side; the art's are wispy. Croakrill + Croakara surfaces carry a small tunnel each
   (fronds / splayed toes touching: euler -2 / -8, closed and one piece; invisible at game distance).
2. Croakarc's veins read as pale patches, not lightning forks (a vertex-colour cut on a 9k mesh); her skink body still sits frog-upright.
3. Croakore's heavy half-lid is a slit pupil + brow ridge, not a lid over the eye. Bubbles / sparks around the art = effects (M204).
Player-facing text: none added.

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_<form>.py ../<form>.glb && $P rig_croak.py <form>; cp ../<form>-rigged.glb public/open/spirits/
npx tsx docs/looks/m202-croakling-line-2026-11-27/tools/three-check.mts <form> <hRig> <glbLen>
LOOK_H=<0.4004 x dial> blender -b -P look.py -- ../<form>.glb <dir>/<form> 300; blender -b -P lineup.py -- <dir>/lineup_side.png 1.5708 (and -0.6 -> lineup_tq.png)
$P sheet.py <dir> ../line-sheet.jpg
```
