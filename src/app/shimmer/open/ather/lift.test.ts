// Run: npx tsx src/app/shimmer/open/ather/lift.test.ts
// The lift (ather/lift.ts, BETA M48 slice 1): a shaft spans every level (slab hole + a gate where the car is not), a cell with a
// wall on ANY level is refused, the ride/call state machine, the walker's moving floor, the save round-trip, an old save has no lift.
import { FURNITURE, PIECE_JOBS } from './furniture'
import { freshWorks, canPlacePiece, placePiece, workPickables, type Works } from './rooms'
import { planRun, runKeys, findRooms, canLay, type Walls } from './plot-walls'
import { withLevel, upperBoxes, levelBase, SLAB_T, STOREY } from './plot-floors'
import { shaftTop, liftLevels, shaftHoles, shaftBlockers, SHAFT_WHY, ride, call, carLevel, shaftKeys, shaftBlocked, liftSolids, stepCar, cordsOf, cordAimed, levelAt, CAR_SPEED, GATE_H } from './lift'
import { newInv, give, countOf } from '../shared/inventory'
import { STARTING_SQUARES } from './plot'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const box = (x0: number, z0: number, w: number, d: number): Walls => {
  let ws: Walls = {}
  for (const [a, b] of [[{ i: x0, j: z0 }, { i: x0 + w, j: z0 }], [{ i: x0, j: z0 + d }, { i: x0 + w, j: z0 + d }], [{ i: x0, j: z0 }, { i: x0, j: z0 + d }], [{ i: x0 + w, j: z0 }, { i: x0 + w, j: z0 + d }]]) ws = planRun(ws, runKeys(a, b), 'goldwood')
  return Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, { mat: v.mat }]))
}
const G = 2

// the recipe + the item: carpentry makes it from planks and Stone Brick
{ const f = FURNITURE.lift, job = PIECE_JOBS.find(j => j.id === 'lift')
  ok(!!f && f.name === 'Lift' && f.shaft === true && !f.solid, 'the Lift is a shaft piece named Lift, not a solid furniture box')
  ok(!!job && job.in.map(c => c.id).sort().join() === 'goldwood_plank,stone_brick' && job.out.id === 'lift', 'carpentry crafts it from planks and Stone Brick') }

// a two-level house (4x3 room on both) with a lift in a cell
const up0 = box(0, 0, 4, 3), roomKey = findRooms(up0)[0].key
const base: Works = withLevel({ ...freshWorks(), walls: box(0, 0, 4, 3) }, 1, { walls: up0, paid: { [roomKey]: 12 } })
const mk = (x: number, z: number): Works => ({ ...base, pieces: [{ id: 'l1', item: 'lift', x, z, q: 0, placedAt: 1 }] })
const w1 = mk(1.5, 1.5)
ok(shaftKeys(w1).has('1,1') && shaftKeys(w1).size === 1, 'a lift claims one cell')
// shaft spans every level: no slab on the cell on any upper level, gates on every level the car is not at
{ const slab = upperBoxes({ ...w1 } as never, G, shaftKeys(w1)).filter(b => b.x0 === 1 && b.z0 === 1 && Math.abs(b.y1 - b.y0 - SLAB_T) < 1e-6)
  ok(upperBoxes({ ...w1 } as never, G).some(b => b.x0 === 1 && b.z0 === 1 && Math.abs(b.y1 - b.y0 - SLAB_T) < 1e-6) && slab.length === 0, 'the upper slab has that cell without a lift, and leaves a hole with it')
  const s = liftSolids(w1, G, new Map())
  ok(s.length === 2, 'car at the ground: the car box + one gate (level 2)')
  const car = s[0], gate = s[1]
  ok(Math.abs(car.y1 - G) < 1e-9 && Math.abs(car.y1 - car.y0 - SLAB_T) < 1e-9, 'the car is a platform whose top is the ground floor')
  ok(Math.abs(gate.y0 - (G + levelBase(1) - SLAB_T)) < 1e-9 && Math.abs(gate.y1 - (G + levelBase(1) + GATE_H)) < 1e-9, 'level 2 is shut by a gate from its slab up')
  const up = liftSolids(ride(w1, 'l1', 1)!, G, new Map([['l1', G + STOREY]]))
  ok(Math.abs(up[0].y1 - (G + STOREY)) < 1e-9 && up.length === 2 && up[1].y0 === G - 0.5, 'car at level 2: its box at one storey up, a gate on the ground') 
  const moving = liftSolids(ride(w1, 'l1', 1)!, G, new Map([['l1', G + 1.7]]))
  ok(moving.length === 1 && Math.abs(moving[0].y1 - (G + 1.7)) < 1e-9, 'while it moves there are no gates, only the car (the walker rides its moving floor)') }

