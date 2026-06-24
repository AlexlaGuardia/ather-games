# Shimmer Dev Editor — Backlog & Feature Requests

Pinned tooling improvements for the Shimmer editors (map/sprite/furniture/etc.).
Do these when Alex is NOT mid-paint (they need a rebuild, which reloads his session).

## Feature requests (Alex)

- **Visual tile picker** — the tile-selection dropdown shows tile *names*; instead show
  a **grid per category with the tile thumbnail** (the actual art, not the name).
  > "the dropdown menu for selecting tiles, if this could show a grid for each category
  > showing the tile instead of the name that would save me soo much time"
  (Raised 2026-06-24. Alex paints a *variety* of tiles by eye, so fast visual tile access
  is the core ergonomic win for map painting.)

## Pending cleanups (pixel-art pivot)

- **Default IntGrid OFF** in the map editor + remove/tuck the region brushes (1/2/3).
  The semantic-region/auto-layer workflow isn't used (Alex hand-paints varied tiles);
  IntGrid-on-by-default just renders as noise over the real map. Immediate workaround:
  uncheck the "IntGrid" box. (We set it on for the abandoned flat-design layout flow.)
- **Auto-layer rules empty (0/15)** — vestigial; tie off with the IntGrid removal.
- **BeastEditor batch ops** — missing explicit 32×32 size args (same class as the
  FurnitureEditor reload bug, `99656ef`). Latent; fix during the sprite/beast sweep.

## Workflow reminder
Editor "Save to branch" writes source only — Serberus/Jin builds + verifies + pushes.
No blind auto-build.
