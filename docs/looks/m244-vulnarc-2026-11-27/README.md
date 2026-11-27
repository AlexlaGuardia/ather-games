# M244 sheet 2: Vulnarc's four AWAKENED forms (2026-11-27, OWNER PREVIEW)
Canon Magii a00621e (Alex; CANON/world/spirits-species.md 'Named — Vulnyx › Vulnarc (Storm)', art pending lock) + be0f937 (looks =
pose + motif, all four Storm-lightning). Built off the concept art (athernyx assets/stage3/vulnarc-*, PRIVATE, never copied here) and
the rulings: Virtuoso RERUN = a big crackling mane; Ace = the pure branch (brow gem + violet eyes); Enigma = two floating storm-crystal
discs, no drums, her storm cloud kept. Vulnarc's palette (steel -> ice blue, cream-white ruff / shards, ice crystal facets, cyan
lightning marks = infusion pattern, no rune / sigil, violet brow gem + eyes). Gallery rows #055-#058.
| form | rig | dial | what carries it |
|---|---|---|---|
| Vulnarkor (Champion) | BIPED (rig_biped.py, AWAKEN=kor) | 1.8 | upright war-form, heavy arms + claws, crystal-shard mantle over neck + shoulders, big brush swept up; bolts crackling round her chest ('aura') |
| Vulnarcelle (Virtuoso) | quadruped | 1.75 | a round crystal MANE of points round head + shoulders (face left open), head high, plume up behind; bolts through the mane (head-borne aura) |
| Arcvex (Ace, pure) | quadruped | 1.8 | long low racer, jagged crystal crest crown -> spine, brush kinked like a bolt; two ice-white copies that run, drift back + shrink (echoes.py) |
| Vulnarceth (Enigma) | quadruped | 1.75 | huge ears, full chest ruff, crest, brush curled up; stands in her STORM CLOUD + two six-sided storm-crystal DISCS (aura on its own 'cloud' bone that cancels the root, so the cloud stays on the ground in the lie) |
Player-facing text: none (gallery rows show canon names only).
## Rebuild (tools live in ../m244-vulnara-2026-11-27/tools)
```
uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python sculpt_awaken.py <kor|celle|arcvex|ceth> ../../m244-vulnarc-2026-11-27/<form>.glb
AWAKEN=kor ... python rig_biped.py ../../m244-vulnarc-2026-11-27/kor.glb <out>/vulnarkor-rigged.glb ../../m244-vulnarc-2026-11-27/vulnarkor-metrics.json
... python rig_awaken.py <celle|arcvex|ceth> <form>.glb <out>/<name>-rigged.glb <name>-metrics.json     (rigged glbs ship in public/open/spirits)
```
## Known (for Alex)
Vulnarcelle meshes 1 pinched edge (not closed; the rig does not need it); Vulnarkor's shard mantle reads small at a distance; the lie pose
rolls oddly (as sheet 1). Icons = our Blender renders.
