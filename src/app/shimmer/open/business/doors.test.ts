// business/doors.ts: every runesmith seat with a place on the map has a lit door (the Enchant seat works inside the
// Temple in the Citadel; the Star Temple has no place yet), no door is listed twice, and the Temple is a storefront.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { doorsCached, doorByKey } from './doors'
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
console.log(`doors: ${pass} pass, ${fail} fail (${all.length} doors)`)
if (fail) process.exit(1)
