// Run: npx tsx src/app/shimmer/open/ather/plot-walls.test.ts
// Plot walls (ather/plot-walls.ts, BETA M37 slice 1). The pins: a drag is a straight run of 1 m pieces; an L closes with
// no gap (the overrun); a wall is as thick and tall as a room's; laying costs a plank a metre and erasing gives every one
// back; standing pieces are free to re-draw; ground you do not hold, the keep-clear rings and a room refuse; a saved plot
// round-trips; the walker cannot cross a drawn wall.
import {
  snapCorner, straighten, runKeys, edgeRect, edgeEnds, wallBoxes, canLay, lay, raze, adoptWalls, WALL_T, WALL_H, MAX_RUN, WALL_MATS, type Walls,
  findRooms, roofMesh, adoptRoof, ROOF_PITCH,
  pieceAt, toggleDoor, toggleWindow, paintWall, paintFloor, floorOf, adoptFloors, roomAt, DOOR_H,
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

// ── slice 2: rooms + roofs
const box = (x0: number, z0: number, x1: number, z1: number): Record<string, { mat: 'goldwood' }> => Object.fromEntries([
  ...runKeys({ i: x0, j: z0 }, { i: x1, j: z0 }), ...runKeys({ i: x0, j: z1 }, { i: x1, j: z1 }),
  ...runKeys({ i: x0, j: z0 }, { i: x0, j: z1 }), ...runKeys({ i: x1, j: z0 }, { i: x1, j: z1 }),
].map(k => [k, { mat: 'goldwood' as const }]))
{ const r = findRooms(box(0, 0, 4, 3))
  ok(r.length === 1 && r[0].cells.length === 12 && !!r[0].rect && r[0].rect.x1 - r[0].rect.x0 === 4, `a closed 4x3 loop is one room of 12 m² (${r.length}, ${r[0]?.cells.length})`) }
{ const w = box(0, 0, 4, 3); delete w['h,1,0']
  ok(findRooms(w).length === 0, 'a loop with a gap is no room (the outside gets in)') }
{ const w = { ...box(0, 0, 4, 3), ...box(4, 0, 7, 3) }
  const r = findRooms(w); ok(r.length === 2 && r.map(x => x.cells.length).sort().join() === '12,9', `two rooms sharing a wall are two rooms (${r.map(x => x.cells.length)})`) }
{ // an L: 4x4 with the corner 2x2 walled off outside
  const w: Record<string, { mat: 'goldwood' }> = {}
  for (const k of [...runKeys({ i: 0, j: 0 }, { i: 4, j: 0 }), ...runKeys({ i: 4, j: 0 }, { i: 4, j: 2 }), ...runKeys({ i: 2, j: 2 }, { i: 4, j: 2 }), ...runKeys({ i: 2, j: 2 }, { i: 2, j: 4 }), ...runKeys({ i: 0, j: 4 }, { i: 2, j: 4 }), ...runKeys({ i: 0, j: 0 }, { i: 0, j: 4 })]) w[k] = { mat: 'goldwood' }
  const r = findRooms(w); ok(r.length === 1 && r[0].cells.length === 12 && r[0].rect === null, `an L room is found, and is not a rectangle (${r[0]?.cells.length})`)
  const m = roofMesh(r[0], 'gable', 3.2); ok(m.roof.length === 0 && m.slabs.length === 12, 'a non-rectangle gets a flat roof over its cells') }
{ const room = findRooms(box(0, 0, 6, 4))[0]
  const g = roofMesh(room, 'gable', 3.2), h = roofMesh(room, 'hip', 3.2), f = roofMesh(room, 'flat', 3.2)
  const ys = (a: number[]) => a.filter((_, n) => n % 3 === 1)
  ok(g.roof.length === 2 * 6 * 3 && g.ends.length === 2 * 3 * 3, 'a gable: two sloped quads + two end triangles')
  ok(Math.abs(Math.max(...ys(g.roof)) - (3.2 + (2 + 0.3) * ROOF_PITCH)) < 1e-9 && Math.min(...ys(g.roof)) === 3.2, 'the ridge sits half-span x pitch above the eaves')
  ok(h.roof.length === (2 * 6 + 2 * 3) * 3 && h.ends.length === 0, 'a hip: two trapezoids + two hip triangles, no gable ends')
  const xs = g.roof.filter((_, n) => n % 3 === 0); ok(Math.min(...xs) === -0.3 && Math.max(...xs) === 6.3, 'the eaves overhang the walls by 0.3 m')
  ok(f.slabs.length === 1 && f.slabs[0].x0 === -0.3, 'flat = one slab with the overhang') }
ok(adoptRoof('hip') === 'hip' && adoptRoof('dome') === 'gable' && adoptRoof(undefined) === 'gable', 'a saved roof style round-trips; anything else is a gable')

// ── slice 3: doors, windows, paint
{ const w0 = box(0, 0, 4, 3)
  ok(pieceAt(w0, 1.5, 0.1) === 'h,1,0' && pieceAt(w0, 2, 1.5) === null, 'a tap finds the piece under it, nothing in the middle of a room')
  const d = toggleDoor(w0, 'h,1,0')
  ok(d.ok && d.walls['h,1,0'].kind === 'door' && (d.walls['h,2,0']?.kind === 'door' || d.walls['h,0,0']?.kind === 'door'), 'a door takes the tapped metre and its neighbour')
  if (d.ok) {
    ok(findRooms(d.walls).length === 1, 'a room with a door is still a room')
    const b = wallBoxes(d.walls, 0).filter((_, n) => Object.values(d.walls)[n].kind === 'door')
    ok(b.length === 2 && b.every(x => x.y0 === DOOR_H), 'a door is open from the floor to its lintel (the walker passes)')
    const W2 = terrainWorld({ ground: () => 0, water: () => [], solids: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => wallBoxes(d.walls, 0).filter(q => q.x0 < x1 && q.x1 > x0 && q.y0 < y1 && q.y1 > y0 && q.z0 < z1 && q.z1 > z0) })
    const doorX = d.walls['h,2,0']?.kind === 'door' ? 2 : 1
    ok(W2.bodyFree(doorX, 0, 0) && !W2.bodyFree(3.5, 0, 0), 'the walker fits through the doorway, not through the wall beside it')
    const back = toggleDoor(d.walls, 'h,1,0'); ok(back.ok && Object.values(back.walls).every(x => !x.kind), 'tapping a door fills both halves back in')
    const win = toggleWindow(d.walls, 'h,1,0'); ok(!win.ok, 'a doorway cannot also be a window')
  }
  ok(!toggleDoor({ 'h,0,0': { mat: 'goldwood' } }, 'h,0,0').ok, 'a lone metre of wall is too short for a door')
  const wi = toggleWindow(w0, 'v,0,1'); ok(wi.ok && wi.walls['v,0,1'].kind === 'window' && findRooms(wi.walls).length === 1, 'a window is one metre; the room still stands')
  if (wi.ok) ok(wallBoxes(wi.walls, 0).every(x => x.y0 === -0.5), 'a window is solid to the walker')
  let inv2 = give(newInv(0), 'dawnwood_plank', 3).inv
  const pw = paintWall(w0, inv2, 'h,1,0', 'dawnwood')
  ok('walls' in pw && pw.walls['h,1,0'].mat === 'dawnwood' && countOf(pw.inv, 'dawnwood_plank') === 2 && countOf(pw.inv, 'goldwood_plank') === 1, 'painting a piece takes a plank of the new wood and gives the old one back')
  ok('why' in paintWall(w0, newInv(0), 'h,1,0', 'shimmeroak'), 'no planks of that wood, no paint')
  const room = findRooms(w0)[0], fl = paintFloor(undefined, room, 'shimmeroak')
  ok(Object.keys(fl).length === 12 && floorOf(fl, 2, 1) === 'shimmeroak' && floorOf(fl, 9, 9) === 'goldwood', 'painting a floor paints the whole room; unpainted is Goldwood')
  ok(roomAt(findRooms(w0), 2.5, 1.5)?.key === room.key && roomAt(findRooms(w0), 9, 9) === null, 'a tap inside a room finds it')
  ok(Object.keys(adoptFloors({ '1,2': 'dawnwood', '3,x': 'goldwood', '4,4': 'iron' })).length === 1, 'saved floors round-trip; junk dropped')
  ok(adoptWalls({ 'h,1,1': { mat: 'goldwood', kind: 'door' }, 'h,2,2': { mat: 'goldwood', kind: 'gate' } })['h,1,1'].kind === 'door' && !adoptWalls({ 'h,2,2': { mat: 'goldwood', kind: 'gate' } })['h,2,2'].kind, 'a saved door/window keeps its kind; an unknown kind is a plain wall') }

console.log(`plot-walls: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
