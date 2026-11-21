// plot-stairs-turn.test (BETA M56 leftover, 11-21): a stair that turns a quarter at a landing half way up.
// npx tsx src/app/shimmer/open/ather/plot-stairs-turn.test.ts
import { STEPS, FLIGHT, RISE, WIDTH, LANDING_COST, landingRails, stairCells, stairBoxes, toggleStair, adoptStairs, stairCellSet, stairNeeds, holeRails, arrivalDir, treads, type Stairs, type Dir, type Turn } from './plot-stairs'
import { STOREY, withLevel, upperBoxes, floating, stairRails, type Stacked } from './plot-floors'
import { findRooms, type Walls } from './plot-walls'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const F: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] }

// footprint + treads, every direction, both turns
for (const d of [0, 1, 2, 3] as Dir[]) for (const t of ['l', 'r'] as Turn[]) {
  const s = { mat: 'goldwood' as const, dir: d, turn: t }, cells = stairCells(5, 5, d, t), bx = stairBoxes('5,5', s, 2)
  const want = FLIGHT / 2 * WIDTH + WIDTH * WIDTH + FLIGHT / 2 * WIDTH   // first flight 3 m x 2, landing 2 x 2, second flight 3 m x 2
  ok(cells.length === want && new Set(cells.map(c => c.join())).size === want, `dir ${d} ${t}: ${want} cells, each once (${cells.length})`)
  const cs = new Set(cells.map(c => c.join()))
  ok(bx.every(b => { for (let x = Math.floor(b.x0 + 1e-6); x < b.x1 - 1e-6; x++) for (let z = Math.floor(b.z0 + 1e-6); z < b.z1 - 1e-6; z++) if (!cs.has(`${x},${z}`)) return false; return true }), `dir ${d} ${t}: every tread on the stair's own cells`)
  ok(bx.length === STEPS + 1 && Math.abs(bx[bx.length - 1].y1 - (2 + STOREY)) < 1e-9, `dir ${d} ${t}: ${STEPS} steps + a landing, top at one storey`)
  ok(Math.abs(bx[FLIGHT].y1 - bx[FLIGHT - 1].y1) < 1e-9 && Math.abs(bx[FLIGHT].y1 - (2 + FLIGHT * RISE)) < 1e-9, `dir ${d} ${t}: the landing is flush with the first flight's top step (half a storey)`)
  ok(bx.every((b, n) => n === 0 || n === FLIGHT || b.y1 - bx[n - 1].y1 > 0 && b.y1 - bx[n - 1].y1 <= 0.5 + 1e-9), `dir ${d} ${t}: every other tread rises, each under the 0.5 m step rule`)
  // treads touch: each tread shares an edge with the next (no gap the walker falls into)
  ok(bx.every((b, n) => n === 0 || (Math.min(b.x1, bx[n - 1].x1) >= Math.max(b.x0, bx[n - 1].x0) - 1e-9 && Math.min(b.z1, bx[n - 1].z1) >= Math.max(b.z0, bx[n - 1].z0) - 1e-9)), `dir ${d} ${t}: each tread meets the one before`)
  const ad = arrivalDir(s), [ax, az] = F[ad], [fx, fz] = F[d]
  ok(ax * fx + az * fz === 0, `dir ${d} ${t}: it arrives at right angles to where it set off`)
  // right is +x when facing north: dir 0 r arrives east
  if (d === 0) ok(ad === (t === 'r' ? 1 : 3), `dir 0 ${t}: arrives ${t === 'r' ? 'east' : 'west'}`)
}
{ const tr = treads({}); ok(tr.length === STEPS && tr.every((t, n) => t.top === n + 1 && t.b0 === 0 && t.b1 === WIDTH), 'a straight stair is unchanged: 12 rising treads') }
for (const d of [0, 1, 2, 3] as Dir[]) for (const t of ['l', 'r'] as Turn[]) {
  const cs = new Set(stairCells(5, 5, d, t).map(c => c.join())), rb = landingRails('5,5', { mat: 'goldwood', dir: d, turn: t }, 2)
  ok(rb.length === FLIGHT + 2 && rb.every(b => { for (let x = Math.floor(b.x0 + 1e-6); x < b.x1 - 1e-6; x++) for (let z = Math.floor(b.z0 + 1e-6); z < b.z1 - 1e-6; z++) if (!cs.has(`${x},${z}`)) return false; return true }), `dir ${d} ${t}: the landing rails stand inside the stair's own cells (${rb.length})`)
}
ok(landingRails('5,5', { mat: 'goldwood', dir: 0 }, 2).length === 0, 'a straight stair has no landing rails')
ok(landingRails('5,5', { mat: 'goldwood', dir: 0, turn: 'r' }, 2).every(b => b.y1 <= 2 + STOREY + 1e-9), 'no landing rail pokes up through the floor above (the hole railing takes over there)')
ok(stairCells(5, 5, 0).length === 12 && stairCells(5, 5, 0, undefined).join() === stairCells(5, 5, 0).join(), 'no turn = the straight footprint')

