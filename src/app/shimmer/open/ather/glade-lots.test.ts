// Run: npx tsx src/app/shimmer/open/ather/glade-lots.test.ts
// M40 part 2: the five's station blockouts sit on their own pads, nothing solid stands where a Moglin stands, a keeper walks
// straight from the green to each of the five, and the jetty runs from the bank over the water.
import { STATIONS, partAt, stationBoxes, jettyBoxes } from './glade-lots'
import { GLADE_LOTS, lotAt, onLot, gladeSpots, gladeJetty } from './moonwell-glade'
import { GLADE_GREEN, fromShore } from './moonwell'
import { BODY_R } from '../shared/locomotion'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

for (const l of GLADE_LOTS) {
  const parts = STATIONS[l.id] ?? [], lot = lotAt(l.id)!
  ok(parts.length >= 3, `${l.id}: a station of a few parts (${parts.length})`)
  const inside = parts.every(p => Math.abs(p.side) + p.w / 2 <= lot.w / 2 + 0.01 && Math.abs(p.ahead) + p.d / 2 <= lot.d / 2 + 0.01)
  ok(inside, `${l.id}: every part stands on its own pad`)
  ok(parts.every(p => { const c = partAt(l.id, p); return Math.hypot(c.x - lot.x, c.z - lot.z) < 8 }), `${l.id}: parts are placed in the lot's own turned frame`)
}
const boxes = stationBoxes(0)
const hits = (x: number, z: number, r: number) => boxes.some(b => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1)
const spots = gladeSpots(GLADE_LOTS.map(l => `moonwell:${l.id}`))
ok(spots.every(s => !hits(s.x, s.z, 0.35)), 'nothing solid stands where a Moglin stands')
for (const s of spots) {
  let clear = true
  const g = { x: GLADE_GREEN.x, z: GLADE_GREEN.z }, n = 60
  for (let k = 0; k <= n; k++) { const t = k / n * 0.92, x = g.x + (s.x - g.x) * t, z = g.z + (s.z - g.z) * t; if (hits(x, z, BODY_R)) { clear = false; break } }
  ok(clear, `a keeper walks straight from the green up to ${s.id}`)
}
ok(boxes.every(b => fromShore((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) > 2), 'no station part stands in the pond')
const j = gladeJetty(), jb = jettyBoxes(0)
ok(fromShore(j.x0, j.z0) > 0 && fromShore(j.x1, j.z1) < -4 && jb.length >= 6 && jb.every(b => b.y1 === 0.35), 'the jetty: from the bank out over the water, a deck you can stand on')
void onLot

console.log(`glade-lots: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