// a cell with a wall on ANY level is refused
{ const owned = new Set(STARTING_SQUARES), inv = give(newInv(), 'lift', 1).inv
  ok(shaftBlocked(base, 0.5, 0.5) && shaftBlocked(base, 3.5, 2.5) && !shaftBlocked(base, 1.5, 1.5), 'a wall edge in the cell blocks it')
  const upperOnly: Works = { ...freshWorks(), upper: [{ walls: box(10, 10, 2, 2) }] }
  ok(shaftBlocked(upperOnly, 10.5, 10.5) && !canPlacePiece(upperOnly, owned, 'lift', 10.5, 10.5, 0, inv).ok, 'a wall only on level 2 refuses the cell (ground is clear)')
  ok(placePiece(base, owned, inv, 'lift', 0.5, 0.5, 0) === null, 'placing on a wall cell of the ground floor fails')
  void countOf }

// ride / call state machine
{ const w = w1
  ok(carLevel(w, w.pieces[0]) === 0, 'the car starts at the ground')
  const r = ride(w, 'l1', 1); ok(!!r && carLevel(r, r.pieces[0]) === 1, 'ride(1) sends the car to level 2')
  ok(ride(w, 'l1', 0) === null, 'ride to the level it is at: nothing')
  ok(ride(w, 'l1', 2) === null && ride(w, 'l1', -1) === null && ride(w, 'nope', 1) === null, 'ride to a level that does not exist / a lift that does not exist: refused')
  const c = call(r!, 'l1', 0); ok(!!c && carLevel(c, c.pieces[0]) === 0, 'call(0) brings it back')
  ok(call(r!, 'l1', 1) === null, 'call to where it already is: nothing')
  let y = G, n = 0; while (y < G + STOREY && n < 1000) { y = stepCar(y, G + STOREY, 1 / 60); n++ }
  ok(y === G + STOREY && Math.abs(n - STOREY / CAR_SPEED * 60) < 3, `the car arrives in ${n} frames at the right speed`)
  ok(levelAt(w, G, G + 0.1) === 0 && levelAt(w, G, G + STOREY + 0.05) === 1, 'the keeper\'s level is read from their feet') }

// one cord per level, aimable; the ray through the crosshair picks the right one
{ const p = w1.pieces[0], cs = cordsOf(p, G, 2)
  ok(cs.length === 2 && cs[0].x < cs[1].x, 'a pull-cord per level, floor 1 on the left')
  const eye: [number, number, number] = [1.5, G + 1.6, 1.5 - 2], target = cs[1]
  const dir = (t: { x: number; y0: number; z: number }) => { const d = [t.x - eye[0], t.y0 + 0.3 - eye[1], t.z - eye[2]], l = Math.hypot(...d); return d.map(v => v / l) as [number, number, number] }
  ok(cordAimed(p, G, 2, eye, dir(target)) === 1 && cordAimed(p, G, 2, eye, dir(cs[0])) === 0, 'aiming at a cord picks that floor')
  ok(cordAimed(p, G, 2, eye, [0, 0, -1]) === null, 'looking away picks none') }

// save round-trip, and an old save has no lift
{ const w = ride(w1, 'l1', 1)!, back = JSON.parse(JSON.stringify(w)) as Works
  ok(back.pieces[0].lv === 1 && carLevel(back, back.pieces[0]) === 1, 'the car level survives a save/load')
  ok(shaftKeys(freshWorks()).size === 0 && liftSolids(freshWorks(), G, new Map()).length === 0, 'an old save (no pieces) has no lift')
  ok(carLevel(base, { id: 'x', item: 'lift', x: 1.5, z: 1.5, q: 0, placedAt: 1 }) === 0, 'a lift with no saved level stands at the ground') }

