# Archived: 2D Shimmer (the original top-down game)

**Archived 2026-07-21.** `ShimmerPage.2d.tsx.bak` was `src/app/shimmer/page.tsx` — the
original top-down 2D Shimmer (character select Alkin/Kael/Alex, spirits, party, skills,
stations, grimoire).

## Why it's here and not live
**play3d is Shimmer now.** The first-person 3D game at `src/app/shimmer/play3d/` is:
- the front door (the /room "Shimmer — the world" wall points to `/shimmer/play3d`),
- where all recent work goes (72 commits/90d vs the 2D's 31; 2D last touched 2026-07-07,
  play3d touched daily),
- feature-complete on its own (battle, party, spirits, skills, stations, fishing, crops,
  beasts) — it does NOT depend on this file.

The 2D game had become orphaned (nothing linked to bare `/shimmer`) but kept pulling
sessions into "which game are we in?" circles. Archiving it settles that: **there is one
live Shimmer, and it's play3d.**

## Renamed to `.tsx.bak` on purpose
tsconfig compiles every `**/*.tsx`. The `.bak` extension keeps this out of the build so a
future change to shared `shimmer/` code can't break on this dead file — it's reference
only, preserved in git history. Do NOT restore it as a route without a deliberate decision
to revive the 2D line.

Shared code it used (`shimmer/engine`, `data`, `components`, `sprites`, `world`) stays live
— play3d uses it too. Only this entry point was archived.
