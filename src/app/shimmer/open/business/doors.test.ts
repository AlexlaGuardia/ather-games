// business/doors.ts: every runesmith seat with a place on the map has a lit door (the Enchant seat works inside the
// Temple in the Citadel; the Star Temple has no place yet), no door is listed twice, and the Temple is a storefront.
import { MAKES } from './courser-lot'
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
// THE COURSER YARD (M14): exactly one in every town with a gun shop, plainly named, on a building nothing else holds
for (const p of meta.places) {
  const ds = doorsCached(R, p.id), ys = ds.filter(d => d.key.startsWith('front:courseryard:')), gun = ds.some(d => d.key === `front:gunshop:${p.id}`)
  const spare = cachedPlan(R, meta.places.indexOf(p)).buildings.some(b => !b.front && !ds.some(d => d.b === b && !d.key.startsWith('front:courseryard:')))
  ok(ys.length === (gun && spare ? 1 : 0), `${p.id}: ${gun && spare ? 'one' : 'no'} courser yard (${ys.length})`)
  for (const y of ys) {
    ok(y.name === 'The courser yard' && y.key === `front:courseryard:${p.id}`, `${p.id}: "The courser yard", keyed by its town`)
    ok(ds.filter(d => d.b === y.b).length === 1, `${p.id}: the yard has its own building`)
  }
}
ok(all.filter(d => d.key.startsWith('front:courseryard:')).length > 0, 'the continent has courser yards')
// THE COURSER LOTS (M14): exactly one per ruled make, in that make's town, on its own building, plainly named
for (const mk of Object.values(MAKES)) {
  const ls = doorsCached(R, mk.town).filter(d => d.key.startsWith('front:courserlot:'))
  ok(ls.length === 1 && ls[0].key === `front:courserlot:${mk.town}` && ls[0].name === 'The courser lot', `${mk.name}: one courser lot in ${mk.town}`)
  if (ls[0]) ok(doorsCached(R, mk.town).filter(d => d.b === ls[0].b).length === 1, `${mk.name}: the lot has its own building`)
}
// THE CORKHOUSE (RULED 11-21): Rune Hold only for now, by the shipyard (the free plain building nearest it), on its own building
{ const ri = R.meta.places.findIndex(p => p.id === 'rune-hold'), rh = doorsCached(R, 'rune-hold')
  const ck = all.filter(d => d.key === 'front:corkhouse'), yard = rh.find(d => d.key === 'front:shipyard')
  ok(ck.length === 1 && rh.some(d => d.key === 'front:corkhouse'), `one Corkhouse, in Rune Hold (${ck.length})`)
  if (ck.length && yard && ri >= 0) {
    const taken = new Set(rh.filter(d => d.key !== 'front:corkhouse').map(d => d.b))
    const free = cachedPlan(R, ri).buildings.filter(x => !x.front && !taken.has(x))
    const dist = (b: { x: number; z: number }) => Math.hypot(b.x - yard.b.x, b.z - yard.b.z)
    ok(free.every(b => dist(b) >= dist(ck[0].b)), `it is the free plain building nearest the shipyard (${dist(ck[0].b).toFixed(1)} m)`)
    ok(rh.filter(d => d.b === ck[0].b).length === 1, 'no other door shares its building')
  }
}
ok(all.filter(d => d.key.startsWith('front:courserlot:')).length === 4, 'four courser lots on the continent, no more')
console.log(`doors: ${pass} pass, ${fail} fail (${all.length} doors)`)
if (fail) process.exit(1)
