# M102 new Vulnyx, look proof (2026-11-24). Nothing in game.
- `sheet.jpg`: locked ref beside B, A and today's live model (front, 3/4, side, rear 3/4, face, phone distance). `b-walk-run.webm`: B idle, walk 0.55 m/s, run 1.92 m/s; `b-motion-frames.jpg` = stills.
- `b.glb` CANDIDATE B (the pick): sculpted in code, no outside service. `a.glb` CANDIDATE A: Hunyuan3D-2.1 free Space (anonymous), one image sent: `public/spirits/grimoire/fox-mana-beta.webp` (already public); its head was fused with that picture's swirls and its tail was a torn shell, so the head is B's and the tail is filled. `b-rigged.glb` + `b-metrics.json`: quick fit on the s1 quadruped plan.
- Topology (tools/facts.py, colour-split vertices welded): B 5,938 body tris + 748 eye tris, A 6,036 + 748; both 0 open edges, 0 non-manifold, 1 island, 0 handles; legs: B 4 separate outlines at 8-20% height; A 4 at 8-12% (6 at 16-20%: the low tail adds outlines). Live: 136 open edges.
- Rebuild: `python tools/sculpt.py b.glb`, `python tools/hybrid.py <raw.glb> a.glb`, `blender -b -P tools/rig_b.py`, `tools/look.py`, `tools/reel.py` (python = any venv with numpy, scipy, trimesh, fast_simplification).

## v2 (M102p): Alex's approved B, polished and game-ready. Nothing in game.
- `sheet-v2.jpg` v1 over v2, `b-v2-clips.webm` idle / walk / run / sit, `b-v2.glb` (unrigged), `b-v2-rigged.glb` (24 bones; nodes body + eyes, no glow part; clips walk run idle sit + lie, bind pose = standing), `b-v2-metrics.json`.
- Polish: muzzle mask ends under the eyes with a mid-gold rim (cheek points gold), nose = near-black button in the unlit `eyes` part, ears 1.3x deeper, tail shaded as one form + softer tufts, two more ruff points.
- Rig numbers for wiring: h 0.70 (glb about 1 unit), clipV walk 0.55/0.70, run 2.8/0.70, bones b_neck b_head. Run blends in and out of sit dip up to 5 cm for a few frames: lift the group by the lowest vertex, or lengthen that fade.
- Rebuild: `python tools/sculpt_v2.py b-v2.glb 4700`, `blender -b -P tools/rig_v2.py`, `npx tsx tools/three-check-v2.mts` (the game's own makeRigBody), `tools/look_v2.py`, `tools/reel_v2.py`.
