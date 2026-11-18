// The backpack (backpack.ts, BETA M20). Run: npx tsx src/app/shimmer/open/ather/backpack.test.ts
import { dropPack, reclaim, parsePack, expired, near, PACK_LIFE_MS, PACK_REACH } from './backpack'
import { newInv, give, countOf, SLOTS, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const T0 = 1_700_000_000_000
let bag: Inv = newInv(12)                       // 12 waymarks + 10 bait
bag = give(bag, 'goldwood_log', 7).inv
const before = JSON.stringify(bag)
const d = dropPack(bag, 10, 4, -20, T0)
ok(JSON.stringify(bag) === before, 'drop: mutated its input')
ok(d.inv.slots.length === SLOTS && d.inv.slots.every(s => s === null), 'drop: the keeper still carries something')
ok(!!d.pack && d.pack.x === 10 && d.pack.y === 4 && d.pack.z === -20 && d.pack.at === T0, 'drop: the pack is not where they fell, or not stamped now')
ok(countOf({ v: 1, slots: d.pack!.items }, 'waymark') === 12 && countOf({ v: 1, slots: d.pack!.items }, 'goldwood_log') === 7 && countOf({ v: 1, slots: d.pack!.items }, 'bait') === 10, 'drop: the pack lost or invented items')
ok(JSON.stringify(d.inv.gifts) === JSON.stringify(bag.gifts), 'drop: the one-off gift record was dropped (re-arms the bait gift)')
ok(dropPack(newInv(0), 0, 0, 0, T0).pack !== null, 'drop: a bag with only bait left no pack')
ok(dropPack({ v: 1, slots: Array(SLOTS).fill(null) }, 0, 0, 0, T0).pack === null, 'drop: an empty bag left an empty pack')
// equipment an old bag still holds stays on the keeper, in its slot
const old: Inv = { v: 1, slots: Array(SLOTS).fill(null) }; old.slots[3] = { id: 'repeater', n: 1 }; old.slots[4] = { id: 'bait', n: 2 }
const od = dropPack(old, 0, 0, 0, T0)
ok(od.inv.slots[3]?.id === 'repeater' && od.inv.slots[4] === null && od.pack!.items.length === 1, 'drop: a gun went into the pack (equipment stays on the keeper)')

// reclaim in time = all back
const r = reclaim(d.inv, d.pack!, T0 + PACK_LIFE_MS - 1)
ok(r.pack === null && countOf(r.inv, 'waymark') === 12 && countOf(r.inv, 'goldwood_log') === 7 && countOf(r.inv, 'bait') === 10 && r.got === 29, 'reclaim: did not give everything back inside the life')
// past the life = gone, nothing given
const late = reclaim(d.inv, d.pack!, T0 + PACK_LIFE_MS + 1)
ok(late.pack === null && late.got === 0 && late.inv.slots.every(s => s === null), 'reclaim: an expired pack still paid out')
ok(!expired(d.pack!, T0 + PACK_LIFE_MS) && expired(d.pack!, T0 + PACK_LIFE_MS + 1), 'expired: the 5-minute edge is wrong')
ok(PACK_LIFE_MS === 300_000, 'life: Alex said five minutes')
// a bag that filled up since: what fits comes back, the rest stays in the pack
let crowded: Inv = { v: 1, slots: Array(SLOTS).fill(null).map((_, i) => ({ id: `stone_${i}`, n: 1 })) }
crowded.slots[0] = null
const cr = reclaim(crowded, d.pack!, T0 + 1000)
ok(cr.pack !== null && cr.got > 0 && cr.got < 29 && cr.pack.items.reduce((a, s) => a + s.n, 0) === 29 - cr.got, 'reclaim: a full bag lost the overflow instead of leaving it in the pack')
crowded = cr.inv
ok(cr.pack!.at === T0, 'reclaim: a partial take reset the hidden clock')
// touch reach
ok(near(d.pack!, 10 + PACK_REACH - 0.01, -20) && !near(d.pack!, 10 + PACK_REACH + 0.01, -20), 'near: the touch reach is wrong')
// one pack at a time: a second fall replaces it (the page saves only the new one); the new drop holds only what was carried then
const again = dropPack(r.inv, 50, 0, 50, T0 + 2000)
ok(again.pack!.x === 50 && again.pack!.at === T0 + 2000, 'replace: a second fall did not leave a fresh pack')
// the save
ok(parsePack(JSON.parse(JSON.stringify(d.pack)), T0 + 10)?.items.length === d.pack!.items.length, 'parse: a saved pack did not round-trip')
ok(parsePack(d.pack, T0 + PACK_LIFE_MS + 1) === null, 'parse: an expired pack loaded')
ok(parsePack(null, T0) === null && parsePack({ v: 1, x: 'a' }, T0) === null && parsePack({ v: 2 }, T0) === null, 'parse: junk loaded as a pack')
ok(parsePack({ ...d.pack!, items: [{ id: 'bait', n: 0 }] }, T0) === null, 'parse: a pack of nothing loaded')

if (fails.length) { console.error(`backpack: ${pass} pass, ${fails.length} FAIL\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`backpack: ${pass} pass, 0 fail`)
