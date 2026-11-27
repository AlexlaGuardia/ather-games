# M202 Croakling line, PASS 2 (Alex 11-27): Croakrill + Croakarc. OWNER PREVIEW. Croakara + Croakore unchanged.
**`sheet.jpg`**: old vs new (side, three-quarter), Croakarc's rig (sprawl walk from above, scurry, idle, sit, lie), true size beside the base.

- **Croakarc** (Storm, a SKINK per the grimoire-ledger, no lure): leaves the frog sculpt + rig. Her own body (`tools/sculpt_croakarc.py`,
  the Marlotl salamander route in the croak unit space): long low trunk slung between splayed legs, belly ~4 cm off the ground, head
  forward, long tail curling up at its end, pointed crest, dorsal spines, violet brow gem, the Croakling's big eyes + smile. LIGHTNING:
  seeded branching bolts walked over the skin, drawn as thin UNLIT tubes on the eyes part (they glow; skinned to the nearest body vertex)
  plus a pale halo band cut into the skin. Her own skeleton (`tools/rig_croakarc.py`, off rig_marlotl: 24 bones, sprawl walk 0.40 m/s +
  scurry 1.30 m/s, idle, sit, lie solved to the ground). In game: `CROAKARC_RIG` (spirit-models.ts), CROAK_GLB_TALL 0.512, glbLen 2.067.
- **Croakrill** (Water): `../m202-croakling-line-2026-11-27/tools/sculpt_croakrill.py` edited in place (still the base's sculpt + rig by name):
  fronds = four soft flat ribbons a side, layered, drifting back and down in an S, thinning to wisps (paler tips); droplet torso; flowing
  pale ripple lines over a deep-teal back; fewer spots; fuller webs. Decimation uses the Marlotl rule (a pinched edge allowed): 29k tris rigged.

Rough: Croakarc's lie curls her tail off frame; her sprawl reads best from above (the game camera is above); Croakrill's glb is 1.0 MB (was 0.56).

```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
$P sculpt_croakarc.py ../croakarc.glb && $P rig_croakarc.py -- ../croakarc.glb ../croakarc-rigged.glb ../croakarc-metrics.json; cp ../croakarc-rigged.glb public/open/spirits/
npx tsx docs/looks/m202-croakling-pass2-2026-11-27/tools/three-check.mts docs/looks/m202-croakling-pass2-2026-11-27/croakarc-rigged.glb
blender -b -P poses.py -- ../croakarc-rigged.glb <dir>/poses arc; OLD_DIR=<pass-1 glbs> blender -b -P lineup.py -- <dir>/lineup_1.5708.png 1.5708; $P sheet.py <dir> ../sheet.jpg
```
