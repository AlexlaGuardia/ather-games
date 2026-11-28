# M202 VULNIX: ears UPRIGHT again (2026-11-28)
The locked art (athernyx assets/stage2/013-vulnix.png, private) has BOTH ears upright: the far ear is only foreshortened. The v3
lop (`m202-vulnix-v3-2026-11-26`) read the far ear as a flop. Here the flop is OFF (`FLOP = False` in `tools/sculpt_vulnix.py`:
`unbend()` is the identity, so the ear is v2's straight ear); the rig's ear bones run root -> tip again (v2's), masked by the
straight ear. Everything else is v3 (shorter wave tail into bubbles). The fold code stays for her awakened Virtuoso (Marelle),
whose jester-ear flop is deliberate and comes later.
`before-after.jpg`: top = v3 (prod before), bottom = this build; front | three-quarter | side | face.
Rig: 24 bones, weights_bad 0, rump sits 5.7 mm (`vulnix-metrics.json`). `tools/three-check.mts vulnix-rigged.glb 1.4` all PASS.
Open: the peach inside of the ear (art) does not show from the front (v2 had the same).
## Rebuild
```
/tmp/vulnyx-spike/venv/bin/python tools/sculpt_vulnix.py vulnix.glb
/opt/blender/blender -b -P tools/rig_vulnix.py -- vulnix.glb vulnix-rigged.glb vulnix-metrics.json; cp vulnix-rigged.glb public/open/spirits/
```
