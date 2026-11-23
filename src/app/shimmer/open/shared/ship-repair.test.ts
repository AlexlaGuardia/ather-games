// BETA M108 s1: Kael's ship, repair stage 1 (ship-repair.ts). npx tsx src/app/shimmer/open/shared/ship-repair.test.ts
import { newRepair, parseRepair, repairStep, onQuote, payHousing, fitHousing, shipBoard, CELL_HOUSING_PRICE } from './ship-repair'
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
ok(paid.ok && paid.marks === 5 && paid.repair.made && !paid.repair.stage1, 'exact price deducted, the housing MADE, stage 1 NOT yet done (s2: fitted at the yard)')
ok(paid.ok && repairStep(true, paid.repair) === 'made', 'paid = step made')
ok(paid.ok && !payHousing(true, paid.repair, 1e9).ok, 'no paying twice')
// s2: the fit at the yard
ok(fitHousing(r0) === null && fitHousing(q) === null, 'nothing to fit before the housing is made')
ok(shipBoard(r0) === 'not-ready' && shipBoard(q) === 'not-ready', 'Franky before the housing: not ready')
ok(shipBoard(r0, true) === 'map', 'the owner override (?ship=open) opens the map anyway')
const fitted = paid.ok ? fitHousing(paid.repair) : null
ok(paid.ok && shipBoard(paid.repair) === 'fit', 'carrying the made housing, E at Franky = fit')
ok(!!fitted && fitted.stage1 && repairStep(true, fitted) === 'stage1' && shipBoard(fitted) === 'map', 'fitted = stage 1 done, Franky opens the map')
ok(!!fitted && fitHousing(fitted) === null, 'no fitting twice')
ok(!!fitted && repairStep(false, fitted) === 'stage1', 'stage 1 stays done whatever the flag reads')
ok(paid.ok && repairStep(false, paid.repair) === 'made', 'made stays made whatever the flag reads')
ok(JSON.stringify(parseRepair(JSON.parse(JSON.stringify(fitted)))) === JSON.stringify({ v: 1, quoted: true, made: true, stage1: true }), 'round-trips')
ok(JSON.stringify(parseRepair({ v: 1, quoted: true, stage1: true })) === JSON.stringify({ v: 1, quoted: true, made: true, stage1: true }), 'an s1 record already done (no made field) stays done')
ok(repairStep(true, parseRepair({ v: 1, quoted: true, stage1: false })) === 'quoted', 'an s1 record quoted only stays quoted')
ok(JSON.stringify(parseRepair({ v: 2, stage1: true })) === JSON.stringify(r0) && JSON.stringify(parseRepair(null)) === JSON.stringify(r0) && parseRepair({ v: 1, stage1: 'yes' }).stage1 === false, 'malformed = fresh')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
