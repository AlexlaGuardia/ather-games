// ── BETA M115 s2: THE SEASON CONTRACT (pure + a guarded load/save) ──
// Alex 11-23 / CONFIRMED + amended athernyx 7fedaef: the second way to buy at a supplier. A SEASON CONTRACT (the word is 'contract';
// 'standing order' + 'deed' are retired): costly up front, keeps ONE material coming for a full season (90 days), and while it runs
// 20% OFF extra bulk from that supplier (Alex's number). RULED athernyx e32f9c4: the goods cross through Benji's Ather Trading Co.
// via the public gate-landings and are delivered to the GARDEN (not the ship, no new courier) = the garden bank (ather/garden-bank.ts).
//   · Cadence (ours, the row: "a shipment lands each game week"): one lot every 7 REAL days after signing, so a 90-day season holds
//     floor(90 / 7) = 12 deliveries (days 7, 14 ... 84); the last 6 days carry only the 20% perk.
//   · Price (Jin's, 🟨): the whole season paid on signing = DELIVERIES x the lot's bulk price. Same Marks per unit as twelve bulk buys,
//     all of it up front (costly), and in return: no bag room needed, no trips, and 20% off any extra bulk there while it runs.
//   · OFFLINE: nothing ticks. What is owed is a pure function of (start, now); `landed` counts the UNITS already in the bank, so a
//     landing is owed - landed: exact after any time away, never twice on a reload. A full bank leaves the rest waiting (still owed),
//     never lost and never trimmed.
//   · ONE contract per material per supplier at a time (a new one once the old season is over and all of it has landed).
//   · TWO TABS: landContractsNow re-reads BOTH stores from localStorage and writes both back in the same synchronous task, so a second
//     tab that loads after the first landed reads the raised `landed` and lands nothing.
import { gardenKey } from '@/lib/keeper-local'
import { supplierKind, type Lot } from './suppliers'
import { putIn, loadBank, saveBank, type Bank } from '../ather/garden-bank'
import type { Ledger } from '../trade'

export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
export const SEASON_MS = 90 * DAY_MS
/** deliveries in one season: one each full week inside the 90 days */
export const DELIVERIES = Math.floor(SEASON_MS / WEEK_MS)
/** Alex's number: 20% off extra bulk at a supplier while a contract with it runs */
export const CONTRACT_BULK_OFF = 0.2

export interface Contract { kind: string; id: string; /** units per delivery (the lot's n at signing) */ n: number; /** ms, signed at */ start: number; /** units already in the bank */ landed: number; paid: number }
export interface ContractBook { v: 1; list: Contract[] }
export const freshBook = (): ContractBook => ({ v: 1, list: [] })

export const contractPrice = (lot: Lot) => lot.price * DELIVERIES
/** deliveries due by `now` (clamped: a clock set back owes nothing, never a negative) */
export const dueCount = (c: Contract, now: number) => Math.max(0, Math.min(DELIVERIES, Math.floor((now - c.start) / WEEK_MS)))
export const contractEnds = (c: Contract) => c.start + SEASON_MS
/** the season still runs (the perk holds) */
export const seasonOn = (c: Contract, now: number) => now >= c.start && now < contractEnds(c)
/** still on the books: the season runs, or some of it has not landed yet */
export const contractOpen = (c: Contract, now: number) => now < contractEnds(c) || c.landed < c.n * DELIVERIES
export const openContract = (b: ContractBook, kind: string, id: string, now: number) => b.list.find(c => c.kind === kind && c.id === id && contractOpen(c, now)) ?? null

/** what the panel shows: deliveries still to come, when the next one lands (null = none left), units waiting for bank room */
export function contractView(c: Contract, now: number) {
  const due = dueCount(c, now)
  return { left: DELIVERIES - due, next: due < DELIVERIES ? c.start + (due + 1) * WEEK_MS : null, waiting: Math.max(0, due * c.n - c.landed), ends: contractEnds(c) }
}

