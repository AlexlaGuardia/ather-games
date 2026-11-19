// M30 Moonwell Glade. Run: npx tsx src/app/shimmer/open/ather/moonwell-glade.test.ts
import { GLADE, GLADE_ID, gladeFolk, mallowWants, MALLOW_POOL, isGlade, GLADE_STAYS, GLADE_TRADE } from './moonwell-glade'
import { folkOf } from './settlement-folk'
import { withGlade, settlementAt, type Network } from './network'
import { MOONWELL } from './moonwell'
import { itemDef } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const five = folkOf(GLADE, 1)
ok(five.map(f => f.name).join(',') === 'Hazel,Sax,Yarrow,Fennel,Mallow', `the five, canon names (${five.map(f => f.name)})`)
ok(JSON.stringify(folkOf(GLADE, 1).map(f => f.id)) === JSON.stringify(folkOf(GLADE, 9).map(f => f.id)), 'fixed: the season never re-rolls them')
ok(five.every(f => f.home === GLADE_ID && f.employed && f.wants.length > 0 && isGlade(f.id) && isGlade(f.home)), 'all settled with want-lists, all of the Glade')
ok(five.every(f => f.wants.every(w => !!itemDef(w.id))), `every want is a real item (${five.flatMap(f => f.wants.map(w => w.id)).filter(id => !itemDef(id))})`)
ok(five.every(f => !!f.dream), 'every one has a hello line')
ok(five.find(f => f.name === 'Mallow')!.profession === 'shopkeeper' && GLADE_TRADE.yarrow === 'apothecary', "Mallow is the shopkeeper; Yarrow reads 'apothecary' in copy")
const wk = 7 * 86_400_000
ok(mallowWants(0)[0].id !== mallowWants(wk)[0].id && mallowWants(wk * MALLOW_POOL.length)[0].id === mallowWants(0)[0].id, "Mallow's list changes weekly and cycles")
ok(GLADE.x === MOONWELL.x && GLADE.z === MOONWELL.z, 'the Glade sits on the pool')
const net: Network = { v: 1, season: 1, settlements: [{ id: 's1-0', name: 'X', x: 900, z: 900 }], paths: [], fair: null }
const g = withGlade(net)
ok(g.settlements.length === 2 && g.settlements[0].id === GLADE_ID && withGlade(g).settlements.length === 2, 'the network gains the Glade once')
ok(settlementAt(g, MOONWELL.x + 3, MOONWELL.z)?.id === GLADE_ID, 'standing by the pool = in Moonwell Glade')
ok(GLADE_STAYS.length > 0, 'the stay-home line exists (lark placeholder)')
console.log(`moonwell-glade: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
