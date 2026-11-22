// Run: npx tsx src/app/shimmer/open/shared/owner-grants.test.ts
import { oneOfEachSeed } from './owner-grants'
import { SEED_IDS } from '../ather/seed-items'
import { countOf, give, type Inv } from './inventory'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const empty = (): Inv => ({ v: 1, slots: Array(32).fill(null) })
const a = oneOfEachSeed(empty())
ok(a.added === SEED_IDS.length && a.missed === 0, `adds all ${SEED_IDS.length}`)
ok(SEED_IDS.every(id => countOf(a.inv, id) === 1), 'exactly one of each')
const b = oneOfEachSeed(a.inv)
ok(b.added === 0 && SEED_IDS.every(id => countOf(b.inv, id) === 1), 'second press adds none')
const c = oneOfEachSeed(give(empty(), SEED_IDS[0], 3).inv)
ok(c.added === SEED_IDS.length - 1 && countOf(c.inv, SEED_IDS[0]) === 3, 'a held seed is not topped up')
const full: Inv = { v: 1, slots: Array(32).fill(null).map(() => ({ id: 'bait1', n: 1 })) }
const d = oneOfEachSeed(full)
ok(d.added === 0 && d.missed === SEED_IDS.length, 'full bag: nothing added, all missed')
console.log(`owner-grants: ${pass} pass, ${fail} fail`); if (fail) process.exit(1)
