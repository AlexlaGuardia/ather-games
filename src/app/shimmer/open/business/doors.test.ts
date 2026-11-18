// business/doors.ts: every runesmith seat with a place on the map has a lit door (the Enchant seat works inside the
// Temple in the Citadel; the Star Temple has no place yet), no door is listed twice, and the Temple is a storefront.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { doorsCached, doorByKey } from './doors'
import { cachedPlan } from '../foot-solids'
import { SEATS, type Seat } from './letters'

const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

for (const s of Object.keys(SEATS) as Seat[]) {
  const d = doorByKey(R, `smith:${s}`)
  if (s === 'enchant') ok(!d && !!doorByKey(R, 'front:enchant-temple'), 'the Enchant seat works inside the Temple (no street door of its own)')
  else if (SEATS[s].place === null) ok(!d, `${s}: no place on the map, no door`)
  else ok(!!d, `${s}: a runesmith door at ${SEATS[s].where}`)
}
const all = meta.places.flatMap(p => doorsCached(R, p.id))
ok(new Set(all.map(d => d.key)).size === all.length, 'no door key twice')
ok(new Set(all.map(d => d.b)).size === all.length, 'no building carries two doors')
// THE CO.'S CITADEL OFFICE (Alex 11-18; Magii 49d8a0f): one door, in the Citadel only, the free building nearest the GE
const co = all.filter(d => d.key === 'front:trade-co')
ok(co.length === 1, `exactly one Ather Trading Co. door on the continent (${co.length})`)
const cit = doorsCached(R, 'citadel'), ge = cit.find(d => d.key === 'front:grand-exchange')
ok(!!co[0] && cit.includes(co[0]), 'the Co. door stands in the Citadel')
if (co[0] && ge) {
  const dGe = (d: { b: { x: number; z: number } }) => Math.hypot(d.b.x - ge.b.x, d.b.z - ge.b.z)
  const plain = cit.filter(d => !d.b.front)
  ok(plain.every(d => dGe(co[0]) <= dGe(d)), 'no plain door in the Citadel stands nearer the Grand Exchange than the Co.')
}
ok(co[0]?.name === 'Ather Trading Co.', `its door reads the house's own name (${co[0]?.name})`)
// THE GUN SHOP: every town with a smokehouse except the Passage has exactly one, named plainly, on its own building
for (const p of meta.places) {
  const ds = doorsCached(R, p.id), gs = ds.filter(d => d.key.startsWith('front:gunshop:'))
  // a hamlet of one or two buildings has no second plain building once the smokehouse is placed: no gun shop there (asserted, not assumed)
  const spare = cachedPlan(R, meta.places.indexOf(p)).buildings.some(b => !b.front && !ds.some(d => d.b === b && !d.key.startsWith('front:gunshop:')))
  const want = p.id !== 'passage' && ds.some(d => d.key === `front:smokehouse:${p.id}`) && spare
  if (p.id !== 'passage' && ds.some(d => d.key === `front:smokehouse:${p.id}`) && !spare) ok(cachedPlan(R, meta.places.indexOf(p)).buildings.length <= 2, `${p.id}: no spare building only because it is a tiny hamlet`)
  ok(gs.length === (want ? 1 : 0), `${p.id}: ${want ? 'one' : 'no'} gun shop door (${gs.length})`)
  for (const g of gs) {
    ok(g.name === 'The gun shop', `${p.id}: its name is "The gun shop" (${g.name})`)
    ok(g.key === `front:gunshop:${p.id}`, `${p.id}: its key carries the town`)
  }
}
ok(all.filter(d => d.key.startsWith('front:gunshop:')).length > 0, 'the continent has gun shops')
console.log(`doors: ${pass} pass, ${fail} fail (${all.length} doors)`)
if (fail) process.exit(1)
