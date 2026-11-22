// ather/greg-tour.ts: the tour visits the Moonwell, each of the five at home IN GREG'S GARDEN (Magii fba7186; M67 s1b-2: the
// closed Glade, where only Fennel lives in his garden and the waymark stayed in the Wilds), then the keeper's planning table; every Glade leg keeps out of the pool and Greg's house; the glove word is the ruled 09-28 column and never
// overwrites an earned word (944ad1d).
import { tourStops, tourLeg, giveGloveWord, gloveWordFor, POOL_KEEP, TABLE_STOP, TABLE_KEEPER, TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE } from './greg-tour'
import { segClear, type Pt } from '../shared/folk-path'
import { MOONWELL, fromShore } from './moonwell'
import { gladeHome, HOME_R } from './glade-home'
import { gregSpot, gladeFolk, gladeSpots } from './moonwell-glade'
import { gladeClusterSpot } from './glade-cluster'
import { TABLE } from './rooms'
import { GREG_GLOVE_PICK } from '../../play3d/vessels'
import { newLoadout } from '../shared/loadout'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const pool = { x: MOONWELL.x, z: MOONWELL.z }, home = gladeHome()
const five = [{ id: 'moonwell:hazel', name: 'Hazel' }, { id: 'moonwell:sax', name: 'Sax' }, { id: 'moonwell:yarrow', name: 'Yarrow' }, { id: 'moonwell:fennel', name: 'Fennel' }, { id: 'moonwell:mallow', name: 'Mallow' }]
const s = tourStops(five)
ok(s.map(x => x.id).join() === 'pool,folk:fennel,table', `the order (s1b-2): pool, the folk of Greg's garden (Fennel), table (${s.map(x => x.id).join()})`)
ok(s.filter(x => x.zone === 'plot').length === 1 && s[s.length - 1].zone === 'plot', 'one plot stop, and it is the last')
ok(tourStops(five.filter(f => f.name !== 'Fennel')).every(x => x.id !== 'folk:fennel'), 'a folk away from home (Fennel on her errand) is not a stop')
ok(tourStops().length === gladeFolk().filter(f => !gladeClusterSpot(f.id)).length + 2, 'the default reads who is home now (in Greg\'s garden)')
const tourOrder = ['fennel'].map(k => five.find(f => f.id.endsWith(k))!)
const spots = gladeSpots(tourOrder.map(f => f.id))
for (const t of s.filter(x => x.zone === 'glade')) {
  ok(fromShore(t.at.x, t.at.z) >= 0.5, `${t.id}: Greg stands out of the water`)
  ok(Math.hypot(t.at.x - home.x, t.at.z - home.z) >= HOME_R + 0.5, `${t.id}: Greg stands outside his house`)
  ok(Math.hypot(t.at.x - t.look.x, t.at.z - t.look.z) > 1, `${t.id}: what he shows is a step away from him`)
  for (const f of spots) ok(Math.hypot(t.at.x - f.x, t.at.z - f.z) > 0.8, `${t.id}: not standing inside ${f.id}`)
}
for (const t of s) ok(t.line.length > 0 && t.line.length < 120, `${t.id}: one bubble's worth of line`)
s.filter(x => x.id.startsWith('folk:')).forEach((t, k) => ok(t.look.x === spots[k].x && t.look.z === spots[k].z && t.line.includes(tourOrder[k].name), `${t.id}: shows that folk, by name`))
// the table: Greg beside it, the keeper set down facing him, a step apart
ok(Math.hypot(TABLE_STOP.at.x - TABLE.x, TABLE_STOP.at.z - TABLE.z) < 3 && Math.hypot(TABLE_KEEPER.x - TABLE_STOP.at.x, TABLE_KEEPER.z - TABLE_STOP.at.z) > 1.5, 'the table stop: Greg beside the table, the keeper a step off')
// walk every Glade leg as the scene does: bench -> each Glade stop -> back to the bench
let at: Pt = gregSpot(), legsOk = true
const glade = s.filter(x => x.zone === 'glade')
for (let i = 0; i <= glade.length; i++) {
  const leg = tourLeg(at, i, glade)
  let prev = at
  for (const q of leg) {
    for (let u = 0; u <= 8; u++) { const x = prev.x + (q.x - prev.x) * u / 8, z = prev.z + (q.z - prev.z) * u / 8; if (fromShore(x, z) < 0.2) { legsOk = false; console.log('   pool cut on leg', i); break } }
    if (!segClear(prev, q, home, HOME_R + 0.1)) { legsOk = false; console.log('   house cut on leg', i) }
    prev = q
  }
  at = leg[leg.length - 1]
}
ok(legsOk, 'no Glade leg walks through the pool or the house')
ok(Math.hypot(at.x - gregSpot().x, at.z - gregSpot().z) < 1e-9, 'past the Glade stops he walks back to his bench')
ok(tourLeg(gregSpot(), s.length - 1, s).length >= 1, 'the table index walks him home (he is not drawn at the Glade meanwhile)')
ok(POOL_KEEP > Math.max(MOONWELL.rx, MOONWELL.rz), 'the walking ring is outside the whole pond')
ok(new Set([TOUR_ASK, TOUR_NEXT, TOUR_SKIP, TOUR_DONE]).size === 4, 'the four answer labels are distinct')
// the glove word: the ruled column for every birth, lit only into an EMPTY starter glove
for (const b of Object.keys(GREG_GLOVE_PICK)) ok(gloveWordFor(b)?.id === GREG_GLOVE_PICK[b], `${b}: the glove word is the ruled column (${gloveWordFor(b)?.name})`)
ok(gloveWordFor(null) === null && gloveWordFor('nope') === null, 'no birth / unknown birth: no word')
{ const l = newLoadout(), r = giveGloveWord(l, 'star')
  const g = r?.loadout.vessels.find(v => v.id === 'starter-glove')
  ok(!!r && g?.word === 'firestorm' && r.name === 'Firestorm' && g.label === 'Firestorm glove', 'Star: the starter glove lights Firestorm')
  ok(r!.loadout.vessels.find(v => v.id === 'starter-bracelet')?.word === null, 'the bracelet is untouched (its word is the first errand)')
  ok(giveGloveWord(r!.loadout, 'star') === null, 'given once: a second ask does nothing')
  const earned = { ...l, vessels: l.vessels.map(v => v.id === 'starter-glove' ? { ...v, word: 'gate' } : v) }
  ok(giveGloveWord(earned, 'star') === null, 'an earned word in the glove is never overwritten') }

console.log(`greg-tour: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
