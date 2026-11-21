// M49: the shipyards a keeper can hold (business/shipyards.ts): the sites, ownership, the buy, where each plot is saved.
// The plots themselves (ground, pieces, the walker) are shipyard-plots.test.ts. npx tsx this file.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { doorsCached } from './doors'
import { shipyardSites, inShipyardPlot, ownsShipyard, buyShipyard, plotStoreBase, oldYardStoreBase, shipyardKey, SHIPYARD_PRICE, KAEL_SHIPYARD, BOUGHT_SHIPYARD_TOWNS } from './shipyards'
import { SHIPYARD_TIERS } from './shipyard-plots'
import { LADDER } from '../economy/prices'
import { NEW_LEDGER } from '../trade'
import { isGardenKey } from '@/lib/accounts/open-save-registry'

const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }

// ── the sites: Kael's + one plot per city ──
const sites = shipyardSites(R)
ok(sites.length === 4 && sites[0].key === KAEL_SHIPYARD && sites[0].inherited && sites[0].price === 0 && sites[0].town === 'rune-hold', "Kael's first, inherited, free, by Rune Hold")
for (const t of BOUGHT_SHIPYARD_TOWNS) {
  const s = sites.find(q => q.key === shipyardKey(t))
  ok(!!s && !s.inherited && s.price === SHIPYARD_PRICE[t] && s.plot.tier === SHIPYARD_TIERS[s.key], `${t}: a bought plot at its tier's price`)
}
ok(new Set(sites.map(s => s.key)).size === 4, 'every shipyard key is distinct')
ok(shipyardSites(R) === sites, 'sites are cached per region')
ok(sites.every(s => inShipyardPlot(R, s.plot.frame.x, s.plot.frame.z) && !inShipyardPlot(R, s.plot.frame.x + 70, s.plot.frame.z + 70)), 'inShipyardPlot: inside each plot, not 70 m off its middle on both axes')
// s4 retired the town doors: a shipyard is its own plot, not a building in town (Kael's door + chest stay in Rune Hold)
for (const t of BOUGHT_SHIPYARD_TOWNS) ok(!doorsCached(R, t).some(d => d.key.startsWith('front:shipyard')), `${t}: no shipyard door in town (the plot is the shipyard)`)
ok(doorsCached(R, 'rune-hold').some(d => d.key === KAEL_SHIPYARD), "Rune Hold keeps Kael's door (the chest)")

// ── ownership ──
ok(ownsShipyard(undefined, KAEL_SHIPYARD), "Kael's is always the keeper's")
ok(!ownsShipyard(undefined, shipyardKey('gale-haven')) && !ownsShipyard([], shipyardKey('citadel')), 'a bought one is not owned until bought')
ok(ownsShipyard([shipyardKey('veradyn')], shipyardKey('veradyn')) && !ownsShipyard([shipyardKey('veradyn')], shipyardKey('citadel')), 'owned = listed, per shipyard')
ok(ownsShipyard([], shipyardKey('citadel'), true), 'the dev flag owns all')

// ── the buy (s7) ──
ok(SHIPYARD_PRICE['gale-haven'] === LADDER.shipyard.from, 'Gale Haven = the ladder floor (250k)')
ok(SHIPYARD_PRICE.citadel > SHIPYARD_PRICE.veradyn && SHIPYARD_PRICE.veradyn > SHIPYARD_PRICE['gale-haven'], 'the Citadel dearest')
const r0 = buyShipyard({ ...NEW_LEDGER, marks: SHIPYARD_PRICE['gale-haven'] - 1 }, shipyardKey('gale-haven')); ok(!r0.ok && r0.why === 'marks', 'one Mark short: refused (marks)')
const rich = { ...NEW_LEDGER, marks: 1_000_000 }
const r1 = buyShipyard(rich, shipyardKey('gale-haven'))
ok(r1.ok && r1.ledger.marks === 1_000_000 - SHIPYARD_PRICE['gale-haven'] && r1.ledger.shipyards!.includes(shipyardKey('gale-haven')), 'bought: Marks spent, key listed')
ok(rich.shipyards === undefined && rich.marks === 1_000_000, 'the old ledger is untouched (pure)')
if (r1.ok) { const r2 = buyShipyard(r1.ledger, shipyardKey('gale-haven')); ok(!r2.ok && r2.why === 'owned', 'buying it twice: refused (owned)') }
const r3 = buyShipyard(rich, KAEL_SHIPYARD); ok(!r3.ok && r3.why === 'unknown', "Kael's cannot be bought")
const r4 = buyShipyard({ ...rich, marks: SHIPYARD_PRICE.citadel }, shipyardKey('citadel')); ok(r4.ok && r4.ledger.marks === 0, 'exact Marks buys it')

// ── saved per shipyard, in the cloud save's legal keys; the retired small yards' stores are still readable (pieces go back) ──
const bases = sites.map(s => plotStoreBase(s.key)), olds = sites.map(s => oldYardStoreBase(s.key))
ok(new Set(bases).size === 4 && bases.every(b => b.startsWith('open.deed.plot:')), `one plot store per shipyard: ${bases.join(', ')}`)
ok(oldYardStoreBase(KAEL_SHIPYARD) === 'open.deed.shipyard.v1', "Kael's small yard store is the slice-1 key")
ok([...bases, ...olds].every(b => isGardenKey(b)), 'every plot store and old yard store is a legal garden key (cloud save)')

console.log(`shipyards: ${n - fails}/${n} pass`)
if (fails) process.exit(1)
