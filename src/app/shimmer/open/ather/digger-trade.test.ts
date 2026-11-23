// BETA M108 s3: the Digger's trade. npx tsx src/app/shimmer/open/ather/digger-trade.test.ts
import { diggerTrade, DIGGER_TRADE } from './digger-trade'
import { newInv, give, countOf, SLOTS, type Inv } from '../shared/inventory'
import { folkOf, DIGGER_SURE } from './settlement-folk'
import { PROFESSIONS, WORKS_IN } from './moglins'
import { readFileSync } from 'node:fs'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const bag = (o: Record<string, number>): Inv => Object.entries(o).reduce((i, [id, k]) => give(i, id, k).inv, { ...newInv(0), slots: Array(SLOTS).fill(null) } as Inv)
const P = DIGGER_TRADE.want.id, S = DIGGER_TRADE.product.id
ok(P === 'goldwood_plank' && S === 'raw_mana_shard', 'canon table: Goldwood Plank in, Raw Mana Shard out')
const none = bag({}), r0 = diggerTrade(none)
ok(!r0.ok && r0.why === 'short', 'no planks = refused (short)')
const one = bag({ [P]: 1 }), r1 = diggerTrade(one)
ok(!r1.ok && countOf(one, P) === 1, 'one plank short = refused, nothing taken')
const r2 = diggerTrade(bag({ [P]: 5 }))
ok(r2.ok && countOf(r2.inv, P) === 3 && countOf(r2.inv, S) === 1, '2 planks -> 1 shard')
const r3 = r2.ok ? diggerTrade(r2.inv) : r2
ok(r3.ok && countOf(r3.inv, P) === 1 && countOf(r3.inv, S) === 2, 'repeatable')
const full = { ...bag({ [P]: 3 }) }; full.slots = full.slots.map((x, i) => x ?? { id: `junk${i}`, n: 1 })
const rf = diggerTrade(full)
ok(!rf.ok && rf.why === 'full', 'no room for the shard = refused')
// the digger is a trade (no room work, like a jeweler with no room) and the first settlement on the opening path has one
ok(PROFESSIONS.includes('digger') && WORKS_IN.digger.length === 0, "'digger' is a recruitable trade with no room work")
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as { season: number; settlements: { id: string; name: string; x: number; z: number; biome?: 'meadow' }[] }
for (const id of DIGGER_SURE) { const s = net.settlements.find(x => x.id === id)!; ok(!!s && folkOf(s, net.season).some(f => f.profession === 'digger'), `${s?.name ?? id} has a Digger (guaranteed)`) }
ok(folkOf(net.settlements.find(x => x.id === DIGGER_SURE[0])!, net.season).filter(f => f.profession === 'digger').length === 1, 'exactly one guaranteed Digger there')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
