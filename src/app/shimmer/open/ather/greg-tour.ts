// GREG'S TOUR (BETA M32, Alex 11-19). Pure: the stops Gregory walks a new keeper round, the path between them (round the pool,
// never through it), and what he gives at the end. The scene (glade-greg.tsx) walks the rig; page.tsx runs the talk + travel.
//
// ★ CANON (Magii RULED-AFK 11-19, athernyx fba7186 + 944ad1d):
//   (1) the show garden IS the Moonwell: the tour walks the five at their OWN trades (non-recruitable: they are home; cap 5).
//   (2) Greg walks to the keeper's plot for the planning-table talk, then goes home to the Glade (a visit; the plot stays theirs).
//   (3) the tour's END: Greg, first teacher, lights the first glove word = the 09-28 DEFAULT LOADOUT glove column, already in
//       code as play3d/vessels.ts GREG_GLOVE_PICK. No new names. (Earned words swap into the glove later.)
// ★ Every LINE below is a PLACEHOLDER for @lark (Alex signs). Checks import these; never retype them.
import type { Pt } from '../shared/folk-path'
import { aroundPath } from '../shared/folk-path'
import type { Loadout } from '../shared/loadout'
import { MOONWELL } from './moonwell'
import { GREG_WAYMARK } from './waymarks'
import { gladeFolk, gladeSpots, GLADE_TRADE, gregSpot } from './moonwell-glade'
import { TABLE } from './rooms'
import { GREG_GLOVE_PICK } from '../../play3d/vessels'
import { KEEPER_MOVES } from '../../play3d/keeper-moves'

export const TOUR_ASK = 'Tell me about the Ather.'   // @lark PLACEHOLDER: the keeper's answer that starts the tour
export const TOUR_NEXT = 'Go on.'                    // @lark PLACEHOLDER
export const TOUR_SKIP = 'That will do, thanks.'     // @lark PLACEHOLDER: jumps to the tour's end (the table, the glove word)
export const TOUR_DONE = 'Thanks, Greg.'             // @lark PLACEHOLDER: the last stop's answer
export const GLOVE_GIVE = 'One more thing. Your glove. Here is its first word.'   // @lark PLACEHOLDER: Greg's handover

/** `meets` = the folk Greg introduces at this stop (BETA M33: being introduced = met, so Morel may carry their calls). */
export interface TourStop { id: string; at: Pt; look: Pt; line: string; zone: 'wilds' | 'plot'; meets?: string }

/** a point `d` metres from `c` toward `p` */
const toward = (c: Pt, p: Pt, d: number): Pt => { const a = Math.atan2(p.x - c.x, p.z - c.z); return { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d } }
/** how wide Greg keeps of the pool's centre while walking (its rim + a stride) */
export const POOL_KEEP = MOONWELL.r + 1.1

/** a Glade folk's stop line (@lark PLACEHOLDER) */
export const folkLine = (name: string, trade: string) => `This is ${name}, our ${trade}. A garden needs one, and this one is the best.`

/** The tour, in order: the Moonwell, each of the five present at the Glade (beside them, at their trade), the waymark stone,
 *  then the keeper's own planning table (on the plot). `folk` = who is home now (Fennel is away on her rinstick errand). */
export function tourStops(folk: readonly { id: string; name: string }[] = gladeFolk()): TourStop[] {
  const pool = { x: MOONWELL.x, z: MOONWELL.z }, wm = { x: GREG_WAYMARK.x, z: GREG_WAYMARK.z }, bench = gregSpot()
  const spots = gladeSpots(folk.map(f => f.id))
  const five: TourStop[] = folk.map((f, k) => {
    const s = spots[k], inward = toward(s, pool, 1.5)
    const side = { x: inward.x + Math.cos(s.yaw) * 1.7, z: inward.z - Math.sin(s.yaw) * 1.7 }   // well to the folk's side: a keeper behind him still sees them (0.9 hid Hazel)
    const k2 = f.id.split(':').pop() ?? f.id
    return { id: `folk:${k2}`, at: side, look: { x: s.x, z: s.z }, line: folkLine(f.name, GLADE_TRADE[k2] ?? 'neighbour'), zone: 'wilds', meets: f.name }
  })
  return [
    { id: 'pool', at: toward(pool, bench, POOL_KEEP), look: pool, zone: 'wilds',
      line: 'This is the Moonwell, and the five who keep it. See what a garden can be.' },                     // @lark PLACEHOLDER
    ...five,
    { id: 'waymark', at: toward(wm, pool, 1.6), look: wm, zone: 'wilds',
      line: 'The waymark stone. Touch it and the fold map opens: home, and anywhere you have set a stone.' },   // @lark PLACEHOLDER
    { id: 'table', ...TABLE_STOP, zone: 'plot',
      line: 'And this is your corner of the Ather. Plan it here, at your table. More ground is bought at my door.' },   // @lark PLACEHOLDER
  ]
}
/** where Greg stands at the keeper's planning table (plot coords), and where the keeper is set down facing him */
export const TABLE_STOP = { at: { x: TABLE.x + 1.6, z: TABLE.z - 1.2 }, look: { x: TABLE.x, z: TABLE.z } }
export const TABLE_KEEPER = { x: TABLE.x + 1.2, z: TABLE.z + 3.6 }   // ~4.8 m off Greg: on a phone both he and the table fit

/** the walk from `from` to stop `i` (or back to the bench when `i` is past the last Glade stop), round the pool */
export function tourLeg(from: Pt, i: number, stops: readonly TourStop[] = tourStops()): Pt[] {
  const s = stops[i], to = s && s.zone === 'wilds' ? s.at : gregSpot()
  return aroundPath(from, to, { x: MOONWELL.x, z: MOONWELL.z }, POOL_KEEP)
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
