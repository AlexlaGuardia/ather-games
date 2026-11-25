// ── BETA M153 s1c-1: WHERE THE GLADE'S PEOPLE STAND ──
// The published spots the owner gave them in Place mode (world/builder-props.ts `who:` pieces), else nothing: the code's own spot. This
// holds the spots; the resolvers are the functions everything already asked (moonwell-glade gregSpot / newbornSpot / gladeSpots,
// glade-cluster gladeKeepers / gladeClusterFolk), so every reader (figures, E, markers, map, tour, builder) gets one answer. ASK AT THE
// CALL, never keep one at module load; a memo keys on gladePeopleVersion(). Set by fetchGladeLayer (the game) and by the builder's draft.
// Pure; glade-people.test.ts.
import { placeOf, whoOf, yawOfQ, type Place, type Prop, type Who } from '../../world/builder-props'

export interface WhoSpot { x: number; z: number; yaw: number; turned: boolean }
let spots: ReadonlyMap<Who, WhoSpot> = new Map(), places: ReadonlyMap<Place, WhoSpot> = new Map()   // s1c-2: the houses (moonwell-glade lotAt, glade-home gladeHome, glade-lots yarrowCrate ask it)
let version = 0, key = ''
export function setGladePeople(props: readonly Prop[] | undefined) {
  const m = new Map<Who, WhoSpot>(), h = new Map<Place, WhoSpot>()
  for (const p of props ?? []) { const w = whoOf(p.k); if (w) m.set(w, { x: p.x, z: p.z, yaw: yawOfQ(p.q), turned: !!p.turned }); const pl = placeOf(p.k); if (pl) h.set(pl, { x: p.x, z: p.z, yaw: yawOfQ(p.q), turned: false }) }
  const k = JSON.stringify([[...m], [...h]]); if (k === key) return
  key = k; spots = m; places = h; version++
}
export const gladePerson = (id: string): WhoSpot | null => spots.get((id.split(':').pop() ?? id) as Who) ?? null
/** a moved house, or null: the code's own spot */
export const gladePlace = (id: string): WhoSpot | null => places.get(id as Place) ?? null
export const gladePeopleVersion = () => version

// the game's first answer: a newborn must not wake on the code's spot because the layer was still on its way
let known = false, waiting: (() => void)[] = []
export const gladePeopleKnown = () => known
/** the layer came (or could not be read): whoever waits for it goes on */
export function gladePeopleAnswered() { known = true; const w = waiting; waiting = []; w.forEach(f => f()) }
export function whenGladePeopleKnown(f: () => void) { if (known) { f(); return } waiting.push(f); setTimeout(() => { if (!known) gladePeopleAnswered() }, 4000) }
