// Run: npx tsx src/app/shimmer/open/ather/plot-walls.test.ts
// Plot walls (ather/plot-walls.ts, BETA M37 slice 1). The pins: a drag is a straight run of 1 m pieces; an L closes with
// no gap (the overrun); a wall is as thick and tall as a room's; laying costs a plank a metre and erasing gives every one
// back; standing pieces are free to re-draw; ground you do not hold, the keep-clear rings and a room refuse; a saved plot
// round-trips; the walker cannot cross a drawn wall.
import {
  snapCorner, straighten, runKeys, edgeRect, edgeEnds, wallBoxes, canLay, lay, raze, adoptWalls, WALL_T, WALL_H, MAX_RUN, WALL_MATS, type Walls,
} from './plot-walls'
import { WALL_T as ROOM_T, WALL_H as ROOM_H } from './rooms'
import { newInv, give, countOf } from '../shared/inventory'
import { terrainWorld, type Shape } from '../terrain-world'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(WALL_T === ROOM_T && WALL_H === ROOM_H, `a drawn wall is a room's wall: ${WALL_T}x${WALL_H} vs ${ROOM_T}x${ROOM_H}`)
ok(snapCorner(3.4, -2.6).i === 3 && snapCorner(3.4, -2.6).j === -3, 'a point snaps to the nearest corner')
{ const s = straighten({ i: 0, j: 0 }, { i: 5, j: 2 }); ok(s.i === 5 && s.j === 0, 'a mostly-x drag runs along x') }
{ const s = straighten({ i: 0, j: 0 }, { i: 1, j: -4 }); ok(s.i === 0 && s.j === -4, 'a mostly-z drag runs along z') }
ok(runKeys({ i: 0, j: 0 }, { i: 99, j: 0 }).length === MAX_RUN, `a run caps at ${MAX_RUN} m`)
{ const k = runKeys({ i: 4, j: 2 }, { i: 1, j: 2 }); ok(k.join(' ') === 'h,1,2 h,2,2 h,3,2', `a backwards drag lays the same pieces (${k})`) }
ok(runKeys({ i: 3, j: 3 }, { i: 3, j: 3 }).length === 0, 'a tap lays nothing')
{ // an L at (0,0): the x run and the z run overlap at the corner square, so no gap
  const a = edgeRect('h,0,0'), b = edgeRect('v,0,0')
  ok(a.x0 <= b.x0 && a.z1 >= b.z0 && b.z0 <= a.z0, 'an L closes: both pieces cover the corner square')
  ok(Math.abs((a.z1 - a.z0) - WALL_T) < 1e-9 && Math.abs((a.x1 - a.x0) - (1 + WALL_T)) < 1e-9, 'a piece is 1 m + one thickness long, one thickness deep')
  ok(JSON.stringify(edgeEnds('v,2,5')) === '[[2,5],[2,6]]', 'a piece knows its two corners')
}

