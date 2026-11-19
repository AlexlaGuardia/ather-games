// Run: npx tsx src/app/shimmer/open/ather/plot-blueprint.test.ts
// M39 slice 1: a blueprint is ONE drawn building re-based to 0,0; it round-trips; bad files are refused; it places centred on
// a turned pad with its front toward the green, and the walker bumps its walls (not its doorway).
import { connectedPieces, extractBlueprint, houseProblems, parseHouse, fitsPad, placeBlueprint } from './plot-blueprint'
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
const floors = { '-129,101': 'dawnwood' as const, '-109,91': 'shimmeroak' as const }
const bp = extractBlueprint(walls, floors, 'hip', 'v,-124,101', 'glade-hazel', "Hazel's yard", 5)!
ok(bp.w === 6 && bp.d === 4 && Object.keys(bp.walls).length === 20, `the footprint is the building's box, re-based (${bp.w}x${bp.d})`)
ok(!!bp.walls['h,2,0'] && bp.walls['h,2,0'].kind === 'door' && Object.keys(bp.walls).every(k => !k.includes('-')), 'pieces re-based to 0,0 keep their kind (the door)')
ok(Object.keys(bp.floors).join() === '1,1' && bp.floors['1,1'] === 'dawnwood', "only this building's painted floor comes along")
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

console.log(`plot-blueprint: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
