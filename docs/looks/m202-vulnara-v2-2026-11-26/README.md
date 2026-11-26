# M202 v2: VULNARA as her own creature (2026-11-26)
Alex approved the Vulnore v2 approach (a38a0efb) 11-26 ("yea that looks good lets continue"). Same method, ONE form: Vulnara
(Vulnyx's Mana second form), from the LOCKED art `/root/athernyx/assets/stage2/001-vulnara.png` (grimoire-ledger #1:
"Mana-INFUSED = violet/amethyst crystalline + GOLD RUNE-MARKS + third-eye") and the page: Otto #3 ("violet and quick, gold
rune-marks scrolled down its flanks and a bright gem set at its brow, ears pricked and a long tail streaming"), Bonn #5 ("She
grew, a little"). Mana goes into her anatomy (crystal, relief runes), not paint. Vulnarc / Vulnix are still the s1 recolours.

## What the art shows, and the shape that carries it
- Tall pricked ears, white feathered fur inside -> ears ~20% longer and wider than the Vulnyx's, **tufts of fur standing** in each.
- Pink diamond gem in gold on the brow (the ledger's third eye) -> a **raised faceted crystal** on the brow, gold setting + marks round it.
- Gold rune circles on shoulder, flank, haunch -> **raised rune rings** (about 5 mm proud at her size) with a centre boss and six
  gold spokes; the art's small sprig runes on the upper shoulders as gold lines.
- A big plume tail, white above, violet below, its violet edge breaking into jagged points -> a fuller, longer brush with
  **faceted amethyst crystal shards** (four-sided, flat faces) breaking out along its under edge; white over its upper half.
- Slim legs, neat round paws, a long white chest -> a **lean, leggy** body: trunk carried higher, deep chest, strong waist tuck,
  slim legs, a long white ruff.
- Violet coat (blue-violet under, lilac on top), white muzzle / bib, pink ear insides, violet eyes; the Vulnyx head and face kept (her line).

## Where the art is silent (each chosen to make her MORE her own creature)
1. The trunk rides higher on longer, slimmer legs (the page: "quick"): she reads leggy where Vulnore reads low and heavy.
2. The brush is carried high and streams back, its shards swept toward the tip (the page: "a long tail streaming").
3. The shards are four-sided crystal facets (the ledger's "crystalline"), deeper amethyst under, pale on top.
4. The runes go down both flanks in the same layout (the art shows one side); four a side.
5. Sitting, her brush stands up behind her (the art's seated pose) rather than curling round her feet.
Not carried: the gold afterimage the page gives her ("little smears of gold light hanging in the air a breath behind it") is a
trail effect, not geometry; it is the obvious next accent (M204 s2 glow).

## Silhouette vs the line
Base Vulnyx: small, gold, plain brush. Vulnore: low, wide, a domed carapace, pillar legs. Vulnara: tall and narrow, oversized
tufted ears, a plume with a spiked crystal edge, runes in relief. See `side-by-side.jpg` (all three at true relative size).

## Size
One dial per form, `FORM_GROW_BY` / `formGrow()` in `src/app/shimmer/open/ather/spirit-models.ts`: Vulnara = **1.4** (as Vulnore).
Her head and body sit at the Vulnyx's glb scale; her ears are ~5% taller, her brush longer (nose to tail 1.67 glb units vs ~1.5).

## Rig (her own skeleton)
`tools/rig_vulnara.py`: the M132 quadruped plan (24 bones; walk run idle sit lie) off rig_vulnore.py, re-placed for her higher
trunk, slimmer legs, taller ears and her tail curve; the shards ride the tail bones. Sit: SITY -0.13 (her trunk rides higher; rump
~3 cm off the ground at true size), brush lift solved against the ground (1.99 rad: it stands up behind her). Metrics:
`vulnara-metrics.json`. Lie edge stretch max is high (14.6; p99 2.2): the long slim legs fold under her body.
Game check (the game's own makeRigBody, at 1.4): `npx tsx tools/three-check.mts <rigged.glb> 1.4` all PASS.

## Rebuild
```
uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python tools/sculpt_vulnara.py vulnara.glb
/opt/blender/blender -b -P tools/rig_vulnara.py -- vulnara.glb vulnara-rigged.glb vulnara-metrics.json
npx tsx tools/three-check.mts vulnara-rigged.glb 1.4
```
The decimation allows a pinched edge (two crystal faces that kiss, 1 edge in this build); never an open one.

## Shots
`side-by-side.jpg`: the locked art | prod 390x844 owner preview (`?form=mana`, build 730f9e28) | base Vulnyx, Vulnore, Vulnara
at true relative size (grow x glb height; idle frame 0): side, three-quarter (top two rows), front (bottom). `vulnara-390.png` =
the prod still. **The prod still frames her badly** (only her brush at the right edge, in both of two re-takes): after the
check's teleport she walks to the keeper, so the camera aim lands beside her. The mount, size and player asserts are what prove her
on prod; a better in-game still is a check fix (aim after she settles), not done here.
Prod check (scripts/m202-forms-check.mts --forms mana, owner, this box): ALL PASS; Vulnara 0.998 m standing (look h 0.977).
