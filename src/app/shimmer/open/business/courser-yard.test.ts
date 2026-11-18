// business/courser-yard.ts: the yard sells the garage's three part ladders at the garage's own prices and deed gates
import { yardRows, buyPart, YARD_SLOTS } from './courser-yard'
import { NEW_LEDGER, TIER_PRICE, TIER_DEEDS } from '../trade'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const fresh = { ...NEW_LEDGER, marks: 1_000_000 }
const rows = yardRows(fresh)
ok(rows.length === 9 && YARD_SLOTS.every(s => rows.filter(r => r.slot === s).length === 3), 'three ladders of three tiers')
ok(rows.every(r => r.price === TIER_PRICE[r.tier] && r.deeds === TIER_DEEDS[r.tier]), "prices + deed gates are trade.ts' own")
ok(rows.filter(r => r.tier === 1).every(r => r.state === 'buy') && rows.filter(r => r.tier > 1).every(r => r.state === 'later'), 'a fresh keeper can buy tier I only (II needs I first, and deeds)')
const r1 = buyPart(fresh, 'core', 1)
ok(r1.ok && r1.ledger.owned.core === 1 && r1.ledger.marks === fresh.marks - TIER_PRICE[1], 'buying Core I spends its price and the garage owns it')
ok(yardRows(r1.ledger).find(r => r.slot === 'core' && r.tier === 1)!.state === 'owned', 'then it reads owned')
const poor = yardRows({ ...NEW_LEDGER, marks: 0 })
ok(poor.filter(r => r.tier === 1).every(r => r.state === 'later' && /Marks/.test(r.why ?? '')), 'no Marks: later, and says why')
ok(!buyPart({ ...fresh, deeds: 0, owned: { core: 1, trim: 0, rune: 0 } }, 'core', 2).ok === (TIER_DEEDS[2] > 0), 'tier II waits on its deeds')
console.log(`courser-yard: ${n - fails} ok, ${fails} fail`); process.exit(fails ? 1 : 0)
