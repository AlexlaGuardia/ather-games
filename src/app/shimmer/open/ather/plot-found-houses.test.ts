// plot-found-houses.test (BETA M55 slice 2): the foundation PER HOUSE, door steps between heights, patios riding a raised house.
// npx tsx src/app/shimmer/open/ather/plot-found-houses.test.ts
import { liftOf, floorAt, plinthBoxes, doorSteps, setHouseFound, houseFoundDelta, adoptFoundCells, plinthPerM2, type Founded } from './plot-found'
import { findRooms, wallBoxes, type Walls } from './plot-walls'
import { withLevel, upperBoxes, STOREY, type Stacked } from './plot-floors'
import { deckBoxes, DECK_T, type Decks } from './plot-decks'
import { billOfAll } from './plot-bom'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { newInv } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
type W = Founded & Stacked
const box = (i0: number, j0: number, i1: number, j1: number): Record<string, { mat: 'goldwood'; kind?: 'door' }> => {
  const w: Record<string, { mat: 'goldwood'; kind?: 'door' }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  return w
}
const paidAll = (walls: Walls) => Object.fromEntries(findRooms(walls).map(r => [r.key, r.cells.length]))
// two houses 10 m apart, each 4 x 4 with a south door (2 m)
const A = box(0, 0, 4, 4), B = box(10, 0, 14, 4)
A['h,1,4'] = { mat: 'goldwood', kind: 'door' }; A['h,2,4'] = { mat: 'goldwood', kind: 'door' }
B['h,11,4'] = { mat: 'goldwood', kind: 'door' }; B['h,12,4'] = { mat: 'goldwood', kind: 'door' }
const walls: Walls = { ...A, ...B }
const base: W = { walls, paid: paidAll(walls) }

