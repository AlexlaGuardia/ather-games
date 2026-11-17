// The workshop rooms core (rooms.ts). Run: npx tsx src/app/shimmer/open/ather/rooms.test.ts
import { ROOMS, ROOM_ORDER, TABLE, KEEP_CLEAR, freshWorks, footprint, toWorld, benchOf, doorOf, canPlace, place, raised, progress, wallsOf, nearWork, type Works } from './rooms'
import { STARTING_SQUARES, squareAt, sqId, GATE, GREG, GROUND_Y } from './plot'
import { newInv, give, countOf } from '../shared/inventory'
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
ok(nearWork(freshWorks(), TABLE.x + 1, TABLE.z)?.kind === 'table' && nearWork(freshWorks(), TABLE.x + 5, TABLE.z) === null, 'table: reach wrong')

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

if (fails.length) { console.error(`rooms: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rooms: ${pass}/0`)
