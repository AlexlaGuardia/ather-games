// Retired-item salvage oracle. Run: npx tsx src/app/shimmer/voxel/salvage.test.ts
//
// ★ THIS FILE GUARDS A DESTRUCTIVE OPERATION. Everything here runs over a player's actual save, so
// the failure mode is not a wrong number on screen — it is someone's evening of quarrying gone,
// silently, on load, with no way to get it back. The asserts are therefore mostly about what must
// NOT happen.

import { RETIRED_ITEMS, salvageItems, salvageMessage, type SlotLike } from './salvage'
import { BLOCKS } from './registry'
import { RECIPES } from './recipes'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const eq = (a: unknown, b: unknown, msg: string) => ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)

const bag = (...items: (SlotLike | null)[]) => items

// ── the mapping itself ───────────────────────────────────────────────────────────────────────────
{
  // ★ EVERY SUCCESSOR MUST BE A REAL, OBTAINABLE ITEM. A typo here does not throw — it quietly
  // rewrites a dead id into a DIFFERENT dead id, and the player's stack stays junk while the log
  // line claims it was fixed.
  const obtainable = new Set<string>()
  for (const b of BLOCKS) for (const d of b.drops) obtainable.add(d.itemId)
  for (const r of RECIPES) obtainable.add(r.output.itemId)
  for (const [from, to] of Object.entries(RETIRED_ITEMS)) {
    ok(obtainable.has(to), `★ ${from} → ${to}: the successor is a real item you can obtain`)
    // ⚠ A retired id must not ALSO still be obtainable, or the table is fighting the game: the
    // item would keep arriving in the bag and being rewritten on every load.
    ok(!obtainable.has(from), `★ ${from} is genuinely retired — nothing in the game still yields it`)
    ok(from !== to, `${from} does not map to itself`)
  }
}

// ── what it does ─────────────────────────────────────────────────────────────────────────────────
{
  const r = salvageItems(bag({ itemId: 'block_stone', count: 12 }))
  eq(r.slots[0]!.itemId, 'rubble', 'a retired item becomes its successor')
  eq(r.slots[0]!.count, 12, '★ the COUNT is preserved — a migration is not a tax')
  eq(r.changed.length, 1, 'and it is reported')
  eq(salvageMessage(r.changed), '12 block_stone → rubble', 'the player gets a line naming both sides')
}
{
  // Two stacks of the same retired id report as one line, but stay two slots — see the header on
  // why merging is deliberately not this function's job.
  const r = salvageItems(bag({ itemId: 'block_stone', count: 5 }, { itemId: 'block_stone', count: 7 }))
  eq(r.changed.length, 1, 'two stacks of one id are one reported change')
  eq(r.changed[0].count, 12, 'and the count is the total')
  eq(r.slots.length, 2, '★ but they stay two SLOTS — merging would need a stack limit this file must not know')
}

// ── ★ WHAT IT MUST NOT DO ────────────────────────────────────────────────────────────────────────
{
  const untouched = bag(
    { itemId: 'rubble', count: 3 },
    null,
    { itemId: 'goldwood_plank', count: 64 },
    { itemId: 'mana_seed', count: 2 },
    { itemId: 'some_future_item_this_file_never_heard_of', count: 9 },
  )
  const r = salvageItems(untouched)
  eq(r.changed.length, 0, 'a bag with nothing retired in it reports no change')
  for (let i = 0; i < untouched.length; i++)
    eq(JSON.stringify(r.slots[i]), JSON.stringify(untouched[i]), `slot ${i} is untouched`)

  // ★ THE ONE THAT MATTERS. An unknown id is NOT a deletion candidate. Treating this table as a
  // whitelist rather than a list of decisions is the version of this feature that eats saves.
  ok(r.slots[4] !== null && r.slots[4]!.itemId === 'some_future_item_this_file_never_heard_of',
    '★ an item this file has never heard of is LEFT ALONE, not deleted')
  ok(r.slots[1] === null, 'empty slots stay empty')

  // ★ AND THE PLANK SURVIVED. It changed meaning in the same ruling that retired block_stone — it
  // stopped being placeable — but it is still the currency every piece is priced in. Retiring it
  // would have wiped the one item the building grammar runs on.
  eq(r.slots[2]!.count, 64, '★ goldwood_plank is NOT retired — unplaceable is not the same as gone')
}
{
  // Purity: the input array must not be mutated, or a caller that keeps the old reference (a save
  // snapshot mid-write, say) sees the migration leak backwards into the file on disk.
  const orig: (SlotLike | null)[] = [{ itemId: 'block_stone', count: 4 }]
  const r = salvageItems(orig)
  eq(orig[0]!.itemId, 'block_stone', '★ the input bag is not mutated in place')
  ok(r.slots[0] !== orig[0], 'the rewritten slot is a new object')
}
{
  eq(salvageMessage([]), null, 'nothing to say when nothing changed')
}

console.log(`\nsalvage: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ an old bag catches up without losing anything')
