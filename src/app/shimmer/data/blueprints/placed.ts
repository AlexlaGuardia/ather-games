// WHAT STANDS WHERE — the table of authored buildings the world places.
//
// ★ THIS FILE IS THE INTERFACE BETWEEN THE WORKTABLE AND THE WORLD. `dev/worktable` saves a
// blueprint into this directory and, since 2026-09-11, its "place in world" button writes a row into
// `placed.table.json` through `/shimmer/save-placement`. The stamp math is `voxel/stamps.ts` (pure core);
// the worker and the host both import THIS table, so there is one answer to "what is placed" —
// `placed.test.ts` reads both sources to prove neither forgot.
//
// ⚠ A ROW IS A PLACEMENT DECISION, AND MAP PLACEMENT IS ALEX'S CALL. Coordinates are authored, never
// hashed from the seed. ⚠ AND A ROW ON DISK IS NOT A ROW IN THE WORLD UNTIL THE NEXT DEPLOY: both
// consumers import this module at build time (the worker is an esbuild bundle), exactly as a saved
// blueprint is on disk but not in the game until `coord build`. The worktable says so on the button.
//
// ★ THE TABLE IS NAMED `placed.table.json` ON PURPOSE: a blueprint id may not contain a dot
// (`SAFE_BLUEPRINT_ID`), so no saved building can ever be written over the table, and every lister
// in this directory skips a file the id rule cannot name.
//
// ★ ROWS RESOLVE AGAINST THE GENERATED INDEX, AND AN UNRESOLVED ROW IS DROPPED HERE AND REFUSED BY
// THE GUARD. Dropping keeps a stale row from crashing the worker at import; the guard keeps it from
// being silent. `placed.table.json` is validated by `placementProblems` on the way in (the route) and on
// the way out (`placed.test.ts`).
import type { Stamp } from '../../voxel/stamps'
import type { PlacementRow } from '../../voxel/placement'
import { BLUEPRINT_FILES } from './index.generated'
import rows from './placed.table.json'

export const PLACED_ROWS: readonly PlacementRow[] = rows as PlacementRow[]

export const PLACED_STAMPS: readonly Stamp[] = PLACED_ROWS.flatMap(r => {
  const bp = BLUEPRINT_FILES[r.blueprint]
  if (!bp) return []
  const s: Stamp = { id: r.id, bp, x: r.x, z: r.z, rot: r.rot }
  if (r.sink) s.sink = r.sink
  return [s]
})
