// M49 s3: the shipyards a keeper can hold (business/shipyards.ts) on the REAL continent. npx tsx this file.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { cachedPlan } from '../foot-solids'
import { doorsCached, BOUGHT_SHIPYARD_TOWNS, BOUGHT_SHIPYARD_NAME, FRONT_SHOPS } from './doors'
import { shipyardSites, shipyardYard, ownsShipyard, buyShipyard, yardStoreBase, shipyardKey, SHIPYARD_PRICE, KAEL_SHIPYARD } from './shipyards'
import { yardToWorld } from './deed-yard-site'
import { yardFloorY, rimBoxes } from './deed-yard-floor'
import { bodyHits } from '../foot-solids'
import { GATE_MID } from './deed-yard-site'
import { DEED_GRID } from './deed-grid'
import { LADDER } from '../economy/prices'
import { NEW_LEDGER } from '../trade'
import { isGardenKey } from '@/lib/accounts/open-save-registry'

const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const G = DEED_GRID.shipyard

// ── the sites: Kael's + one per city, each with a clear yard on its own ground ──
const sites = shipyardSites(R)
ok(sites.length === 4, `4 shipyards (Kael's + 3 bought), got ${sites.map(s => s.key).join(', ')}`)
ok(sites[0].key === KAEL_SHIPYARD && sites[0].inherited && sites[0].price === 0 && sites[0].town === 'rune-hold', "Kael's first, inherited, free, Rune Hold")
ok(shipyardYard(R) === sites[0].yard, "shipyardYard is Kael's")
for (const t of BOUGHT_SHIPYARD_TOWNS) {
  const s = sites.find(q => q.key === shipyardKey(t))
  ok(!!s, `${t} has a shipyard`); if (!s) continue
  ok(!s.inherited && s.price === SHIPYARD_PRICE[t], `${t}: bought, priced ${SHIPYARD_PRICE[t]}`)
  ok(s.yard.clear, `${t}: its yard lies clear of houses, lanes, tunnels and decks`)
  const d = doorsCached(R, t).find(q => q.key === s.key)!
  ok(d.name === BOUGHT_SHIPYARD_NAME && d.name !== FRONT_SHOPS.shipyard.name, `${t}: placeholder door name, not Kael's`)
  ok(doorsCached(R, t).filter(q => q.b === s.b).length === 1, `${t}: the shipyard's building holds no other door`)
  // on the town's outskirts: farther from the heart than most of its buildings
  const i = R.meta.places.findIndex(p => p.id === t), plan = cachedPlan(R, i), at = plan.temple ?? { x: R.meta.places[i].x, z: R.meta.places[i].z }
  const dist = (b: { x: number; z: number }) => Math.hypot(b.x - at.x, b.z - at.z)
  const farther = plan.buildings.filter(b => dist(b) > dist(s.b)).length
  ok(farther / plan.buildings.length < 0.15, `${t}: on the outskirts (${farther}/${plan.buildings.length} buildings farther out)`)
  // the deck stands over its own ground: the floor is above every cell's ground, and no yard is near another
  const fl = yardFloorY(R, s.yard)
  let below = true
  for (let u = -G.w / 2; u <= G.w / 2; u++) for (let v = -G.d / 2; v <= G.d / 2; v++) { const p = yardToWorld(s.yard, u, v); if (R.heightAt(p.x, p.z) > fl) below = false }
  ok(below, `${t}: deck floor ${fl.toFixed(2)} stands over all its ground`)
  console.log(`  ${t}: ${s.yard.side} yard at ${s.yard.x.toFixed(1)}, ${s.yard.z.toFixed(1)}, gate ${s.yard.gate}, floor ${fl.toFixed(2)}`)
}
const keys = new Set(sites.map(s => s.key)); ok(keys.size === sites.length, 'every shipyard key is distinct')
// the bought doors come LAST: every other door in those towns is the one it was (same building as a lookup without them would give)
for (const t of BOUGHT_SHIPYARD_TOWNS) { const ds = doorsCached(R, t); ok(ds[ds.length - 1].key === shipyardKey(t), `${t}: the shipyard is sited after every other door`) }
// Rune Hold has no bought shipyard (Kael's is its one)
ok(!doorsCached(R, 'rune-hold').some(d => d.key.startsWith('front:shipyard:')), 'Rune Hold: Kael\'s only')

