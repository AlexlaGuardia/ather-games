# M202 v2: VULNARC as her own creature (2026-11-26)
Same method as Vulnore v2 (a38a0efb) and Vulnara v2 (730f9e28), both approved by Alex 11-26. ONE form: Vulnarc (Vulnyx's Storm
second form), from the LOCKED art `/root/athernyx/assets/stage2/011-vulnarc.png` (grimoire-ledger #11, LOCKED v2) and canon:
spirits-species.md Second Form, Storm = "Crackling energy, electrical traces", "Fiercer, more dynamic"; shimmer-master.md gives
her move as Bolt (a speed strike). No other canon description of her exists. Storm is in her anatomy, not painted on. Vulnix is
still the s1 recolour.

## What the art shows, and the shape that carries it
- A blue coat crazed all over with pale crackle lines -> **a coat of crackled plates**: a Voronoi of ~360 plates over the skin;
  each seam is cut into the mesh as an edge, sunk ~3 mm as a groove and lit pale cyan, each plate swells ~4 mm toward its middle.
  The plates keep off her white parts and her face (the eye / brow patches sit on it).
- Jagged fur spikes on the crown -> a **crest of fur spikes** on the crown.
- Sharp cheek fur, two and three points -> **two extra cheek spikes** a side (upper and low): a wider, sharper face fringe.
- A big white ruff falling in jagged points -> a deeper, **sharper spiked ruff**.
- A tail with a sawtooth edge carried up behind her -> a **brush with sawtooth points** on both edges and both flanks.
- Big ears, pink inside, white fur at the root -> ears a touch taller and **splayed wider** than the Vulnyx's.
- Strong legs, BIG paws, weight forward mid-step -> heavier forelegs, **big paws**, the chest carried low and forward.
- A violet bolt on the brow -> the bolt plate, proud of the brow (sculpt_forms eyes).
- The Vulnyx head and face -> kept (her line). Blue eyes, pink ear insides, white muzzle / ruff / tail tip.

## Where the art is silent (each chosen to make her MORE her own creature)
1. The crest runs on from the crown **down the neck and along the spine** as a zigzag of spikes leaning alternately left and
   right: a lightning line down her back. The art shows the crown only.
2. The brush is **kinked like a bolt** (straight runs, hard corners: up, back-down, up, out) rather than a soft curve.
3. The trunk **slopes forward** (rump high, chest low): a sprinter set to strike (canon's Bolt).
4. The crackle is plates with seams (relief), not lines painted on; seams pale (the art's lines are lighter than the coat).
Not carried: the lightning arcs and sparks around her in the art are an effect, not geometry (an M204 s2 glow candidate).

## Silhouette vs the line
Base Vulnyx: small, gold, smooth, plain brush. Vulnore: low and wide, domed carapace, pillar legs. Vulnara: tall and narrow, a
high plume with crystal shards. **Vulnarc: a sawtooth top line** (crest from crown to mid-back), a zigzag brush, a spiky face
fringe and ruff, big paws, front-low. See `side-by-side.jpg`.

## Size
`FORM_GROW_BY.vulnarc = 1.4` in `src/app/shimmer/open/ather/spirit-models.ts` (as her sisters). Prod measured 0.970 m standing.

## Rig (her own skeleton)
`tools/rig_vulnarc.py`: the M132 quadruped plan (24 bones; walk run idle sit lie) off rig_vulnara.py, re-placed for her sloped
trunk, heavier forelegs, bigger paws, splayed ears; the four tail bones run the bolt's corners; the crest rides neck / spine / head.
Fixed from Vulnara: **the rump sits** (SITY now SOLVED so the rump just touches: 6.6 mm, Vulnara's floated ~3 cm), and the lie
stretch is lower (edge stretch max 5.96, p99 2.42; Vulnara 14.6). Metrics: `vulnarc-metrics.json`.
Game check: `npx tsx docs/looks/m202-vulnarc-v2-2026-11-26/tools/three-check.mts public/open/spirits/vulnarc-rigged.glb 1.4` all PASS.
glb is 686 KB (Vulnara 442 KB): the seam cuts double the triangle count.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_vulnarc.py vulnarc.glb
/opt/blender/blender -b -P tools/rig_vulnarc.py -- vulnarc.glb vulnarc-rigged.glb vulnarc-metrics.json
```

## Shots
`side-by-side.jpg`: the locked art | prod 390x844 owner preview (`?form=storm`, build e421a7a5) | below, base Vulnyx (drawn 1/1.4),
Vulnore, Vulnara, Vulnarc at true relative size (idle frame 0): side, three-quarter, front. `vulnarc-390.png` = the prod still.
**The prod still is framed now:** m202-forms-check waits for her to settle after the tp, steps the keeper back 3 m and shoots at once.
In game she reads paler than the art (the form hull + emissive over a light coat); a deeper coat is one palette line if Alex wants it.
Prod check (scripts/m202-forms-check.mts --forms storm, owner, this box): ALL PASS.
