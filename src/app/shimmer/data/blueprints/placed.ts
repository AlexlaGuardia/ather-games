// WHAT STANDS WHERE — the table of authored buildings the world places.
//
// ★ THIS FILE IS THE INTERFACE BETWEEN THE WORKTABLE AND THE WORLD. `dev/worktable` saves a
// blueprint into this directory; a row here is what makes it stand somewhere. The stamp math is
// `voxel/stamps.ts` (pure core); the JSON lives beside this file; the worker and the host both
// import THIS table, so there is one answer to "what is placed" — `placed.test.ts` reads both
// sources to prove neither forgot.
//
// ⚠ A ROW IS A PLACEMENT DECISION, AND MAP PLACEMENT IS ALEX'S CALL. Coordinates here are authored,
// never hashed from the seed. The first row is the PIPELINE PROOF, not a design: the sparring ring
// (the only blueprint on disk, 2026-08-30) stands a dozen blocks south-east of the Moonwell spawn (the glade falls away eastward; 128 is the pad) so the whole
// road — worktable → disk → column → screen — can be walked in one go. Move it when the glade is laid out.
//
// ★ `sink: 1` on the ring because its bottom layer IS the floor (path tiles, cut stone edging),
// meant at grade and not one step up like a stage. A cottage with a wall footing at y=0 sinks 0.
import type { Stamp } from '../../voxel/stamps'
import type { BlueprintDef } from '../../voxel/blueprints'
import sparringRing from './sparring_ring.json'
import hazelCarpentry from './hazel_carpentry.json'

export const PLACED_STAMPS: readonly Stamp[] = [
  { id: 'glade-sparring-ring', bp: sparringRing as BlueprintDef, x: -148, z: -637, rot: 0, sink: 1 },
  // Hazel's carpentry (scripts/blueprint-hazel.mts) — the first Moonwell trade building, on the pad
  // south-west of spawn with its open front toward the spawn column. ⚠ PROVISIONAL: the glade's
  // layout (where the five trades stand) is a map-placement call, which is Alex's.
  { id: 'glade-hazel-carpentry', bp: hazelCarpentry as BlueprintDef, x: -165, z: -632, rot: 0 },
]
