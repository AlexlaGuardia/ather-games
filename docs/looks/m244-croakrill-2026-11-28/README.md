# M244 sheet 12: Croakrill's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Croakrill (Water): Croakrillok · **Rillesse** (Virtuoso, pure) · Croakrillvex · Croakrilleth'.
Art LOCKED athernyx assets/stage3/041-044 (PRIVATE, read for shape + colour, never copied here). Owner gallery rows, not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (the live Croakrill + the four, same glb scale, three-quarter idle over run; dials not applied). The comparison
against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-croakrill-awakened-vs-locked.jpg.

Each is the LIVE Croakrill's sculpt (m202-croakling-line tools/sculpt_croakrill.py, imported, never edited) re-shaped by name; her gill
fronds move with her head (lift() shifts their ribbons too).
| form | dial | rig | silhouette | motif (aura) |
|---|---|---|---|---|
| Croakrillok (Champion) | 2.0 | live Croakrill frog rig | the biggest: broad heavy chest + belly, arms set wide, head shoved up + forward, mouth OPEN (painted maw + tongue) with two rows of white teeth (eyes part) | a jet of water spat from her mouth, breaking into spray (skinned to her face) |
| Rillesse (Virtuoso, pure) | 1.85 | sheet 9's ground biped (Croakalys's rig + clips) | STANDS, a dancer: both arms raised up and out, fingers fanned, legs in a plie on long webbed toes, fewer spots | the lily pad she stands on + two pink water lilies (root), drops flung off her raised hands (chest) |
| Croakrillvex (Ace) | 1.8 | live Croakrill frog rig | lean and long, head low and forward, long legs + big webbed feet, a small fin on her back, deeper blue-teal, many spots | a wake of water streaming back off her sides + bubbles (rides her hips) |
| Croakrilleth (Enigma) | 1.75 | live Croakrill frog rig | rounder, calm, fewer spots | a small rain cloud over her lure, raining (root: it keeps its height while she hops) |

## Numbers
| form | body tris / verts | eyes | aura | glbLen | hRig (m/u) | walk / run v_glb |
|---|---|---|---|---|---|---|
| croakrillok | 14092 / 9575 | 2520 | 2592 | 0.925 | 0.3588 | 0.55 / 2.4 m/s at hRig |
| rillesse | 12862 / 8978 | 2408 | 4070 | 0.83 | - | 0.7813 / 1.8294 |
| croakrillvex | 13224 / 9329 | 2408 | 1648 | 1.011 | 0.3866 | 0.55 / 2.4 m/s at hRig |
| croakrilleth | 12958 / 8652 | 2408 | 2572 | 0.959 | 0.3722 | 0.55 / 2.4 m/s at hRig |

## Rebuild
```
cd docs/looks/m244-croakrill-2026-11-28; P=/tmp/vulnyx-spike/venv/bin/python
$P tools/sculpt_croakrillaw.py <ok|vex|eth> build/<f>.glb && $P tools/rig_croakrillaw.py <f> build/<f>.glb build/<name>-rigged.glb build/<name>-metrics.json
$P tools/sculpt_rillesse.py build/rillesse.glb && $P tools/rig_rillesse.py build/rillesse.glb build/rillesse-rigged.glb build/rillesse-metrics.json
/opt/blender/blender -b -P ../m244-croakarc-2026-11-28/tools/render_croak.py -- <rigged.glb> build/fr/<name>-three.png idle:0 three 2.3 .62   (run:.3 -> -run.png)
ICON_DIR=public-staged python3 tools/sheet.py build/fr      (line sheet + the 160 px icons + the private vs-locked sheet); cp public-staged/* ../../../public/open/spirits/
```
rig_croakrillaw.py runs sheet 11's rig_croakaraw.py and rig_rillesse.py runs rig_croakalys.py (both read + exec'd with the sculpt module
swapped, never edited); both add `body_verts` to the metrics.

## Known (for Alex)
- Croakrillok is 9.6k body verts (the open maw + teeth refine the face); the rest are under 9.4k.
- Croakrillvex does not swim: she sits and hops like her sisters (the frog rig); her fin, long webbed feet and wake carry the read. The wake is thin.
- Rillesse's lily pad rides her root, so it walks with her (a dancing-on-a-pad read in idle; odd in a walk). Her tail is a small stub (the biped needs four tail bones).
- Croakrillok's jet is rigid on her face (no stream animation); Croakrilleth's rain is still drops (no fall animation).
- Player-facing text: none (gallery rows show canon names only).
