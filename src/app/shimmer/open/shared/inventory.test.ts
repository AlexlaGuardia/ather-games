// The open world's bag (inventory.ts). Run: npx tsx src/app/shimmer/open/shared/inventory.test.ts
import { dropGuns, newInv, give, take, move, split, quickMove, countOf, HOTBAR, SLOTS, itemDef, OPEN_ITEMS, makeBait, BAIT_FROM, STARTING_BAIT, NO_BAIT_LINE, loadInv } from './inventory'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const a = newInv(12)
// ★ 11-18 (Alex): no gun in a bag, ever; weapons are equipment (loadout.ts)
ok(a.slots.length === SLOTS && a.slots[0]?.id === 'waymark' && a.slots[0]?.n === 12 && !a.slots.some(x => x && itemDef(x.id).kind === 'gun'), 'new: a fresh bag holds 12 waymarks in 1 and no gun')
ok(newInv(0).slots[0] === null, 'new: a keeper with every waymark planted starts with none in the bag')
ok(countOf(newInv(5), 'waymark') === 5, 'new: seeds the waymarks a keeper still has')
// take: bag first, then the hotbar; never below zero
let b = give(a, 'waymark', 0).inv
const t = take(a, 'waymark', 3)!
ok(countOf(t, 'waymark') === 9 && countOf(a, 'waymark') === 12, 'take: wrong count, or it mutated its input')
ok(take(a, 'waymark', 13) === null, 'take: took more than the bag holds')
ok(take(a, 'waymark', 12)!.slots[0] === null, 'take: an empty stack stays as a zero')
// give: tops up, respects the stack size, reports overflow
const g = give(t, 'waymark', 5)
ok(countOf(g.inv, 'waymark') === 14 && g.inv.slots[0]?.n === 12 && g.left === 0, 'give: did not top up to the stack size, then spill into a new slot')
const full = { v: 1 as const, slots: Array(SLOTS).fill(null).map(() => ({ id: 'repeater', n: 1 })) }
ok(give(full, 'waymark', 3).left === 3, 'give: a full bag swallowed items')
ok(itemDef('repeater').stack === 1 && give(give(a, 'repeater', 1).inv, 'repeater', 1).inv.slots.filter(s => s?.id === 'repeater').length === 2, 'give: a gun stacked')
// an older bag gives its gun back on load (guns are equipment now)
const old = { v: 1 as const, slots: a.slots.map((x, i) => (i === 3 ? { id: 'repeater', n: 1 } : x)), gifts: ['bait1'] }
ok(!dropGuns(old).slots.some(x => x?.id === 'repeater') && countOf(dropGuns(old), 'waymark') === 12, 'load: an older bag loses its gun and keeps the rest')
// the move / split mechanics on a fixed fixture (an item in 1, 12 waymarks in 2), apart from what a starter bag holds
const fx = { v: 1 as const, slots: a.slots.map((_, i) => (i === 0 ? { id: 'repeater', n: 1 } : i === 1 ? { id: 'waymark', n: 12 } : null)) }
// move: swap, merge with overflow, no-op on empty
b = move(fx, 0, HOTBAR + 3)
ok(b.slots[0] === null && b.slots[HOTBAR + 3]?.id === 'repeater', 'move: did not move into an empty slot')
b = move(fx, 0, 1)
ok(b.slots[0]?.id === 'waymark' && b.slots[1]?.id === 'repeater', 'move: did not swap different items')
let m = { v: 1 as const, slots: Array(SLOTS).fill(null) as ({ id: string; n: number } | null)[] }
m.slots[2] = { id: 'waymark', n: 10 }; m.slots[9] = { id: 'waymark', n: 5 }
m = move(m, 9, 2)
ok(m.slots[2]?.n === 12 && m.slots[9]?.n === 3, 'move: a merge past the stack size lost or invented items')
ok(move(fx, 5, 0) === fx, 'move: moving an empty slot changed something')
// split + quickMove
const s = split(fx, 1)
ok(s.slots[1]?.n === 6 && countOf(s, 'waymark') === 12 && s.slots.filter(x => x?.id === 'waymark').length === 2, 'split: not half, or items lost')
ok(s.slots.findIndex((x, i) => i !== 1 && x?.id === 'waymark') < HOTBAR, 'split: a hotbar stack split into the bag (same section first)')
const q = quickMove(fx, 0)
ok(q.slots[0] === null && q.slots.findIndex(x => x?.id === 'repeater') >= HOTBAR, 'quickMove: hotbar → bag failed')
ok(quickMove(q, q.slots.findIndex(x => x?.id === 'repeater')).slots.findIndex(x => x?.id === 'repeater') < HOTBAR, 'quickMove: bag → hotbar failed')

