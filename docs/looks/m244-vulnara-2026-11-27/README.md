# M244 sheet 1: Vulnara's four AWAKENED forms (2026-11-27, OWNER PREVIEW)
Canon RULED Magii 8c0dd01 (CANON/world/spirits-species.md, Awakened Form: Vulnarok Champion / Vulnalys Virtuoso / Vulnavex Ace /
Vulnamyr Enigma). Built off the locked stage-3 art (athernyx assets/stage3/001-004, PRIVATE, never copied here) and the stage-3
ledger motifs. `line-sheet.jpg` = OUR renders only (Vulnara + the four at true relative size). The comparison against the locked
art is private: /root/athernyx/assets/stage3/sheets/m244-vulnara-awakened-vs-locked.jpg.

Kept on all four: violet crystal facets (low four-sided plates on shoulders / flanks / haunches), the brow gem, violet eyes, gold.
Marks are infusion pattern only (flowing lines, chevrons), no rune or sigil (Vulnara's rune rings are NOT carried).
| form | dial (x Vulnyx) | what carries it |
|---|---|---|
| Vulnarok | 1.8 | trunk pitched up off crouched haunches, heavy shoulders + long forearms with claws, gold chest blaze + forearm flow lines; 4 gold self-echoes behind her |
| Vulnalys | 1.7 | leggiest, head carried high, big gold throat-ruff of points, plume curled over her back; 2 violet spirals beside her head (head-borne) |
| Vulnavex | 1.65 | long low racer, ears laid back, straight streaming brush, smaller gold ruff, speed lines; 2 whole gold copies behind / to one side |
| Vulnamyr | 1.75 | deep chest, violet crystal chest-gem, gold chevrons on legs + shoulders, NINE crystal tails fanned, gold crown-halo (head-borne) |
Vulnara is 1.4. The echoes / spirals / halo are the glb's `aura` part, drawn as the look's glow part (toon + pulsing emissive).

## Off the art / known (for Alex)
1. Vulnarok is a KNUCKLE stance (chest high on long forearms), not a true biped: the quadruped rig keeps her walking. A real upright
   biped needs its own rig plan.
2. The echoes / copies are static gold statues of her rest pose that move with her; Vulnavex's copies do not run.
3. Vulnamyr was meshed coarser (marching 0.012: the nine tails meeting at her rump would not decimate closed finer); her sit pitches
   the fan 0.32 m into the ground (the game's ground keep lifts her). Vulnarok's low brush grazes 27 mm on the run.
Player-facing text: none (gallery rows show canon names only).

## Rebuild
```
cd tools; uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python sculpt_awaken.py <rok|lys|vex|myr> ../vulna<form>.glb   (myr: AW_H=.012)
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_awaken.py <form> ../vulna<form>.glb ../vulna<form>-rigged.glb ../vulna<form>-metrics.json
npx tsx docs/looks/m202-vulnara-v2-2026-11-26/tools/three-check.mts <rigged glb> <dial>     (lys 11/11; rok run, vex sit -3 mm, myr sit: see above)
```
