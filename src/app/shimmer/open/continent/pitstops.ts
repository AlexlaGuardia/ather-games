// PITSTOPS — the public doors off the Hallway on the Athernyx side (gates.md › THE HALLWAY, ruled 11-14 /magii + Alex):
// "each Athernyx city keeps one, the 08-12 public gate-landing as a door. The city keeps it, the keeper only unlocks it
// by visiting." Rune Hold's square is the original 08-12 landing, so it is always open.
//
// Which places count: continent.json kind 'city', plus Rune Hold. Villages and settlements keep none (the ruling says
// city); widening that is a canon question, not a build tweak.
//
// Shared with the world lane: its gate's Athernyx side lists pitstopsUnlocked() so both sides show the same doors.
// Storage: localStorage 'open.pitstops.v1' = JSON string[] of visited ids. Per browser, like the fog and waymarks.

export const PITSTOP_KEY = 'open.pitstops.v1'
/** The 08-12 public gate-landing. Always a door, never needs unlocking. */
export const FIRST_PITSTOP = 'rune-hold'
/** How close counts as visiting (metres from the place's centre). */
export const VISIT_M = 60

export interface PlaceLike { id: string; name?: string | null; kind?: string; x: number; z: number }
export interface Pitstop { id: string; name: string; x: number; z: number }

export const isPitstop = (p: PlaceLike) => !!p.name && (p.kind === 'city' || p.id === FIRST_PITSTOP)

export function loadVisited(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(PITSTOP_KEY) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])
  } catch { return new Set() }
}

/** Every pitstop on the map, unlocked or not (the map draws the locked ones dim). */
export const allPitstops = (places: readonly PlaceLike[]): Pitstop[] =>
  places.filter(isPitstop).map(p => ({ id: p.id, name: p.name!, x: p.x, z: p.z }))

/** The doors this keeper can use: Rune Hold always, plus every city they have visited. Continent world coords. */
export function pitstopsUnlocked(places: readonly PlaceLike[], visited: Set<string> = loadVisited()): Pitstop[] {
  return allPitstops(places).filter(p => p.id === FIRST_PITSTOP || visited.has(p.id))
}

/** Mark a pitstop visited. Returns the pitstop if this call unlocked it (for a toast), else null. */
export function visitNear(places: readonly PlaceLike[], x: number, z: number, visited: Set<string> = loadVisited()): Pitstop | null {
  for (const p of allPitstops(places)) {
    if (p.id === FIRST_PITSTOP || visited.has(p.id) || Math.hypot(p.x - x, p.z - z) > VISIT_M) continue
    visited.add(p.id)
    try { localStorage.setItem(PITSTOP_KEY, JSON.stringify([...visited])) } catch { /* private window: this session keeps it */ }
    return p
  }
  return null
}
