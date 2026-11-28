# M244 sheet 3: Vulnore's four AWAKENED forms (2026-11-28, OWNER PREVIEW)
Canon: CANON/world/spirits-species.md 'Named — Vulnyx › Vulnore (Earth)' (Alex 11-27), art LOCKED-AFK athernyx 3501ec6
(assets/stage3/009-012, PRIVATE, read for shape + colour, never copied here). Gallery rows #059-#062, not in PUBLIC_FORMS.
`line-sheet.jpg` = OUR renders only (Vulnore + the four at true relative size). The comparison against the locked art is private:
/root/athernyx/assets/stage3/sheets/m244-vulnore-awakened-vs-locked.jpg.

Kept on all four: Vulnore's amber-orange coat + cream, green crystal, the GOLD BROW GEM and amber eyes (sculpt_forms 'earth' eyes).
| form | rig | dial | what carries it |
|---|---|---|---|
| Orethar (Champion, pure) | BIPED (rig_biped.py, AWAKEN=oreth) | 1.8 | upright hulk: big pauldrons, gauntlet forearms, heavy thighs; dark-stone armour plates (shoulders, forearms, shins, a V chest plate); chunky green crystals on shoulders, forearms and back, a crystal crest above the gem; a gold heart-gem glowing on her chest ('aura', chest-borne) + the art's gold blaze PROJECTED round it |
| Vulnoraya (Virtuoso) | quadruped | 1.75 | lean fox, a mantle of green crystal leaves over neck + shoulders, green brush tip; a CROWN of seven crystal flowers ear to ear ('aura', head-borne) |
| Vulnoris (Ace) | quadruped | 1.8 | long low racer, a mantle of rough stones over the shoulders, a crystal crest on the brow, brush curled up; two WHOLE pale-gold copies that run behind her, drift back and shrink (echoes.py, as Vulnavex / Arcvex) |
| Vulnorun (Enigma) | quadruped | 1.75 | deep-chested and still, bark-vine lines down the legs, pink + yellow blooms on her back; a small tree grown from her back (trunk + branches on the body, its leaf crown = 'aura', on the spine bone) |

## The 11-28 quality standard (m244-quality-2026-11-28), applied to all four
- (a) palette off the locked art (baked in `sculpt_awaken.py` EARTH palette); projection only where the art has a blaze: Orethar's gold
  heart blaze from the art's torso onto her chest front (`tools/rig_q.py`, one midpoint pass on the chest front; only GOLD lands: a full
  colour map of the armour read as camouflage, so the armour is the sculpt's broad stone plates).
- (c) baked ear + tail springs on every clip (`rig_quality.py`'s own jiggle(), executed from its source, not copied).
- Every crystal / stone / trunk / bloom is its own piece and rides RIGIDLY on the body vertex nearest it (`sculpt_awaken.rigid_extras`).
- TRELLIS skipped (as briefed).

## Rebuild
```
cd ../m244-vulnara-2026-11-27/tools
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python sculpt_awaken.py <oreth|raya|noris|norun> ../../m244-vulnore-2026-11-28/<form>.glb
cd ../../m244-vulnore-2026-11-28/tools
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow python rig_q.py <form> ../<form>.glb ../<name>-rigged.glb ../<name>-metrics.json
npx tsx docs/looks/m202-vulnara-v2-2026-11-26/tools/three-check.mts <rigged glb> <dial>
```
Player-facing text: none (gallery rows show canon names only).

## Proof (prod, desk 1440)
Receipts 1156df4d BUILD_ID baurnMYOVcmCQwd-iq0GY, then 621302fb (Orethar's heart-gem fix: the first build had it 1.5 glb in front of her, lie -1260 mm).
m244-awakened-check --only 59-62 ALL PASS (Orethar lie -0.9 mm glb, Vulnoris copies travel 0.977 glb, 0 errors, non-owner 403); m224-gallery-check --from 59 ALL PASS.
## Known (for Alex)
Vulnoraya's crown + leaf mantle read small; Vulnorun's blooms barely show and her trunk hides behind the ears at three-quarter; Orethar is heavier than
Vulnarkor but her arms are still slimmer than the art's.

## v2 SILHOUETTE (11-28, hub: 'the parent fox with props stuck on')
`sculpt_awaken.py` now carries a per-form **PROP** (body proportions: head, chest, neck, lean, tail, paw, stance, thigh, fore; biped shoulder,
span, arm, forearm) + **MOTIF** (shard, crown, tree, trunk, bloom, rock) spec, applied to the landmarks + radii BEFORE the body is built; the
rigs read those landmarks, so they re-fit (rig_biped.py: for PROP forms the arm / thigh split is by nearest chain + the pauldrons ride the arm,
and each rest clip is lifted by its own measured deficit: Orethar's heavy thighs dipped 15 mm on the breath's low in the sit).
| form | PROP / MOTIF | reads as |
|---|---|---|
| Orethar | head .78, shoulder 1.45, span 1.32, arm 1.4, forearm 1.5, chest 1.22, thigh 1.35, stance 1.3, paw 1.3 / shard 1.4 | hulk: shoulders 3.62x the eyes' spread (v1 1.95), small head sunk between pauldrons, wide stance |
| Vulnoraya | head .94 / crown 2.4, shard 1.35 | a standing crown of crystal flowers (v1 a thin ring) |
| Vulnoris | lean .82, fore .9, thigh .92, head .94, tail .9 / rock 1.2, shard 1.4 | leaner racer (0.905 vs 1.005), bigger stone mantle; copies unchanged |
| Vulnorun | chest 1.15, fore 1.1, thigh 1.1, head .94 / tree 1.35, trunk 2.0, bloom 1.8 | a clear small tree rising behind the ears, real trunk, blooms that show |
Each metrics json has `silhouette` (spec + measured ratios); spirit-awakened.test.ts reads it. Sheet: `v2-before-after.jpg` (tools/v2_sheet.py,
also the gallery icons); private vs-locked: athernyx assets/stage3/sheets/m244-vulnore-v2-vs-locked.jpg. Vulnix v2 = one PROP + one MOTIF line per form.
