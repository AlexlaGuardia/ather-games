// GREG'S TOUR (BETA M32, Alex 11-19). Pure: the stops Gregory walks a new keeper round, the path between them (round the pool,
// never through it), and what he gives at the end. The scene (glade-greg.tsx) walks the rig; page.tsx runs the talk + travel.
//
// ★ CANON (Magii RULED-AFK 11-19, athernyx fba7186 + 944ad1d):
//   (1) the show garden IS the Moonwell: the tour walks the five at their OWN trades (non-recruitable: they are home; cap 5).
//   (2) Greg walks to the keeper's plot for the planning-table talk, then goes home to the Glade (a visit; the plot stays theirs).
//   (3) the tour's END: Greg, first teacher, lights the first glove word = the 09-28 DEFAULT LOADOUT glove column, already in
//       code as play3d/vessels.ts GREG_GLOVE_PICK. No new names. (Earned words swap into the glove later.)
// ★ Every LINE below is SIGNED by Alex (11-19). Checks import these; never retype them.
import type { Pt } from '../shared/folk-path'
import { aroundPath } from '../shared/folk-path'
import type { Loadout } from '../shared/loadout'
import { MOONWELL, GLADE_GREEN } from './moonwell'
import { gladeClusterSpot } from './glade-cluster'
import { gladeFolk, gladeSpots, GLADE_TRADE, GLADE_LOTS, gregSpot } from './moonwell-glade'
import { TABLE } from './rooms'
import { bodyBlocked, clearSpot, routeAround, gladeStructures } from './obstacles'
import { GLADE } from './relief'
import { GREG_GLOVE_PICK } from '../../play3d/vessels'
import { KEEPER_MOVES } from '../../play3d/keeper-moves'

export const TOUR_ASK = 'Tell me about the Ather.'   // SIGNED by Alex 11-19: the keeper's answer that starts the tour
export const TOUR_NEXT = 'Go on.'                    // SIGNED by Alex 11-19
export const TOUR_SKIP = 'That will do, thanks.'     // SIGNED by Alex 11-19: jumps to the tour's end (the table, the glove word)
export const TOUR_DONE = 'Thanks, Greg.'             // SIGNED by Alex 11-19: the last stop's answer
export const GLOVE_GIVE = 'One more thing. Your glove. Here is its first word.'   // SIGNED by Alex 11-19: Greg's handover

/** `meets` = the folk Greg introduces at this stop (BETA M33: being introduced = met, so Morel may carry their calls). */
export interface TourStop { id: string; at: Pt; look: Pt; line: string; zone: 'glade' | 'plot'; meets?: string }

/** a point `d` metres from `c` toward `p` */
const toward = (c: Pt, p: Pt, d: number): Pt => { const a = Math.atan2(p.x - c.x, p.z - c.z); return { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d } }
/** how wide Greg keeps of the pond's centre while walking (its LONG radius + a stride: the whole ellipse sits inside; M40) */
export const POOL_KEEP = Math.max(MOONWELL.rx, MOONWELL.rz) + 1.5

/** M117 s2: Greg's body (a keeper-sized person) and where he may stand in the Glade: out of the pond's walking ring and clear
 *  of every structure (his home, the lots' stations and blueprint houses), by the shared obstacles.ts query */
export const GREG_R = 0.35
export const gregFree = (x: number, z: number) => Math.hypot(x - MOONWELL.x, z - MOONWELL.z) >= POOL_KEEP - 0.05 && !bodyBlocked(gladeStructures, x, GLADE.y, z, GREG_R)

/** a Glade folk's stop line (SIGNED by Alex 11-19) */
export const folkLine = (name: string, trade: string) => `This is ${name}, our ${trade}. A garden needs one, and this one is the best.`

/** The tour, in order: the Moonwell, each of the five present IN GREG'S GARDEN (beside them, at their trade), then the
 *  keeper's own planning table (on the plot). `folk` = who is home now (Fennel is away on her rinstick errand).
 *  ★ M67 s1b-2 (the closed Glade, hub 11-22 'A'): the tour walks Greg's garden only. Sax, Yarrow, Mallow and Hazel live in the
 *  friends' gardens 220-320 m off (glade-cluster.ts), too far for a walk-along, so they are met at their own gardens; and the
 *  waymark stop is gone (the waymark stone stayed in the Wilds; the Glade's way out is the gate, whose line is M68's). */