// ── an old save: one plot value, every house on it ──
{
  const old: W = { ...base, found: 0.6 }, L = liftOf(old)
  ok(L.houses.length === 2 && L.houses.every(h => h.h === 0.6 && h.built.length === 16), 'an old save: two houses, both on the plot\'s 0.6')
  ok(floorAt(old, 0, 1.5, 1.5) === 0.6 && floorAt(old, 0, 11.5, 1.5) === 0.6 && floorAt(old, 0, 6, 1.5) === 0, 'floorAt: both houses raised, the ground between not')
}
// ── per house: A Low, B High ──
const L0 = liftOf(base), hA = L0.houseAt(2, 2)!, hB = L0.houseAt(12, 2)!
ok(!!hA && !!hB && hA !== hB && L0.houseAt(7, 2, 2) === null, 'houseAt picks the house the view is on (and none between them)')
const two: W = setHouseFound(setHouseFound(base, hA, 0.6), hB, 1.2)
{
  const L = liftOf(two)
  ok(floorAt(two, 0, 1.5, 1.5) === 0.6 && floorAt(two, 0, 11.5, 1.5) === 1.2, 'house A stands Low (0.6), house B High (1.2)')
  ok(houseFoundDelta(hB, 0, 1.2) === 16 * plinthPerM2(1.2) && houseFoundDelta(hA, 0.6, 0) === -16, 'raising one house costs only ITS footprint; lowering gives it back')
  const pb = plinthBoxes(two, 0)
  ok(pb.some(b => b.x0 === 1 && b.z0 === 1 && b.y1 === 0.6) && pb.some(b => b.x0 === 11 && b.z0 === 1 && b.y1 === 1.2), 'each plinth is its own house\'s height')
  const wb = wallBoxes(walls, 0, L.edge)
  const wa = wb.find(b => b.x0 < 0 && b.z0 > 0 && b.z1 < 4)!, wbB = wb.find(b => b.x0 > 9 && b.x0 < 10.5 && b.z1 < 4)!
  ok(Math.abs(wa.y1 - (0.6 + 4.8)) < 1e-9 && Math.abs(wbB.y1 - (1.2 + 4.8)) < 1e-9 && wa.y0 < 0, 'walls stand on their own house\'s foundation (still solid down to the ground)')
  // door steps outside each: Low = 1 step, High = 2 steps, every rise under 0.5 m
  const st = doorSteps(two, 0)
  const sA = st.filter(b => b.x0 < 5), sB = st.filter(b => b.x0 > 9)
  ok(sA.length === 2 && sB.length === 4, `steps: ${sA.length / 2} at the Low door, ${sB.length / 2} at the High door (per 1 m door piece)`)
  ok([...sA, ...sB].every(b => b.z0 >= 4), 'the steps are outside (south of the door, on the low side)')
  const tops = (xs: typeof st, h: number) => [0, ...[...new Set(xs.map(b => +b.y1.toFixed(3)))].sort(), h]
  ok([tops(sA, 0.6), tops(sB, 1.2)].every(t => t.every((y, n) => n === 0 || y - t[n - 1] < 0.5)), 'every rise from the ground to each floor is under the 0.5 m step')
  // upper floors ride their own house: B's second storey walls at 1.2 + STOREY
  const up: W = withLevel(two, 1, { walls: B, paid: paidAll(B as Walls) })
  const ub = upperBoxes(up, 0, undefined, liftOf(up))
  const slab = ub.find(b => b.x0 === 11 && b.z0 === 1 && b.x1 === 12)
  ok(!!slab && Math.abs(slab.y1 - (1.2 + STOREY)) < 1e-9, `B's floor 2 sits on B's foundation (${slab?.y1.toFixed(2)})`)
  // walker: from the ground, walk north up B's steps into the house
  const world = terrainWorld({ ground: () => 0, solids: () => [...wb, ...pb, ...st], water: () => [] })
  const lc = createLoco(12, 0, 7)
  for (let t = 0; t < 30; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(lc, input({ mvZ: -1 }), world)
  ok(lc.py > 1.15 && lc.pz < 3.5, `a keeper walks up the High door's steps into house B (feet ${lc.py.toFixed(2)}, z ${lc.pz.toFixed(2)})`)
  // control: without the steps the High floor (1.2 m) is a wall to the walker
  const bare = terrainWorld({ ground: () => 0, solids: () => [...wb, ...pb], water: () => [] })
  const c = createLoco(12, 0, 7)
  for (let t = 0; t < 30; t++) tickLocomotion(c, input(), bare)
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(c, input({ mvZ: -1 }), bare)
  ok(c.py < 0.3, `(control: no steps, no way in: feet ${c.py.toFixed(2)})`)
}
// ── a door between two rooms at different heights (two houses joined by a room drawn between them keep their own heights) ──
{
  // A (0..4) and a room C (4..8) sharing A's east wall, joined by a door in it; A set High before C existed, C set Low after
  const C = box(4, 0, 8, 4); const wl: Record<string, { mat: 'goldwood'; kind?: 'door' }> = { ...A, ...C }
  wl['v,4,1'] = { mat: 'goldwood', kind: 'door' }; wl['v,4,2'] = { mat: 'goldwood', kind: 'door' }
  const w: W = { walls: wl, paid: paidAll(wl), foundCells: { ...Object.fromEntries(findRooms(A as Walls)[0].cells.map(([i, j]) => [`${i},${j}`, 1.2])), ...Object.fromEntries(findRooms(C as Walls)[0].cells.map(([i, j]) => [`${i},${j}`, 0.6])) } }
  ok(floorAt(w, 0, 1.5, 1.5) === 1.2 && floorAt(w, 0, 5.5, 1.5) === 0.6, 'joined rooms keep the heights they were given')
  const inner = doorSteps(w, 0).filter(b => b.z0 >= 1 && b.z1 <= 3 && b.x0 > 3 && b.x1 < 6)
  ok(inner.length === 2 && inner.every(b => b.x0 >= 4 && b.y1 > 0.6 && b.y1 < 1.2), `the door between them gets a step on the LOW room's side (${inner.length} boxes, tops ${inner.map(b => b.y1.toFixed(2)).join('/')})`)
  // a door between two rooms of the SAME height has none
  const same: W = { ...w, foundCells: Object.fromEntries(Object.keys(w.foundCells!).map(k => [k, 0.6])) }
  ok(doorSteps(same, 0).filter(b => b.x0 > 3 && b.x1 < 6 && b.z1 <= 3).length === 0, 'a door between two level rooms has no step')
  // a new room planned onto a house inherits its height (and pays its plinth at that height)
  const D = box(0, -4, 4, 0), plan: W = { ...setHouseFound(base, hA, 1.2), walls: { ...walls, ...Object.fromEntries(Object.entries(D).filter(([k]) => !walls[k]).map(([k, v]) => [k, { ...v, draft: true as const }])) } }
  ok(liftOf(plan).cell(1, -2) === 1.2, 'a room planned onto house A inherits its High foundation')
  const bill = billOfAll(plan, newInv(0)), brick = bill.lines.find(l => l.id === 'stone_brick')?.n ?? 0
  ok(brick >= 16 * plinthPerM2(1.2), `and its plinth is on the list at that height (${brick} stone brick, plinth ${16 * plinthPerM2(1.2)} of it)`)
}
// ── patios ──
{
  const deckA: Decks = Object.fromEntries([[1, 5], [2, 5], [1, 6], [2, 6]].map(([i, j]) => [`${i},${j}`, { pat: 'planks' as const, col: '#d2a157' }]))   // touches A's south wall
  const deckFar: Decks = { '6,8': { pat: 'planks', col: '#d2a157' } }
  const w: W = { ...two, decks: { ...deckA, ...deckFar } }, L = liftOf(w)
  // deckA's cells are 1 m south of A's wall line (row 4 is outside the room) -> not touching; move it to row 4
  const deckT: Decks = Object.fromEntries([[1, 4], [2, 4], [1, 5], [2, 5]].map(([i, j]) => [`${i},${j}`, { pat: 'planks' as const, col: '#d2a157' }]))
  const wt: W = { ...two, decks: { ...deckT, ...deckFar } }, LT = liftOf(wt)
  ok(L.floor(1, 5) === 0, 'a patio a metre off the house does not ride it')
  ok(LT.floor(1, 4) === 0.6 && LT.floor(2, 5) === 0.6, 'a patio touching house A rides its Low foundation (the whole patio)')
  ok(LT.floor(6, 8) === 0, 'a patio touching no house stays on the ground')
  const db = deckBoxes(wt.decks, 0, true, LT.floor)
  ok(db.filter(b => b.x0 <= 2 && b.z0 >= 4 && b.z0 <= 5).every(b => b.y1 === 0.6 && b.y0 < 0) && db.find(b => b.x0 === 6)!.y1 === DECK_T, 'the riding patio is solid flush with the floor; the far one a DECK_T step')
  ok(floorAt(wt, 0, 1.5, 4.5) === 0.6, 'furniture on the riding patio stands on it')
  void L
}
ok(Object.keys(adoptFoundCells({ '1,2': 0.6, '3,4': 0.7, 'x': 1.2, '5,6': 1.2 })).join() === '1,2,5,6', 'adoptFoundCells keeps known heights on cell keys')

console.log(`plot-found-houses: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
