// The full zone registry: legacy zones + the WIP region maps.
//
// Why this aggregate lives OUTSIDE ZONES: the save-map createZone surgery inserts new zone
// entries before the LAST `]` in zones.ts — appending `...REGION_ZONES` inside that array
// (or any code after it) would silently retarget the insertion point. zones.ts stays the
// legacy file the surgery owns; consumers that should see regions import from here.

import { ZONES, type Zone } from './zones'
import { REGION_ZONES } from './region-maps'

export const ALL_ZONES: Zone[] = [...ZONES, ...REGION_ZONES]
