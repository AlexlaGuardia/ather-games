// M234 s1b — `holding_philter` and `bond_philter` are CUT (athernyx 30d19fd for the bond one; d0211ca, Alex 11-27: the philter class retired, the bottle cut rather than
// re-homed; Wakereed stays a forage-only ingredient). Two halves:
//   1. it is gone from everything a keeper can reach: the item table, the potions, the chain's recipes, the buffs;
//   2. an OLD SAVE that holds one (bag, bank, chest, rack, a play3d bag/chest, a brewing pot, a recipe book) loads clean
//      with the cut stack simply left out and every other stack where the keeper put it.
//   npx tsx src/app/shimmer/voxel3d/cut-items.test.ts
import { CUT_ITEMS, isCutItem, dropCutItems, salvageItems } from '../voxel/salvage'
import { ITEMS } from '../sprites/items'
import { POTION_DEFS } from '../engine/alchemy'
import { POTION_BUFFS, POTION_BUFF_MS } from '../engine/potion-effects'
import { inventoryFromSave, chestFromSave, type InventorySave } from '../engine/inventory'
import { ALCHEMY_RECIPES, ALCHEMY_INTERMEDIATES } from './alchemy-chain'
import { bankFromSave } from './bank'
import { adoptChest, adoptRack } from './chest'
import { brewingsFromSave } from './brewing'
import { parseBook, LADDER } from './recipe-book'
import { itemUniverse } from './item-universe'
import { MAT } from '../voxel/depth'
import { dropCutStacks, newInv } from '../open/shared/inventory'
import { BLOCKS } from '../voxel/registry'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const CUT = 'holding_philter'
// Both spirit bottles: holding_philter (d0211ca) and bond_philter (30d19fd, food feeds spirits, potions heal keepers).
const CUTS: [string, RegExp][] = [['holding_philter', /holding\s*philter/i], ['bond_philter', /bond\s*philter/i]]

// ── 1. gone ──────────────────────────────────────────────────────────────────────────────────────
ok(CUTS.every(([id]) => CUT_ITEMS.has(id)) && CUT_ITEMS.size === CUTS.length, 'the cut list names both, and only them')
for (const [id, NAME] of CUTS) {
  ok(!ITEMS.some(i => i.id === id || NAME.test(i.name) || NAME.test(i.description ?? '')), `${id}: no item row is it or names it`)
  ok(!(id in POTION_DEFS) && !Object.values(POTION_DEFS).some(d => NAME.test(d.name)), `${id}: no potion is it`)
  ok(!ALCHEMY_RECIPES.some(r => r.output.itemId === id || isCutItem(r.output.itemId) || NAME.test(JSON.stringify(r))), `${id}: no chain recipe makes it or a stage of it`)
  ok(!LADDER.includes(id), `${id}: the recipe book can never learn it`)
  ok(!(id in POTION_BUFFS) && !(id in POTION_BUFF_MS), `${id}: no buff`)
  ok(!itemUniverse().has(id), `${id}: not in the item universe`)
}
ok(!ALCHEMY_INTERMEDIATES.some(isCutItem), 'no intermediate of either')
ok(itemUniverse().has('moonberry') && ITEMS.some(i => i.id === 'moonberry'), 'moonberry stays obtainable')

// Wakereed stays: an item, dropped by its plant, obtainable.
const reed = ITEMS.find(i => i.id === 'wakereed')
ok(!!reed && !/philter/i.test(reed.description ?? '') && !/bond that will not settle/.test(reed.description ?? ''), 'wakereed stays an item, its blurb no longer promises the cut bottle')
ok(BLOCKS.find(b => b.material === MAT.WAKEREED)?.drops?.[0]?.itemId === 'wakereed', 'the plant still drops it')
ok(itemUniverse().has('wakereed'), 'wakereed is still in the item universe')

// isCutItem reads the chain's intermediates and leaves near-names alone.
ok(isCutItem('stage_holding_philter_1') && isCutItem('stage_holding_philter_2') && isCutItem('base_holding_philter'), 'its stages and its base are cut too')
ok(isCutItem('bond_philter') && isCutItem('stage_bond_philter_1') && !isCutItem('moonvine_tonic') && !isCutItem('stage_moonvine_tonic_1') && !isCutItem('wakereed') && !isCutItem('moonberry') && !isCutItem('holding_philter_x'), 'nothing else is')

