// plot-rail.test (BETA M56 (c)): the RAILING / half wall, and the railing round a stair hole. npx tsx src/app/shimmer/open/ather/plot-rail.test.ts
import { RAIL_H, RAIL_FRAC, WALL_H, planRun, raze, wallBoxes, findRooms, toggleDoor, toggleWindow, adoptWalls, runKeys, type Walls } from './plot-walls'
import { STOREY, withLevel, upperBoxes, stairRails, standsOn, topLevel, floating, type Stacked } from './plot-floors'
import { RUN, WIDTH, stairCellSet, type Stairs } from './plot-stairs'
import { planNeeds, billOfAll, buildAll, AMOUNTS } from './plot-bom'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, eyeY, type LocoInput } from '../shared/locomotion'
import { newInv, give, countOf } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const box = (i0: number, j0: number, i1: number, j1: number, kind?: 'rail'): Walls => {
  const w: Record<string, { mat: 'goldwood'; kind?: 'rail' }> = {}, p = { mat: 'goldwood' as const, ...(kind ? { kind } : {}) }
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = p; w[`h,${i},${j1}`] = p }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = p; w[`v,${i1},${j}`] = p }
  return w
}

// ── the piece ──
ok(RAIL_H > 0.5 && RAIL_H < WALL_H, `a railing (${RAIL_H} m) is over the 0.5 m step and under a wall`)
{
  const keys = runKeys({ i: 0, j: 0 }, { i: 6, j: 0 }), w = planRun({}, keys, 'brick', 'rail')
  ok(keys.length === 6 && keys.every(k => w[k].kind === 'rail' && w[k].draft === true && w[k].mat === 'brick'), 'the Walls tool plans a run of railing in any wall material')
  const bx = wallBoxes(Object.fromEntries(Object.entries(w).map(([k, x]) => [k, { ...x, draft: undefined }])) as Walls, 2)
  ok(bx.length === 6 && bx.every(b => Math.abs(b.y1 - (2 + RAIL_H)) < 1e-9), 'a built railing is solid to RAIL_H, not wall height')
  ok(wallBoxes(w, 2).length === 0, 'a planned railing is not solid')
}
// BOM: a third of a wall
{
  const wallN = planNeeds(planRun({}, runKeys({ i: 0, j: 0 }, { i: 6, j: 0 }), 'goldwood'), {}).needs[0].n
  const railN = planNeeds(planRun({}, runKeys({ i: 0, j: 0 }, { i: 6, j: 0 }), 'goldwood', 'rail'), {}).needs[0].n
  ok(Math.abs(RAIL_FRAC - 1 / 3) < 1e-9 && railN === Math.ceil(6 * AMOUNTS.wallPerM * RAIL_FRAC), `6 m of railing lists ${railN} planks (a wall's ${wallN})`)
  ok(railN * 3 === wallN, 'exactly a third of the same run of wall')
  const one = planNeeds(planRun({}, ['h,0,0'], 'goldwood', 'rail'), {}).needs[0].n
  ok(one === 1, 'one metre of railing rounds up to a whole plank')
  // Build stands it and spends exactly the list
  const inv = give(newInv(0), 'goldwood_plank', 10).inv
  const r = buildAll({ walls: planRun({}, runKeys({ i: 0, j: 0 }, { i: 6, j: 0 }), 'goldwood', 'rail') }, inv)
  ok(r.ok && countOf(r.inv, 'goldwood_plank') === 10 - railN && Object.values(r.works.walls ?? {}).every(x => x.kind === 'rail' && !x.draft), 'Build stands the railing and spends its list')
  // raze gives back EXACTLY what it cost (11-22: it gave a third of a FLAT plank a metre while M50 charged a third of 1.5)
  if (r.ok) { const d = raze(r.works.walls ?? {}, r.inv, Object.keys(r.works.walls ?? {})), back = countOf(d.inv, 'goldwood_plank') - countOf(r.inv, 'goldwood_plank'); ok(d.down === 6 && back === railN && !Object.keys(d.carry).length, `railing round trip: 6 m down gives back the ${railN} planks it cost (${back})`) }
  // a railing built before the fix (no paid): the rate, half a plank, carried rather than lost or minted
  const d1 = raze({ 'h,0,0': { mat: 'goldwood', kind: 'rail' } }, newInv(0), ['h,0,0'])
  ok(d1.down === 1 && countOf(d1.inv, 'goldwood_plank') === 0 && Math.abs((d1.carry.goldwood_plank ?? 0) - AMOUNTS.wallPerM * RAIL_FRAC) < 1e-9, 'one pre-fix metre down: no whole plank yet, its half carried (no minting, no loss)')
  const d2 = raze({ 'h,1,0': { mat: 'goldwood', kind: 'rail' } }, d1.inv, ['h,1,0'], d1.carry)
  ok(countOf(d2.inv, 'goldwood_plank') === 1 && !d2.carry.goldwood_plank, 'the second metre completes the plank')
}
// a railing closes no room, carries nothing, has no door or window
{
  ok(findRooms(box(0, 0, 4, 4, 'rail')).length === 0, 'a ring of railing is not a room (no roof, no floor bill)')
  ok(planNeeds(planRun({}, Object.keys(box(0, 0, 4, 4)), 'goldwood', 'rail'), {}).rooms === 0, 'and the bill prices no room for it')
  const mixed: Walls = { ...box(0, 0, 4, 4), 'v,2,0': { mat: 'goldwood', kind: 'rail' }, 'v,2,1': { mat: 'goldwood', kind: 'rail' }, 'v,2,2': { mat: 'goldwood', kind: 'rail' }, 'v,2,3': { mat: 'goldwood', kind: 'rail' } }
  ok(findRooms(mixed).length === 1 && findRooms(mixed)[0].cells.length === 16, 'a railing across a room does not split it')
  ok(!standsOn({ 'h,9,9': { mat: 'goldwood', kind: 'rail' } }, 'h,9,9'), 'a wall above cannot stand on a railing')
  const h: Stacked = withLevel(withLevel({}, 0, { walls: box(0, 0, 4, 4), paid: { [findRooms(box(0, 0, 4, 4))[0].key]: 16 } }), 1, { walls: { 'h,1,2': { mat: 'goldwood', kind: 'rail' } } })
  ok(topLevel(h) === 0, 'a railing alone upstairs does not move the roof up')
  ok(floating(h).length === 0, 'a railing on an upper floor stands on the room below')
  const w = { ...box(0, 0, 4, 4), 'h,1,0': { mat: 'goldwood' as const, kind: 'rail' as const }, 'h,2,0': { mat: 'goldwood' as const, kind: 'rail' as const } }
  ok(!toggleDoor(w, 'h,1,0').ok && !toggleWindow(w, 'h,1,0').ok, 'no door or window in a railing')
  ok(!toggleDoor({ 'h,0,0': { mat: 'goldwood' }, 'h,1,0': { mat: 'goldwood', kind: 'rail' } }, 'h,0,0').ok, 'a door will not take a railing as its second metre')
  const a = adoptWalls(JSON.parse(JSON.stringify({ 'h,0,0': { mat: 'stucco', kind: 'rail', tint: '#112233' }, 'h,1,0': { mat: 'brick', kind: 'gate' } })))
  ok(a['h,0,0']?.kind === 'rail' && a['h,0,0'].tint === '#112233' && !a['h,1,0'].kind, 'a railing survives save + load (unknown kinds drop to plain)')
}

