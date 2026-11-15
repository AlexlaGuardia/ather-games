// Lots for sale (the towns ⟷ economy seam): ids are unique and round-trip, authored places are never for sale, the
// door stands on open ground in front of the building. npx tsx src/app/shimmer/open/towns/lots.test.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { lotsForSale, lotById } from './lots'
import { cachedPlan } from '../foot-solids'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
for (const town of ['ashfeld', 'rune-hold']) {
  const lots = lotsForSale(R, town)
  ok(lots.length >= 20, `${town}: ${lots.length} lots for sale (want >= 20)`)
  ok(new Set(lots.map(l => l.id)).size === lots.length, `${town}: lot ids are unique`)
  ok(lots.every(l => lotById(R, l.id)?.x === l.x), `${town}: every id round-trips`)
  ok(lots.every(l => [0, 1, 2].includes(l.tier)), `${town}: tiers are 0-2`)
  const plan = cachedPlan(R, meta.places.findIndex(p => p.id === town))
  const authored = plan.buildings.filter(b => b.core || b.front)
  ok(authored.every(b => !lots.some(l => Math.round(l.x) === Math.round(b.x) && Math.round(l.z) === Math.round(b.z))), `${town}: no authored place (storefront, grid house, Fallen Cap) is for sale`)
  // the door is in front of the facade, outside every footprint of the town
  let doorInside = 0
  for (const l of lots) for (const b of plan.buildings) {
    const dx = l.door.x - b.x, dz = l.door.z - b.z, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw)
    if (Math.abs(dx * -fz + dz * fx) < b.w / 2 && Math.abs(dx * fx + dz * fz) < b.d / 2) doorInside++
  }
  ok(doorInside === 0, `${town}: doors inside a building: ${doorInside}`)
}
ok(lotById(R, 'ashfeld:0:0') === undefined, 'an id whose building is gone answers undefined (never another house)')
ok(lotsForSale(R, 'no-such-town').length === 0, 'an unknown town answers []')
console.log(`lots: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
