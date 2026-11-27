# M202 Athowl line REDO (2026-11-27, sprites-M202-Athowl-redo)
Alex on the first line (m202-athowl-line-2026-11-26, 080d83b6): "the athowl line need a redo so they dont look so dainty.. or simple".
So: HEFT and DETAIL, each form still read from her own locked art (athernyx/assets/stage2), same rig plan, same glb heights
(OWL_GLB_TALL unchanged, so no code change: only the four rigged glbs are replaced).

- **Shared (tools/owl_common.py):** `scallop()` + `PLUME` = LAYERED FEATHER ROWS over each body's front and flanks: rows of round-tipped
  feathers, alternate rows offset, each tip standing proud in the field (so the field normals shade it) and painted (`Owl.plumage`: a dark
  crescent under each overlapping tip, a pale lip on it). The relief fades out round the wing blade (where it stood proud it closed on
  the blade = a handle).
- **Mystowl:** a deeper egg (z .30 to .325; wider than x .335 she swallows her wing root), fuller thicker wing with two more layered
  feathers, thicker ragged tufts, a shaggy cheek ruff, heavy feet + claws, painted wing feather rows. Her flank pattern is now GLYPH
  PANELS as in her art (Magii 0d6d577: a gold-framed panel with a flowing infusion pattern inside, three curls off a spine; no sigil).
- **Voltowl:** fuller body (.245 to .275 wide), thicker wings with a covert layer, broader tail fan, thicker tufts, thick feathered legs,
  bigger talons, feather rows over coat + white breast, wing feather rows.
- **Cragowl:** broader barrel, the six lumps replaced by full scale-feather rows, heavier layered wings, thicker antlers, a fuller cheek
  ruff (5 a side), shaggy trousers, big talons (tips 22 mm up: the hop's toe-roll dipped lower ones).
- **Tideowl:** still sleek but less thin (.23 to .258), sturdy legs (not sticks), broader three-pair tail, fuller wings, feather rows.
  `drop_max=.04` is GONE: she perches as low as the others now and no blend sinks a foot.
- Tris: 6500 target per body (was 4200-4600) so the rows survive decimation.

line-sheet.jpg: one row a form, OLD vs NEW at game distance, then the new model front / side / rear / three-quarter / face (game tints);
under it the old line and the new line at TRUE relative size, no tint. line-sheet-with-ref.jpg (gitignored) adds the locked art column.
Rebuild: as the 11-26 README (same commands, this folder's tools), then
`python3 tools/sheet.py ../m202-athowl-line-2026-11-26/out out line-sheet.jpg [--ref]`.