// toggle + cost + adopt
{
  const any = () => true
  const a = toggleStair(undefined, {}, 0, 0, 0, 'goldwood', any, 'r')
  ok(a.ok && a.stairs['0,0']?.turn === 'r' && a.stairs['0,0'].draft === true, 'a tap with Turn right plans a turned stair')
  ok(a.ok && /right/.test(a.said), 'and says so')
  // a tap on the second flight takes it away
  const sec = stairCells(0, 0, 0, 'r').slice(-1)[0]
  ok(a.ok && toggleStair(a.stairs, {}, sec[0], sec[1], 0, 'goldwood', any).ok && !(toggleStair(a.stairs, {}, sec[0], sec[1], 0, 'goldwood', any) as { stairs: Stairs }).stairs['0,0'], 'a tap on the turned flight takes it away')
  ok(stairNeeds({ '0,0': { mat: 'goldwood', dir: 0, turn: 'l', draft: true } })[0]?.n === STEPS + LANDING_COST, `a turned stair costs ${STEPS} + ${LANDING_COST} for the landing`)
  const down = toggleStair({ '0,0': { mat: 'brick', dir: 0, turn: 'l' } }, {}, 0, -4, 0, 'goldwood', any)
  ok(down.ok && down.refund?.n === STEPS + LANDING_COST, 'and gives all of it back')
  // a wall across the turn (between the landing and the second flight) is refused
  const lc = stairCells(0, 0, 0, 'r')   // landing cells (0..1, -3..-4), second flight x 2..4
  void lc
  ok(!toggleStair(undefined, { 'v,2,-4': { mat: 'goldwood' } }, 0, 0, 0, 'goldwood', any, 'r').ok, 'a wall between the landing and the turned flight is refused')
  const ad = adoptStairs({ '1,2': { mat: 'brick', dir: 2, turn: 'l' }, '3,4': { mat: 'brick', dir: 1, turn: 'x' } })
  ok(ad['1,2']?.turn === 'l' && ad['3,4'] && !('turn' in ad['3,4']), 'adopt keeps l/r and drops a junk turn (straight)')
}

