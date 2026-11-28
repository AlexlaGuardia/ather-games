# M244 sheet 7: Luminore's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' ('Luminore (Earth): Orebrak (Champion, pure) · Lumoraya · Lumorvex · Lumorun')
+ 'Luminore and Luminix lose their flight': the second form is the waiting egg, **the awakening is the break-out**. Art LOCKED athernyx
assets/stage3/029-032 (PRIVATE, read for shape + colour, never copied here). Gallery rows #075-#078, not in PUBLIC_FORMS. `line-sheet.jpg` =
OUR renders only (the Luminore egg + the four at true relative size, three-quarter idle over run). Private comparison against the locked art:
/root/athernyx/assets/stage3/sheets/m244-luminore-awakened-vs-locked.jpg.

Built like sheets 5 + 6 but GROUNDED: each is the LIVE Luminore egg's sculpt (m202-luminara-line tools/sculpt_luminore.py, imported, never
edited: warm brown stone, amber eyes, the amber crystal crown packed in moss, the amber belly lamp) re-shaped by name in `tools/sculpt_lumore.py`
into what broke out of the shell: up on two thick LEGS with two ARMS and fists, taller (body_mean_top ~1.19 vs the egg's 0.94 glb), the plate
seams + hatch line gone. Rigged by `tools/rig_lumore.py`, a ground BIPED rig grown from the egg's rig_lum_ground.py: 16 bones + one motif bone
per motif carrier (leg / shin + arm / farm a side), the HIPS carry her height (solved every frame so her lowest point sits on the ground), the
ROOT never moves, so the broken shell (aura, on the root) lies still at her feet. In the lie her motif bones scale to 0.02 (it folds away while
she sleeps; Lumorun's crack stays). Glow = her own body: no lantern, no sigil, no coins, no lure.
| form | dial | silhouette | motif (aura) |
|---|---|---|---|
| Orebrak (Champion, pure) | 1.8 | broad brute: thick arms, big fists, wide stance, fanged roar, angry brows, amber crystals down her back + on her shoulders | amber shell shards hanging round her (chest) + two on the ground, PRISM light fanning out of her chest (6 bands, abd), the two shell halves at her feet |
| Lumoraya (Virtuoso) | 1.75 | arms flung up and out, wide open smile | the two shell halves glowing at her feet + a sunburst of 13 rays behind her (chest) |
| Lumorvex (Ace) | 1.75 | leaner, longer legs, leaned in, a startled O mouth | a BEAM of light out of her mouth with a spiked flare (head) + 7 shell shards flying behind (chest); no halves (she burst away) |
| Lumorun (Enigma) | 1.75 | eyes CLOSED (lash arcs, no open eye drawn), head bowed, a flat quiet mouth, arms hanging still | a glowing CRACK down her chest over the lamp, with three branches (abd), the two shell halves at her feet |

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_lumore.py <form> ../<form>.glb && $P rig_lumore.py <form>; cp ../<form>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P render_lum.py -- <rigged.glb> <dir>/<form>-three.png idle:0 three <4.2/dial> <1.05/dial>   (run:.3 -> -run.png)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
Shards / prism / rays / beam are rigid on their bones (no flicker); the shell halves ride the root, so they travel with her when she walks
(they are not left behind in the world); the run stretches Lumorun's hips a little (edge p99 3.3); fists are round mitts (no fingers);
Orebrak's prism bands read rainbow-flat in the workbench render. Player-facing text: none (gallery rows show canon names only).
