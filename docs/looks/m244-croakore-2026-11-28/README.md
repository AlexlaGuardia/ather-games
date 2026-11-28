# M244 sheet 12: Croakore's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Croakore (Earth): **Oregrak** (Champion, pure) · Croakorelle · Croakoris · Croakormyr'.
Art LOCKED athernyx assets/stage3/037-040 (PRIVATE, read for shape + colour, never copied here). Owner gallery rows #095-#098 (after Croakara's), not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (the live Croakore + the four, same glb scale, three-quarter idle over run; dials not applied). The comparison
against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-croakore-awakened-vs-locked.jpg.

Each is the LIVE Croakore's sculpt (m202-croakling-line tools/sculpt_croakore.py, imported, never edited) re-shaped by name; all four sit on the
live Croakore frog rig (the base Croakling's 19 bones + five clips) + one GROUND bone (posed every frame to undo the root's lean + hop, so what lies
on the ground stays flat on it) + baked lure springs.
| form | dial | silhouette | motif (aura) |
|---|---|---|---|
| Oregrak (Champion, pure Earth) | 2.1 | broadest + tallest, heavy closed fists, ROCK SHOULDER ARMOUR (two stacked stone plates each shoulder + a stone cuff each forearm, in her body, grey) | glowing cracks in the ground round her (ground bone) |
| Croakorelle (Virtuoso) | 1.95 | an olive coat | she SINGS: a great faceted amber crystal ball where her throat-sac is (rigid on the throat bone, swells on the croak) + amber crystals rising from the ground (ground bone) |
| Croakoris (Ace) | 1.9 | lean, long legs, big feet, arms flung wide, fingers spread | the burrow she springs from: a ring of clods + a spray of earth streaks bursting up behind her (ground bone) |
| Croakormyr (Enigma) | 1.85 | rounder, hushed: pale gold coat, moss only on the crown, big dark round eyes, no brow ridge | an amber crystal crust over her back, crown to rump (skinned to her) |

## Rebuild
```
cd docs/looks/m244-croakore-2026-11-28; mkdir -p work/fr; cd work; P=/tmp/vulnyx-spike/venv/bin/python
$P ../tools/sculpt_croakorew.py <form> <form>.glb && $P ../tools/rig_croakorew.py <form> <form>.glb <form>-rigged.glb <form>-metrics.json
/opt/blender/blender -b -P ../../m244-croakarc-2026-11-28/tools/render_croak.py -- <form>-rigged.glb fr/<form>-three.png idle:0 three 2.3 .62   (run:.3 -> fr/<form>-run.png)
ICON_DIR=<dir> python3 ../tools/sheet.py fr      (line sheet + the 160 px icons + the private vs-locked sheet)
cp <form>-rigged.glb <form>-metrics.json ...   (glbs + icons -> public/open/spirits, metrics -> this folder)
```
## Known (for Alex)
- Croakoris does not leap: the frog rig sits; her sprawled arms + the burrow spray carry the read (same call as Croakavis).
- Croakorelle's mouth stays closed (the art sings open-mouthed); the ball carries the song.
- The ground motifs (cracks, crystals, burrow) travel with her as she hops (they sit under her, flat, on the ground bone).
- Oregrak's shoulder plates are weighted with her arms, so they swing a little in the hop. Glow colours are whole-part (the aura pulses amber).
- Player-facing text: none (gallery rows show canon names only).