// ── the walker: cannot walk through it, sees over it ──
{
  const rail: Record<string, Walls[string]> = {}; for (let i = -6; i < 6; i++) rail[`h,${i},0`] = { mat: 'goldwood', kind: 'rail' }
  const world = terrainWorld({ ground: () => 0, solids: () => wallBoxes(rail, 0), water: () => [] })
  const lc = createLoco(0, 0, 3)
  for (let t = 0; t < 30; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(lc, input({ mvZ: -1 }), world)
  ok(lc.pz > 0 && lc.py < 0.2, `walking into a railing for 4 s stops at it (z ${lc.pz.toFixed(2)}, feet ${lc.py.toFixed(2)})`)
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(lc, input({ mvZ: -1, crouchKey: t % 30 < 15 }), world)
  ok(lc.pz > 0, `crouch-walking into it does not slip under or over (z ${lc.pz.toFixed(2)})`)
  ok(eyeY(lc) > RAIL_H + 0.3, `the keeper's eye (${eyeY(lc).toFixed(2)} m) is well over the railing (${RAIL_H} m)`)
  // the same run as a full wall reaches over the eye: the railing is the thing you see over
  ok(wallBoxes({ 'h,0,0': { mat: 'goldwood' } }, 0)[0].y1 > eyeY(lc), 'a full wall would hide the view')
}

// ── a two-storey house with stairs: the railing round the hole upstairs ──
const room = box(0, 0, 6, 8)
const st: Stairs = { '1,7': { mat: 'brick', dir: 0 } }   // climbs north from row 7 to row 2, cells x 1..2; arrives onto row 1
{
  const key = findRooms(room)[0].key
  const house: Stacked = withLevel(withLevel({}, 0, { walls: room, paid: { [key]: 48 }, stairs: st }), 1, { walls: room, paid: { [key]: 48 } })
  const rails = stairRails(house, 1), keys = new Set(rails.map(r => r.key)), hole = stairCellSet(st)
  ok(hole.size === RUN * WIDTH, 'the hole is the stair footprint')
  // long sides: x = 1 (between cells 0 and 1) and x = 3 (between 2 and 3), rows 2..7; low end: z = 8 is the house's own wall
  const sideW = [2, 3, 4, 5, 6, 7].every(j => keys.has(`v,1,${j}`)), sideE = [2, 3, 4, 5, 6, 7].every(j => keys.has(`v,3,${j}`))
  ok(sideW && sideE, 'both long sides of the hole are railed')
  ok(!keys.has('h,1,2') && !keys.has('h,2,2'), 'the arrival end (where the top step leads out) is left open')
  ok(!keys.has('h,1,8') && !keys.has('h,2,8'), 'no railing where the house wall already stands')
  ok(rails.length === 12 && rails.every(r => r.mat === 'brick'), `${rails.length} m of railing, in the stairs' material`)
  ok(stairRails(house, 0).length === 0, 'the ground floor has no hole to rail')
  const draftHouse = withLevel(house, 0, { walls: room, paid: { [key]: 48 }, stairs: { '1,7': { mat: 'brick', dir: 0, draft: true } } })
  ok(stairRails(draftHouse, 1).length === 0, 'planned stairs cut no hole yet, so no railing')
  // it is solid upstairs at railing height and the stairs still work: walk up and step off the top
  const bx = upperBoxes(house, 0), railBoxes = bx.filter(b => Math.abs(b.y1 - (STOREY + RAIL_H)) < 1e-9)
  ok(railBoxes.length === 12, `the walker meets ${railBoxes.length} railing pieces upstairs`)
  ok(billOfAll(house, newInv(0)).empty, 'the stair railing costs nothing extra (it is part of the stairs)')
  const world = terrainWorld({ ground: () => 0, solids: () => bx, water: () => [] })
  const lc = createLoco(2, 0, 7.6)
  for (let t = 0; t < 60; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 10; t++) tickLocomotion(lc, input({ mvZ: -1 }), world)
  ok(lc.py > STOREY - 0.3 && lc.pz < 2, `the keeper still climbs out the open end onto the floor above (feet ${lc.py.toFixed(2)}, z ${lc.pz.toFixed(2)})`)
  // upstairs, walking sideways into the hole from the west is stopped by the railing
  const up = createLoco(0.5, STOREY, 5)
  for (let t = 0; t < 60; t++) tickLocomotion(up, input(), world)
  for (let t = 0; t < 60 * 3; t++) tickLocomotion(up, input({ mvX: 1, fwdX: 1, fwdZ: 0 }), world)
  ok(up.py > STOREY - 0.1 && up.px < 1, `upstairs, walking at the hole from the side: the railing holds (x ${up.px.toFixed(2)}, feet ${up.py.toFixed(2)})`)
  // without the railing the same walk falls in (proves the railing, not something else, holds)
  const bare = bx.filter(b => !railBoxes.includes(b)), w2 = terrainWorld({ ground: () => 0, solids: () => bare, water: () => [] })
  const fall = createLoco(0.5, STOREY, 5)
  for (let t = 0; t < 60; t++) tickLocomotion(fall, input(), w2)
  for (let t = 0; t < 60 * 3; t++) tickLocomotion(fall, input({ mvX: 1, fwdX: 1, fwdZ: 0 }), w2)
  ok(fall.py < STOREY - 0.3, `(control: with no railing the keeper drops into the hole, feet ${fall.py.toFixed(2)})`)
}

console.log(`plot-rail: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
