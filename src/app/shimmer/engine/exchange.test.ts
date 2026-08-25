// Run: npx tsx src/app/shimmer/engine/exchange.test.ts
//
// buyFromGE used to DISCARD the leftover from addItems and always report success with the full
// cost. Buy 5 into a full bag → pay for 5, receive 0, no error (the caller's `if (!res.success)`
// guard never fired). This file locks the fix: a buy charges ONLY for what the bag actually
// takes, and refuses outright when nothing fits. Restore the bug (drop the leftover, always
// return success) and case (a) goes red.

import { createGEState, buyFromGE, getMarketPrice, GE_ITEM_IDS } from './exchange'
import { createInventory, countItem, INVENTORY_SLOTS } from './inventory'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const item = GE_ITEM_IDS[0]
check('there is at least one tradeable item to test', !!item)

console.log('full bag — the bug this file exists for')
{
  const ge = createGEState()
  const inv = createInventory()
  // Fill every slot with something ELSE, so the bought item can neither stack nor find an empty slot.
  for (let i = 0; i < INVENTORY_SLOTS; i++) inv.slots[i] = { itemId: '__filler__', count: 1 }
  const priceBefore = getMarketPrice(ge, item)
  const res = buyFromGE(ge, 999_999, inv, item, 5)
  check('buy into a full bag fails', res.success === false, `success=${res.success}`)
  check('a failed buy charges 0 marks', res.totalMarks === 0, `charged ${res.totalMarks}`)
  check('a failed buy delivers 0 items', (res.received ?? 0) === 0)
  check('no phantom item entered the bag', countItem(inv, item) === 0)
  check('a failed buy does not move the price', getMarketPrice(ge, item) === priceBefore)
}

console.log('empty bag — a normal buy still works and charges exactly right')
{
  const ge = createGEState()
  const inv = createInventory()
  const price = getMarketPrice(ge, item)
  const res = buyFromGE(ge, 999_999, inv, item, 3)
  check('buy succeeds', res.success === true)
  check('all 3 delivered', res.received === 3, `received ${res.received}`)
  check('3 now in the bag', countItem(inv, item) === 3, `have ${countItem(inv, item)}`)
  check('charged ceil(price × 3)', res.totalMarks === Math.ceil(price * 3), `charged ${res.totalMarks} vs ${Math.ceil(price * 3)}`)
  check('price did not fall after a buy', getMarketPrice(ge, item) >= price)
}

console.log('partial fit — one free slot, a non-stacking overflow charges only for what lands')
{
  const ge = createGEState()
  const inv = createInventory()
  for (let i = 0; i < INVENTORY_SLOTS - 1; i++) inv.slots[i] = { itemId: '__filler__', count: 1 }
  const price = getMarketPrice(ge, item)
  const res = buyFromGE(ge, 999_999, inv, item, 5)  // only 1 empty slot
  check('partial buy succeeds', res.success === true)
  check('delivered ≤ requested and > 0', (res.received ?? 0) > 0 && (res.received ?? 0) <= 5, `received ${res.received}`)
  check('charged for exactly what was delivered', res.totalMarks === Math.ceil(price * (res.received ?? 0)), `charged ${res.totalMarks}`)
  check('bag holds exactly what was charged for', countItem(inv, item) === (res.received ?? 0))
}

console.log('not enough marks — refused, nothing added')
{
  const ge = createGEState()
  const inv = createInventory()
  const res = buyFromGE(ge, 0, inv, item, 1)
  check('broke player cannot buy', res.success === false)
  check('nothing entered the bag', countItem(inv, item) === 0)
}

console.log(`\nexchange: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
