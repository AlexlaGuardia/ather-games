// plot-found.test (BETA M55 slice 1): the house on a foundation. npx tsx src/app/shimmer/open/ather/plot-found.test.ts
import { FOUND_OPTS, adoptFound, plinthCells, floorAt, plinthBoxes, doorSteps, foundDelta, plinthPerM2 } from './plot-found'
import { findRooms, wallBoxes, type Walls } from './plot-walls'
import { plinthNeed, billOfAll, buildAll } from './plot-bom'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { newInv, give, countOf } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })

// a built 4 x 4 room, a door on its south wall (pieces h,1,4 and h,2,4)
const walls: Record<string, { mat: 'goldwood'; kind?: 'door' }> = {}
for (let i = 0; i < 4; i++) { walls[`h,${i},0`] = { mat: 'goldwood' }; walls[`h,${i},4`] = { mat: 'goldwood' } }
for (let j = 0; j < 4; j++) { walls[`v,0,${j}`] = { mat: 'goldwood' }; walls[`v,4,${j}`] = { mat: 'goldwood' } }
walls['h,1,4'] = { mat: 'goldwood', kind: 'door' }; walls['h,2,4'] = { mat: 'goldwood', kind: 'door' }
const W = walls as unknown as Walls, key = findRooms(W)[0].key

ok(adoptFound(0.6) === 0.6 && adoptFound(1.2) === 1.2 && adoptFound(0.9) === 0 && adoptFound('x') === 0, 'adoptFound keeps only the offered heights')
ok(FOUND_OPTS.every(h => plinthPerM2(h) === h / 0.6), 'a brick per m² per 0.6 m')

for (const h of [0.6, 1.2] as const) {
  const w = { walls: W, paid: { [key]: 16 }, found: h }
  ok(plinthCells(w).size === 16, `${h}: the plinth covers the room's 16 cells`)
  ok(floorAt(w, 2, 1.5, 1.5) === 2 + h && floorAt(w, 2, 6, 6) === 2, `${h}: the floor inside is raised, outside is the ground`)
  const pb = plinthBoxes(w, 2)
  ok(pb.length === 16 + Object.keys(W).length && pb.every(b => Math.abs(b.y1 - (2 + h)) < 1e-9), `${h}: a plinth block under every cell and every wall, its top at the floor`)
  const st = doorSteps(w, 2), n = Math.ceil(h / 0.45) - 1
  ok(st.length === 2 * n, `${h}: ${n} step(s) outside each of the door's two pieces (${st.length})`)
  ok(st.every(b => b.z0 >= 4), `${h}: the steps are OUTSIDE (south of the wall at z 4)`)
  const tops = [...new Set(st.map(b => +b.y1.toFixed(3)))].sort((a, b) => b - a), rises = [2 + h, ...tops, 2].map((y, k, a) => k ? a[k - 1] - y : 0).slice(1)
  ok(rises.every(r => r > 0 && r <= 0.5 + 1e-9), `${h}: every rise from the ground to the floor is under the 0.5 m step rule (${rises.map(r => r.toFixed(2))})`)
  // a keeper walks in from the south, up the steps, through the door, onto the raised floor
  const solids = [...pb, ...st, ...wallBoxes(W, 2 + h)]
  const world = terrainWorld({ ground: () => 2, solids: () => solids, water: () => [] })
  const lc = createLoco(2, 2, 6.5)
  for (let t = 0; t < 30; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 6; t++) tickLocomotion(lc, input({ mvZ: -1, fwdZ: -1 }), world)
  ok(lc.pz < 3.5 && Math.abs(lc.py - (2 + h)) < 0.1, `${h}: a keeper walks up the steps and in through the door (z ${lc.pz.toFixed(2)}, feet ${lc.py.toFixed(2)})`)
}
// nothing at 0, nothing for a draft room
ok(plinthBoxes({ walls: W, paid: { [key]: 16 }, found: 0 }, 2).length === 0 && doorSteps({ walls: W, paid: { [key]: 16 } }, 2).length === 0, 'no foundation, no plinth or steps')
ok(plinthCells({ walls: W, paid: {}, found: 0.6 }).size === 0, 'an unbuilt room has no plinth')
// cost
{
  const w = { walls: W, paid: { [key]: 16 }, found: 0 }
  ok(foundDelta(w, 0, 0.6) === 16 && foundDelta(w, 0, 1.2) === 32 && foundDelta(w, 1.2, 0.6) === -16, 'raising pays 16 bricks per 0.6 m for 16 m², lowering gives them back')
  const draft = { walls: Object.fromEntries(Object.entries(W).map(([k, x]) => [k, { ...x, draft: true as const }])) as Walls, paid: {}, found: 0.6 }
  ok(plinthNeed(draft) === 16, 'a new room on a raised house puts its plinth on the list')
  const inv = give(give(newInv(0), 'goldwood_plank', 200).inv, 'stone_brick', 100).inv
  const b = billOfAll(draft, inv), r = buildAll(draft, inv)
  const bricks = b.lines.find(l => l.id === 'stone_brick')?.n ?? 0
  ok(bricks === 16 + 16, `the bill: roof 16 + plinth 16 bricks (${bricks})`)
  ok(r.ok && countOf(r.inv, 'stone_brick') === 100 - 32, 'Build spends the plinth with the room')
}

console.log(`plot-found: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
