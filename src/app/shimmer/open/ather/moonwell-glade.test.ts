// M30 Moonwell Glade. Run: npx tsx src/app/shimmer/open/ather/moonwell-glade.test.ts
import { GLADE, GLADE_ID, gladeFolk, mallowWants, MALLOW_POOL, isGlade, GLADE_STAYS, GLADE_TRADE, GLADE_LOTS, lotAt, gladeSpots, gregSpot, newbornSpot, NEWBORN_GAP, gladeJetty, GLADE_LAYOUT, gladeAt, LOT_D } from './moonwell-glade'
import { folkOf } from './settlement-folk'
import { withGlade, settlementAt, type Network } from './network'
import { MOONWELL, GLADE_GREEN, GLADE_ANCHOR, fromShore, atWater, SCALE_AT } from './moonwell'
import { gladeHome } from './glade-home'
import { itemDef } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const five = folkOf(GLADE, 1)
ok(five.map(f => f.name).join(',') === 'Hazel,Sax,Yarrow,Fennel,Mallow', `the five, canon names (${five.map(f => f.name)})`)
ok(JSON.stringify(folkOf(GLADE, 1).map(f => f.id)) === JSON.stringify(folkOf(GLADE, 9).map(f => f.id)), 'fixed: the season never re-rolls them')
ok(five.every(f => f.home === GLADE_ID && f.employed && f.wants.length > 0 && isGlade(f.id) && isGlade(f.home)), 'all settled with want-lists, all of the Glade')
ok(five.every(f => f.wants.every(w => !!itemDef(w.id))), `every want is a real item (${five.flatMap(f => f.wants.map(w => w.id)).filter(id => !itemDef(id))})`)
ok(five.every(f => !!f.dream), 'every one has a hello line')
ok(five.find(f => f.name === 'Mallow')!.profession === 'shopkeeper' && GLADE_TRADE.yarrow === 'bait-maker' && five.find(f => f.name === 'Yarrow')!.profession === 'rinnshop', "Mallow is the shopkeeper; Yarrow is the bait-maker (re-ruled 11-21), works the Rinnshop")
const wk = 7 * 86_400_000
ok(mallowWants(0)[0].id !== mallowWants(wk)[0].id && mallowWants(wk * MALLOW_POOL.length)[0].id === mallowWants(0)[0].id, "Mallow's list changes weekly and cycles")
ok(GLADE.x === GLADE_GREEN.x && GLADE.z === GLADE_GREEN.z, 'the Glade sits on the green (M40 layout B)')
// ── M40 layout B (mock: docs/looks/moonwell-glade.html, 0.25 m a pixel)
ok(GLADE_GREEN.x === GLADE_ANCHOR.x && Math.abs(GLADE_ANCHOR.z - GLADE_GREEN.z - 30.75) < 1e-9, 'the anchor (once the waymark) is the green\'s open south end (s1b-2: in the closed Glade)')
ok(MOONWELL.x < GLADE_GREEN.x - 40 && MOONWELL.rx === 20.5 && MOONWELL.rz === 24.5, 'the pond is ~41 x 49 m, west of the green')
ok(fromShore(GLADE_GREEN.x, GLADE_GREEN.z) > GLADE_GREEN.r, 'the green is dry ground, clear of the pond')
const order = GLADE_LOTS.map(l => l.id).join(',')
ok(order === 'fennel,hazel,sax,yarrow,mallow', `the kitchen at the head, then clockwise Hazel, Sax, Yarrow, Mallow (${order})`)
const ang = GLADE_LOTS.map(l => Math.atan2(l.dx, -l.dz))   // clockwise from north, seen from above
ok(ang.every((a, k) => k === 0 || (((a - ang[k - 1]) + 2 * Math.PI) % (2 * Math.PI)) < Math.PI), 'the lots run clockwise round the green')
for (const l of GLADE_LOTS) {
  const w = lotAt(l.id)!, d = Math.hypot(w.x - GLADE_GREEN.x, w.z - GLADE_GREEN.z)
  ok(d - LOT_D / 2 > GLADE_GREEN.r + 2 && fromShore(w.x, w.z) > 8, `${l.id}'s lot sits off the green and out of the pond (${d.toFixed(1)} m out)`)
  ok(Math.hypot(w.x + Math.sin(w.yaw) * -d - GLADE_GREEN.x, w.z + Math.cos(w.yaw) * -d - GLADE_GREEN.z) < 0.01, `${l.id}'s lot faces the green`)
}
for (let a = 0; a < GLADE_LOTS.length; a++) for (let b = a + 1; b < GLADE_LOTS.length; b++) {
  const p = lotAt(GLADE_LOTS[a].id)!, q = lotAt(GLADE_LOTS[b].id)!
  ok(Math.hypot(p.x - q.x, p.z - q.z) > 12, `${p.id} and ${q.id} lots do not overlap`)
}
const spots = gladeSpots(five.map(f => f.id))
ok(spots.every(s => { const l = lotAt(s.id.split(':')[1])!; return Math.hypot(s.x - l.x, s.z - l.z) < 4.5 && Math.hypot(s.x - GLADE_GREEN.x, s.z - GLADE_GREEN.z) < Math.hypot(l.x - GLADE_GREEN.x, l.z - GLADE_GREEN.z) }), 'each Moglin stands at the front of their own lot, toward the green')
ok(spots.every(s => Math.abs(Math.atan2(GLADE_GREEN.x - s.x, GLADE_GREEN.z - s.z) - s.yaw) < 1e-9), 'each faces the green')
const home = gladeHome(), bench = gregSpot()
ok(fromShore(home.x, home.z) > 3 && fromShore(home.x, home.z) < 16 && Math.hypot(home.x - (GLADE_GREEN.x + GLADE_LAYOUT.home.dx), home.z - (GLADE_GREEN.z + GLADE_LAYOUT.home.dz)) < 1e-9, 'Greg\'s home stands near the pond\'s shore, dry')
ok(Math.hypot(bench.x - GLADE_GREEN.x, bench.z - GLADE_GREEN.z) < Math.hypot(home.x - GLADE_GREEN.x, home.z - GLADE_GREEN.z), 'his bench is between his home and the green')
const j = gladeJetty(); ok(fromShore(j.x0, j.z0) > 0 && fromShore(j.x1, j.z1) < -4, 'the jetty runs from the bank out over the water')
ok(atWater(SCALE_AT.x, SCALE_AT.z) && fromShore(SCALE_AT.x, SCALE_AT.z) > 0, 'the rinn scale lies on the bank, at the water')
void gladeAt
const net: Network = { v: 1, season: 1, settlements: [{ id: 's1-0', name: 'X', x: 900, z: 900 }], paths: [], fair: null }
const g = withGlade(net)
ok(g.settlements.length === 1 && !g.settlements.some(s => s.id === GLADE_ID), 'M67 s1b-2: a season network no longer gains the Glade (it left the Wilds)')
{ const gn: Network = { ...net, settlements: [GLADE] }; ok(settlementAt(gn, GLADE_GREEN.x, GLADE_GREEN.z + 5)?.id === GLADE_ID && GLADE_LOTS.every(l => settlementAt(gn, lotAt(l.id)!.x, lotAt(l.id)!.z)?.id === GLADE_ID), 'the green and every lot = in Moonwell Glade (its talk anchor)') }
ok(GLADE_STAYS.length > 0, 'the stay-home line exists (lark placeholder)')
// M31 born beside Greg, keyed off HIS spot (11-22: M40 moved the pond and the old waymark spawn sat 57.7 m away)
{ const g = gregSpot(), n = newbornSpot(), d = Math.hypot(n.x - g.x, n.z - g.z)
  ok(d > 2 && d < 10 && Math.abs(d - NEWBORN_GAP) < 1e-9, `newborn within 10 m of Greg (${d.toFixed(2)} m)`)
  const fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw), off = Math.acos(Math.max(-1, Math.min(1, (fx * (g.x - n.x) + fz * (g.z - n.z)) / d)))
  ok(off < 1e-6, `newborn faces Greg (${(off * 180 / Math.PI).toFixed(3)} deg off)`)
  ok(!atWater(n.x, n.z), 'newborn stands on dry ground, not in the pond')
  ok(Math.hypot(n.x - GLADE_GREEN.x, n.z - GLADE_GREEN.z) < Math.hypot(g.x - GLADE_GREEN.x, g.z - GLADE_GREEN.z), 'newborn is on the green side of his bench')
  void n }   // (the old Wilds waymark spawn check retired with M67 s1b-2: the newborn is in the closed Glade)
console.log(`moonwell-glade: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
