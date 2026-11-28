# M244 sheet 16: Craglotl's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md '**Craglotl (Earth):** **Cragkor** (Champion, pure) · Craglaya · Craglix · Craglomyr' (ledger #085-088;
the 11-28 Champion/Virtuoso art swap is already in the archived files). Art LOCKED athernyx assets/stage3/085-088 (PRIVATE, read for shape +
colour, never copied here). Owner gallery rows #119-#122 (after Aurmere's), not in PUBLIC_FORMS. `line-sheet.jpg` = OUR renders only (the live
Craglotl at dial 1.4, then the four at true relative size, three-quarter idle over run). Private comparison:
/root/athernyx/assets/stage3/sheets/m244-craglotl-awakened-vs-locked.jpg.

Each is the LIVE Craglotl's sculpt (m202-manalotl-line tools/sculpt_craglotl.py, imported, never edited) re-shaped by name in
`tools/sculpt_cragaw.py`: her dome head, smile, amber eyes, leaf-flame gills, moss, back stones and warm belly stay on all four.
| form | dial | rig | silhouette | motif (aura) | body verts |
|---|---|---|---|---|---|
| Cragkor (Champion, pure) | 1.85 | ground biped (rig_cragaw.py = rig_arcaw.py, 'kor' braced idle) | STANDS: stocky barrel, mossy arms, big gills raised, a ring of little yellow flowers on her crown, short thick tail | pale crystal spires standing on the ground behind her (root) | 8854 |
| Craglaya (Virtuoso) | 1.8 | lotl quadruped (rig_cragq.py = rig_arclun.py) | widest + lowest, an OPEN grin, bigger gills, crown stone | a ring of warm glowing pebbles on the ground (halo) | 8875 |
| Craglix (Ace) | 1.75 | lotl quadruped | narrow, long, a long tail with a leaf fin, gills swept back | ripple rings flat on the ground under her (halo) | 7128 |
| Craglomyr (Enigma) | 1.85 | lotl quadruped | TALL on long legs, coral antlers, a banded gold belly, orange eyes, greyer coat | glowing crystals along her brow (head bone) | 6638 |

## Rebuild
```
cd tools; P=/tmp/vulnyx-spike/venv/bin/python
CRAGAW_FORM=<kor|laya|lix|myr> $P sculpt_cragaw.py <out>.glb <tris>      (kor 6400, laya/lix 7000, myr 5000; 3-10 min each)
CRAGAW_FORM=kor $P rig_cragaw.py <in>.glb cragkor-rigged.glb ../cragkor-metrics.json
CRAGAW_FORM=<laya|lix|myr> /opt/blender/blender -b -P rig_cragq.py -- cragaw <in>.glb <name>-rigged.glb ../<name>-metrics.json
cp <name>-rigged.glb ../../../../public/open/spirits/
/opt/blender/blender -b -P ../../m244-croakarc-2026-11-28/tools/render_croak.py -- <rigged.glb> <dir>/<name>-three.png idle:0 three <3.0*1.4/dial> .62   (run:.3 -> -run.png)
python3 sheet.py <dir>
```
## Known (for Alex)
1. Cragkor's art SITS holding a little clay figure; ours stands (no companion: not modelled). Her flowers are small pale bumps.
2. Craglix's art leaps over a puddle; ours runs on the lotl gait over flat ripple rings (emissive, on the ground, never in front of her: M250).
3. Craglomyr's forehead glyph is not drawn; her antlers are a simple coral branch, not the art's many-tipped coral.
4. Motifs: spires, pebbles and brow crystals are earth/stone (solid, allowed by M250); the ripples are the only element effect and they glow flat under her.
5. Bodies not watertight after decimation (as the live line), rigs clean. Player-facing text: none (gallery rows show canon names only).
6. M249 size tuning in flight puts formGrow('craglotl') at 2.8 (uncommitted), above these dials: the four would show SMALLER than Craglotl until Alex sets their dials.
