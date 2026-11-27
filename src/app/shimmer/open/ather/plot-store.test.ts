// Run: npx tsx src/app/shimmer/open/ather/plot-store.test.ts
// BETA M144 (Alex 11-24): a built piece taken down goes into the catalog's store, not the bag. Pins: build -> take down -> the
// store counts it; a plan takes stored pieces FIRST (charges only what is missing, a fully covered plan builds for nothing);
// Break down = EXACTLY the pre-M144 refund (raze with its carried fraction, toggleCol / toggleStair refunds, eraseDecks, the
// piece itself); a full bag never stops a take-down; a save from before M144 loads with an empty store; a JSON round trip keeps it.
import { planRun, runKeys, raze, toggleWindow, type Walls } from './plot-walls'
import { toggleCol } from './plot-cols'
import { toggleStair } from './plot-stairs'
import { eraseDecks, type Decks } from './plot-decks'
import { PER_COL, CRYSTAL_PANE } from './plot-bom'
import { stowWalls, stowCol, stowStair, stowDecks, stowPiece, breakDown, applyStore, adoptStore, storedCount, type PieceStore } from './plot-store'
import { billWithStore, buildWithStore } from './plot-store-bill'
import { liftPiece } from './piece-lift'
import { freshWorks } from './rooms'
import { newInv, give, countOf, itemDef, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const P = 'goldwood_plank'
const rich = (): Inv => { let i = newInv(0); i = give(i, P, 200).inv; i = give(i, CRYSTAL_PANE, 10).inv; i = give(i, 'stone_brick', 200).inv; return i }
const full = (): Inv => { const i = newInv(0); return { ...i, slots: i.slots.map(() => ({ id: 'bait', n: itemDef('bait').stack })) } }
type W = { walls: Walls; stored?: PieceStore; wallCarry?: Record<string, number> }

// 1. build 3 m of goldwood wall (an open run: no room), take it down: the store holds THAT piece, nothing reaches the bag
const run = runKeys({ i: 0, j: 0 }, { i: 3, j: 0 })
const plan: W = { walls: planRun({}, run, 'goldwood') }
const b1 = buildWithStore(plan, rich(), null)
ok(b1.ok, 'a 3 m plan builds from the bag')
if (b1.ok) {
  const built = b1.works, spent = countOf(rich(), P) - countOf(b1.inv, P)
  ok(spent === 5, `3 m x 1.5 rounds up to 5 planks (spent ${spent})`)
  const st = stowWalls(built.walls, run, undefined)
  ok(st.down === 3 && Object.keys(st.walls).length === 0, 'all 3 pieces came down')
  ok(storedCount(st.store, 'wall:goldwood') === 3, `store shows 3 stored (${storedCount(st.store, 'wall:goldwood')})`)
  ok(Math.abs((st.store['wall:goldwood'].v ?? 0) - 5) < 1e-9, 'the store keeps what they were paid (5 planks, exact)')
  // break down = EXACTLY raze's refund (the pre-M144 take-down), bag and carried fraction
  const ref = raze(built.walls, newInv(0), run, {}), bd = breakDown(st.store, 'wall:goldwood', newInv(0), {})
  ok(countOf(bd.inv, P) === countOf(ref.inv, P) && countOf(bd.inv, P) === 5, `break down gives raze's planks (${countOf(bd.inv, P)} vs ${countOf(ref.inv, P)})`)
  ok(JSON.stringify(bd.carry) === JSON.stringify(ref.carry), 'break down carries the same fraction as raze')
  ok(storedCount(bd.store, 'wall:goldwood') === 0 && bd.done === 3, 'break down empties that kind')
  // a carried fraction from earlier rides along exactly as in raze
  const ref2 = raze(built.walls, newInv(0), run.slice(0, 1), { [P]: 0.5 })
  const st2 = stowWalls(built.walls, run.slice(0, 1), undefined), bd2 = breakDown(st2.store, 'wall:goldwood', newInv(0), { [P]: 0.5 })
  ok(countOf(bd2.inv, P) === countOf(ref2.inv, P) && JSON.stringify(bd2.carry) === JSON.stringify(ref2.carry), 'a carried half plank: break down = raze')

  // 2. the same plan again: the store covers it all; the card is not empty, Build charges NOTHING and empties the store
  const again: W = { walls: planRun(st.walls, run, 'goldwood'), stored: st.store }
  const bill = billWithStore(again, newInv(0), null)
  ok(!bill.empty && bill.ok && bill.lines.length === 0 && bill.stored === 3, `fully stored plan: ready, no lines, 3 from store (${JSON.stringify(bill)})`)
  const b2 = buildWithStore(again, newInv(0), null)
  ok(b2.ok, 'a fully stored plan builds with an empty bag')
  if (b2.ok) {
    ok(Object.values(b2.works.walls).every(w => !w.draft) && Object.keys(b2.works.walls).length === 3, 'all 3 pieces stand again')
    ok(storedCount(b2.works.stored, 'wall:goldwood') === 0, 'the store gave them up (no dupe)')
    ok(!('wall:goldwood' in (b2.works.stored ?? {})), 'an emptied kind leaves no empty entry behind')
    ok(JSON.stringify(b2.inv) === JSON.stringify(newInv(0)), 'nothing was charged')
    const paidSum = Object.values(b2.works.walls).reduce((t, w) => t + (w.paid ?? 0), 0)
    ok(Math.abs(paidSum - 5) < 1e-9, `the rebuilt pieces carry their stored value (${paidSum})`)
  }
  // 3. a plan bigger than the store: only the missing pieces are charged (1 stored, 3 planned: 2 x 1.5 = 3 planks)
  const one = stowWalls(built.walls, run.slice(0, 1), undefined)
  const big: W = { walls: planRun(one.walls, runKeys({ i: 3, j: 0 }, { i: 5, j: 0 }).concat(run.slice(0, 1)), 'goldwood'), stored: one.store }
  const bb = billWithStore(big, rich(), null)
  ok(bb.lines.find(l => l.id === P)?.n === 3 && bb.stored === 1, `1 stored + 2 missing: charged 3 planks (${JSON.stringify(bb.lines)})`)
  const b3 = buildWithStore(big, rich(), null)
  ok(b3.ok && countOf(rich(), P) - countOf(b3.inv, P) === 3, 'Build spends only the missing pieces')
  // a stored piece is a shape: a dawnwood plan does not take goldwood from the store
  const other: W = { walls: planRun({}, runKeys({ i: 0, j: 2 }, { i: 1, j: 2 }), 'dawnwood'), stored: one.store }
  ok(billWithStore(other, rich(), null).stored === 0, 'a stored goldwood metre does not stand in for dawnwood')
}

// 4. a window: its pane is part of the piece (break down gives it back, as raze did)
{
  const k = runKeys({ i: 0, j: 0 }, { i: 1, j: 0 })
  const wins = toggleWindow(planRun({}, k, 'goldwood'), k[0])
  const wb = buildWithStore({ walls: wins.ok ? wins.walls : {} }, rich(), null)
  if (wb.ok) {
    const st = stowWalls(wb.works.walls, k, undefined), bd = breakDown(st.store, 'window:goldwood', newInv(0), {})
    const ref = raze(wb.works.walls, newInv(0), k, {})
    ok(storedCount(st.store, 'window:goldwood') === 1, 'a window is stored as a window')
    ok(countOf(bd.inv, CRYSTAL_PANE) === 1 && countOf(bd.inv, CRYSTAL_PANE) === countOf(ref.inv, CRYSTAL_PANE) && countOf(bd.inv, P) === countOf(ref.inv, P), 'window break down = raze (pane + planks)')
  } else ok(false, 'window plan builds')
}

// 5. a column and stairs: a full bag no longer refuses the take-down; break down = their pre-M144 refund
{
  const t = toggleCol({ '2,2': { mat: 'goldwood' } }, 2, 2, 'goldwood', true, PER_COL)
  ok(t.ok && !!t.refund, 'a built column comes down with a refund (pre-M144 rule)')
  const s = stowCol(undefined, { mat: 'goldwood' })   // no bag in the way at all
  ok(storedCount(s, 'col:goldwood') === 1, 'a column taken down with a FULL bag is stored (no refusal)')
  const bd = breakDown(s, 'col:goldwood', newInv(0))
  ok(t.ok && countOf(bd.inv, P) === t.refund!.n, `column break down = toggleCol refund (${countOf(bd.inv, P)})`)
  const fb = breakDown(s, 'col:goldwood', full())
  ok(fb.full && storedCount(fb.store, 'col:goldwood') === 1, 'break down into a full bag keeps the piece stored, nothing lost')
  // a planned column takes the stored one
  const cb = buildWithStore({ walls: {}, cols: { '4,4': { mat: 'goldwood', draft: true } }, stored: s }, newInv(0), null)
  ok(cb.ok && cb.ok && !cb.works.cols!['4,4'].draft && storedCount(cb.works.stored, 'col:goldwood') === 0, 'a planned column stands from the store for nothing')

  const st = toggleStair({ '0,0': { mat: 'goldwood', dir: 0 } }, {}, 0, 0, 0, 'goldwood', () => true)
  const ss = stowStair(undefined, { mat: 'goldwood', dir: 0 })
  const sb = breakDown(ss, 'stair:goldwood', newInv(0))
  ok(st.ok && !!st.refund && countOf(sb.inv, P) === st.refund.n, `stairs break down = toggleStair refund (${countOf(sb.inv, P)} vs ${st.ok ? st.refund?.n : '-'})`)
  const tt = stowStair(undefined, { mat: 'goldwood', dir: 0, turn: 'l' })
  ok(storedCount(tt, 'stair-turn:goldwood') === 1 && countOf(breakDown(tt, 'stair-turn:goldwood', newInv(0)).inv, P) > countOf(sb.inv, P), 'stairs with a turn are their own kind and give the landing back too')
}

// 6. open floor + a slab / panel
{
  const d: Decks = { '0,0': { pat: 'tile', col: '#aaaaaa' }, '1,0': { pat: 'tile', col: '#aaaaaa', draft: true } }
  const sd = stowDecks(d, [[0, 0], [1, 0]], undefined), ref = eraseDecks(d, [[0, 0], [1, 0]], newInv(0))
  ok(sd.up === 2 && storedCount(sd.store, 'deck:tile') === 1, 'a built floor cell is stored, a draft cell just goes')
  ok(countOf(breakDown(sd.store, 'deck:tile', newInv(0)).inv, 'stone_brick') === countOf(ref.inv, 'stone_brick'), 'floor break down = eraseDecks refund')
  const sp = stowPiece(undefined, 'goldwood_slab')
  ok(countOf(breakDown(sp, 'piece:goldwood_slab', newInv(0)).inv, 'goldwood_slab') === 1, 'a slab breaks down into the slab (what pick-up gave)')
  const a = applyStore({ walls: {}, planned: [{ item: 'goldwood_slab' }, { item: 'goldwood_slab' }], pieces: [], stored: sp })
  ok(a.used === 1 && (a.works.planned?.length ?? 0) === 1 && (a.works.pieces?.length ?? 0) === 1, 'one of two planned slabs comes from the store')
}

// 6b. picking up a built slab with a FULL bag: it goes into the store (liftPiece no longer says 'full' for a building piece)
{
  const w = { ...freshWorks(), pieces: [{ id: 's1', item: 'goldwood_slab', x: 0, z: 0, q: 0, placedAt: 0 }] }
  const r = liftPiece(w, 's1', full(), {})
  ok(typeof r === 'object' && storedCount(r.works.stored, 'piece:goldwood_slab') === 1 && r.works.pieces.length === 0, `a slab taken up with a full bag is stored (${typeof r === 'object' ? JSON.stringify(r.works.stored) : r})`)
}

// 7. save: an old save (no field) loads empty; a round trip keeps the store; junk is dropped
{
  ok(Object.keys(adoptStore(undefined)).length === 0, 'a save from before M144 loads with an empty store')
  const s: PieceStore = { 'wall:goldwood': { n: 3, v: 5 }, 'col:dawnwood': { n: 2 }, 'piece:goldwood_slab': { n: 1 } }
  ok(JSON.stringify(adoptStore(JSON.parse(JSON.stringify(s)))) === JSON.stringify(s), 'reload keeps the store exactly')
  const junk = adoptStore({ 'wall:plastic': { n: 1 }, 'col:goldwood': { n: -1 }, 'piece:nothing': { n: 1 }, 'deck:tile': { n: 1.5 }, x: 3 })
  ok(Object.keys(junk).length === 0, `junk kinds / counts are dropped (${JSON.stringify(junk)})`)
  ok(adoptStore({ 'wall:goldwood': { n: 2 } })['wall:goldwood'].v === 3, 'a wall kind without its value takes the rate (1.5 a metre)')
}

console.log(`plot-store: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
