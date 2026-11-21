// Run: npx tsx src/app/shimmer/open/ather/alchemy.test.ts
// The alchemy room's cauldron (ather/alchemy.ts). Its names, recipes and numbers MIRROR canon's engine table; this file is
// what makes that mirror checked rather than hand-kept: every row is pinned against POTION_DEFS / potion-effects.
import { POTIONS, BREW, STARLIGHT_XP as OPEN_STARLIGHT, OPEN_FLOW_MULT, drink, buffOn, buffLeft, withBuff, isPotion } from './alchemy'
import { POTION_DEFS } from '../../engine/alchemy'
import { MANA_POTIONS, POTION_BUFFS, BUFF_DEFS, STARLIGHT_XP } from '../../engine/potion-effects'
import { ROOMS, roomAccepts, freshWorks, craftAt, type Works, type Room } from './rooms'
import { ALC_LIVE } from './furniture'
import { OPEN_ITEMS, ITEM_GROUP, newInv, give, countOf } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

for (const [id, p] of Object.entries(POTIONS)) {
  const d = POTION_DEFS[id]
  ok(!!d, `canon: ${id} is not a canon potion`)
  if (!d) continue
  ok(d.name === p.name, `canon: ${id} named "${p.name}", canon says "${d.name}"`)
  ok(JSON.stringify(d.recipe.map(r => [r.itemId, r.count])) === JSON.stringify(p.recipe.map(r => [r.id, r.n])), `canon: ${id}'s recipe drifted from POTION_DEFS`)
  ok(d.resultCount === p.makes, `canon: ${id} pours ${p.makes}, canon ${d.resultCount}`)
  ok((p.mana ?? 0) === (MANA_POTIONS[id] ?? 0), `canon: ${id} restores ${p.mana} mana, engine ${MANA_POTIONS[id]}`)
  ok((p.buff?.id ?? null) === (POTION_BUFFS[id] ?? null), `canon: ${id}'s buff is not the engine's`)
  if (p.buff) ok(p.buff.ms === BUFF_DEFS[p.buff.id].durationMs, `canon: ${id}'s span differs from BUFF_DEFS`)
  ok(p.recipe.every(r => !!OPEN_ITEMS[r.id]), `reach: ${id} needs something the open world never gives`)
  ok(OPEN_ITEMS[id]?.name === p.name && ITEM_GROUP[id] === 'alchemy' && !!OPEN_ITEMS[id].icon, `items: ${id} is not a bag row in the alchemy group with an icon`)
}
ok(OPEN_STARLIGHT === STARLIGHT_XP, 'canon: Starlight XP differs from the engine')
ok(OPEN_FLOW_MULT > 1 && OPEN_FLOW_MULT <= 3, 'tune: Ather Flow must be felt but keep mana a cost (see the file header)')
ok(BREW.length === Object.keys(POTIONS).length && BREW.every(j => isPotion(j.out.id)), 'brew: a potion with no job, or a job that pours something else')
// M57: once the alchemy SET is live the room is shut to new builds (rooms.ts); a room already standing still keeps its things
ok(ROOMS.alchemy.open === !ALC_LIVE, 'room: the alchemy room closes exactly when the alchemy set goes live')
ok(roomAccepts('alchemy', 'shard_tonic') && roomAccepts('alchemy', 'raw_mana_shard') && !roomAccepts('alchemy', 'goldwood_log'), 'room: the alchemy room is shut or keeps the wrong things')
// the cauldron: shards from the store, bark from the bag
const room: Room = { id: 'alchemy-1', kind: 'alchemy', x: 0, z: 0, q: 0, placedAt: 0, doneAt: 0, store: [{ id: 'raw_mana_shard', n: 3 }] }
const W: Works = { ...freshWorks(), rooms: [room] }
const m = craftAt(W, room.id, give(newInv(12), 'goldwood_bark', 2).inv, BREW.find(j => j.out.id === 'shard_tonic')!)
ok(!!m && countOf(m.inv, 'shard_tonic') === 1 && countOf(m.inv, 'goldwood_bark') === 0 && (m.works.rooms[0].store ?? []).length === 0, 'cauldron: did not brew from the store + bag')
// drinking
const t0 = 1_000_000
const low = drink('shard_tonic', { cur: 20, max: 100 }, {}, t0)
ok(low.ok && low.mana === 85, 'drink: a tonic did not restore 65')
const top = drink('shard_tonic', { cur: 70, max: 100 }, {}, t0)
ok(top.ok && top.mana === 100, 'drink: a tonic overfilled the bar')
const full = drink('shard_tonic', { cur: 100, max: 100 }, {}, t0)
ok(!full.ok && /full/.test(full.why), 'drink: a tonic was spent at a full bar')
const st = drink('starlight_tincture', { cur: 100, max: 100 }, {}, t0)
ok(st.ok && buffOn(st.buffs, 'starlight', t0) && buffLeft(st.buffs, 'starlight', t0) === 8 * 60_000, 'drink: Starlight did not start for 8 min')
const again = drink('starlight_tincture', { cur: 100, max: 100 }, st.ok ? st.buffs : {}, t0 + 60_000)
ok(again.ok && buffLeft(again.buffs, 'starlight', t0 + 60_000) === 8 * 60_000, 'drink: a second bottle stacked instead of refreshing')
ok(!buffOn(withBuff({}, 'ather_flow', 1000, t0), 'ather_flow', t0 + 1001), 'buff: did not run out')
ok(!drink('roast_rinn', { cur: 1, max: 100 }, {}, t0).ok, 'drink: drank a dish')
if (fails.length) { console.error(`alchemy: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`alchemy: ${pass}/0`)
