// ── M49 s5: A SHIPYARD's GARAGE (hub #15840, 2026-11-21 world). PURE (no three/react/storage).
// The garage has one bay per courser its tier buys (SHIPYARD_TIERS.garage: 4 / 8 / 12). A bay holds a courser model id or
// nothing; saved per shipyard (open.garage:<id>, keeper-scoped). The rules:
//  · PARK = drive the courser you are driving into a free bay and stop: the bay holds its id.
//  · LEAVE = drive it out again: the bay frees. (A bay holding the DRIVEN courser is only true while the car is in it.)
//  · A bay holding another courser of yours stands it there (drawn, solid). On foot, E at it TAKES IT OUT: it becomes the
//    courser you drive, put in that bay, and the one you were driving must already be parked in a bay of THIS garage (so a
//    courser is never left on a road somewhere when you switch). Capacity = the bay count: a courser cannot park where none is free.
//  · A courser id sits in one bay at most (parking it elsewhere moves it).
export interface GarageState { v: 1; bays: (string | null)[] }
export const emptyGarage = (cap: number): GarageState => ({ v: 1, bays: Array.from({ length: cap }, () => null) })

/** a saved garage, trusted only as far as it is sane: the tier's bay count (a smaller tier drops the extras), known ids
 *  only (`known` = the keeper's owned coursers), each id once */
export function sanitizeGarage(raw: unknown, cap: number, known: readonly string[]): GarageState {
  const g = emptyGarage(cap)
  const bays = raw && typeof raw === 'object' && Array.isArray((raw as GarageState).bays) ? (raw as GarageState).bays : []
  const seen = new Set<string>()
  for (let k = 0; k < cap && k < bays.length; k++) {
    const id = bays[k]
    if (typeof id === 'string' && known.includes(id) && !seen.has(id)) { g.bays[k] = id; seen.add(id) }
  }
  return g
}

export const bayOf = (g: GarageState, id: string) => g.bays.indexOf(id)
export const freeBays = (g: GarageState) => g.bays.reduce<number[]>((a, b, k) => (b === null ? [...a, k] : a), [])

export type GarageEvent = { kind: 'parked' | 'left'; bay: number; id: string } | null
/** one look at the driven courser (`active`): in bay `carBay` (-1 = not in a bay), `still` = stopped. Parks it in a free bay
 *  it has stopped in, frees its bay once it is out of it. A bay that holds ANOTHER courser while the driven car is in it
 *  (a garage-panel swap made in the bay) takes the driven one: the other goes back to the fleet. */
export function garageStep(g: GarageState, active: string, carBay: number, still: boolean): { g: GarageState; ev: GarageEvent } {
  const at = bayOf(g, active)
  if (at >= 0 && at !== carBay) {
    const bays = g.bays.slice(); bays[at] = null
    return { g: { v: 1, bays }, ev: { kind: 'left', bay: at, id: active } }
  }
  if (carBay >= 0 && carBay < g.bays.length && at !== carBay && still) {
    const bays = g.bays.slice(); bays[carBay] = active
    return { g: { v: 1, bays }, ev: { kind: 'parked', bay: carBay, id: active } }
  }
  return { g, ev: null }
}

export type TakeRefusal = 'empty' | 'driving' | 'loose'
/** taking the courser in bay k out (on foot). `activeParked` = the driven courser stands parked in a bay of this garage. */
export function takeOutRefusal(g: GarageState, k: number, active: string, activeParked: boolean): TakeRefusal | null {
  const id = g.bays[k]
  if (!id) return 'empty'
  if (id === active) return 'driving'
  if (!activeParked) return 'loose'
  return null
}
