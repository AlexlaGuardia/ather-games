// The garden bank (garden-bank.ts). Run: npx tsx src/app/shimmer/open/ather/garden-bank.test.ts
import { CHEST_SLOTS, MAX_CHESTS, bankCap, freshBank, bankUsed, bankFree, bankCount, putIn, deposit, depositBag, withdraw, bankView, bankGroup, bankMatches, adoptBank, type Bank } from './garden-bank'
import { newInv, give, countOf, HOTBAR, SLOTS, itemDef, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const total = (inv: Inv, b: Bank, id: string) => countOf(inv, id) + bankCount(b, id)

ok(CHEST_SLOTS === 48 && MAX_CHESTS === 10 && bankCap(1) === 48 && bankCap(10) === 480 && bankCap(0) === 0, 'cap: a chest is not two bagfuls, or ten is not the limit')

// putIn: top up first, then new stacks, never past the cap, never over an item's own stack size
{
  const max = itemDef('goldwood_log').stack
  let b = putIn(freshBank(), 2, 'goldwood_log', max - 10).bank
  const r = putIn(b, 2, 'goldwood_log', 30)
  ok(r.left === 0 && r.bank.stacks.length === 2 && r.bank.stacks[0].n === max && r.bank.stacks[1].n === 20, 'putIn: did not top up before opening a slot')
  b = r.bank
  const full = putIn(b, 2, 'mast', 5)
  ok(full.left === 5 && full.bank.stacks.length === 2, 'putIn: went past the cap')
  const over = putIn(b, 2, 'goldwood_log', max)
  ok(over.left === 20 && over.bank.stacks.every(s => s.n <= max), 'putIn: a stack grew past its item size, or the top-up was lost')
  ok(b.stacks[1].n === 20, 'putIn: mutated its input')
}

// deposit / withdraw conserve every item, both ways, and leave what does not fit where it was
{
  let inv = give(newInv(12), 'goldwood_log', 50).inv, b = freshBank()
  const at = inv.slots.findIndex(s => s?.id === 'goldwood_log')
  const before = total(inv, b, 'goldwood_log')
  const d = deposit(inv, at, b, 48)
  ok(d.moved === 50 && d.inv.slots[at] === null && bankCount(d.bank, 'goldwood_log') === 50 && total(d.inv, d.bank, 'goldwood_log') === before, 'deposit: lost or duplicated logs')
  inv = d.inv; b = d.bank
  const w = withdraw(b, 0, inv)
  ok(w.moved === 50 && bankUsed(w.bank) === 0 && countOf(w.inv, 'goldwood_log') === 50, 'withdraw: did not come back whole')
  // a full bank refuses; the bag slot keeps its stack
  const fullBank: Bank = { v: 1, stacks: [{ id: 'mast', n: 1 }] }
  const r = deposit(give(newInv(12), 'blankstone', 3).inv, HOTBAR + 0, fullBank, 1)
  ok(r.moved === 0 && r.bank === fullBank, 'deposit: a full bank took something (or the empty slot did)')
  const inv2 = give(newInv(12), 'blankstone', 3).inv, bs = inv2.slots.findIndex(s => s?.id === 'blankstone')
  const r2 = deposit(inv2, bs, fullBank, 1)
  ok(r2.moved === 0 && countOf(r2.inv, 'blankstone') === 3, 'deposit: a refused stack left the bag')
  // a full bag: withdraw leaves the remainder in the bank
  const packed: Inv = { v: 1, slots: Array(SLOTS).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
  const r3 = withdraw({ v: 1, stacks: [{ id: 'mast', n: 7 }] }, 0, packed)
  ok(r3.moved === 0 && bankCount(r3.bank, 'mast') === 7, 'withdraw: lost mast into a full bag')
}

// depositBag: the bag empties, the hotbar stays in your hands
{
  const inv = newInv(12)   // give() fills the hotbar first, so set the bag slots by hand
  inv.slots[HOTBAR] = { id: 'goldwood_log', n: 99 }; inv.slots[HOTBAR + 1] = { id: 'goldwood_log', n: 21 }; inv.slots[SLOTS - 1] = { id: 'mast', n: 4 }
  const hot = inv.slots.slice(0, HOTBAR).map(s => s && { ...s })
  const r = depositBag(inv, freshBank(), 48)
  ok(r.inv.slots.slice(HOTBAR).every(s => s === null) && r.moved > 0, 'depositBag: the bag did not empty')
  ok(JSON.stringify(r.inv.slots.slice(0, HOTBAR)) === JSON.stringify(hot), 'depositBag: touched the hotbar')
  for (const id of ['goldwood_log', 'mast']) ok(total(r.inv, r.bank, id) === total(inv, freshBank(), id), `depositBag: ${id} not conserved`)
}

// over the cap (a chest gone, later): nothing is trimmed, deposits refuse, withdrawals still work
{
  const b: Bank = { v: 1, stacks: [{ id: 'mast', n: 3 }, { id: 'blankstone', n: 2 }, { id: 'glowfin', n: 1 }] }
  ok(bankFree(b, 2) === -1, 'over-cap: free should go negative, not clamp')
  ok(putIn(b, 2, 'moonkoi', 1).left === 1 && putIn(b, 2, 'mast', 2).left === 0, 'over-cap: refused a top-up, or took a new stack')
  ok(adoptBank(JSON.parse(JSON.stringify(b))).stacks.length === 3, 'over-cap: the loader trimmed to a cap')
}

// tabs are lenses: every stack shows under All and under exactly one skill tab; search ignores the tab
{
  const b: Bank = { v: 1, stacks: [{ id: 'moonkoi', n: 1 }, { id: 'goldwood_log', n: 9 }, { id: 'waymark', n: 2 }, { id: 'blankstone', n: 4 }, { id: 'mast', n: 1 }] }
  ok(bankView(b, 'all').length === 5, 'tabs: All does not show everything')
  const tabs = ['forestry', 'rinning', 'prospecting', 'gear'] as const
  ok(b.stacks.every((_, i) => tabs.filter(t => bankView(b, t).includes(i)).length === 1), 'tabs: a stack is under no tab, or under two')
  ok(bankGroup('goldwood_log') === 'forestry' && bankGroup('mast') === 'forestry' && bankGroup('moonkoi') === 'rinning' && bankGroup('blankstone') === 'prospecting' && bankGroup('waymark') === 'gear', 'tabs: wrong skill')
  ok(JSON.stringify(bankView(b, 'all').map(i => b.stacks[i].id).slice(0, 2)) === '["goldwood_log","mast"]', 'tabs: All is not sorted by skill then name')
  ok(bankView(b, 'gear', 'koi').length === 1 && bankMatches('goldwood_log', 'wood log') && !bankMatches('goldwood_log', 'stone'), 'search: wrong')
}

// off disk: junk is dropped, real stacks kept, a wrong version is a fresh bank
{
  const a = adoptBank({ v: 1, stacks: [{ id: 'mast', n: 2 }, null, { id: 7, n: 1 }, { id: 'x', n: -1 }, { id: 'y', n: 0.4 }, { id: 'glowfin', n: 3.7 }] })
  ok(a.stacks.length === 2 && a.stacks[1].n === 3, 'adopt: kept junk or lost a real stack')
  ok(adoptBank({ v: 2, stacks: [] }).stacks.length === 0 && adoptBank(null).stacks.length === 0, 'adopt: a strange record was trusted')
}

if (fails.length) { console.error(`garden-bank: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`garden-bank: ${pass}/0`)
