// Run: npx tsx src/app/shimmer/open/business/contracts.test.ts
// BETA M115 s2: the season contract (business/contracts.ts): signed once, a lot a week lands in the garden bank for a 90-day season,
// exact after time away, never twice across a reload or two tabs, one per material, 20% off bulk there while it runs.
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)) }, removeItem: (k: string) => { mem.delete(k) }, key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size } }
import { DELIVERIES, WEEK_MS, DAY_MS, SEASON_MS, contractPrice, dueCount, signContract, landContracts, landContractsNow, openContract, contractView, bulkPrice, freshBook, adoptBook, saveContracts, loadContracts, CONTRACTS_KEY } from './contracts'
import { SUPPLIER_KINDS, buyLot } from './suppliers'
import { freshBank, bankCount, putIn, saveBank, loadBank, bankCap, BANK_KEY } from '../ather/garden-bank'
import { NEW_LEDGER } from '../trade'
import { newInv } from '../shared/inventory'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const T0 = Date.UTC(2026, 10, 27, 12)
const lot = SUPPLIER_KINDS['trade-co'].lots.find(l => l.id === 'rootbulb')!
const rich = { ...NEW_LEDGER, marks: 50_000 }
const CAP = bankCap(1)

// the season
ok(SEASON_MS === 90 * DAY_MS && DELIVERIES === 12, `a season = 90 days, 12 weekly deliveries (${DELIVERIES})`)
ok(contractPrice(lot) === lot.price * 12, 'price = the whole season of bulk lots, paid up front')

// signing charges ONCE, the whole price
const s = signContract(rich, freshBook(), 'trade-co', 'rootbulb', T0)
ok(s.ok && s.ledger.marks === rich.marks - contractPrice(lot), 'sign: the purse drops by the contract price, once')
if (!s.ok) throw new Error('sign failed')
ok(s.book.list.length === 1 && s.contract.landed === 0 && s.contract.n === lot.n && s.contract.start === T0, 'sign: one contract on the books, nothing landed yet')
const poor = signContract({ ...NEW_LEDGER, marks: contractPrice(lot) - 1 }, freshBook(), 'trade-co', 'rootbulb', T0)
ok(!poor.ok && /costs/.test(poor.why), 'sign: short of Marks = refused, nothing changes')
ok(!signContract(rich, freshBook(), 'trade-co', 'nope', T0).ok && !signContract(rich, freshBook(), 'no-kind', 'rootbulb', T0).ok, 'sign: an unsold material / unknown supplier = refused')

// one per material
const again = signContract(s.ledger, s.book, 'trade-co', 'rootbulb', T0 + DAY_MS)
ok(!again.ok, 'one per material: a second Rootbulb contract while one runs = refused')
const other = signContract(s.ledger, s.book, 'trade-co', 'capgrain', T0 + DAY_MS)
ok(other.ok && other.book.list.length === 2, 'one per material: a Capgrain contract beside it is fine')

// weekly delivery accrues by real time
const c = s.contract
ok(dueCount(c, T0) === 0 && dueCount(c, T0 + WEEK_MS - 1) === 0 && dueCount(c, T0 + WEEK_MS) === 1 && dueCount(c, T0 + 3 * WEEK_MS + DAY_MS) === 3, 'due: 0 before a week, 1 at a week, 3 at 3 weeks + a day')
ok(dueCount(c, T0 - 5 * WEEK_MS) === 0, 'due: a clock set back owes nothing (never negative)')
ok(dueCount(c, T0 + 400 * DAY_MS) === 12, 'due: capped at the season (12) however long away')
const w1 = landContracts(s.book, freshBank(), CAP, T0 + WEEK_MS + 1000)
ok(bankCount(w1.bank, 'rootbulb') === lot.n && w1.book.list[0].landed === lot.n && w1.landed[0]?.n === lot.n, 'a week on: ONE lot lands in the bank')
const w1b = landContracts(w1.book, w1.bank, CAP, T0 + WEEK_MS + 5000)
ok(bankCount(w1b.bank, 'rootbulb') === lot.n && w1b.landed.length === 0, 'landing again the same week (a reload): nothing more')

// offline catch-up is exact
const away = landContracts(w1.book, w1.bank, CAP, T0 + 5 * WEEK_MS + 3 * DAY_MS)
ok(bankCount(away.bank, 'rootbulb') === 5 * lot.n && away.landed[0].n === 4 * lot.n, `away 4 more weeks: exactly 4 lots land (${away.landed[0]?.n})`)
const fromZero = landContracts(s.book, freshBank(), CAP, T0 + 5 * WEEK_MS + 3 * DAY_MS)
ok(bankCount(fromZero.bank, 'rootbulb') === 5 * lot.n, 'away 5 weeks from signing: exactly 5 lots, in one landing')
ok(contractView(away.book.list[0], T0 + 5 * WEEK_MS + 3 * DAY_MS).left === 7 && contractView(away.book.list[0], T0 + 5 * WEEK_MS + 3 * DAY_MS).next === T0 + 6 * WEEK_MS, 'view: 7 deliveries left, the next at week 6')

