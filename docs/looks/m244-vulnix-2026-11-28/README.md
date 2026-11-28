# M244 sheet 4: Vulnix's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named — Vulnyx › Vulnix (Water)' (Alex 11-27), art LOCKED-AFK athernyx 3501ec6
(assets/stage3/013-016, PRIVATE, read for shape + colour, never copied here). Gallery rows #063-#066, not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (Vulnix + the four at true relative size, three-quarter idle over run). The comparison against
the locked art is private: /root/athernyx/assets/stage3/sheets/m244-vulnix-awakened-vs-locked.jpg.

Kept on all four: Vulnix's teal water coat, cream chest, cyan crystal, the CYAN TEARDROP BROW GEM (sculpt_forms 'water' eyes). All four
are quadrupeds (the art is four-legged); Vulnix's own ears stay upright, the hanging ear is Marelle's alone (canon).
| form | rig | dial | what carries it |
|---|---|---|---|
| Vulnitar (Champion) | quadruped | 1.8 | dire-wolf build, dark teal, cyan crystal plates on shoulders + hip; a SPLASH RING round her feet: a wave ring + plumes curling over outward ('aura' on the 'cloud' bone, stays on the ground) |
| Marelle (Virtuoso, pure) | quadruped | 1.8 | slender; LONG HANGING JESTER EARS to the chest (own skin selector, springs target 0.30 rad so they swing); a big plume tail trailing into MIST puffs ('aura' on b_tail4) |
| Vulnisk (Ace) | quadruped | 1.8 | the wave-rider: long low racer, big upright ears, streaming brush; two WHOLE pale-aqua water copies that run behind her, drift back and shrink (echoes.py) |
| Vulnixeth (Enigma) | quadruped | 1.75 | still, a full chest ruff, ONE curled tail, short drips under the belly and down the legs; stands in a STILL POOL (a disc + two ripple rings, 'aura' on the 'cloud' bone) |

## The 11-28 quality standard (m244-quality-2026-11-28)
- (a) palette off the locked art (baked in `sculpt_awaken.py`, WATER palette). None of the four arts has a blaze, so nothing is projected.
- (c) baked ear + tail springs on every clip (`rig_quality.py`'s own jiggle(), run from its source). Marelle's ears are the showcase.
- Every crystal plate is its own piece riding RIGIDLY on the nearest body vertex (`sculpt_awaken.rigid_extras`).
- Ground, solved off the mesh in `tools/rig_q.py` (one constant per clip): Vulnisk's brush lifted 0.1 rad in the run (it dipped 65 mm;
  her copies get the same lift), Marelle's ears swung 0.5 rad out + up in the lie (78 mm under), the lie lifted 3.8-4.4 mm where the
  chest dipped, the ring / pool raised to 1 mm over the ground. Every clip's lowest body point now matches the shipped Vulnarc forms.

## Rebuild
```
cd ../m244-vulnara-2026-11-27/tools
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python sculpt_awaken.py <nitar|marelle|nisk|nixeth> ../../m244-vulnix-2026-11-28/<form>.glb
cd ../../m244-vulnix-2026-11-28/tools
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow python rig_q.py <form> ../<form>.glb <out>/<name>-rigged.glb ../<name>-metrics.json
python3 sheet.py <frames dir>      (frames: <name>-three-0.png / <name>-run-0.png from render_awake.py, ortho 2.6 x 1.8 / dial)
```
## Known (for Alex)
Vulnitar's snarl (open mouth) is not modelled; her crystal plates read dark under studio light and the splash plumes read more like
curled reeds than water from some angles. Vulnixeth's drips are small and her fluff is the ruff only (no all-over fur). Marelle's
ears are flat triangles + a lobe, not feathered. Player-facing text: none (gallery rows show canon names only).

## v2 (2026-11-28, hub on the v1 sheet): one PROP + one MOTIF line per form (sculpt_awaken.py)
| form | PROP | MOTIF | what changed |
|---|---|---|---|
| Vulnitar | chest 1.22, neck 1.25, fore 1.3, thigh 1.3, stance 1.15, paw 1.3, tail 1.1, muscle | splash 1.5 | heavier dire-wolf (shoulder + haunch mass, thick legs); the reed plumes replaced by a SPLASH CROWN: one thin flaring water wall whose rim breaks into 11 points, a drop thrown off each, a wave ring at its foot (out to 0.745 glb, v1 0.663). Dial 1.8 -> 1.95 (bigger) |
| Marelle | lean .9, fore .92, tail 1.12 | ear 1.35, mist 1.7 | the jester ears 35% longer with real volume: a lock thick at the root, swelling to a lobe, tapering to a soft point (no longer flat slabs); the mist trails back off the tail tip. Her ears swing clear of the ground in the run too (rig_q solve) |
| Vulnisk | lean .84, fore .9, thigh .92, head .95, tail 1.08 | ear 1.12 | the lean wave-rider; copies unchanged |
| Vulnixeth | tall 1.24, neck 1.15, tail 1.08 | pool 1.5, drip 2.2 | taller (longer legs, eyes 0.763 glb vs 0.655), ONE tail as before; the pool 1.5x wider + a third ripple; ten thicker streams pouring off chin, ruff, belly + legs, each ending in a drop |
Sheet: `v2-before-after.jpg` (tools/v2_sheet.py; private side-by-side athernyx assets/stage3/sheets/m244-vulnix-v2-vs-locked.jpg). rig_q.py writes
`silhouette` into each metrics json and lifts walk + run by any between-key deficit (+0.8 mm headroom). Still not modelled: Vulnitar's snarl
(open mouth); Marelle's ear root is still the parent's flat ear plate on top of the head.
