// ather/greg-tour.ts: the tour's stops stand on open ground at the Glade, and every leg Greg walks keeps out of the pool
// and out of his house.
import { tourStops, tourLeg, POOL_KEEP, TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE } from './greg-tour'
import { segClear, type Pt } from '../shared/folk-path'
import { MOONWELL } from './moonwell'
import { gladeHome, HOME_R } from './glade-home'
import { gregSpot } from './moonwell-glade'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const pool = { x: MOONWELL.x, z: MOONWELL.z }, home = gladeHome()
const s = tourStops()
ok(s.length >= 4 && new Set(s.map(x => x.id)).size === s.length, `${s.length} stops, ids unique`)
for (const t of s) {
  ok(Math.hypot(t.at.x - pool.x, t.at.z - pool.z) >= MOONWELL.r + 0.5, `${t.id}: Greg stands out of the water`)
  ok(Math.hypot(t.at.x - home.x, t.at.z - home.z) >= HOME_R + 0.5, `${t.id}: Greg stands outside his house`)
  ok(Math.hypot(t.at.x - t.look.x, t.at.z - t.look.z) > 1, `${t.id}: what he shows is a step away from him`)
  ok(t.line.length > 0 && t.line.length < 120, `${t.id}: one bubble's worth of line`)
}
// walk the whole tour as the scene does: bench -> each stop -> back to the bench
let at: Pt = gregSpot(), legsOk = true
for (let i = 0; i <= s.length; i++) {
  const leg = tourLeg(at, i)
  let prev = at
  for (const q of leg) {
    if (!segClear(prev, q, pool, MOONWELL.r + 0.2)) { legsOk = false; console.log('   pool cut on leg', i) }
    if (!segClear(prev, q, home, HOME_R + 0.1)) { legsOk = false; console.log('   house cut on leg', i) }
    prev = q
  }
  at = leg[leg.length - 1]
}
ok(legsOk, 'no leg of the tour walks through the pool or the house')
ok(Math.hypot(at.x - gregSpot().x, at.z - gregSpot().z) < 1e-9, 'the tour ends back at his bench')
ok(POOL_KEEP > MOONWELL.r, 'the walking ring is outside the rim')
ok(new Set([TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE]).size === 4, 'the four answer labels are distinct')

console.log(`greg-tour: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
