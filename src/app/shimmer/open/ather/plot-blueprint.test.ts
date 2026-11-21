// Run: npx tsx src/app/shimmer/open/ather/plot-blueprint.test.ts
// M39 slice 1: a blueprint is ONE drawn building re-based to 0,0; it round-trips; bad files are refused; it places centred on
// a turned pad with its front toward the green, and the walker bumps its walls (not its doorway).
import { connectedPieces, extractBlueprint, houseProblems, parseHouse, fitsPad, placeBlueprint, bpShaft } from './plot-blueprint'
import { levelBase } from './plot-floors'
import { runKeys, toggleDoor, type Walls } from './plot-walls'
import { terrainWorld } from '../terrain-world'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const loop = (x0: number, z0: number, x1: number, z1: number) => Object.fromEntries([
  ...runKeys({ i: x0, j: z0 }, { i: x1, j: z0 }), ...runKeys({ i: x0, j: z1 }, { i: x1, j: z1 }),
  ...runKeys({ i: x0, j: z0 }, { i: x0, j: z1 }), ...runKeys({ i: x1, j: z0 }, { i: x1, j: z1 }),
].map(k => [k, { mat: 'goldwood' as const }]))
// two buildings on one plot: a 6x4 at (-130,100) and a 3x3 far off
let walls: Walls = { ...loop(-130, 100, -124, 104), ...loop(-110, 90, -107, 93) }
const d = toggleDoor(walls, 'h,-128,100'); if (d.ok) walls = d.walls
ok(connectedPieces(walls, 'h,-128,100').length === 20 && connectedPieces(walls, 'v,-110,91').length === 12, 'a tap picks only the building it touches')
const floors = { '-129,101': { pat: 'planks' as const, col: '#c27a5b' }, '-109,91': { pat: 'tile' as const, col: '#a79bbd' } }
const bp = extractBlueprint(walls, floors, 'hip', 'v,-124,101', 'glade-hazel', "Hazel's yard", 5)!
ok(bp.w === 6 && bp.d === 4 && Object.keys(bp.walls).length === 20, `the footprint is the building's box, re-based (${bp.w}x${bp.d})`)
ok(!!bp.walls['h,2,0'] && bp.walls['h,2,0'].kind === 'door' && Object.keys(bp.walls).every(k => !k.includes('-')), 'pieces re-based to 0,0 keep their kind (the door)')
ok(Object.keys(bp.floors).join() === '1,1' && bp.floors['1,1'].col === '#c27a5b', "only this building's painted floor comes along")
ok(houseProblems(bp).length === 0, `a fresh blueprint is valid (${houseProblems(bp)})`)
const back = parseHouse(JSON.parse(JSON.stringify(bp)))
ok(!!back && JSON.stringify(back.walls) === JSON.stringify(bp.walls) && back.roof === 'hip' && back.name === "Hazel's yard", 'it round-trips through JSON')
ok(houseProblems({ ...bp, id: '../etc' }).length > 0 && houseProblems({ ...bp, walls: { 'h,9,9': { mat: 'goldwood' } } }).length > 0 && houseProblems({ ...bp, w: 99 }).length > 0 && houseProblems(null).length > 0, 'refused: a bad id, a piece outside the footprint, a giant footprint, nothing')
ok(parseHouse({ ...bp, walls: { 'h,0,0': { mat: 'iron' } } }) === null, 'a wood the game does not know is refused (Co. iron is trim, never a wall)')
ok(fitsPad(bp, 13.5, 8.5) && !fitsPad({ w: 14, d: 4 }, 13.5, 8.5) && !fitsPad({ w: 4, d: 9 }, 13.5, 8.5), 'fits a 13.5 x 8.5 pad; too wide or too deep does not')
// place on a pad facing -z (yaw 0): the front (v = 0) should be the pad's -z side
const pl = placeBlueprint(bp, { x: 0, z: 0, yaw: 0, y: 10 })
const fl = pl.toWorld(0, 0), br = pl.toWorld(bp.w, bp.d)
ok(Math.abs(fl.x + 3) < 1e-9 && Math.abs(fl.z + 2) < 1e-9 && Math.abs(br.x - 3) < 1e-9 && Math.abs(br.z - 2) < 1e-9, 'centred on the pad, front to the pad\'s front (yaw 0 faces -z)')
const pl2 = placeBlueprint(bp, { x: 0, z: 0, yaw: Math.PI / 2, y: 10 }), f2 = pl2.toWorld(bp.w / 2, 0)
ok(Math.abs(f2.x + 2) < 1e-9 && Math.abs(f2.z) < 1e-9, 'turned a quarter: the front faces the turned way (yaw pi/2 faces -x)')
ok(Math.abs(pl2.group.rotY - Math.PI / 2) < 1e-9, 'the renderer group turns by the pad\'s yaw')
const W = terrainWorld({ ground: () => 10, water: () => [], solids: (x0: number, _y0: number, z0: number, x1: number, _y1: number, z1: number) => pl.boxes.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0) })
const door = pl.toWorld(3, 0), wall = pl.toWorld(5, 0)
ok(W.bodyFree(door.x, door.z, 10) && !W.bodyFree(wall.x, wall.z, 10), 'the walker passes the doorway and is stopped by the wall beside it')