// a two-storey house: a 10 x 8 room, a stair climbing north that turns right onto the floor above
const box = (i0: number, j0: number, i1: number, j1: number): Walls => {
  const w: Record<string, { mat: 'goldwood' }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  return w
}
const room = box(0, 0, 10, 8)
const st: Stairs = { '1,7': { mat: 'goldwood', dir: 0, turn: 'r' } }   // flight 1: x 1..2, rows 7..5; landing rows 4..3; flight 2 east x 3..5
{
  const paidKey = findRooms(room)[0].key
  const house: Stacked = withLevel(withLevel({}, 0, { walls: room, paid: { [paidKey]: 80 }, stairs: st }), 1, { walls: room, paid: { [paidKey]: 80 } })
  const bx = upperBoxes(house, 0)
  const holes = stairCellSet(st), slabs = bx.filter(b => Math.abs(b.y1 - STOREY) < 1e-9 && b.x1 - b.x0 === 1 && b.z1 - b.z0 === 1)
  ok(holes.size === 19 && slabs.length === 80 - 19 && ['3,5', '4,5', '5,5'].every(c => holes.has(c)) && slabs.every(b => !holes.has(`${b.x0},${b.z0}`)), `the slab above is open over the whole L + a headroom row along the turned flight's near side (${slabs.length} slab cells, ${holes.size} open)`)
  ok(floating(house).length === 0, 'the house stands')
  // the railing round the hole leaves the arrival end open: the edges east of the top step (x 6, rows 3..4)
  const rails = holeRails(st, new Set(slabs.map(b => `${b.x0},${b.z0}`)), {}).map(r => r.key)
  ok(!rails.includes('v,6,3') && !rails.includes('v,6,4'), 'the hole railing is open where the turned flight arrives (east)')
  ok(rails.includes('h,1,7') === false && rails.includes('v,1,3') && rails.includes('h,3,3'), 'and closed along the landing and the turned flight')
  ok(stairRails(house, 1).length === rails.length, 'plot-floors draws the same railing')
  // the walker: from the foot, walk north to the landing, then east up the second flight
  const world = terrainWorld({ ground: () => 0, solids: () => bx, water: () => [] })
  const lc = createLoco(2, 0, 7.6)
  for (let t = 0; t < 60; t++) tickLocomotion(lc, input(), world)
  // hold forward PAST the landing: the keeper overshoots into the far rail (measured on prod 11-21: without the rail it stopped on the
  // lip and could not step up onto the turned flight), then turns
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1 }), world)
  ok(lc.pz > 3 + 0.25 + 0.25, `the far rail stops a keeper who overshoots the landing (z ${lc.pz.toFixed(2)}, the landing's far edge at 3)`)
  ok(Math.abs(lc.py - FLIGHT * RISE) < 0.3, `the keeper reaches the landing (feet ${lc.py.toFixed(2)}, landing ${(FLIGHT * RISE).toFixed(2)}) at z ${lc.pz.toFixed(2)}`)
  for (let t = 0; t < 60 * 6; t++) tickLocomotion(lc, input({ mvX: 1, mvZ: 0, fwdX: 1, fwdZ: 0, rightX: 0, rightZ: 1 }), world)
  ok(lc.py > STOREY - 0.3 && lc.px > 6, `turns and walks up to the floor above (feet ${lc.py.toFixed(2)}, storey ${STOREY}) at x ${lc.px.toFixed(2)}`)
  // anywhere across the landing (prod 11-21: a keeper just off the first flight's top, on the NEAR side, could not step up): set down
  // on it at each depth, turn right, climb
  const stuck: string[] = []
  for (let z = 3.55; z <= 4.96; z += 0.1) {
    const k = createLoco(2, FLIGHT * RISE, z)
    for (let t = 0; t < 30; t++) tickLocomotion(k, input(), world)
    for (let t = 0; t < 60 * 6; t++) tickLocomotion(k, input({ mvX: 1, mvZ: 0, fwdX: 1, fwdZ: 0, rightX: 0, rightZ: 1 }), world)
    if (!(k.py > STOREY - 0.3)) stuck.push(`z ${z.toFixed(2)}: feet ${k.py.toFixed(2)} x ${k.px.toFixed(2)}`)
  }
  ok(!stuck.length, `from anywhere across the landing a keeper turns right and climbs to the floor above${stuck.length ? ': stuck at ' + stuck.join('; ') : ''}`)
  // and back down: west to the landing, south to the ground
  for (let t = 0; t < 60 * 6 && lc.px > 2; t++) tickLocomotion(lc, input({ mvX: -1, mvZ: 0, fwdX: -1, fwdZ: 0, rightX: 0, rightZ: -1 }), world)
  for (let t = 0; t < 60 * 6; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: 1, fwdX: 0, fwdZ: 1, rightX: -1, rightZ: 0 }), world)
  ok(lc.py < 0.6, `and back down (feet ${lc.py.toFixed(2)})`)
}

console.log(`plot-stairs-turn: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