const held = (x: number, z: number) => Math.abs(x) <= 20 && Math.abs(z) <= 20
const none = { rects: [], circles: [] }
let inv = give(newInv(0), 'goldwood_plank', 10).inv
let walls: Walls = {}
{ const v = canLay(walls, runKeys({ i: 0, j: 0 }, { i: 4, j: 0 }), 'goldwood', held, none, inv)
  ok(v.ok && v.add.length === 4 && v.cost === 4, 'a 4 m run asks 4 planks')
  if (v.ok) { const r = lay(walls, inv, v.add, 'goldwood')!; walls = r.walls; inv = r.inv }
  ok(Object.keys(walls).length === 4 && countOf(inv, 'goldwood_plank') === 6, `laid: 4 pieces, 6 planks left (${countOf(inv, 'goldwood_plank')})`) }
{ const v = canLay(walls, runKeys({ i: 2, j: 0 }, { i: 6, j: 0 }), 'goldwood', held, none, inv)
  ok(v.ok && v.add.length === 2, 'drawing over standing pieces only pays for the new ones') }
{ const v = canLay(walls, runKeys({ i: 0, j: 0 }, { i: 4, j: 0 }), 'goldwood', held, none, inv)
  ok(!v.ok, 'a run that is already up says so') }
{ const v = canLay(walls, runKeys({ i: 0, j: 1 }, { i: 0, j: 8 }), 'goldwood', held, none, inv)
  ok(!v.ok && /Planks needed/.test(v.why), 'short of planks, it says how many') }
{ const v = canLay(walls, runKeys({ i: 0, j: 1 }, { i: 0, j: 3 }), 'dawnwood', held, none, inv)
  ok(!v.ok && /Dawnwood/.test(v.why), 'each wood pays in its own planks') }
{ const v = canLay(walls, runKeys({ i: 19, j: 0 }, { i: 23, j: 0 }), 'goldwood', held, none, inv)
  ok(!v.ok && /ground you hold/.test(v.why), 'off your ground refuses') }
{ const v = canLay(walls, runKeys({ i: 0, j: 5 }, { i: 3, j: 5 }), 'goldwood', held, { rects: [], circles: [{ x: 1, z: 6, r: 2 }] }, inv)
  ok(!v.ok && /Leave room/.test(v.why), 'the keep-clear rings refuse') }
{ const v = canLay(walls, runKeys({ i: 0, j: 5 }, { i: 3, j: 5 }), 'goldwood', held, { rects: [{ r: { x0: 1, x1: 2, z0: 4, z1: 6 }, why: 'In your Kitchen.' }], circles: [] }, inv)
  ok(!v.ok && v.why === 'In your Kitchen.', 'a room / chest / piece in the way refuses with its own line') }
{ const r = raze(walls, inv, runKeys({ i: 1, j: 0 }, { i: 3, j: 0 }))
  ok(r.down === 2 && Object.keys(r.walls).length === 2 && countOf(r.inv, 'goldwood_plank') === 8, 'erasing 2 m gives 2 planks back')
  const all = raze(r.walls, r.inv, runKeys({ i: 0, j: 0 }, { i: 10, j: 0 }))
  ok(all.down === 2 && Object.keys(all.walls).length === 0 && countOf(all.inv, 'goldwood_plank') === 10, 'every plank comes back: none lost to a lay + raze') }
{ const saved = JSON.parse(JSON.stringify({ ...walls, 'x,1,1': { mat: 'goldwood' }, 'h,9,9': { mat: 'iron' } }))
  const back = adoptWalls(saved)
  ok(Object.keys(back).length === 4 && !back['x,1,1'] && !back['h,9,9'], 'a saved plot round-trips; junk keys and unknown woods are dropped')
  ok(adoptWalls(undefined) && Object.keys(adoptWalls(null)).length === 0, 'an older save (no walls) loads as none') }
ok(Object.values(WALL_MATS).every(m => /_plank$/.test(m.item)), 'every wall wood pays in planks (Co. iron is trim, never a wall: canon e0ecc99)')

{ // the walker: flat ground, a wall along x at z=0 from x=-3..3; walking +z from z=-2 stops short of it
  const W: Walls = Object.fromEntries(runKeys({ i: -3, j: 0 }, { i: 3, j: 0 }).map(k => [k, { mat: 'goldwood' as const }]))
  const boxes = wallBoxes(W, 0)
  const flat: Shape = { ground: () => 0, water: () => [], solids: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boxes.filter(b => b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0 && b.z0 < z1 && b.z1 > z0) }
  const tw = terrainWorld(flat)
  ok(!tw.bodyFree(0.5, 0, 0), 'the walker cannot stand inside a drawn wall')
  ok(tw.bodyFree(0.5, -1.2, 0) && tw.bodyFree(4.2, 0, 0), 'it can stand beside it and past its end')
}

console.log(`plot-walls: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
