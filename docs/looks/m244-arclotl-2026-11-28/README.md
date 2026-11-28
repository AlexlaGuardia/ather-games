# M244 sheet 15: Arclotl's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md '**Arclotl (Storm):** Arclotar · Arclelle · **Arcis** (Ace, pure) · Arclun'.
Art LOCKED athernyx assets/stage3/081-084 (PRIVATE, read for shape + colour, never copied here). Owner gallery rows #111-#114 (after Mesamere's), not in
PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (the live Arclotl at dial 1.4, then the four at true relative size, three-quarter idle over run).
The comparison against the locked art is private: /root/athernyx/assets/stage3/sheets/m244-arclotl-awakened-vs-locked.jpg.

Each is the LIVE Arclotl's sculpt (m202-manalotl-line-2026-11-26 tools/sculpt_arclotl.py, imported, never edited) re-shaped by name in
`tools/sculpt_arcaw.py`: her head, eyes, smile, brow spark, crackle veins and her three saw-tooth gill spikes a side with forked tendrils (the family read)
stay on all four.
| form | dial | rig | silhouette | motif (aura) | body verts |
|---|---|---|---|---|---|
| Arclotar (Champion) | 1.85 | ground biped (rig_arcaw.py) | STANDS: stocky barrel, thick legs, arms out with claws, gills x1.22 tipped lilac, thick tail with a saw row | bolts crackling round her chest (chest) | 7219 |
| Arclelle (Virtuoso) | 1.75 | ground biped | STANDS, longer legs; her idle dances on ONE foot (right knee lifted, slow twirl); arms wide, one high; gills swept back; long saw-fin tail; no frills | three ribbons of current looping round her (chest) | 8726 |
| Arcis (Ace, pure) | 1.8 | ground biped | STANDS crouched, compact, hands reaching out, steel-grey gill spikes | the lightning ORB: a cage of rings + bolts over its shell, resting on the ground (root) | 6885 |
| Arclun (Enigma) | 1.85 | lotl quadruped (rig_arclun.py = rig_lotl.py + a 'halo' bone) | sleek, long, low; gills swept back like wings; long slender tail | sound rings spreading round her head (halo: undoes the root's drop in the lie) | 7821 |

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
ARCAW_FORM=<tar|elle|cis|lun> $P sculpt_arcaw.py <out>.glb <tris>      (tar/cis/lun 7000, elle 7700; ~3 min each)
ARCAW_FORM=<tar|elle|cis> $P rig_arcaw.py <in>.glb <name>-rigged.glb ../<name>-metrics.json
ARCAW_FORM=lun /opt/blender/blender -b -P rig_arclun.py -- arcaw <in>.glb arclun-rigged.glb ../arclun-metrics.json
cp <name>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P ../../m244-croakarc-2026-11-28/tools/render_croak.py -- <rigged.glb> <dir>/<name>-three.png idle:0 three <3.0*1.4/dial> .62   (run:.3 -> -run.png)
python3 sheet.py <dir>      (line sheet + the 160 px icons + the private vs-locked sheet)
```
## Known (for Alex)
1. Arclun's art glides level in the air; ours walks on four legs (no glide clip). Her rings are rigid arcs, not animated pulses.
2. Arcis's orb is a cage of glowing rings (an opaque sphere would hide her); her gill tips poke through it.
3. Arclelle's one-foot dance is her IDLE only; she walks and sits on two feet. Her gills keep the saw-tooth spikes (the art's are softer, wing-like).
4. Arclotar's gills are Arclotl's spikes scaled up, not the art's feathered fronds; mouths stay closed (no jaw).
5. Bodies are not watertight after decimation (22-27 pinched edges; same as the live line), rigs clean.
6. Player-facing text: none (gallery rows show canon names only).
