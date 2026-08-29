// Every workstation in the world, keyed by the material a keeper walks up to.
//
// ⚠ THIS FILE EXISTS TO BREAK A CYCLE, and that is the whole reason it is separate. `brew.ts` imports
// `station.ts` for the refusal ladder, so a registry living in `station.ts` that imported the
// cauldron back would be circular. Here, one module knows both and neither knows it.
//
// ⚠ REGISTERED, NOT DISCOVERED. A station is a deliberate thing with a canon name. A registry that
// scanned for "blocks that have recipes" would invent a station the day some unrelated block grew a
// recipe field, and it would do it silently.
//
// ⏳ ONE ENTRY, AND THAT IS CORRECT TODAY. The furnace that would be the second is parked on a canon
// gap (`CANON_GAPS.md` 2026-08-29 — canon names fired clay and hand-blown glass as native but has no
// kiln, forge or furnace anywhere, and *furnace* is the one word the "metal in the Ather is evidence"
// engine may forbid). Adding one is a `StationDef` in its own system's file plus a line here.

import type { StationDef } from './station'
import { CAULDRON } from './brew'

/** Every station, in no particular order — `stationFor` is the only reader that matters. */
export const STATIONS: readonly StationDef<never>[] = [CAULDRON as unknown as StationDef<never>]

/**
 * The station a keeper is standing at, or null for an ordinary block.
 *
 * ⚠ Asks the REGISTRY, never a material range. Station materials are scattered across the id space
 * by history (the cauldron is 57, between a chest and the element herbs), so any range test would be
 * a second derivation that drifts the first time a station is added out of order.
 */
export function stationFor(material: number): StationDef<never> | null {
  return STATIONS.find(s => s.material === material) ?? null
}
