# M202: the Athowl line, WORK IN PROGRESS (2026-11-27, sprites B agent assets-M202-Athowl). NOT wired in game.
Each form is her own creature sculpted from her locked art (no patching of the base sculpt). Shared = tools only:
`tools/owl_common.py` (SDF helpers, wing-blade frame, hidden neck groove, eye caps, colour cut, export) and `tools/rig_owl.py`
(the base Athowl rig.py plan, 25 bones, fitted from each form's `LM` landmarks; Voltowl's spread-wing rest = `up0`).
- `sculpt_mystowl.py`: tall bottom-heavy egg, huge grey eye discs + violet irises, ragged tufts, gold third eye, gold flowing flank pattern. three-check ALL PASS.
- `sculpt_voltowl.py`: small round pale-blue body, big wings raised open in a V (rest pose), frowning brows, violet brow crystal, tail fan, breast veins. three-check ALL PASS.
- `sculpt_tideowl.py`: sleek forward-leaning teardrop, long tail, no tufts, pale heart face, crown water gem, visible legs. three-check: one FAIL, idle/sit blends dip 2.8 mm (limit 2.5).
- `sculpt_cragowl.py`: stocky barrel, antlers, moss, amber gem. Does NOT build yet: the antler/cheek-ruff union has 2 handles (euler -2), so decimation never closes.
Rebuild: `cd tools; uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_<form>.py ../<form>.glb`,
`python3 rig_owl.py <form> ../<form>.glb ../<form>-rigged.glb ../<form>-metrics.json`, `npx tsx tools/three-check.mts <rigged glb>`.
