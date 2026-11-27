# M215: Dewbear cocoon gaits (2026-11-26)
Alex 11-26, watching the Dewbear line walk in the gallery: "the volt bear we can remove the legs and just have it hovering like a
thundercloud cocoon.. and tidebear like a slug sliding along". Cragbear and Lumebear are unchanged.

- **Voltbear**: legs taken off her M202 sculpt (`tools/sculpt_voltbear_hover.py` patches `sculpt_voltbear.py`, nothing else
  changes). Every clip hangs her off the ground: idle = slow drift + bob (~7.6 to 10.6 cm up) with a storm shiver twice a loop; walk /
  run = a glide leaning into the motion, arms trailing, one bob a stride; sit = settles low (~3 cm); lie = sinks to ~1 cm and dozes.
- **Tidebear**: her four splash feet replaced by one wet sole, trailing behind like a slug's foot (`tools/sculpt_tidebear_slug.py`).
  The sole is skinned to the root, so no clip lifts it; walk / run = a body wave running up her column and a surge; sit = slump;
  lie = she curls over herself.
- One rig script for both, `tools/rig_cocoon.py`: rig_bear.py's 24 bones (the game reads the same names), leg bones weighted to
  nothing. Metrics: `voltbear-metrics.json`, `tidebear-metrics.json`.
- Game side: nothing new needed. The rig's ground keep only ever lifts (so a hoverer is never pulled down), and the trot's sit/lie
  beats, follow and skits drive the same five clips.

Known: Tidebear's lie clip has one stretched edge (max 7.9x) where the curl meets the sole. Her lie reads as a curl, not a puddle.
Stills: `*-idle.png` .. `*-lie.png` from the gallery (m215-gallery-check --shots).
