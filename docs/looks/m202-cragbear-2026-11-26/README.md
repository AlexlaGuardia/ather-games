# M202: CRAGBEAR, Dewbear's Earth second form, as her own creature (2026-11-26)
The first of the Dewbear line, ONE form. From the LOCKED art `/root/athernyx/assets/stage2/009-cragbear.png` (grimoire-ledger #9)
and canon (spirits-species.md: Dewbear = tardigrade, Earth form; Second Form Earth = "Stone, crystal, moss-covered growth").
Earth is in her anatomy. She is not a recoloured Dewbear: the base is a pale blue tun with plates. Cragbear is a squat orange
barrel with a mossy crown.

## What the art shows, and the shape that carries it
- A round barrel of a body, head and trunk one piece -> one squat ball-barrel, the face on its upper front.
- The barrel's staves -> twelve carved stave grooves below the upper hoop (geometry), plus a wide darker seam colour.
- Two dark iron hoops -> two raised hoops, one under the face and one round the lower belly.
- A thick moss cap draping over both shoulders -> a lumpy moss layer over the crown, down to mid-height at the shoulders.
- Orange mushrooms in the moss -> eleven stalked mushrooms on the crown and shoulders, leaning outward.
- Slate stones and green crystals -> five flat slate chips, three small crystal points.
- A heavy frowning brow over round amber eyes -> two brow ridges angled down toward the middle (geometry), amber lens eyes with
  catchlights. A short down-turned mouth made as a line of geometry in the eyes mesh (the sprites lane lesson).
- Stub arms at her sides, short thick legs -> stub arms with knuckle knobs, four short legs with toe knobs.
- Warm light in the lower belly -> a paler amber patch (colour).

## Where the art is silent (each one listed for Alex)
1. She walks on FOUR legs. The art shows two feet; the hind pair sits under her back (a tardigrade walks on all its legs).
2. A short tail nub at the back (the Dewbear has one).
3. Moss covers the back down to mid-height, with no staves under it.
For the glow slice (M204, effects only): the gold motes round her, the crystals' glint, the belly's inner light.

## Size + rig
Dial `FORM_GROW_BY.cragbear = 1.4` x the Dewbear's 0.50 m per glb unit = 0.70 m per unit. Her barrel stands 0.65 m and the
mushroom tips reach 0.77 m (`CRAGBEAR_GLB_TALL` 1.10 units). Her base is 0.50 m. Nose to tail 0.60 m.
She has her own skeleton, `tools/rig_cragbear.py`, built off rig_marlotl.py (the M132 quadruped plan, 24 bones). Her walk and run are a heavy
waddle: diagonal pairs, the barrel rolls over the planted side and the arms swing against her steps. Idle turns only the crown,
and only a little, because a barrel does not twist. Sit rocks her back onto her rump (solved, rump 5 mm). Lie sinks her onto her belly
with the legs splayed (solved). The ear bones carry her stub arms. Her own `CRAGBEAR_RIG` is in spirit-models.ts.
Metrics are in `cragbear-metrics.json` (weights_bad 0, edge stretch p99 1.35 walk / 1.7 sit). Game check: `npx tsx tools/three-check.mts
public/open/spirits/cragbear-rigged.glb` all PASS (idle 0.769 m). At a keeper's sprint (4.2 m/s) her run hits the cadence cap and
her feet slide, the same as her base's. glb 879 KB.
Evolution: the M201 stat gate on her earth bar (infusions.ts, species-generic; spirit.ts names the form Cragbear).

## Shots + proof
`look-sheet.jpg`: front, three-quarter, side, rear, face, then base Dewbear beside Cragbear at true relative size (front and
three-quarter). `side-by-side.jpg`: locked art | her model in the game's toon recipe at phone framing (390x844, Blender look.py) | base Dewbear and
Cragbear at true size. Prod check `scripts/m202-forms-check.mts --species water-bear` (owner, this box, build 29cbac7e): ALL PASS:
cragbear mounted (not her base), 0.762 m standing (want ~0.77), player `?form=earth` sees her base Dewbear, 0 page errors. The
check's prod still framed only grass because the shot-aim helper missed her (the known m204 aim flake), so no prod still is committed.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_cragbear.py cragbear.glb
/opt/blender/blender -b -P tools/rig_cragbear.py -- cragbear.glb cragbear-rigged.glb cragbear-metrics.json
```