// ── M47 close-out: a blueprint with a lift carries its SHAFT OPENING ──────────────────────────────────────────────────────────
{
  const g = loop(10, 10, 16, 15), u = loop(10, 10, 16, 15)   // a 6 x 5 house, the same room on floor 2 (built: paid by room key)
  const lifts = [{ x: 12.5, z: 12.5, top: 1 }, { x: 14.5, z: 13.5, top: 2 }, { x: 40.5, z: 40.5, top: 1 }, { x: 11.5, z: 11.5, top: 0 }]
  const b2 = extractBlueprint(g, {}, 'gable', 'h,10,10', 'glade-sax', 'Lift house', 1, [{ walls: u, floors: {} }], undefined, lifts)!
  ok(JSON.stringify(b2.lifts) === JSON.stringify([{ i: 2, j: 2, top: 1 }, { i: 4, j: 3, top: 1 }]), `lifts re-based, top clamped to the kept levels, outside + top-0 dropped: ${JSON.stringify(b2.lifts)}`)
  ok(houseProblems(b2).length === 0, `a lift blueprint is valid: ${houseProblems(b2).join('; ')}`)
  const back = parseHouse(JSON.parse(JSON.stringify(b2)))!
  ok(JSON.stringify(back.lifts) === JSON.stringify(b2.lifts), 'lifts survive the save round trip')
  ok(bpShaft(back, 1).has('2,2') && bpShaft(back, 1).has('4,3') && bpShaft(back, 0).size === 0 && bpShaft(back, 2).size === 0, 'bpShaft: level 1 open over both shafts, ground + above the top closed')
  const one = extractBlueprint(g, {}, 'gable', 'h,10,10', 'glade-sax', 'Bungalow', 1, undefined, undefined, lifts)!
  ok(one.lifts === undefined, 'a one-storey blueprint carries no shaft (nothing to open)')
  ok(parseHouse({ ...b2, lifts: undefined })!.lifts === undefined, 'an old blueprint (no lifts) loads with none')
  for (const [bad, why] of [[[{ i: 9, j: 1, top: 1 }], 'outside the footprint'], [[{ i: 1, j: 1, top: 0 }], 'top 0'], [[{ i: 1, j: 1, top: 3 }], 'top above the last level'], [[{ i: 1.5, j: 1, top: 1 }], 'half a cell'], [[{ i: 1, j: 1, top: 1 }, { i: 1, j: 1, top: 1 }], 'two on one cell'], ['x', 'not a list']] as const)
    ok(houseProblems({ ...b2, lifts: bad }).length > 0 && parseHouse({ ...b2, lifts: bad }) === null, `lifts refused: ${why}`)
  // the walker: dropped from above the slab, it lands ON the slab beside the shaft and falls THROUGH the shaft to the ground
  const pad = { x: 0, z: 0, yaw: 0, y: 10 }, pl2 = placeBlueprint(back, pad), slabTop = pad.y + levelBase(1)
  const W2 = terrainWorld({ ground: () => 10, water: () => [], solids: (x0: number, _y0: number, z0: number, x1: number, _y1: number, z1: number) => pl2.boxes.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0) })
  const shaftAt = pl2.toWorld(2.5, 2.5), besideAt = pl2.toWorld(1.5, 1.5)
  const slabUnder = (p: { x: number; z: number }) => pl2.boxes.some(b => b.x0 <= p.x && b.x1 >= p.x && b.z0 <= p.z && b.z1 >= p.z && Math.abs(b.y1 - slabTop) < 0.01)
  ok(!slabUnder(shaftAt) && slabUnder(besideAt), `no slab box over the shaft cell, slab beside it (${slabUnder(shaftAt)} / ${slabUnder(besideAt)})`)
  ok(W2.bodyFree(shaftAt.x, shaftAt.z, slabTop - 0.1) && !W2.bodyFree(besideAt.x, besideAt.z, slabTop - 0.1), 'a body fits up the open shaft through the slab line; beside it the slab is solid')
}

console.log(`plot-blueprint: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
