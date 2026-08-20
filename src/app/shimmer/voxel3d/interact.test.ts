// Right-click intent oracle. Run: npx tsx src/app/shimmer/voxel3d/interact.test.ts
//
// This file exists because of a bug that produced NO symptom: the chest shipped, was crafted, was
// placed, and did nothing when right-clicked. The use-branch was gated on having something in hand,
// so opening a container empty-handed — the normal way anyone opens one — fell through to nothing.
// A dead click throws nothing, logs nothing and changes no state, so there is no evidence to read
// afterwards; the only defence is asserting what a click MEANS, by name, before it reaches a mouse.
//
// The first assert below is the bug. The rest are the neighbours it was hiding among.

import { rightClickIntent } from './interact'
import { MAT } from '../voxel/depth'
import { STATION_MAT } from '../voxel/workshop'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. ★ THE BUG: an empty hand opens a chest ───────────────────────────────────────────────────
{
  ok(rightClickIntent(MAT.CHEST, null, false) === 'open',
    'EMPTY-HANDED right-click on a chest OPENS it — the regression that made a placed chest inert')
  ok(rightClickIntent(MAT.CHEST, 'block_stone', false) === 'open',
    'and holding a block opens it too, rather than placing the block onto it')
  ok(rightClickIntent(MAT.CHEST, 'chest', false) === 'open',
    'holding ANOTHER chest still opens the one you aimed at — the case that hid the bug, since a '
    + 'player with two chests never sees it')
}

// ── 1b. the bench is a thing you USE (2026-08-13, the workshop pass) ────────────────────────────
// Stated separately from the sweep below because the failure has its own flavour: a player standing
// at his bench is very often holding more planks, and a plank is what a bench is MADE of. So the
// hand that most wants to open a table is exactly the hand that would have placed a second one.
{
  ok(rightClickIntent(MAT.CRAFT_TABLE, null, false) === 'work',
    'an empty hand at a crafting table opens its job')
  ok(rightClickIntent(MAT.CRAFT_TABLE, 'crafting_table', false) === 'work',
    'holding ANOTHER crafting table opens the one you aimed at rather than stacking a second')
  ok(rightClickIntent(MAT.CRAFT_TABLE, 'goldwood_plank', false) === 'work',
    'and a fistful of planks does not turn the bench into a floor tile')
  // ★ THE SWEEP THAT MATTERS MORE THAN THE ROWS: every station in the map is openable. A station
  // that places but never opens is a dead click, and a dead click is the least visible bug a game
  // can have — no error, no state change, nothing to tell a missing feature from a broken one.
  ok(Object.keys(STATION_MAT).every(m => rightClickIntent(Number(m), null, false) === 'work'),
    'EVERY material in STATION_MAT opens on right-click, not just the two named above')
}

// ── 2. use beats place, for every usable block ──────────────────────────────────────────────────
// The rule that makes a usable block usable: a full hand must never turn USE into PLACE, or the
// block in your hand lands on the thing you were trying to interact with.
{
  ok(rightClickIntent(MAT.POT_SEEDED, 'block_stone', false) === 'peek',
    'a seeded pot is asked how it is doing, not built on')
  ok(rightClickIntent(MAT.POT_BLOOM, 'block_stone', false) === 'harvest',
    'a bloomed pot hands over the spirit, not a stone block')
  ok(rightClickIntent(MAT.POT_SEEDED, null, false) === 'peek', 'and both work empty-handed')
  ok(rightClickIntent(MAT.POT_BLOOM, null, false) === 'harvest', 'as they must')
}

// ── 3. planting needs the seed to actually EXIST ────────────────────────────────────────────────
// The hotbar slot is a claim; the bag is the fact. A slot that says seed while the bag has none
// must not promise `plant` — that path removes an item, and removing one you do not have is how a
// count goes negative.
{
  ok(rightClickIntent(MAT.POT, 'mana_seed', true) === 'plant',
    'seed in hand AND in the bag → plant')
  ok(rightClickIntent(MAT.POT, 'mana_seed', false) === 'place',
    'seed in hand but NOT in the bag → falls through to place, never plant')
  ok(rightClickIntent(MAT.POT, 'block_stone', false) === 'place',
    'an empty pot with a block in hand is just a block you can build on')
  ok(rightClickIntent(MAT.POT, null, false) === 'none',
    'an empty pot, empty hand — nothing to do, and saying so is not a failure')
}

// ── 4. the fallback is PLACE, and empty-handed is NONE ──────────────────────────────────────────
// `place` is the fallback on purpose: it is the only outcome that consumes something, so an
// unrecognised block drops a block (visible, undoable) rather than swallowing the click.
{
  ok(rightClickIntent(MAT.STONE, 'block_stone', false) === 'place', 'ordinary block + item → place')
  ok(rightClickIntent(MAT.STONE, null, false) === 'none', 'ordinary block + empty hand → nothing')
  ok(rightClickIntent(MAT.AIR ?? 0, null, false) === 'none', 'and air is not special-cased into one')
}

// ── 5. no usable material answers `place` while it is usable ────────────────────────────────────
// A table-driven sweep, so a NEW usable block added to the intent chain without a test still gets
// this one property checked the moment someone lists it here.
{
  const usable: Array<[number, string]> = [
    [MAT.CHEST, 'open'], [MAT.POT_SEEDED, 'peek'], [MAT.POT_BLOOM, 'harvest'],
    [MAT.CRAFT_TABLE, 'work'], [MAT.SAWMILL, 'work'],
  ]
  for (const [mat, want] of usable) {
    ok(rightClickIntent(mat, 'block_stone', false) === want && rightClickIntent(mat, null, false) === want,
      `${want}: same answer with a full hand and an empty one`)
  }
}

// ── ★★ WATER IS THE MOST CLICKED-AT NOTHING IN THE WORLD ───────────────────────────────────────
// Both negatives matter more than the positive here. An empty hand over water must stay inert, or
// every stray click while swimming throws a line; a block in hand must still PLACE, or filling in a
// pond reads as placement being broken over water. The feature is the narrow case, not the default.
{
  ok(rightClickIntent(MAT.WATER, null, false, true) === 'rinn',
    'water + an empty hand casts, the way mining derives its tool from the block')
  ok(rightClickIntent(MAT.WATER, 'block_stone', false, true) === 'place',
    '★★ water + a block in hand still PLACES — filling a pond is a real thing to want')
  ok(rightClickIntent(MAT.WATER, null, false, false) === 'none',
    '★ and with no rod at all it is nothing, rather than a cast with an empty line')
  // ⚠ THE ASSERT THAT WOULD HAVE CAUGHT THE FIRST VERSION. It gated on the rinstick being the
  // SELECTED item — but tools are not hotbar items in this game, so `selItem` can never be a rod
  // and the intent was unreachable. A feature that cannot be triggered looks identical to one that
  // was never wired, and nothing else here would have said so.
  ok(rightClickIntent(MAT.WATER, 'worn_rinstick', false, true) !== 'rinn',
    '★★ a rod in `selItem` is NOT the trigger — tools are not hotbar items, that path is unreachable')
  // The flag is scoped to water and must not leak into blocks that already mean something.
  ok(rightClickIntent(MAT.CHEST, null, false, true) === 'open',
    'a chest still opens')
  ok(rightClickIntent(MAT.POT_BLOOM, null, false, true) === 'harvest',
    'and a bloomed pot still harvests')
}

console.log(fails.length ? `interact: ${pass} pass, ${fails.length} FAIL` : `interact oracle ${pass} CLEAN`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
