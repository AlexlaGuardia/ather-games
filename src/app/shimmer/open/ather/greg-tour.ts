// GREG'S TOUR (BETA M32, Alex 11-19). Pure: the stops Gregory walks a new keeper round at Moonwell Glade, and the path
// between them (round the pool, never through it). The scene (glade-greg.tsx) walks the rig; page.tsx runs the talk.
//
// ★ PARKED ON MAGII (CANON_GAPS 'A new keeper wakes at Moonwell Glade; Greg gives a tour'): the SHOW GARDEN (whose it is,
// every room standing, Moglins at the benches) and the leg at the keeper's own plot (Greg at the planning table). Until
// she rules, the tour only visits what already stands at the Glade: the pool, the five, Greg's house, the waymark stone.
// When she rules, the garden's stations slot in as more stops here; the walking, the talk and the skip do not change.
// ★ Every line below is a PLACEHOLDER for @lark (Alex signs). Checks import these; never retype them.
import type { Pt } from '../shared/folk-path'
import { aroundPath } from '../shared/folk-path'
import { MOONWELL } from './moonwell'
import { GREG_WAYMARK } from './waymarks'
import { FOLK_RING, gregSpot } from './moonwell-glade'
import { gladeHome, HOME_R } from './glade-home'

export const TOUR_ASK = 'Tell me about the Ather.'   // @lark PLACEHOLDER: the keeper's answer that starts the tour
export const TOUR_NEXT = 'Go on.'                    // @lark PLACEHOLDER
export const TOUR_SKIP = 'That will do, thanks.'     // @lark PLACEHOLDER: ends the tour at any stop
export const TOUR_DONE = 'Thanks, Greg.'             // @lark PLACEHOLDER: the last stop's answer

export interface TourStop { id: string; at: Pt; look: Pt; line: string }

/** a point `d` metres from `c` toward `p` */
const toward = (c: Pt, p: Pt, d: number): Pt => { const a = Math.atan2(p.x - c.x, p.z - c.z); return { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d } }
/** how wide Greg keeps of the pool's centre while walking (its rim + a stride) */
export const POOL_KEEP = MOONWELL.r + 1.1

export function tourStops(): TourStop[] {
  const pool = { x: MOONWELL.x, z: MOONWELL.z }, wm = { x: GREG_WAYMARK.x, z: GREG_WAYMARK.z }, home = gladeHome(), bench = gregSpot()
  const away = Math.atan2(pool.x - wm.x, pool.z - wm.z)   // bearing waymark -> pool: the five stand across the water
  const five = { x: pool.x + Math.sin(away) * FOLK_RING, z: pool.z + Math.cos(away) * FOLK_RING }
  return [
    { id: 'pool', at: toward(pool, bench, POOL_KEEP), look: pool,
      line: 'This is the Moonwell. Sit still by it at dusk and a rinn may come up.' },                          // @lark PLACEHOLDER
    { id: 'five', at: toward(pool, five, POOL_KEEP + 0.4), look: five,
      line: 'The Glade folk. Five of them, and each one wants something. Talk to them.' },                       // @lark PLACEHOLDER
    { id: 'home', at: toward(home, pool, HOME_R + 1.2), look: home,
      line: 'My house. Ground on the Ather is bought here, at my door.' },                                       // @lark PLACEHOLDER
    { id: 'waymark', at: toward(wm, pool, 1.6), look: wm,
      line: 'The waymark stone. Touch it and the fold map opens: home, and anywhere you have set a stone.' },   // @lark PLACEHOLDER
  ]
}

/** the walk from `from` to stop `i` (or back to the bench when `i` is past the last stop), round the pool */
export function tourLeg(from: Pt, i: number): Pt[] {
  const s = tourStops(), to = i < s.length ? s[i].at : gregSpot()
  return aroundPath(from, to, { x: MOONWELL.x, z: MOONWELL.z }, POOL_KEEP)
}