// ── 2. an old save loads clean ──────────────────────────────────────────────────────────────────
// The voxel bag (VoxelWorld restores `p.inv.slots` through dropCutItems).
{
  const bag = [{ itemId: 'wakereed', count: 4 }, { itemId: CUT, count: 2 }, { itemId: 'bond_philter', count: 1 }, { itemId: 'stage_holding_philter_1', count: 1 }, { itemId: 'moonvine_tonic', count: 1 }]
  const out = dropCutItems(bag)
  ok(out.length === bag.length, 'the bag keeps its size')
  ok(out[0]?.itemId === 'wakereed' && out[0]?.count === 4 && out[4]?.itemId === 'moonvine_tonic', 'every other stack stays in its slot')
  ok(out[1] === null && out[2] === null && out[3] === null, 'both cut stacks and a stage are gone')
  ok(dropCutItems(out) === out, 'a clean bag comes back as the same array (no churn)')
  ok(salvageItems(out).changed.length === 0, 'nothing for the salvage line to say about it: the drop is quiet')
}
// The plot bank (all chests on the plot are one pool).
{
  const back = bankFromSave(JSON.parse(JSON.stringify([{ itemId: CUT, count: 3 }, { itemId: 'raw_mana_shard', count: 9 }, { itemId: 'base_holding_philter', count: 1 }, { itemId: 'bond_philter', count: 4 }])))
  ok(back.length === 1 && back[0]!.itemId === 'raw_mana_shard' && back[0]!.count === 9, 'an old bank drops it and keeps the shards')
}
// A chest and a rack off the plot.
{
  const c = adoptChest([{ itemId: CUT, count: 1 }, { itemId: 'moonberry', count: 5 }, { itemId: 'bond_philter', count: 2 }])
  ok(c[0] === null && c[1]?.itemId === 'moonberry' && c[2] === null, 'an old chest drops it in place')
  const r = adoptRack([{ itemId: 'stage_holding_philter_2', count: 1 }, { itemId: 'wakereed', count: 3 }])
  ok(r[0] === null && r[1]?.itemId === 'wakereed', 'an old rack drops its stage')
}
// The play3d bag + chest (engine/inventory).
{
  const saved: InventorySave = [{ itemId: CUT, count: 2 }, { itemId: 'moonberry', count: 1 }, { itemId: 'bond_philter', count: 3 }]
  const inv = inventoryFromSave(saved)
  ok(inv.slots[0] === null && inv.slots[1]?.itemId === 'moonberry' && inv.slots[2] === null, 'a play3d bag drops it')
  const ch = chestFromSave({ furnitureInstanceId: 'f1', slots: [null, { itemId: CUT, count: 1 }, { itemId: 'wakereed', count: 2 }] })
  ok(ch.slots[1] === null && ch.slots[2]?.itemId === 'wakereed' && ch.slots.length === 3, 'a play3d chest drops it and keeps its size')
}
// The open-world bag (loadInv runs dropCutStacks).
{
  const i = newInv(); i.slots[5] = { id: 'bond_philter', n: 2 } as never; i.slots[6] = { id: CUT, n: 1 } as never; i.slots[7] = { id: 'moonberry', n: 3 } as never
  const o = dropCutStacks(i)
  ok(o.slots[5] === null && o.slots[6] === null && (o.slots[7] as { id: string } | null)?.id === 'moonberry' && o.slots.length === i.slots.length, 'an open-world bag drops both and keeps the moonberries')
  ok(dropCutStacks(o) === o, 'and a clean open bag is returned as is')
}
// A pot left brewing one, and a recipe book that had learnt it.
{
  const at = { space: 'plot', x: 1, y: 2, z: 3 }
  const pots = brewingsFromSave({ 'plot:1,2,3': { potionId: CUT, host: 'a', hands: { a: 'A' }, stage: 1, lit: false, startedAt: 1, at } })
  ok(Object.keys(pots).length === 0, 'an old pot of it loads as no pot')
  const book = parseBook({ known: ['mana_draught', CUT, 'bond_philter'], cauldron: true })
  ok(!!book && book.known.join() === 'mana_draught' && book.cauldron === true, 'an old recipe book forgets the page and keeps the rest')
}

console.log(`cut-items: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
