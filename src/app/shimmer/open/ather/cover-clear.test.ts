// M23: placed things clear the grass. Run: npx tsx src/app/shimmer/open/ather/cover-clear.test.ts
import { coverClear, placedRects, CLEAR_PAD } from './cover-clear'
import { freshWorks, footprint, pieceRect, TABLE, type Works } from './rooms'
import { FURNITURE } from './furniture'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const grid = (r: { x0: number; x1: number; z0: number; z1: number }, step = 0.2) => { const pts: [number, number][] = []; for (let x = r.x0 + 0.01; x < r.x1; x += step) for (let z = r.z0 + 0.01; z < r.z1; z += step) pts.push([x, z]); return pts }
const item = Object.keys(FURNITURE).find(k => FURNITURE[k].recipe.length > 0)!
const w: Works = { ...freshWorks(), rooms: [{ id: 'r1', kind: 'farm', x: -100, z: 100, q: 1, placedAt: 0, doneAt: 0 } as Works['rooms'][number]], pieces: [{ id: 'p1', item, x: -90, z: 95, q: 0, placedAt: 0 }, { id: 'p2', item: 'water_tap', x: -88, z: 92, q: 1, placedAt: 0 }] }
const skip = coverClear(w)
const room = footprint('farm', -100, 100, 1), piece = pieceRect(item, -90, 95, 0), tap = pieceRect('water_tap', -88, 92, 1)
ok(grid(room).every(([x, z]) => skip(x, z)), 'the whole room floor is clear')
ok(grid(piece).every(([x, z]) => skip(x, z)), `the whole ${item} footprint is clear`)
ok(grid(tap).every(([x, z]) => skip(x, z)), 'the water tap is clear')
ok(skip(TABLE.x, TABLE.z), 'the planning table is clear')
ok(placedRects(w).length === 1 + 2 + 1 + 1, `room + pieces + starter chest + table (${placedRects(w).length})`)
ok(!skip(room.x1 + CLEAR_PAD + 0.6, (room.z0 + room.z1) / 2), 'grass grows just past the room\'s margin')
ok(!skip(-60, 60), 'open ground still grows')
// lifted: the piece's floor grows again, the room's stays clear
const lifted = coverClear({ ...w, pieces: w.pieces.filter(p => p.id !== 'p1') })
ok(grid(piece).every(([x, z]) => !lifted(x, z)), 'lift the piece: its floor grows again')
ok(grid(room).every(([x, z]) => lifted(x, z)), 'the room stays clear')
ok(coverClear(w) !== skip, 'a new works gives a new skip (the cover re-lays on identity)')
// M37: a drawn 4x3 room far from everything clears its floor and walls; outside it the grass stays
{ const walls: Record<string, { mat: 'goldwood' }> = {}
  for (let i = 60; i < 64; i++) { walls[`h,${i},60`] = { mat: 'goldwood' }; walls[`h,${i},63`] = { mat: 'goldwood' } }
  for (let j = 60; j < 63; j++) { walls[`v,60,${j}`] = { mat: 'goldwood' }; walls[`v,64,${j}`] = { mat: 'goldwood' } }
  const s2 = coverClear({ ...w, walls })
  ok(s2(62, 61.5) && s2(60, 61) && s2(63.8, 60.2), 'a drawn room clears its floor and its walls')
  ok(!s2(70, 61.5) && !s2(62, 66), 'outside the drawn room the grass stays') }
console.log(`cover-clear: ${pass} pass, ${fails.length} fail`); fails.forEach(f => console.log('  FAIL', f)); if (fails.length) process.exit(1)
