// The workshop rooms core (rooms.ts). Run: npx tsx src/app/shimmer/open/ather/rooms.test.ts
import { ROOM_STORE_SLOTS, ROOM_ACCEPTS, roomAccepts, roomStore, stockRoom, stockRoomFromBag, takeFromRoom, makeBaitAt, benchCount, loadWorks, saveWorks, ROOMS, ROOM_ORDER, TABLE, KEEP_CLEAR, STARTER_CHEST, KEEPSTONE, KEEPSTONE_RECIPE, makeKeepstone, pickUpChest, canPlaceChest, placeChest, chestsStanding, chestBox, freshWorks, footprint, toWorld, benchOf, doorOf, canPlace, place, raised, progress, wallsOf, nearWork, type Works } from './rooms'
import { STARTING_SQUARES, squareAt, sqId, GATE, GREG, GROUND_Y } from './plot'
import { newInv, give, countOf, HOTBAR, SLOTS, ITEM_GROUP, OPEN_ITEMS, type Inv } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const owned = new Set<string>(STARTING_SQUARES)
const rich = give(newInv(12), 'goldwood_log', 40).inv
// a spot on the start ground, clear of everything (start ground = x -150..-90, z 90..150)
const P = { x: -100, z: 100 }
ok(!!squareAt(P.x, P.z) && owned.has(sqId(squareAt(P.x, P.z)!.i, squareAt(P.x, P.z)!.j)), 'setup: P is not on the start ground')

// the table stands on the start ground and clear of the gate, and its reach finds it
{ const s = squareAt(TABLE.x, TABLE.z); ok(!!s && owned.has(sqId(s.i, s.j)), 'table: not on the start ground') }
ok(Math.hypot(TABLE.x - GATE.x, TABLE.z - GATE.z) > 10, 'table: crowds the gate')
ok(nearWork(freshWorks(), TABLE.x + 1, TABLE.z)?.kind === 'table' && nearWork(freshWorks(), TABLE.x, TABLE.z - 5) === null, 'table: reach wrong')

// placing: owned ground only, clear of the keep-clear ground, no overlap, one of each, the mats leave the bag
ok(canPlace(freshWorks(), owned, 'rinnshop', P.x, P.z, 0, rich).ok, 'place: a clear owned spot was refused')
ok(!canPlace(freshWorks(), owned, 'rinnshop', -60, 60, 0, rich).ok, 'place: built on ground the keeper does not hold')
ok(!canPlace(freshWorks(), owned, 'rinnshop', -92, 100, 0, rich).ok, 'place: a room hanging off the held ground was allowed')
ok(!canPlace(freshWorks(), owned, 'rinnshop', GREG.x, GREG.z + 1, 0, rich).ok, 'place: built on Gregory')
ok(!canPlace(freshWorks(), owned, 'rinnshop', GATE.x + 4, GATE.z, 0, rich).ok, 'place: built in the gate')
ok(KEEP_CLEAR.every(k => !canPlace(freshWorks(), owned, 'rinnshop', k.x, k.z, 0, rich).ok), 'place: some keep-clear centre took a room')
ok(!canPlace(freshWorks(), owned, 'cooking', P.x, P.z, 0, rich).ok, 'place: a not-ready room was buildable (it is a coming-soon card)')
ok(!canPlace(freshWorks(), owned, 'rinnshop', P.x, P.z, 0, newInv(12)).ok, 'place: built without the logs')
const placed = place(freshWorks(), owned, rich, 'rinnshop', P.x, P.z, 1, 1000)!
ok(!!placed && countOf(placed.inv, 'goldwood_log') === 40 - ROOMS.rinnshop.cost[0].n && countOf(rich, 'goldwood_log') === 40, 'place: wrong logs taken, or it mutated its input')
const W: Works = placed.works
ok(!canPlace(W, owned, 'rinnshop', -120, 100, 0, rich).ok, 'place: a second Rinnshop was allowed')
ok(place(freshWorks(), owned, newInv(12), 'rinnshop', P.x, P.z, 0) === null, 'place: placed with no logs')

