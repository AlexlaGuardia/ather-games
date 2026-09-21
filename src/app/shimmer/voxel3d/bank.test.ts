// Bank oracle. Run: npx tsx src/app/shimmer/voxel3d/bank.test.ts
//
// The pool is where every chest on the plot keeps its contents, so a loss here is a loss of
// EVERYTHING a keeper put away — conservation first, behaviour second, same order as chest.test.ts.
// The second half asks the tabs: a category that sorts a new item wrong is a tab that hides it,
// which is the invisible-feature shape this tree keeps paying for.

import {
  SLOTS_PER_CHEST, bankCapacity, bankUsed, bankFree, fitBank, pourInto, bankCategory, bankView,
  bankFreeSlots, bankCount, bankToSave, bankFromSave, bankMatches, BANK_TABS, type BankCategory,
} from './bank'
import { CHEST_SLOTS, createChest, addToGrid, type Slots } from './chest'
import { itemUniverse } from './item-universe'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const MAX = (id: string) => (id === 'mana_seed' ? 4 : 99)
const total = (g: Slots) => g.reduce((n, s) => n + (s?.count ?? 0), 0)
const label = (id: string) => id

// ── 1. capacity is the chest's own arithmetic ───────────────────────────────────────────────────
{
  ok(SLOTS_PER_CHEST === CHEST_SLOTS, 'a placed chest adds exactly what it would have held alone')
  ok(bankCapacity(0) === 0, 'no chest, no bank — the door IS the chest')
  ok(bankCapacity(10) === 480, 'ten chests = 480 stacks')
  ok(bankCapacity(-3) === 0, 'a negative census (a race) reads as empty, never as a negative cap')
}

// ── 2. fitBank only ever moves nulls ────────────────────────────────────────────────────────────
{
  const b: Slots = []
  fitBank(b, 96)
  ok(b.length === 96 && b.every(s => s === null), 'grow: empties appended')
  b[0] = { itemId: 'rubble', count: 99 }; b[50] = { itemId: 'glass', count: 3 }; b[95] = { itemId: 'chest', count: 1 }
  const before = total(b)
  const same = fitBank(b, 48)
  ok(same === b, 'in place — the panel and the host share one array')
  ok(b.length === 48, 'shrink: length is the new cap')
  ok(total(b) === before && bankUsed(b) === 3, 'shrink: nothing lost')
  ok(b[0]?.itemId === 'rubble' && b[1]?.itemId === 'glass' && b[2]?.itemId === 'chest', 'shrink: compacted in order')
  // over-cap: more stacks than the cap — the length holds every stack, no free slot
  const c: Slots = Array.from({ length: 5 }, (_, i) => ({ itemId: `x${i}`, count: 1 }))
  fitBank(c, 2)
  ok(c.length === 5 && bankUsed(c) === 5, '★ over-cap keeps every stack')
  ok(bankFree(c, 2) === -3, 'and reports negative room, which the panel reads as "refuse deposits"')
  fitBank(c, 0)
  ok(c.length === 5, 'a cap of zero cannot delete anything either')
}

// ── 3. pourInto: forced, tolerated, conserved ───────────────────────────────────────────────────
{
  const bank: Slots = []
  fitBank(bank, 2)
  bank[0] = { itemId: 'rubble', count: 50 }
  const chest = createChest()
  chest[0] = { itemId: 'rubble', count: 60 }
  chest[5] = { itemId: 'glass', count: 10 }
  chest[7] = { itemId: 'cut_stone', count: 20 }
  chest[9] = { itemId: 'mana_seed', count: 9 }
  const src = total(chest), dst = total(bank)
  const moved = pourInto(bank, chest, MAX)
  ok(moved === src, 'reports every item that moved')
  ok(total(chest) === 0 && chest.every(s => s === null), 'the source is emptied')
  ok(total(bank) === src + dst, '★ conservation across the pour')
  ok(bank.length > 2 && bankUsed(bank) > 2, 'over-cap: appended past the cap rather than dropped')
  ok(bankCount(bank, 'rubble') === 110, 'merged into the existing stack first')
  ok(bank.filter(s => s?.itemId === 'mana_seed').every(s => s!.count <= 4), 'the item ceiling still holds past the cap')
  // A malformed slot (count 0, or a bare hole) is skipped, not counted
  const junk: Slots = [{ itemId: 'glass', count: 0 }, null, { itemId: 'glass', count: 2 }]
  const b2: Slots = []; fitBank(b2, 1)
  ok(pourInto(b2, junk, MAX) === 2 && bankCount(b2, 'glass') === 2, 'a zero-count stack contributes nothing')
}