// ends after 90 days
const late = landContracts(s.book, freshBank(), CAP, T0 + SEASON_MS + DAY_MS)
ok(bankCount(late.bank, 'rootbulb') === 12 * lot.n && late.book.list.length === 0, 'after the season: all 12 lots landed, the contract drops off the books')
const day85 = landContracts(s.book, freshBank(), CAP, T0 + 85 * DAY_MS)
ok(bankCount(day85.bank, 'rootbulb') === 12 * lot.n && day85.book.list.length === 1 && contractView(day85.book.list[0], T0 + 85 * DAY_MS).next === null, 'day 85: all 12 in, still on the books (the season runs to day 90), no next delivery')
ok(!!signContract(rich, late.book, 'trade-co', 'rootbulb', T0 + SEASON_MS + DAY_MS).ok, 'a new Rootbulb contract once the old season is over')

// a full bank: the rest waits, never lost, never trimmed
let full = freshBank()
for (let i = 0; full.stacks.length < CAP; i++) full = putIn(full, CAP, 'deadfall', 9999).bank
const blocked = landContracts(s.book, full, CAP, T0 + 2 * WEEK_MS)
ok(bankCount(blocked.bank, 'rootbulb') === 0 && blocked.book.list[0].landed === 0, 'full bank: nothing lands, nothing counted')
ok(contractView(blocked.book.list[0], T0 + 2 * WEEK_MS).waiting === 2 * lot.n, 'full bank: the owed lots show as waiting')
const blockedLate = landContracts(s.book, full, CAP, T0 + SEASON_MS + 5 * DAY_MS)
ok(blockedLate.book.list.length === 1 && !!openContract(blockedLate.book, 'trade-co', 'rootbulb', T0 + SEASON_MS + 5 * DAY_MS), 'full bank past the season: the contract stays until it has all landed')
const room = landContracts(blockedLate.book, freshBank(), CAP, T0 + SEASON_MS + 6 * DAY_MS)
ok(bankCount(room.bank, 'rootbulb') === 12 * lot.n && room.book.list.length === 0, 'room again: all 12 land, then it drops off')

// 20% off bulk while it runs
ok(bulkPrice(lot, freshBook(), 'trade-co', T0) === lot.price, 'perk: no contract, full price')
ok(bulkPrice(lot, s.book, 'trade-co', T0 + DAY_MS) === Math.round(lot.price * 0.8), 'perk: a contract running, 20% off')
const met = SUPPLIER_KINDS['trade-co'].lots.find(l => l.id === 'venium')!
ok(bulkPrice(met, s.book, 'trade-co', T0 + DAY_MS) === Math.round(met.price * 0.8), 'perk: 20% off EVERY bulk lot at that supplier, not just the material')
ok(bulkPrice(lot, s.book, 'trade-co', T0 + SEASON_MS) === lot.price, 'perk: gone when the season ends')
const b = buyLot(rich, newInv(), 'trade-co', 'rootbulb', bulkPrice(lot, s.book, 'trade-co', T0 + DAY_MS))
ok(b.ok && b.ledger.marks === rich.marks - Math.round(lot.price * 0.8), 'buyLot charges the discounted price passed in')
const b0 = buyLot(rich, newInv(), 'trade-co', 'rootbulb')
ok(b0.ok && b0.ledger.marks === rich.marks - lot.price, 'buyLot without a price = the lot price (M205 unchanged)')

// the save + the tab-safe landing (shared localStorage = reloads + two tabs)
ok(GARDEN_KEY_SPECS.some(k => k.base === CONTRACTS_KEY) && CONTRACTS_KEY === 'open.contracts.v1', 'save: open.contracts.v1 is a garden key')
ok(adoptBook(null).list.length === 0 && adoptBook({ v: 1, list: [{ kind: 'x' }, c] }).list.length === 1, 'adopt: junk dropped, a good contract kept')
mem.clear()
saveBank(freshBank()); saveContracts(s.book)
const now = T0 + 2 * WEEK_MS + DAY_MS
const tabA = landContractsNow(CAP, now)
ok(!!tabA && bankCount(loadBank(), 'rootbulb') === 2 * lot.n && loadContracts().list[0].landed === 2 * lot.n, 'load 1: 2 weeks owed land, bank + contract both saved')
const tabB = landContractsNow(CAP, now + 1000)
ok(!!tabB && tabB.landed.length === 0 && bankCount(loadBank(), 'rootbulb') === 2 * lot.n, 'a second tab / a reload right after: lands NOTHING (reads the raised count)')
landContractsNow(CAP, now + 2000); landContractsNow(CAP, now + 3000)
ok(bankCount(loadBank(), 'rootbulb') === 2 * lot.n, 'three more reloads: still exactly 2 lots')
landContractsNow(CAP, T0 + 3 * WEEK_MS + 10)
ok(bankCount(loadBank(), 'rootbulb') === 3 * lot.n, 'a week later: exactly one more')
mem.clear()
ok(landContractsNow(CAP, now) === null && !mem.has(BANK_KEY), 'no contracts: nothing read-modified, the bank untouched')

console.log(`contracts: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