// raising: scaffolding until doneAt, then a bench to use
const r = W.rooms[0]
ok(!raised(r, 1000 + ROOMS.rinnshop.raiseMs - 1) && raised(r, 1000 + ROOMS.rinnshop.raiseMs), 'raise: wrong timing')
ok(progress(r, 1000) === 0 && progress(r, 1000 + ROOMS.rinnshop.raiseMs / 2) === 0.5 && progress(r, 1e12) === 1, 'raise: progress wrong')
const b = benchOf(r), d = doorOf(r)
ok(nearWork(W, d.x, d.z, 2000)?.kind === 'raising', 'near: a raising room did not say so at its door')
ok(nearWork(W, b.x, b.z, 1e12)?.kind === 'bench', 'near: the bench of a raised room was not found')
ok(nearWork(W, b.x, b.z, 2000)?.kind !== 'bench', 'near: a bench worked before the room stood')

// turning: footprint swaps at odd quarters; bench + door stay inside / on the edge for every turn
for (let q = 0; q < 4; q++) {
  const f = footprint('rinnshop', 0, 0, q), w = f.x1 - f.x0, dd = f.z1 - f.z0
  ok(q % 2 ? w === ROOMS.rinnshop.d && dd === ROOMS.rinnshop.w : w === ROOMS.rinnshop.w && dd === ROOMS.rinnshop.d, `turn ${q}: footprint did not swap`)
  const rr = { ...r, x: 0, z: 0, q }, bb = benchOf(rr), dr = doorOf(rr)
  ok(bb.x > f.x0 && bb.x < f.x1 && bb.z > f.z0 && bb.z < f.z1, `turn ${q}: the bench is outside the room`)
  ok(Math.abs(dr.x - f.x0) < 1e-9 || Math.abs(dr.x - f.x1) < 1e-9 || Math.abs(dr.z - f.z0) < 1e-9 || Math.abs(dr.z - f.z1) < 1e-9, `turn ${q}: the door is not on a wall`)
  // walls: solid round the room except a gap at the door; the bench stands in the open
  const walls = wallsOf(rr)
  const inWall = (x: number, z: number) => walls.some(k => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1)
  ok(walls.length === 5 && walls.every(k => k.y0 < GROUND_Y && k.y1 > GROUND_Y + 2), `turn ${q}: walls wrong count or height`)
  ok(!inWall(dr.x, dr.z) && !inWall(bb.x, bb.z), `turn ${q}: the doorway or the bench is walled`)
  const back = toWorld(rr, 0, ROOMS.rinnshop.d / 2), sideP = toWorld(rr, ROOMS.rinnshop.w / 2, 0), frontEdge = toWorld(rr, ROOMS.rinnshop.w / 2 - 0.5, -ROOMS.rinnshop.d / 2)
  ok(inWall(back.x, back.z) && inWall(sideP.x, sideP.z) && inWall(frontEdge.x, frontEdge.z), `turn ${q}: a wall is missing (back, side or front beside the door)`)
}
ok(ROOM_ORDER.length === 6 && ROOM_ORDER.every(k => k in ROOMS) && ROOMS.rinnshop.open, 'rooms: the six canon rooms are not all on the table, or the Rinnshop is shut')