// ── 4. categories: every reachable item lands somewhere sensible, derived not enumerated ────────
{
  const cats: Record<BankCategory, string[]> = { blocks: [], pieces: [], materials: [], garden: [], brews: [], tools: [] }
  for (const id of itemUniverse().keys()) cats[bankCategory(id)].push(id)
  const has = (c: BankCategory, id: string) => cats[c].includes(id)
  ok(has('blocks', 'goldwood_plank') && has('blocks', 'cobblestone') && has('blocks', 'chest') && has('blocks', 'cauldron'), 'blocks: planks, stone, and the stations you place')
  ok(has('materials', 'goldwood_log') && has('blocks', 'goldwood_sapling'), 'a log is raw material (nothing places it); a sapling is a block')
  ok(has('pieces', 'piece_arch') && has('pieces', 'piece_door_double_goldwood') === false, 'pieces: every piece_*, only real ones')
  ok(cats.pieces.every(id => id.startsWith('piece_')) && cats.pieces.length > 200, 'pieces: the whole family and nothing else')
  ok(has('garden', 'seed_dawncap') && has('garden', 'dawncap_spore'), '★ a seed that DROPS from a block is garden, not a block')
  ok(has('garden', 'glowfin') && has('garden', 'bread') && has('garden', 'roast_rinn'), 'garden: the catch and the dish')
  ok(has('brews', 'mana_draught') && has('brews', 'ather_infusion'), 'brews: every potion')
  ok(bankCategory('stage_mana_draught_1') === 'brews', 'brews: a road stage')
  ok(has('tools', 'goldwood_blade') && has('tools', 'worn_rinstick'), 'tools: the tool table')
  ok(bankCategory('vessel_bracelet_t1') === 'tools', 'tools: a vessel')
  ok(has('materials', 'raw_mana_shard') && has('materials', 'amber_sap') && has('materials', 'glow_moss'), 'materials: what is left — shards, sap, moss')
  ok(cats.materials.length < 40, `materials is the remainder and stays small (${cats.materials.length})`)
  ok(BANK_TABS[0].id === 'all' && BANK_TABS.length === 7, 'seven tabs, All first')
}

// ── 5. the view is a permutation of indices, sorted, never a copy ───────────────────────────────
{
  const b: Slots = []
  fitBank(b, 8)
  b[6] = { itemId: 'glass', count: 1 }
  b[1] = { itemId: 'piece_arch', count: 2 }
  b[3] = { itemId: 'cobblestone', count: 5 }
  b[4] = { itemId: 'cobblestone', count: 99 }
  ok(bankView(b, 'all', label).join(',') === '3,4,6,1', 'All: blocks before pieces, cobblestone before glass, two stacks of one item in index order')
  ok(bankView(b, 'blocks', label).join(',') === '3,4,6', 'Blocks: only blocks')
  ok(bankView(b, 'pieces', label).join(',') === '1', 'Pieces: only pieces')
  ok(bankView(b, 'brews', label).length === 0, 'an empty tab is empty')
  ok(bankFreeSlots(b, 8).join(',') === '0,2,5,7', 'free slots are the first holes, in index order')
  ok(bankFreeSlots(b, 2).join(',') === '0,2', 'capped')
  // A drop onto the first free slot lands where addToGrid would have put a new stack
  const first = bankFreeSlots(b, 1)[0]
  addToGrid(b, 'thatch', 1, MAX)
  ok(b[first]?.itemId === 'thatch', 'the first offered empty is where a pickup would land')
}

// ── 6. save round-trip ──────────────────────────────────────────────────────────────────────────
{
  const b: Slots = [null, { itemId: 'glass', count: 4 }, null, { itemId: 'vessel_bracelet_t1', count: 1, vesselData: { move: 'x' } } as never]
  const saved = bankToSave(b)
  ok(saved.length === 2, 'compact on disk — no holes')
  const back = bankFromSave(JSON.parse(JSON.stringify(saved)))
  ok(back.length === 2 && back[0]!.itemId === 'glass' && (back[1] as { vesselData?: unknown }).vesselData !== undefined, 'stacks and their unique data survive')
  ok(bankFromSave(undefined).length === 0 && bankFromSave('nope').length === 0, 'absent or junk = empty')
  ok(bankFromSave([{ itemId: 'glass', count: NaN }, { itemId: 3, count: 1 }, { itemId: 'glass', count: 2.9 }]).map(s => s!.count).join() === '2', 'malformed dropped, fractions floored')
}

// ── ★ THE SEARCH BOX (2026-09-21) — a query searches the whole pool, the tab steps aside ───────
{
  const g: Slots = Array.from({ length: 12 }, () => null)
  addToGrid(g, 'raw_mana_shard', 5, MAX); addToGrid(g, 'goldwood_plank', 3, MAX); addToGrid(g, 'goldwood_log', 2, MAX)
  addToGrid(g, 'holding_philter', 1, MAX); addToGrid(g, 'seed_goldleaf', 4, MAX)
  const pretty = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const ids = (v: number[]) => v.map(i => g[i]!.itemId)
  ok(bankMatches('raw_mana_shard', 'Raw Mana Shard', 'shard') && bankMatches('raw_mana_shard', 'Raw Mana Shard', 'MANA sh'), 'a token matches the label, case-free, any order of tokens')
  ok(bankMatches('raw_mana_shard', 'Raw Mana Shard', 'raw_mana'), 'the id matches too, with its underscores read as spaces')
  ok(!bankMatches('raw_mana_shard', 'Raw Mana Shard', 'shard plank'), 'every token must match — one miss is a miss')
  ok(bankMatches('anything', 'Anything', '   '), 'a blank query matches everything')
  ok(ids(bankView(g, 'all', pretty, 'goldwood')).sort().join() === 'goldwood_log,goldwood_plank', 'the view under a query is the matching stacks')
  ok(ids(bankView(g, 'brews', pretty, 'goldwood')).sort().join() === 'goldwood_log,goldwood_plank', '★ a query searches the WHOLE pool — the Brews tab does not hide the planks')
  ok(ids(bankView(g, 'brews', pretty, '')).join() === 'holding_philter', 'and with no query the tab filters as before')
  ok(bankView(g, 'all', pretty, 'nothing like this').length === 0, 'no match, no rows')
  ok(ids(bankView(g, 'all', pretty, 'gold')).join() === 'goldwood_plank,goldwood_log,seed_goldleaf', 'results keep the rail order (the plank is a block, the log a material, the seed garden)')
}

console.log(`bank: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
