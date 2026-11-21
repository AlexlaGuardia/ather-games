// corkhouse.ts: what it buys, at what price, and that a sale is whole or nothing.
// Run: npx tsx src/app/shimmer/open/business/corkhouse.test.ts
import { corkPrice, bottlesIn, sellBottles, CORK_BASE } from './corkhouse'
import { ALC_POTION_ORDER, potionId, POTENCY } from '../ather/alchemy-set'
import { give, newInv } from '../shared/inventory'
const emptyInv = () => newInv(0)
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

ok(ALC_POTION_ORDER.every(p => CORK_BASE[p] > 0), `every potion the Desk makes has a price (${ALC_POTION_ORDER.join(', ')})`)
ok(corkPrice(potionId('health', 'D')) === 60 && corkPrice(potionId('health', 'S')) === Math.round(60 * POTENCY.S), 'price = base x the grade potency')
ok((['D', 'C', 'B', 'A', 'S'] as const).every((g, i, a) => i === 0 || corkPrice(potionId('mana', g))! > corkPrice(potionId('mana', a[i - 1]))!), 'a better grade always pays more')
ok(corkPrice('potion:nope:D') === null && corkPrice('goldwood_log') === null && corkPrice('potion:health:Z') === null, 'it buys only alchemy bottles')
let inv = give(give(give(emptyInv(), potionId('health', 'D'), 3).inv, potionId('wisdom', 'A'), 1).inv, 'goldwood_log', 5).inv
const rows = bottlesIn(inv)
ok(rows.length === 2 && rows[0].id === potionId('wisdom', 'A') && rows[1].n === 3, `the bag's bottles, best price first, logs ignored (${JSON.stringify(rows)})`)
const s = sellBottles({ marks: 10 } as never, inv, potionId('health', 'D'), 2)
ok(s.ok && s.ledger.marks === 130 && s.paid === 120 && bottlesIn(s.inv).find(r => r.id === potionId('health', 'D'))!.n === 1, 'selling 2: 120 Marks in, 2 bottles out')
const over = sellBottles({ marks: 10 } as never, inv, potionId('health', 'D'), 4)
ok(!over.ok && over.why.includes('that many'), 'selling more than you hold changes nothing')
ok(!sellBottles({ marks: 0 } as never, inv, 'goldwood_log', 1).ok && !sellBottles({ marks: 0 } as never, inv, potionId('health', 'D'), 0).ok, 'not a bottle / zero: refused')
import { existsSync } from 'node:fs'
import { itemDef } from '../shared/inventory'
ok(ALC_POTION_ORDER.every(p => { const ic = itemDef(potionId(p, 'B')).icon; return !!ic && existsSync('public' + ic) }), 'every bottle has a bag icon on disk (tools/art/potion_icons.py)')
console.log(`corkhouse: ${pass}/${pass + fail}`); if (fail) process.exit(1)
