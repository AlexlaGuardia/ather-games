// plot-stairs.test (BETA M56 slice 1): straight stairs up one storey. npx tsx src/app/shimmer/open/ather/plot-stairs.test.ts
import { STEPS, RISE, RUN, WIDTH, STAIR_STOREY, stairCells, stairBoxes, toggleStair, adoptStairs, stairCellSet, stairNeeds, standStairs, stairStandsOn, dirOfYaw, type Stairs, type Dir } from './plot-stairs'
import { STOREY, withLevel, upperBoxes, floating, adoptUpper, type Stacked } from './plot-floors'
import { billOfAll, buildAll } from './plot-bom'
import { findRooms, type Walls } from './plot-walls'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { newInv, give, countOf } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })

ok(Math.abs(STAIR_STOREY - STOREY) < 1e-9, `the stairs' storey mirror agrees with plot-floors (${STAIR_STOREY} vs ${STOREY})`)
ok(RISE <= 0.5 && Math.abs(RISE * STEPS - STOREY) < 1e-9, `${STEPS} steps of ${RISE.toFixed(3)} m climb exactly one storey, each under the 0.5 m step rule`)
ok(dirOfYaw(0) === 0 && dirOfYaw(-Math.PI / 2) === 1 && dirOfYaw(Math.PI) === 2 && dirOfYaw(Math.PI / 2) === 3, 'the view yaw picks the way the stairs climb')

// footprint + steps, every direction
for (const d of [0, 1, 2, 3] as Dir[]) {
  const cells = stairCells(5, 5, d), bx = stairBoxes('5,5', { mat: 'goldwood', dir: d }, 2)
  ok(cells.length === RUN * WIDTH && new Set(cells.map(c => c.join())).size === cells.length, `dir ${d}: ${RUN} x ${WIDTH} cells`)
  const cs = new Set(cells.map(c => c.join()))
  ok(bx.every(b => { for (let x = Math.floor(b.x0 + 1e-6); x < b.x1 - 1e-6; x++) for (let z = Math.floor(b.z0 + 1e-6); z < b.z1 - 1e-6; z++) if (!cs.has(`${x},${z}`)) return false; return true }), `dir ${d}: every step sits on the stair's own cells`)
  ok(Math.abs(bx[STEPS - 1].y1 - (2 + STOREY)) < 1e-9 && bx.every((b, n) => n === 0 || b.y1 > bx[n - 1].y1), `dir ${d}: the steps rise to one storey up`)
}

// toggle rules
{
  const any = () => true
  const a = toggleStair(undefined, {}, 0, 0, 0, 'goldwood', any)
  ok(a.ok && a.stairs['0,0']?.draft === true, 'a tap plans stairs')
  ok(a.ok && toggleStair(a.stairs, {}, 0, -3, 0, 'goldwood', any).ok && !(toggleStair(a.stairs, {}, 0, -3, 0, 'goldwood', any) as { stairs: Stairs }).stairs['0,0'], 'a tap on any of its cells takes it away')
  const over = a.ok ? toggleStair(a.stairs, {}, -1, -5, 1, 'goldwood', any) : null
  ok(!!over && !over.ok, 'another stair in the way is refused')
  const wall: Walls = { 'h,0,-2': { mat: 'goldwood' } }   // a wall between cells (0,-3) and (0,-2): inside the run
  ok(!toggleStair(undefined, wall, 0, 0, 0, 'goldwood', any).ok, 'a wall across the run is refused')
  ok(!toggleStair(undefined, {}, 0, 0, 0, 'goldwood', (i, j) => j > -3).ok, 'a cell off held ground is refused')
  const built: Stairs = { '0,0': { mat: 'brick', dir: 0 } }
  const down = toggleStair(built, {}, 1, -1, 0, 'goldwood', any)
  ok(down.ok && down.refund?.id === 'stone_brick' && down.refund.n === STEPS, 'built stairs come down with their cost back')
}

