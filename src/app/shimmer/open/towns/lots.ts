// LOTS FOR SALE: the seam between the town plans (play lane) and the tycoon economy (world lane), 2026-11-15.
//
// ★ PURE, node-safe. The economy never places a building by hand: a lot IS a building the town plan already stands up,
// offered for sale. The plan stays play's; the economy keys its purchases on `Lot.id`.
//
// ── THE ID IS THE BUILDING'S PLACE, NOT ITS INDEX ───────────────────────────────────────────────────────────────────
// World asked for `${town}:${index}`. An index shifts the moment the generator is tuned (one lot more on a street
// renumbers every lot after it), and then a saved purchase silently points at a DIFFERENT building, which reads as
// working. So the id is the footprint's centre, rounded to the metre: `${town}:${x}:${z}`. If a tune moves or removes
// that building, `lotById` answers undefined and the economy can say so, instead of handing over somebody else's
// house. LOTS_VERSION bumps whenever a change to the generator is known to move lots.
import type { Region } from '../region'
import { cachedPlan } from '../foot-solids'
import type { Building } from './plan'

export const LOTS_VERSION = 4   // 11-16: street-floor rule; the Enchant Temple moved Rune Hold -> the Citadel square

export interface Lot {
  /** `${townId}:${x}:${z}` (the footprint's centre, metres): stable for as long as the building stands where it does */
  id: string
  town: string
  x: number; z: number
  /** the facade faces the street along this heading (plan.ts yaw) */
  yaw: number
  /** along the street, and away from it (metres) */
  w: number; d: number
  /** where a keeper stands to interact: on the street, 2 m out from the front door */
  door: { x: number; z: number }
  /** the plan's building kind (house | cottage | hall) */
  kind: string
  /** rough size/price band by floor area: 0 small (< 80 m²), 1 middling (< 130 m²), 2 large */
  tier: 0 | 1 | 2
}

const lotOf = (town: string, b: Building): Lot => {
  const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), area = b.w * b.d
  return {
    id: `${town}:${Math.round(b.x)}:${Math.round(b.z)}`, town, x: b.x, z: b.z, yaw: b.yaw, w: b.w, d: b.d,
    door: { x: b.x + fx * (b.d / 2 + 2), z: b.z + fz * (b.d / 2 + 2) },
    kind: b.kind, tier: area < 80 ? 0 : area < 130 ? 1 : 2,
  }
}

/** Every building in a town that can be sold: the GENERATED houses. Authored ones (Rune Hold's grid, the storefronts,
 *  the Grand Exchange, the Fallen Cap) are canon places and never for sale. An unknown or empty town answers []. */
export function lotsForSale(R: Region, townId: string): Lot[] {
  const i = R.meta.places.findIndex(p => p.id === townId)
  if (i < 0) return []
  return cachedPlan(R, i).buildings.filter(b => !b.core && !b.front).map(b => lotOf(townId, b))
}

/** The lot an id names, if its building still stands there. */
export function lotById(R: Region, id: string): Lot | undefined {
  const town = id.split(':')[0]
  return lotsForSale(R, town).find(l => l.id === id)
}