// ── a shipyard not held is fenced SHUT: the gate gap is solid too (the walker cannot get in) ──
{
  const s = sites[1], fl = yardFloorY(R, s.yard), [gu, gv] = GATE_MID(G, s.yard.gate), g = yardToWorld(s.yard, gu, gv)
  ok(!rimBoxes(s.yard, fl).some(b => bodyHits(b, g.x, g.z, fl)), 'held: the gate gap is open')
  ok(rimBoxes(s.yard, fl, true).some(b => bodyHits(b, g.x, g.z, fl)), 'not held: the gate gap is closed')
}

// ── ownership ──
ok(ownsShipyard(undefined, KAEL_SHIPYARD), "Kael's is always the keeper's")
ok(!ownsShipyard(undefined, shipyardKey('gale-haven')) && !ownsShipyard([], shipyardKey('citadel')), 'a bought one is not owned until bought')
ok(ownsShipyard([shipyardKey('veradyn')], shipyardKey('veradyn')) && !ownsShipyard([shipyardKey('veradyn')], shipyardKey('citadel')), 'owned = listed, per shipyard')
ok(ownsShipyard([], shipyardKey('citadel'), true), 'the dev flag owns all')

// ── the buy (s3b) ──
ok(SHIPYARD_PRICE['gale-haven'] === LADDER.shipyard.from, 'Gale Haven = the ladder floor (250k)')
ok(SHIPYARD_PRICE.citadel > SHIPYARD_PRICE.veradyn && SHIPYARD_PRICE.veradyn > SHIPYARD_PRICE['gale-haven'], 'the Citadel dearest')
const poor = { ...NEW_LEDGER, marks: SHIPYARD_PRICE['gale-haven'] - 1 }
const r0 = buyShipyard(poor, shipyardKey('gale-haven')); ok(!r0.ok && r0.why === 'marks', 'one Mark short: refused (marks)')
const rich = { ...NEW_LEDGER, marks: 1_000_000 }
const r1 = buyShipyard(rich, shipyardKey('gale-haven'))
ok(r1.ok && r1.ledger.marks === 1_000_000 - SHIPYARD_PRICE['gale-haven'] && r1.ledger.shipyards!.includes(shipyardKey('gale-haven')), 'bought: Marks spent, key listed')
ok(rich.shipyards === undefined && rich.marks === 1_000_000, 'the old ledger is untouched (pure)')
if (r1.ok) { const r2 = buyShipyard(r1.ledger, shipyardKey('gale-haven')); ok(!r2.ok && r2.why === 'owned', 'buying it twice: refused (owned)') }
const r3 = buyShipyard(rich, KAEL_SHIPYARD); ok(!r3.ok && r3.why === 'unknown', "Kael's cannot be bought")
const r4 = buyShipyard({ ...rich, marks: SHIPYARD_PRICE.citadel }, shipyardKey('citadel')); ok(r4.ok && r4.ledger.marks === 0, 'exact Marks buys it')

// ── saved per shipyard, in the cloud save's legal keys ──
ok(yardStoreBase(KAEL_SHIPYARD) === 'open.deed.shipyard.v1', "Kael's yard keeps its slice-1 key")
const bases = sites.map(s => yardStoreBase(s.key))
ok(new Set(bases).size === bases.length, `one store per shipyard: ${bases.join(', ')}`)
ok(bases.every(b => isGardenKey(b)), 'every yard store is a legal garden key (cloud save)')

console.log(`shipyards: ${n - fails}/${n} pass`)
if (fails) process.exit(1)
