# M202 v2: VULNIX as her own creature (2026-11-26)
Same method as Vulnore (a38a0efb), Vulnara (730f9e28) and Vulnarc (e421a7a5) v2, all approved by Alex 11-26. ONE form: Vulnix
(Vulnyx's Water second form), the last of the Vulnyx line, from the LOCKED art `/root/athernyx/assets/stage2/013-vulnix.png`
(grimoire-ledger #13, LOCKED v2) and canon: spirits-species.md Second Form, Water = "Flowing patterns, aquatic adaptation",
"Calmer, more fluid"; shimmer-master.md gives her move as Current. No other canon description of her exists.

## What the art shows, and the shape that carries it
- A long, low aqua body stretched in a run, smooth top line -> a **long, slim, level trunk** (pelvis set back 5 cm), a long neck.
- A big tail of water licking up into flame tongues -> a **wave tail**: out level behind her, then rising and **breaking forward**
  into a curl, nine flame tongues off its outer edge and flanks, each licking out then curling with the flow.
- Flowing swirl lines all over the coat -> **current ridges**: wavy lines along her length (round the brush on the tail), cut into
  the mesh, standing ~2.5 mm proud and lit pale.
- Bubble rings on the flanks and haunch -> **bubble domes** as geometry (20, three sizes), a pale rim round a clearer middle.
- A small curl of fur off the withers -> a **water curl** on the withers.
- Cheek fur sweeping back -> two cheek points **swept back** (Vulnarc's point out).
- Big ears, peach inside -> big ears, a touch taller, swept back a little. Slim legs, neat paws -> slim legs, long paws.
- A cyan teardrop on the brow -> the drop gem, proud of the brow (sculpt_forms eyes). The Vulnyx head and face -> kept.
- Colour depth: the coat runs deep teal (#0c566c -> #2b9fae) and her in-game floor + hull are deeper than s1's
  (emissive #2fb4c4, hull #9fe4ec) so she keeps the art's teal in game (Vulnarc read paler than her art).

## Where the art is silent (each chosen to make her MORE her own creature)
1. **Webbed toes** (canon's "aquatic adaptation"): a thin web between spread toes, fore and hind.
2. The current lines also run **round the brush**, not only the body.
3. The body is carried **level** (calm, canon's "calmer, more fluid"): not sloped (Vulnarc), tall (Vulnara) or wide (Vulnore).
4. Bubbles and lines keep **off her face**; the white parts stay plain.
**Effect only (M204 s2 glow):** the air bubbles and droplets round her, the splash at her paws, a shimmer along the tongues.

## Silhouette vs the line
Base Vulnyx: small, gold, plain brush. Vulnore: low and wide, domed carapace. Vulnara: tall and lean, high plume with shards.
Vulnarc: sawtooth top line, bolt-kinked brush, chest low. **Vulnix: the longest and smoothest top line, slim legs, and a big
wave tail breaking forward over itself with flame tongues.** See `side-by-side.jpg`.

## Size
`FORM_GROW_BY.vulnix = 1.4` in `src/app/shimmer/open/ather/spirit-models.ts`. Prod measured 1.013 m standing (look h 0.977).

## Rig (her own skeleton)
`tools/rig_vulnix.py`: the M132 quadruped plan (24 bones; walk run idle sit lie) off rig_vulnarc.py, re-placed for her long
trunk, slim legs, long paws, swept ears; the four tail bones run the wave (out, up, over the crest, into the curl). Sit: rump
SOLVED to touch (3.1 mm). Lie: edge stretch p99 2.38 (Vulnarc 2.42), max 8.08 (the groin midline; Vulnarc's sit max was 8.75).
Run: a long low stretch like the art. Metrics: `vulnix-metrics.json`.
Game check: `npx tsx docs/looks/m202-vulnix-v2-2026-11-26/tools/three-check.mts public/open/spirits/vulnix-rigged.glb 1.4` all PASS.
glb 566 KB (current-line cuts).

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_vulnix.py vulnix.glb
/opt/blender/blender -b -P tools/rig_vulnix.py -- vulnix.glb vulnix-rigged.glb vulnix-metrics.json
```

## Shots
`side-by-side.jpg`: the locked art | prod 390x844 owner preview (`?form=water`, build 73bddcab) | below, base Vulnyx (drawn
1/1.4), Vulnore, Vulnara, Vulnarc, Vulnix at true relative size (idle frame 0): side, three-quarter, front. `vulnix-390.png` =
the prod still: she is in frame but her head is cut at the right edge (she is the longest of the line; the check aims at her
root, which sits behind her middle). Prod check (scripts/m202-forms-check.mts --forms water, owner, this box): ALL PASS.
