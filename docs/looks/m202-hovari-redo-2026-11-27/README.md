# M202 Hovari line REDO: VOLTARI, LUMARI, OBSIDARI, TIDARI (2026-11-27)
Alex 11-26 21:4x on the first line sheet (docs/looks/m202-hovari-line-2026-11-26): "its still holding onto the hovari baby body lets try
to get them a bit bigger.. but still juvenile". Base Hovari (v2, approved 11-24) untouched. Owner preview only (`?form=storm|mana|earth|water`).

**`line-sheet.jpg`** is the one sheet: per form OLD at game distance | NEW at game distance | new front | side | rear | three-quarter | face,
then the whole line at TRUE relative size with no tint (base Hovari beside them): the OLD strip (dial 1.4), then the NEW strip (dial 1.5).

## What changed (all four, one shared pass: `tools/hov_common.py` `Grow`)
Each form keeps her own sculpt file (her art's body, crown piece, colours, pattern); `Grow` lays fledgling proportions over it:
- **head smaller for her body** (scaled about her head centre: 0.76, Obsidari 0.88 so she keeps the biggest head and the highest crown);
  the eyes shrink WITH the head, so they stay big for the head (still young);
- **longer trunk**: drawn out back to tail (x1.15-1.22) and down from the shoulders (x1.10), slimmer (x0.92-0.97); the legs and toes come
  down with it and are 1.25x thicker (heft, the Athowl lesson);
- **the full beak kept on the smaller head** (so it reads longer: grown);
- **wings 1.18x longer** from root (wrist out by its root), blades 6% broader; **tail feathers 1.32x longer** (spread by sqrt; Lumari's three
  lengthen without spreading: spread, her outer one closed a handle);
- **HOV_GLB_TALL is now her idle (hover) mean** (tools/idle-tall.mts); the prod check reads her once she hangs still (her drift pitched her forward and read 0.86-0.93 of it).
- **size dial 1.4 -> 1.5** (`FORM_GROW_BY`), so with the longer body she is clearly bigger than the old form, and far past the base.
The layered feather-tip rows are re-laid on the grown core (same rows per form). Obsidari's crown chips stand 0.03 taller.

## Still off the art / unverified (listed for Alex)
1. The juvenile/adult line is a judgement call: eyes stay big and the coat soft (young), the frame is grown. If still too young: smaller eyes
   and head (`sh`), not more body.
2. Same as the first line: Obsidari's flank stones read weakly; Lumari's pink wisp and Tidari's smoke/bubbles are effects (M204).
Player-facing text: none added.

## Rebuild
```
cd tools; uv run --no-project --with numpy,scipy,trimesh,networkx python sculpt_<form>.py ../<form>.glb
uv run --no-project --with numpy,scipy,trimesh,networkx python rig_hov.py <form> ../<form>.glb ../<form>-rigged.glb ../<form>-metrics.json
npx tsx docs/looks/m202-hovari-redo-2026-11-27/tools/three-check.mts <rigged glb>     (13/13 PASS x4)
LOOK_EM=r,g,b LOOK_HULL=r,g,b /opt/blender/blender -b -P look.py -- ../<form>.glb <prefix> 300
/opt/blender/blender -b -P lineup.py -- <prefix> 1400 460 <glb>:<m per unit> ... ;  python sheet.py <old dir> <new dir> ../line-sheet.jpg
```
`GROW_OFF=egg,tail,wing,legs` switches parts of the pass off (a handle probe: coarse euler per variant).