// gifts survive every bag op (a lost `gifts` re-armed the bait gift: +10 bait on every reload, found 11-16)
{ const g0 = newInv(12); const ops = [give(g0, 'waymark', 1).inv, take(g0, 'bait', 1)!, move(g0, 2, 9), split(g0, 1), quickMove(g0, 2)]
  ok(ops.every(x => (x.gifts ?? []).includes('bait1')), 'gifts: a bag op dropped the gift record (the bait gift would repeat on reload)') }
// icons: every icon an item names is a real file in public/ (a wrong path draws a broken image, not the plain chip),
// and every rinning item has one (they shipped blank 11-15)
for (const [id, d] of Object.entries(OPEN_ITEMS)) if (d.icon) ok(existsSync(join(process.cwd(), 'public', d.icon)), `icon: ${id} names ${d.icon}, which is not in public/`)
for (const id of ['bait', 'shimmerscale', 'clickclaw', 'glowfin', 'ribboneel', 'moonkoi', 'pearlshell', 'crystal_rinn']) ok(!!itemDef(id).icon, `icon: ${id} has no icon (the bag draws a blank chip)`)

// bait is MADE (BETA M6e): a small catch or mast cuts into bait, one at a time; never a moonkoi; never into a full bag
{ const out = take(newInv(12), 'bait', STARTING_BAIT)!
  ok(countOf(out, 'bait') === 0, 'bait: setup, the bag still holds bait')
  const f = makeBait(give(out, 'mast', 2).inv, 'mast')!
  ok(!!f && countOf(f.inv, 'bait') === BAIT_FROM.mast && countOf(f.inv, 'mast') === 1, 'bait: mast did not cut into bait one at a time')
  const s = makeBait(give(out, 'shimmerscale', 1).inv, 'shimmerscale')!
  ok(!!s && countOf(s.inv, 'bait') === 3 && countOf(s.inv, 'shimmerscale') === 0, 'bait: a shimmerscale did not make 3 bait')
  ok(makeBait(give(out, 'moonkoi', 1).inv, 'moonkoi') === null && !BAIT_FROM.moonkoi, 'bait: a moonkoi was cut (worth more landed)')
  ok(makeBait(out, 'mast') === null, 'bait: made bait from mast the bag does not hold')
  let full = give(out, 'mast', 1).inv
  for (let k = 0; k < SLOTS; k++) if (!full.slots[k]) full = { ...full, slots: full.slots.map((x, j) => (j === k ? { id: 'waymark', n: 12 } : x)) }
  full = { ...full, slots: full.slots.map(x => (x?.id === 'mast' ? { id: 'mast', n: 2 } : x)) }
  ok(makeBait(full, 'mast') === null, 'bait: made bait into a full bag (it would vanish)')
  ok(Object.keys(BAIT_FROM).every(id => !!OPEN_ITEMS[id]), 'bait: a bait food is not a bag item')
  ok(/bag/i.test(NO_BAIT_LINE) && /prun/i.test(NO_BAIT_LINE), 'bait: the out-of-bait line does not say where more comes from') }

// mast was shipped for an hour as 'forage': an old bag holding it loads as mast (loadInv), and mast has its icon
{ const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } }
  const old = newInv(12); old.slots[9] = { id: 'forage', n: 3 }
  store['open.inv.v1'] = JSON.stringify(old)
  const l = loadInv()
  ok(countOf(l, 'mast') === 3 && countOf(l, 'forage') === 0, 'mast: an old forage stack did not load as mast')
  delete (globalThis as any).localStorage }
ok(!!itemDef('mast').icon && !OPEN_ITEMS.forage, 'mast: no icon, or the placeholder forage item is still a bag row')
if (fails.length) { console.error(`inventory: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`inventory: ${pass}/0`)
