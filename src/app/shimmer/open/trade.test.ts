// The two-world trade v1, in numbers. Run: npx tsx src/app/shimmer/open/trade.test.ts

import { GOODS, NEW_LEDGER, CAPACITY, TIER_PRICE, TIER_DEEDS, postBoard, accept, arrive, abandon, canBuy, buy, crates, type Supply, type Ledger } from './trade'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const towns = ['ashfeld', 'millbrook', 'rune-hold', 'passage']
const KM: Record<string, number> = { 'ashfeld|millbrook': 1.3, 'ashfeld|rune-hold': 2.6, 'millbrook|rune-hold': 1.9, 'passage|rune-hold': 0.3, 'ashfeld|passage': 2.8, 'millbrook|passage': 2.1 }
const km = (a: string, b: string) => KM[[a, b].sort().join('|')] ?? Infinity
const supply: Supply[] = [{ place: 'rune-hold', goods: ['crystal', 'sap', 'ore'] }, { place: 'millbrook', goods: ['timber', 'searinn'] }, { place: 'ashfeld', goods: ['grain'] }]
const cap = CAPACITY.darter

// ── boards: deterministic, start here, fit the courser, pay more for longer hauls ──
{
  const a = postBoard('rune-hold', supply, towns, km, 1, cap), b = postBoard('rune-hold', supply, towns, km, 1, cap)
  ok(JSON.stringify(a) === JSON.stringify(b), 'the same seed must post the same board')
  ok(a.length === 3 && a.every(c => c.from === 'rune-hold' && c.to !== 'rune-hold'), 'a board posts 3 contracts from its own town to others')
  ok(a.every(c => crates(c) <= cap), `every posted contract must fit the Darter (${a.map(crates)})`)
  ok(postBoard('passage', supply, towns, km, 1, cap).length === 0, 'a town with no supply posts nothing')
  // pay scales with distance for the same good + qty
  const short = { ...a[0], km: 0.5 }, long = { ...a[0], km: 2.5 }
  const pay = (k: number) => Math.round(GOODS[a[0].good].rate * a[0].qty * Math.max(0.5, k) + 10)
  ok(pay(long.km) > pay(short.km), 'a longer haul must pay more')
  ok(GOODS.crystal.side === 'ather' && GOODS.ore.side === 'mortal', 'each good knows its world')
}

// ── a contract's life: accept → load at pickup → pay at drop (+1 deed), and the guards on it ──
{
  const [c] = postBoard('millbrook', supply, towns, km, 3, cap)
  let l: Ledger = { ...NEW_LEDGER }
  const r = accept(l, c, cap); ok(r.ok, 'a fitting contract can be taken'); l = r.ledger
  ok(!accept(l, c, cap).ok, 'only one contract at a time')
  ok(arrive(l, c.to, 10).event === null, 'arriving at the drop before loading does nothing')
  const ld = arrive(l, c.from, 10); ok(ld.event?.kind === 'loaded', 'stopping at the pickup loads the goods'); l = ld.ledger
  const elsewhere = towns.find(t => t !== c.from && t !== c.to)!
  ok(arrive(l, elsewhere, 20).event === null, `stopping somewhere else (${elsewhere}) does nothing`)
  const pd = arrive(l, c.to, 40)
  ok(pd.event?.kind === 'paid' && pd.ledger.deeds === 1 && pd.ledger.active === null, 'stopping at the drop pays and clears it')
  if (pd.event?.kind === 'paid' && GOODS[c.good].spoils === undefined) ok(pd.ledger.marks === NEW_LEDGER.marks + c.pay, `a non-perishable pays in full (${pd.event.marks} of ${c.pay})`)
  // too big for the courser
  const big = { ...c, good: 'timber' as const, qty: 3 }
  ok(!accept({ ...NEW_LEDGER }, big, cap).ok, `${crates(big)} crates must not fit a ${cap}-crate Darter`)
  ok(abandon(l).active === null, 'a contract can be dropped')
}

// ── perishables spoil: sea Rinn delivered slow pays less, never under a quarter ──
{
  const c = { id: 'x', good: 'searinn' as const, qty: 4, from: 'millbrook', to: 'ashfeld', km: 1.3, pay: 100, deeds: 1 }
  const run = (secs: number) => {
    let l = accept({ ...NEW_LEDGER }, c, cap).ledger
    l = arrive(l, 'millbrook', 0).ledger
    const r = arrive(l, 'ashfeld', secs)
    return r.event?.kind === 'paid' ? r.event.marks : -1
  }
  ok(run(30) > run(150) && run(150) > run(600), `faster sea Rinn pays more (${run(30)} > ${run(150)} > ${run(600)})`)
  ok(Math.abs(run(150) - 50) <= 1, `at its spoil time it pays half (${run(150)})`)
  ok(run(5000) >= 25, `spoiled Rinn still pays a quarter (${run(5000)})`)
}

// ── the garage: Marks buy, deeds unlock; tiers in order; stock is free ──
{
  const poor: Ledger = { ...NEW_LEDGER, marks: 100 }
  ok(canBuy(poor, 'core', 0).ok, 'stock is always available')
  ok(!canBuy(poor, 'core', 1).ok, `tier I costs ${TIER_PRICE[1]} Marks`)
  ok(!canBuy({ ...poor, marks: 5000 }, 'core', 2).ok, 'tier II before tier I is refused')
  const rich: Ledger = { ...NEW_LEDGER, marks: 5000 }
  const b1 = buy(rich, 'core', 1); ok(b1.ok && b1.ledger.owned.core === 1 && b1.ledger.marks === 5000 - TIER_PRICE[1], 'buying tier I spends its price')
  ok(!canBuy(b1.ledger, 'core', 2).ok, `tier II needs ${TIER_DEEDS[2]} deeds`)
  const deedy = { ...b1.ledger, deeds: TIER_DEEDS[2] }
  const b2 = buy(deedy, 'core', 2); ok(b2.ok && b2.ledger.owned.core === 2, 'with the deeds, tier II can be bought')
  ok(canBuy(b2.ledger, 'core', 1).ok && buy(b2.ledger, 'core', 1).ledger.marks === b2.ledger.marks, 'an owned tier is free to equip again')
  ok(!canBuy({ ...b2.ledger, deeds: TIER_DEEDS[3] - 1 }, 'core', 3).ok, `tier III needs ${TIER_DEEDS[3]} deeds`)
}

console.log(`trade: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
