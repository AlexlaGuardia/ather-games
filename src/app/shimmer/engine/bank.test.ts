// Garden Bank oracle — run: npx tsx src/app/shimmer/engine/bank.test.ts
//
// The bank replaces ten separate chest grids with one pooled store, which means a migration has to
// run once over a LIVE save. That is the part worth guarding: everything else here is arithmetic,
// but a migration bug silently eats a player's materials and there is no undo. So the asserts lean
// hard on conservation — items in must equal items out — and on the over-cap case, which is the
// one a real save will actually hit.

import {
  createBank, bankUsed, bankCapacity, bankDeposit, bankWithdraw, bankForceDeposit,
  bankCount, bankReachable, bankToSave, bankFromSave, migrateChestsToBank,
  availableCount, isChestFurniture, CHEST_CAPACITY, BASE_CAPACITY,
} from './bank'
import { createInventory, addItems } from './inventory'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

// ── 1. Scope: the garden is the homeplot, the Crucible is not ──
console.log('\n[realm scope]')
check('ather reachable', bankReachable('ather'))
check('undefined defaults to ather', bankReachable(undefined), 'most zones omit realm entirely')
check('crucible unreachable', !bankReachable('outside'), 'the Crucible must not see the bank')

// ── 2. Capacity comes from PLACED chests, and the tier ladder survives ──
console.log('\n[capacity]')
check('empty plot', bankCapacity([]) === BASE_CAPACITY, `got ${bankCapacity([])}`)
check('one wooden', bankCapacity(['chest']) === BASE_CAPACITY + 500)
check('ten wooden', bankCapacity(Array(10).fill('chest')) === BASE_CAPACITY + 5000)
check('tier ladder', CHEST_CAPACITY.ornate_chest > CHEST_CAPACITY.iron_chest
  && CHEST_CAPACITY.iron_chest > CHEST_CAPACITY.chest,
  'upgrading a chest must buy more than the last tier or the recipes are decoration')
check('unknown furniture adds nothing', bankCapacity(['alchemy_table']) === BASE_CAPACITY,
  'only chests contribute capacity')
check('chest detection', isChestFurniture('chest') && !isChestFurniture('alchemy_table'))

// ── 3. Deposit respects the cap and REPORTS the shortfall ──
console.log('\n[deposit]')
{
  const b = createBank()
  const cap = 100
  check('full deposit', bankDeposit(b, 'goldwood_plank', 60, cap) === 60)
  const landed = bankDeposit(b, 'goldwood_plank', 60, cap)
  check('partial deposit reports truth', landed === 40, `said ${landed}, room was 40`)
  check('cap respected', bankUsed(b) === 100, `used ${bankUsed(b)}`)
  check('nothing lands when full', bankDeposit(b, 'goldwood_bark', 5, cap) === 0)
  check('negative is a no-op', bankDeposit(b, 'goldwood_bark', -5, cap) === 0)
}

// ── 4. Withdraw never invents items, and empties tidily ──
console.log('\n[withdraw]')
{
  const b = createBank()
  bankForceDeposit(b, 'goldwood_plank', 30)
  check('over-withdraw is clamped', bankWithdraw(b, 'goldwood_plank', 100) === 30)
  check('emptied key is gone', bankCount(b, 'goldwood_plank') === 0)
  check('used is zero', bankUsed(b) === 0)
  check('withdrawing nothing', bankWithdraw(b, 'never_had_this', 5) === 0)
}

// ── 5. MIGRATION — conservation is the whole point ──
console.log('\n[migration]')
{
  const b = createBank()
  const grids = [
    [{ itemId: 'goldwood_plank', count: 50 }, null, { itemId: 'goldwood_bark', count: 20 }],
    [{ itemId: 'goldwood_plank', count: 50 }, { itemId: 'raw_mana_shard', count: 12 }],
    [null, null],
  ]
  const moved = migrateChestsToBank(b, grids)
  check('every item moved', moved === 132, `moved ${moved}, expected 132`)
  check('conservation', bankUsed(b) === 132, `bank holds ${bankUsed(b)}`)
  check('stacks merged across chests', bankCount(b, 'goldwood_plank') === 100,
    `same id in two chests must pool, got ${bankCount(b, 'goldwood_plank')}`)
  check('empty chests are harmless', bankCount(b, 'raw_mana_shard') === 12)
}

// ── 6. The over-cap case a REAL save will hit ──
// Ten wooden chests at 15 slots × 50-max stacks held ~7,500 planks under the old model. A player
// who filled them migrates in above whatever cap their placed chests now grant. Nothing may be
// trimmed; the pool simply refuses new deposits until it drains.
console.log('\n[over-cap survival]')
{
  const b = createBank()
  // The maxed-out old save: ten placed wooden chests, every one of their 15 slots holding a full
  // 50-stack. That is 7,500 items against a new cap of 5,250 — so the most invested players are
  // exactly the ones who migrate over-cap. This case is not hypothetical, it is the reward for
  // playing a lot, and it must not cost them a single plank.
  const grids = Array.from({ length: 10 }, () =>
    Array.from({ length: 15 }, () => ({ itemId: 'goldwood_plank', count: 50 })))
  const moved = migrateChestsToBank(b, grids)
  const cap = bankCapacity(Array(10).fill('chest'))
  check('hoard survives intact', bankUsed(b) === moved && moved === 7500,
    `migrated ${moved}, bank holds ${bankUsed(b)} — a live save must never be trimmed to fit`)
  check('over-cap is possible', bankUsed(b) > cap, `used ${bankUsed(b)} vs cap ${cap}`)
  check('deposits blocked while over', bankDeposit(b, 'goldwood_bark', 10, cap) === 0)
  check('still nothing lost', bankUsed(b) === 7500)
  // ...and it recovers the moment it drains below the line
  bankWithdraw(b, 'goldwood_plank', 7500 - cap + 10)
  check('recovers after draining', bankDeposit(b, 'goldwood_bark', 5, cap) === 5,
    'once under cap, deposits must work again')
}

// ── 7. Crafting sees satchel + bank together ──
console.log('\n[availability]')
{
  const inv = createInventory()
  addItems(inv, 'goldwood_plank', 8)
  const b = createBank()
  bankForceDeposit(b, 'goldwood_plank', 40)
  check('combined', availableCount(inv, b, 'goldwood_plank') === 48,
    `got ${availableCount(inv, b, 'goldwood_plank')}`)
  check('satchel only in the Crucible', availableCount(inv, null, 'goldwood_plank') === 8,
    'passing a null bank models being outside the garden')
  check('absent item', availableCount(inv, b, 'violet_crystal') === 0)
}

// ── 8. Save round-trip, including a corrupted save ──
console.log('\n[save round-trip]')
{
  const b = createBank()
  bankForceDeposit(b, 'goldwood_plank', 40)
  bankForceDeposit(b, 'raw_mana_shard', 7)
  const round = bankFromSave(bankToSave(b))
  check('round-trips', bankUsed(round) === 47 && bankCount(round, 'raw_mana_shard') === 7)
  const dirty = bankFromSave({ goldwood_plank: 10, not_a_real_item: 99, raw_mana_shard: -5, goldwood_bark: NaN })
  check('unknown ids dropped', bankCount(dirty, 'not_a_real_item') === 0)
  check('negatives dropped', bankCount(dirty, 'raw_mana_shard') === 0)
  check('NaN cannot poison the total', bankUsed(dirty) === 10, `used ${bankUsed(dirty)}`)
  check('empty save is fine', bankUsed(bankFromSave(undefined)) === 0)
}

console.log(failures === 0 ? '\nbank: PASS\n' : `\nbank: ${failures} FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