export function tourStops(folk: readonly { id: string; name: string }[] = gladeFolk()): TourStop[] {
  const pool = { x: MOONWELL.x, z: MOONWELL.z }, bench = gregSpot()
  folk = folk.filter(f => !gladeClusterSpot(f.id))
  // M40 (layout B): Greg walks the GREEN clockwise from the kitchen at its head (GLADE_LOTS order), each Moglin at their lot
  const rank = (id: string) => { const k = GLADE_LOTS.findIndex(l => l.id === id.split(':').pop()); return k < 0 ? 99 : k }
  folk = [...folk].sort((a, b) => rank(a.id) - rank(b.id))
  const spots = gladeSpots(folk.map(f => f.id)), green = { x: GLADE_GREEN.x, z: GLADE_GREEN.z }
  const five: TourStop[] = folk.map((f, k) => {
    const s = spots[k], inward = toward(s, green, 1.5)
    const side = { x: inward.x + Math.cos(s.yaw) * 1.7, z: inward.z - Math.sin(s.yaw) * 1.7 }   // well to the folk's side: a keeper behind him still sees them (0.9 hid Hazel)
    const k2 = f.id.split(':').pop() ?? f.id
    return { id: `folk:${k2}`, at: side, look: { x: s.x, z: s.z }, line: folkLine(f.name, GLADE_TRADE[k2] ?? 'neighbour'), zone: 'glade', meets: f.name }
  })
  // M117 s2: a stand point inside a structure (a blueprint house landing on a lot) moves out to the nearest clear spot
  for (const f of five) f.at = clearSpot(gregFree, f.at)
  return [
    { id: 'pool', at: clearSpot(gregFree, toward(pool, bench, POOL_KEEP)), look: pool, zone: 'glade',
      line: 'This is the Moonwell, and the five who keep it. See what a garden can be.' },                     // SIGNED by Alex 11-19
    ...five,
    { id: 'table', ...TABLE_STOP, zone: 'plot',
      line: 'And this is your corner of the Ather. Plan it here, at your table. More ground is bought at my door.' },   // SIGNED by Alex 11-19
  ]
}
/** where Greg stands at the keeper's planning table (plot coords), and where the keeper is set down facing him */
export const TABLE_STOP = { at: { x: TABLE.x + 1.6, z: TABLE.z - 1.2 }, look: { x: TABLE.x, z: TABLE.z } }
export const TABLE_KEEPER = { x: TABLE.x + 1.2, z: TABLE.z + 3.6 }   // ~4.8 m off Greg: on a phone both he and the table fit

/** the walk from `from` to stop `i` (or back to the bench when `i` is past the last Glade stop), round the pool AND (M117 s2)
 *  round every structure: planned on gregFree (obstacles.ts routeAround); the old pool-only arc is the fallback */
export function tourLeg(from: Pt, i: number, stops: readonly TourStop[] = tourStops()): Pt[] {
  const s = stops[i], to = s && s.zone === 'glade' ? s.at : gregSpot()
  return routeAround(gregFree, from, to) ?? aroundPath(from, to, { x: MOONWELL.x, z: MOONWELL.z }, POOL_KEEP)
}

/** the first glove word for this birth (the ruled 09-28 column), and its display name */
export function gloveWordFor(birth: string | null): { id: string; name: string } | null {
  const id = birth ? GREG_GLOVE_PICK[birth] : undefined
  const m = id ? KEEPER_MOVES.find(x => x.id === id) : undefined
  return id && m ? { id, name: m.name } : null
}
/** Greg lights the starter glove with the birth's word, ONLY while its seat is empty (an earned word is never overwritten).
 *  null = nothing to do (no birth, no glove, or it already holds a word). */
export function giveGloveWord(l: Loadout, birth: string | null): { loadout: Loadout; name: string } | null {
  const w = gloveWordFor(birth), g = l.vessels.find(v => v.id === 'starter-glove')
  if (!w || !g || g.word !== null) return null
  return { loadout: { ...l, vessels: l.vessels.map(v => (v.id === g.id ? { ...v, word: w.id, label: `${w.name} glove` } : v)) }, name: w.name }
}