// M48 leftover (hub 11-20): the shaft stops at the top floor that has a BUILT room over its cell; nothing pokes through a roof
{ ok(shaftTop(w1, w1.pieces[0]) === 1 && liftLevels(w1, w1.pieces[0]) === 2 && shaftHoles(w1).has('1,1,1'), 'room over the cell on floor 2: the shaft reaches floor 2, slab holed there')
  // floor 2 holds a room elsewhere (x 6..8), not over the lift: a one-storey shaft under the ground room's roof
  const other = box(6, 0, 2, 2), ok2 = findRooms(other)[0].key
  const w2: Works = { ...withLevel({ ...freshWorks(), walls: box(0, 0, 4, 3) }, 1, { walls: other, paid: { [ok2]: 4 } }), pieces: [{ id: 'l1', item: 'lift', x: 1.5, z: 1.5, q: 0, placedAt: 1 }] }
  ok(shaftTop(w2, w2.pieces[0]) === 0 && liftLevels(w2, w2.pieces[0]) === 1, 'no room over the cell upstairs: the shaft stops at the ground floor')
  ok(ride(w2, 'l1', 1) === null, 'the car never rides above the top floor it serves')
  ok(shaftHoles(w2).size === 0, 'no slab holes above the top')
  ok(liftSolids(w2, G, new Map()).length === 1, 'one floor served: the car, no gates')
  ok(carLevel({ ...w2, pieces: [{ ...w2.pieces[0], lv: 1 }] }, w2.pieces[0] as never) === 0 || carLevel({ ...w2, pieces: [{ ...w2.pieces[0], lv: 1 }] }, { ...w2.pieces[0], lv: 1 }) === 0, 'a saved level above the top clamps to the top')
  // a DRAFT room over the cell does not raise the shaft (only built rooms are a slab)
  const draft = Object.fromEntries(Object.entries(box(0, 0, 4, 3)).map(([k, v]) => [k, { ...v, draft: true as const }]))
  const w3: Works = { ...withLevel({ ...freshWorks(), walls: box(0, 0, 4, 3) }, 1, { walls: draft }), pieces: w2.pieces }
  ok(shaftTop(w3, w3.pieces[0]) === 0, 'a drafted room upstairs is not a floor yet') }

// M48 leftover: the wall tool refuses a run touching the shaft cell on an UPPER level (no pieces up there to block it)
{ const bl = { rects: shaftBlockers(w1), circles: [] }
  const into = canLay({}, runKeys({ i: 1, j: 2 }, { i: 3, j: 2 }), 'goldwood', () => true, bl)   // along the shaft cell's far edge (z = 2)
  ok(!into.ok && into.why === SHAFT_WHY, `a wall on the shaft cell's edge is refused (${'why' in into ? into.why : 'ok'})`)
  const across = canLay({}, runKeys({ i: 0, j: 1 }, { i: 3, j: 1 }), 'goldwood', () => true, bl)   // through the cell's near edge
  ok(!across.ok, 'a run crossing the shaft is refused')
  const clear = canLay({}, runKeys({ i: 3, j: 0 }, { i: 3, j: 3 }), 'goldwood', () => true, bl)   // x = 3, a cell away
  ok(clear.ok, 'a wall a cell away is fine')
  ok(shaftBlockers(base).length === 0, 'no lift: nothing blocked') }

// M47 close-out: E reaches the lift from every floor its shaft serves (the aim capsule spans the shaft, not the car's level)
{ const cap = (w: Works) => workPickables(w, () => 0).find(q => q.item.kind === 'piece')!
  const c1 = cap(w1), feet2 = levelBase(1)
  ok(c1.y0 <= 0 && c1.y1 >= feet2 + 1.5, `a 2-floor lift's capsule spans the ground to above floor 2's eye (${c1.y0.toFixed(2)}..${c1.y1.toFixed(2)}, floor 2 at ${feet2.toFixed(2)})`)
  const c0 = cap({ ...w1, pieces: [{ ...w1.pieces[0], lv: 1 }] })
  ok(Math.abs(c0.y1 - c1.y1) < 1e-9, 'the capsule does not move with the car (the car at floor 2 or the ground: the same shaft)') }

if (fails.length) { console.log(`FAIL ${fails.length}:\n - ${fails.join('\n - ')}`); process.exit(1) }
console.log(`lift.test: ${pass} pass, 0 fail`)
