// ── BETA M153 s1c-1: WHERE THE GLADE'S PEOPLE STAND ──
// The published spots the owner gave them in Place mode (world/builder-props.ts `who:` pieces), else nothing: the code's own spot. This
// holds the spots; the resolvers are the functions everything already asked (moonwell-glade gregSpot / newbornSpot / gladeSpots,
// glade-cluster gladeKeepers / gladeClusterFolk), so every reader (figures, E, markers, map, tour, builder) gets one answer. ASK AT THE
// CALL, never keep one at module load; a memo keys on gladePeopleVersion(). Set by fetchGladeLayer (the game) and by the builder's draft.
// Pure; glade-people.test.ts.
import { whoOf, yawOfQ, type Prop, type Who } from '../../world/builder-props'

export interface WhoSpot { x: number; z: number; yaw: number; turned: boolean }
let spots: ReadonlyMap<Who, WhoSpot> = new Map()
let version = 0, key = ''
export function setGladePeople(props: readonly Prop[] | undefined) {
  const m = new Map<Who, WhoSpot>()
  for (const p of props ?? []) { const w = whoOf(p.k); if (w) m.set(w, { x: p.x, z: p.z, yaw: yawOfQ(p.q), turned: !!p.turned }) }
  const k = JSON.stringify([...m]); if (k === key) return
  key = k; spots = m; version++
}
export const gladePerson = (id: string): WhoSpot | null => spots.get((id.split(':').pop() ?? id) as Who) ?? null
export const gladePeopleVersion = () => version

// the game's first answer: a newborn must not wake on the code's spot because the layer was still on its way
let known = false, waiting: (() => void)[] = []
export const gladePeopleKnown = () => known
/** the layer came (or could not be read): whoever waits for it goes on */
export function gladePeopleAnswered() { known = true; const w = waiting; waiting = []; w.forEach(f => f()) }
export function whenGladePeopleKnown(f: () => void) { if (known) f(); else waiting.push(f) }
