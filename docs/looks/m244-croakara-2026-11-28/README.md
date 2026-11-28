# M244 sheet 11: Croakara's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Croakara (Mana): **Croakgulp** (Champion; the 99-meals form) · Croakalys · Croakavis · **Araeth** (Enigma, pure)'.
Art LOCKED athernyx assets/stage3/033-036 (PRIVATE, read for shape + colour, never copied here). Owner gallery rows #091-#094 (after Croakarc's), not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (the live Croakara + the four, same glb scale, three-quarter idle over run; dials not applied). The comparison
against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-croakara-awakened-vs-locked.jpg.

Each is the LIVE Croakara's sculpt (m202-croakling-line tools/sculpt_croakara.py, imported, never edited) re-shaped by name.
| form | dial | rig | silhouette | motif (aura) |
|---|---|---|---|---|
| Croakgulp (Champion) | 2.0 | live Croakara frog rig | the heaviest: a huge round belly pushed forward, wide haunches, arms set wide round the belly, head riding high | a glowing gold swirl over her belly (flame lines + a spiral, skinned to it) |
| Croakalys (Virtuoso) | 1.85 | sheet 9's ground biped (rig_croakalys.py) | STANDS, both arms flung out wide and up, four fingers fanned, mouth open (painted maw + tongue), a tail lying out behind | streaks of song bursting out round her (chest) |
| Croakavis (Ace) | 1.8 | live Croakara frog rig | leaner, longer legs, big feet, bigger eyes | a pale ghost copy of her sat behind her, up to her right (root) |
| Araeth (Enigma, pure) | 1.75 | live Croakara frog rig | rounder, calm, bluer violet, fewer gold marks, a plain round globe lure with a brass cap | a copper Simmer pot + two corked potion bottles (pink, blue) hanging from the globe on fine chains (lure tip, swings with it) |

## Rebuild
```
cd docs/looks/m244-croakara-2026-11-28; P=/tmp/vulnyx-spike/venv/bin/python
$P tools/sculpt_croakaraw.py <gulp|avis|araeth> <out>.glb && $P tools/rig_croakaraw.py <form> <out>.glb <name>-rigged.glb <name>-metrics.json
$P tools/sculpt_croakalys.py alys.glb && $P tools/rig_croakalys.py alys.glb croakalys-rigged.glb croakalys-metrics.json
cp <name>-rigged.glb ../../../public/open/spirits/
/opt/blender/blender -b -P ../m244-croakarc-2026-11-28/tools/render_croak.py -- <rigged.glb> <dir>/<name>-three.png idle:0 three 2.3 .62   (run:.3 -> -run.png)
python3 tools/sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
- Croakgulp's body is 15k verts (the standard is ~9k): her belly + arms carry three tiny tunnels the closed decimation will not pass below ~12k tris.
- Croakavis does not leap: she sits like her sisters (the frog rig's run is long bounds); the ghost carries her read. The ghost is opaque pale lilac (no see-through).
- Croakalys's open mouth is painted (maw + tongue), not a jaw. Her song streaks are rigid on the chest bone.
- Bowls / the bone round Croakgulp in the art are not modelled (they would hop with her).
- Player-facing text: none (gallery rows show canon names only).