// a two-storey house: a 6 x 8 room on the ground with stairs inside, the same room above
const box = (i0: number, j0: number, i1: number, j1: number): Walls => {
  const w: Record<string, { mat: 'goldwood' }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  return w
}
const room = box(0, 0, 6, 8)
const st: Stairs = { '1,7': { mat: 'goldwood', dir: 0 } }   // climbs north from row 7 to row 2, cells x 1..2
{
  const paidKey = findRooms(room)[0].key
  const house: Stacked = withLevel(withLevel({}, 0, { walls: room, paid: { [paidKey]: 48 }, stairs: st }), 1, { walls: room, paid: { [paidKey]: 48 } })
  const bx = upperBoxes(house, 0)
  const holes = stairCellSet(st), slabs = bx.filter(b => Math.abs(b.y1 - STOREY) < 1e-9 && b.x1 - b.x0 === 1 && b.z1 - b.z0 === 1)
  ok(slabs.length === 48 - holes.size && slabs.every(b => !holes.has(`${b.x0},${b.z0}`)), `the slab above is open over the stairs (${slabs.length} slab cells, ${holes.size} open)`)
  ok(floating(house).length === 0, 'the house stands (nothing floats)')
  ok(stairStandsOn(room, '1,7', st['1,7']) && !stairStandsOn(room, '1,9', { mat: 'goldwood', dir: 0 }), 'an upper stair must stand on its floor\'s rooms')
  // the walker climbs it: from the foot of the stairs, walk north for 10 s; it ends up a storey up
  const world = terrainWorld({ ground: () => 0, solids: () => bx, water: () => [] })
  const lc = createLoco(2, 0, 7.6)
  for (let t = 0; t < 60; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 10; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1 }), world)
  ok(lc.py > STOREY - 0.3, `a keeper walks up the stairs to the floor above (feet ${lc.py.toFixed(2)}, storey ${STOREY}) at z ${lc.pz.toFixed(2)}`)
  // and back down
  for (let t = 0; t < 60 * 10; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: 1, fwdX: 0, fwdZ: 1 }), world)
  ok(lc.py < 0.6, `and back down (feet ${lc.py.toFixed(2)})`)
}

// adopt + save round-trip of an upper stair
{
  const a = adoptStairs({ '1,2': { mat: 'brick', dir: 2 }, '3,4': { mat: 'brick', dir: 7 }, 'x': { mat: 'brick', dir: 0 }, '5,6': { mat: 'goldwood', dir: 1, draft: true } })
  ok(Object.keys(a).sort().join() === '1,2,5,6' && a['5,6'].draft === true, 'adoptStairs keeps the well-formed')
  const rt = adoptUpper(JSON.parse(JSON.stringify([{ walls: {}, stairs: { '1,2': { mat: 'brick', dir: 2 } } }])))
  ok(rt.length === 1 && rt[0].stairs?.['1,2']?.dir === 2, 'an upper level with stairs is kept on load')
}

// the bill and Build
{
  const w: Stacked = { walls: {}, stairs: { '0,0': { mat: 'goldwood', dir: 0, draft: true } } }
  ok(stairNeeds(w.stairs)[0]?.n === STEPS, 'stairs cost a step of their material each')
  const inv = give(newInv(0), 'goldwood_plank', 30).inv, b = billOfAll(w, inv)
  ok(b.ok && b.lines.find(l => l.id === 'goldwood_plank')?.n === STEPS, `the bill lists ${STEPS} planks`)
  const r = buildAll(w, inv)
  ok(r.ok && !Object.values((r.works as Stacked).stairs ?? {})[0]?.draft && countOf(r.inv, 'goldwood_plank') === 30 - STEPS, 'Build stands them and spends exactly that')
  ok(Object.keys(standStairs(w.stairs)).length === 1, 'standStairs keeps them')
}

console.log(`plot-stairs: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