/** a bulk lot's price at this supplier now: 20% off while any contract with it runs */
export function bulkPrice(lot: Lot, b: ContractBook, kind: string, now: number) {
  return b.list.some(c => c.kind === kind && seasonOn(c, now)) ? Math.round(lot.price * (1 - CONTRACT_BULK_OFF)) : lot.price
}

export type Sign = { ok: true; ledger: Ledger; book: ContractBook; contract: Contract } | { ok: false; why: string }
/** Sign a season contract: the whole season leaves the purse once, or nothing changes. */
export function signContract(ledger: Ledger, b: ContractBook, kind: string, id: string, now: number): Sign {
  const lot = supplierKind(kind)?.lots.find(l => l.id === id)
  if (!lot) return { ok: false, why: 'Not sold here.' }
  if (openContract(b, kind, id, now)) return { ok: false, why: 'You already have a contract for this.' }
  const price = contractPrice(lot)
  if (ledger.marks < price) return { ok: false, why: `It costs ${price.toLocaleString()} Marks. You have ${ledger.marks.toLocaleString()}.` }
  const contract: Contract = { kind, id, n: lot.n, start: now, landed: 0, paid: price }
  return { ok: true, ledger: { ...ledger, marks: ledger.marks - price }, book: { v: 1, list: [...b.list, contract] }, contract }
}

/** Land whatever is owed into the bank (as far as it fits). Finished contracts (season over, all landed) drop off the books.
 *  Pure: the inputs are never mutated; `landed` lists what arrived, per material. */
export function landContracts(b: ContractBook, bank: Bank, cap: number, now: number): { book: ContractBook; bank: Bank; landed: { id: string; n: number }[] } {
  let bk = bank
  const landed: { id: string; n: number }[] = []
  const list = b.list.map(c => {
    const owed = dueCount(c, now) * c.n - c.landed
    if (owed <= 0) return c
    const r = putIn(bk, cap, c.id, owed), got = owed - r.left
    if (!got) return c
    bk = r.bank
    const at = landed.find(x => x.id === c.id); if (at) at.n += got; else landed.push({ id: c.id, n: got })
    return { ...c, landed: c.landed + got }
  }).filter(c => contractOpen(c, now))
  return { book: { v: 1, list }, bank: bk, landed }
}

// ── save: garden-tied (the deliveries go to the garden), registered in GARDEN_KEY_SPECS ──
export const CONTRACTS_KEY = 'open.contracts.v1'
export function adoptBook(v: unknown): ContractBook {
  const raw = (v as { v?: number; list?: unknown })?.list
  if ((v as { v?: number })?.v !== 1 || !Array.isArray(raw)) return freshBook()
  const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
  return { v: 1, list: raw.filter((c): c is Contract => !!c && typeof c.kind === 'string' && typeof c.id === 'string' && fin(c.n) && c.n >= 1 && fin(c.start) && fin(c.landed) && c.landed >= 0)
    .map(c => ({ kind: c.kind, id: c.id, n: Math.floor(c.n), start: c.start, landed: Math.floor(c.landed), paid: fin(c.paid) ? c.paid : 0 })) }
}
export function loadContracts(): ContractBook {
  try { return adoptBook(JSON.parse(localStorage.getItem(gardenKey(CONTRACTS_KEY)) ?? 'null')) } catch { return freshBook() }
}
export function saveContracts(b: ContractBook) { try { localStorage.setItem(gardenKey(CONTRACTS_KEY), JSON.stringify(b)) } catch { /* private window */ } }

/** Land on load, tab-safe: BOTH stores re-read from localStorage and written back in this one synchronous task (never from a copy
 *  held in memory). Null = no contracts on the books. */
export function landContractsNow(cap: number, now = Date.now()) {
  const b = loadContracts()
  if (!b.list.length) return null
  const r = landContracts(b, loadBank(), cap, now)
  if (r.landed.length) saveBank(r.bank)
  if (r.landed.length || r.book.list.length !== b.list.length) saveContracts(r.book)
  return r
}
