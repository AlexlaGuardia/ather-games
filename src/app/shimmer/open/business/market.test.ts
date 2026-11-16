// business/market.ts: the offers are few, never on canon places, one trade per kind per town, stable, and the
// price is the tycoon's for the lot's tier.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { marketFor, allOffers, offerById, tradesOf } from './market'
import { lotById } from '../towns/lots'
import { priceOf } from '../economy/tycoon'

const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

const all = allOffers(R)
ok(all.length > 20 && all.length < 120, `a market, not every house (${all.length})`)
for (const id of ['helgas-hut', 'eyuuns-shack', 'verdant-ruins', 'the-moldy-boulder']) ok(marketFor(R, id).length === 0, `${id} is not for sale`)
ok(tradesOf(R, 'rune-hold').join() === 'mine,smithy,manalic_shop', 'Rune Hold holds the whole ore chain')
ok(tradesOf(R, 'shoalhaven').join() === 'farm,kitchen,cafe', 'Shoalhaven holds the whole food chain')
const ids = new Set(all.map(o => o.lot.id)); ok(ids.size === all.length, 'no lot offered twice')
const names = new Set(all.map(o => o.name)); ok(names.size === all.length, 'every business name unique')
ok(all.every(o => lotById(R, o.lot.id)?.id === o.lot.id), 'every offer is a real lot')
ok(all.every(o => offerById(R, o.lot.id) === o), 'offerById round-trips')
ok(all.every(o => o.price === priceOf(o.kind, o.lot.tier)), 'price = the tycoon ladder at the lot tier')
ok(all.every(o => Math.abs(o.b.x - o.lot.x) < 1e-9 && Math.abs(o.b.z - o.lot.z) < 1e-9), 'the building zips to its lot')
// makers at the edge, sellers at the core
const rh = marketFor(R, 'citadel'), shop = rh.find(o => o.kind === 'manalic_shop')!, smith = rh.find(o => o.kind === 'smithy')!
ok(shop.b.rim < smith.b.rim, `Citadel's shop sits nearer the core than its smithy (${shop.b.rim.toFixed(2)} < ${smith.b.rim.toFixed(2)})`)
const mine = marketFor(R, 'rune-hold').find(o => o.kind === 'mine')!, rshop = marketFor(R, 'rune-hold').find(o => o.kind === 'manalic_shop')!
ok(mine.b.rim > rshop.b.rim, 'Rune Hold mine at the edge, shop nearer the core')
ok(marketFor(R, 'unnamed-village-0')[0]?.name === 'Kettlemoor Farm', `a named village's farm (${marketFor(R, 'unnamed-village-0')[0]?.name})`)

console.log(`market.test: ${pass} pass, ${fail} fail (${all.length} offers)`)
if (fail) process.exit(1)
