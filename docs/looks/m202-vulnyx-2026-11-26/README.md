# M202 s1: the Vulnyx line's second forms (2026-11-26)
Vulnara (Mana) / Vulnarc (Storm) / Vulnore (Earth) / Vulnix (Water), in game as `public/open/spirits/<name>-rigged.glb`.
- Built in code off the live Vulnyx sculpt (`vulnyx-2026-11-24/tools/sculpt_v2.py`): the same body, so the M132 quadruped rig plan
  fits unchanged (24 bones; walk run idle sit lie). Coat, marks, eyes and brow gem from the LOCKED art only:
  `/root/athernyx/assets/stage2/001-vulnara.png`, `011-vulnarc.png`, `012-vulnore.png`, `013-vulnix.png` (grimoire-ledger #1 / 11 / 12 / 13).
- Size: every evolution grows the spirit (spirits-species.md, Spirit Scale); the metre figure is the build's. FORM_GROW 1.2: 0.70 -> 0.84 m.
- In game: a garden spirit whose pot has `element` set draws her form (M201 writes it). Until then the OWNER preview is
  `/shimmer/open/ather?form=mana|storm|earth|water` (every Vulnyx on the planters takes that form; players never see it).
- Rebuild (python = a venv with numpy, scipy, trimesh, fast_simplification):
  `python tools/sculpt_forms.py <mana|storm|earth|water> <form>.glb`, `blender -b -P tools/rig_form.py -- <form>.glb <name>-rigged.glb <metrics>.json`,
  `npx tsx tools/three-check.mts <name>-rigged.glb` (the game's own makeRigBody), `blender -b -P tools/look_form.py -- <glb> <prefix> 300 r,g,b`.
- Checks: `src/app/shimmer/open/ather/spirit-forms.test.ts` (53), `scripts/m202-forms-check.mts` (prod, owner).

## What the pictures show that the models do NOT carry yet (for Alex)
- Vulnarc: the lightning arcs around her (an effect, not her body); her crackle reads thinner than the picture's at game distance.
- Vulnix: her tail is the Vulnyx brush, not the picture's flowing water-flame tail; bubble rings are faint at game distance.
- Vulnore: the leaf mantle is painted (no leaf geometry); the stone mound on her back is modelled.
- Vulnara: the picture sits her; the model stands (all four share the Vulnyx pose set).
- All four: one shared body, so her line's forms differ by coat, marks, gem and eyes, not by silhouette (except Vulnore's mound).