// ── chests: the starter stands from the first minute; more are placed on held ground, never in a wall/door/bench ──
{ const s = squareAt(STARTER_CHEST.x, STARTER_CHEST.z); ok(!!s && owned.has(sqId(s.i, s.j)), 'chest: the starter chest is off the start ground') }
ok(nearWork(freshWorks(), STARTER_CHEST.x, STARTER_CHEST.z - 1)?.kind === 'chest', 'chest: the starter chest does not answer E')
ok(nearWork(freshWorks(), TABLE.x + 1, TABLE.z)?.kind === 'table', 'chest: the starter chest steals the table')
ok(chestsStanding(freshWorks()) === 1, 'chest: a fresh plot does not count its starter chest')
const C = { x: -100, z: 110 }
const ks = give(rich, KEEPSTONE, 10).inv
// a Keepstone is an ITEM: made from blankstone + a mana shard, set from the bag, picked back up
{
  const raw = give(give(newInv(12), 'blankstone', 7).inv, 'raw_mana_shard', 1).inv
  const m = makeKeepstone(raw)
  ok(!!m && countOf(m, KEEPSTONE) === 1 && countOf(m, 'blankstone') === 7 - KEEPSTONE_RECIPE[0].n && countOf(m, 'raw_mana_shard') === 0, 'keepstone: the recipe took the wrong things')
  ok(makeKeepstone(m!) === null && countOf(raw, KEEPSTONE) === 0, 'keepstone: made without a shard, or mutated its input')
}
ok(canPlaceChest(freshWorks(), owned, C.x, C.z, 0, ks).ok, 'keepstone: a clear owned spot was refused')
ok(!canPlaceChest(freshWorks(), owned, -60, 60, 0, ks).ok, 'keepstone: set off held ground')
ok(!canPlaceChest(freshWorks(), owned, C.x, C.z, 0, rich).ok, 'keepstone: set without one in the bag')
ok(!canPlaceChest(freshWorks(), owned, GATE.x + 3, GATE.z, 0, ks).ok, 'keepstone: set in the gate')
const pc = placeChest(freshWorks(), owned, ks, C.x, C.z, 1, 5)!
ok(!!pc && pc.works.chests.length === 1 && countOf(pc.inv, KEEPSTONE) === 9 && countOf(pc.inv, 'goldwood_log') === 40 && chestsStanding(pc.works) === 2, 'keepstone: setting it took the wrong things or did not count')
ok(!canPlaceChest(pc.works, owned, C.x + 1, C.z, 0, ks).ok, 'keepstone: set onto another one')
{
  const up = pickUpChest(pc.works, pc.chest.id, pc.inv)
  ok(!!up && up.works.chests.length === 0 && countOf(up.inv, KEEPSTONE) === 10, 'keepstone: pick up did not return it to the bag')
  ok(pickUpChest(pc.works, 'starter', pc.inv) === null, 'keepstone: the starter one was picked up')
  const packed = { v: 1 as const, slots: Array(32).fill(null).map(() => ({ id: 'blankstone', n: 99 })) }
  ok(pickUpChest(pc.works, pc.chest.id, packed) === null, 'keepstone: picked up into a full bag (it would vanish)')
}
// with a room standing: inside is fine, the wall / door / bench are not
{
  const rr = W.rooms[0], b = benchOf(rr), d = doorOf(rr), f = footprint(rr.kind, rr.x, rr.z, rr.q)
  const inside = toWorld(rr, -ROOMS.rinnshop.w / 2 + 1.2, 0)
  ok(canPlaceChest(W, owned, inside.x, inside.z, 0, ks).ok, 'chest: refused inside a room (a storeroom should be fine)')
  ok(!canPlaceChest(W, owned, b.x, b.z, 0, rich).ok, 'keepstone: set on the bench')
  ok(!canPlaceChest(W, owned, d.x, d.z, 0, rich).ok, 'keepstone: set in the doorway')
  ok(!canPlaceChest(W, owned, f.x0, (f.z0 + f.z1) / 2, 0, rich).ok, 'keepstone: set in a wall')
  // inside a room the nearer of chest and bench answers E
  const w2: Works = { ...W, chests: [{ id: 'c', x: inside.x, z: inside.z, q: 0, placedAt: 0 }] }
  ok(nearWork(w2, inside.x + 0.5, inside.z, 1e12)?.kind === 'chest' && nearWork(w2, b.x, b.z, 1e12)?.kind === 'bench', 'chest: chest vs bench nearest-wins wrong')
}
// the cap: ten chests and no more
{
  let w: Works = freshWorks(), inv = give(newInv(12), KEEPSTONE, 20).inv
  for (let k = 0; k < 12; k++) { const r = placeChest(w, owned, inv, -146 + 4 * (k % 4) + 2, 92 + 4 * Math.floor(k / 4), 0, k); if (r) { w = r.works; inv = r.inv } }
  ok(chestsStanding(w) === 10, `chest: the cap is not ten (got ${chestsStanding(w)})`)
}
{ const k = chestBox(STARTER_CHEST); ok(k.y0 < GROUND_Y && k.y1 > GROUND_Y + 0.5, 'chest: the walker can walk through a chest') }

