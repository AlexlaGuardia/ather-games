// BETA M108 s1: Kael's ship, repair stage 1 (ship-repair.ts). npx tsx src/app/shimmer/open/shared/ship-repair.test.ts
import { newRepair, parseRepair, repairStep, onQuote, payHousing, CELL_HOUSING_PRICE } from './ship-repair'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const r0 = newRepair()
ok(repairStep(false, r0) === 'off' && repairStep(true, r0) === 'open', 'no flag = off; flag = open')
ok(onQuote(false, r0) === r0, 'no quote without the flag')
const q = onQuote(true, r0)
ok(q.quoted && repairStep(true, q) === 'quoted', 'the quote turns the order')
ok(!payHousing(true, r0, 1e9).ok, 'cannot pay before the quote')
ok(!payHousing(false, q, 1e9).ok, 'cannot pay without the flag')
const short = payHousing(true, q, CELL_HOUSING_PRICE - 1)
ok(!short.ok && short.why === 'short', 'short by one Mark = refused')
ok(!payHousing(true, q, NaN).ok, 'a NaN purse is refused')
const paid = payHousing(true, q, CELL_HOUSING_PRICE + 5)
ok(paid.ok && paid.marks === 5 && paid.repair.stage1, 'exact price deducted, stage 1 done')
ok(paid.ok && !payHousing(true, paid.repair, 1e9).ok, 'no paying twice')
ok(paid.ok && repairStep(false, paid.repair) === 'stage1', 'stage 1 stays done whatever the flag reads')
ok(JSON.stringify(parseRepair(JSON.parse(JSON.stringify(paid.ok && paid.repair)))) === JSON.stringify({ v: 1, quoted: true, stage1: true }), 'round-trips')
ok(JSON.stringify(parseRepair({ v: 2, stage1: true })) === JSON.stringify(r0) && JSON.stringify(parseRepair(null)) === JSON.stringify(r0) && parseRepair({ v: 1, stage1: 'yes' }).stage1 === false, 'malformed = fresh')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