// ── room stores: each room keeps its own, only its own materials, small on purpose ──
{
  const rid = W.rooms[0].id
  const bagWith = (...st: [string, number][]) => { const inv = newInv(12); st.forEach(([id, n], k) => { inv.slots[HOTBAR + k] = { id, n } }); return inv }
  const inv = bagWith(['mast', 6], ['glowfin', 2], ['goldwood_log', 30], ['blankstone', 5])
  const logAt = HOTBAR + 2
  const no = stockRoom(W, rid, inv, logAt)
  ok(no.moved === 0 && 'why' in no && /keeps/.test(no.why) && no.inv === inv, 'store: the Rinnshop took logs')
  const all = stockRoomFromBag(W, rid, inv)
  const st = roomStore(all.works.rooms[0])
  ok(all.moved === 8 && st.stacks.length === 2 && countOf(all.inv, 'goldwood_log') === 30 && countOf(all.inv, 'blankstone') === 5 && countOf(all.inv, 'mast') === 0, 'store: stock-from-bag moved the wrong things')
  ok(countOf(all.inv, 'bait') === countOf(inv, 'bait'), 'store: stock-from-bag took bait out of the hotbar')
  ok(roomStore(W.rooms[0]).stacks.length === 0, 'store: mutated the works it was given')
  // the bench cuts from the store first, bait goes to the bag
  const before = countOf(all.inv, 'bait')
  const m = makeBaitAt(all.works, rid, all.inv, 'mast')!
  ok(!!m && countOf(m.inv, 'bait') === before + 2 && benchCount(m.works.rooms[0], m.inv, 'mast') === 5 && countOf(m.inv, 'mast') === 0, 'bench: did not cut from the store first')
  const bagOnly = makeBaitAt(W, rid, bagWith(['mast', 1]), 'mast')!
  ok(!!bagOnly && countOf(bagOnly.inv, 'mast') === 0, 'bench: did not fall back to the bag')
  ok(makeBaitAt(W, rid, newInv(12), 'mast') === null && makeBaitAt(W, rid, bagWith(['mast', 1]), 'goldwood_log') === null, 'bench: cut from nothing, or cut a log')
  // take back out
  const k = roomStore(all.works.rooms[0]).stacks.findIndex(s => s.id === 'glowfin')
  const t = takeFromRoom(all.works, rid, k, all.inv)
  ok(t.moved === 2 && countOf(t.inv, 'glowfin') === 2 && !roomStore(t.works.rooms[0]).stacks.some(s => s.id === 'glowfin'), 'store: take-back lost the catch')
  // small on purpose: never past ROOM_STORE_SLOTS
  let big: Inv = newInv(0); big.slots = big.slots.map((_, i) => (i >= HOTBAR ? { id: i % 2 ? 'glowfin' : 'moonkoi', n: 99 } : null))
  const full = stockRoomFromBag(W, rid, big)
  ok(roomStore(full.works.rooms[0]).stacks.length === ROOM_STORE_SLOTS && full.moved === ROOM_STORE_SLOTS * 99, 'store: went past its slots or lost items')
  // every room's rule: every item a room keeps is real, and the Rinnshop keeps every catch
  ok(Object.keys(OPEN_ITEMS).filter(id => ITEM_GROUP[id] === 'rinning').every(id => roomAccepts('rinnshop', id)), 'accepts: the Rinnshop refuses a catch')
  ok(!roomAccepts('rinnshop', 'repeater') && !roomAccepts('carpentry', 'mast') && roomAccepts('carpentry', 'goldwood_log') && roomAccepts('stonemason', 'blankstone') && !roomAccepts('alchemy', 'blankstone'), 'accepts: a room rule is wrong')
  ok(Object.keys(ROOM_ACCEPTS).length === ROOM_ORDER.length, 'accepts: a room has no rule')
  // the save keeps the store; junk in it is dropped
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } }
  const dirty = { ...all.works, rooms: all.works.rooms.map(r => ({ ...r, store: [...(r.store ?? []), null, { id: 'x', n: -2 }] as any })) }
  saveWorks(dirty)
  const back = loadWorks()
  ok(JSON.stringify(roomStore(back.rooms[0]).stacks) === JSON.stringify(roomStore(all.works.rooms[0]).stacks), 'save: the room store did not round-trip clean')
}

if (fails.length) { console.error(`rooms: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rooms: ${pass}/0`)
